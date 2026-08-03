import { describe, expect, it } from 'vitest';
import { CONFIG, HOUSE_TIERS } from '../../src/sim/config';
import { desirabilityOf, tierThreshold, tickHousing } from '../../src/sim/housing';
import {
  createHouseFood, dailyFoodConsumption, consumeHouseFood, foodVariety, tickHouseFoodMemory,
  deliverToHouse, homeStorageCapacity, houseFoodState, foodShortageEffects, houseFoodDays,
} from '../../src/sim/housing';
import { Map as SimMap } from '../../src/sim/map';
import { SimRunner } from '../../src/sim/runner';
import type { MessageType } from '../../src/sim/types';
import type { BuildingInstance } from '../../src/sim/walkers';

function mkHouse(tier: number, overrides: Partial<BuildingInstance['house']> = {}): BuildingInstance {
  return {
    id: 1,
    type: 'house',
    x: 1,
    y: 1,
    footprint: 1,
    workersAssigned: 0,
    workersRequired: 0,
    active: false,
    laborConnected: false,
    laborCooldown: 0,
    spawnCooldown: 0,
    stock: {},
    house: {
      tier,
      foodCooldown: 0,
      waterCooldown: 0,
      laborCooldown: 0,
      evolveCounter: 0,
      devolveCounter: 0,
      ...overrides,
    },
  };
}

function earthMap(): SimMap {
  return SimMap.fromLayout(5, 5, () => 'earth');
}

function makeEmitter() {
  const messages: string[] = [];
  const emit = (type: MessageType, text: string) => messages.push(`${type}:${text}`);
  return { messages, emit };
}

describe('desirability', () => {
  it('uses terrain base plus the wage-minus-tax spread', () => {
    const map = earthMap();
    expect(desirabilityOf(map, 1, 1, { taxRate: 0.1, wageRate: 0.1 }, false)).toBe(30);
    expect(desirabilityOf(map, 1, 1, { taxRate: 0, wageRate: 0.5 }, false)).toBe(130);
    expect(desirabilityOf(map, 1, 1, { taxRate: 0.5, wageRate: 0 }, false)).toBe(0);
  });

  it('penalizes unpaid wages', () => {
    const map = earthMap();
    const calm = desirabilityOf(map, 1, 1, { taxRate: 0.1, wageRate: 0.1 }, false);
    const unpaid = desirabilityOf(map, 1, 1, { taxRate: 0.1, wageRate: 0.1 }, true);
    expect(unpaid).toBe(Math.max(0, calm - CONFIG.desirabilityUnpaidWagesPenalty));
  });

  it('rewards active food/water/labor services', () => {
    const map = earthMap();
    const policy = { taxRate: 0.1, wageRate: 0.1 };
    const bare = desirabilityOf(map, 1, 1, policy, false);
    const served = desirabilityOf(map, 1, 1, policy, false, { food: true, water: true, labor: true });
    expect(served).toBe(bare + 3 * CONFIG.desirabilityServiceBonus);
  });

  it('higher tiers require higher desirability thresholds', () => {
    expect(tierThreshold(1)).toBeLessThan(tierThreshold(5));
  });
});

describe('house snapshot desirability', () => {
  it('exposes the same desirability the evolution logic uses', () => {
    const m = SimMap.fromLayout(5, 5, (x, y) => ((x === 1 && y === 1) ? 'fertile' : 'earth'));
    m.set(0, 1, 'road');
    const runner = new SimRunner(1, m);
    runner.placeBuilding('house', 1, 1);

    const state = runner.getState();
    const house = state.buildings.find((b) => b.type === 'house');
    expect(house?.house?.desirability).toBe(
      desirabilityOf(m, 1, 1, state.policy, false, {
        food: false,
        water: false,
        labor: false,
      }),
    );
  });

  it('rises when the house gains services', () => {
    const m = SimMap.fromLayout(5, 5, () => 'earth');
    m.set(0, 1, 'road');
    const runner = new SimRunner(1, m);
    runner.placeBuilding('house', 1, 1);

    const before = runner.getState().buildings.find((b) => b.type === 'house')?.house?.desirability ?? 0;

    // Grant food + water coverage directly and re-read the snapshot.
    const instance = runner['buildings'].find((b) => b.type === 'house') as BuildingInstance;
    if (instance.house) {
      instance.house.foodCooldown = 50;
      instance.house.waterCooldown = 50;
    }
    const after = runner.getState().buildings.find((b) => b.type === 'house')?.house?.desirability ?? 0;
    expect(after).toBeGreaterThan(before);
  });
});

describe('housing evolution', () => {
  it('evolves one tier after a sustained window of full coverage', () => {
    const map = earthMap();
    const house = mkHouse(0, { foodCooldown: 500, waterCooldown: 500, laborCooldown: 500 });
    const { messages, emit } = makeEmitter();

    for (let i = 0; i < CONFIG.evolveWindowTicks - 1; i++) {
      tickHousing(map, [house], { taxRate: 0, wageRate: 0.5 }, false, emit);
    }
    expect(house.house?.tier).toBe(0);

    tickHousing(map, [house], { taxRate: 0, wageRate: 0.5 }, false, emit);
    expect(house.house?.tier).toBe(1);
    expect(messages.some((m) => m.startsWith('house-evolved'))).toBe(true);
    expect(house.house?.evolveCounter).toBe(0);
  });

  it('does not evolve without labor coverage', () => {
    const map = earthMap();
    const house = mkHouse(0, { foodCooldown: 500, waterCooldown: 500, laborCooldown: 0 });
    const { emit } = makeEmitter();
    tickHousing(map, [house], { taxRate: 0, wageRate: 0.5 }, false, emit);
    expect(house.house?.tier).toBe(0);
  });

  it('devolves one tier after a sustained food/water shortfall', () => {
    const map = earthMap();
    const house = mkHouse(2);
    const { messages, emit } = makeEmitter();

    for (let i = 0; i < CONFIG.devolveWindowTicks - 1; i++) {
      tickHousing(map, [house], { taxRate: 0.1, wageRate: 0.1 }, false, emit);
    }
    expect(house.house?.tier).toBe(2);

    tickHousing(map, [house], { taxRate: 0.1, wageRate: 0.1 }, false, emit);
    expect(house.house?.tier).toBe(1);
    expect(messages.some((m) => m.startsWith('house-devolved'))).toBe(true);
  });

  it('never devolves below tier 0', () => {
    const map = earthMap();
    const house = mkHouse(0);
    const { emit } = makeEmitter();
    for (let i = 0; i < CONFIG.devolveWindowTicks * 3; i++) {
      tickHousing(map, [house], { taxRate: 0.1, wageRate: 0.1 }, false, emit);
    }
    expect(house.house?.tier).toBe(0);
  });

  it('never evolves above the max tier', () => {
    const map = earthMap();
    const house = mkHouse(HOUSE_TIERS.length - 1, { foodCooldown: 500, waterCooldown: 500, laborCooldown: 500 });
    const { emit } = makeEmitter();
    for (let i = 0; i < CONFIG.evolveWindowTicks * 3; i++) {
      tickHousing(map, [house], { taxRate: 0, wageRate: 0.5 }, false, emit);
    }
    expect(house.house?.tier).toBe(HOUSE_TIERS.length - 1);
  });

  it('decays service cooldowns each tick', () => {
    const map = earthMap();
    const house = mkHouse(0, { foodCooldown: CONFIG.serviceCooldownTicks });
    const { emit } = makeEmitter();
    tickHousing(map, [house], { taxRate: 0.1, wageRate: 0.1 }, false, emit);
    expect(house.house?.foodCooldown).toBe(CONFIG.serviceCooldownTicks - 1);
    for (let i = 1; i < CONFIG.serviceCooldownTicks; i++) {
      tickHousing(map, [house], { taxRate: 0.1, wageRate: 0.1 }, false, emit);
    }
    expect(house.house?.foodCooldown).toBe(0);
  });
});

describe('house food inventory & consumption (AGRI-01, spec §13)', () => {
  it('daily consumption scales with population, level and difficulty', () => {
    expect(dailyFoodConsumption(20, 0.03, 1, 1)).toBeCloseTo(0.6, 5);
    expect(dailyFoodConsumption(20, 0.03, 2, 1)).toBeCloseTo(1.2, 5);
    expect(dailyFoodConsumption(20, 0.03, 1, 1.5)).toBeCloseTo(0.9, 5);
  });

  it('consumes the basic food first but any food sustains the house', () => {
    const inv = createHouseFood('wheat');
    inv.foods.wheat = { units: 10, lastDeliveryDay: 0, accessMemoryDays: 0 };
    inv.foods.vegetables = { units: 10, lastDeliveryDay: 0, accessMemoryDays: 0 };
    const shortfall = consumeHouseFood(inv, 15);
    expect(shortfall).toBe(0);
    expect(inv.foods.wheat?.units).toBe(0); // wheat (basic) consumed first
    // a house with only vegetables does not starve for lack of wheat
    const vegOnly = createHouseFood('wheat');
    vegOnly.foods.vegetables = { units: 10, lastDeliveryDay: 0, accessMemoryDays: 0 };
    expect(consumeHouseFood(vegOnly, 5)).toBe(0);
    expect(vegOnly.foods.vegetables?.units).toBe(5);
  });

  it('counts variety from stock > 0 or access memory, and drops it after memory expires', () => {
    const inv = createHouseFood('wheat');
    inv.foods.wheat = { units: 5, lastDeliveryDay: 0, accessMemoryDays: 30 };
    inv.foods.vegetables = { units: 0, lastDeliveryDay: 0, accessMemoryDays: 10 }; // memory only
    expect(foodVariety(inv)).toBe(2);
    tickHouseFoodMemory(inv);
    expect(inv.foods.vegetables?.accessMemoryDays).toBe(9);
    // memory expires entirely → variety drops back to 1
    for (let i = 0; i < 12; i++) tickHouseFoodMemory(inv);
    expect(foodVariety(inv)).toBe(1);
  });

  it('class-based storage capacity grows with the tier (§13.6)', () => {
    expect(homeStorageCapacity(0)).toBe(20);
    expect(homeStorageCapacity(1)).toBe(40);
    expect(homeStorageCapacity(2)).toBe(80);
    expect(homeStorageCapacity(3)).toBe(160);
    expect(homeStorageCapacity(5)).toBe(400);
  });

  it('delivery honours free capacity, records the serving market and refreshes memory', () => {
    const inv = createHouseFood('wheat');
    const accepted = deliverToHouse(inv, 'wheat', 100, 0, 'market-2', 42);
    expect(accepted).toBe(20); // tier 0 capacity = 20
    expect(inv.foods.wheat?.units).toBe(20);
    expect(inv.foods.wheat?.servingMarketId).toBe('market-2');
    expect(inv.foods.wheat?.lastDeliveryDay).toBe(42);
    expect(inv.foods.wheat?.accessMemoryDays).toBe(30);
    expect(deliverToHouse(inv, 'wheat', 5, 0, 'market-2', 43)).toBe(0); // full
  });

  it('classifies house food states (§13.8) and projects food days', () => {
    const inv = createHouseFood('wheat');
    inv.foods.wheat = { units: 60, lastDeliveryDay: 0, accessMemoryDays: 0 };
    expect(houseFoodDays(inv, 0.6)).toBe(100);
    expect(houseFoodState(inv, 0.6, 1)).toBe('well-stocked');
    inv.foods.wheat!.units = 10;
    expect(houseFoodState(inv, 0.6, 1)).toBe('low');
    inv.foods.wheat!.units = 0;
    expect(houseFoodState(inv, 0.6, 1)).toBe('no-food');
  });

  it('brief shortage stops evolution and drops mood/health; prolonged famine regresses and causes emigration/crime', () => {
    const brief = foodShortageEffects(5);
    expect(brief.stopEvolution).toBe(true);
    expect(brief.moodDrop).toBe(5);
    expect(brief.healthDrop).toBe(5);
    expect(brief.regression).toBe(false);
    const famine = foodShortageEffects(40);
    expect(famine.regression).toBe(true);
    expect(famine.emigration).toBe(true);
    expect(famine.crime).toBe(true);
    expect(foodShortageEffects(0).stopEvolution).toBe(false);
  });
});
