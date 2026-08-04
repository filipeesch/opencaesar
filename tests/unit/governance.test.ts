import { describe, it, expect } from 'vitest';
import { GOV_BUILDINGS, unlockedGov, govThreshold, createRequest, deliverRequest } from '../../src/sim/governance';
import { ObjectiveTracker } from '../../src/sim/objectives';

describe('governance (Phase 14)', () => {
  it('unlocks government buildings at population thresholds', () => {
    expect(govThreshold('forum')).toBe(250);
    expect(govThreshold('senate')).toBe(500);
    expect(govThreshold('palatine')).toBe(900);
    expect(unlockedGov(200).map((g) => g.id)).toEqual([]);
    expect(unlockedGov(400).map((g) => g.id)).toEqual(['forum']);
    expect(unlockedGov(700).map((g) => g.id)).toEqual(['forum', 'senate']);
    expect(unlockedGov(1000).map((g) => g.id)).toEqual(['forum', 'senate', 'palatine']);
    expect(GOV_BUILDINGS.length).toBe(3);
  });

  it('requests reward on full delivery and penalize when expired', () => {
    const req = createRequest({ id: 'r1', title: 'Grain', description: 'deliver grain', type: 'goods', amount: 100, deadlineMonths: 6, reward: 500, penalty: 200 });
    expect(deliverRequest(req, 60, 1)).toMatchObject({ status: 'partial' });
    expect(deliverRequest(req, 40, 2).status).toBe('deliver');
    const late = createRequest({ id: 'r2', title: 'Coin', description: 'pay', type: 'denarii', amount: 50, deadlineMonths: 3, reward: 100, penalty: 50 });
    expect(deliverRequest(late, 0, 12).status).toBe('expired');
  });
});

describe('objectives (Phase 15)', () => {
  it('requires targets sustained for the required period', () => {
    const t = new ObjectiveTracker({ population: 100, prosperity: 50, sustainChecks: 3 });
    expect(t.update({ population: 100, culture: 0, prosperity: 50, stability: 0 }).won).toBe(false);
    expect(t.update({ population: 100, culture: 0, prosperity: 50, stability: 0 }).won).toBe(false);
    expect(t.update({ population: 100, culture: 0, prosperity: 50, stability: 0 }).won).toBe(true);
  });

  it('resets the sustain counter when a metric dips below target', () => {
    const t = new ObjectiveTracker({ population: 100, sustainChecks: 2 });
    t.update({ population: 100, culture: 0, prosperity: 0, stability: 0 });
    const r = t.update({ population: 99, culture: 0, prosperity: 0, stability: 0 });
    expect(r.won).toBe(false);
    expect(r.sustained).toBe(0);
  });
});
