/**
 * Civic wellness (Phase 12): service-access cooldown decay, health/literacy/
 * entertainment stat movement, and the data-driven tier gates (TIER_CIVIC_GATES).
 * The live 21-level model (Phase 16) gates evolution on the LADDER's requires —
 * clinic (health) at level 8, library (literacy) at level 9 — via
 * deriveSatisfied, which needs a city building of the type present AND fresh
 * wellness access.
 */
import { describe, expect, it } from 'vitest';
import { Map as SimMap } from '../../src/sim/map';
import { tickCivic, tickHousing } from '../../src/sim/housing';
import { DEFAULT_HYSTERESIS } from '../../src/sim/housingEvolution';
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

/** Minimal non-house building stub (a clinic/library/school/warehouse the gate
 *  test cities host; the warehouse carries the non-food cumulative goods). */
function stubService(type: string, x: number, y: number, stock: Record<string, number> = {}): BuildingInstance {
  return {
    id: 100 + x * 10 + y, type, x, y,
    footprint: 1,
    workersAssigned: 0, workersRequired: 0,
    active: true, laborConnected: true, laborCooldown: 0, spawnCooldown: 0,
    stock: { ...stock },
  } as unknown as BuildingInstance;
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

/**
 * One tick of the 21-level gate: returns the house's level after evolution.
 * Level 8 (Fair Insulae) requires market+fountain+school+clinic and goods
 * wheat/pottery/vegetables/fish/furniture as the NEW cumulative rung over
 * level 7 — we host a school+clinic+library and a stocked warehouse, and give
 * the house wheat/vegetables/fish food inventory, so the ONLY differentiator
 * between the satisfied house and the control is fresh health (clinic) or
 * literacy (library).
 */
function gateLevelWith(house: Partial<BuildingInstance['house']>): number {
  const map = gateMap();
  const b = stubHouse(1, 1, 1, {
    ...house,
    foodInventory: { wheat: 50, vegetables: 50, fish: 50 },
  });
  const buildings = [
    b,
    stubService('school', 3, 1),
    stubService('clinic', 3, 3),
    stubService('library', 4, 1),
    stubService('warehouse', 4, 3, { pottery: 200, furniture: 200, wine: 200 }),
  ];
  tickHousing(map, buildings, { taxRate: 0, wageRate: 0 }, false, () => {});
  return b.house!.level ?? 0;
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
    // 21-level gate: Fair Insulae (level 8) requires 'clinic' (health) as a
    // NEW requirement over level 7 — a house at level 7 with fresh health
    // climbs to 8 after minSatisfiedTicks; the control without health stays 7.
    const base = {
      tier: 1,
      level: 7,
      foodCooldown: 100, waterCooldown: 100, laborCooldown: 100,
      services: { literacy: 50 },
      satisfiedTicks: DEFAULT_HYSTERESIS.minSatisfiedTicks - 1, unsatisfiedTicks: 0,
    };
    // gateMap: fertile 40 + food/water/labor 45 + four plazas 16 = 101 →
    // levelDesirability(101) = 17 ≥ level 8's padded requirement (8 + 5).
    const withHealth = { ...base, services: { literacy: 50, health: 50 } };
    expect(gateLevelWith(withHealth)).toBe(8);

    const control = { ...base };
    expect(gateLevelWith(control)).toBe(7);
  });

  it('Villa (index 4) requires fresh literacy access (school/library)', () => {
    // 21-level gate: Good Insulae (level 9) adds 'library' (literacy) over
    // level 8 — a house at level 8 with fresh literacy climbs to 9; a control
    // with only fresh health stays 8.
    const base = {
      tier: 2,
      level: 8,
      foodCooldown: 100, waterCooldown: 100, laborCooldown: 100,
      services: { health: 50 },
      satisfiedTicks: DEFAULT_HYSTERESIS.minSatisfiedTicks - 1, unsatisfiedTicks: 0,
    };
    const map = gateMap();
    const lit = stubHouse(1, 1, 1, {
      ...base,
      services: { health: 50, literacy: 50 },
      foodInventory: { wheat: 50, vegetables: 50, fish: 50 },
    });
    const litBuildings = [
      lit,
      stubService('school', 3, 1),
      stubService('clinic', 3, 3),
      stubService('library', 4, 1),
      stubService('warehouse', 4, 3, { pottery: 200, furniture: 200, wine: 200 }),
    ];
    tickHousing(map, litBuildings, { taxRate: 0, wageRate: 0.13 }, false, () => {});
    expect(lit.house!.level).toBe(9);

    const control = stubHouse(1, 1, 1, {
      ...base,
      foodInventory: { wheat: 50, vegetables: 50, fish: 50 },
    });
    const controlBuildings = [
      control,
      stubService('school', 3, 1),
      stubService('clinic', 3, 3),
      stubService('library', 4, 1),
      stubService('warehouse', 4, 3, { pottery: 200, furniture: 200, wine: 200 }),
    ];
    tickHousing(gateMap(), controlBuildings, { taxRate: 0, wageRate: 0.13 }, false, () => {});
    expect(control.house!.level).toBe(8);
  });
});
