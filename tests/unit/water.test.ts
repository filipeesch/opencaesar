import { describe, it, expect } from 'vitest';
import { WaterSystem, WELL_DESIRABILITY_PENALTY } from '../../src/sim/water';

describe('WaterSystem (Phase 4)', () => {
  it('wells provide basic water within radius with sanitary risk in pollution', () => {
    const ws = new WaterSystem();
    ws.setSources([{ x: 1, y: 1, kind: 'well', active: true, radius: 2 }]);
    const grid = ws.compute(5, 5, (x, y) => (x === 1 && y === 1 ? 0.5 : 0));
    expect(ws.waterClassAt(grid, 1, 1)).toBe('basic');
    expect(ws.waterClassAt(grid, 3, 3)).toBe('none'); // outside radius
    expect(grid[1][1].sanitaryRisk).toBe(0.5);
  });

  it('inactive sources provide nothing', () => {
    const ws = new WaterSystem();
    ws.setSources([{ x: 1, y: 1, kind: 'fountain', active: false, radius: 3 }]);
    const grid = ws.compute(5, 5, () => 0);
    expect(ws.waterClassAt(grid, 1, 1)).toBe('none');
  });

  it('fountains provide clean water and outrank wells', () => {
    const ws = new WaterSystem();
    ws.setSources([
      { x: 1, y: 1, kind: 'well', active: true, radius: 3 },
      { x: 2, y: 2, kind: 'fountain', active: true, radius: 2 },
    ]);
    const grid = ws.compute(5, 5, () => 0);
    expect(ws.waterClassAt(grid, 2, 1)).toBe('clean');
  });
});

import {
  AqueductSystem,
  computeBathCoverage,
  mergeWaterDesirability,
  BATH_DESIRABILITY_BONUS,
  FOUNTAIN_DESIRABILITY_BONUS,
  WATER_DESIRABILITY_MIN,
  WATER_DESIRABILITY_MAX,
} from '../../src/sim/water';

describe('AqueductSystem (tasks 4.2, 4.3)', () => {
  it('propagates flow through connected aqueduct tiles from map water', () => {
    const aq = new AqueductSystem();
    // aqueduct chain: (5,5)-(6,5)-(7,5)-(8,5)
    aq.setAqueductTiles([
      { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 },
    ]);
    aq.setReservoirs([]);
    const flow = aq.computeFlow(12, 12, (x, y) => x === 4 && y === 5); // map water at (4,5)
    expect(flow.flowing.size).toBe(5); // entire chain flows from water at its west end
  });

  it('does not flow through a broken (missing) aqueduct tile', () => {
    const aq = new AqueductSystem();
    // chain with a gap at (7,5)
    aq.setAqueductTiles([
      { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 },
    ]);
    aq.setReservoirs([]);
    const flow = aq.computeFlow(12, 12, (x, y) => x === 4 && y === 5);
    // only (5,5),(6,5) reachable; (8,5),(9,5) isolated because (7,5) gap
    expect(flow.flowing.has(5 * 100000 + 6)).toBe(true); // (6,5)
    expect(flow.flowing.has(5 * 100000 + 9)).toBe(false); // (9,5)
  });
});

describe('public baths (task 4.5)', () => {
  it('grants wellness and desirability within radius when active', () => {
    const { wellness, desirability } = computeBathCoverage(
      [{ x: 3, y: 3, radius: 2, active: true }],
      7, 7,
    );
    expect(wellness[3][3]).toBe(1);
    expect(desirability[3][3]).toBe(4);
    expect(wellness[0][0]).toBe(0); // outside radius
  });

  it('inactive baths provide nothing', () => {
    const { wellness } = computeBathCoverage([{ x: 3, y: 3, radius: 2, active: false }], 7, 7);
    expect(wellness[3][3]).toBe(0);
  });
});

describe('wells desirability penalty (WATR-01)', () => {
  it('an active well subtracts the penalty within radius and zero off-radius', () => {
    const ws = new WaterSystem();
    ws.setSources([{ x: 2, y: 2, kind: 'well', active: true, radius: 2 }]);
    const grid = ws.compute(5, 5, () => 0);
    expect(grid[2][2].desirability).toBe(-WELL_DESIRABILITY_PENALTY);
    expect(grid[1][1].desirability).toBe(-WELL_DESIRABILITY_PENALTY); // tile at distance 2
    expect(grid[0][0].desirability).toBe(0); // distance 4, outside radius
  });

  it('overlapping wells accumulate the penalty', () => {
    const ws = new WaterSystem();
    ws.setSources([
      { x: 2, y: 2, kind: 'well', active: true, radius: 2 },
      { x: 2, y: 3, kind: 'well', active: true, radius: 2 },
    ]);
    const grid = ws.compute(5, 5, () => 0);
    expect(grid[2][2].desirability).toBe(-2 * WELL_DESIRABILITY_PENALTY);
  });

  it('an inactive well leaves desirability zero everywhere', () => {
    const ws = new WaterSystem();
    ws.setSources([{ x: 2, y: 2, kind: 'well', active: false, radius: 2 }]);
    const grid = ws.compute(5, 5, () => 0);
    for (const row of grid) for (const cell of row) expect(cell.desirability).toBe(0);
  });

  it('keeps water class basic and sanitary risk reflecting pollution', () => {
    const ws = new WaterSystem();
    ws.setSources([{ x: 1, y: 1, kind: 'well', active: true, radius: 2 }]);
    const grid = ws.compute(5, 5, (x, y) => (x === 1 && y === 1 ? 0.5 : 0));
    expect(ws.waterClassAt(grid, 1, 1)).toBe('basic');
    expect(grid[1][1].sanitaryRisk).toBe(0.5);
    expect(grid[1][1].desirability).toBe(-WELL_DESIRABILITY_PENALTY);
  });
});

describe('water desirability merge contract (WR-02)', () => {
  it('composes an overlapping well + fountain + bath tile additively, with no double-count', () => {
    const ws = new WaterSystem();
    ws.setSources([
      { x: 1, y: 1, kind: 'well', active: true, radius: 2 },
      { x: 2, y: 2, kind: 'fountain', active: true, radius: 2 },
    ]);
    const grid = ws.compute(5, 5, () => 0);
    const waterDelta = grid.map((row) => row.map((cell) => cell.desirability));
    // (2,2): well at distance 2 (-4) + fountain at distance 0 (+4) = 0.
    expect(waterDelta[2][2]).toBe(0);

    const bathBonus = computeBathCoverage([{ x: 2, y: 2, radius: 2, active: true }], 5, 5).desirability;
    // Both surfaces feed the same merge rule: additive, then clamped to the band.
    const merged = mergeWaterDesirability(waterDelta, (x, y) => bathBonus[y][x]);
    // 0 (water model) + 4 (bath) = 4 — the well penalty is retained, not erased.
    expect(merged[2][2]).toBe(BATH_DESIRABILITY_BONUS);
    // (0,0) is well-covered (-4) but outside the fountain and bath radius: penalty survives.
    expect(merged[0][0]).toBe(-WELL_DESIRABILITY_PENALTY);
  });

  it('clamps accumulated deltas to the documented additive-with-natural-cap band', () => {
    const ws = new WaterSystem();
    // Three overlapping well penalties would sum to -12; the merge caps at MIN.
    ws.setSources([
      { x: 2, y: 2, kind: 'well', active: true, radius: 2 },
      { x: 2, y: 3, kind: 'well', active: true, radius: 2 },
      { x: 3, y: 2, kind: 'well', active: true, radius: 2 },
    ]);
    const grid = ws.compute(5, 5, () => 0);
    expect(grid[2][2].desirability).toBe(WATER_DESIRABILITY_MIN);
    expect(WATER_DESIRABILITY_MIN).toBe(-2 * WELL_DESIRABILITY_PENALTY);
    expect(WATER_DESIRABILITY_MAX).toBe(2 * FOUNTAIN_DESIRABILITY_BONUS);
  });
});
