/**
 * Civic wellness (Phase 12): service-access cooldown decay, health/literacy/
 * entertainment stat movement, and the data-driven tier gates (TIER_CIVIC_GATES).
 */
import { describe, expect, it } from 'vitest';
import { Map as SimMap } from '../../src/sim/map';
import { tickCivic, tickHousing } from '../../src/sim/housing';
import { TIER_CIVIC_GATES } from '../../data/housing';
import type { BuildingInstance } from '../../src/sim/walkers';

function stubHouse(id: number, x: number, y: number, overrides: Partial<BuildingInstance['house']> = {}): BuildingInstance {
  return {
    id, type: 'house', x, y,
    footprint: 1,
    workersAssigned: 0, workersRequired: 0,
    active: false, laborConnected: false, laborCooldown: 0, spawnCooldown: 0,
    stock: {},
    house: { tier: 0, foodCooldown: 0, waterCooldown: 0, laborCooldown: 0, evolveCounter: 0, devolveCounter: 0, ...overrides },
  } as BuildingInstance;
}

/** 5x5 map: fertile house tile at (1,1) flanked by four plaza roads. */
function gateMap(): SimMap {
  const m = new SimMap(5, 5, 'earth');
  m.set(1, 1, 'fertile');
  for (const [x, y] of [[0, 1], [2, 1], [1, 0], [1, 2]]) {
    m.set(x, y, 'road');
    m.setRoadType(x, y, 'plaza');
  }
  return m;
}

function evolveOneTick(house: BuildingInstance['house']): number {
  const map = gateMap();
  const b = stubHouse(1, 1, 1, house);
  const counter = { ...house };
  const h: NonNullable<BuildingInstance['house']> = {
    ...counter,
    tier: house!.tier,
    foodCooldown: house!.foodCooldown,
    waterCooldown: house!.waterCooldown,
    laborCooldown: house!.laborCooldown,
    evolveCounter: house!.evolveCounter,
    devolveCounter: house!.devolveCounter,
  };
  b.house = h;
  tickHousing(map, [b], { taxRate: 0, wageRate: 0 }, false, () => {});
  return b.house!.tier;
}

describe('tickCivic (Phase 12)', () => {
  it('decays the service access cooldown map and drops expired entries', () => {
    const house = stubHouse(1, 0, 0).house!;
    house.services = { health: 2, literacy: 1 };
    tickCivic(house);
    expect(house.services).toEqual({ health: 1 });
    tickCivic(house);
    expect(house.services).toEqual({});
  });

  it('health/literacy/entertainment rise while access is fresh and decay when stale', () => {
    const house = stubHouse(1, 0, 0, {
      services: { health: 50, literacy: 50, entertainment: 50 },
    }).house!;
    house.civic = { health: 40, literacy: 20, entertainment: 10 };
    tickCivic(house);
    expect(house.civic).toEqual({ health: 41, literacy: 21, entertainment: 11 });

    house.services = {};
    tickCivic(house);
    expect(house.civic).toEqual({ health: 40.5, literacy: 20.5, entertainment: 10.5 });
  });

  it('clamps stats to [0, 100]', () => {
    const house = stubHouse(1, 0, 0, { services: { health: 50 } }).house!;
    house.civic = { health: 99.8, literacy: 0.2, entertainment: 100 };
    tickCivic(house);
    expect(house.civic).toEqual({ health: 100, literacy: 0, entertainment: 99.5 });
  });
});

describe('TIER_CIVIC_GATES (Phase 12)', () => {
  it('maps Domus (index 3) to health and Villa (index 4) to literacy', () => {
    expect(TIER_CIVIC_GATES).toEqual({ 3: ['health'], 4: ['literacy'], 5: ['entertainment'] });
  });

  it('Domus (index 3) requires fresh health access: satisfied house evolves, control stays pinned', () => {
    const base = {
      tier: 2,
      foodCooldown: 100, waterCooldown: 100, laborCooldown: 100,
      evolveCounter: 59, devolveCounter: 0,
    };
    // Desirability: fertile 40 + food/water/labor 45 + four plazas 16 = 101
    // ≥ tierThreshold(4) = 100.
    const withHealth = { ...base, services: { health: 50 } };
    expect(evolveOneTick(withHealth)).toBe(3);

    const control = { ...base, services: {} };
    expect(evolveOneTick(control)).toBe(2);
  });

  it('Villa (index 4) requires fresh literacy access (school/library)', () => {
    const base = {
      tier: 3,
      foodCooldown: 100, waterCooldown: 100, laborCooldown: 100,
      evolveCounter: 59, devolveCounter: 0,
    };
    // Desirability needs ≥ tierThreshold(5) = 125: 101 + (0.13-0)×200 = 127.
    const map = gateMap();
    const lit = stubHouse(1, 1, 1, { ...base, services: { literacy: 50 } });
    tickHousing(map, [lit], { taxRate: 0, wageRate: 0.13 }, false, () => {});
    expect(lit.house!.tier).toBe(4);

    const control = stubHouse(1, 1, 1, { ...base, services: { health: 50 } });
    tickHousing(gateMap(), [control], { taxRate: 0, wageRate: 0.13 }, false, () => {});
    expect(control.house!.tier).toBe(3);
  });
});
