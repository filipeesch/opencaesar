import type { Map as SimMap } from './map';
import type { Vec2 } from './types';

const DIRS: readonly Vec2[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** Road tiles orthogonally adjacent to (x, y). */
export function roadNeighbors(map: SimMap, x: number, y: number): Vec2[] {
  const out: Vec2[] = [];
  for (const d of DIRS) {
    const nx = x + d.x;
    const ny = y + d.y;
    if (map.get(nx, ny) === 'road') out.push({ x: nx, y: ny });
  }
  return out;
}

function key(x: number, y: number): number {
  // 20 bits each — ample for maps up to 1024x1024.
  return (x << 20) | y;
}

/**
 * A* over the road graph. Deterministic: identical inputs → identical paths
 * (open list is FIFO, so ties resolve by insertion order, never by object
 * identity or hash order). Returns the list of tiles from start to goal
 * (inclusive of start, exclusive of goal) or null when unreachable.
 */
export function findRoadPath(map: SimMap, start: Vec2, goal: Vec2): Vec2[] | null {
  if (!map.inBounds(start.x, start.y) || !map.inBounds(goal.x, goal.y)) return null;
  if (start.x === goal.x && start.y === goal.y) return [];
  if (map.get(goal.x, goal.y) !== 'road') return null;

  interface Node {
    tile: Vec2;
    parent: Node | null;
    g: number;
    f: number;
  }

  const startNode: Node = { tile: start, parent: null, g: 0, f: manhattan(start, goal) };
  const open: Node[] = [startNode];
  const openIndex = new Map<number, Node>();
  const closed = new Set<number>();
  openIndex.set(key(start.x, start.y), startNode);

  while (open.length > 0) {
    // FIFO scan for the lowest f — deterministic, plenty fast for 40x40 roads.
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const node = open[bestIdx];
    open.splice(bestIdx, 1);
    openIndex.delete(key(node.tile.x, node.tile.y));

    if (node.tile.x === goal.x && node.tile.y === goal.y) {
      // Reconstruct path (exclusive of goal, inclusive of start).
      const path: Vec2[] = [];
      let cur: Node | null = node.parent;
      while (cur && cur.parent !== null) {
        path.unshift(cur.tile);
        cur = cur.parent;
      }
      return path;
    }

    closed.add(key(node.tile.x, node.tile.y));

    for (const d of DIRS) {
      const nx = node.tile.x + d.x;
      const ny = node.tile.y + d.y;
      if (map.get(nx, ny) !== 'road') continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const g = node.g + 1;
      const existing = openIndex.get(nk);
      if (existing) {
        if (g < existing.g) {
          existing.g = g;
          existing.f = g + manhattan({ x: nx, y: ny }, goal);
          existing.parent = node;
        }
        continue;
      }
      const child: Node = {
        tile: { x: nx, y: ny },
        parent: node,
        g,
        f: g + manhattan({ x: nx, y: ny }, goal),
      };
      open.push(child);
      openIndex.set(nk, child);
    }
  }
  return null;
}

/** Manhattan distance — admissible heuristic for 4-directional road movement. */
function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
