import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { BUILDINGS } from '../../src/sim/buildings';
import { Map as SimMap } from '../../src/sim/map';
import type { BuildingType } from '../../src/sim/types';

const ALL_TYPES: BuildingType[] = [
  'road', 'house', 'garden', 'well', 'fountain', 'farm', 'orchard', 'granary',
  'market', 'engineer_post', 'fire_station', 'clinic', 'school', 'library',
  'temple', 'grand_temple', 'theatre',
];

function flatRunner(): SimRunner {
  const m = new SimMap(40, 40, 'earth');
  for (let x = 0; x < 40; x++) m.set(x, 20, 'road');
  for (let y = 18; y <= 19; y++) for (let x = 8; x <= 18; x++) m.set(x, y, 'fertile');
  return new SimRunner(1, m);
}

/** Government skeleton: roads, venues, wells — no houses, population 0. */
function govSkeleton(): SimRunner {
  const W = 34;
  const m = SimMap.fromLayout(W, W, () => 'fertile');
  const r = new SimRunner(7, m);
  for (const y of [0, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29]) {
    const maxX = y === 3 || y === 5 ? 17 : W;
    for (let x = 0; x < maxX; x++) r.placeBuilding('road', x, y);
  }
  for (const y of [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28]) r.placeBuilding('road', 7, y);
  for (const y of [5, 9, 13, 17, 21, 25, 29]) for (let x = 0; x < 18; x++) r['map'].setRoadType(x, y, 'plaza');
  r.requestRoyalSubsidy();
  r.takeLoan(2000);
  r.takeLoan(2000);
  r.takeLoan(2000);
  for (const [type, x, y] of [['farm', 0, 1], ['granary', 2, 1], ['market', 4, 1], ['clinic', 9, 1], ['school', 11, 1], ['theatre', 13, 1], ['temple', 15, 1]] as const) {
    const res = r.placeBuilding(type, x, y);
    if (!res.ok) throw new Error(`place ${type}@(${x},${y}): ${JSON.stringify(res)}`);
  }
  for (const y of [6, 10, 14, 18, 22, 26]) for (const x of [11, 19, 27]) r.placeBuilding('well', x, y);
  return r;
}

const SPOTS: Record<string, [number, number]> = {
  garden: [4, 21], well: [5, 21], fountain: [6, 21], engineer_post: [7, 21],
  fire_station: [9, 21], clinic: [11, 21], school: [13, 21], library: [15, 21],
  temple: [17, 21], grand_temple: [22, 16], theatre: [19, 21], forum: [21, 21], market: [24, 21],
  farm: [9, 18], orchard: [14, 18], granary: [30, 21],
};

describe('building catalog is placeable (issue: HUD showed only 6 types)', () => {
  it('exposes more than 6 construction types and defines each', () => {
    expect(ALL_TYPES.length).toBeGreaterThan(6);
    for (const t of ALL_TYPES) expect(BUILDINGS[t]).toBeDefined();
  });

  it('places every buildable type on a fresh city (no cross-contamination)', () => {
    for (const t of ALL_TYPES) {
      if (t === 'road' || t === 'house') continue;
      const r = flatRunner();
      const [x, y] = SPOTS[t];
      const result = r.placeBuilding(t, x, y);
      expect(result.ok, `${t} at (${x},${y}): ${JSON.stringify(result)}`).toBe(true);
    }
  });

  it('government buildings place only once their population threshold is met (GOV-01)', () => {
    const r = govSkeleton();
    expect(r.getPopulation()).toBe(0);
    for (const [t, x, y] of [['forum', 18, 1], ['senate', 22, 1], ['palatine', 26, 1]] as const) {
      const blocked = r.placeBuilding(t, x, y);
      expect(blocked.ok).toBe(false);
      expect((blocked as { error: string }).error).toBe('not-unlocked');
    }
    for (const y of [4, 8, 12, 16, 20, 24, 28]) {
      for (let x = 0; x < (y === 4 ? 17 : 34); x++) r.placeBuilding('house', x, y);
    }
    r.setPolicy(0.10, 0.135);
    for (let i = 0; i < 700; i++) r.tick();
    expect(r.getPopulation()).toBeGreaterThanOrEqual(900);
    for (const [t, x, y] of [['forum', 18, 1], ['senate', 22, 1], ['palatine', 26, 1]] as const) {
      const result = r.placeBuilding(t, x, y);
      expect(result.ok, `${t} at (${x},${y}): ${JSON.stringify(result)}`).toBe(true);
    }
  });

  it('fountain provides water coverage from the running sim', () => {
    const r = flatRunner();
    expect(r.placeBuilding('fountain', 6, 21).ok).toBe(true);
    for (let i = 0; i < 20; i++) r.tick();
    expect(r.getDerived().water.coveredTiles).toBeGreaterThan(0);
  });

  it('farm and orchard both place and the food chain reaches a granary when staffed', () => {
    const r = flatRunner();
    expect(r.placeBuilding('farm', 9, 18).ok).toBe(true);
    expect(r.placeBuilding('orchard', 14, 18).ok).toBe(true);
    expect(r.placeBuilding('granary', 30, 21).ok).toBe(true);
    // add houses adjacent to the road to staff the farms
    for (const x of [4, 8, 12, 16, 20]) r.placeBuilding('house', x, 21);
    for (let i = 0; i < 500; i++) r.tick();
    const granary = r.getState().buildings.find((b) => b.type === 'granary');
    expect((granary?.stock.wheat ?? 0)).toBeGreaterThan(0);
  });

  it('service buildings raise advisor coverage from real sim data', () => {
    const r = flatRunner();
    // eight houses staff every venue (clinic 1 + school 2 + temple 2 + theatre 2)
    for (const x of [8, 10, 12, 14, 16, 18, 20, 22]) r.placeBuilding('house', x, 19);
    r.placeBuilding('clinic', 11, 21);
    r.placeBuilding('school', 13, 21);
    r.placeBuilding('temple', 17, 21);
    r.placeBuilding('theatre', 19, 21);
    // let walkers spawn (40-tick cadence) and refresh house service flags
    for (let i = 0; i < 300; i++) r.tick();
    const d = r.getDerived();
    expect(d.services.health).toBeGreaterThan(0);
    expect(d.services.literacy).toBeGreaterThan(0);
    expect(d.services.religion).toBeGreaterThan(0);
    expect(d.services.entertainment).toBeGreaterThan(0);
    expect(d.services.health).toBeLessThanOrEqual(1);
    expect(d.services.literacy).toBeLessThanOrEqual(1);
    expect(d.services.entertainment).toBeLessThanOrEqual(1);
  });
});

describe('service walkers deliver coverage to houses (suggestion fix)', () => {
  it('a clinic walker grants health service access to an adjacent house', () => {
    const r = flatRunner();
    // clinic at (6,21); its spawn walker starts on the road tile (6,20) and the
    // house at (6,19) sits adjacent to it, so coverage is applied deterministically.
    expect(r.placeBuilding('clinic', 6, 21).ok).toBe(true);
    expect(r.placeBuilding('house', 6, 19).ok).toBe(true);
    // staff the clinic from other houses
    for (const x of [2, 4]) r.placeBuilding('house', x, 21);
    for (let i = 0; i < 200; i++) r.tick();
    const house = r.getState().buildings.find((b) => b.type === 'house' && b.x === 6 && b.y === 19);
    const access = (house?.house as { services?: Record<string, number> } | undefined)?.services;
    expect(access?.['health'] ?? 0).toBeGreaterThan(0);
  });
});
