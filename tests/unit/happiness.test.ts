import { describe, expect, it } from 'vitest';
import { CONFIG, HOUSE_TIERS } from '../../src/sim/config';
import { cityHappiness, houseHappiness } from '../../src/sim/happiness';

describe('house happiness', () => {
  it('is high for a fully served, well-styled house with paid wages', () => {
    const h = houseHappiness({
      hasFood: true,
      hasWater: true,
      hasLabor: true,
      desirability: 180,
      wagesUnpaid: false,
    });
    expect(h).toBeGreaterThanOrEqual(90);
    expect(h).toBeLessThanOrEqual(100);
  });

  it('is low for a deprived house', () => {
    const h = houseHappiness({
      hasFood: false,
      hasWater: false,
      hasLabor: false,
      desirability: 0,
      wagesUnpaid: true,
    });
    expect(h).toBeLessThanOrEqual(20);
    expect(h).toBeGreaterThanOrEqual(0);
  });

  it('rises when a house gains a service', () => {
    const bare = houseHappiness({ hasFood: false, hasWater: false, hasLabor: false, desirability: 100, wagesUnpaid: false });
    const fed = houseHappiness({ hasFood: true, hasWater: false, hasLabor: false, desirability: 100, wagesUnpaid: false });
    expect(fed).toBeGreaterThan(bare);
    expect(fed - bare).toBe(CONFIG.happinessFoodWeight);
  });

  it('penalizes unpaid wages', () => {
    const paid = houseHappiness({ hasFood: true, hasWater: true, hasLabor: true, desirability: 100, wagesUnpaid: false });
    const unpaid = houseHappiness({ hasFood: true, hasWater: true, hasLabor: true, desirability: 100, wagesUnpaid: true });
    expect(unpaid).toBe(paid - CONFIG.happinessWagesWeight);
  });
});

describe('city happiness', () => {
  it('is the population-weighted average of house happiness', () => {
    // Two shacks (pop 5, happy 100) and one villa (pop 55, happy 0).
    const rating = cityHappiness([
      { population: HOUSE_TIERS[0].population, happiness: 100 },
      { population: HOUSE_TIERS[0].population, happiness: 100 },
      { population: HOUSE_TIERS[4].population, happiness: 0 },
    ]);
    // total pop = 5+5+55 = 65; sum = 5*100+5*100+55*0 = 1000; 1000/65 = 15.38 -> 15
    expect(rating).toBe(15);
  });

  it('is zero with no houses', () => {
    expect(cityHappiness([])).toBe(0);
  });
});
