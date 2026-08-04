/**
 * Religion integration (Phase 13, RELI-01): temple walkers deliver per-god
 * access, live worship rises from coverage, favor tracks worshipped gods,
 * and grand temples boost coverage by the ×2 factor.
 */
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';
import type { BuildingInstance } from '../../src/sim/walkers';

/** Phase 12 civic-city skeleton: 12 houses, food/water chain, plaza roads. */
function baseCity(venues: Array<['temple' | 'grand_temple', number, number, string?]>): SimRunner {
  const m = SimMap.fromLayout(24, 24, () => 'fertile');
  const r = new SimRunner(7, m);
  for (let x = 0; x <= 20; x++) for (const y of [0, 3, 5, 7, 9]) r.placeBuilding('road', x, y);
  for (let x = 0; x <= 20; x++) {
    r['map'].setRoadType(x, 3, 'plaza');
    r['map'].setRoadType(x, 5, 'plaza');
    r['map'].setRoadType(x, 7, 'plaza');
  }
  for (const [x, y] of [[7, 1], [7, 2], [7, 4], [7, 6], [7, 8]]) r.placeBuilding('road', x, y);
  r.placeBuilding('farm', 0, 1);
  r.placeBuilding('granary', 2, 1);
  r.placeBuilding('market', 4, 1);
  r.placeBuilding('well', 0, 6);
  r.placeBuilding('well', 14, 6);
  r.placeBuilding('well', 16, 8);
  for (const x of [0, 2, 4, 6]) r.placeBuilding('house', x, 4);
  for (const x of [0, 2, 4, 6, 8, 10, 12, 14]) r.placeBuilding('house', x, 8);
  r.requestRoyalSubsidy();
  r.tick();
  if (venues.some(([t]) => t === 'grand_temple')) r.takeLoan(2000);
  for (const [type, x, y, god] of venues) {
    const res = r.placeBuilding(type, x, y, god ? { god } : undefined);
    if (!res.ok) throw new Error(`place ${type}@(${x},${y}): ${JSON.stringify(res)}`);
  }
  r.setPolicy(0.10, 0.135);
  return r;
}

function houses(r: SimRunner): BuildingInstance[] {
  return r['buildings'].filter((b: BuildingInstance) => b.type === 'house');
}

function godsWorshipped(r: SimRunner): number {
  return Object.values(r.getDerived().godWorship).filter((v) => v > 0).length;
}

describe('temple walkers deliver per-god worship (RELI-01)', () => {
  it('a temple of ceres gives fresh godAccess and live ceres worship', () => {
    const r = baseCity([['temple', 8, 10, 'ceres']]);
    for (let i = 0; i < 400; i++) r.tick();
    const withAccess = houses(r).filter((b) => (b.house?.godAccess?.['ceres'] ?? 0) > 0);
    expect(withAccess.length).toBeGreaterThan(0);
    const d = r.getDerived();
    expect(d.godWorship['ceres'] ?? 0).toBeGreaterThan(0);
    expect(d.services.religion).toBeGreaterThan(0);
  });

  it('worship is per-god — a ceres temple leaves neptune at zero', () => {
    const r = baseCity([['temple', 8, 10, 'ceres']]);
    for (let i = 0; i < 400; i++) r.tick();
    expect(r.getDerived().godWorship['neptune'] ?? 0).toBe(0);
    expect(godsWorshipped(r)).toBe(1);
  });

  it('five temples of the five gods raise favor to 100', () => {
    const r = baseCity([
      ['temple', 8, 10, 'jupiter'],
      ['temple', 10, 10, 'neptune'],
      ['temple', 12, 10, 'ceres'],
      ['temple', 14, 10, 'bacchus'],
      ['temple', 16, 10, 'mercury'],
    ]);
    for (let i = 0; i < 400; i++) r.tick();
    const d = r.getDerived();
    expect(godsWorshipped(r)).toBe(5);
    expect(d.favor).toBe(100);
  });
});

describe('favor tracks worshipped gods (RELI-01)', () => {
  it('no temples: empty godWorship and baseline favor', () => {
    const r = baseCity([]);
    for (let i = 0; i < 400; i++) r.tick();
    const d = r.getDerived();
    expect(d.godWorship).toEqual({});
    expect(d.services.religion).toBe(0);
    // baseline favor: 10 + 20 − tax×100 with taxRate 0.10 = 20
    expect(d.favor).toBe(20);
  });

  it('one worshipped god raises favor above the no-temple baseline', () => {
    const r = baseCity([['temple', 8, 10, 'ceres']]);
    for (let i = 0; i < 400; i++) r.tick();
    const d = r.getDerived();
    expect(d.favor).toBe(40);
    expect(d.favor).toBeGreaterThan(20);
  });
});

describe('grand temples boost worship (RELI-01)', () => {
  it('a grand temple of a god yields at least as much worship as its temple', () => {
    const temple = baseCity([['temple', 8, 10, 'ceres']]);
    const grand = baseCity([['grand_temple', 8, 10, 'ceres']]);
    for (let i = 0; i < 400; i++) temple.tick();
    for (let i = 0; i < 400; i++) grand.tick();
    const wTemple = temple.getDerived().godWorship['ceres'] ?? 0;
    const wGrand = grand.getDerived().godWorship['ceres'] ?? 0;
    expect(wTemple).toBeGreaterThan(0);
    expect(wGrand).toBeGreaterThan(0);
    // partial coverage → the ×2 factor pushes grand temple worship higher
    expect(wGrand).toBeGreaterThan(wTemple);
  });
});

describe('worship drives aggregate religion coverage (RELI-01)', () => {
  it('the average of the gods approximates the advisor religion value', () => {
    const r = baseCity([
      ['temple', 8, 10, 'jupiter'],
      ['temple', 10, 10, 'neptune'],
    ]);
    for (let i = 0; i < 400; i++) r.tick();
    const d = r.getDerived();
    const avg = Object.values(d.godWorship).reduce((s, v) => s + v, 0) / 5;
    expect(d.services.religion).toBeCloseTo(Math.max(0, Math.min(1, avg)), 6);
  });
});
