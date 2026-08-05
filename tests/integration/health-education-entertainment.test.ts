/**
 * Health / Education / Entertainment (Phase 12, HEAL-01/EDUC-01/ENTR-01):
 * civic service buildings deliver access, house civics rise while fresh, and
 * TIER_CIVIC_GATES block evolution without the required service.
 */
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';
import { BUILDINGS } from '../../src/sim/buildings';
import type { BuildingInstance } from '../../src/sim/walkers';

/** Phase 12 civic city: 12 houses on earth, food/water chain, subsidy-funded venues. */
function civicCity(venues: Array<['clinic' | 'school' | 'theatre', number, number]>): SimRunner {
  const m = SimMap.fromLayout(24, 24, (x, y) => ((x === 0 || x === 1) && (y === 1 || y === 2) ? 'fertile' : 'earth'));
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
  for (const x of [0, 2, 4, 6]) r.placeBuilding('house', x, 4);
  for (const x of [0, 2, 4, 6, 8, 10, 12, 14]) r.placeBuilding('house', x, 8);
  r.requestRoyalSubsidy();
  r.tick();
  for (const [type, x, y] of venues) {
    const res = r.placeBuilding(type, x, y);
    if (!res.ok) throw new Error(`place ${type}@(${x},${y}): ${JSON.stringify(res)}`);
  }
  r.setPolicy(0.10, 0.135);
  return r;
}

/** All-fertile civic city: 12 houses, desirability ~100 — tier 3 is reachable. */
function fertileCivicCity(venues: Array<['clinic' | 'school' | 'theatre', number, number]>): SimRunner {
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
  for (const [type, x, y] of venues) {
    const res = r.placeBuilding(type, x, y);
    if (!res.ok) throw new Error(`place ${type}@(${x},${y}): ${JSON.stringify(res)}`);
  }
  r.setPolicy(0.10, 0.135);
  return r;
}

function houses(r: SimRunner): BuildingInstance[] {
  return r['buildings'].filter((b: BuildingInstance) => b.type === 'house');
}

function avgCivic(r: SimRunner, stat: 'health' | 'literacy' | 'entertainment'): number {
  const hs = houses(r).map((b) => b.house!.civic?.[stat] ?? 0);
  return hs.reduce((s, v) => s + v, 0) / hs.length;
}

function maxCivic(r: SimRunner, stat: 'health' | 'literacy' | 'entertainment'): number {
  return Math.max(...houses(r).map((b) => b.house!.civic?.[stat] ?? 0));
}

function maxLevel(r: SimRunner): number {
  return Math.max(...houses(r).map((b) => b.house!.level ?? 0));
}

/**
 * Fertile gate city that can actually climb the 21-level ladder to the
 * clinic-gated rung (level 8, Fair Insulae adds 'clinic'): the food/water
 * goods chain + a stocked warehouse + the pump keep every cumulative
 * requirement satisfied so the ONLY differentiator between the venues is the
 * health (clinic) or literacy (school) gate.
 */
function fertileGateCity(venues: Array<['clinic' | 'school', number, number]>): SimRunner {
  const r = fertileCivicCity(venues);
  // Warehouse (adjacent to road row y=0) for the non-food cumulative goods of
  // levels 0-8 (pottery/furniture/wine); food goods ride the per-house pump.
  const wh = r.placeBuilding('warehouse', 21, 0);
  if (!wh.ok) throw new Error(`place warehouse: ${JSON.stringify(wh)}`);
  const whInst = (r['buildings'] as BuildingInstance[]).find((b) => b.type === 'warehouse')!;
  const stock = whInst.stock as Record<string, number>;
  for (const g of ['pottery', 'furniture', 'wine']) stock[g] = 200;
  return r;
}

function pumpHouses(r: SimRunner, n: number): void {
  for (let i = 0; i < n; i++) {
    for (const b of houses(r)) {
      const h = b.house!;
      h.foodCooldown = 120;
      h.waterCooldown = 120;
      h.laborCooldown = 120;
      h.services = { health: 120, literacy: 120, entertainment: 120 };
      h.foodInventory = { wheat: 50, vegetables: 50, fish: 50 };
    }
    r.tick();
  }
}

describe('clinic delivers health (HEAL-01)', () => {
  it('health rises toward the service while access is fresh', () => {
    const r = civicCity([['clinic', 6, 6], ['school', 12, 10], ['theatre', 16, 10]]);
    for (let i = 0; i < 500; i++) r.tick();
    expect(avgCivic(r, 'health')).toBeGreaterThanOrEqual(40);
    expect(avgCivic(r, 'health')).toBeLessThan(90);
  });

  it('without a clinic every house stays at 0 health', () => {
    const r = civicCity([['school', 12, 10], ['theatre', 16, 10]]);
    for (let i = 0; i < 500; i++) r.tick();
    expect(maxCivic(r, 'health')).toBe(0);
  });

  it('without any venue all civics stay at 0', () => {
    const r = civicCity([]);
    for (let i = 0; i < 500; i++) r.tick();
    for (const b of houses(r)) {
      expect(b.house!.civic?.health ?? 0).toBe(0);
      expect(b.house!.civic?.literacy ?? 0).toBe(0);
      expect(b.house!.civic?.entertainment ?? 0).toBe(0);
    }
  });
});

describe('school and theatre (EDUC-01/ENTR-01)', () => {
  it('literacy rises while school access is fresh', () => {
    const r = civicCity([['clinic', 6, 6], ['school', 12, 10], ['theatre', 16, 10]]);
    for (let i = 0; i < 500; i++) r.tick();
    expect(avgCivic(r, 'literacy')).toBeGreaterThanOrEqual(40);
  });

  it('entertainment rises while theatre access is fresh', () => {
    const r = civicCity([['clinic', 6, 6], ['school', 12, 10], ['theatre', 16, 10]]);
    for (let i = 0; i < 500; i++) r.tick();
    expect(avgCivic(r, 'entertainment')).toBeGreaterThanOrEqual(10);
  });
});

describe('TIER_CIVIC_GATES in a live city (Phase 12)', () => {
  // 21-level gate (Phase 16): the cumulative ladder gates evolution per level.
  // Fair Insulae (level 8) adds 'clinic' over level 7, and Good Insulae (level
  // 9) adds 'library' — so a fully-served city with a clinic reaches level 8,
  // while without the clinic every house is pinned at level 7 (health gate).
  it('health gates Fair Insulae: clinic+school reach level 8', () => {
    const r = fertileGateCity([['clinic', 6, 6], ['school', 10, 10]]);
    pumpHouses(r, 600);
    expect(maxLevel(r)).toBeGreaterThanOrEqual(8);
  });

  it('without a clinic no house reaches the health-gated level 8 (stays at 7)', () => {
    const r = fertileGateCity([['school', 10, 10]]);
    pumpHouses(r, 600);
    expect(maxLevel(r)).toBeLessThanOrEqual(7);
    expect(maxLevel(r)).toBeGreaterThanOrEqual(7);
  });

  it('a clinic alone still lifts houses past the health gate baseline', () => {
    const r = fertileGateCity([['clinic', 6, 6]]);
    pumpHouses(r, 600);
    // The clinic unlocks the health-gated rung only when literacy (school) is
    // also present at level 8; with a clinic alone the city still serves the
    // food/water/fountain ladder well past the unserved floor.
    expect(maxLevel(r)).toBeGreaterThanOrEqual(5);
  });
});

describe('hospital, amphitheatre and colosseum (ENTR-01 catalog)', () => {
  it('BUILDINGS defines the new venues', () => {
    expect(BUILDINGS.hospital).toBeDefined();
    expect(BUILDINGS.amphitheatre).toBeDefined();
    expect(BUILDINGS.colosseum).toBeDefined();
  });

  it('a staffed hospital delivers health like a clinic', () => {
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
    // 15 houses staff the 15-job chain (farm/granary/market/wells/hospital)
    for (const x of [0, 2, 4, 6]) r.placeBuilding('house', x, 4);
    for (const x of [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]) r.placeBuilding('house', x, 8);
    r.requestRoyalSubsidy();
    r.tick();
    expect(r.placeBuilding('hospital', 6, 10).ok).toBe(true);
    r.setPolicy(0.10, 0.135);
    for (let i = 0; i < 500; i++) r.tick();
    expect(avgCivic(r, 'health')).toBeGreaterThanOrEqual(40);
    const hospital = r.getState().buildings.find((b) => b.type === 'hospital');
    expect(hospital?.workersAssigned ?? 0).toBeGreaterThanOrEqual(10);
  });

  it('a staffed amphitheatre delivers entertainment', () => {
    const m = SimMap.fromLayout(24, 24, (x, y) => ((x === 0 || x === 1) && (y === 1 || y === 2) ? 'fertile' : 'earth'));
    const r = new SimRunner(7, m);
    for (let x = 0; x <= 20; x++) for (const y of [0, 3, 5, 7, 9, 11]) r.placeBuilding('road', x, y);
    for (let x = 0; x <= 20; x++) {
      r['map'].setRoadType(x, 3, 'plaza');
      r['map'].setRoadType(x, 5, 'plaza');
      r['map'].setRoadType(x, 7, 'plaza');
    }
    for (const [x, y] of [[7, 1], [7, 2], [7, 4], [7, 6], [7, 8], [20, 10], [20, 11]]) r.placeBuilding('road', x, y);
    r.placeBuilding('farm', 0, 1);
    r.placeBuilding('granary', 2, 1);
    r.placeBuilding('market', 4, 1);
    r.placeBuilding('well', 0, 6);
    r.placeBuilding('well', 14, 6);
    // 25 houses staff the 25-job chain (farm/granary/market/wells/amphitheatre)
    for (const x of [0, 2, 4, 6]) r.placeBuilding('house', x, 4);
    for (const x of [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]) r.placeBuilding('house', x, 8);
    for (const x of [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]) r.placeBuilding('house', x, 10);
    r.requestRoyalSubsidy();
    r.takeLoan(1000);
    r.tick();
    expect(r.placeBuilding('amphitheatre', 12, 12).ok).toBe(true);
    r.setPolicy(0.10, 0.135);
    for (let i = 0; i < 500; i++) r.tick();
    expect(avgCivic(r, 'entertainment')).toBeGreaterThanOrEqual(10);
  });

  it('colosseum needs a 4000-denarii treasury before it can be placed', () => {
    const r = civicCity([]);
    expect(r.placeBuilding('colosseum', 8, 14).ok).toBe(false);
    r.requestRoyalSubsidy();
    r.takeLoan(2000);
    r.takeLoan(2000);
    r.tick();
    for (const x of [8, 9, 10, 11, 12]) r.placeBuilding('road', x, 13);
    const res = r.placeBuilding('colosseum', 8, 14);
    expect(res.ok, JSON.stringify(res)).toBe(true);
  });
});

describe('getCivicStats accessor (Phase 12)', () => {
  it('reports coverage and per-house stats deterministically', () => {
    const r = civicCity([['clinic', 6, 6], ['school', 12, 10], ['theatre', 16, 10]]);
    for (let i = 0; i < 500; i++) r.tick();
    const stats = r.getCivicStats();
    expect(stats.coverage.health).toBeGreaterThan(0);
    expect(stats.coverage.literacy).toBeGreaterThan(0);
    expect(stats.coverage.entertainment).toBeGreaterThan(0);
    expect(stats.houses.length).toBe(12);
    const h = stats.houses[0];
    expect(h.id).toBeGreaterThan(0);
    expect(h.health).toBeGreaterThanOrEqual(0);
    expect(h.literacy).toBeGreaterThanOrEqual(0);
    expect(h.entertainment).toBeGreaterThanOrEqual(0);
  });
});
