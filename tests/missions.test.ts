import { describe, it, expect } from 'vitest';
import { startMission, tickMission, missionName } from '../src/sim/missions';

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
