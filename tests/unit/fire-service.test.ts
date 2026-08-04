import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';
import { computeRisks } from '../../src/sim/safety';

/**
 * Fire service (SAFE-01): density raises fire risk, coverage lowers it,
 * buildings catch fire during city fire events, stations prevent ignition,
 * and fireman walkers actively extinguish burning buildings.
 *
 * Layout: a dense 3x5 housing block (rows 18/20/22, roads between) with
 * vertical road connectors. No food/water — housing stays at tier 0, which is
 * irrelevant to fire. Events are seeded, so every scenario is deterministic.
 */

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

function buildDenseCity(r: SimRunner): void {
  for (let x = 3; x <= 7; x++) for (const y of [18, 20, 22]) r.placeBuilding('house', x, y);
}

/** Run ticks and record per-tile fire-grid history. */
function fireHistory(seed: number, station: 'none' | 'far' | 'cover', ticks: number): {
  maxFire: number;
  burningTiles: Set<string>;
  destroyedTiles: Set<string>;
  extinguishTransitions: Set<string>;
} {
  const r = new SimRunner(seed, denseMap());
  buildDenseCity(r);
  if (station === 'far') r.placeBuilding('fire_station', 12, 24);
  if (station === 'cover') r.placeBuilding('fire_station', 5, 24);
  let maxFire = 0;
  const burningTiles = new Set<string>();
  const destroyedTiles = new Set<string>();
  const extinguishTransitions = new Set<string>();
  let prev: Record<string, number> = {};
  for (let i = 0; i < ticks; i++) {
    r.tick();
    const ov = r.getCivilizationOverlay().fire;
    const cur: Record<string, number> = {};
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = ov[y][x];
        const k = `${x},${y}`;
        if (v > 0) cur[k] = v;
        if (v > maxFire) maxFire = v;
        if (v === 0.9) burningTiles.add(k);
        if (v === 1) destroyedTiles.add(k);
        if (prev[k] === 0.9 && v === 0) extinguishTransitions.add(k);
      }
    }
    prev = cur;
  }
  return { maxFire, burningTiles, destroyedTiles, extinguishTransitions };
}

describe('fire risk model (SAFE-01)', () => {
  it('fire risk rises with density', () => {
    const sparse = computeRisks({ density: 0.2, ageMonths: 0, fireCoverage: 0, engineerCoverage: 0, securityCoverage: 0 });
    const dense = computeRisks({ density: 0.8, ageMonths: 0, fireCoverage: 0, engineerCoverage: 0, securityCoverage: 0 });
    expect(dense.fireRisk).toBeGreaterThan(sparse.fireRisk);
  });

  it('fire coverage lowers fire risk', () => {
    const bare = computeRisks({ density: 1, ageMonths: 0, fireCoverage: 0, engineerCoverage: 0, securityCoverage: 0 });
    const protected_ = computeRisks({ density: 1, ageMonths: 0, fireCoverage: 1, engineerCoverage: 0, securityCoverage: 0 });
    expect(protected_.fireRisk).toBeLessThan(bare.fireRisk);
  });

  it('unprotected fires destroy buildings; no fireman ever extinguishes them', () => {
    const h = fireHistory(1, 'none', 1000);
    // City fire events ignite dense housing and destroy it.
    expect(h.destroyedTiles.size).toBeGreaterThanOrEqual(3);
    expect(h.maxFire).toBe(1);
    // Without any brigade response, a burning building always burns out.
    expect(h.extinguishTransitions.size).toBe(0);
  });

  it('fireman walkers extinguish burning buildings before they burn out', () => {
    const withFiremen = fireHistory(1, 'far', 1000);
    // Firemen patrolling from a nearby (but non-covering) station douse fires.
    expect(withFiremen.extinguishTransitions.size).toBeGreaterThanOrEqual(1);
    // The brigade saves buildings: fewer end up destroyed than unprotected.
    const none = fireHistory(1, 'none', 1000);
    expect(withFiremen.destroyedTiles.size).toBeLessThan(none.destroyedTiles.size);
  });

  it('a fire station covering the neighborhood prevents ignition entirely', () => {
    const h = fireHistory(1, 'cover', 1000);
    expect(h.maxFire).toBe(0);
    expect(h.burningTiles.size).toBe(0);
    expect(h.destroyedTiles.size).toBe(0);
  });
});
