/**
 * Chunked-tick determinism for the production chain (Phase 6, decision 5).
 * src/sim/production.ts and SimRunner.tickProduction() are RNG/clock-free and
 * iterate buildings in stable placement order, so the same seed, map, and
 * command sequence must produce byte-identical getStateJson() regardless of how
 * ticks are batched (chunk sizes 1/7/50) — mirroring the food-city chunked
 * test in determinism.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { productionChainMap, buildProductionCity } from '../helpers';

function productionRunJson(seed: number, ticks: number): string {
  const r = new SimRunner(seed, productionChainMap());
  buildProductionCity(r);
  r.setPolicy(0, 0.5);
  for (let i = 0; i < ticks; i++) r.tick();
  return r.getStateJson();
}

/** Place the production-city core on a seed-generated map (central area that
 *  open earth placement leaves open for seed 4 on the default 40x40 map). */
function buildProductionOnGenerated(r: SimRunner): void {
  for (let x = 18; x <= 29; x++) {
    r.placeBuilding('road', x, 20);
    r.placeBuilding('road', x, 23);
  }
  for (let x = 18; x <= 23; x++) r.placeBuilding('road', x, 25);
  r.placeBuilding('road', 25, 21);
  r.placeBuilding('road', 25, 22);
  r.placeBuilding('road', 25, 24);
  r.placeBuilding('clay_pit', 18, 21);
  r.placeBuilding('pottery_workshop', 21, 21);
  r.placeBuilding('warehouse', 27, 21);
  for (let x = 18; x <= 24; x += 2) r.placeBuilding('house', x, 24);
  for (let x = 18; x <= 22; x += 2) r.placeBuilding('house', x, 26);
}

describe('production chain determinism (decision 5)', () => {
  it('same seed and command sequence produce byte-identical snapshots', () => {
    expect(productionRunJson(1234, 600)).toBe(productionRunJson(1234, 600));
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

  it('different seeds produce runnable, non-crashing state (divergence comes from shared sim systems, not production)', () => {
    // production.ts and tickProduction are RNG/clock-free; the walker/labor
    // systems use the seeded RNG, so seeds may diverge there — but both runs
    // must complete and serialize without failure.
    const a = JSON.parse(productionRunJson(1, 600));
    const b = JSON.parse(productionRunJson(2, 600));
    expect(a.tick).toBe(600);
    expect(b.tick).toBe(600);
    expect(Array.isArray(a.buildings)).toBe(true);
    expect(Array.isArray(b.buildings)).toBe(true);
  });

  it('save/load round-trips a production city to byte-identical state', () => {
    // fromSaveData replays onto the seed-regenerated map, so the production
    // city must be scripted over a seed-generated map (no explicit map).
    const r = new SimRunner(4);
    buildProductionOnGenerated(r);
    r.setPolicy(0.1, 0.2);
    for (let i = 0; i < 500; i++) r.tick();
    const original = r.getStateJson();

    const loaded = SimRunner.fromSaveData(r.getSaveData());
    expect(loaded.getStateJson()).toBe(original);
  });
});
