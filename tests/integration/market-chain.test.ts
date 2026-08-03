/**
 * Runner-integrated buyer→market→seller→house chain test (MARK-01, decision 2).
 *
 * Drives the multi-food buyer/seller walkers against the REAL SimRunner's live
 * state through the additive getWalkerInternals() seam (which returns the same
 * SimInternals object the runner uses for updateWalker), asserting results via
 * runner.getState() and the live building registry. This closes the gap left by
 * the hand-rolled food-slice stub: here every stock change lands in runner-owned
 * buildings, so the physical end-state is observable and nothing is teleported,
 * lost, or double-picked.
 */
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { foodChainMap } from '../helpers';
import { createWalker, updateWalker } from '../../src/sim/walkers';
import type { SimInternals, WalkerInstance } from '../../src/sim/walkers';

const BUYER_FETCH = 40;

/** Build a minimal market city on a shared foodChainMap: road row y=0 linking a
 *  granary (1,1), a market (4,1), a seller tile (7,0), and a house (8,0)
 *  orthogonally adjacent to that tile. Ids are resolved from the live runner
 *  buildings (roads consume ids too). The market is staffed via the live seam so
 *  marketAgents() allocates a buyer/seller. */
function buildMarketCity(runner: SimRunner, granaryWheat: number): { marketId: number; granaryId: number; houseId: number } {
  for (let x = 0; x <= 7; x++) {
    runner.placeBuilding('road', x, 0);
  }
  runner.placeBuilding('granary', 1, 1); // 2x2, road above at (1,0)
  runner.placeBuilding('market', 4, 1); // 2x2, road above at (4,0)/(5,0)
  runner.placeBuilding('house', 8, 0); // orthogonal neighbor of road (7,0)
  const internals = runner.getWalkerInternals();
  const granary = internals.buildings.find((b) => b.type === 'granary')!;
  const market = internals.buildings.find((b) => b.type === 'market')!;
  const house = internals.buildings.find((b) => b.type === 'house')!;
  market.workersAssigned = Math.max(1, market.workersRequired);
  granary.stock.wheat = granaryWheat;
  return { marketId: market.id, granaryId: granary.id, houseId: house.id };
}

function runUntilDone(internals: SimInternals, w: WalkerInstance, complete: (w: WalkerInstance) => boolean, maxTicks: number): void {
  for (let i = 0; i < maxTicks && !complete(w); i++) updateWalker(internals, w);
}

describe('buyer→market→seller→house chain against runner state (MARK-01, decision 2)', () => {
  it('buyer reserves at departure and deposits on arrival — nothing teleported or lost', () => {
    const runner = new SimRunner(11, foodChainMap());
    runner.tick(); // advance tick past 0 so coverage timestamps are meaningful
    const { marketId, granaryId, houseId } = buildMarketCity(runner, 100);
    const internals = runner.getWalkerInternals();

    const buyer = createWalker('buyer', 4, 0, 5001); // market's adjacent road
    buyer.marketId = marketId;

    // Reserve at departure: granary falls by exactly BUYER_FETCH, market unchanged.
    updateWalker(internals, buyer);
    expect(buyer.carryingGood).toBe('wheat');
    expect(buyer.carriedAmount).toBe(BUYER_FETCH);
    expect(internals.buildingById(granaryId)!.stock.wheat).toBe(60);
    expect(internals.buildingById(marketId)!.stock.wheat ?? 0).toBe(0);

    // Deplete the trip: on arrival the market stock rises by exactly 40.
    runUntilDone(internals, buyer, (w) => w.carriedAmount === 0 && w.carryingGood === null, 500);
    expect(internals.buildingById(marketId)!.stock.wheat).toBe(40);
    expect(internals.buildingById(granaryId)!.stock.wheat).toBe(60);
    // Runner-visible state matches the physical end-state.
    const market = runner.getState().buildings.find((b) => b.type === 'market')!;
    const granary = runner.getState().buildings.find((b) => b.type === 'granary')!;
    expect(market.stock.wheat).toBe(40);
    expect(granary.stock.wheat).toBe(60);
    void houseId;
  });

  it('seller composes a load from market stock and delivers to an adjacent house (foodInventory + marketCoverage)', () => {
    const runner = new SimRunner(12, foodChainMap());
    runner.tick();
    const { marketId, houseId } = buildMarketCity(runner, 100);
    const internals = runner.getWalkerInternals();
    internals.buildingById(marketId)!.stock.wheat = 40; // what a buyer just deposited

    const seller = createWalker('seller', 7, 0, 6001); // adjacent to house (8,0)
    seller.marketId = marketId;

    // First update: the seller is at its origin → composes the load and deducts
    // it from market stock (no delivery yet — coverage runs pre-decide).
    updateWalker(internals, seller);
    expect(seller.carryingLoad?.wheat).toBe(40);
    expect(internals.buildingById(marketId)!.stock.wheat ?? 0).toBe(0);

    // Deterministic delivery: park the seller next to the house and step once.
    seller.x = 7;
    seller.y = 0;
    seller.next = null;
    seller.state = 'wandering';
    updateWalker(internals, seller);
    expect(internals.buildingById(houseId)!.house?.foodCooldown).toBeGreaterThan(0);
    expect(internals.buildingById(houseId)!.house?.foodInventory?.wheat).toBe(1);
    // marketCoverage bookkeeping (§12.13) on the live house.
    expect(internals.buildingById(houseId)!.house?.marketCoverage?.servingMarketId).toBe(String(marketId));
    expect(internals.buildingById(houseId)!.house?.marketCoverage?.foodDeliveredByType.wheat).toBe(1);
    expect(internals.buildingById(houseId)!.house?.marketCoverage?.lastMarketVisit).toBe(1);
    expect(seller.carryingLoad?.wheat).toBe(39); // load decremented, nothing lost
    // Runner snapshot records the delivered food inventory.
    const house = runner.getState().buildings.find((b) => b.type === 'house')!;
    expect(house.house?.foodInventory?.wheat).toBe(1);
  });

  it('two buyers stepping against one granary never double-pick; total held never exceeds stock', () => {
    const runner = new SimRunner(13, foodChainMap());
    runner.tick();
    const { marketId, granaryId } = buildMarketCity(runner, 100);
    const internals = runner.getWalkerInternals();

    const buyer1 = createWalker('buyer', 4, 0, 7001);
    buyer1.marketId = marketId;
    const buyer2 = createWalker('buyer', 5, 0, 7002);
    buyer2.marketId = marketId;

    updateWalker(internals, buyer1); // reserves 40 → granary 60
    expect(buyer1.carriedAmount).toBe(BUYER_FETCH);
    expect(internals.buildingById(granaryId)!.stock.wheat).toBe(60);

    updateWalker(internals, buyer2); // reads the reduced stock → at most 40
    expect(buyer2.carriedAmount).toBe(40);
    expect(internals.buildingById(granaryId)!.stock.wheat).toBe(20);
    // Sum of both buyers' carries never exceeds the granary's original 100, and
    // the granary never goes negative.
    expect(buyer1.carriedAmount + buyer2.carriedAmount).toBeLessThanOrEqual(100);
    expect(internals.buildingById(granaryId)!.stock.wheat).toBeGreaterThanOrEqual(0);

    // Both complete: market receives exactly what was reserved (80), granary 20.
    runUntilDone(internals, buyer1, (w) => w.carriedAmount === 0 && w.carryingGood === null, 500);
    runUntilDone(internals, buyer2, (w) => w.carriedAmount === 0 && w.carryingGood === null, 500);
    expect(internals.buildingById(marketId)!.stock.wheat).toBe(80);
    expect(internals.buildingById(granaryId)!.stock.wheat).toBe(20);
    const market = runner.getState().buildings.find((b) => b.type === 'market')!;
    const granary = runner.getState().buildings.find((b) => b.type === 'granary')!;
    expect(market.stock.wheat).toBe(80);
    expect(granary.stock.wheat).toBe(20);
    expect((market.stock.wheat ?? 0) + (granary.stock.wheat ?? 0)).toBe(100);
  });
});
