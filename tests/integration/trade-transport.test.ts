/**
 * TRAD-03 (SC2) — physical transport integration proven against runner state.
 *
 * Scenario A: a caravan carries goods over the road graph between an entry tile
 * and a warehouse — capacity-bounded, no duplication (goods never in BOTH the
 * warehouse and the walker), destination deposit raises dest stock by exactly
 * the carried amount.
 * Scenario B: a caravan with no valid road waits `merchantWaitTicks` then leaves
 * without trading — no warehouse stock changes; the route (walker) is gone.
 * Scenario C: a merchant ship queues at a busy berth and a second ship unloads
 * only when a berth frees; the entrepot never buffers past capacity.
 * Scenario D: an expired mid-journey caravan restores its carried exports to the
 * source warehouse (no-loss, WR-02 trade extension).
 */
import { describe, it, expect } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { productionChainMap, buildProductionCity } from '../helpers';
import { Map as SimMap } from '../../src/sim/map';
import { createWalker, updateWalker } from '../../src/sim/walkers';
import type { SimInternals, WalkerInstance } from '../../src/sim/walkers';
import {
  createShip, shipDocks, entrepotReceive, CARAVAN_CAPACITY, SHIP_CAPACITY,
  type Berth,
} from '../../src/sim/transport';
import { CONFIG } from '../../src/sim/config';

function runUntil(internals: SimInternals, w: WalkerInstance, done: (w: WalkerInstance) => boolean, maxTicks = 600): void {
  for (let i = 0; i < maxTicks && !done(w); i++) updateWalker(internals, w);
}

describe('TRAD-03 Scenario A: caravan moves goods over the road graph with capacity', () => {
  it('carries ≤8 loads, never duplicates, and deposits at the destination', () => {
    const r = new SimRunner(11, productionChainMap());
    buildProductionCity(r);
    r.placeBuilding('warehouse', 14, 1); // destination on the same road row y=0
    const internals = r.getWalkerInternals();
    const src = internals.buildings.find((b) => b.type === 'warehouse' && b.x === 12 && b.y === 1)!;
    const dest = internals.buildings.find((b) => b.type === 'warehouse' && b.x === 14 && b.y === 1)!;
    (src.stock as Record<string, number>).pottery = 8;

    const caravan = createWalker('caravan', 0, 0, 5001); // entry road tile (0,0)
    caravan.trade = { good: 'pottery', amount: 8, isExport: true, capacity: CARAVAN_CAPACITY, sourceBuildingId: src.id, destBuildingId: dest.id, waitTicks: 0, loaded: false };

    // Step until the trip completes: loaded → walked → deposited & cleared.
    let carriedPeak = 0;
    let ticks = 0;
    const done = (w: WalkerInstance): boolean => !!w.trade?.loaded && w.carriedAmount === 0 && w.carryingGood === null;
    while (!done(caravan) && ticks++ < 400) {
      updateWalker(internals, caravan);
      const srcQty = (src.stock as Record<string, number>).pottery ?? 0;
      const destQty = (dest.stock as Record<string, number>).pottery ?? 0;
      const onWalker = caravan.carriedAmount;
      // no duplication: never in BOTH the warehouse and the walker
      expect(srcQty > 0 && onWalker > 0).toBe(false);
      carriedPeak = Math.max(carriedPeak, onWalker);
      expect(onWalker).toBeLessThanOrEqual(CARAVAN_CAPACITY); // capacity never exceeded
      // town units are conserved across the whole leg (no teleport, no loss)
      expect(srcQty + destQty + onWalker).toBe(8);
    }
    expect(ticks).toBeLessThan(400);
    expect(carriedPeak).toBeGreaterThan(0);
    expect(carriedPeak).toBeLessThanOrEqual(CARAVAN_CAPACITY);
    expect((src.stock as Record<string, number>).pottery ?? 0).toBe(0);
    const state = r.getState().buildings;
    const d = state.find((b) => b.type === 'warehouse' && b.x === 14 && b.y === 1)!;
    expect(d.stock.pottery ?? 0).toBe(8); // dest rises by exactly the carried amount
  });
});

describe('TRAD-03 Scenario B: no-road caravan waits a limited window then leaves without trading (§19.3)', () => {
  it('despawns after merchantWaitTicks without changing any warehouse stock', () => {
    const map = SimMap.fromLayout(8, 8, () => 'earth');
    const r = new SimRunner(3, map);
    r.placeBuilding('road', 0, 0); // isolated entry tile
    r.placeBuilding('road', 5, 5); // disconnected pocket (no path from entry)
    r.placeBuilding('road', 6, 5);
    r.placeBuilding('warehouse', 5, 6); // 2x2, road above at (5,5)/(6,5)

    // put the caravan into the runner's live walker list so despawn is observable
    const internals = r.getWalkerInternals();
    const wh = internals.buildings.find((b) => b.type === 'warehouse')!;
    (wh.stock as Record<string, number>).pottery = 5;
    const caravan = createWalker('caravan', 0, 0, 5101);
    caravan.trade = { good: 'pottery', amount: 8, isExport: true, capacity: CARAVAN_CAPACITY, sourceBuildingId: wh.id, destBuildingId: null, waitTicks: 0, loaded: false };
    (internals.walkers as WalkerInstance[]).push(caravan);

    // Step well past the merchant wait window → the caravan leaves, untraded.
    for (let i = 0; i < CONFIG.merchantWaitTicks + 10; i++) updateWalker(internals, caravan);

    // no trade happened: the warehouse stock is untouched and the walker holds nothing
    expect((wh.stock as Record<string, number>).pottery).toBe(5);
    expect(caravan.carryingGood).toBeNull();
    expect(caravan.carriedAmount).toBe(0);
    // the walker is gone from runner state
    expect(r.getState().walkers.some((w) => w.id === caravan.id)).toBe(false);
  });
});

describe('TRAD-03 Scenario C: merchant ship berth queue + entrepot cap', () => {
  it('a second ship queues at a full berth and docks only when one frees; entrepot caps buffering', () => {
    const berth: Berth = { id: 'wharf', berths: 1, inUse: 0 };
    const first = createShip('s1', SHIP_CAPACITY);
    const second = createShip('s2', SHIP_CAPACITY);
    expect(shipDocks(first, berth)).toBe(true);
    expect(berth.inUse).toBe(1);
    // second ship queues — no free berth
    expect(shipDocks(second, berth)).toBe(false);
    expect(second.waiting).toBe(true);
    // freeing the berth lets the second dock and unload
    berth.inUse -= 1;
    expect(shipDocks(second, berth)).toBe(true);
    // entrepot stages the unload up to capacity, never past it
    const entrepot = { capacity: SHIP_CAPACITY, stored: 0 };
    expect(entrepotReceive(entrepot, 12)).toBe(12);
    expect(entrepotReceive(entrepot, 10)).toBe(4); // only 4 fit
    expect(entrepot.stored).toBe(SHIP_CAPACITY);
  });
});

describe('TRAD-03 Scenario D: expired mid-journey caravan restores exports (no-loss)', () => {
  it('the source warehouse regains carried units when the trip expires', () => {
    const r = new SimRunner(21, productionChainMap());
    buildProductionCity(r);
    const internals = r.getWalkerInternals();
    const src = internals.buildings.find((b) => b.type === 'warehouse' && b.x === 12 && b.y === 1)!;
    (src.stock as Record<string, number>).pottery = 8;

    const caravan = createWalker('caravan', 0, 0, 6001);
    caravan.trade = { good: 'pottery', amount: 8, isExport: true, capacity: CARAVAN_CAPACITY, sourceBuildingId: src.id, destBuildingId: null, waitTicks: 0, loaded: false };

    // Let it collect 8 at the source.
    runUntil(internals, caravan, (w) => w.carriedAmount > 0, 300);
    expect(caravan.carriedAmount).toBe(8);
    expect((src.stock as Record<string, number>).pottery ?? 0).toBe(0);

    // Expire the trip → the 8 units return to the source.
    caravan.lifetime = 1;
    updateWalker(internals, caravan);
    expect((src.stock as Record<string, number>).pottery ?? 0).toBe(8);
    expect(caravan.carryingGood).toBeNull();
    expect(caravan.carriedAmount).toBe(0);
  });
});
