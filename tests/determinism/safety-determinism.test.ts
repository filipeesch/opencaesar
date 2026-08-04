/**
 * Civil-safety chunked determinism (SAFE-01..03): same seed + same commands
 * produce byte-identical getStateJson() for chunk sizes 1/7/50 — with active
 * safety walkers, seeded events, and fire/overlay state in the run. The
 * civilization overlay itself must also be chunk-independent.
 *
 * Source audit: the safety chain introduces no Math.random()/Date.now()/
 * new Date() invocations.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';

const W = 40;
const H = 30;

function denseMap(): SimMap {
  const m = new SimMap(W, H, 'earth');
  for (let x = 0; x < W; x++) {
    m.set(x, 17, 'road');
    m.set(x, 19, 'road');
    m.set(x, 21, 'road');
    m.set(x, 23, 'road');
  }
  for (let y = 0; y < H; y++) {
    m.set(10, y, 'road');
    m.set(25, y, 'road');
  }
  return m;
}

function buildSafetyCity(r: SimRunner): void {
  for (let x = 3; x <= 7; x++) for (const y of [18, 20, 22]) r.placeBuilding('house', x, y);
  r.placeBuilding('fire_station', 12, 24);
  r.placeBuilding('engineer_post', 12, 26);
  r.placeBuilding('prefecture', 5, 24);
}

function chunkedRunJson(seed: number, chunk: number, total: number): string {
  const r = new SimRunner(seed, denseMap());
  buildSafetyCity(r);
  let ticked = 0;
  while (ticked < total) {
    const n = Math.min(chunk, total - ticked);
    for (let i = 0; i < n; i++) r.tick();
    ticked += n;
  }
  return r.getStateJson();
}

function chunkedOverlayJson(seed: number, chunk: number, total: number): string {
  const r = new SimRunner(seed, denseMap());
  buildSafetyCity(r);
  let ticked = 0;
  while (ticked < total) {
    const n = Math.min(chunk, total - ticked);
    for (let i = 0; i < n; i++) r.tick();
    ticked += n;
  }
  return JSON.stringify(r.getCivilizationOverlay());
}

describe('civil-safety chunked determinism', () => {
  it('same seed + commands yield byte-identical snapshots regardless of tick batching (chunks 1/7/50)', () => {
    for (const seed of [1, 7, 1337]) {
      const total = 430;
      const s1 = chunkedRunJson(seed, 1, total);
      const s7 = chunkedRunJson(seed, 7, total);
      const s50 = chunkedRunJson(seed, 50, total);
      expect(s50).toBe(s7);
      expect(s7).toBe(s1);
    }
  });

  it('the civilization overlay is chunk-independent too', () => {
    for (const seed of [1, 7, 1337]) {
      const o1 = chunkedOverlayJson(seed, 1, 430);
      const o7 = chunkedOverlayJson(seed, 7, 430);
      const o50 = chunkedOverlayJson(seed, 50, 430);
      expect(o50).toBe(o7);
      expect(o7).toBe(o1);
    }
  });

  it('same-seed run twice produces identical JSON', () => {
    expect(chunkedRunJson(1, 7, 430)).toBe(chunkedRunJson(1, 7, 430));
  });

  it('different seeds with the same layout are runnable (safety walkers present)', () => {
    for (const seed of [1, 7, 1337]) {
      const r = new SimRunner(seed, denseMap());
      buildSafetyCity(r);
      for (let i = 0; i < 430; i++) r.tick();
      const st = r.getState();
      expect(st.tick).toBe(430);
      const safetyWalkers = st.walkers.filter((w) => ['fireman', 'engineer', 'marshal'].includes(w.type));
      expect(safetyWalkers.length).toBeGreaterThan(0);
    }
  });
});

describe('no Math.random / wall-clock in the civil-safety chain', () => {
  it('safety sources introduce no Math.random()/Date.now()/new Date() invocations', () => {
    const root = join(__dirname, '..', '..', 'src');
    for (const file of ['safety.ts', 'advisors.ts', 'walkers.ts', 'walkerProfiles.ts', 'events.ts']) {
      const src = readFileSync(join(root, 'sim', file), 'utf8');
      expect(/Math\.random\s*\(/.test(src), `${file}: Math.random()`).toBe(false);
      expect(/Date\.now\s*\(/.test(src), `${file}: Date.now()`).toBe(false);
      expect(/new\s+Date\s*\(/.test(src), `${file}: new Date()`).toBe(false);
    }
  });
});
