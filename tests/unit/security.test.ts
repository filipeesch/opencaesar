import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';
import { computeRisks } from '../../src/sim/safety';

/**
 * Civil order (SAFE-03): crime rises with density, prefecture coverage reduces
 * it, and marshal patrols leave a visible calm on the streets they walk. All
 * civic service is peaceful — no attacks.
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

function crimeStats(seed: number, prefecture: 'none' | 'cover' | 'patrol', ticks: number): {
  maxAfterWarmup: number;
  minBottomRow: number;
} {
  const r = new SimRunner(seed, denseMap());
  buildDenseCity(r);
  if (prefecture === 'cover') r.placeBuilding('prefecture', 5, 24);
  if (prefecture === 'patrol') r.placeBuilding('prefecture', 12, 24);
  let maxAfterWarmup = 0;
  let minBottomRow = 1;
  for (let i = 0; i < ticks; i++) {
    r.tick();
    if (i < 300) continue; // staffing warmup: pool builds as labor connects
    const ov = r.getCivilizationOverlay().crime;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = ov[y][x];
        if (v > maxAfterWarmup) maxAfterWarmup = v;
        if (y === 22 && x >= 3 && x <= 7 && v < minBottomRow) minBottomRow = v;
      }
    }
  }
  return { maxAfterWarmup, minBottomRow };
}

describe('crime & security model (SAFE-03)', () => {
  it('crime rises with density and falls with security coverage', () => {
    const bare = computeRisks({ density: 1, ageMonths: 0, fireCoverage: 0, engineerCoverage: 0, securityCoverage: 0 });
    const secured = computeRisks({ density: 1, ageMonths: 0, fireCoverage: 0, engineerCoverage: 0, securityCoverage: 1 });
    expect(secured.crime).toBeLessThan(bare.crime);
  });

  it('dense housing carries visible crime without a prefecture', () => {
    const s = crimeStats(5, 'none', 600);
    expect(s.maxAfterWarmup).toBeGreaterThanOrEqual(0.2);
    expect(s.minBottomRow).toBeGreaterThanOrEqual(0.15);
  });

  it('a prefecture covering the neighborhood suppresses crime', () => {
    const s = crimeStats(5, 'cover', 600);
    expect(s.maxAfterWarmup).toBeLessThanOrEqual(0.01);
  });

  it('marshal patrols leave a calm on the streets they walk', () => {
    const patrolled = crimeStats(5, 'patrol', 600);
    const bare = crimeStats(5, 'none', 600);
    // Marshals patrol the bottom road; the bottom-row houses read calmer than
    // the un-patrolled baseline.
    expect(patrolled.minBottomRow).toBeLessThan(bare.minBottomRow);
    expect(patrolled.minBottomRow).toBeLessThan(0.1);
  });
});
