import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { assignedWorkers, computeRatings, populationOf, tickEconomy, workerPool } from '../../src/sim/economy';
import type { BuildingInstance } from '../../src/sim/walkers';

interface MkHouseOpts extends Partial<Omit<BuildingInstance, 'house'>> {
  house?: Partial<BuildingInstance['house']>;
}

function mkHouse(partial: MkHouseOpts = {}): BuildingInstance {
  return {
    id: 1,
    type: 'house',
    x: 0,
    y: 0,
    footprint: 1,
    workersAssigned: 0,
    workersRequired: 0,
    active: false,
    laborConnected: false,
    laborCooldown: 0,
    spawnCooldown: 0,
    stock: {},
    ...partial,
    house: {
      tier: 0,
      foodCooldown: 0,
      waterCooldown: 0,
      laborCooldown: 0,
      evolveCounter: 0,
      devolveCounter: 0,
      ...(partial.house ?? {}),
    },
  };
}

describe('worker pool', () => {
  it('counts workers only from houses whose labor walker is out', () => {
    const houses = [
      mkHouse({ id: 1, house: { tier: 0, laborCooldown: 120 } }),
      mkHouse({ id: 2, house: { tier: 2, laborCooldown: 120 } }),
      mkHouse({ id: 3, house: { tier: 1, laborCooldown: 0 } }),
    ];
    // tier 0 = 1 worker, tier 2 = 4 workers; the idle house contributes none.
    expect(workerPool(houses)).toBe(5);
  });

  it('tracks assigned workers across buildings', () => {
    const buildings: BuildingInstance[] = [
      mkHouse({ id: 1, house: { tier: 0 } }),
      mkHouse({ id: 2, workersAssigned: 1, workersRequired: 1 }),
    ];
    expect(assignedWorkers(buildings)).toBe(1);
  });
});

describe('taxes and wages', () => {
  it('collects taxes per house tier at the tax rate', () => {
    const houses = [
      mkHouse({ id: 1, house: { tier: 0 } }), // tax 5
      mkHouse({ id: 2, house: { tier: 3 } }), // tax 11
    ];
    const { result } = tickEconomy(houses, { taxRate: 0.5, wageRate: 0 }, 1000);
    expect(result.taxIncome).toBeCloseTo(8);
  });

  it('pays wages based on the reachable worker pool and wage rate', () => {
    const houses = [
      mkHouse({ id: 1, house: { tier: 0, laborCooldown: 120 } }), // 1 worker
      mkHouse({ id: 2, house: { tier: 4, laborCooldown: 120 } }), // 11 workers
    ];
    const { result } = tickEconomy(houses, { taxRate: 0, wageRate: 0.5 }, 1000);
    expect(result.wagesDue).toBeCloseTo(12 * CONFIG.wagePerWorkerPerTick * 0.5);
    expect(result.wagesUnpaid).toBe(0);
  });

  it('never drives the treasury below zero; unpaid wages are reported', () => {
    const houses = [mkHouse({ id: 1, house: { tier: 4, laborCooldown: 120 } })];
    const { treasury, result } = tickEconomy(houses, { taxRate: 0, wageRate: 1 }, 5);
    expect(result.wagesDue).toBe(11 * CONFIG.wagePerWorkerPerTick);
    expect(treasury).toBe(0);
    expect(result.wagesUnpaid).toBe(11 * CONFIG.wagePerWorkerPerTick - 5);
  });

  it('adds tax income to the treasury', () => {
    const houses = [mkHouse({ id: 1, house: { tier: 1 } })]; // tax 7
    const { treasury } = tickEconomy(houses, { taxRate: 1, wageRate: 0 }, 100);
    expect(treasury).toBe(107);
  });
});

describe('ratings', () => {
  it('population equals the sum of house tier capacities', () => {
    const houses = [
      mkHouse({ id: 1, house: { tier: 0 } }), // 5
      mkHouse({ id: 2, house: { tier: 2 } }), // 20
      mkHouse({ id: 3, house: { tier: 4 } }), // 55
    ];
    expect(populationOf(houses)).toBe(80);
  });

  it('computes prosperity from housing, employment, and revenue', () => {
    const houses = [
      mkHouse({ id: 1, house: { tier: 4, laborCooldown: 120 } }),
      mkHouse({ id: 2, house: { tier: 4, laborCooldown: 120 } }),
    ];
    const market: BuildingInstance = {
      id: 3,
      type: 'market',
      x: 0,
      y: 2,
      footprint: 2,
      workersAssigned: 1,
      workersRequired: 1,
      active: true,
      laborConnected: true,
      laborCooldown: 100,
      spawnCooldown: 0,
      stock: {},
    };
    const ratings = computeRatings([...houses, market], CONFIG.prosperityRevenueTarget);
    expect(ratings.population).toBe(110);
    // housing score: (5+5) / (5 * 2) = 1.0; employment 1/22; revenue 1.0
    expect(ratings.prosperity).toBe(Math.round(100 * (0.4 + 0.3 * (1 / 22) + 0.3)));
  });

  it('never reports negative prosperity for an empty city', () => {
    const ratings = computeRatings([], 0);
    expect(ratings.population).toBe(0);
    expect(ratings.prosperity).toBeGreaterThanOrEqual(0);
  });
});
