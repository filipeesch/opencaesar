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
