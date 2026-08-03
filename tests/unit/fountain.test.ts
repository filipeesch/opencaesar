import { describe, it, expect } from 'vitest';
import {
  WaterSystem,
  WELL_DESIRABILITY_PENALTY,
  FOUNTAIN_DESIRABILITY_BONUS,
  resolveFountainActivity,
} from '../../src/sim/water';

describe('fountains (WATR-04)', () => {
  it('enforces the network requirement: supplied && staffed yields an active clean-water source with a desirability bonus', () => {
    const sources = resolveFountainActivity([{ x: 2, y: 2, radius: 2, supplied: true, staffed: true }]);
    expect(sources).toHaveLength(1);
    expect(sources[0].active).toBe(true);
    const ws = new WaterSystem();
    ws.setSources(sources);
    const grid = ws.compute(5, 5, () => 0);
    expect(ws.waterClassAt(grid, 2, 2)).toBe('clean');
    expect(grid[2][2].desirability).toBe(FOUNTAIN_DESIRABILITY_BONUS);
  });

  it('covers clean water only within its radius', () => {
    const ws = new WaterSystem();
    ws.setSources(resolveFountainActivity([{ x: 2, y: 2, radius: 2, supplied: true, staffed: true }]));
    const grid = ws.compute(5, 5, () => 0);
    expect(ws.waterClassAt(grid, 0, 0)).toBe('none'); // distance 3 from (2,2), outside radius 2
    expect(grid[0][0].desirability).toBe(0);
  });

  it('goes dark without water or workers: clean class drops to none with zero desirability', () => {
    const active = resolveFountainActivity([{ x: 2, y: 2, radius: 2, supplied: true, staffed: true }]);
    const noWater = resolveFountainActivity([{ x: 2, y: 2, radius: 2, supplied: false, staffed: true }]);
    const noWorkers = resolveFountainActivity([{ x: 2, y: 2, radius: 2, supplied: true, staffed: false }]);
    expect(noWater[0].active).toBe(false);
    expect(noWorkers[0].active).toBe(false);

    const lit = new WaterSystem();
    lit.setSources(active);
    const litGrid = lit.compute(5, 5, () => 0);
    expect(lit.waterClassAt(litGrid, 2, 2)).toBe('clean');
    expect(litGrid[2][2].desirability).toBe(FOUNTAIN_DESIRABILITY_BONUS);

    const w = new WaterSystem();
    w.setSources(noWater);
    const wGrid = w.compute(5, 5, () => 0);
    expect(w.waterClassAt(wGrid, 2, 2)).toBe('none');
    expect(wGrid[2][2].desirability).toBe(0);

    const s = new WaterSystem();
    s.setSources(noWorkers);
    const sGrid = s.compute(5, 5, () => 0);
    expect(s.waterClassAt(sGrid, 2, 2)).toBe('none');
    expect(sGrid[2][2].desirability).toBe(0);
  });

  it('combines the fountain bonus and well penalty where they overlap, fountain still outranks well', () => {
    const ws = new WaterSystem();
    ws.setSources([
      { x: 1, y: 1, kind: 'well', active: true, radius: 2 },
      ...resolveFountainActivity([{ x: 2, y: 2, radius: 2, supplied: true, staffed: true }]),
    ]);
    const grid = ws.compute(5, 5, () => 0);
    // (1,1) is covered by the well at its own tile and the fountain at distance 2
    expect(grid[1][1].desirability).toBe(FOUNTAIN_DESIRABILITY_BONUS - WELL_DESIRABILITY_PENALTY);
    expect(ws.waterClassAt(grid, 1, 1)).toBe('clean');
  });

  it('treats a negative fountain radius as 0 — a self-tile-only source (IN-03)', () => {
    const sources = resolveFountainActivity([{ x: 2, y: 2, radius: -1, supplied: true, staffed: true }]);
    expect(sources).toHaveLength(1);
    expect(sources[0].active).toBe(true);
    expect(sources[0].radius).toBe(0);
    const ws = new WaterSystem();
    ws.setSources(sources);
    const grid = ws.compute(5, 5, () => 0);
    expect(ws.waterClassAt(grid, 2, 2)).toBe('clean');
    expect(ws.waterClassAt(grid, 2, 3)).toBe('none');
  });
});
