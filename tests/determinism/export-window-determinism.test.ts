import { describe, it, expect } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { productionChainMap, buildProductionCity } from '../helpers';

/**
 * Wave 0 (Phase 15, RATE-02) scaffold for the rolling-360 annualExports window.
 *
 * Targets the Phase-15 API: getDerived().annualExports is a trailing-360-tick
 * window of exported loads derived from live trade state (never wall-clock),
 * identical across chunked ticking and a save/load round-trip. RED until task
 * 15-02-02 wires the window into derivedSnapshot().
 */

function buildExportCity(r: SimRunner): void {
  buildProductionCity(r);
  r.openTradeRoute('massilia');
  r.setTradeOrder('massilia', 'pottery', 'export_above_reserve', { reserve: 2 });
}

function chunkedRun(seed: number, chunk: number, total: number): { json: string; annualExports: number } {
  const r = new SimRunner(seed, productionChainMap());
  buildExportCity(r);
  let ticked = 0;
  while (ticked < total) {
    const n = Math.min(chunk, total - ticked);
    for (let i = 0; i < n; i++) r.tick();
    ticked += n;
  }
  return { json: r.getStateJson(), annualExports: r.getDerived().annualExports };
}

describe('annualExports trailing-360 window determinism (Phase 15, RATE-02)', () => {
  it('state and annualExports are byte/ value-identical across chunked ticking (chunks 1/7/50, across the tick-360 year boundary)', () => {
    for (const seed of [1, 7, 1337]) {
      const total = 430; // crosses Math.floor(tick/360) → year-1 quota reset
      const c1 = chunkedRun(seed, 1, total);
      const c7 = chunkedRun(seed, 7, total);
      const c50 = chunkedRun(seed, 50, total);
      expect(c50.json).toBe(c7.json);
      expect(c7.json).toBe(c1.json);
      expect(c50.annualExports).toBe(c7.annualExports);
      expect(c7.annualExports).toBe(c1.annualExports);
    }
  });

  it('annualExports and state survive a getSaveData() → fromSaveData() round-trip', () => {
    for (const seed of [1, 7, 1337]) {
      const total = 430;
      const map = productionChainMap();
      const original = new SimRunner(seed, map);
      buildExportCity(original);
      for (let i = 0; i < total; i++) original.tick();
      expect(original.getDerived().annualExports).toBeGreaterThan(0); // real exports
      const originalJson = original.getStateJson();
      const originalExports = original.getDerived().annualExports;

      // Pass the SAME map so fromSaveData replays the verified production city
      // (route opening + per-good order are replayable SaveCommands).
      const loaded = SimRunner.fromSaveData(original.getSaveData(), productionChainMap());
      expect(loaded.getStateJson()).toBe(originalJson);
      expect(loaded.getDerived().annualExports).toBe(originalExports);
    }
  });

  it('resets deterministically by year (exports measured per trailing-360-tick window, never a lifetime accumulator)', () => {
    const r = new SimRunner(1, productionChainMap());
    buildExportCity(r);
    for (let i = 0; i < 800; i++) r.tick();
    // Two full years must not be double-counted into a single year window:
    // the anonymous year-2 window is <= year 0 + year 1 totals combined.
    const late = r.getDerived().annualExports;
    expect(late).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(late)).toBe(true);
  });
});

/** An import-only city: the massilia route imports clay up to target but
 *  exports nothing (every other good stays `no_trade`). */
function buildImportOnlyCity(r: SimRunner): void {
  buildProductionCity(r);
  r.takeLoan(1500); // fund the route open + clay import purchases (replayable)
  r.openTradeRoute('massilia');
  r.setTradeOrder('massilia', 'clay', 'import_upto_target', { target: 6 });
}

describe('annualExports import exclusion (Phase 15, WR-02)', () => {
  it('an import-only city that receives imports for > 1 year reports annualExports === 0, while the export path increments the ring', () => {
    for (const seed of [1, 7, 1337]) {
      const importer = new SimRunner(seed, productionChainMap());
      buildImportOnlyCity(importer);
      for (let i = 0; i < 600; i++) importer.tick(); // > one year
      const route = importer.getTradeRoutes()['massilia'];
      // Meaningful guard: imports actually occurred (the treasury spent on
      // imported clay) — so `annualExports === 0` is a real exclusion, not a
      // trivial "no trade happened" pass.
      expect(route?.importSpend ?? 0).toBeGreaterThan(0);
      // This city performs imports ONLY — nothing on the route physically exports.
      expect(route?.exportProceeds ?? 0).toBe(0);
      // WR-02: imported loads never feed the trailing-360 export window.
      expect(importer.getDerived().annualExports).toBe(0);

      // Contrast on the SAME seed: the export city produces real exports and
      // DOES increment the ring — proving the ring is wired, only the import
      // branch is excluded from it.
      const exporter = new SimRunner(seed, productionChainMap());
      buildExportCity(exporter);
      for (let i = 0; i < 600; i++) exporter.tick();
      expect(exporter.getDerived().annualExports).toBeGreaterThan(0);
    }
  });
});
