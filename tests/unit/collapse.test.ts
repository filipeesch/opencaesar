import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';
import { computeRisks } from '../../src/sim/safety';

/**
 * Structural collapse (SAFE-02): aging buildings risk collapse, earthquakes
 * push old dense buildings into a persistent danger state, and engineer
 * walkers repair dangerous buildings. Seed 777 fires an earthquake at ~tick
 * 799 (age ~20 months) while a covering fire station keeps fire damage out of
 * the picture.
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

function dangerHistory(seed: number, engineerPost: boolean, ticks: number): {
  firstDangerTick: number;
  cleared: number;
  dangerAtEnd: number;
} {
  const r = new SimRunner(seed, denseMap());
  buildDenseCity(r);
  r.placeBuilding('fire_station', 5, 24);
  if (engineerPost) r.placeBuilding('engineer_post', 12, 24);
  let firstDangerTick = -1;
  let cleared = 0;
  const prev = new Set<string>();
  for (let i = 0; i < ticks; i++) {
    r.tick();
    const ov = r.getCivilizationOverlay().danger;
    const cur = new Set<string>();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ov[y][x] === 1) cur.add(`${x},${y}`);
    if (cur.size > 0 && firstDangerTick < 0) firstDangerTick = i;
    for (const k of prev) if (!cur.has(k)) cleared++;
    prev.clear();
    for (const k of cur) prev.add(k);
  }
  return { firstDangerTick, cleared, dangerAtEnd: prev.size };
}

describe('collapse risk model (SAFE-02)', () => {
  it('collapse risk rises with age and falls with engineer coverage', () => {
    const young = computeRisks({ density: 0, ageMonths: 10, fireCoverage: 0, engineerCoverage: 0, securityCoverage: 0 });
    const old = computeRisks({ density: 0, ageMonths: 200, fireCoverage: 0, engineerCoverage: 0, securityCoverage: 0 });
    const inspected = computeRisks({ density: 0, ageMonths: 200, fireCoverage: 0, engineerCoverage: 1, securityCoverage: 0 });
    expect(old.collapseRisk).toBeGreaterThan(young.collapseRisk);
    expect(inspected.collapseRisk).toBeLessThan(old.collapseRisk);
  });

  it('an earthquake pushes aged dense housing into a persistent danger state', () => {
    const h = dangerHistory(777, false, 1600);
    // Danger appears with the earthquake (~tick 799) and persists un-repaired.
    expect(h.firstDangerTick).toBeGreaterThan(700);
    expect(h.firstDangerTick).toBeLessThan(900);
    expect(h.cleared).toBe(0);
    expect(h.dangerAtEnd).toBeGreaterThanOrEqual(5);
  });

  it('engineers walking the roads repair dangerous buildings', () => {
    const repaired = dangerHistory(777, true, 1600);
    const bare = dangerHistory(777, false, 1600);
    // At least one dangerous building was repaired (danger 1 → 0)…
    expect(repaired.cleared).toBeGreaterThanOrEqual(1);
    // …and the city ends up with fewer dangerous buildings than unprotected.
    expect(repaired.dangerAtEnd).toBeLessThan(bare.dangerAtEnd);
  });
});
