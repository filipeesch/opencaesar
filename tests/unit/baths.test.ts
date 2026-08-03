import { describe, it, expect } from 'vitest';
import { BATH_DEFAULT_WATER_COST, resolveBaths, assignBathEffects, computeBathCoverage } from '../../src/sim/water';

describe('public baths wiring (WATR-05)', () => {
  it('a supplied and staffed bath grants wellness and desirability in radius and consumes water', () => {
    const { wellness, desirability, waterConsumed } = assignBathEffects(
      [{ x: 3, y: 3, radius: 2, supplied: true, staffed: true }],
      7, 7,
    );
    expect(wellness[3][3]).toBe(1);
    expect(desirability[3][3]).toBe(4);
    expect(waterConsumed).toBe(BATH_DEFAULT_WATER_COST);
    expect(wellness[0][0]).toBe(0); // distance 6, outside radius
    expect(desirability[0][0]).toBe(0);
  });

  it('a bath without workers provides nothing and consumes no water', () => {
    const { wellness, desirability, waterConsumed } = assignBathEffects(
      [{ x: 3, y: 3, radius: 2, supplied: true, staffed: false }],
      7, 7,
    );
    for (const row of wellness) for (const v of row) expect(v).toBe(0);
    for (const row of desirability) for (const v of row) expect(v).toBe(0);
    expect(waterConsumed).toBe(0);
  });

  it('a bath without reservoir water provides nothing and consumes no water', () => {
    const { wellness, desirability, waterConsumed } = assignBathEffects(
      [{ x: 3, y: 3, radius: 2, supplied: false, staffed: true }],
      7, 7,
    );
    for (const row of wellness) for (const v of row) expect(v).toBe(0);
    for (const row of desirability) for (const v of row) expect(v).toBe(0);
    expect(waterConsumed).toBe(0);
  });

  it('sums water consumption across active baths only; unstaffed/unsupplied baths contribute no cost', () => {
    const { waterConsumed } = assignBathEffects(
      [
        { x: 1, y: 1, radius: 2, supplied: true, staffed: true },
        { x: 3, y: 3, radius: 2, supplied: true, staffed: true },
        { x: 5, y: 5, radius: 2, supplied: true, staffed: false },
      ],
      7, 7,
    );
    expect(waterConsumed).toBe(2 * BATH_DEFAULT_WATER_COST);
  });

  it('resolveBaths returns no active baths when every def is unstaffed or unsupplied', () => {
    expect(resolveBaths([
      { x: 1, y: 1, radius: 2, supplied: false, staffed: true },
      { x: 3, y: 3, radius: 2, supplied: true, staffed: false },
    ])).toEqual({ active: [], waterConsumed: 0 });
  });

  it('clamps a negative radius to 0 and never lets a negative water cost add water (IN-03)', () => {
    const { active, waterConsumed } = resolveBaths([
      { x: 3, y: 3, radius: -2, supplied: true, staffed: true, waterCostPerTick: -5 },
    ]);
    expect(waterConsumed).toBe(0); // negative cost contributes nothing
    expect(active).toHaveLength(1);
    expect(active[0].radius).toBe(0); // radius 0 → self-tile-only bath
    const { wellness } = computeBathCoverage(active, 5, 5);
    expect(wellness[3][3]).toBe(1);
    expect(wellness[3][2]).toBe(0);
  });
});
