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
/**
 * Water class of a house tile. `'grand'` is the documented forward contract
 * for an aqueduct-served "grand water" upgrade; WaterSystem.compute does not
 * emit it yet (only none/basic/clean), so the overlay mapping never reads 3
 * today (IN-02).
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
  desirability: number;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/** Desirability penalty a well applies to tiles within its radius (WATR-01). */
export const WELL_DESIRABILITY_PENALTY = 4;

/** Desirability bonus an active fountain applies to tiles within its radius (WATR-04). */
export const FOUNTAIN_DESIRABILITY_BONUS = 4;

/** Lower bound of merged per-tile water desirability (WR-02). Two overlapping well penalties is the realistic floor. */
export const WATER_DESIRABILITY_MIN = -2 * WELL_DESIRABILITY_PENALTY;

/** Upper bound / natural cap of merged per-tile water desirability (WR-02). */
export const WATER_DESIRABILITY_MAX = 2 * FOUNTAIN_DESIRABILITY_BONUS;

/**
 * WR-02 merge rule — the single per-tile composition function every water
 * desirability surface feeds (well/fountain deltas, bath bonuses, future
 * sources). Contract: contributions are ADDITIVE and the per-tile result is
 * clamped to the documented [WATER_DESIRABILITY_MIN, WATER_DESIRABILITY_MAX]
 * band — an "additive-with-natural-cap" rule — so overlapping surfaces compose
 * deterministically and Phase 18 can add the merged grid to the 0..200 house
 * rating without double-counting or unbounded stacking.
 *
 *   merged[y][x] = clamp(base[y][x] + apply(x, y), WATER_DESIRABILITY_MIN, WATER_DESIRABILITY_MAX)
 *
 * `base` is the accumulated [y][x] grid (all zeros to start); `apply` returns
 * the current surface's per-tile delta. Feed the returned grid back as `base`
 * to compose another surface. To keep a non-accumulative surface (e.g. baths,
 * which cap at BATH_DESIRABILITY_BONUS), the surface itself yields 0 outside
 * its footprint and the clamp enforces the cap.
 */
export function mergeWaterDesirability(
  base: number[][],
  apply: (x: number, y: number) => number,
): number[][] {
  const merged: number[][] = [];
  for (let y = 0; y < base.length; y++) {
    const row: number[] = [];
    for (let x = 0; x < base[y].length; x++) {
      const v = base[y][x] + apply(x, y);
      row.push(Math.max(WATER_DESIRABILITY_MIN, Math.min(WATER_DESIRABILITY_MAX, v)));
    }
    merged.push(row);
  }
  return merged;
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
          desirability: 0,
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

    // Desirability pass (WATR-01 / WATR-04): compose every source's per-tile
    // delta through the single WR-02 merge rule — additive, clamped to the
    // documented band — so overlapping well/fountain coverage stacks
    // deterministically and the surface stays bounded for the Phase 18 merge.
    let desirability: number[][] = Array.from({ length: height }, () => new Array(width).fill(0));
    for (const src of this.sources) {
      if (!src.active) continue;
      desirability = mergeWaterDesirability(desirability, (x, y) => {
        if (dist(x, y, src.x, src.y) > src.radius) return 0;
        if (src.kind === 'well') return -WELL_DESIRABILITY_PENALTY;
        if (src.kind === 'fountain') return FOUNTAIN_DESIRABILITY_BONUS;
        return 0;
      });
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        grid[y][x].desirability = desirability[y][x];
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

/** Fountain network requirement (WATR-04): a fountain needs supply + staff to work. */
export interface FountainDef {
  x: number;
  y: number;
  radius: number;
  /** True while the fountain is connected to flowing water (e.g. a flowing aqueduct). */
  supplied: boolean;
  /** True while the fountain has workers. */
  staffed: boolean;
}

/**
 * Map fountain defs onto water sources: a fountain is active only when supplied
 * AND staffed — it goes dark (inactive) if it loses water or workers.
 */
export function resolveFountainActivity(defs: FountainDef[]): WaterSource[] {
  return defs.map((def) => ({
    x: def.x,
    y: def.y,
    kind: 'fountain' as WaterSourceKind,
    active: def.supplied && def.staffed,
    // Negative radius is degenerate — treat it as a self-tile-only source (IN-03).
    radius: Math.max(0, def.radius),
  }));
}

export interface ReservoirDef {
  x: number;
  y: number;
  /** Footprint edge of the square reservoir. */
  size: number;
  /** True when staffed and available (before supply check). */
  active: boolean;
}

/** Storage capacity of a filled reservoir, in water units (WATR-02). */
export const RESERVOIR_STORAGE_CAPACITY = 256;

/** Observable reservoir state for the WATR-02 storage/inlet/outlet/level surface. */
export interface ReservoirState {
  x: number;
  y: number;
  size: number;
  capacity: number;
  level: number;
  filled: boolean;
  inletConnected: boolean;
  outletToAqueduct: boolean;
}

/**
 * True when any orthogonally adjacent in-bounds tile to the reservoir footprint
 * is map water. Replicates the perimeter-neighbor scan used by
 * AqueductSystem.reservoirTouchesWater; does not gate on `active`.
 */
export function reservoirTouchesMapWater(
  r: ReservoirDef,
  width: number,
  height: number,
  hasMapWater: (x: number, y: number) => boolean,
): boolean {
  for (let y = r.y; y < r.y + r.size; y++) {
    for (let x = r.x; x < r.x + r.size; x++) {
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

/**
 * True when any tile of the `flowing` set is orthogonally adjacent to the
 * reservoir footprint (keys encoded as `y * 100000 + x`, matching AqueductSystem).
 */
function reservoirAdjacentToFlowing(r: ReservoirDef, flowing: Set<number>): boolean {
  for (let y = r.y; y < r.y + r.size; y++) {
    for (let x = r.x; x < r.x + r.size; x++) {
      const neighbours = [
        [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
      ];
      for (const [nx, ny] of neighbours) {
        if (flowing.has(ny * 100000 + nx)) return true;
      }
    }
  }
  return false;
}

/**
 * Derive observable reservoir state (storage, level, inlet, outlet) from the
 * water-model inputs. A reservoir is filled when active and connected to map
 * water or a flowing aqueduct; level is capacity when filled else 0.
 */
export function computeReservoirStates(
  width: number,
  height: number,
  hasMapWater: (x: number, y: number) => boolean,
  reservoirs: ReservoirDef[],
  flowing: Set<number>,
): ReservoirState[] {
  return reservoirs.map((r) => {
    const touchesWater = reservoirTouchesMapWater(r, width, height, hasMapWater);
    const feedsFlow = reservoirAdjacentToFlowing(r, flowing);
    const filled = r.active && (touchesWater || feedsFlow);
    return {
      x: r.x,
      y: r.y,
      size: r.size,
      capacity: RESERVOIR_STORAGE_CAPACITY,
      level: filled ? RESERVOIR_STORAGE_CAPACITY : 0,
      filled,
      inletConnected: touchesWater || feedsFlow,
      outletToAqueduct: feedsFlow,
    };
  });
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
    return reservoirTouchesMapWater(r, width, height, hasMapWater);
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

/** Default water consumed per active bath per tick (WATR-05). */
export const BATH_DEFAULT_WATER_COST = 1;

/** Wellness bonus an active bath grants to tiles within its radius (WATR-05). */
export const BATH_WELLNESS_BONUS = 1;

/**
 * Desirability bonus an active bath grants to tiles within its radius (WATR-05).
 * Capped per tile: overlapping baths do not stack (Math.max semantics), so the
 * bath surface stays non-accumulative within the WR-02 merge band.
 */
export const BATH_DESIRABILITY_BONUS = 4;

/** Bath network/worker requirement (WATR-05): reservoir water + workers to operate. */
export interface BathDef {
  x: number;
  y: number;
  radius: number;
  /** True while the bath receives reservoir water. */
  supplied: boolean;
  /** True while the bath has workers. */
  staffed: boolean;
  /** Water consumed per tick while active; defaults to BATH_DEFAULT_WATER_COST. */
  waterCostPerTick?: number;
}

/**
 * Resolve bath defs into active public baths: a bath operates only when supplied
 * AND staffed, and consumes water (waterCostPerTick ?? BATH_DEFAULT_WATER_COST)
 * per active bath per tick.
 */
export function resolveBaths(defs: BathDef[]): { active: PublicBathDef[]; waterConsumed: number } {
  const active: PublicBathDef[] = [];
  let waterConsumed = 0;
  for (const def of defs) {
    if (!(def.supplied && def.staffed)) continue;
    // Negative radius is degenerate — clamp to a self-tile-only bath (IN-03).
    active.push({ x: def.x, y: def.y, radius: Math.max(0, def.radius), active: true });
    // Negative water cost must never let an active bath *add* water (IN-03).
    waterConsumed += Math.max(0, def.waterCostPerTick ?? BATH_DEFAULT_WATER_COST);
  }
  return { active, waterConsumed };
}

/**
 * Wire baths to the health/desirability surface: wellness grid feeds health and
 * the desirability grid feeds sim desirability, gated on supplied && staffed.
 */
export function assignBathEffects(
  defs: BathDef[],
  width: number,
  height: number,
): { wellness: number[][]; desirability: number[][]; waterConsumed: number } {
  const { active, waterConsumed } = resolveBaths(defs);
  const { wellness, desirability } = computeBathCoverage(active, width, height);
  return { wellness, desirability, waterConsumed };
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
          // Bath wellness/desirability are non-accumulative coverage bonuses
          // (Math.max) — overlapping baths do not stack (WR-02).
          wellness[y][x] = Math.max(wellness[y][x], BATH_WELLNESS_BONUS);
          desirability[y][x] = Math.max(desirability[y][x], BATH_DESIRABILITY_BONUS);
        }
      }
    }
  }
  return { wellness, desirability };
}
