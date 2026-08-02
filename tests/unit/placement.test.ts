import { describe, expect, it } from 'vitest';
import { Map as SimMap } from '../../src/sim/map';
import { checkPlacement } from '../../src/sim/placement';
import { SimRunner } from '../../src/sim/runner';
import type { BuildingType } from '../../src/sim/types';

/** 10x10 map: fertile patch at (3..4, 3..4), road at (0,0). */
function baseMap() {
  const m = SimMap.fromLayout(10, 10, (x, y) => ((x === 3 || x === 4) && (y === 3 || y === 4) ? 'fertile' : 'earth'));
  m.set(0, 0, 'road');
  return m;
}

const notOccupied = () => false;

describe('placement validation', () => {
  it('accepts a valid house next to a road', () => {
    const map = baseMap();
    expect(checkPlacement(map, notOccupied, 1000, 'house', 0, 1)).toEqual({ ok: true });
  });

  it('accepts a farm on fertile land with road access', () => {
    const map = baseMap();
    map.set(3, 2, 'road');
    expect(checkPlacement(map, notOccupied, 1000, 'farm', 3, 3)).toEqual({ ok: true });
  });

  it('rejects a farm on earth with a terrain error', () => {
    const map = baseMap();
    expect(checkPlacement(map, notOccupied, 1000, 'farm', 6, 0)).toEqual({ ok: false, error: 'terrain' });
  });

  it('accepts a farm when at least 2 footprint tiles are fertile', () => {
    const map = baseMap();
    // Fertile patch is (3..4, 3..4). A farm anchored at (3,4) covers
    // (3,4),(4,4) fertile + (3,5),(4,5) earth = exactly 2 fertile tiles.
    map.set(2, 4, 'road');
    expect(checkPlacement(map, notOccupied, 1000, 'farm', 3, 4)).toEqual({ ok: true });
  });

  it('rejects a farm with only 1 fertile tile even if the rest is buildable', () => {
    const map = baseMap();
    // To get a footprint with exactly one fertile tile, carve the patch down:
    // anchor at (3,3) covers (3,3),(4,3),(3,4),(4,4); set three of them to earth.
    map.set(4, 3, 'earth');
    map.set(3, 4, 'earth');
    map.set(4, 4, 'earth');
    map.set(2, 3, 'road');
    expect(checkPlacement(map, notOccupied, 1000, 'farm', 3, 3)).toEqual({ ok: false, error: 'terrain' });
  });

  it('rejects a market with no road access', () => {
    const map = baseMap();
    expect(checkPlacement(map, notOccupied, 1000, 'market', 4, 6)).toEqual({ ok: false, error: 'road-access' });
  });

  it('rejects a footprint partially outside the map', () => {
    const map = baseMap();
    expect(checkPlacement(map, notOccupied, 1000, 'granary', 9, 0)).toEqual({ ok: false, error: 'out-of-bounds' });
    expect(checkPlacement(map, notOccupied, 1000, 'house', -1, 0)).toEqual({ ok: false, error: 'out-of-bounds' });
  });

  it('rejects an occupied footprint', () => {
    const map = baseMap();
    const occupied = (x: number, y: number) => x === 0 && y === 1;
    expect(checkPlacement(map, occupied, 1000, 'house', 0, 1)).toEqual({ ok: false, error: 'occupied' });
  });

  it('rejects a building the treasury cannot afford', () => {
    const map = baseMap();
    map.set(2, 1, 'road');
    expect(checkPlacement(map, notOccupied, 10, 'granary', 2, 2)).toEqual({ ok: false, error: 'not-enough-money' });
  });

  it('rejects an unknown building type', () => {
    const map = baseMap();
    expect(checkPlacement(map, notOccupied, 1000, 'wonder' as BuildingType, 0, 0)).toEqual({
      ok: false,
      error: 'invalid-type',
    });
  });

  it('rejects placement over water', () => {
    const map = baseMap();
    map.set(7, 7, 'water');
    expect(checkPlacement(map, notOccupied, 1000, 'house', 7, 7)).toEqual({ ok: false, error: 'terrain' });
  });
});

describe('SimRunner placement', () => {
  it('commits a valid placement and reflects it in state', () => {
    const runner = new SimRunner(1, baseMap());
    expect(runner.placeBuilding('house', 0, 1)).toEqual({ ok: true });
    const state = runner.getState();
    expect(state.buildings).toHaveLength(1);
    expect(state.buildings[0].type).toBe('house');
    expect(state.buildings[0].x).toBe(0);
    expect(state.buildings[0].y).toBe(1);
    expect(state.treasury).toBe(1000 - 20);
  });

  it('leaves state unchanged on rejection and records it in the command log', () => {
    const runner = new SimRunner(1, baseMap());
    const before = runner.getStateJson();
    const result = runner.placeBuilding('farm', 6, 0);
    expect(result).toEqual({ ok: false, error: 'terrain' });
    expect(runner.getStateJson()).toBe(before);
    const log = runner.getCommandLog();
    expect(log).toHaveLength(1);
    expect(log[0].result).toBe('terrain');
  });

  it('turns road placements into road tiles on the map', () => {
    const runner = new SimRunner(1, baseMap());
    expect(runner.placeBuilding('road', 2, 2)).toEqual({ ok: true });
    expect(runner.getState().tiles[2][2]).toBe('road');
  });

  it('blocks placing a building on top of an existing one', () => {
    const runner = new SimRunner(1, baseMap());
    expect(runner.placeBuilding('house', 0, 1)).toEqual({ ok: true });
    expect(runner.placeBuilding('house', 0, 1)).toEqual({ ok: false, error: 'occupied' });
  });
});
