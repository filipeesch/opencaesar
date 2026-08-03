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

describe('event lifecycle in runner', () => {
  it('fires a deterministic event log from tick stepping', () => {
    const runner = new SimRunner(12345);
    for (let i = 0; i < 200; i++) runner.tick();
    const events = runner.getEvents();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });
});

describe('mission win-condition integration', () => {
  it('startMission + tick updates an in-progress mission', () => {
    const r = new SimRunner(7);
    r.startMission('tutorial');
    for (let i = 0; i < 50; i++) r.tick();
    const m = r.getMission();
    expect(m).toBeTruthy();
    expect(m!.started).toBe(true);
  });
});

describe('paused command queue (CORE-02)', () => {
  it('defers build/policy while paused, consuming them on the next tick', () => {
    const r = new SimRunner(99);
    r.setPaused(true);
    r.setPolicy(0.2, 0.0); // queued — not applied
    expect(r.getPolicy().taxRate).toBe(0.1); // unchanged while paused
    expect(r.getPendingCommandCount()).toBe(1);
    r.setPaused(false);
    r.tick(); // consumes queued command on next fixed step
    expect(r.getPolicy().taxRate).toBe(0.2);
    expect(r.getPendingCommandCount()).toBe(0);
  });

  it('applies immediately when not paused (unchanged behavior)', () => {
    const r = new SimRunner(99);
    r.setPolicy(0.35, 0.1);
    expect(r.getPolicy().taxRate).toBe(0.35);
    expect(r.getPendingCommandCount()).toBe(0);
  });
});
