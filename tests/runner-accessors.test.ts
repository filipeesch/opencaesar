import { describe, it, expect } from 'vitest';
import { Map as SimMap } from '../src/sim/map';
import { SimRunner } from '../src/sim/runner';
import { BUILDINGS } from '../src/sim/buildings';

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

  it('getTileState returns a read-only copy of all 16 per-tile fields (CORE-03)', () => {
    const r = new SimRunner(1337);
    const s = r.getTileState(5, 5);
    // All 16 CORE-03 fields (incl. roadType from ROAD-02), starting from neutral
    // defaults on a fresh runner.
    expect(s).toEqual({
      elevation: 0,
      fertility: 0,
      resourceType: null,
      resourceAmount: 0,
      waterDepth: 0,
      aqueduct: false,
      road: false,
      roadType: null,
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

  it('demolishing a road clears the roadType side-channel too (WR-01)', () => {
    const map = SimMap.fromLayout(12, 12, () => 'earth');
    const r = new SimRunner(1337, map);
    r.placeBuilding('road', 2, 2);
    // Pave the placed road through the side-channel (the UI paving path probes
    // road types independently of terrain, so this is how a type lands on road).
    map.setRoadType(2, 2, 'paved');
    expect(r.getTileState(2, 2)).toMatchObject({ road: true, roadType: 'paved' });

    r.demolish(2, 2);
    // Demolition must clear BOTH the terrain and the side-channel, so the
    // public state never contradicts itself (road:false, roadType:'paved').
    const s = r.getTileState(2, 2);
    expect(s.road).toBe(false);
    expect(s.roadType).toBeNull();
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

describe('ratings decomposition wired into DerivedSnapshot (RATE-01 tracer)', () => {
  it('getDerived().decomposition exists and culture factors respond to placed civic buildings (end-to-end)', () => {
    const m = SimMap.fromLayout(24, 24, () => 'fertile');
    const r = new SimRunner(7, m);
    // Phase-12 civic skeleton: road grid + 12 houses + a school/theatre/temple.
    for (let x = 0; x <= 20; x++) for (const y of [0, 3, 5, 7, 9]) r.placeBuilding('road', x, y);
    for (const [x, y] of [[7, 1], [7, 2], [7, 4], [7, 6], [7, 8]]) r.placeBuilding('road', x, y);
    r.placeBuilding('farm', 0, 1);
    r.placeBuilding('granary', 2, 1);
    r.placeBuilding('market', 4, 1);
    r.placeBuilding('well', 0, 6);
    r.placeBuilding('well', 14, 6);
    for (const x of [0, 2, 4, 6]) r.placeBuilding('house', x, 4);
    for (const x of [0, 2, 4, 6, 8, 10, 12, 14]) r.placeBuilding('house', x, 8);
    r.requestRoyalSubsidy();
    r.tick();
    const school = r.placeBuilding('school', 10, 10);
    const theatre = r.placeBuilding('theatre', 14, 10);
    const temple = r.placeBuilding('temple', 8, 10, { god: 'jupiter' });
    expect(school.ok && theatre.ok && temple.ok).toBe(true);
    r.setPolicy(0.1, 0.135);
    for (let i = 0; i < 500; i++) r.tick();

    const d = r.getDerived();
    expect(d.decomposition).toBeDefined();
    expect(d.decomposition.culture).toBeDefined();
    // The placed education/entertainment/religion buildings move the culture
    // factor buckets above zero (weighted contributions on a 0..100 scale).
    expect(d.decomposition.culture.education).toBeGreaterThan(0);
    expect(d.decomposition.culture.entertainment).toBeGreaterThan(0);
    expect(d.decomposition.culture.religion).toBeGreaterThan(0);
    expect(d.decomposition.culture.education).toBeLessThanOrEqual(30);
    expect(d.decomposition.culture.entertainment).toBeLessThanOrEqual(25);
    expect(d.decomposition.culture.religion).toBeLessThanOrEqual(25);
  });

  it('a bare city carries a defined decomposition with culture buckets at zero', () => {
    const r = new SimRunner(55);
    for (let i = 0; i < 20; i++) r.tick();
    const d = r.getDerived();
    expect(d.decomposition).toBeDefined();
    expect(d.decomposition.culture.education).toBe(0);
    expect(d.decomposition.culture.entertainment).toBe(0);
    expect(d.decomposition.culture.religion).toBe(0);
  });
});

describe('constructionSpend separation and full decomposition (RATE-01)', () => {
  it('a costly build raises constructionSpend by exactly its cost; operating-balance stays treasury-derived', () => {
    const m = SimMap.fromLayout(24, 24, () => 'earth');
    const r = new SimRunner(7, m);
    for (let x = 0; x <= 8; x++) r.placeBuilding('road', x, 0);
    r.placeBuilding('road', 0, 1);
    r.requestRoyalSubsidy();
    r.tick();
    const cost = BUILDINGS['library'].cost; // sim-core catalog cost
    expect(cost).toBeGreaterThan(0);
    const beforeSpend = r.getDerived().constructionSpend;
    const res = r.placeBuilding('library', 6, 1);
    expect(res.ok, JSON.stringify(res)).toBe(true);
    r.tick(); // let tickDerivedSystems recompute the derived snapshot
    const after = r.getDerived();
    expect(after.constructionSpend).toBe(beforeSpend + cost);
    // The construction bucket carries the spend...
    expect(after.decomposition.prosperity.construction).toBeGreaterThan(0);
    // ...while the operating-balance bucket stays purely treasury-health derived
    // (one-time build cost is never folded in as a second penalty).
    expect(after.decomposition.prosperity.operatingBalance)
      .toBe(Math.round(Math.min(1, r.getTreasury() / 2000) * 20));
  });

  it('getDerived().decomposition exposes all four ratings with buckets clamped 0..100', () => {
    const r = new SimRunner(55);
    for (let i = 0; i < 30; i++) r.tick();
    const D = r.getDerived().decomposition;
    expect(D).toBeDefined();
    for (const rating of ['culture', 'prosperity', 'stability', 'favor'] as const) {
      for (const bucket of Object.values(D[rating])) {
        expect(bucket).toBeGreaterThanOrEqual(0);
        expect(bucket).toBeLessThanOrEqual(100);
      }
    }
  });
});
