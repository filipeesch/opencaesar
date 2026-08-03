/**
 * Distribution-priority matrix (MARK-03, decision 5; spec §18.4/§12.11/§12.15).
 *
 * Test-only lock of the pre-drafted distribution model in src/sim/logistics.ts:
 *  - policyOrder orders houses by all five MarketServicePolicy options
 *    (balanced default, avoid-hunger, promote-evolution, local-district,
 *    patrician-reserve) with each policy's documented primary key deciding;
 *  - nextPickPriority picks essential food first, then the evolution-blocking
 *    good, then null when both are stocked;
 *  - sellerLoadComposition fills its 100-unit capacity honoring passed
 *    priorities within per-food caps, excluding zero-cap foods, and never
 *    exceeding SELLER_CAPACITY.
 */
import { describe, expect, it } from 'vitest';
import {
  policyOrder, sellerLoadComposition, nextPickPriority,
  SELLER_CAPACITY, MARKET_FOOD_CAPS,
} from '../../src/sim/logistics';
import type { HouseServingInfo } from '../../src/sim/logistics';

const houses: HouseServingInfo[] = [
  { id: 'local', tier: 1, daysSinceVisit: 8, basicFoodDays: 3, missingVariety: 0, distance: 1 },
  { id: 'balanced', tier: 1, daysSinceVisit: 1, basicFoodDays: 5, missingVariety: 0, distance: 5 },
  { id: 'evolve', tier: 1, daysSinceVisit: 7, basicFoodDays: 4, missingVariety: 5, distance: 7 },
  { id: 'hungry', tier: 1, daysSinceVisit: 6, basicFoodDays: 1, missingVariety: 0, distance: 6 },
  { id: 'patrician', tier: 8, daysSinceVisit: 9, basicFoodDays: 2, missingVariety: 0, distance: 9 },
];

describe('full service-policy ordering matrix (MARK-03 §18.4/§12.15, decision 5)', () => {
  it("'balanced' (default) orders by daysSinceVisit ascending", () => {
    const order = policyOrder('balanced', houses).map((h) => h.id);
    expect(order[0]).toBe('balanced'); // lowest daysSinceVisit (1)
  });

  it("'avoid-hunger' orders by basicFoodDays ascending, then daysSinceVisit", () => {
    const order = policyOrder('avoid-hunger', houses).map((h) => h.id);
    expect(order[0]).toBe('hungry'); // lowest basicFoodDays (1)
  });

  it("'promote-evolution' orders by missingVariety descending, then daysSinceVisit", () => {
    const order = policyOrder('promote-evolution', houses).map((h) => h.id);
    expect(order[0]).toBe('evolve'); // highest missingVariety (5)
  });

  it("'local-district' orders by distance ascending, then daysSinceVisit", () => {
    const order = policyOrder('local-district', houses).map((h) => h.id);
    expect(order[0]).toBe('local'); // nearest (distance 1)
  });

  it("'patrician-reserve' orders by tier descending, then daysSinceVisit", () => {
    const order = policyOrder('patrician-reserve', houses).map((h) => h.id);
    expect(order[0]).toBe('patrician'); // highest tier (8)
  });

  it('primary-key ties fall back to daysSinceVisit (balanced)', () => {
    const tied: HouseServingInfo[] = [
      { id: 'a', tier: 1, daysSinceVisit: 5, basicFoodDays: 2, missingVariety: 0, distance: 3 },
      { id: 'b', tier: 1, daysSinceVisit: 1, basicFoodDays: 2, missingVariety: 0, distance: 3 },
      { id: 'c', tier: 1, daysSinceVisit: 3, basicFoodDays: 2, missingVariety: 0, distance: 3 },
    ];
    const order = policyOrder('balanced', tied).map((h) => h.id);
    expect(order).toEqual(['b', 'c', 'a']); // daysSinceVisit 1, 3, 5
  });
});

describe('priority order: essential food then evolution-blocking good (MARK-03 §12.11 §18.4, decision 5)', () => {
  it('nextPickPriority picks an essential food first when any essential food is at zero current', () => {
    expect(nextPickPriority(['wheat', 'vegetables'], 'pottery', { wheat: 0, vegetables: 5 })).toBe('wheat');
  });

  it('nextPickPriority picks the evolution-blocking good when essentials are stocked', () => {
    expect(nextPickPriority(['wheat', 'vegetables'], 'pottery', { wheat: 5, vegetables: 5 })).toBe('pottery');
  });

  it('nextPickPriority returns null when both essentials and the blocking good are stocked', () => {
    expect(nextPickPriority(['wheat', 'vegetables'], 'pottery', { wheat: 5, vegetables: 5, pottery: 5 })).toBeNull();
  });

  it('sellerLoadComposition fills the 100-unit capacity honoring priority within per-food caps', () => {
    const load = sellerLoadComposition(
      { wheat: 80, vegetables: 60 },
      { wheat: 50, vegetables: 50 },
      SELLER_CAPACITY,
      ['wheat', 'vegetables'],
    );
    expect(load).toEqual({ wheat: 50, vegetables: 50 }); // each bounded by its per-food cap, total = 100
    expect(Object.values(load).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(SELLER_CAPACITY);
  });

  it('a per-food cap of 0 excludes that food from the load even when stocked', () => {
    const load = sellerLoadComposition(
      { wheat: 80, vegetables: 60 },
      { wheat: 50, vegetables: 0 },
      SELLER_CAPACITY,
      ['wheat', 'vegetables'],
    );
    expect(load.wheat).toBe(50);
    expect(load.vegetables).toBeUndefined();
    expect(Object.values(load).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(SELLER_CAPACITY);
  });

  it('the total load never exceeds SELLER_CAPACITY across all compositions', () => {
    const load = sellerLoadComposition({ wheat: 1000, vegetables: 1000, fruit: 1000 }, { wheat: 200, vegetables: 100, fruit: 100 }, SELLER_CAPACITY, ['wheat', 'vegetables']);
    const total = Object.values(load).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(SELLER_CAPACITY);
    expect((load.wheat ?? 0)).toBeLessThanOrEqual(MARKET_FOOD_CAPS.wheat ?? 0);
    expect((load.vegetables ?? 0)).toBeLessThanOrEqual(MARKET_FOOD_CAPS.vegetables ?? 0);
  });
});
