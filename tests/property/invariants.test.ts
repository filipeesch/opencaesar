import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { Map as SimMap } from '../../src/sim/map';
import { mulberry32, randInt } from '../../src/sim/rng';
import { SimRunner } from '../../src/sim/runner';
import type { BuildingType } from '../../src/sim/types';

const BUILDING_TYPES: BuildingType[] = ['house', 'granary', 'market', 'well', 'farm'];
const SIZE = 20;

/** Random terrain map with a checkerboard road pattern (every earth tile touches a road). */
function checkerboardCityMap(terrainSeed: number): SimMap {
  const map = SimMap.generate(SIZE, SIZE, mulberry32(terrainSeed));
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if ((x + y) % 2 === 0 && map.get(x, y) !== 'water') map.set(x, y, 'road');
    }
  }
  return map;
}

/** Seeded random city: random terrain+roads, random building script, random ticks. */
function runRandomCity(seed: number, ticks: number, buildings: BuildingType[]): SimRunner {
  const runner = new SimRunner(seed, checkerboardCityMap(seed * 7 + 13));
  const rng = mulberry32(seed * 31 + 7);
  for (const type of buildings) {
    runner.placeBuilding(type, randInt(rng, 0, SIZE - 4), randInt(rng, 0, SIZE - 4));
  }
  for (let i = 0; i < ticks; i++) runner.tick();
  return runner;
}

function assertNoNaN(value: unknown, path: string): void {
  if (typeof value === 'number') {
    expect(Number.isNaN(value), `${path} is NaN`).toBe(false);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoNaN(v, `${path}[${i}]`));
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) assertNoNaN(v, `${path}.${k}`);
  }
}

const cityArb = fc
  .integer({ min: 1, max: 999_999 })
  .chain((seed) =>
    fc.tuple(
      fc.constant(seed),
      fc.integer({ min: 50, max: 400 }),
      fc.array(fc.constantFrom(...BUILDING_TYPES), { minLength: 8, maxLength: 15 }),
    ),
  );

describe('property invariants (fast-check)', () => {
  it('walkers never leave the road graph', () => {
    fc.assert(
      fc.property(cityArb, ([seed, ticks, types]) => {
        const state = runRandomCity(seed, ticks, types).getState();
        for (const w of state.walkers) {
          expect(state.tiles[w.y][w.x], `walker ${w.id} off-road at ${w.x},${w.y}`).toBe('road');
        }
      }),
    );
  });

  it('no resource, stock, or money is ever negative', () => {
    fc.assert(
      fc.property(cityArb, ([seed, ticks, types]) => {
        const state = runRandomCity(seed, ticks, types).getState();
        expect(state.treasury).toBeGreaterThanOrEqual(0);
        for (const b of state.buildings) {
          for (const amount of Object.values(b.stock)) {
            expect(amount ?? 0).toBeGreaterThanOrEqual(0);
          }
          if (b.house) {
            expect(b.house.foodCooldown).toBeGreaterThanOrEqual(0);
            expect(b.house.waterCooldown).toBeGreaterThanOrEqual(0);
            expect(b.house.laborCooldown).toBeGreaterThanOrEqual(0);
          }
        }
      }),
    );
  });

  it('storage never exceeds capacity bounds', () => {
    fc.assert(
      fc.property(cityArb, ([seed, ticks, types]) => {
        const state = runRandomCity(seed, ticks, types).getState();
        for (const b of state.buildings) {
          if (b.type === 'granary') expect(b.stock.wheat ?? 0).toBeLessThanOrEqual(CONFIG.granaryCapacity);
          if (b.type === 'farm') expect(b.stock.wheat ?? 0).toBeLessThanOrEqual(CONFIG.farmStorageCapacity);
        }
      }),
    );
  });

  it('the state contains no NaN and all required fields are defined', () => {
    fc.assert(
      fc.property(cityArb, ([seed, ticks, types]) => {
        const state = runRandomCity(seed, ticks, types).getState();
        assertNoNaN(state, 'state');
        expect(state.tick).toBeTypeOf('number');
        expect(state.width).toBeTypeOf('number');
        expect(state.height).toBeTypeOf('number');
        expect(state.treasury).toBeTypeOf('number');
        expect(state.totalWorkers).toBeTypeOf('number');
        expect(state.assignedWorkers).toBeTypeOf('number');
        expect(state.lastTickWagesUnpaid).toBeTypeOf('boolean');
        expect(state.ratings.population).toBeTypeOf('number');
        expect(state.ratings.prosperity).toBeTypeOf('number');
        expect(state.policy.taxRate).toBeTypeOf('number');
        expect(state.policy.wageRate).toBeTypeOf('number');
        for (const b of state.buildings) {
          expect(b.id, 'building id').toBeTypeOf('number');
          expect(b.x, 'building x').toBeTypeOf('number');
          expect(b.y, 'building y').toBeTypeOf('number');
          expect(b.footprint, 'building footprint').toBeTypeOf('number');
          expect(b.workersAssigned, 'building workersAssigned').toBeTypeOf('number');
          expect(b.workersRequired, 'building workersRequired').toBeTypeOf('number');
        }
        for (const w of state.walkers) {
          expect(w.id, 'walker id').toBeTypeOf('number');
          expect(w.x, 'walker x').toBeTypeOf('number');
          expect(w.y, 'walker y').toBeTypeOf('number');
          expect(w.progress, 'walker progress').toBeTypeOf('number');
        }
      }),
    );
  });

  it('building and walker counts never go negative', () => {
    fc.assert(
      fc.property(cityArb, ([seed, ticks, types]) => {
        const state = runRandomCity(seed, ticks, types).getState();
        expect(state.buildings.length).toBeGreaterThanOrEqual(0);
        expect(state.walkers.length).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it('ratings stay within sane ranges', () => {
    fc.assert(
      fc.property(cityArb, ([seed, ticks, types]) => {
        const { population, prosperity } = runRandomCity(seed, ticks, types).getState().ratings;
        expect(population).toBeGreaterThanOrEqual(0);
        expect(prosperity).toBeGreaterThanOrEqual(0);
        expect(prosperity).toBeLessThanOrEqual(100);
      }),
    );
  });
});
