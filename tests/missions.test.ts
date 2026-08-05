import { describe, it, expect } from 'vitest';
// WR-03: the legacy startMission/tickMission/missionName were removed from
// src/sim/missions (dead, divergent: year:0 landmine). Mission names now come
// from the data catalog; campaignMissions() stays the pure order helper.
import { campaignMissions } from '../src/sim/missions';
import { missionName } from '../data/missions';
import { ObjectiveTracker } from '../src/sim/objectives';
import { SimRunner } from '../src/sim/runner';
import { Map as SimMap } from '../src/sim/map';
import { missionMap } from '../src/sim/missionMaps';
import { foodChainMap, buildFoodCity } from './helpers';
import { MISSIONS, EXTRA_MISSIONS } from '../data/missions';

describe('missions catalog (Phase 17, CAMPAIGN-01)', () => {
  it('missionName resolves a known mission from the data catalog', () => {
    expect(missionName('small_town')).toBe('Provincial Granary'); // Phase 17 re-theme to the spec arc
    expect(missionName('no_such_mission')).toBe('no_such_mission');
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

  it('MissionDef carries finite non-negative optional targets, keeping existing missions valid', () => {
    for (const m of [...Object.values(MISSIONS), ...Object.values(EXTRA_MISSIONS)]) {
      expect(m.targetPopulation).toBeGreaterThan(0);
      for (const key of ['targetFavor', 'targetTreasury', 'targetAnnualExports'] as const) {
        const v = m[key];
        if (v !== undefined) {
          expect(typeof v).toBe('number');
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
        }
      }
      if (m.sustainChecks !== undefined) {
        expect(Number.isInteger(m.sustainChecks)).toBe(true);
        expect(m.sustainChecks).toBeGreaterThan(0);
      }
    }
  });
});

describe('campaign progression + start-year (Phase 17, CAMPAIGN-01)', () => {
  it('a running/incomplete mission blocks starting a DIFFERENT mission id', () => {
    const r = new SimRunner(1234, foodChainMap());
    buildFoodCity(r);
    r.startMission('tutorial'); // in-progress
    r.startMission('small_town'); // must be rejected (different id while running)
    expect(r.getMission()!.id).toBe('tutorial'); // gate blocks the switch
  });

  it('a paused queued startMission of a locked/unknown mission is rejected with no queue entry (WR-01)', () => {
    const r = new SimRunner(1234, foodChainMap());
    buildFoodCity(r);
    r.startMission('tutorial'); // in-progress → 'small_town' is locked
    r.setPaused(true);

    const locked = r.startMission('small_town'); // locked while tutorial runs
    expect(locked.ok).toBe(false);
    expect(locked.error).toBe('locked');
    expect(r.getPendingCommandCount()).toBe(0); // nothing queued

    const unknown = r.startMission('no_such_mission');
    expect(unknown.ok).toBe(false);
    expect(unknown.error).toBe('unknown-mission');
    expect(r.getPendingCommandCount()).toBe(0);

    // Unpause → drain: no startMission was queued, so the mission is unchanged.
    r.setPaused(false);
    r.tick();
    expect(r.getMission()!.id).toBe('tutorial');
  });

  it('a paused queued startMission of an allowed (fresh/sandbox) mission enqueues and starts on drain (WR-01)', () => {
    const def = MISSIONS['small_town']!;
    const r = new SimRunner(5, missionMap(def)!);
    r.setPaused(true);
    const res = r.startMission('small_town'); // fresh runner = sandbox, any mission
    expect(res.ok).toBe(true);
    expect(r.getPendingCommandCount()).toBe(1);
    r.setPaused(false);
    r.tick(); // drain → the queued startMission applies
    expect(r.getMission()!.id).toBe('small_town');
  });

  it('after tutorial is won, the NEXT mission in campaign order unlocks and skipping ahead stays blocked', () => {
    const r = buildTutorialWinner();
    // Win 'tutorial' (pop100/culture10/prosperity10/stability10 held 3 months).
    for (let i = 0; i < 300 && !r.getMission()!.complete; i++) r.tick();
    expect(r.getMission()!.complete).toBe(true);

    // small_town is next in campaignMissions() order → allowed.
    r.startMission('small_town');
    expect(r.getMission()!.id).toBe('small_town');
    // thriving_city skips ahead → still locked.
    r.startMission('thriving_city');
    expect(r.getMission()!.id).toBe('small_town');
  });

  it('a time-limited mission started on a long-run runner does NOT instantly fail (start-year landmine)', () => {
    const r = new SimRunner(3, foodChainMap());
    buildFoodCity(r);
    for (let i = 0; i < 5000; i++) r.tick(); // tick 5000 → year 13
    expect(Math.floor(r.getState().tick / 360)).toBeGreaterThanOrEqual(13);

    r.startMission('thriving_city'); // timeLimitYears 10 — must count from start
    for (let i = 0; i < 100; i++) r.tick(); // include a month gate
    const m = r.getMission();
    expect(m!.id).toBe('thriving_city');
    expect(m!.failed).toBe(false); // today's year:0 landmine fails it here
  });

  it('startMission applies the mission modifiers, preplaced starters, and routes deterministically (CAMPAIGN-01)', () => {
    const def = MISSIONS['grand_city']!; // map + modifiers + routes
    const r = new SimRunner(7, missionMap(def)!);
    const treasuryBefore = r.getTreasury();
    expect(r.startMission('grand_city').ok).toBe(true);

    // Treasury credit applied additively on top of the running treasury (after
    // the preplace costs (60) AND the route-opening costs (massilia 500 +
    // tarraco 1500) are charged through the normal paths).
    const credit = def.modifiers!.startingTreasuryCredit ?? 0;
    expect(r.getTreasury()).toBeGreaterThan(treasuryBefore + credit - 2500);

    // Preplaced starter buildings exist (the mission's house + well).
    const buildings = r.getState().buildings as { type: string }[];
    expect(buildings.some((b) => b.type === 'house')).toBe(true);
    expect(buildings.some((b) => b.type === 'well')).toBe(true);

    // Routes opened and the per-good order set.
    expect(r.getTradeRoutes()['massilia']).toBeDefined();
    expect(r.getTradeRoutes()['massilia'].enabled).toBe(true);
    expect(r.getTradeRoutes()['massilia'].orders?.pottery).toBe('export_above_reserve');
    expect(r.getTradeRoutes()['tarraco'].orders?.tools).toBe('export_above_reserve');
  });

  it('a save taken after a mission start with sub-effects survives load with the mission map (CAMPAIGN-01)', () => {
    const def = MISSIONS['grand_city']!;
    const r = new SimRunner(7, missionMap(def)!);
    r.startMission('grand_city');
    for (let i = 0; i < 80; i++) r.tick();
    const loaded = SimRunner.fromSaveData(r.getSaveData(), missionMap(def)!);
    expect(loaded.getMission()!.id).toBe('grand_city');
    // The sub-effect state (started route) is restored via the single startMission command.
    for (const city of ['massilia', 'tarraco']) {
      expect(loaded.getTradeRoutes()[city]?.enabled).toBe(true);
    }
  });

  it('startMission surfaces a mandated preplace failure instead of a clean start (WR-04)', () => {
    const def = MISSIONS['grand_city']!;
    const r = new SimRunner(7, missionMap(def)!);
    // Occupy the first preplace anchor so the mandated pre-place sub-effect fails.
    const first = def.map!.preplace![0];
    expect(r.placeBuilding(first.type as import('../src/sim/types').BuildingType, first.x, first.y).ok).toBe(true);
    const res = r.startMission('grand_city');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('preplace');
    // The recordable start still applied (mission active), so a replay reconstructs
    // the same partial state deterministically — the failure is surfaced, not silent.
    expect(r.getMission()!.id).toBe('grand_city');
  });

  // Deferred to 17-01-02/03 (needs missionMap + mission modifiers data):
  //   - startMission on a mission with modifiers/preplace/routes applies the
  //     treasury credit, preplaces the starter buildings, and opens the routes.
  //   - a save/load with the mission map reproduces that exact state.
});

describe('per-mission maps parse deterministically (Phase 17, CAMPAIGN-01)', () => {
  it('every mission with a map field parses into a SimMap of the right size with exact terrain', () => {
    for (const m of [...Object.values(MISSIONS), ...Object.values(EXTRA_MISSIONS)]) {
      if (!m.map) continue;
      const map = missionMap(m);
      expect(map).not.toBeNull();
      expect(map!.width).toBe(m.map.width);
      expect(map!.height).toBe(m.map.height);
      const rows = m.map.layout.split('\n');
      for (let y = 0; y < rows.length; y++) {
        for (let x = 0; x < rows[y].length; x++) {
          const ch = rows[y][x];
          const expected = ch === '.' ? 'earth' : (m.map.legend[ch] ?? 'earth');
          expect(map!.get(x, y)).toBe(expected);
        }
      }
    }
  });

  it('all ten mission ids follow the spec arc in campaign order with non-empty names', () => {
    const order = campaignMissions();
    expect(order).toEqual([
      'tutorial', 'small_town', 'thriving_city', 'grand_city',
      'fishing_village', 'market_town', 'port_city', 'cultural_center',
      'religious_hub', 'metropolis',
    ]);
    for (const id of order) {
      const def = MISSIONS[id] ?? EXTRA_MISSIONS[id];
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
    }
  });

  it('an all-undefined additive entry still parses (additive MissionDef contract)', () => {
    expect(missionMap({ map: undefined })).toBeNull();
    expect(missionMap(undefined)).toBeNull();
  });
});

/**
 * A small, self-sufficient civic village that reliably WINS 'tutorial'
 * (population 100 + 10/10/10 held for the 3-month sustain). Civic buildings must
 * sit within ~8 road tiles of the housing row (wandering service walkers turn
 * home after maxRoadSteps=8 — see walkerProfiles) or their service never reaches
 * a house and culture stays at its floor. Built deterministically within budget
 * (the royal subsidy funds the civic tier).
 */
function buildTutorialWinner(): SimRunner {
  const m = SimMap.fromLayout(40, 20, () => 'fertile');
  const r = new SimRunner(1234, m);
  const place = (type: Parameters<typeof r.placeBuilding>[0], x: number, y: number, o?: { god?: string }) => {
    const res = r.placeBuilding(type, x, y, o);
    if (!res.ok) throw new Error(`place ${type}@${x},${y} -> ${res.error}`);
  };
  for (let x = 0; x <= 24; x++) for (const y of [0, 3, 5]) place('road', x, y);
  place('road', 7, 1);
  place('road', 7, 2);
  place('road', 7, 4);
  for (const x of [0, 4, 8]) place('farm', x, 1);
  place('granary', 14, 1);
  place('granary', 20, 1);
  place('market', 22, 1);
  for (const x of [0, 2, 4, 6, 8, 10]) place('house', x, 4);
  place('well', 0, 6);
  place('well', 10, 6);
  r.requestRoyalSubsidy();
  place('school', 2, 6);
  place('theatre', 6, 6);
  r.setPolicy(0.08, 0.2);
  r.startMission('tutorial');
  return r;
}
