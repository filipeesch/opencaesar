/**
 * Religion chunked determinism (Phase 13, RELI-01): same seed + same commands
 * produce byte-identical getStateJson() for chunk sizes 1/7/50 — with temple
 * walkers refreshing per-god access, a grand temple, and a full festival
 * lifecycle (prep → boost window → expiry) inside the run.
 *
 * Source audit: the religion chain introduces no Math.random()/Date.now()/
 * new Date() invocations.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';

function religionMap(): SimMap {
  const m = SimMap.fromLayout(24, 24, () => 'fertile');
  for (let x = 0; x <= 20; x++) for (const y of [0, 3, 5, 7, 9]) m.set(x, y, 'road');
  for (let x = 0; x <= 20; x++) {
    m.setRoadType(x, 3, 'plaza');
    m.setRoadType(x, 5, 'plaza');
    m.setRoadType(x, 7, 'plaza');
  }
  for (const [x, y] of [[7, 1], [7, 2], [7, 4], [7, 6], [7, 8]]) m.set(x, y, 'road');
  return m;
}

function buildReligionCity(r: SimRunner): void {
  r.placeBuilding('farm', 0, 1);
  r.placeBuilding('granary', 2, 1);
  r.placeBuilding('market', 4, 1);
  r.placeBuilding('well', 0, 6);
  r.placeBuilding('well', 14, 6);
  r.placeBuilding('well', 16, 8);
  for (const x of [0, 2, 4, 6]) r.placeBuilding('house', x, 4);
  for (const x of [0, 2, 4, 6, 8, 10, 12, 14]) r.placeBuilding('house', x, 8);
  r.requestRoyalSubsidy();
  r.tick();
  r.placeBuilding('temple', 8, 10, { god: 'ceres' });
  r.takeLoan(2000);
  r.placeBuilding('grand_temple', 2, 10, { god: 'jupiter' });
  r.setPolicy(0.10, 0.135);
  // Festival lifecycle inside the run: prep (1 month) + a 12-month boost window.
  r.holdFestival('small');
}

function chunkedRunJson(seed: number, chunk: number, total: number): string {
  const r = new SimRunner(seed, religionMap());
  buildReligionCity(r);
  let ticked = 0;
  while (ticked < total) {
    const n = Math.min(chunk, total - ticked);
    for (let i = 0; i < n; i++) r.tick();
    ticked += n;
  }
  return r.getStateJson();
}

describe('religion chunked determinism (Phase 13)', () => {
  it('same seed + commands yield byte-identical snapshots regardless of tick batching (chunks 1/7/50)', () => {
    for (const seed of [1, 7, 1337]) {
      const total = 460;
      const s1 = chunkedRunJson(seed, 1, total);
      const s7 = chunkedRunJson(seed, 7, total);
      const s50 = chunkedRunJson(seed, 50, total);
      expect(s50).toBe(s7);
      expect(s7).toBe(s1);
    }
  });

  it('same-seed run twice produces identical JSON', () => {
    expect(chunkedRunJson(1, 7, 460)).toBe(chunkedRunJson(1, 7, 460));
  });

  it('different seeds with the same layout are runnable (temple walkers + festival present)', () => {
    for (const seed of [1, 7, 1337]) {
      const r = new SimRunner(seed, religionMap());
      buildReligionCity(r);
      for (let i = 0; i < 460; i++) r.tick();
      const st = r.getState();
      expect(st.tick).toBe(461);
      const templeWalkers = st.walkers.filter((w) => w.type === 'temple' && w.god);
      expect(templeWalkers.length).toBeGreaterThan(0);
      const d = r.getDerived();
      // 1-month prep (done at tick 40) + 12-month boost window (480 ticks):
      // at tick 460 the window is still active with 80 ticks remaining.
      expect(r.getFestival().boostTier).toBe('small');
      expect(r.getFestival().boostRemaining).toBe(80);
      expect(Object.values(d.godWorship).some((v) => v > 0)).toBe(true);
    }
  });

  it('save→load replays temple placement and the festival command identically', () => {
    // Seed-generated map (no custom layout) so fromSaveData replays onto the
    // identical RNG/map — exercising the real deterministic save/load path.
    const mk = () => {
      const r = new SimRunner(777);
      r.placeBuilding('road', 6, 5);
      r.placeBuilding('road', 7, 5);
      r.placeBuilding('road', 6, 6);
      r.placeBuilding('road', 7, 6);
      r.placeBuilding('road', 6, 7);
      r.placeBuilding('road', 6, 8);
      r.placeBuilding('house', 7, 7);
      r.placeBuilding('temple', 5, 9, { god: 'ceres' });
      r.holdFestival('small');
      for (let i = 0; i < 300; i++) r.tick();
      return r;
    };
    const r = mk();
    const loaded = SimRunner.fromSaveData(r.getSaveData());
    for (let i = 0; i < 300; i++) loaded.tick();
    for (let i = 0; i < 300; i++) r.tick();
    expect(loaded.getStateJson()).toBe(r.getStateJson());
    expect(loaded.getFestival()).toEqual(r.getFestival());
    const placeCmds = r.getSaveData().commands.filter(
      (c): c is Extract<typeof c, { kind: 'place' }> => c.kind === 'place' && c.type === 'temple',
    );
    expect(placeCmds.length).toBe(1);
    expect(placeCmds[0].god).toBe('ceres');
    expect(r.getSaveData().commands.some((c) => c.kind === 'holdFestival' && c.tierId === 'small')).toBe(true);
  });
});

describe('no Math.random / wall-clock in the religion chain', () => {
  it('religion sources introduce no Math.random()/Date.now()/new Date() invocations', () => {
    const root = join(__dirname, '..', '..', 'src');
    for (const file of ['services.ts', 'walkers.ts', 'housing.ts']) {
      const src = readFileSync(join(root, 'sim', file), 'utf8');
      expect(/Math\.random\s*\(/.test(src), `${file}: Math.random()`).toBe(false);
      expect(/Date\.now\s*\(/.test(src), `${file}: Date.now()`).toBe(false);
      expect(/new\s+Date\s*\(/.test(src), `${file}: new Date()`).toBe(false);
    }
    const religion = readFileSync(join(root, '..', 'data', 'religion.ts'), 'utf8');
    expect(/Math\.random\s*\(/.test(religion), 'religion.ts: Math.random()').toBe(false);
    expect(/Date\.now\s*\(/.test(religion), 'religion.ts: Date.now()').toBe(false);
  });
});
