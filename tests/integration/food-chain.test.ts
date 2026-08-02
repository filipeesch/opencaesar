import { describe, expect, it } from 'vitest';
import { buildFoodCity, foodChainMap, runScenario } from '../helpers';

describe('food supply chain', () => {
  it('feeds houses: farm → granary → market → food service', () => {
    const runner = runScenario(
      42,
      foodChainMap(),
      (r) => {
        buildFoodCity(r);
        r.setPolicy(0, 0.5);
      },
      1500,
    );
    const state = runner.getState();

    const granary = state.buildings.find((b) => b.type === 'granary');
    expect(granary?.stock.wheat ?? 0).toBeGreaterThan(0);

    const fed = state.buildings.filter((b) => b.house && b.house.foodCooldown > 0);
    expect(fed.length).toBeGreaterThan(0);
    for (const h of state.buildings) {
      if (h.house) expect(h.house.foodCooldown).toBeGreaterThanOrEqual(0);
    }

    const watered = state.buildings.filter((b) => b.house && b.house.waterCooldown > 0);
    expect(watered.length).toBeGreaterThan(0);
  });

  it('houses evolve and population grows once fed, watered, and employed', () => {
    const runner = runScenario(
      42,
      foodChainMap(),
      (r) => {
        buildFoodCity(r);
        r.setPolicy(0, 0.5);
      },
      1500,
    );
    const state = runner.getState();

    expect(state.ratings.population).toBeGreaterThan(20);
    expect(state.messages.some((m) => m.type === 'house-evolved')).toBe(true);
    expect(state.treasury).toBeGreaterThanOrEqual(0);
  });

  it('granary stock never exceeds its capacity', () => {
    const runner = runScenario(1, foodChainMap(), buildFoodCity, 2000);
    for (const b of runner.getState().buildings) {
      if (b.type === 'granary') expect(b.stock.wheat ?? 0).toBeLessThanOrEqual(100);
    }
  });
});
