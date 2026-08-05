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

  // Deferred to 17-01-03 (needs missionMaps.ts + per-mission sub-effects):
  //   - a mission with map/modifiers/routes: save → load → save reproduces the
  //     exact treasury/buildings/routes and does NOT grow saveCommands (the
  //     single {kind:'startMission'} record is the complete deterministic
  //     record — T-17-03 command-bloat).
  // Deferred to 17-02-01 (needs dismissTutorialStep + getTutorial()):
  //   - after dismissTutorialStep(step), save → load keeps the step dismissed
  //     (dismissed set reconstructs from replayed commands — never SaveData).
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
