import { describe, it, expect } from 'vitest';
import { WaterSystem } from '../../src/sim/water';

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

import { AqueductSystem, computeBathCoverage } from '../../src/sim/water';

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
