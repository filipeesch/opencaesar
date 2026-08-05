/**
 * Housing Level Bridge pure helpers (Phase 16, HOUS-01).
 *
 * The 21-level live bridge in src/sim/housingLive.ts wires the data catalog
 * (data/housing.ts HOUSING_LEVELS, levels 0-20) into the live sim as the single
 * source of truth for a house's progression:
 *   - HOUSING_LIVE_STATS: one {population, workers, taxPerTick} entry per level.
 *   - levelDesirability: the 0-200 -> 1-30 normalizer (cap 30, NOT 20, so the
 *     full 21-level ladder is satisfiable — decideEvolution's padded threshold
 *     at level 20 needs 25, which a cap-30 normalizer can reach).
 *   - tierOfLevel: the derived 0-4 bucket (keeps the HOUSE_TIERS.length rating
 *     denominator and the patrician bar valid).
 *   - liveStats: the single clamped accessor — never a bare array index.
 */
import { describe, expect, it } from 'vitest';
import { HOUSING_LEVELS } from '../../data/housing';
import { HOUSING_LIVE_STATS, levelDesirability, liveStats, tierOfLevel } from '../../src/sim/housingLive';

describe('HOUSING_LIVE_STATS 21-level bridge (Phase 16)', () => {
  it('carries one live-stats entry per HOUSING_LEVELS level (21)', () => {
    expect(HOUSING_LIVE_STATS.length).toBe(21);
    expect(HOUSING_LIVE_STATS.length).toBe(HOUSING_LEVELS.length);
  });

  it('population equals HOUSING_LEVELS capacity and is monotonic non-decreasing', () => {
    let prev = -1;
    for (let i = 0; i < HOUSING_LIVE_STATS.length; i++) {
      expect(HOUSING_LIVE_STATS[i].population).toBe(HOUSING_LEVELS[i].capacity);
      expect(HOUSING_LIVE_STATS[i].population).toBeGreaterThanOrEqual(prev);
      prev = HOUSING_LIVE_STATS[i].population;
    }
  });

  it('workers and taxPerTick are finite, non-negative, and monotonic non-decreasing', () => {
    let w = -1;
    let t = -1;
    for (const s of HOUSING_LIVE_STATS) {
      expect(Number.isFinite(s.workers)).toBe(true);
      expect(Number.isFinite(s.taxPerTick)).toBe(true);
      expect(s.workers).toBeGreaterThanOrEqual(0);
      expect(s.taxPerTick).toBeGreaterThanOrEqual(0);
      expect(s.workers).toBeGreaterThanOrEqual(w);
      expect(s.taxPerTick).toBeGreaterThanOrEqual(t);
      w = s.workers;
      t = s.taxPerTick;
    }
  });
});

describe('levelDesirability normalizer (0-200 -> 1-30)', () => {
  it('maps the documented boundaries', () => {
    expect(levelDesirability(0)).toBe(0);
    expect(levelDesirability(200)).toBe(30);
    expect(levelDesirability(30)).toBe(5);
    expect(levelDesirability(75)).toBe(13);
    expect(levelDesirability(101)).toBe(17);
    expect(levelDesirability(-5)).toBe(0);
  });

  it('reachability: a maximally-desirable tile clears the level-20 padded threshold', () => {
    // decideEvolution requires desirability >= level.desirability + padding (5);
    // the level-20 requirement is 25 — only reachable with a cap-30 normalizer.
    expect(levelDesirability(200)).toBeGreaterThanOrEqual(25);
  });

  it('is monotonic non-decreasing over the 0-200 raw range', () => {
    let prev = -1;
    for (let raw = 0; raw <= 200; raw += 1) {
      const v = levelDesirability(raw);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('tierOfLevel derived bucket (0-4)', () => {
  it('buckets monotonically within 0..4 so the ratings denominator stays valid', () => {
    expect(tierOfLevel(0)).toBe(0);
    expect(tierOfLevel(2)).toBe(0);
    expect(tierOfLevel(3)).toBe(0);
    expect(tierOfLevel(4)).toBe(1);
    expect(tierOfLevel(7)).toBe(1);
    expect(tierOfLevel(8)).toBe(2);
    expect(tierOfLevel(11)).toBe(2);
    expect(tierOfLevel(12)).toBe(3);
    expect(tierOfLevel(15)).toBe(3);
    expect(tierOfLevel(16)).toBe(4);
    expect(tierOfLevel(20)).toBe(4);
  });

  it('is monotonic non-decreasing across every level and capped at 4', () => {
    let prev = -1;
    for (let level = 0; level <= 20; level++) {
      const t = tierOfLevel(level);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(4);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });
});

describe('liveStats clamped accessor', () => {
  it('clamps out-of-range levels and never returns undefined', () => {
    expect(liveStats(99)).toEqual(liveStats(20));
    expect(liveStats(-1)).toEqual(liveStats(0));
    expect(liveStats(undefined as unknown as number)).toEqual(liveStats(0));
    for (const level of [-10, 0, 7, 20, 21, 100]) {
      expect(liveStats(level)).toBeDefined();
    }
  });
});
