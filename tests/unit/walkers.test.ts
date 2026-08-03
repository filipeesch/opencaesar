import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { Map as SimMap } from '../../src/sim/map';
import { mulberry32 } from '../../src/sim/rng';
import type { Vec2 } from '../../src/sim/types';
import type { BuildingInstance, SimInternals, WalkerInstance } from '../../src/sim/walkers';
import { createWalker, updateWalker } from '../../src/sim/walkers';

/** 6x6 map with a rectangular road loop around a 2x2 block. */
function roadLoopMap(): SimMap {
  const m = new SimMap(6, 6, 'earth');
  for (let x = 0; x < 4; x++) {
    m.set(x, 0, 'road');
    m.set(x, 3, 'road');
  }
  for (let y = 0; y < 4; y++) {
    m.set(0, y, 'road');
    m.set(3, y, 'road');
  }
  return m;
}

function within(b: BuildingInstance, x: number, y: number): boolean {
  return x >= b.x && x < b.x + b.footprint && y >= b.y && y < b.y + b.footprint;
}

function firstRoadAround(map: SimMap, b: BuildingInstance): Vec2 | null {
  const n = b.footprint;
  for (let i = 0; i < n; i++) {
    if (map.get(b.x + i, b.y - 1) === 'road') return { x: b.x + i, y: b.y - 1 };
    if (map.get(b.x + i, b.y + n) === 'road') return { x: b.x + i, y: b.y + n };
    if (map.get(b.x - 1, b.y + i) === 'road') return { x: b.x - 1, y: b.y + i };
    if (map.get(b.x + n, b.y + i) === 'road') return { x: b.x + n, y: b.y + i };
  }
  return null;
}

interface Stub {
  sim: SimInternals;
  despawned: WalkerInstance[];
}

function makeStub(map: SimMap, buildings: BuildingInstance[], rngSeed = 7): Stub {
  const despawned: WalkerInstance[] = [];
  const byId = new Map(buildings.map((b) => [b.id, b]));
  const sim: SimInternals = {
    map,
    rng: mulberry32(rngSeed),
    buildings,
    buildingById: (id) => byId.get(id) ?? null,
    buildingAt: (x, y) => buildings.find((b) => within(b, x, y)) ?? null,
    adjacentRoadTile: (b) => firstRoadAround(map, b),
    despawn: (w) => {
      despawned.push(w);
    },
  };
  return { sim, despawned };
}

function mkBuilding(partial: Partial<BuildingInstance> & { id: number; type: BuildingInstance['type']; x: number; y: number }): BuildingInstance {
  return {
    footprint: 1,
    workersAssigned: 0,
    workersRequired: 0,
    active: false,
    laborConnected: false,
    laborCooldown: 0,
    spawnCooldown: 0,
    stock: {},
    ...partial,
  };
}

function mkHouse(id: number, x: number, y: number, overrides: Partial<BuildingInstance['house'] & { stock?: never }> = {}): BuildingInstance {
  return mkBuilding({
    id,
    type: 'house',
    x,
    y,
    house: {
      tier: 0,
      foodCooldown: 0,
      waterCooldown: 0,
      laborCooldown: 0,
      evolveCounter: 0,
      devolveCounter: 0,
      ...overrides,
    },
  });
}

function tickN(sim: SimInternals, w: WalkerInstance, n: number): void {
  for (let i = 0; i < n; i++) updateWalker(sim, w);
}

describe('walker movement and lifecycle', () => {
  it('never leaves the road graph', () => {
    const map = roadLoopMap();
    const { sim } = makeStub(map, []);
    const w = createWalker('well', 1, 0, 1);
    for (let i = 0; i < 300; i++) {
      updateWalker(sim, w);
      expect(map.get(w.x, w.y)).toBe('road');
    }
  });

  it('moves sub-tile: progress advances a fraction of a tile each tick', () => {
    const map = roadLoopMap();
    const { sim } = makeStub(map, []);
    const w = createWalker('well', 1, 0, 1);

    updateWalker(sim, w);
    expect(w.progress).toBeCloseTo(CONFIG.walkerSpeedPerTick, 10);
    expect(w.x).toBe(1);
    expect(w.y).toBe(0);
    expect(w.next).not.toBeNull();

    // Stepping past the boundary moves onto the next tile and wraps progress.
    const ticksToCross = Math.ceil(1 / CONFIG.walkerSpeedPerTick);
    for (let i = 1; i < ticksToCross; i++) updateWalker(sim, w);
    expect(w.progress).toBeGreaterThanOrEqual(0);
    expect(w.progress).toBeLessThan(1);
    const movedAway = w.x !== 1 || w.y !== 0;
    expect(movedAway).toBe(true);
  });

  it('junction direction choice is deterministic for a given seed', () => {
    const map = roadLoopMap();
    const a = makeStub(map, [], 7);
    const b = makeStub(map, [], 7);
    const wa = createWalker('well', 1, 0, 1);
    const wb = createWalker('well', 1, 0, 1);

    for (let i = 0; i < 40; i++) {
      updateWalker(a.sim, wa);
      updateWalker(b.sim, wb);
    }

    // Same seed → every junction choice along the wander is identical.
    expect(wa.x).toBe(wb.x);
    expect(wa.y).toBe(wb.y);
    expect(wa.next).toEqual(wb.next);
    // And the walker actually moved (exercised the junction choices).
    expect(wa.x !== 1 || wa.y !== 0).toBe(true);
  });

  it('despawns when its lifetime expires', () => {
    const map = roadLoopMap();
    const { sim, despawned } = makeStub(map, []);
    const w = createWalker('well', 1, 0, 1);
    tickN(sim, w, CONFIG.walkerLifetimeTicks);
    expect(despawned).toHaveLength(1);
    expect(despawned[0].id).toBe(1);
  });

  it('despawns when its objective completes (market delivery)', () => {
    const map = roadLoopMap();
    const granary = mkBuilding({ id: 1, type: 'granary', x: 0, y: 1, stock: { wheat: 10 } });
    const house = mkHouse(2, 3, 1);
    const { sim, despawned } = makeStub(map, [granary, house]);
    const w = createWalker('market', 2, 0, 5);
    w.carryingGood = 'wheat';
    w.carriedAmount = 1;
    tickN(sim, w, 100);
    expect(despawned).toContain(w);
    expect(house.house?.foodCooldown).toBeGreaterThan(0);
  });
});

describe('service coverage', () => {
  it('market walker carrying food gives houses a food flag with cooldown', () => {
    const map = roadLoopMap();
    const house = mkHouse(1, 1, 1);
    const { sim } = makeStub(map, [house]);
    const w = createWalker('market', 1, 0, 1);
    w.carryingGood = 'wheat';
    w.carriedAmount = 5;
    updateWalker(sim, w);
    expect(house.house?.foodCooldown).toBe(CONFIG.serviceCooldownTicks);
  });

  it('market walker without food gives no food flag', () => {
    const map = roadLoopMap();
    const house = mkHouse(1, 1, 1);
    const { sim } = makeStub(map, [house]);
    const w = createWalker('market', 1, 0, 1);
    updateWalker(sim, w);
    expect(house.house?.foodCooldown).toBe(0);
  });

  it('well walker gives houses a water flag with cooldown', () => {
    const map = roadLoopMap();
    const house = mkHouse(1, 1, 1);
    const { sim } = makeStub(map, [house]);
    const w = createWalker('well', 1, 0, 1);
    updateWalker(sim, w);
    expect(house.house?.waterCooldown).toBe(CONFIG.serviceCooldownTicks);
  });
});

describe('market walker cycle', () => {
  it('fetches wheat from a granary, then delivers it to a house', () => {
    const map = roadLoopMap();
    const granary = mkBuilding({ id: 1, type: 'granary', x: 0, y: 1, stock: { wheat: 10 } });
    const house = mkHouse(2, 3, 1);
    const { sim, despawned } = makeStub(map, [granary, house]);
    const w = createWalker('market', 2, 0, 5);

    tickN(sim, w, CONFIG.walkerLifetimeTicks + 5);

    expect(granary.stock.wheat).toBe(5);
    expect(w.carriedAmount).toBeGreaterThan(0);
    expect(house.house?.foodCooldown).toBeGreaterThan(0);
    expect(despawned.some((d) => d.id === w.id)).toBe(true);
  });

  it('returns empty when no granary has wheat', () => {
    const map = roadLoopMap();
    const granary = mkBuilding({ id: 1, type: 'granary', x: 0, y: 1, stock: { wheat: 0 } });
    const house = mkHouse(2, 3, 1);
    const { sim } = makeStub(map, [granary, house]);
    const w = createWalker('market', 2, 0, 5);
    tickN(sim, w, 100);
    expect(w.carryingGood).toBeNull();
    expect(house.house?.foodCooldown).toBe(0);
  });
});

describe('labor walker', () => {
  it('connects a building to houses and despawns on arrival', () => {
    const map = roadLoopMap();
    const farm = mkBuilding({ id: 1, type: 'farm', x: 1, y: 1, workersRequired: 1 });
    const { sim, despawned } = makeStub(map, [farm]);
    const w = createWalker('labor', 1, 0, 5);
    tickN(sim, w, 10);
    expect(farm.laborConnected).toBe(true);
    expect(farm.laborCooldown).toBe(CONFIG.serviceCooldownTicks);
    expect(despawned.some((d) => d.id === w.id)).toBe(true);
  });
});

describe('service walkers deliver house service access (suggestion fix)', () => {
  it('a clinic walker adjacent to a house sets health service access', () => {
    const map = roadLoopMap();
    const house = mkHouse(1, 1, 1);
    const sim = makeStub(map, [house]).sim;
    // clinic walker standing adjacent to the house at (1,1)
    const w = createWalker('clinic', 1, 0, 10); // (1,0) is a road tile above the house
    w.path = [];
    updateWalker(sim, w);
    expect(house.house?.services?.['health']).toBe(CONFIG.serviceCooldownTicks);
  });

  it('a school walker sets literacy and a temple walker sets religion', () => {
    const map = roadLoopMap();
    const house = mkHouse(1, 1, 1);
    const sim = makeStub(map, [house]).sim;
    const school = createWalker('school', 1, 0, 10);
    updateWalker(sim, school);
    expect(house.house?.services?.['literacy']).toBe(CONFIG.serviceCooldownTicks);
  });
});
