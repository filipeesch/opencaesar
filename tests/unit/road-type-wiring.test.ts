import { describe, it, expect } from 'vitest';
import { Map } from '../../src/sim/map';
import { SimRunner } from '../../src/sim/runner';
import { defaultTileState } from '../../src/sim/tile';

describe('per-tile roadType side-channel (ROAD-02)', () => {
  it('TileState defaults roadType to null', () => {
    expect(defaultTileState().roadType).toBeNull();
  });

  it('fresh map roadTypeAt reads null; set/get round-trips and resets', () => {
    const m = new Map(8, 8, 'earth');
    expect(m.roadTypeAt(2, 2)).toBeNull();
    m.setRoadType(2, 2, 'paved');
    expect(m.roadTypeAt(2, 2)).toBe('paved');
    m.setRoadType(2, 2, null);
    expect(m.roadTypeAt(2, 2)).toBeNull();
  });

  it('out-of-bounds roadTypeAt returns null and setRoadType no-ops', () => {
    const m = new Map(8, 8, 'earth');
    expect(m.roadTypeAt(99, 99)).toBeNull();
    m.setRoadType(99, 99, 'plaza');
    expect(m.roadTypeAt(99, 99)).toBeNull();
    expect(m.roadTypeAt(3, 3)).toBeNull();
  });

  it('terrain and roadType side-channel coexist', () => {
    const m = new Map(8, 8, 'earth');
    m.set(2, 2, 'road');
    m.setRoadType(2, 2, 'paved');
    expect(m.get(2, 2)).toBe('road');
    expect(m.roadTypeAt(2, 2)).toBe('paved');
  });

  it('SimRunner.getTileState exposes the effective roadType', () => {
    const m = new Map(8, 8, 'earth');
    m.set(2, 2, 'road');
    m.setRoadType(2, 2, 'paved');
    const runner = new SimRunner(7, m);
    expect(runner.getTileState(2, 2).road).toBe(true);
    expect(runner.getTileState(2, 2).roadType).toBe('paved');
    expect(runner.getTileState(3, 3).roadType).toBeNull();
  });
});
