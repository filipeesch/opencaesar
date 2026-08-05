import { describe, it, expect } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import type { Map } from '../../src/sim/map';
import { place, foodChainMap } from '../helpers';

/**
 * UI-03 — SimRunner.getWaterOverlay() (Phase 18, Wave 0 scaffold).
 *
 * Written against the TARGET surface: the runner getter aggregates ALL live
 * well/fountain sources (never find()-first), returns width×height grids with
 * the unwired aqueduct/reservoir systems reading zero, never emits the `grand`
 * water class (3), and is fully deterministic. The target getter lands in
 * 18-03-01; the helper below casts to the seam so the scaffold typechecks now.
 */
type WaterOverlayRunner = {
  getWaterOverlay(): Record<string, number[][]>;
};

function getWaterOverlay(r: SimRunner): Record<string, number[][]> {
  return (r as unknown as WaterOverlayRunner).getWaterOverlay();
}

/** Roads across two rows so wells/fountains all sit road-adjacent. */
function waterMap(): Map {
  return foodChainMap();
}

function buildWellsAndFountain(r: SimRunner): void {
  for (let x = 0; x < 12; x++) {
    place(r, 'road', x, 0);
    place(r, 'road', x, 2);
  }
  place(r, 'well', 1, 1);
  place(r, 'well', 8, 1);
  place(r, 'fountain', 5, 1);
  for (let i = 0; i < 10; i++) r.tick();
}

describe('water overlay runner getter (UI-03)', () => {
  it('aggregates ALL well/fountain sources — both wells painted, not first-only', () => {
    const r = new SimRunner(7, waterMap());
    buildWellsAndFountain(r);
    const overlay = getWaterOverlay(r);
    // Each of the two wells must paint its own source tile (aggregation).
    expect(overlay.wellCoverage[1][1]).toBe(1);
    expect(overlay.wellCoverage[8][1]).toBe(1);
    expect(overlay.wellCoverage.length).toBe(12);
    // The fountain paints its source tile in the fountain grid.
    expect(overlay.fountainCoverage[1][5]).toBe(1);
  });

  it('every returned grid is width×height of the state, including rows/cols', () => {
    const r = new SimRunner(7, waterMap());
    buildWellsAndFountain(r);
    const overlay = getWaterOverlay(r);
    const state = r.getState();
    for (const [key, grid] of Object.entries(overlay)) {
      expect(grid.length, `grid ${key} height`).toBe(state.height);
      for (const row of grid) expect(row.length, `grid ${key} row width`).toBe(state.width);
    }
  });

  it('unwired aqueduct/reservoir grids are all-zero across the whole map', () => {
    const r = new SimRunner(7, waterMap());
    buildWellsAndFountain(r);
    const overlay = getWaterOverlay(r);
    for (const key of ['aqueductPresent', 'aqueductFlow', 'reservoirFilled', 'reservoirLevel']) {
      for (const row of overlay[key]) {
        for (const v of row) expect(v).toBe(0);
      }
    }
  });

  it('house water class never emits grand (3)', () => {
    const r = new SimRunner(7, waterMap());
    buildWellsAndFountain(r);
    const overlay = getWaterOverlay(r);
    for (const row of overlay.houseWaterClass) {
      for (const v of row) expect(v).toBeLessThanOrEqual(2);
    }
  });

  it('is deterministic — two identical runners return identical overlays', () => {
    const r1 = new SimRunner(7, waterMap());
    buildWellsAndFountain(r1);
    const r2 = new SimRunner(7, waterMap());
    buildWellsAndFountain(r2);
    expect(JSON.stringify(getWaterOverlay(r1))).toBe(JSON.stringify(getWaterOverlay(r2)));
  });

  it('derived water % agrees with the aggregated overlay coverage (multi-source)', () => {
    // The overlay counts every well-covered tile; derived.water must aggregate
    // ALL sources too (not the throwaway first-well find()). After 18-03-01 they
    // agree; before it, derived counts only one well → RED.
    const r = new SimRunner(7, waterMap());
    buildWellsAndFountain(r);
    const wellCovered = getWaterOverlay(r).wellCoverage
      .map((row) => row.reduce((a: number, v: number) => a + v, 0))
      .reduce((a: number, v: number) => a + v, 0);
    expect(r.getDerived().water.coveredTiles).toBe(wellCovered);
    expect(r.getDerived().water.coveredTiles).toBeGreaterThan(0);
  });
});
