import { describe, it, expect } from 'vitest';
import { startMission, tickMission, missionName } from '../src/sim/missions';
import { ObjectiveTracker } from '../src/sim/objectives';
import { SimRunner } from '../src/sim/runner';
import { foodChainMap, buildFoodCity } from './helpers';
import { MISSIONS } from '../data/missions';

describe('missions', () => {
  it('startMission creates an active mission', () => {
    const m = startMission('tutorial');
    expect(m.started).toBe(true);
    expect(m.complete).toBe(false);
  });

  it('tickMission completes when targets are met', () => {
    const m = startMission('tutorial'); // targetPopulation 100
    tickMission(m, { population: 120, culture: 20, prosperity: 20, stability: 20, year: 0 });
    expect(m.complete).toBe(true);
  });

  it('tickMission fails when time runs out', () => {
    const m = startMission('thriving_city'); // timeLimitYears 10
    tickMission(m, { population: 100, culture: 10, prosperity: 10, stability: 10, year: 11 });
    expect(m.failed).toBe(true);
  });

  it('missionName resolves a known mission', () => {
    expect(missionName('small_town')).toBe('Small Town');
  });
});

describe('mission unify on the sustained ObjectiveTracker (RATE-02)', () => {
  it('a mission-held target set (incl. treasury/favor/annualExports) wins only after sustainChecks passes', () => {
    const tracker = new ObjectiveTracker({
      population: 100, treasury: 500, favor: 50, annualExports: 20, sustainChecks: 2,
    });
    const snap = {
      population: 100, culture: 0, prosperity: 0, stability: 0,
      treasury: 500, favor: 50, annualExports: 20,
    };
    expect(tracker.update(snap).won).toBe(false);
    expect(tracker.update(snap).won).toBe(true);
    // shortfalls reset the counter and stay visible (not a win, not a failure)
    const miss = tracker.update({ ...snap, treasury: 400 });
    expect(miss.won).toBe(false);
    expect(miss.sustained).toBe(0);
  });

  it('a mission in the runner reports not-complete (never failed) while a target falls short — time-limit is preserved separately', () => {
    const r = new SimRunner(1234, foodChainMap());
    buildFoodCity(r);
    r.setPolicy(0, 0.5);
    r.startMission('tutorial'); // needs culture 10; a bare food city stays at 5
    for (let i = 0; i < 700; i++) r.tick();
    const m = r.getMission();
    expect(m!.started).toBe(true);
    expect(m!.complete).toBe(false);
    expect(m!.failed).toBe(false); // shortfall stays visible, never a spurious failure
  });

  it('MissionDef carries the new optional targets without breaking existing missions', () => {
    for (const m of Object.values(MISSIONS)) {
      expect(m.targetPopulation).toBeGreaterThan(0);
      expect(m.targetFavor).toBeUndefined();
      expect(m.targetTreasury).toBeUndefined();
      expect(m.targetAnnualExports).toBeUndefined();
      expect(m.sustainChecks).toBeUndefined();
    }
  });
});
