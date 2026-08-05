import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { assignedWorkers, computeRatings, populationOf, tickEconomy, workerPool } from '../../src/sim/economy';
import { HOUSING_LIVE_STATS } from '../../src/sim/housingLive';
import type { BuildingInstance } from '../../src/sim/walkers';

const L = HOUSING_LIVE_STATS;

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
      mkHouse({ id: 1, house: { tier: 0, level: 2, laborCooldown: 120 } }),
      mkHouse({ id: 2, house: { tier: 2, level: 8, laborCooldown: 120 } }),
      mkHouse({ id: 3, house: { tier: 1, level: 4, laborCooldown: 0 } }),
    ];
    // level 2 = 8 workers, level 8 = 36 workers; the idle house contributes none.
    expect(workerPool(houses)).toBe(L[2].workers + L[8].workers);
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
  it('collects taxes per house level at the tax rate', () => {
    const houses = [
      mkHouse({ id: 1, house: { tier: 0, level: 2 } }),
      mkHouse({ id: 2, house: { tier: 3, level: 12 } }),
    ];
    const { result } = tickEconomy(houses, { taxRate: 0.5, wageRate: 0 }, 1000);
    expect(result.taxIncome).toBeCloseTo((L[2].taxPerTick + L[12].taxPerTick) * 0.5);
  });

  it('pays wages based on the reachable worker pool and wage rate', () => {
    const houses = [
      mkHouse({ id: 1, house: { tier: 0, level: 2, laborCooldown: 120 } }),
      mkHouse({ id: 2, house: { tier: 4, level: 16, laborCooldown: 120 } }),
    ];
    const { result } = tickEconomy(houses, { taxRate: 0, wageRate: 0.5 }, 1000);
    expect(result.wagesDue).toBeCloseTo((L[2].workers + L[16].workers) * CONFIG.wagePerWorkerPerTick * 0.5);
    expect(result.wagesUnpaid).toBe(0);
  });

  it('never drives the treasury below zero; unpaid wages are reported', () => {
    const houses = [mkHouse({ id: 1, house: { tier: 4, level: 16, laborCooldown: 120 } })];
    const { treasury, result } = tickEconomy(houses, { taxRate: 0, wageRate: 1 }, 5);
    expect(result.wagesDue).toBe(L[16].workers * CONFIG.wagePerWorkerPerTick);
    expect(treasury).toBe(0);
    expect(result.wagesUnpaid).toBe(L[16].workers * CONFIG.wagePerWorkerPerTick - 5);
  });

  it('adds tax income to the treasury', () => {
    const houses = [mkHouse({ id: 1, house: { tier: 1, level: 4 } })];
    const { treasury } = tickEconomy(houses, { taxRate: 1, wageRate: 0 }, 100);
    expect(treasury).toBe(100 + L[4].taxPerTick);
  });
});

describe('ratings', () => {
  it('population equals the sum of house level capacities', () => {
    const houses = [
      mkHouse({ id: 1, house: { tier: 0, level: 2 } }),
      mkHouse({ id: 2, house: { tier: 2, level: 8 } }),
      mkHouse({ id: 3, house: { tier: 4, level: 16 } }),
    ];
    expect(populationOf(houses)).toBe(L[2].population + L[8].population + L[16].population);
  });

  it('computes prosperity from housing, employment, and revenue', () => {
    const houses = [
      mkHouse({ id: 1, house: { tier: 4, level: 20, laborCooldown: 120 } }),
      mkHouse({ id: 2, house: { tier: 4, level: 20, laborCooldown: 120 } }),
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
    expect(ratings.population).toBe(2 * L[20].population);
    // housing score: (5+5) / (5 * 2) = 1.0; employment 1/(2*workers20); revenue 1.0
    expect(ratings.prosperity).toBe(Math.round(100 * (0.4 + 0.3 * (1 / (2 * L[20].workers)) + 0.3)));
  });

  it('never reports negative prosperity for an empty city', () => {
    const ratings = computeRatings([], 0);
    expect(ratings.population).toBe(0);
    expect(ratings.prosperity).toBeGreaterThanOrEqual(0);
  });
});
