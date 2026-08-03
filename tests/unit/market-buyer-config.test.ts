/**
 * Runtime honoring of an explicitly-configured per-market config (MARK-02,
 * decision 4) through the optional SimInternals.marketConfig hook. Uses the
 * food-slice walker-stub pattern: createWalker('buyer')/updateWalker against a
 * SimInternals stub with a marketConfig hook. Unconfigured (undefined) repro-
 * duces the legacy decideBuyer path byte-identically; a configured radius,
 * refused product, or target stock changes the buyer's fetch.
 */
import { describe, expect, it } from 'vitest';
import { defaultMarketConfig } from '../../src/sim/logistics';
import type { MarketConfig } from '../../src/sim/logistics';
import { Map as SimMap } from '../../src/sim/map';
import type { BuildingInstance, SimInternals, WalkerInstance } from '../../src/sim/walkers';
import { createWalker, updateWalker } from '../../src/sim/walkers';
import { mulberry32 } from '../../src/sim/rng';
import type { Vec2 } from '../../src/sim/types';

const BUYER_FETCH = 40;

function loopMap(): SimMap {
  const m = new SimMap(6, 4, 'earth');
  for (let x = 0; x < 6; x++) {
    m.set(x, 0, 'road');
    m.set(x, 3, 'road');
  }
  for (let y = 0; y < 4; y++) {
    m.set(0, y, 'road');
    m.set(5, y, 'road');
  }
  return m;
}

function inside(b: BuildingInstance, x: number, y: number): boolean {
  return x >= b.x && x < b.x + b.footprint && y >= b.y && y < b.y + b.footprint;
}

function roadAround(map: SimMap, b: BuildingInstance): Vec2 | null {
  const n = b.footprint;
  for (let i = 0; i < n; i++) {
    if (map.get(b.x + i, b.y - 1) === 'road') return { x: b.x + i, y: b.y - 1 };
    if (map.get(b.x + i, b.y + n) === 'road') return { x: b.x + i, y: b.y + n };
    if (map.get(b.x - 1, b.y + i) === 'road') return { x: b.x - 1, y: b.y + i };
    if (map.get(b.x + n, b.y + i) === 'road') return { x: b.x + n, y: b.y + i };
  }
  return null;
}

function stubBuilding(partial: Partial<BuildingInstance> & { id: number; type: BuildingInstance['type']; x: number; y: number }): BuildingInstance {
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

interface Stub {
  sim: SimInternals;
  despawned: WalkerInstance[];
  configs: Map<number, MarketConfig | undefined>;
}

function walkerStub(map: SimMap, buildings: BuildingInstance[], tick = 1, rngSeed = 7): Stub {
  const despawned: WalkerInstance[] = [];
  const live: WalkerInstance[] = [];
  const configs = new Map<number, MarketConfig | undefined>();
  const byId = new Map(buildings.map((b) => [b.id, b]));
  const sim: SimInternals = {
    map,
    rng: mulberry32(rngSeed),
    buildings,
    buildingById: (id) => byId.get(id) ?? null,
    buildingAt: (x, y) => buildings.find((b) => inside(b, x, y)) ?? null,
    adjacentRoadTile: (b) => roadAround(map, b),
    despawn: (w) => {
      despawned.push(w);
      const i = live.indexOf(w);
      if (i >= 0) live.splice(i, 1);
    },
    tick,
    walkers: live,
    marketConfig: (id) => configs.get(id),
  };
  return { sim, despawned, configs };
}

describe('per-market config honored at runtime only when explicitly set (MARK-02, decision 4)', () => {
  it('unconfigured (hook returns undefined) reproduces the legacy decideBuyer behavior', () => {
    const map = loopMap();
    const market = stubBuilding({ id: 1, type: 'market', x: 2, y: 1, stock: { wheat: 0, vegetables: 60 }, workersRequired: 1, workersAssigned: 1 });
    const granary = stubBuilding({ id: 2, type: 'granary', x: 3, y: 1, stock: { wheat: 100 } });
    const stub = walkerStub(map, [market, granary], 1, 3);
    const buyer = createWalker('buyer', 2, 0, 10);
    buyer.marketId = market.id;
    updateWalker(stub.sim, buyer);
    // Byte-identical to food-slice.test.ts:120-144: reserves 40 at departure,
    // granary falls, market unchanged.
    expect(granary.stock.wheat).toBe(60);
    expect(market.stock.wheat ?? 0).toBe(0);
    expect(buyer.carryingGood).toBe('wheat');
    expect(buyer.carriedAmount).toBe(BUYER_FETCH);
  });

  it('buyerRadius narrows the supplier search: a granary beyond the radius is skipped', () => {
    const map = loopMap();
    const market = stubBuilding({ id: 1, type: 'market', x: 2, y: 1, stock: { wheat: 0 }, workersRequired: 1, workersAssigned: 1 });
    const farGranary = stubBuilding({ id: 2, type: 'granary', x: 5, y: 3, stock: { wheat: 100 } }); // manhattan 5 from market
    const stub = walkerStub(map, [market, farGranary], 1, 3);
    const cfg = defaultMarketConfig();
    cfg.buyerRadius = 1; // farGranary is beyond the radius
    stub.configs.set(market.id, cfg);
    const buyer = createWalker('buyer', 2, 0, 10);
    buyer.marketId = market.id;
    updateWalker(stub.sim, buyer);
    // No supplier within the radius → the buyer holds nothing and fetches nothing.
    expect(buyer.carryingGood).toBeNull();
    expect(buyer.carriedAmount).toBe(0);
    expect(farGranary.stock.wheat).toBe(100);
    expect(market.stock.wheat ?? 0).toBe(0);
  });

  it('widening the buyerRadius lets the buyer fetch from the same granary', () => {
    const map = loopMap();
    const market = stubBuilding({ id: 1, type: 'market', x: 2, y: 1, stock: { wheat: 0 }, workersRequired: 1, workersAssigned: 1 });
    const farGranary = stubBuilding({ id: 2, type: 'granary', x: 5, y: 3, stock: { wheat: 100 } });
    const stub = walkerStub(map, [market, farGranary], 1, 3);
    const cfg = defaultMarketConfig();
    cfg.buyerRadius = 5; // farGranary now within radius
    stub.configs.set(market.id, cfg);
    const buyer = createWalker('buyer', 2, 0, 10);
    buyer.marketId = market.id;
    updateWalker(stub.sim, buyer);
    expect(buyer.carryingGood).toBe('wheat');
    expect(buyer.carriedAmount).toBe(BUYER_FETCH);
    expect(farGranary.stock.wheat).toBe(60); // reserved at departure
  });

  it('a refused product stops the buyer from fetching it even when demand exists', () => {
    const map = loopMap();
    const market = stubBuilding({ id: 1, type: 'market', x: 2, y: 1, stock: { wheat: 0 }, workersRequired: 1, workersAssigned: 1 });
    const granary = stubBuilding({ id: 2, type: 'granary', x: 3, y: 1, stock: { wheat: 100 } });
    const stub = walkerStub(map, [market, granary], 1, 3);
    const cfg = defaultMarketConfig();
    cfg.productRules.wheat = 'refuse';
    stub.configs.set(market.id, cfg);
    const buyer = createWalker('buyer', 2, 0, 10);
    buyer.marketId = market.id;
    updateWalker(stub.sim, buyer);
    // Wheat is the only food the market would demand, but it is refused → no fetch.
    expect(buyer.carryingGood).toBeNull();
    expect(buyer.carriedAmount).toBe(0);
    expect(granary.stock.wheat).toBe(100);
  });

  it('targetStock drives restock: below target triggers a fetch', () => {
    const map = loopMap();
    // Only wheat is below its target (10 < 50); the other foods sit at/above it,
    // so nextFoodToFetch deterministically picks wheat.
    const market = stubBuilding({ id: 1, type: 'market', x: 2, y: 1, stock: { wheat: 10, vegetables: 50, fruit: 50, meat: 50, fish: 50 }, workersRequired: 1, workersAssigned: 1 });
    const granary = stubBuilding({ id: 2, type: 'granary', x: 3, y: 1, stock: { wheat: 100 } });
    const stub = walkerStub(map, [market, granary], 1, 3);
    const cfg = defaultMarketConfig();
    cfg.targetStock = 50; // market wheat 10 < 50 → below target
    stub.configs.set(market.id, cfg);
    const buyer = createWalker('buyer', 2, 0, 10);
    buyer.marketId = market.id;
    updateWalker(stub.sim, buyer);
    expect(buyer.carryingGood).toBe('wheat');
    expect(buyer.carriedAmount).toBe(BUYER_FETCH);
    expect(granary.stock.wheat).toBe(60);
  });

  it('targetStock drives restock: an at/above-target market does not fetch, even when the legacy cap logic would', () => {
    const map = loopMap();
    // Legacy cap logic would call for restock: wheat 50 < MARKET_FOOD_CAPS.wheat (200).
    const market = stubBuilding({ id: 1, type: 'market', x: 2, y: 1, stock: { wheat: 50 }, workersRequired: 1, workersAssigned: 1 });
    const granary = stubBuilding({ id: 2, type: 'granary', x: 3, y: 1, stock: { wheat: 100 } });
    const stub = walkerStub(map, [market, granary], 1, 3);
    const cfg = defaultMarketConfig();
    cfg.targetStock = 10; // market wheat 50 >= 10 → at/above target → no restock
    stub.configs.set(market.id, cfg);
    const buyer = createWalker('buyer', 2, 0, 10);
    buyer.marketId = market.id;
    updateWalker(stub.sim, buyer);
    expect(buyer.carryingGood).toBeNull();
    expect(buyer.carriedAmount).toBe(0);
    expect(granary.stock.wheat).toBe(100);
    expect(market.stock.wheat).toBe(50);
  });
});
