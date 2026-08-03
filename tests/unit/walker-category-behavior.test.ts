import { describe, it, expect } from 'vitest';
import { Map as SimMap } from '../../src/sim/map';
import { mulberry32 } from '../../src/sim/rng';
import { roadSpeedMultiplier } from '../../src/sim/roadTypes';
import type { BuildingInstance, SimInternals } from '../../src/sim/walkers';
import { createWalker, updateWalker } from '../../src/sim/walkers';
import { walkerProfile } from '../../src/sim/walkerProfiles';

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

function makeStub(map: SimMap, buildings: BuildingInstance[], rngSeed = 7): SimInternals {
  const byId = new Map(buildings.map((b) => [b.id, b]));
  return {
    map,
    rng: mulberry32(rngSeed),
    buildings,
    buildingById: (id) => byId.get(id) ?? null,
    buildingAt: (x, y) => buildings.find((b) => within(b, x, y)) ?? null,
    adjacentRoadTile: () => null,
    despawn: () => {},
  };
}

function mkHouse(id: number, x: number, y: number): BuildingInstance {
  return {
    id,
    type: 'house',
    x,
    y,
    footprint: 1,
    workersAssigned: 0,
    workersRequired: 0,
    active: false,
    laborConnected: false,
    laborCooldown: 0,
    spawnCooldown: 0,
    stock: {},
    house: {
      tier: 0,
      foodCooldown: 0,
      waterCooldown: 0,
      laborCooldown: 0,
      evolveCounter: 0,
      devolveCounter: 0,
    },
  };
}

function manhattan(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

describe('walker category behavior (ROAD-03)', () => {
  it('walkers advance by profile.movementSpeed, scaled by the road type multiplier', () => {
    const m = new SimMap(6, 6, 'earth');
    m.set(0, 0, 'road');
    m.set(1, 0, 'road');

    // Bare road (dirt): exactly profile.movementSpeed per tick.
    const dirt = createWalker('well', 0, 0, 1);
    updateWalker(makeStub(m, []), dirt);
    expect(dirt.progress).toBeCloseTo(walkerProfile('well').movementSpeed * roadSpeedMultiplier('dirt'), 10);
    expect(dirt.progress).toBeCloseTo(walkerProfile('well').movementSpeed, 10);

    // Paved road: profile.movementSpeed * paved multiplier (faster).
    m.setRoadType(0, 0, 'paved');
    const paved = createWalker('well', 0, 0, 2);
    updateWalker(makeStub(m, []), paved);
    expect(paved.progress).toBeCloseTo(walkerProfile('well').movementSpeed * roadSpeedMultiplier('paved'), 10);
    expect(paved.progress).toBeGreaterThan(dirt.progress);
  });

  it('clinic walker sets service freshness from profile.serviceTTL', () => {
    const map = roadLoopMap();
    const house = mkHouse(1, 1, 1);
    const sim = makeStub(map, [house]);
    const w = createWalker('clinic', 1, 0, 10);
    updateWalker(sim, w);
    expect(house.house?.services?.['health']).toBe(walkerProfile('clinic').serviceTTL);
  });

  it('wandering walkers never stray farther than maxRoadSteps from their origin and return', () => {
    const map = roadLoopMap();
    const sim = makeStub(map, []);
    const w = createWalker('well', 1, 0, 1);
    const origin = { x: 1, y: 0 };

    let minDist = Infinity;
    let maxDist = -Infinity;
    for (let i = 0; i < 500; i++) {
      updateWalker(sim, w);
      const d = manhattan(w.x, w.y, origin.x, origin.y);
      minDist = Math.min(minDist, d);
      maxDist = Math.max(maxDist, d);
    }
    expect(maxDist).toBeLessThanOrEqual(walkerProfile('well').maxRoadSteps);
    expect(minDist).toBe(0); // it returns to its origin at least once
  });

  it('a walking walker turns back at maxRoadSteps on a 1D corridor (deterministic)', () => {
    // Column corridor: the only path is along y. With return-policy wandering
    // the well must turn around at maxRoadSteps from its origin instead of
    // drifting down the corridor.
    const m = new SimMap(1, 40, 'earth');
    for (let y = 0; y < 40; y++) m.set(0, y, 'road');
    const sim = makeStub(m, []);
    const w = createWalker('well', 0, 0, 1);

    let maxY = 0;
    let returned = false;
    for (let i = 0; i < 4000; i++) {
      updateWalker(sim, w);
      maxY = Math.max(maxY, w.y);
      if (w.y === 0) returned = true;
    }
    expect(maxY).toBeLessThanOrEqual(walkerProfile('well').maxRoadSteps);
    expect(returned).toBe(true);
  });
});
