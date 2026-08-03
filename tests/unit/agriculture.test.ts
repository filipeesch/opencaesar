import { describe, it, expect } from 'vitest';
import { FARMS, farmProductionPerTick, defaultGranaryPolicy, granaryAccepts } from '../../src/sim/agriculture';

describe('farm types & fertility production (task 3.2)', () => {
  it('covers six land farms plus fishing wharf', () => {
    expect(Object.keys(FARMS).sort()).toEqual(
      ['animals', 'fishing', 'olives', 'orchard', 'vegetables', 'vines', 'wheat'].sort(),
    );
    expect(FARMS.fishing.produces).toBe('fish');
    expect(FARMS.wheat.requiresFertile).toBe(true);
    expect(FARMS.fishing.requiresFertile).toBe(false);
  });

  it('produces only when staffed, with road access, not paused, on fertile', () => {
    expect(farmProductionPerTick({ kind: 'wheat', fertility: 1, staffed: true, roadAccess: true, paused: false })).toBeGreaterThan(0);
    expect(farmProductionPerTick({ kind: 'wheat', fertility: 1, staffed: false, roadAccess: true, paused: false })).toBe(0);
    expect(farmProductionPerTick({ kind: 'wheat', fertility: 0, staffed: true, roadAccess: true, paused: false })).toBe(0);
    expect(farmProductionPerTick({ kind: 'wheat', fertility: 1, staffed: true, roadAccess: true, paused: true })).toBe(0);
  });

  it('scales output with fertility', () => {
    const full = farmProductionPerTick({ kind: 'wheat', fertility: 1, staffed: true, roadAccess: true, paused: false });
    const half = farmProductionPerTick({ kind: 'wheat', fertility: 0.5, staffed: true, roadAccess: true, paused: false });
    expect(full).toBeCloseTo(half * 2, 5);
  });
});

describe('granary per-food commands (task 3.3)', () => {
  it('accepts within capacity by default', () => {
    const p = defaultGranaryPolicy(100);
    expect(granaryAccepts(p, 'wheat', 0)).toBe(true);
    expect(granaryAccepts(p, 'wheat', 100)).toBe(false); // full
  });

  it('refuse and empty commands block receipt', () => {
    const p = defaultGranaryPolicy(100);
    p.perFood.wheat = 'refuse';
    expect(granaryAccepts(p, 'wheat', 0)).toBe(false);
    p.perFood.wheat = 'empty';
    expect(granaryAccepts(p, 'wheat', 0)).toBe(false);
  });

  it('accept command allows receipt explicitly', () => {
    const p = defaultGranaryPolicy(100);
    p.perFood.fish = 'accept';
    expect(granaryAccepts(p, 'fish', 0)).toBe(true);
  });
});
