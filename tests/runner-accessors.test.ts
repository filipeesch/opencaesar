import { describe, it, expect } from 'vitest';
import { SimRunner } from '../src/sim/runner';

describe('SimRunner accessors', () => {
  it('getRatings returns the computed ratings', () => {
    const r = new SimRunner(1337);
    const ratings = r.getRatings();
    expect(ratings.population).toBeTypeOf('number');
    expect(ratings.prosperity).toBeTypeOf('number');
    expect(ratings.happiness).toBeTypeOf('number');
  });

  it('getTreasury and getPopulation are coherent', () => {
    const r = new SimRunner(1337);
    r.tick();
    expect(r.getTreasury()).toBeTypeOf('number');
    expect(r.getPopulation()).toBeGreaterThanOrEqual(0);
  });

  it('getEmployment reports jobs and workforce', () => {
    const r = new SimRunner(42);
    r.tick();
    const emp = r.getEmployment();
    expect(emp.totalJobs).toBeTypeOf('number');
    expect(emp.employed).toBeGreaterThanOrEqual(0);
    expect(emp.unemployed).toBeGreaterThanOrEqual(0);
  });

  it('startMission and getMission track an objective', () => {
    const r = new SimRunner(7);
    r.startMission('tutorial');
    const m = r.getMission();
    expect(m).not.toBeNull();
    expect(m!.id).toBe('tutorial');
    expect(m!.started).toBe(true);
  });

  it('enableTrade and getTradeRoutes track routes', () => {
    const r = new SimRunner(9);
    r.enableTrade('massilia', true);
    const routes = r.getTradeRoutes();
    expect(routes['massilia']).toBeDefined();
    expect(routes['massilia'].enabled).toBe(true);
  });

  it('getEvents returns message records', () => {
    const r = new SimRunner(3);
    r.tick();
    const events = r.getEvents();
    expect(Array.isArray(events)).toBe(true);
  });
});
