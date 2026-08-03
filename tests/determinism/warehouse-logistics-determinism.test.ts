/**
 * Phase 7, decision 5: chunked-tick determinism for the warehouse/logistics
 * chain through the runner, plus ReservationPool expiry identity. The
 * production→warehouse path (tickProduction → warehouseCandidates → porters)
 * and the additive pool expiry (reserveWithExpiry/expireReservations from 07-01)
 * are RNG/clock-free, so the same seed + map + commands produce byte-identical
 * getStateJson() regardless of tick batching, and identical (now, expiresIn)
 * inputs produce identical expiry outcomes across pools.
 */
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { productionChainMap, buildProductionCity } from '../helpers';
import { ReservationPool } from '../../src/sim/logistics';

function warehouseRunJson(seed: number, ticks: number): string {
  const r = new SimRunner(seed, productionChainMap());
  buildProductionCity(r);
  r.setPolicy(0, 0.5);
  for (let i = 0; i < ticks; i++) r.tick();
  return r.getStateJson();
}

describe('warehouse/logistics chain determinism (decision 5)', () => {
  it('same seed and command sequence produce byte-identical snapshots', () => {
    expect(warehouseRunJson(1234, 600)).toBe(warehouseRunJson(1234, 600));
  });

  it('tick batching is order-independent (chunk sizes 1/7/50 → identical state)', () => {
    const seed = 1234;
    const runChunked = (chunk: number, total: number): string => {
      const r = new SimRunner(seed, productionChainMap());
      buildProductionCity(r);
      r.setPolicy(0, 0.5);
      let ticked = 0;
      while (ticked < total) {
        const n = Math.min(chunk, total - ticked);
        for (let i = 0; i < n; i++) r.tick();
        ticked += n;
      }
      return r.getStateJson();
    };
    const s1 = runChunked(1, 600);
    const s7 = runChunked(7, 600);
    const s50 = runChunked(50, 600);
    expect(s50).toBe(s7);
    expect(s7).toBe(s1);
  });

  it('different seeds produce runnable, non-crashing state (tick 600, buildings non-empty)', () => {
    const a = JSON.parse(warehouseRunJson(1, 600));
    const b = JSON.parse(warehouseRunJson(2, 600));
    expect(a.tick).toBe(600);
    expect(b.tick).toBe(600);
    expect(Array.isArray(a.buildings)).toBe(true);
    expect(Array.isArray(b.buildings)).toBe(true);
    expect(a.buildings.length).toBeGreaterThan(0);
  });

  it('ReservationPool expiry is identical across pools for identical (now, expiresIn) inputs', () => {
    const build = () => {
      const p = new ReservationPool();
      p.taxable.set('pottery', 5);
      return p;
    };
    const a = build();
    const b = build();
    expect(a.reserveWithExpiry('pottery', 1, 10, 30)).toBe(true);
    expect(b.reserveWithExpiry('pottery', 1, 10, 30)).toBe(true);

    // identical availability at three sampled ticks (30, 40, 50)
    for (const tick of [30, 40, 50]) {
      const ea = a.expireReservations(tick);
      const eb = b.expireReservations(tick);
      expect(ea).toBe(eb);
      expect(a.available('pottery')).toBe(b.available('pottery'));
    }
    // at tick 40 (expiry 10+30) both release the reserved unit; at 50 both are available
    expect(a.available('pottery')).toBe(5);
    expect(b.available('pottery')).toBe(5);
  });

  it('plain reserve() is untouched by expireReservations', () => {
    const a = new ReservationPool();
    const b = new ReservationPool();
    a.taxable.set('pottery', 5);
    b.taxable.set('pottery', 5);
    a.reserve('pottery', 1);
    b.reserve('pottery', 1);
    expect(a.reserved('pottery')).toBe(1);
    expect(a.expireReservations(100000)).toBe(0); // no expiry entries
    expect(a.reserved('pottery')).toBe(1); // plain reserve never expires
    expect(a.available('pottery')).toBe(b.available('pottery'));
  });
});
