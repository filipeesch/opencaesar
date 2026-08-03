import { describe, it, expect } from 'vitest';
import { Map } from '../../src/sim/map';
import { defaultTileState } from '../../src/sim/tile';

describe('expanded tile state (CORE-03)', () => {
  it('exposes neutral defaults for every tile', () => {
    const map = new Map(4, 4, 'earth');
    const s = map.tileState(1, 1);
    expect(s.elevation).toBe(0);
    expect(s.fertility).toBe(0);
    expect(s.resourceType).toBeNull();
    expect(s.resourceAmount).toBe(0);
    expect(s.waterDepth).toBe(0);
    expect(s.aqueduct).toBe(false);
    expect(s.road).toBe(false);
    expect(s.desirability).toBe(0);
    expect(s.fireRisk).toBe(0);
    expect(s.collapseRisk).toBe(0);
    expect(s.pollution).toBe(0);
    expect(s.traffic).toBe(0);
    expect(s.serviceCoverage).toBe(0);
    expect(s.ownership).toBe('none');
    expect(s.blocked).toBe(false);
  });

  it('mutates tile state in place and keeps terrain authority intact', () => {
    const map = new Map(4, 4, 'earth');
    map.mutateTileState(2, 2, (s) => {
      s.fireRisk = 0.8;
      s.pollution = 12;
      s.ownership = 'residential';
      s.desirability = -5;
    });
    const s = map.tileState(2, 2);
    expect(s.fireRisk).toBe(0.8);
    expect(s.pollution).toBe(12);
    expect(s.ownership).toBe('residential');
    expect(s.desirability).toBe(-5);
    // terrain unaffected
    expect(map.get(2, 2)).toBe('earth');
  });

  it('returns a safe default out of bounds', () => {
    const map = new Map(2, 2, 'earth');
    expect(map.tileState(9, 9)).toEqual(defaultTileState());
  });
});
