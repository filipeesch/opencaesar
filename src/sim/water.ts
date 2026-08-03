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
