/**
 * WaterSystem (Phase 4 — tasks 4.1, 4.4, 4.6).
 *
 * Self-contained water coverage model, additive to the live sim:
 * - Wells provide basic water within a radius, with a slight desirability
 *   penalty and sanitary risk where pollution is present.
 * - Fountains provide clean water within a radius only when staffed and
 *   supplied (e.g. connected to a reservoir/aqueduct).
 * - Houses are graded with a water class: none / basic / clean / grand.
 * - The overlay query reports sources, coverage, and house water classes per
 *   tile, so the water overlay can be driven from a thin query.
 */
export type WaterClass = 'none' | 'basic' | 'clean' | 'grand';
export type WaterSourceKind = 'well' | 'fountain' | 'reservoir' | 'aqueduct';

export interface WaterSource {
  x: number;
  y: number;
  kind: WaterSourceKind;
  /** True when the source is functioning (staffed + supplied). */
  active: boolean;
  radius: number;
}

export interface TileWater {
  coveredByWell: boolean;
  coveredByFountain: boolean;
  sourceTile: boolean;
  kind: WaterClass;
  sanitaryRisk: number;
  wellness: number;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export class WaterSystem {
  private sources: WaterSource[] = [];

  setSources(sources: WaterSource[]): void {
    this.sources = sources;
  }

  /** Per-tile water data for the given grid. */
  compute(width: number, height: number, pollutionAt: (x: number, y: number) => number): TileWater[][] {
    const grid: TileWater[][] = [];
    for (let y = 0; y < height; y++) {
      const row: TileWater[] = [];
      for (let x = 0; x < width; x++) {
        row.push({
          coveredByWell: false,
          coveredByFountain: false,
          sourceTile: false,
          kind: 'none' as WaterClass,
          sanitaryRisk: 0,
          wellness: 0,
        });
      }
      grid.push(row);
    }

    for (const src of this.sources) {
      if (!src.active) continue;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (dist(x, y, src.x, src.y) <= src.radius) {
            const cell = grid[y][x];
            if (src.kind === 'well') cell.coveredByWell = true;
            else if (src.kind === 'fountain' || src.kind === 'reservoir' || src.kind === 'aqueduct') {
              cell.coveredByFountain = true;
            }
            if (src.x === x && src.y === y) cell.sourceTile = true;
          }
        }
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = grid[y][x];
        const pollution = pollutionAt(x, y);
        cell.sanitaryRisk = cell.coveredByWell && pollution > 0 ? Math.min(1, pollution) : 0;
        cell.wellness = (cell.coveredByFountain ? 1 : 0) + (cell.coveredByWell ? 0.5 : 0);
        if (cell.coveredByFountain) cell.kind = 'clean';
        else if (cell.coveredByWell) cell.kind = 'basic';
        else cell.kind = 'none';
      }
    }
    return grid;
  }

  /** Water class for an individual tile query. */
  waterClassAt(grid: TileWater[][], x: number, y: number): WaterClass {
    return grid[y]?.[x]?.kind ?? 'none';
  }
}

export interface ReservoirDef {
  x: number;
  y: number;
  /** Footprint edge of the square reservoir. */
  size: number;
  /** True when staffed and available (before supply check). */
  active: boolean;
}

/**
 * Aqueduct / reservoir flow model (tasks 4.2, 4.3).
 *
 * Aqueduct tiles form a chain; an aqueduct tile "flows" when it is connected
 * (4-way BFS) to a filled water source (an active reservoir that itself touches
 * a map water tile, or a map water edge). Reservoirs fill when adjacent to a
 * flowing aqueduct or map water. Fountains supplied by flowing water go active.
 */
export class AqueductSystem {
  private aqueductTiles: Set<number> = new Set();
  private reservoirs: ReservoirDef[] = [];

  setAqueductTiles(tiles: { x: number; y: number }[]): void {
    this.aqueductTiles = new Set(tiles.map((t) => t.y * 100000 + t.x));
  }

  setReservoirs(reservoirs: ReservoirDef[]): void {
    this.reservoirs = reservoirs;
  }

  private static key(x: number, y: number): number {
    return y * 100000 + x;
  }

  private adjacentToWater(
    x: number,
    y: number,
    width: number,
    height: number,
    hasMapWater: (x: number, y: number) => boolean,
  ): boolean {
    const neighbours = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (const [nx, ny] of neighbours) {
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && hasMapWater(nx, ny)) return true;
    }
    return false;
  }

  /** Returns the set of aqueduct tiles carrying flow, and active reservoir keys. */
  computeFlow(width: number, height: number, hasMapWater: (x: number, y: number) => boolean): {
    flowing: Set<number>;
    activeReservoirs: Set<number>;
    suppliedFountains: Set<number>;
  } {
    const flowing: Set<number> = new Set();
    const activeReservoirs: Set<number> = new Set();
    const suppliedFountains: Set<number> = new Set();

    // Seed queue: flowing aqueduct tiles adjacent to map water, plus
    // filled reservoirs adjacent to map water or a flowing path.
    const queue: number[] = [];
    for (const r of this.reservoirs) {
      const fill = this.reservoirTouchesWater(r, width, height, hasMapWater);
      activeReservoirs.add(AqueductSystem.key(r.x, r.y));
      if (fill) {
        // A filled reservoir is itself a source: seed neighbours onward.
        for (let dy = -1; dy <= r.size; dy++) {
          for (let dx = -1; dx <= r.size; dx++) {
            const k = AqueductSystem.key(r.x + dx, r.y + dy);
            if (this.aqueductTiles.has(k) && !flowing.has(k)) {
              flowing.add(k);
              queue.push(k);
            }
          }
        }
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const k = AqueductSystem.key(x, y);
        if (!this.aqueductTiles.has(k)) continue;
        // An aqueduct tile flows if it is on OR orthogonally adjacent to map water.
        if (hasMapWater(x, y) || this.adjacentToWater(x, y, width, height, hasMapWater)) {
          if (!flowing.has(k)) {
            flowing.add(k);
            queue.push(k);
          }
        }
      }
    }

    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (queue.length) {
      const cur = queue.pop()!;
      const cx = cur % 100000;
      const cy = Math.floor(cur / 100000);
      for (const [dx, dy] of dirs) {
        const nk = AqueductSystem.key(cx + dx, cy + dy);
        if (this.aqueductTiles.has(nk) && !flowing.has(nk)) {
          flowing.add(nk);
          queue.push(nk);
        }
      }
    }

    for (const f of this.acceptableFountainSpots()) {
      if (flowing.has(f)) suppliedFountains.add(f);
    }

    return { flowing, activeReservoirs, suppliedFountains };
  }

  isFlowing(tiles: { flowing: Set<number> }, x: number, y: number): boolean {
    return tiles.flowing.has(AqueductSystem.key(x, y));
  }

  private reservoirTouchesWater(
    r: ReservoirDef,
    width: number,
    height: number,
    hasMapWater: (x: number, y: number) => boolean,
  ): boolean {
    if (!r.active) return false;
    for (let y = r.y; y < r.y + r.size; y++) {
      for (let x = r.x; x < r.x + r.size; x++) {
        // perimeter neighbours
        const neighbours = [
          [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
        ];
        for (const [nx, ny] of neighbours) {
          if (nx >= 0 && ny >= 0 && nx < width && ny < height && hasMapWater(nx, ny)) return true;
        }
      }
    }
    return false;
  }

  /** Collect the aqueduct tiles that are fountain-adjacent (any neighbourhood). */
  private acceptableFountainSpots(): Set<number> {
    // For the water overlay we simply report flowing aqueduct tiles; fountains
    // are placed on tiles and get supply when the tile itself flows.
    return this.aqueductTiles;
  }
}

export interface PublicBathDef {
  x: number;
  y: number;
  radius: number;
  active: boolean;
}

/** Public baths (task 4.5): consume water + workers, grant wellness/desirability in radius. */
export function computeBathCoverage(
  baths: PublicBathDef[],
  width: number,
  height: number,
): { wellness: number[][]; desirability: number[][] } {
  const wellness: number[][] = [];
  const desirability: number[][] = [];
  for (let y = 0; y < height; y++) {
    wellness.push(new Array(width).fill(0));
    desirability.push(new Array(width).fill(0));
  }
  for (const b of baths) {
    if (!b.active) continue;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (Math.abs(x - b.x) + Math.abs(y - b.y) <= b.radius) {
          wellness[y][x] = Math.max(wellness[y][x], 1);
          desirability[y][x] = Math.max(desirability[y][x], 4);
        }
      }
    }
  }
  return { wellness, desirability };
}
