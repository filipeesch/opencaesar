import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { BUILDINGS } from '../../src/sim/buildings';
import { Map as SimMap } from '../../src/sim/map';
import type { BuildingType } from '../../src/sim/types';

const ALL_TYPES: BuildingType[] = [
  'road', 'house', 'garden', 'well', 'fountain', 'farm', 'orchard', 'granary',
  'market', 'engineer_post', 'fire_station', 'clinic', 'school', 'library',
  'temple', 'theatre', 'forum',
];

function flatRunner(): SimRunner {
  const m = new SimMap(40, 40, 'earth');
  for (let x = 0; x < 40; x++) m.set(x, 20, 'road');
  for (let y = 18; y <= 19; y++) for (let x = 8; x <= 18; x++) m.set(x, y, 'fertile');
  return new SimRunner(1, m);
}

const SPOTS: Record<string, [number, number]> = {
  garden: [4, 21], well: [5, 21], fountain: [6, 21], engineer_post: [7, 21],
  fire_station: [9, 21], clinic: [11, 21], school: [13, 21], library: [15, 21],
  temple: [17, 21], theatre: [19, 21], forum: [21, 21], market: [24, 21],
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
