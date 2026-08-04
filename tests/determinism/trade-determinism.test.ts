/**
 * Trade-chain chunked determinism (TRAD-01..05, decision 5 determinism).
 *
 * 1. Runner-level chunk identity: same seed + same commands (open route +
 *    export order) produce byte-identical getStateJson() for chunk sizes
 *    1/7/50 across seeds {1, 7, 1337} — including the year-rollover quota
 *    reset (ticks past the tick/360 boundary).
 * 2. Same-seed run twice → identical JSON.
 * 3. Different seeds runnable without crashing.
 * 4. Source audit: trade/transport/walkers/runner contain no
 *    Math.random()/Date.now()/new Date() invocations.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { productionChainMap } from '../helpers';

function chunkedRunJson(seed: number, chunk: number, total: number): string {
  const r = new SimRunner(seed, productionChainMap());
  for (let x = 0; x <= 13; x++) r.placeBuilding('road', x, 0);
  r.placeBuilding('warehouse', 12, 1);
  r.getWalkerInternals().buildings.find((b) => b.type === 'warehouse')!.stock.pottery = 40;
  r.openTradeRoute('massilia');
  r.setTradeOrder('massilia', 'pottery', 'export_above_reserve', { reserve: 2 });
  let ticked = 0;
  while (ticked < total) {
    const n = Math.min(chunk, total - ticked);
    for (let i = 0; i < n; i++) r.tick();
    ticked += n;
  }
  return r.getStateJson();
}

describe('trade-chain chunked determinism with year-rollover quota reset (TRAD-04, decision 5)', () => {
  it('same seed + commands yield byte-identical snapshots regardless of tick batching (chunks 1/7/50, across the year boundary)', () => {
    for (const seed of [1, 7, 1337]) {
      const total = 430; // crosses Math.floor(tick/360) → year 1 quota reset
      const s1 = chunkedRunJson(seed, 1, total);
      const s7 = chunkedRunJson(seed, 7, total);
      const s50 = chunkedRunJson(seed, 50, total);
      expect(s50).toBe(s7);
      expect(s7).toBe(s1);
    }
  });

  it('same-seed run twice produces identical JSON', () => {
    expect(chunkedRunJson(1, 7, 430)).toBe(chunkedRunJson(1, 7, 430));
  });

  it('different seeds with the same layout are runnable (tick 430, route enabled)', () => {
    for (const seed of [1, 7, 1337]) {
      const a = JSON.parse(chunkedRunJson(seed, 7, 430));
      expect(a.tick).toBe(430);
      expect(a.buildings.length).toBeGreaterThan(0);
    }
  });
});

describe('no Math.random / wall-clock in the trade chain (TRAD-01..05 determinism audit)', () => {
  it('trade/transport/walkers introduce no Math.random()/Date.now()/new Date() invocations (runner.ts excluded: its only Date.now is the save-serialization savedAt timestamp, not part of getStateJson)', () => {
    const root = join(__dirname, '..', '..', 'src');
    for (const file of ['trade.ts', 'transport.ts', 'walkers.ts']) {
      const src = readFileSync(join(root, 'sim', file), 'utf8');
      expect(/Math\.random\s*\(/.test(src)).toBe(false);
      expect(/Date\.now\s*\(/.test(src)).toBe(false);
      expect(/new\s+Date\s*\(/.test(src)).toBe(false);
    }
  });
});
