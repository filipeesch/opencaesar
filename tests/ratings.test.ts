import { describe, it, expect } from 'vitest';
import { computeTargets, tickRatings, clampRating, decomposeRatings } from '../src/sim/ratings';

/** Worst-case RATE-01 factor profile — an empty, high-risk, asset-less town. */
const base = {
  population: 100, treasury: 500, taxRate: 0.1,
  hasReligion: false, hasEntertainment: false, hasEducation: false, hasHealth: false, hasWater: false, hasFood: false,
  educationCoverage: 0, entertainmentCoverage: 0, religionCoverage: 0, festivalBoost: 0,
  housingLevel: 0, patricianShare: 0, operatingBalance: 0, unemployment: 1, wagesPaid: 0,
  tradeActivity: 0, longTermStability: 0, debtBurden: 1,
  fireRiskFactor: 1, homelessness: 1, crimeFactor: 1, protestFactor: 1, healthCoverage: 0,
  supplyLevel: 0, employmentLevel: 0, collapseRiskFactor: 1, residentialStability: 0,
  requestsFulfilled: 0, giftsGiven: 0, objectivesMet: 0, tributePaid: 0, salaryLevel: 0, performance: 0,
};

/** Best-case RATE-01 factor profile — a thriving, well-covered, debt-free city. */
const richOverrides = {
  population: 2000, treasury: 5000,
  hasReligion: true, hasEntertainment: true, hasEducation: true, hasHealth: true, hasWater: true, hasFood: true,
  educationCoverage: 1, entertainmentCoverage: 1, religionCoverage: 1, festivalBoost: 0,
  housingLevel: 1, patricianShare: 1, operatingBalance: 1, unemployment: 0, wagesPaid: 1,
  tradeActivity: 1, longTermStability: 1, debtBurden: 0,
  fireRiskFactor: 0, homelessness: 0, crimeFactor: 0, protestFactor: 0, healthCoverage: 1,
  supplyLevel: 1, employmentLevel: 1, collapseRiskFactor: 0, residentialStability: 1,
  requestsFulfilled: 1, giftsGiven: 1, objectivesMet: 1, tributePaid: 1, salaryLevel: 1, performance: 1,
};

describe('ratings', () => {
  it('computeTargets rewards religion, entertainment, education, food, water, health', () => {
    const bare = computeTargets(base);
    // RATE-01 weighted formula: bare coverage incurs the small coverage penalty
    // and worst-case factor inputs keep the economy ratings near their floor.
    expect(bare.culture).toBe(5);
    expect(bare.prosperity).toBeLessThan(20);

    const rich = computeTargets({ ...base, ...richOverrides });
    expect(rich.culture).toBeGreaterThan(10);
    expect(rich.culture).toBeLessThanOrEqual(100);
    expect(rich.prosperity).toBeGreaterThan(bare.prosperity);
    expect(rich.stability).toBeGreaterThan(bare.stability);
    expect(rich.stability).toBeLessThanOrEqual(100);
  });

  it('low taxes improve favor', () => {
    const low = computeTargets({ ...base, taxRate: 0.05 });
    const high = computeTargets({ ...base, taxRate: 0.4 });
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
    const richStats = { ...base, ...richOverrides };
    const d = decomposeRatings(richStats, 150);
    // Weighted contributions land on a 0..100 scale, each clamped by construction.
    expect(d.culture.base).toBe(10);
    expect(d.culture.religion).toBe(25);
    expect(d.culture.entertainment).toBe(25);
    expect(d.culture.education).toBe(30);
    expect(d.culture.festival).toBe(0);
    // The rating is the same computation: weighted sum of the factor buckets.
    const computed = computeTargets({ ...base, ...richOverrides }).culture;
    const bucketSum = d.culture.base + d.culture.religion + d.culture.entertainment + d.culture.education + d.culture.festival;
    expect(computed).toBe(bucketSum);
    for (const v of Object.values(d.culture)) expect(v).toBeGreaterThanOrEqual(0);
  });

  it('decomposeRatings exposes weighted buckets for all four ratings, each clamped 0..100 (RATE-01)', () => {
    const richStats = { ...base, ...richOverrides };
    const d = decomposeRatings(richStats, 150);
    // Prosperity: best-case factor inputs land on weighted contributions.
    expect(d.prosperity.operatingBalance).toBe(20);
    expect(d.prosperity.unemployment).toBe(16);
    expect(d.prosperity.construction).toBe(Math.min(15, Math.floor(150 / 100)));
    // Stability: worst-case bare vs best-case rich monotonicity.
    const bareD = decomposeRatings(base, 0);
    const bareStab = bareD.stability.fire + bareD.stability.homelessness + bareD.stability.crime
      + bareD.stability.protests + bareD.stability.health + bareD.stability.supply
      + bareD.stability.employment + bareD.stability.collapses + bareD.stability.residentialStability;
    const richStab = d.stability.fire + d.stability.homelessness + d.stability.crime
      + d.stability.protests + d.stability.health + d.stability.supply
      + d.stability.employment + d.stability.collapses + d.stability.residentialStability;
    expect(richStab).toBeGreaterThan(bareStab);
    for (const rating of ['culture', 'prosperity', 'stability', 'favor'] as const) {
      for (const bucket of Object.values(d[rating])) {
        expect(bucket).toBeGreaterThanOrEqual(0);
        expect(bucket).toBeLessThanOrEqual(100);
      }
    }
  });
});
