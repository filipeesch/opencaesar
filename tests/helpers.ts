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
