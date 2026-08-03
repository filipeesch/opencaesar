import { describe, it, expect } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { Map as SimMap } from '../../src/sim/map';
import { findRoadPath } from '../../src/sim/pathfind';
import { isRoadPassable } from '../../src/sim/roadTypes';
import { mulberry32 } from '../../src/sim/rng';
import type { BuildingInstance, SimInternals } from '../../src/sim/walkers';
import { createWalker, updateWalker } from '../../src/sim/walkers';
import { ROADBLOCK_POLICY_BY_CATEGORY, mayTraverse, walkerProfile } from '../../src/sim/walkerProfiles';

function within(b: BuildingInstance, x: number, y: number): boolean {
  return x >= b.x && x < b.x + b.footprint && y >= b.y && y < b.y + b.footprint;
}

function firstRoadAround(map: SimMap, b: BuildingInstance): { x: number; y: number } | null {
  const n = b.footprint;
  for (let i = 0; i < n; i++) {
    if (map.get(b.x + i, b.y - 1) === 'road') return { x: b.x + i, y: b.y - 1 };
    if (map.get(b.x + i, b.y + n) === 'road') return { x: b.x + i, y: b.y + n };
    if (map.get(b.x - 1, b.y + i) === 'road') return { x: b.x - 1, y: b.y + i };
    if (map.get(b.x + n, b.y + i) === 'road') return { x: b.x + n, y: b.y + i };
  }
  return null;
}

function makeStub(map: SimMap, buildings: BuildingInstance[], rngSeed = 7): SimInternals {
  const byId = new Map(buildings.map((b) => [b.id, b]));
  return {
    map,
    rng: mulberry32(rngSeed),
    buildings,
    buildingById: (id) => byId.get(id) ?? null,
    buildingAt: (x, y) => buildings.find((b) => within(b, x, y)) ?? null,
    adjacentRoadTile: (b) => firstRoadAround(map, b),
    despawn: () => {},
  };
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

describe('per-category roadblock permissions (ROAD-03)', () => {
  it('ROADBLOCK_POLICY_BY_CATEGORY defaults and mayTraverse enforcement', () => {
    expect(ROADBLOCK_POLICY_BY_CATEGORY.wandering).toBe('stop');
    expect(ROADBLOCK_POLICY_BY_CATEGORY.destination).toBe('pass');
    expect(ROADBLOCK_POLICY_BY_CATEGORY.recruiter).toBe('stop');

    // A 'stop' walker (well) never traverses a service_roadblock.
    expect(mayTraverse(walkerProfile('well'), 'service_roadblock')).toBe(false);
    // A 'pass' walker (market) traverses it even though isRoadPassable is false.
    expect(walkerProfile('well').roadblockPolicy).toBe('stop');
    expect(walkerProfile('market').roadblockPolicy).toBe('pass');
    expect(isRoadPassable('service_roadblock')).toBe(false);
    expect(mayTraverse(walkerProfile('market'), 'service_roadblock')).toBe(true);

    // Allowed-road-type enforcement: passable types in allowedRoadTypes pass,
    // passable types outside it are blocked.
    expect(mayTraverse(walkerProfile('well'), 'paved')).toBe(true);
    expect(mayTraverse(walkerProfile('well'), 'dirt')).toBe(true);
    expect(mayTraverse(walkerProfile('well'), 'stairs')).toBe(false);
    expect(mayTraverse(walkerProfile('well'), 'wharf_access')).toBe(false);
  });

  it('findRoadPath routes around a blocked roadblock tile when an alternate exists', () => {
    // Direct route (0,0)-(1,0)-(2,0); (1,0) is a service_roadblock. An alternate
    // longer route via row y=1 avoids it.
    const m = new SimMap(4, 3, 'earth');
    m.set(0, 0, 'road'); m.set(1, 0, 'road'); m.set(2, 0, 'road');
    m.set(0, 1, 'road'); m.set(1, 1, 'road'); m.set(2, 1, 'road');
    m.setRoadType(1, 0, 'service_roadblock');

    const stop = (x: number, y: number): boolean => m.get(x, y) === 'road' && mayTraverse(walkerProfile('well'), m.roadTypeAt(x, y) ?? 'dirt');

    // Default predicate is terrain-only — the shortest path goes through the block.
    const direct = findRoadPath(m, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(direct).not.toBeNull();
    expect(direct).toContainEqual({ x: 1, y: 0 });

    // With a 'stop' predicate the path bypasses the blocked tile via an alternate.
    const path = findRoadPath(m, { x: 0, y: 0 }, { x: 2, y: 0 }, stop);
    expect(path).not.toBeNull();
    expect(path).not.toContainEqual({ x: 1, y: 0 });
  });

  it('a market (pass) traverses the roadblock and still serves the granary', () => {
    // Direct route (0,0)-(1,0)[roadblock]-(2,0)-(3,0); granary adjacent to (3,0).
    const m = new SimMap(6, 4, 'earth');
    for (let x = 0; x < 4; x++) m.set(x, 0, 'road');
    m.setRoadType(1, 0, 'service_roadblock');
    const granary = mkBuilding({ id: 1, type: 'granary', x: 3, y: 1, stock: { wheat: 10 } });
    const sim = makeStub(m, [granary]);

    const w = createWalker('market', 0, 0, 5);
    let steppedOnBlock = false;
    for (let i = 0; i < 100; i++) {
      updateWalker(sim, w);
      if (w.x === 1 && w.y === 0) steppedOnBlock = true;
    }
    // 'pass' policy let the market walk across the roadblock and reach the granary.
    expect(steppedOnBlock).toBe(true);
    expect(granary.stock.wheat).toBe(10 - CONFIG.marketFetchAmount);
    expect(w.carryingGood).toBe('wheat');
    expect(w.carriedAmount).toBeGreaterThan(0);
  });

  it('a well (stop) never occupies a service_roadblock tile while wandering', () => {
    // 3x2 road grid with the middle tile (1,0) a service_roadblock; the well has
    // plenty of alternative plain-road neighbours to wander through.
    const m = new SimMap(3, 3, 'earth');
    for (let x = 0; x < 3; x++) {
      m.set(x, 0, 'road');
      m.set(x, 1, 'road');
    }
    m.setRoadType(1, 0, 'service_roadblock');
    const sim = makeStub(m, []);
    const w = createWalker('well', 0, 0, 1);

    const visited = new Set<string>();
    for (let i = 0; i < 500; i++) {
      updateWalker(sim, w);
      visited.add(`${w.x},${w.y}`);
    }
    expect(visited.has('1,0')).toBe(false);
    expect(visited.size).toBeGreaterThan(1); // it actually wandered, not stuck
  });

  it('a Manhattan-near but road-unreachable granary is never served (graph path only)', () => {
    // Market on corridor A (0,0)-(1,0); granary road tile (3,0) behind a one-tile
    // gap at (2,0). Manhattan distance is 3 yet no road path exists.
    const m = new SimMap(6, 4, 'earth');
    m.set(0, 0, 'road');
    m.set(1, 0, 'road');
    m.set(3, 0, 'road');
    const granary = mkBuilding({ id: 1, type: 'granary', x: 3, y: 1, stock: { wheat: 10 } });
    const sim = makeStub(m, [granary]);
    const w = createWalker('market', 0, 0, 5);

    // Graph-path proof: A* over the road graph finds no route despite Manhattan
    // proximity (3 tiles).
    expect(findRoadPath(m, { x: 0, y: 0 }, { x: 3, y: 0 })).toBeNull();

    for (let i = 0; i < 80; i++) updateWalker(sim, w);
    // No Euclidean fallback: the walker never starts seeking, keeps an empty
    // path, and the granary's wheat is untouched.
    expect(w.state).toBe('wandering');
    expect(w.path).toHaveLength(0);
    expect(granary.stock.wheat).toBe(10);
    expect(w.x === 3 && w.y === 0).toBe(false); // never reached the granary's road tile
  });
});
