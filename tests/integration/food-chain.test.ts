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

  it('stays solvent at default policy: treasury positive and healthy prosperity', () => {
    const runner = runScenario(
      1337,
      foodChainMap(),
      (r) => {
        buildFoodCity(r);
        r.setPolicy(0.1, 0.1);
      },
      3000,
    );
    const state = runner.getState();
    // The balance fix (raised tax tiers) keeps a growing city from bleeding out.
    expect(state.treasury).toBeGreaterThan(0);
    expect(state.ratings.prosperity).toBeGreaterThanOrEqual(40);
    // A served city is broadly happy.
    expect(state.ratings.happiness).toBeGreaterThan(0);
  });

  it('keeps worker-requiring buildings staffed most of the time', () => {
    const runner = runScenario(
      1337,
      foodChainMap(),
      (r) => {
        buildFoodCity(r);
        r.setPolicy(0.1, 0.1);
      },
      3000,
    );
    const jobs = runner.getState().buildings.filter((b) => b.workersRequired > 0);
    expect(jobs.length).toBeGreaterThan(0);
    // At least the majority of jobs are filled at steady state (labor churn is
    // momentary, not systemic).
    const filled = jobs.filter((b) => b.workersAssigned >= b.workersRequired).length;
    expect(filled).toBeGreaterThanOrEqual(Math.ceil(jobs.length / 2));
  });
});
