import { describe, expect, it } from 'vitest';
import { Map as SimMap } from '../../src/sim/map';
import { place, runScenario } from '../helpers';

function plainMap(): SimMap {
  return SimMap.fromLayout(12, 12, () => 'earth');
}

/** Market + 2 houses + well, roads, but no farm or granary anywhere. */
function noFoodCity(r: Parameters<typeof place>[0]): void {
  for (let x = 0; x <= 5; x++) {
    place(r, 'road', x, 0);
    place(r, 'road', x, 3);
  }
  place(r, 'road', 0, 1);
  place(r, 'market', 2, 1);
  place(r, 'house', 0, 4);
  place(r, 'house', 2, 4);
  place(r, 'road', 0, 5);
  place(r, 'well', 0, 6);
}

describe('negative scenarios', () => {
  it('no granary means no food ever reaches houses', () => {
    const runner = runScenario(9, plainMap(), noFoodCity, 1500);
    const state = runner.getState();
    for (const b of state.buildings) {
      if (b.house) expect(b.house.foodCooldown).toBe(0);
    }
  });

  it('warns when houses exist but no food is stored anywhere', () => {
    const runner = runScenario(9, plainMap(), noFoodCity, 1500);
    const state = runner.getState();
    const lowFood = state.messages.filter((m) => m.type === 'warning');
    expect(lowFood.length).toBeGreaterThan(0);
  });

  it('a market without workers stays inactive and spawns no walkers', () => {
    const runner = runScenario(9, plainMap(), (r) => {
      place(r, 'road', 2, 0);
      place(r, 'market', 2, 1);
    }, 500);
    const state = runner.getState();
    const market = state.buildings.find((b) => b.type === 'market');
    expect(market?.active).toBe(false);
    expect(state.walkers.filter((w) => w.type === 'market')).toHaveLength(0);
  });

  it('an unstaffed farm produces nothing', () => {
    const map = SimMap.fromLayout(12, 12, (x, y) => ((x === 0 || x === 1) && (y === 1 || y === 2) ? 'fertile' : 'earth'));
    const runner = runScenario(
      9,
      map,
      (r) => {
        place(r, 'road', 0, 0);
        place(r, 'farm', 0, 1);
      },
      500,
    );
    const state = runner.getState();
    const farm = state.buildings.find((b) => b.type === 'farm');
    expect(farm?.active).toBe(false);
    expect(farm?.stock.wheat ?? 0).toBe(0);
  });

  it('labor shortage deactivates a market even with wheat available', () => {
    const map = SimMap.fromLayout(12, 12, (x, y) => ((x === 0 || x === 1) && (y === 1 || y === 2) ? 'fertile' : 'earth'));
    const runner = runScenario(
      9,
      map,
      (r) => {
        place(r, 'road', 0, 0);
        place(r, 'road', 1, 0);
        place(r, 'road', 2, 0);
        place(r, 'road', 3, 0);
        place(r, 'road', 4, 0);
        place(r, 'farm', 0, 1);
        place(r, 'granary', 2, 1);
        place(r, 'market', 4, 1);
        place(r, 'road', 0, 5);
        place(r, 'house', 0, 6);
      },
      1500,
    );
    const state = runner.getState();
    // One house (1 worker) can staff only one 1-worker building at a time.
    const staffed = state.buildings.filter((b) => b.workersRequired > 0 && b.active).length;
    expect(staffed).toBeLessThanOrEqual(1);
  });
});
