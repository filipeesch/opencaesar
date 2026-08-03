import { describe, it, expect } from 'vitest';
import { computeServiceCoverage, computeFavor, holdFestival, GODS } from '../../src/sim/services';

describe('civic services (Phases 12-13)', () => {
  it('maps coverage factors to health/literacy/entertainment/religion', () => {
    const c = computeServiceCoverage({
      doctorCoverage: 0.8, educationCoverage: 0.6, entertainmentCoverage: 1,
      godWorship: { jupiter: 1, neptune: 1, ceres: 1, bacchus: 1, mercury: 1 },
    });
    expect(c.health).toBe(0.8);
    expect(c.literacy).toBe(0.6);
    expect(c.entertainment).toBe(1);
    expect(c.religion).toBe(1);
  });

  it('religion aggregates worship to favor across the five gods', () => {
    expect(GODS.length).toBe(5);
    expect(computeFavor({ jupiter: 1, neptune: 1, ceres: 1, bacchus: 1, mercury: 1 })).toBe(100);
    expect(computeFavor({ jupiter: 1 })).toBe(20);
  });

  it('festival requires treasury (no free exploit) and raises worship', () => {
    expect(holdFestival({ cost: 100, treasury: 50, worship: 0 }).ok).toBe(false);
    const ok = holdFestival({ cost: 100, treasury: 500, worship: 0.5 });
    expect(ok.ok).toBe(true);
    expect(ok.newWorship).toBeGreaterThan(0.5);
  });
});

import { FESTIVAL_TIERS, startFestival, tickFestival } from '../../src/sim/services';

describe('festivals (task 9.4)', () => {
  it('has four tiers with escalating cost and boost', () => {
    expect(FESTIVAL_TIERS.map((t) => t.id)).toEqual(['small', 'medium', 'large', 'provincial']);
    expect(FESTIVAL_TIERS[3].cost).toBeGreaterThan(FESTIVAL_TIERS[0].cost);
  });

  it('becomes ready after its prep period', () => {
    const p = startFestival('medium');
    expect(p?.ready).toBe(false);
    tickFestival(p!);
    tickFestival(p!);
    expect(p?.ready).toBe(true);
  });
});
