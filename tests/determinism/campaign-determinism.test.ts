/**
 * Phase 17 campaign determinism (CAMPAIGN-01 / CAMPAIGN-02).
 *
 * startMission must be a replayable SaveCommand (mission state round-trips via
 * command replay, never a SaveData schema field) and "don't show again" must be
 * a replayable dismissTutorialStep SaveCommand. This file mirrors the chunked
 * byte-identity harness from finance-determinism.test.ts and the run→save→load
 * contract from event-response-determinism.test.ts, plus the no-RNG/clock
 * source audit over the Phase-17 sim files.
 *
 * Wave-0 scaffold (17-00-01): ships the compile-safe RED cases — startMission
 * save/load mission survival, chunked-run identity, and the source audit. The
 * cases that reference later APIs land with their implementing waves:
 *   - 17-01-02/03: missionMap()-based round-trip + command-no-growth on save →
 *     load → save (missionMaps.ts + sub-effects).
 *   - 17-02-01: dismissTutorialStep → save → load keeps the step dismissed
 *     (getTutorial() + getMissionProgress()/getCampaignProgress() accessors).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';
import { missionMap } from '../../src/sim/missionMaps';
import { MISSIONS } from '../../data/missions';
import { foodChainMap, buildFoodCity } from '../helpers';

/**
 * Chunked-run harness (mirror of finance-determinism.test.ts:20-33): the SAME
 * seed + commands ticked in 1/7/50-tick batches must yield a byte-identical
 * getStateJson(), with a mission started mid-run.
 */
function chunkedRunJson(seed: number, chunk: number, total: number): { json: string; mission: unknown } {
  const r = new SimRunner(seed, foodChainMap());
  buildFoodCity(r);
  r.startMission('tutorial');
  let ticked = 0;
  while (ticked < total) {
    const n = Math.min(chunk, total - ticked);
    for (let i = 0; i < n; i++) r.tick();
    ticked += n;
  }
  return { json: r.getStateJson(), mission: r.getMission() };
}

describe('campaign determinism (Phase 17, CAMPAIGN-01)', () => {
  it('chunked ticking (1/7/50) is byte-identical for a mission run', () => {
    for (const seed of [1, 7]) {
      const total = 220; // crosses at least one month gate (tick 40+) and a year fraction
      const s1 = chunkedRunJson(seed, 1, total);
      const s7 = chunkedRunJson(seed, 7, total);
      const s50 = chunkedRunJson(seed, 50, total);
      expect(s50.json).toBe(s7.json);
      expect(s7.json).toBe(s1.json);
    }
  });

  it('startMission → tick past a month gate → save → load keeps the mission (id/started/year) and byte-identical state', () => {
    const map = foodChainMap();
    const r = new SimRunner(7, map);
    buildFoodCity(r);
    r.startMission('tutorial');
    for (let i = 0; i < 200; i++) r.tick(); // past several month gates (tick 40+)

    // fromSaveData(save, map) replays the recorded mission start at tick 0.
    // Pass a FRESH deterministic map (foodChainMap() is seed-free): the original
    // run's map was mutated by buildFoodCity's road placement, and replaying
    // place-commands onto already-road terrain would be rejected.
    const loaded = SimRunner.fromSaveData(r.getSaveData(), foodChainMap());
    expect(loaded.getStateJson()).toBe(r.getStateJson());
    // getMission() must survive the round-trip — the mission is NOT in SaveData,
    // so it reconstructs purely from the replayed startMission SaveCommand.
    expect(loaded.getMission()).toEqual(r.getMission());
    expect(loaded.getMission()!.id).toBe('tutorial');
  });

  it('a mission started mid-run on a ticked runner survives save → load with its true start year (CR-01)', () => {
    const r = new SimRunner(3, foodChainMap());
    buildFoodCity(r);
    for (let i = 0; i < 4800; i++) r.tick(); // tick 4800 → year 13
    expect(Math.floor(r.getState().tick / 360)).toBe(13);

    r.startMission('thriving_city'); // timeLimitYears 10 — must count from start
    for (let i = 0; i < 120; i++) r.tick(); // cross a month gate
    expect(r.getMission()!.year).toBe(13);
    expect(r.getMission()!.failed).toBe(false);

    // Load with a FRESH deterministic map (the construction-time contract).
    const loaded = SimRunner.fromSaveData(r.getSaveData(), foodChainMap());
    // The replayed command must restore the TRUE start year (not recompute 0).
    expect(loaded.getMission()!.id).toBe('thriving_city');
    expect(loaded.getMission()!.year).toBe(13);
    for (let i = 0; i < 80; i++) loaded.tick(); // past the next month gate
    expect(loaded.getMission()!.failed).toBe(false); // no instant-fail after load

    // Byte-identical when both continue from the save point.
    const continued = SimRunner.fromSaveData(r.getSaveData(), foodChainMap());
    for (let i = 0; i < 100; i++) { r.tick(); continued.tick(); }
    expect(continued.getStateJson()).toBe(r.getStateJson());
  });

  // Deferred to 17-03-02 (needs winnability probe): per-mission target ceilings.

  it('a dismissed tutorial step stays dismissed through save → load (reconstructed from replay)', () => {
    const r = new SimRunner(11, foodChainMap());
    buildFoodCity(r);
    expect(r.dismissTutorialStep('roads').ok).toBe(true);
    r.tick();

    const loaded = SimRunner.fromSaveData(r.getSaveData(), foodChainMap());
    expect(loaded.getTutorial().dismissed).toContain('roads');
    expect(loaded.getTutorial().current?.step).toBe('housing'); // no re-eligibilize
    // The whole tutorial view is deterministic from state + replayed commands.
    expect(loaded.getTutorial()).toEqual(r.getTutorial());
  });
  // Deferred to 17-02-01 (needs dismissTutorialStep + getTutorial()): a dismissed
  //   step stays dismissed through save → load (reconstructed from replay).

  it('startMission sub-effects replay byte-identically through save→load (T-17-03)', () => {
    const def = MISSIONS['grand_city']!; // map + modifiers + routes + preplace
    const r = new SimRunner(7, missionMap(def)!);
    expect(r.startMission('grand_city').ok).toBe(true);
    for (let i = 0; i < 80; i++) r.tick(); // past a month gate

    const save = r.getSaveData();
    // Load with a FRESH mission map instance (the construction-time contract —
    // missionMap() is pure, so a fresh call yields identical unmutated terrain).
    const loaded = SimRunner.fromSaveData(save, missionMap(def) as SimMap);
    for (let i = 0; i < 20; i++) { r.tick(); loaded.tick(); }

    expect(loaded.getStateJson()).toBe(r.getStateJson());
    expect(loaded.getMission()).toEqual(r.getMission());
    // The sub-effect state is restored from the single {kind:'startMission'} record.
    expect(loaded.getTradeRoutes()['massilia']?.enabled).toBe(true);
    expect(loaded.getTradeRoutes()['tarraco']?.orders?.tools).toBe('export_above_reserve');
  });

  it('a save→load→save cycle does NOT grow saveCommands (no self-duplicated place/openTradeRoute/startMission records)', () => {
    const def = MISSIONS['grand_city']!;
    const r = new SimRunner(7, missionMap(def)!);
    expect(r.startMission('grand_city').ok).toBe(true);
    for (let i = 0; i < 40; i++) r.tick();

    const save1 = r.getSaveData();
    // Only the ONE startMission command is the record (sub-effects suppressed).
    expect(save1.commands).toEqual([{ kind: 'startMission', id: 'grand_city', year: 0 }]);

    const loaded = SimRunner.fromSaveData(save1, missionMap(def) as SimMap);
    const save2 = loaded.getSaveData();
    expect(save2.commands.length).toBeLessThanOrEqual(save1.commands.length);
    // No place/openTradeRoute/setTradeOrder records ever appear for the sub-effects.
    for (const c of save2.commands) {
      expect(c.kind).not.toBe('place');
      expect(c.kind).not.toBe('openTradeRoute');
      expect(c.kind).not.toBe('setTradeOrder');
    }
  });

  it('save → load → save → load preserves the mission (startMission record re-embeds on replay) (CR-02)', () => {
    const def = MISSIONS['grand_city']!;
    const r = new SimRunner(7, missionMap(def)!);
    expect(r.startMission('grand_city').ok).toBe(true);
    for (let i = 0; i < 40; i++) r.tick();

    const save1 = r.getSaveData();
    expect(save1.commands.some((c) => c.kind === 'startMission')).toBe(true);

    const loaded1 = SimRunner.fromSaveData(save1, missionMap(def) as SimMap);
    expect(loaded1.getMission()!.id).toBe('grand_city');
    // A save taken from a LOADED runner must still embed the start-Mission
    // record — otherwise the next load finds no mission at all.
    const save2 = loaded1.getSaveData();
    expect(save2.commands.some((c) => c.kind === 'startMission')).toBe(true);
    expect(save2.commands).toEqual(save1.commands);

    const loaded2 = SimRunner.fromSaveData(save2, missionMap(def) as SimMap);
    expect(loaded2.getMission()).toEqual(loaded1.getMission());
    expect(loaded2.getMission()!.id).toBe('grand_city');
  });

  it('save → load → save → load keeps a dismissed tutorial step dismissed (CR-02)', () => {
    const r = new SimRunner(11, foodChainMap());
    buildFoodCity(r);
    expect(r.dismissTutorialStep('roads').ok).toBe(true);
    r.tick();

    const save1 = r.getSaveData();
    const loaded1 = SimRunner.fromSaveData(save1, foodChainMap());
    expect(loaded1.getTutorial().dismissed).toContain('roads');

    const save2 = loaded1.getSaveData();
    expect(save2.commands.some((c) => c.kind === 'dismissTutorialStep')).toBe(true);

    const loaded2 = SimRunner.fromSaveData(save2, foodChainMap());
    expect(loaded2.getTutorial().dismissed).toContain('roads');
    expect(loaded2.getTutorial().current?.step).toBe('housing'); // still no re-eligibilize
    expect(loaded2.getTutorial()).toEqual(loaded1.getTutorial());
  });
});

describe('no Math.random / wall-clock in the Phase 17 sim chain (determinism audit)', () => {
  it('campaign.ts and missionMaps.ts introduce no Math.random()/Date.now()/new Date() invocations', () => {
    const root = join(__dirname, '..', '..', 'src');
    for (const file of ['campaign.ts', 'missionMaps.ts']) {
      const src = readFileSync(join(root, 'sim', file), 'utf8');
      expect(/Math\.random\s*\(/.test(src), `${file} uses Math.random`).toBe(false);
      expect(/Date\.now\s*\(/.test(src), `${file} uses Date.now`).toBe(false);
      expect(/new\s+Date\s*\(/.test(src), `${file} uses new Date`).toBe(false);
    }
  });

  it('runner.ts has exactly one Date.now — the save-serialization savedAt timestamp', () => {
    const src = readFileSync(join(__dirname, '..', '..', 'src', 'sim', 'runner.ts'), 'utf8');
    expect(src.includes('savedAt: Date.now')).toBe(true);
    const matches = src.match(/Date\.now\s*\(/g) ?? [];
    expect(matches.length).toBe(1);
  });
});
