/**
 * Governance & requests chunked determinism (Phase 14, GOV-01/GOV-02).
 *
 * Determinism contract (same as Phase 13 festivals): with a fixed seed + fixed
 * command sequence, byte-identical getStateJson() regardless of how ticks are
 * batched (chunks 1/7/50). The run exercises governor salary, donations, and
 * deterministic request delivery (payRequest + deliverGoods) so every Project
 * Write surface used by government/requests is covered.
 *
 * Save→load: fromSaveData replays the recorded commands (salary/donation) which
 * are tick-0-valid, then ticks — so a save taken after the command set
 * round-trips to an identical state. Request arrivals/expiries are derived from
 * seed+tick (no commands), matching the established chunked-determinism proof
 * for time-coupled mechanics.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';

function govMap(): SimMap {
  const W = 34;
  const m = SimMap.fromLayout(W, W, () => 'fertile');
  for (const y of [0, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29]) {
    const maxX = y === 3 || y === 5 ? 17 : W;
    for (let x = 0; x < maxX; x++) m.set(x, y, 'road');
  }
  for (const y of [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28]) m.set(7, y, 'road');
  return m;
}

function buildGovCity(r: SimRunner): void {
  r.requestRoyalSubsidy();
  for (let i = 0; i < 9; i++) r.takeLoan(2000);
  r.placeBuilding('farm', 0, 1);
  r.placeBuilding('granary', 2, 1);
  r.placeBuilding('market', 4, 1);
  for (const y of [4, 8, 12, 16, 20, 24, 28]) {
    for (let x = 0; x < (y === 4 ? 17 : 34); x++) r.placeBuilding('house', x, y);
  }
  for (const [t, x, y] of [['forum', 18, 1], ['senate', 22, 1], ['palatine', 26, 1]] as const) {
    const res = r.placeBuilding(t, x, y);
    if (!res.ok) throw new Error(`place ${t}: ${JSON.stringify(res)} pop=${r.getPopulation()}`);
  }
}

function chunkedGovRun(seed: number, chunk: number, total: number, deliver = false): string {
  const r = new SimRunner(seed, govMap());
  buildGovCity(r);
  r.setGovernorSalaryLevel(2);
  r.donateToGovernor(50);
  r.setPolicy(0.10, 0.135);
  let ticked = 0;
  while (ticked < total) {
    const n = Math.min(chunk, total - ticked);
    for (let i = 0; i < n; i++) r.tick();
    ticked += n;
    const t = r.getState().tick;
    // Deterministic player deliveries at fixed month ticks (seed 42 yields a
    // tax_tithe; seed 7 yields grain_delivery@480).
    if (t === 160 || t === 280) {
      const tithe = r.getRequests().active.find((a) => a.requestId === 'tax_tithe');
      if (tithe) r.payRequest(tithe.id, 50);
    }
    if (deliver && t === 480) {
      const grain = r.getRequests().active.find((a) => a.requestId === 'grain_delivery');
      if (grain) r.deliverGoods(grain.id, 'wheat', 30);
    }
  }
  return r.getStateJson();
}

describe('governance + requests chunked determinism (Phase 14)', () => {
  it('same seed + commands yield byte-identical snapshots regardless of tick batching (chunks 1/7/50)', () => {
    for (const seed of [1, 7, 1337]) {
      const a = chunkedGovRun(seed, 1, 460);
      const b = chunkedGovRun(seed, 7, 460);
      const c = chunkedGovRun(seed, 50, 460);
      expect(a, `seed ${seed} chunk 1 vs 7`).toBe(b);
      expect(b, `seed ${seed} chunk 7 vs 50`).toBe(c);
    }
  });

  it('same seed + commands with a goods delivery are byte-identical (seed 7, chunks 1/7/50)', () => {
    const a = chunkedGovRun(7, 1, 560, true);
    const b = chunkedGovRun(7, 7, 560, true);
    const c = chunkedGovRun(7, 50, 560, true);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('different seeds with the same layout diverge (request delivery is seed-dependent)', () => {
    const json1 = chunkedGovRun(42, 7, 460, false);
    const json2 = chunkedGovRun(1337, 7, 460, false);
    expect(json1).not.toBe(json2);
  });

  it('save→load replays governor commands to an identical state', () => {
    // Seed-generated map (no custom layout) so fromSaveData regenerates the
    // identical map and every recorded command replays — matching Phase 13's
    // save→load determinism test and the established repo convention.
    const mk = () => {
      const r = new SimRunner(7);
      const m = r['map'] as unknown as { get(x: number, y: number): string; width: number; height: number };
      r.requestRoyalSubsidy();
      for (let i = 0; i < 10; i++) r.takeLoan(2000);
      for (const y of [2, 8, 14, 20, 26, 32]) {
        for (let x = 0; x < m.width; x++) if (m.get(x, y) !== 'water') r.placeBuilding('road', x, y);
      }
      for (const y of [2, 8, 14, 20, 26, 32]) {
        for (const hy of [y - 1, y + 1]) {
          if (hy < 0 || hy >= m.height) continue;
          for (let x = 0; x < 34; x++) {
            if (m.get(x, hy) === 'water') continue;
            r.placeBuilding('house', x, hy);
          }
        }
      }
      for (const t of ['forum', 'senate', 'palatine'] as const) {
        let done = false;
        for (let y = 0; y < m.height && !done; y++) {
          for (let x = 0; x < m.width && !done; x++) {
            if (m.get(x, y) === 'water') continue;
            if (r.placeBuilding(t, x, y).ok) done = true;
          }
        }
        if (!done) throw new Error(`place ${t} failed (pop ${r.getPopulation()})`);
      }
      r.setGovernorSalaryLevel(2);
      r.donateToGovernor(50);
      r.setPolicy(0.10, 0.135);
      for (let i = 0; i < 160; i++) r.tick();
      return r;
    };
    const r = mk();
    const loaded = SimRunner.fromSaveData(r.getSaveData());
    for (let i = 0; i < 160; i++) loaded.tick();
    for (let i = 0; i < 160; i++) r.tick();
    expect(loaded.getStateJson()).toBe(r.getStateJson());
    expect(loaded.getGovernance()).toEqual(r.getGovernance());
    const kinds = r.getSaveData().commands.map((c) => c.kind);
    expect(kinds).toContain('setGovernorSalaryLevel');
    expect(kinds).toContain('donateToGovernor');
  });
});

describe('no Math.random / wall-clock in the governance + requests chain', () => {
  it('governance, governor, requests sources introduce no Math.random()/Date.now()/new Date() invocations', () => {
    const root = join(__dirname, '..', '..');
    for (const file of ['src/sim/governance.ts', 'src/sim/governor.ts', 'data/requests.ts']) {
      const src = readFileSync(join(root, file), 'utf8');
      expect(/Math\.random\s*\(/.test(src), `${file}: Math.random()`).toBe(false);
      expect(/Date\.now\s*\(/.test(src), `${file}: Date.now()`).toBe(false);
      expect(/new\s+Date\s*\(/.test(src), `${file}: new Date()`).toBe(false);
    }
  });
});
