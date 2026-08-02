import { describe, expect, it } from 'vitest';
import { CONFIG, HOUSE_TIERS } from '../../src/sim/config';
import { desirabilityOf, tierThreshold, tickHousing } from '../../src/sim/housing';
import { Map as SimMap } from '../../src/sim/map';
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
