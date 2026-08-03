/**
 * RoadNetwork — road graph with localized (dirty-flag) recomputation (ROAD-01).
 *
 * Roads are an undirected graph whose nodes are road tiles and whose edges join
 * orthogonally adjacent road tiles. We maintain a component coloring so that
 * connectivity/reachability queries are O(1) (same component) or fast BFS, and
 * we recompute only the affected region when a road is added or removed rather
 * than rebuilding the whole map.
 */
import type { Map as SimMap } from './map';
import type { Vec2 } from './types';

const DIRS: readonly Vec2[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function key(x: number, y: number): number {
  return (x << 20) | y;
}
function tileKey(t: Vec2): number {
  return key(t.x, t.y);
}
function unkey(k: number): Vec2 {
  return { x: k >> 20, y: k & 0xfffff };
}

export class RoadNetwork {
  /** adjacency: tileKey -> set of neighbor tileKeys. */
  private edges = new Map<number, Set<number>>();
  /** component coloring: tileKey -> component id. */
  private components = new Map<number, number>();
  private nextComponent = 0;

  /** Tiles touched by the most recent incremental change (observability/dirty set). */
  private lastAffected: Vec2[] = [];

  constructor(map?: SimMap) {
    if (map) this.build(map);
  }

  /** The dirty set from the most recent add/remove (affected region). */
  affectedTiles(): Vec2[] {
    return [...this.lastAffected];
  }

  isRoad(x: number, y: number): boolean {
    return this.edges.has(key(x, y));
  }

  /** Full build: scan every road tile and mark components. */
  build(map: SimMap): void {
    this.edges.clear();
    this.components.clear();
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.get(x, y) === 'road') this.insertNode(x, y);
      }
    }
    // Re-color components from scratch over all nodes.
    this.recolorAll();
  }

  /** Add a road tile, unioning the components of its road neighbors (local). */
  addRoad(x: number, y: number): void {
    const k = key(x, y);
    const neighbors = this.roadNeighbors(x, y).map(tileKey);
    for (const nk of neighbors) {
      const set = this.edges.get(nk);
      set?.add(k);
    }
    const set = this.edges.get(k) ?? new Set<number>();
    for (const nk of neighbors) set.add(nk);
    this.edges.set(k, set);
    // An isolated add has no road neighbors, so seed the recolor with the new
    // tile itself — otherwise the fallback branch would receive an empty seeds
    // list, never flood, and the tile would have no component id.
    const seeds = neighbors.length > 0 ? neighbors : [k];
    this.lastAffected = this.recolorRegion(seeds);
  }

  /** Remove a road tile, splitting components that lose their only link (local). */
  removeRoad(x: number, y: number): void {
    const k = key(x, y);
    const neighbors = [...(this.edges.get(k) ?? [])];
    this.edges.delete(k);
    for (const nk of neighbors) this.edges.get(nk)?.delete(k);
    this.components.delete(k);
    this.lastAffected = this.recolorRegion(neighbors);
  }

  /** Orthogonally adjacent road tiles. */
  roadNeighbors(x: number, y: number): Vec2[] {
    const out: Vec2[] = [];
    for (const d of DIRS) {
      const nx = x + d.x;
      const ny = y + d.y;
      if (this.edges.has(key(nx, ny))) out.push({ x: nx, y: ny });
    }
    return out;
  }

  /** Whether two tiles are in the same connected road component. */
  connected(a: Vec2, b: Vec2): boolean {
    const ca = this.components.get(tileKey(a));
    const cb = this.components.get(tileKey(b));
    if (ca === undefined || cb === undefined) return false;
    return ca === cb;
  }

  /** Isolated at both endpoints mislabeled? */
  nodeCount(): number {
    return this.edges.size;
  }

  private insertNode(x: number, y: number): void {
    const k = key(x, y);
    if (this.edges.has(k)) return;
    const set = new Set<number>();
    for (const d of DIRS) {
      const nk = key(x + d.x, y + d.y);
      if (this.edges.has(nk)) {
        set.add(nk);
        this.edges.get(nk)!.add(k);
      }
    }
    this.edges.set(k, set);
  }

  private recolorAll(): void {
    this.components.clear();
    for (const k of this.edges.keys()) {
      if (!this.components.has(k)) this.floodComponent(k);
    }
  }

  /** Re-color just the components touched by `seeds` (neighbors of a change).
   *  Returns the tiles actually re-computed (the affected/dirty region). */
  private recolorRegion(seeds: number[]): Vec2[] {
    const touchedCompIds = new Set<number>();
    // Clear coloring for any component that a seed belongs to.
    for (const k of seeds) {
      const c = this.components.get(k);
      if (c === undefined) continue;
      touchedCompIds.add(c);
    }
    if (touchedCompIds.size === 0) {
      // New isolated node (no neighbors) gets a fresh component. Seeds here are
      // bare keys with no prior component (the caller seeds isolated adds with
      // the new tile itself).
      const colored: Vec2[] = [];
      for (const k of seeds) {
        if (this.edges.has(k) && !this.components.has(k)) {
          this.floodComponent(k);
          colored.push(unkey(k));
        }
      }
      return colored;
    }
    const affected = new Set<number>();
    this.components.forEach((c, k) => {
      if (touchedCompIds.has(c)) affected.add(k);
    });
    for (const k of affected) this.components.delete(k);
    // Re-flood each affected seed that still has edges; collect every tile that
    // ends up with a freshly assigned component (the genuinely re-computed
    // region, including any tile newly added by this change).
    const recolored = new Set<number>();
    for (const k of [...affected, ...seeds]) {
      if (this.edges.has(k) && !this.components.has(k)) {
        for (const ck of this.floodComponent(k)) recolored.add(ck);
      }
    }
    return [...recolored].map(unkey);
  }

  private floodComponent(start: number): Set<number> {
    const id = this.nextComponent++;
    const colored = new Set<number>();
    const stack = [start];
    this.components.set(start, id);
    colored.add(start);
    while (stack.length) {
      const cur = stack.pop()!;
      for (const nb of this.edges.get(cur) ?? []) {
        if (!this.components.has(nb)) {
          this.components.set(nb, id);
          colored.add(nb);
          stack.push(nb);
        }
      }
    }
    return colored;
  }
}
