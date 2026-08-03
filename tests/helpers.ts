/**
 * Shared helpers for Vitest suites: scenario runner and the happy-path city.
 */
import type { Map } from '../src/sim/map';
import { Map as SimMap } from '../src/sim/map';
import { SimRunner } from '../src/sim/runner';
import type { BuildingType } from '../src/sim/types';

export type Setup = (runner: SimRunner) => void;

/** Build a runner over `map`, run `setup` commands, then tick `ticks` times. */
export function runScenario(seed: number, map: Map, setup: Setup, ticks: number): SimRunner {
  const runner = new SimRunner(seed, map);
  setup(runner);
  for (let i = 0; i < ticks; i++) runner.tick();
  return runner;
}

/** Place a building, throwing on rejection so setup failures are loud. */
export function place(r: SimRunner, type: BuildingType, x: number, y: number): void {
  const result = r.placeBuilding(type, x, y);
  if (!result.ok) throw new Error(`place ${type}@${x},${y} rejected: ${result.error}`);
}

/** All-earth 12x12 map with a fertile patch at (0..1, 1..2) for the farm. */
export function foodChainMap(): Map {
  return SimMap.fromLayout(12, 12, (x, y) => {
    if ((x === 0 || x === 1) && (y === 1 || y === 2)) return 'fertile';
    return 'earth';
  });
}

/**
 * The happy-path city: farm → granary → market → 4 houses, plus a well.
 * Roads: rows y=0/3/5 across x=0..7, with a vertical spine at x=7.
 */
export function buildFoodCity(r: SimRunner): void {
  for (let x = 0; x <= 7; x++) {
    place(r, 'road', x, 0);
    place(r, 'road', x, 3);
    place(r, 'road', x, 5);
  }
  place(r, 'road', 7, 1);
  place(r, 'road', 7, 2);
  place(r, 'road', 7, 4);

  place(r, 'farm', 0, 1);
  place(r, 'granary', 2, 1);
  place(r, 'market', 4, 1);
  place(r, 'house', 0, 4);
  place(r, 'house', 2, 4);
  place(r, 'house', 4, 4);
  place(r, 'house', 6, 4);
  place(r, 'well', 0, 6);
}

/**
 * Production-chain map (Phase 6, PROD-01): an all-earth 20x20 board with a
 * 3x3 'trees' patch at (0..2, 0..2) for the timber yard and a clay_deposit
 * stamped via TileState on the (8..9, 8..9) footprint so a clay pit placed
 * there satisfies the deposit gate. Sized so production cities can also host
 * the many houses needed to staff 8/8/12-worker extractors and workshops.
 */
export function productionChainMap(): Map {
  const map = SimMap.fromLayout(20, 20, (x, y) => {
    if (x >= 0 && x <= 2 && y >= 0 && y <= 2) return 'trees';
    return 'earth';
  });
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      map.mutateTileState(8 + dx, 8 + dy, (s) => {
        s.resourceType = 'clay_deposit';
      });
    }
  }
  return map;
}

/**
 * Production city on productionChainMap: roads linking a clay pit on the
 * deposit, a pottery workshop, a warehouse, and ~16 houses for labor —
 * enough to staff the clay pit (8) and pottery workshop (8). Callers place the
 * off-deposit iron mine and extra houses themselves when they need the
 * blocked-site scenario.
 */
export function buildProductionCity(r: SimRunner): void {
  // Connected road grid: rows y=0/3/5 (housing + workshops) linked to the
  // clay-pit road row y=10 by a vertical spine at x=7, so labor walkers can
  // actually reach every staffable building (fragmented roads strand them).
  for (let x = 0; x <= 15; x++) {
    place(r, 'road', x, 0);
    place(r, 'road', x, 3);
    place(r, 'road', x, 5);
  }
  place(r, 'road', 7, 1);
  place(r, 'road', 7, 2);
  place(r, 'road', 7, 4);
  for (let y = 6; y <= 10; y++) place(r, 'road', 7, y);
  place(r, 'road', 8, 10);
  place(r, 'road', 9, 10);
  place(r, 'road', 10, 10);

  place(r, 'clay_pit', 8, 8); // footprint (8,8)-(9,9) on clay_deposit; south edge = road y=10
  place(r, 'pottery_workshop', 2, 1); // between road rows y=0 and y=3
  place(r, 'warehouse', 12, 1); // between road rows y=0 and y=3

  for (let x = 0; x <= 7; x++) {
    place(r, 'house', x * 2, 4);
    place(r, 'house', x * 2, 6);
  }
}
