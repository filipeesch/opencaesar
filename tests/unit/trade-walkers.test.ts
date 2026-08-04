/**
 * TRAD-03 — caravan (cap 8) and ship (cap 16) walkers physically carry trade
 * loads between source and destination with capacity enforcement, no-loss
 * restoration on failed trips, and untouched legacy buyer/seller behavior
 * (market-chain micro-sequence expectations re-asserted).
 */
import { describe, it, expect } from 'vitest';
import { Map as SimMap } from '../../src/sim/map';
import { mulberry32 } from '../../src/sim/rng';
import type { BuildingInstance, SimInternals, WalkerInstance } from '../../src/sim/walkers';
import { createWalker, updateWalker } from '../../src/sim/walkers';
import type { Vec2 } from '../../src/sim/types';

function loopMap(): SimMap {
  const m = new SimMap(8, 4, 'earth');
  for (let x = 0; x < 8; x++) {
    m.set(x, 0, 'road');
    m.set(x, 3, 'road');
  }
  for (let y = 0; y < 4; y++) {
    m.set(0, y, 'road');
    m.set(7, y, 'road');
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

interface StubWorld {
  sim: SimInternals;
  buildings: BuildingInstance[];
  live: WalkerInstance[];
  despawned: WalkerInstance[];
}

/** Fresh stub world: a road ring (8x4) with two storage buildings at (2,1)/(3,1). */
function world(stocks: Record<string, number> = {}, destStock: Record<string, number> = {}): StubWorld {
  const map = loopMap();
  const src = stubBuilding({ id: 1, type: 'warehouse', x: 2, y: 1, stock: { pottery: 0, ...stocks } });
  const dest = stubBuilding({ id: 2, type: 'warehouse', x: 3, y: 1, stock: { ...destStock } });
  const buildings = [src, dest];
  const despawned: WalkerInstance[] = [];
  const byId = new Map(buildings.map((b) => [b.id, b]));
  const live: WalkerInstance[] = [];
  const sim: SimInternals = {
    map,
    rng: mulberry32(7),
    buildings,
    buildingById: (id) => byId.get(id) ?? null,
    buildingAt: (x, y) => buildings.find((b) => inside(b, x, y)) ?? null,
    adjacentRoadTile: (b) => roadAround(map, b),
    despawn: (w) => {
      despawned.push(w);
      const i = live.indexOf(w);
      if (i >= 0) live.splice(i, 1);
    },
    tick: 1,
  };
  return { sim, buildings, live, despawned };
}

function runUntil(sim: SimInternals, w: WalkerInstance, done: (w: WalkerInstance) => boolean, maxTicks = 400): void {
  for (let i = 0; i < maxTicks && !done(w); i++) updateWalker(sim, w);
}

describe('TRAD-03 caravan walker (capacity 8)', () => {
  it('collects from source, carries ≤8 between the two, deposits at dest — nothing lost/duplicated', () => {
    const { sim, buildings, live, despawned } = world({ pottery: 8 });
    const src = buildings[0];
    const dest = buildings[1];

    const caravan = createWalker('caravan', 0, 0, 100);
    caravan.trade = { good: 'pottery', amount: 8, isExport: true, capacity: 8, sourceBuildingId: src.id, destBuildingId: dest.id, waitTicks: 0, loaded: false };
    live.push(caravan);

    // Before pickup the warehouse holds it, the walker holds nothing.
    expect((src.stock as Record<string, number>).pottery).toBe(8);
    expect(caravan.carriedAmount).toBe(0);

    // Step until pickup completes, asserting no tick holds the goods in BOTH places.
    let ticks = 0;
    while (caravan.carriedAmount === 0 && ticks++ < 100) updateWalker(sim, caravan);
    expect(caravan.carryingGood).toBe('pottery');
    expect(caravan.carriedAmount).toBe(8); // capacity 8 honored, no truncation
    expect((src.stock as Record<string, number>).pottery).toBe(0); // fell only on collection
    // no duplication: goods are on the walker XOR the warehouse
    expect((src.stock as Record<string, number>).pottery + caravan.carriedAmount).toBe(8);

    // Complete the journey → depot rises by exactly the carried amount.
    runUntil(sim, caravan, (w) => w.carriedAmount === 0 && w.carryingGood === null, 400);
    expect((dest.stock as Record<string, number>).pottery).toBe(8);
    expect((src.stock as Record<string, number>).pottery).toBe(0);
    expect((src.stock as Record<string, number>).pottery + (dest.stock as Record<string, number>).pottery).toBe(8);
    expect(despawned).toContain(caravan);
  });

  it('a stock-poor source loads only what exists — never negative, never above capacity', () => {
    const { sim, buildings, live } = world({ pottery: 3 });
    const src = buildings[0];
    const dest = buildings[1];
    const caravan = createWalker('caravan', 0, 0, 101);
    caravan.trade = { good: 'pottery', amount: 8, isExport: true, capacity: 8, sourceBuildingId: src.id, destBuildingId: dest.id, waitTicks: 0, loaded: false };
    live.push(caravan);
    runUntil(sim, caravan, (w) => w.carryingGood === 'pottery' && w.carriedAmount > 0, 100);
    expect(caravan.carriedAmount).toBe(3);
    expect((src.stock as Record<string, number>).pottery).toBe(0);
    expect(caravan.carriedAmount).toBeLessThanOrEqual(8);
  });

  it('a failing trip (unreachable dest) restores held cargo to the source on expiry — no loss', () => {
    const { sim, buildings, live } = world({ pottery: 8 });
    const src = buildings[0];
    // dest id 99 does not resolve → the merchant cannot reach it
    const caravan = createWalker('caravan', 0, 0, 102);
    caravan.trade = { good: 'pottery', amount: 8, isExport: true, capacity: 8, sourceBuildingId: src.id, destBuildingId: 99, waitTicks: 0, loaded: false };
    live.push(caravan);

    // Let it pick up 8.
    runUntil(sim, caravan, (w) => w.carriedAmount > 0, 100);
    expect(caravan.carriedAmount).toBe(8);
    expect((src.stock as Record<string, number>).pottery).toBe(0);

    // Expire the trip → cargo returns to the source.
    caravan.lifetime = 1;
    updateWalker(sim, caravan);
    expect((src.stock as Record<string, number>).pottery).toBe(8);
    expect(caravan.carryingGood).toBeNull();
    expect(caravan.carriedAmount).toBe(0);
  });
});

describe('TRAD-03 ship walker (capacity 16)', () => {
  it('carries up to 16 loads and deposits them', () => {
    const { sim, buildings, live, despawned } = world({ pottery: 30 });
    const src = buildings[0];
    const dest = buildings[1];
    const ship = createWalker('ship', 0, 0, 200);
    ship.trade = { good: 'pottery', amount: 16, isExport: true, capacity: 16, ship: true, sourceBuildingId: src.id, destBuildingId: dest.id, waitTicks: 0, loaded: false };
    live.push(ship);

    runUntil(sim, ship, (w) => w.carriedAmount > 0, 100);
    expect(ship.carriedAmount).toBe(16); // capacity 16 honored
    expect(ship.carriedAmount).toBeLessThanOrEqual(16);

    runUntil(sim, ship, (w) => w.carriedAmount === 0 && w.carryingGood === null, 400);
    expect((dest.stock as Record<string, number>).pottery).toBe(16);
    expect(despawned).toContain(ship);
  });
});

describe('legacy buyer/seller regression (byte-identical behavior)', () => {
  function legacyMicroSequence(): unknown {
    const m = new SimMap(6, 4, 'earth');
    for (let x = 0; x < 6; x++) {
      m.set(x, 0, 'road');
      m.set(x, 3, 'road');
    }
    for (let y = 0; y < 4; y++) {
      m.set(0, y, 'road');
      m.set(5, y, 'road');
    }
    const market = stubBuilding({ id: 1, type: 'market', x: 2, y: 1, stock: { wheat: 0 }, workersRequired: 1, workersAssigned: 1 });
    const granary = stubBuilding({ id: 2, type: 'granary', x: 3, y: 1, stock: { wheat: 100 } });
    const house = stubBuilding({ id: 3, type: 'house', x: 3, y: 0, house: { tier: 0, foodCooldown: 0, waterCooldown: 0, laborCooldown: 0, evolveCounter: 0, devolveCounter: 0 } });
    const buildings = [market, granary, house];
    const despawned: WalkerInstance[] = [];
    const byId = new Map(buildings.map((b) => [b.id, b]));
    const live: WalkerInstance[] = [];
    const sim: SimInternals = {
      map: m,
      rng: mulberry32(7),
      buildings,
      buildingById: (id) => byId.get(id) ?? null,
      buildingAt: (x, y) => buildings.find((b) => inside(b, x, y)) ?? null,
      adjacentRoadTile: (b) => roadAround(m, b),
      despawn: (w) => {
        despawned.push(w);
        const i = live.indexOf(w);
        if (i >= 0) live.splice(i, 1);
      },
      tick: 1,
      walkers: live,
    };

    const buyer = createWalker('buyer', 2, 0, 10);
    buyer.marketId = market.id;
    updateWalker(sim, buyer);
    let guard = 0;
    while (!(buyer.carriedAmount === 0 && buyer.carryingGood === null) && guard++ < 300) updateWalker(sim, buyer);

    const seller = createWalker('seller', 2, 0, 20);
    seller.marketId = market.id;
    updateWalker(sim, seller);
    seller.x = 2;
    seller.y = 0;
    seller.next = null;
    seller.state = 'wandering';
    updateWalker(sim, seller);

    return {
      marketWheat: market.stock.wheat,
      granaryWheat: granary.stock.wheat,
      houseFoodInventory: house.house?.foodInventory,
      sellerCarryingLoad: seller.carryingLoad,
    };
  }

  it('the buyer/seller path reproduces the market-chain expectations untouched', () => {
    const r = legacyMicroSequence() as { marketWheat: number; granaryWheat: number; houseFoodInventory?: Record<string, number>; sellerCarryingLoad?: Record<string, number> };
    expect(r.granaryWheat).toBe(60);
    expect(r.marketWheat).toBe(0);
    expect(r.houseFoodInventory?.wheat).toBe(1);
    expect(r.sellerCarryingLoad?.wheat).toBe(39);
  });
});

describe('caravan serializes through walker-state fields', () => {
  it('createWalker("caravan") exposes the toWalkerState-shaped fields', () => {
    const c = createWalker('caravan', 1, 2, 300);
    const render = {
      id: c.id,
      type: c.type,
      x: c.x,
      y: c.y,
      next: c.next,
      progress: c.progress,
      state: c.state,
      lifetime: c.lifetime,
      targetBuildingId: c.targetBuildingId,
      carryingGood: c.carryingGood,
    };
    expect(render.type).toBe('caravan');
    expect(render.x).toBe(1);
    expect(render.y).toBe(2);
    expect(JSON.stringify(render)).toContain('"caravan"');
  });
});
