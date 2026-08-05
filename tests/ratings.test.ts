import { describe, it, expect } from 'vitest';
import { computeTargets, tickRatings, clampRating, decomposeRatings } from '../src/sim/ratings';

describe('ratings', () => {
  it('computeTargets rewards religion, entertainment, education, food, water, health', () => {
    const base = { population: 100, treasury: 500, taxRate: 0.1, hasReligion: false, hasEntertainment: false, hasEducation: false, hasHealth: false, hasWater: false, hasFood: false };
    const bare = computeTargets(base);
    // RATE-01 weighted formula: bare coverage incurs the small coverage
    // penalty, so culture is below the old 10-point additive-caps baseline.
    expect(bare.culture).toBe(5);
    expect(bare.prosperity).toBeLessThan(20);

    const rich = computeTargets({ ...base, population: 2000, treasury: 5000, hasReligion: true, hasEntertainment: true, hasEducation: true, hasHealth: true, hasWater: true, hasFood: true });
    expect(rich.culture).toBeGreaterThan(10);
    expect(rich.culture).toBeLessThanOrEqual(100);
    expect(rich.prosperity).toBeGreaterThan(bare.prosperity);
    expect(rich.stability).toBeGreaterThan(bare.stability);
  });

  it('low taxes improve favor', () => {
    const low = computeTargets({ population: 10, treasury: 100, taxRate: 0.05, hasReligion: false, hasEntertainment: false, hasEducation: false, hasHealth: false, hasWater: false, hasFood: false });
    const high = computeTargets({ population: 10, treasury: 100, taxRate: 0.4, hasReligion: false, hasEntertainment: false, hasEducation: false, hasHealth: false, hasWater: false, hasFood: false });
    expect(low.favor).toBeGreaterThan(high.favor);
  });

  it('tickRatings moves ratings toward targets slowly', () => {
    const now = { culture: 10, prosperity: 10, stability: 10, favor: 10 };
    const target = { culture: 50, prosperity: 50, stability: 50, favor: 50 };
    const after = tickRatings(now, target);
    expect(after.culture).toBeGreaterThan(10);
    expect(after.culture).toBeLessThan(50);
  });

  it('clampRating bounds to 0..100', () => {
    expect(clampRating(120)).toBe(100);
    expect(clampRating(-5)).toBe(0);
  });

  it('decomposeRatings exposes culture buckets from the same weighted factors as computeTargets', () => {
    const stats = { population: 1000, treasury: 5000, taxRate: 0.1,
      hasReligion: true, hasEntertainment: true, hasEducation: true, hasHealth: true, hasWater: true, hasFood: true };
    const d = decomposeRatings(stats, 150);
    // Weighted contributions land on a 0..100 scale, each clamped by construction.
    expect(d.culture.base).toBe(10);
    expect(d.culture.religion).toBe(25);
    expect(d.culture.entertainment).toBe(25);
    expect(d.culture.education).toBe(30);
    expect(d.culture.festival).toBe(0);
    // The rating is the same computation: weighted sum of the factor buckets.
    const computed = computeTargets(stats).culture;
    const bucketSum = d.culture.base + d.culture.religion + d.culture.entertainment + d.culture.education + d.culture.festival;
    expect(computed).toBe(bucketSum);
    for (const v of Object.values(d.culture)) expect(v).toBeGreaterThanOrEqual(0);
  });
});
