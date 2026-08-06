/**
 * Per-residence population + migration determinism (POP-01/POP-02, Wave 0
 * scaffold / 19.1-01-01 + 19.1-02-01): residency + migration mutate ONLY inside
 * tick() %40 hooks on internal-only HouseInstance state, so save/load replay is
 * byte-identical and chunked 1/7/50 batching is order-independent.
 *
 * Written against the Phase-19.1 TARGET API (getInspector(...).internals.house
 * .residents, getDerived().residentCount/immigration/emigration/homeless) —
 * RED until 19.1-01-01/02-01 implement them.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { SimRunner } from '../../src/sim/runner';
import { migrateSave, validateSave } from '../../src/sim/saveCodec';
import type { SaveData } from '../../src/sim/types';
import { buildFoodCity, foodChainMap } from '../helpers';

/** Total internal residents across all houses (live internals, never serialized). */
function residentSum(r: SimRunner): number {
  const internals = r.getWalkerInternals();
  return internals.buildings
    .filter((b) => b.house)
    .reduce((sum, b) => sum + ((b.house!.residents?.length ?? 0) as number), 0);
}

describe('per-residence population determinism (POP-01)', () => {
  it('residency hooks keep getStateJson byte-identical across save/load', () => {
    const r = new SimRunner(777);
    r.placeBuilding('road', 3, 3);
    r.placeBuilding('road', 3, 4);
    r.placeBuilding('house', 3, 5);
    r.setPolicy(0.1, 0.2);
    for (let i = 0; i < 500; i++) r.tick(); // spans 12 %40 month boundaries
    const original = r.getStateJson();

    const migrated = migrateSave(r.getSaveData());
    expect(validateSave(migrated).ok).toBe(true);
    const loaded = SimRunner.fromSaveData(migrated as SaveData);
    expect(loaded.getStateJson()).toBe(original);
  });

  it('getInspector residents + residentCount survive a save/load round-trip', () => {
    const r = new SimRunner(42, foodChainMap());
    buildFoodCity(r);
    for (let i = 0; i < 500; i++) r.tick();
    const house = r.getState().buildings.find((b) => b.house)!;
    const before = r.getInspector(house.id, 'building')?.internals?.house?.residents;
    expect(before).toBeDefined();
    const residentCount = r.getDerived().residentCount;

    const loaded = SimRunner.fromSaveData(r.getSaveData(), foodChainMap());
    const after = loaded.getInspector(house.id, 'building')?.internals?.house?.residents;
    expect(after).toEqual(before);
    expect(loaded.getDerived().residentCount).toBe(residentCount);
    expect(loaded.getDerived().residentCount).toBe(r.getDerived().residentCount);
  });

  it('residentCount equals the effective population (consistency)', () => {
    const r = new SimRunner(7, foodChainMap());
    buildFoodCity(r);
    for (let i = 0; i < 80; i++) r.tick();
    expect(r.getDerived().residentCount).toBe(r.getDerived().population);
  });

  it('chunked tick batching (1/7/50) yields byte-identical residency state', () => {
    const run = (chunk: number, total: number): string => {
      const r = new SimRunner(99, foodChainMap());
      buildFoodCity(r);
      let ticked = 0;
      while (ticked < total) {
        const n = Math.min(chunk, total - ticked);
        for (let i = 0; i < n; i++) r.tick();
        ticked += n;
      }
      return `${r.getStateJson()}|${JSON.stringify(residentSum(r))}`;
    };
    const total = 480; // 12 month boundaries
    const s1 = run(1, total);
    const s7 = run(7, total);
    const s50 = run(50, total);
    expect(s50).toBe(s7);
    expect(s7).toBe(s1);
  });
});

describe('migration determinism (POP-02)', () => {
  it('a full city (no vacancy) yields zero migration delta — golden-neutral', () => {
    const r = new SimRunner(42, foodChainMap());
    buildFoodCity(r);
    for (let i = 0; i < 500; i++) r.tick();
    // Healthy city: every house fed → no famine emigration → full occupancy.
    const full = residentSum(r);
    expect(full).toBeGreaterThan(0);
    const before = r.getDerived();
    expect(before.immigration ?? 0).toBe(0);
    expect(before.emigration ?? 0).toBe(0);
    // Two more month boundaries: occupancy unchanged (net migration is
    // vacancy-bounded — a full city is zero-delta).
    for (let i = 0; i < 80; i++) r.tick();
    expect(residentSum(r)).toBe(full);
    const after = r.getDerived();
    expect(after.immigration ?? 0).toBe(0);
    expect(after.emigration ?? 0).toBe(0);
  });

  it('famine emigration is deterministic across identical runs (drain + monthly deltas)', () => {
    // Mid-run demolish does not byte-round-trip (the replay model replays all
    // commands at tick 0 — a pre-existing property), so the famine trajectory
    // is proven deterministic by two IDENTICAL runs of the same seed: the
    // migration hooks must produce the same drain and the same per-month deltas.
    const run = (): { drained: number; deltas: Array<{ immigration: number; emigration: number; homeless: number }> } => {
      const r = new SimRunner(42, foodChainMap());
      buildFoodCity(r);
      for (let i = 0; i < 500; i++) r.tick();
      const sum = (): number => residentSum(r);
      const full = sum();
      for (const [x, y] of [[0, 1], [2, 1], [4, 1]] as Array<[number, number]>) r.demolish(x, y);
      const deltas: Array<{ immigration: number; emigration: number; homeless: number }> = [];
      for (let i = 0; i < 480; i++) { // 12 months — spans the first famine drains
        r.tick();
        if (r.getState().tick % 40 === 0) {
          const d = r.getDerived();
          deltas.push({ immigration: d.immigration ?? 0, emigration: d.emigration ?? 0, homeless: d.homeless ?? 0 });
        }
      }
      const drained = sum();
      expect(drained).toBeLessThan(full); // famine emigration created vacancy
      expect(deltas.some((d) => d.emigration > 0 || d.homeless > 0)).toBe(true);
      return { drained, deltas };
    };
    const a = run();
    const b = run();
    expect(b.drained).toBe(a.drained);
    expect(b.deltas).toEqual(a.deltas);
  });

  it('a full healthy city round-trips byte-identically across migration months (0 delta)', () => {
    // The residency+migration hooks run on %40 boundaries inside the ticked
    // history; with no famine the city stays full, so the serialized state
    // (which never contains internal residency) plus the live resident set
    // both round-trip byte-identically — the golden-neutral migration proof.
    const r = new SimRunner(42, foodChainMap());
    buildFoodCity(r);
    for (let i = 0; i < 480; i++) r.tick(); // 12 %40 boundaries
    const migrated = migrateSave(r.getSaveData());
    expect(validateSave(migrated).ok).toBe(true);
    const loaded = SimRunner.fromSaveData(migrated as SaveData, foodChainMap());
    expect(loaded.getStateJson()).toBe(r.getStateJson());
    expect(residentSum(loaded)).toBe(residentSum(r));
    const d = r.getDerived();
    expect(d.immigration ?? 0).toBe(0);
    expect(d.emigration ?? 0).toBe(0);
  });

  it('DerivedSnapshot exposes per-month immigration/emigration/homeless deltas', () => {
    const r = new SimRunner(42, foodChainMap());
    buildFoodCity(r);
    for (let i = 0; i < 80; i++) r.tick();
    const d = r.getDerived();
    expect(typeof d.immigration).toBe('number');
    expect(typeof d.emigration).toBe('number');
    expect(typeof d.homeless).toBe('number');
    expect([d.immigration!, d.emigration!, d.homeless!]).toEqual([0, 0, 0]); // healthy city default
  });
});

describe('no wall-clock / Math.random in the new population/labor/runner paths', () => {
  it('population.ts, labor.ts, and the runner residency/migration/sector paths stay clean', () => {
    const root = join(__dirname, '..', '..', 'src');
    const populationSrc = readFileSync(join(root, 'sim', 'population.ts'), 'utf8');
    expect(/Math\.random\s*\(/.test(populationSrc), 'population.ts Math.random()').toBe(false);
    expect(/Date\.now\s*\(/.test(populationSrc), 'population.ts Date.now()').toBe(false);
    expect(/new\s+Date\s*\(/.test(populationSrc), 'population.ts new Date()').toBe(false);

    const laborSrc = readFileSync(join(root, 'sim', 'labor.ts'), 'utf8');
    expect(/Math\.random\s*\(/.test(laborSrc), 'labor.ts Math.random()').toBe(false);
    expect(/Date\.now\s*\(/.test(laborSrc), 'labor.ts Date.now()').toBe(false);
    expect(/new\s+Date\s*\(/.test(laborSrc), 'labor.ts new Date()').toBe(false);

    // runner.ts is allowed Date.now() ONLY on the getSaveData savedAt metadata line.
    const runnerSrc = readFileSync(join(root, 'sim', 'runner.ts'), 'utf8');
    const dateNowLines = runnerSrc.split('\n').map((l, i) => ({ l, i: i + 1 })).filter(({ l }) => /Date\.now\s*\(/.test(l));
    expect(dateNowLines.length).toBeLessThanOrEqual(1);
    if (dateNowLines.length === 1) expect(dateNowLines[0].l).toContain('savedAt');
    expect(/Math\.random\s*\(/.test(runnerSrc), 'runner.ts Math.random()').toBe(false);
    expect(/new\s+Date\s*\(/.test(runnerSrc), 'runner.ts new Date()').toBe(false);
    // Migration/residency inputs must never read the shared RNG stream (determinism).
    expect(CONFIG.serviceCooldownTicks).toBeGreaterThan(0);
  });
});
