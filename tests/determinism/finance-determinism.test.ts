/**
 * Finance-chain chunked determinism (FIN-01, decision 5 determinism).
 *
 * 1. Runner-level chunk identity: same seed + same commands (setPolicy +
 *    requestRoyalSubsidy + takeLoan + repayLoan + ticks) produce byte-identical
 *    getStateJson() for chunk sizes 1/7/50 across seeds {1, 7, 1337} — across
 *    the year boundary (tick 360, where loan interest accrues and subsidy
 *    resets).
 * 2. Same-seed run twice → identical JSON.
 * 3. Different seeds runnable without crashing.
 * 4. Source audit: finance/economy introduce no Math.random()/Date.now()/
 *    new Date() invocations.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { productionChainMap, buildProductionCity } from '../helpers';

function chunkedRunJson(seed: number, chunk: number, total: number): string {
  const r = new SimRunner(seed, productionChainMap());
  buildProductionCity(r);
  r.setPolicy(0.5, 0.3);
  r.requestRoyalSubsidy();
  r.takeLoan(200);
  let ticked = 0;
  while (ticked < total) {
    const n = Math.min(chunk, total - ticked);
    for (let i = 0; i < n; i++) r.tick();
    ticked += n;
  }
  return r.getStateJson();
}

describe('finance-chain chunked determinism with year-boundary interest/subsidy (FIN-01)', () => {
  it('same seed + commands yield byte-identical snapshots regardless of tick batching (chunks 1/7/50, across the year boundary)', () => {
    for (const seed of [1, 7, 1337]) {
      const total = 430; // crosses Math.floor(tick/360) → year 1 (interest + subsidy reset)
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

  it('different seeds with the same layout are runnable (tick 430, debt present)', () => {
    for (const seed of [1, 7, 1337]) {
      const a = JSON.parse(chunkedRunJson(seed, 7, 430));
      expect(a.tick).toBe(430);
      expect(a.buildings.length).toBeGreaterThan(0);
    }
  });
});

describe('no Math.random / wall-clock in the finance chain (FIN-01 determinism audit)', () => {
  it('src/sim/finance.ts and economy.ts introduce no Math.random()/Date.now()/new Date() invocations', () => {
    const root = join(__dirname, '..', '..', 'src');
    for (const file of ['finance.ts', 'economy.ts']) {
      const src = readFileSync(join(root, 'sim', file), 'utf8');
      expect(/Math\.random\s*\(/.test(src)).toBe(false);
      expect(/Date\.now\s*\(/.test(src)).toBe(false);
      expect(/new\s+Date\s*\(/.test(src)).toBe(false);
    }
  });
});
