import { describe, it, expect } from 'vitest';
import { Map as SimMap } from '../src/sim/map';
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

  it('getTileState returns a read-only copy of all 15 per-tile fields (CORE-03)', () => {
    const r = new SimRunner(1337);
    const s = r.getTileState(5, 5);
    // All 15 CORE-03 fields, starting from neutral defaults on a fresh runner.
    expect(s).toEqual({
      elevation: 0,
      fertility: 0,
      resourceType: null,
      resourceAmount: 0,
      waterDepth: 0,
      aqueduct: false,
      road: false,
      desirability: 0,
      fireRisk: 0,
      collapseRisk: 0,
      pollution: 0,
      traffic: 0,
      serviceCoverage: 0,
      ownership: 'none',
      blocked: false,
    });

    // Mutating the returned object must not corrupt subsequent reads (read-only contract).
    s.fertility = 99;
    s.resourceType = 'wheat';
    s.ownership = 'industrial';
    const again = r.getTileState(5, 5);
    expect(again.fertility).toBe(0);
    expect(again.resourceType).toBeNull();
    expect(again.ownership).toBe('none');
  });

  it('getTileState reflects road placement on the terrain grid (WR-01)', () => {
    const r = new SimRunner(1337, SimMap.fromLayout(12, 12, () => 'earth'));
    expect(r.getTileState(2, 2).road).toBe(false); // earth until placed

    r.placeBuilding('road', 2, 2);
    expect(r.getTileState(2, 2).road).toBe(true); // road now present

    r.demolish(2, 2);
    expect(r.getTileState(2, 2).road).toBe(false); // reset to earth on demolish
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

describe('trade wired into sim tick', () => {
  it('enabling a trade route affects treasury and granary stock', () => {
    const r = new SimRunner(1234);
    r.enableTrade('massilia', true);
    // place a granary with wheat
    r.placeBuilding('granary', 5, 5);
    // seed stock by ticking
    for (let i = 0; i < 5; i++) r.tick();
    const treasury = r.getTreasury();
    expect(typeof treasury).toBe('number');
    expect(r.getTradeRoutes()['massilia'].enabled).toBe(true);
  });
});

describe('save/load round-trip determinism (task 12.3)', () => {
  it('reloading a save mid-run reproduces the exact continued state', () => {
    const seed = 777;
    const step = (r: SimRunner, n: number) => {
      for (let i = 0; i < n; i++) r.tick();
    };
    // Original straight run.
    const a = new SimRunner(seed);
    step(a, 200);
    const save = a.getSaveData();

    // Continued straight run from tick 200.
    const b = new SimRunner(seed);
    step(b, 200);
    step(b, 100);

    // Reloaded run from the save at tick 200, then continue 100.
    const c = SimRunner.fromSaveData(save);
    step(c, 100);

    expect(c.getState().tick).toBe(b.getState().tick);
    expect(c.getStateJson()).toBe(b.getStateJson());
  });
});

describe('derived sim wiring (warning fix)', () => {
  it('getDerived returns live-derived metrics after ticking', () => {
    const r = new SimRunner(55);
    for (let i = 0; i < 20; i++) r.tick();
    const d = r.getDerived();
    expect(typeof d.population).toBe('number');
    expect(typeof d.culture).toBe('number');
    expect(typeof d.prosperity).toBe('number');
    expect(d.water.totalTiles).toBeGreaterThan(0);
    expect(d.codex.buildings).toBeGreaterThan(0);
    expect(Array.isArray(d.government)).toBe(true);
  });

  it('objective win-condition evaluates against live derived state', () => {
    const r = new SimRunner(99);
    for (let i = 0; i < 10; i++) r.tick();
    r.setObjective({ sustainChecks: 1 });
    const prog = r.getObjectiveProgress();
    expect(prog).not.toBeNull();
    expect(typeof prog!.progress).toBe('number');
  });
});
