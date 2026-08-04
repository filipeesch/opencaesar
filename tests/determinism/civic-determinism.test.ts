/**
 * Civic wellness chunked determinism (Phase 12, HEAL-01/EDUC-01/ENTR-01):
 * same seed + same commands produce byte-identical getStateJson() for chunk
 * sizes 1/7/50 — with clinic/school/theatre walkers refreshing per-house
 * service flags and civics in the run. getCivicStats() must also be
 * chunk-independent.
 *
 * Source audit: the civic chain introduces no Math.random()/Date.now()/
 * new Date() invocations.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';

function civicMap(): SimMap {
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

function buildCivicCity(r: SimRunner): void {
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
  r.placeBuilding('clinic', 6, 6);
  r.placeBuilding('school', 10, 10);
  r.placeBuilding('theatre', 16, 10);
  r.setPolicy(0.10, 0.135);
}

function chunkedRunJson(seed: number, chunk: number, total: number): string {
  const r = new SimRunner(seed, civicMap());
  buildCivicCity(r);
  let ticked = 0;
  while (ticked < total) {
    const n = Math.min(chunk, total - ticked);
    for (let i = 0; i < n; i++) r.tick();
    ticked += n;
  }
  return r.getStateJson();
}

function chunkedStatsJson(seed: number, chunk: number, total: number): string {
  const r = new SimRunner(seed, civicMap());
  buildCivicCity(r);
  let ticked = 0;
  while (ticked < total) {
    const n = Math.min(chunk, total - ticked);
    for (let i = 0; i < n; i++) r.tick();
    ticked += n;
  }
  return JSON.stringify(r.getCivicStats());
}

describe('civic wellness chunked determinism (Phase 12)', () => {
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

  it('getCivicStats() is chunk-independent too', () => {
    for (const seed of [1, 7, 1337]) {
      const o1 = chunkedStatsJson(seed, 1, 460);
      const o7 = chunkedStatsJson(seed, 7, 460);
      const o50 = chunkedStatsJson(seed, 50, 460);
      expect(o50).toBe(o7);
      expect(o7).toBe(o1);
    }
  });

  it('same-seed run twice produces identical JSON', () => {
    expect(chunkedRunJson(1, 7, 460)).toBe(chunkedRunJson(1, 7, 460));
  });

  it('different seeds with the same layout are runnable (civic walkers present)', () => {
    for (const seed of [1, 7, 1337]) {
      const r = new SimRunner(seed, civicMap());
      buildCivicCity(r);
      for (let i = 0; i < 460; i++) r.tick();
      const st = r.getState();
      expect(st.tick).toBe(461);
      const civicWalkers = st.walkers.filter((w) =>
        ['clinic', 'school', 'theatre', 'hospital', 'amphitheatre'].includes(w.type),
      );
      expect(civicWalkers.length).toBeGreaterThan(0);
      const stats = r.getCivicStats();
      expect(stats.houses.some((h) => h.health > 0)).toBe(true);
      expect(stats.houses.some((h) => h.literacy > 0)).toBe(true);
    }
  });
});

describe('no Math.random / wall-clock in the civic chain', () => {
  it('civic sources introduce no Math.random()/Date.now()/new Date() invocations', () => {
    const root = join(__dirname, '..', '..', 'src');
    for (const file of ['housing.ts', 'walkers.ts', 'walkerProfiles.ts']) {
      const src = readFileSync(join(root, 'sim', file), 'utf8');
      expect(/Math\.random\s*\(/.test(src), `${file}: Math.random()`).toBe(false);
      expect(/Date\.now\s*\(/.test(src), `${file}: Date.now()`).toBe(false);
      expect(/new\s+Date\s*\(/.test(src), `${file}: new Date()`).toBe(false);
    }
  });
});
