/**
 * Composed distribution-priority tests (MARK-03, decision 5; §18.4/§12.11/§12.15).
 *
 * marketLoadComposition derives the seller's load order from the market config —
 * basic/essential food first, then the evolution-blocking good, then remaining
 * stocked products — skipping refused products, bounded by per-food caps and the
 * 100-unit capacity. policyOrder is additionally composed over a realistic
 * market-serving house set for promote-evolution and patrician-reserve,
 * matching the 08-01 matrix contract.
 */
import { describe, expect, it } from 'vitest';
import {
  marketLoadComposition, defaultMarketConfig, policyOrder,
  MARKET_FOOD_CAPS, SELLER_CAPACITY,
} from '../../src/sim/logistics';
import type { HouseServingInfo } from '../../src/sim/logistics';

describe('marketLoadComposition: composed distribution priority (§18.4/§12.11, decision 5)', () => {
  it('fills essential food before the evolution-blocking good and never exceeds capacity', () => {
    const cfg = defaultMarketConfig();
    const load = marketLoadComposition(
      cfg,
      { wheat: 60, vegetables: 50, fruit: 30 },
      MARKET_FOOD_CAPS,
      SELLER_CAPACITY,
      { basicFood: 'wheat', evolutionBlocking: 'vegetables', priorities: [] },
    );
    // Wheat (essential) is filled first: 60, then vegetables 40 (capacity bound).
    expect(load.wheat).toBe(60);
    expect(load.vegetables).toBe(40);
    const total = Object.values(load).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(SELLER_CAPACITY);
    // The composed key order reflects the priority: essential precedes blocking good.
    const keys = Object.keys(load);
    expect(keys.indexOf('wheat')).toBeLessThan(keys.indexOf('vegetables'));
  });

  it('places the evolution-blocking good after the basic food in the composed load', () => {
    const cfg = defaultMarketConfig();
    const load = marketLoadComposition(
      cfg,
      { wheat: 60, vegetables: 50, fruit: 30 },
      MARKET_FOOD_CAPS,
      SELLER_CAPACITY,
      { basicFood: 'wheat', evolutionBlocking: 'vegetables', priorities: [] },
    );
    expect(load.vegetables).toBeGreaterThan(0); // the blocking good is next in line
    expect(Object.keys(load)).toEqual(['wheat', 'vegetables']);
  });

  it('never loads a product refused by the market config, even when stocked', () => {
    const cfg = defaultMarketConfig();
    cfg.productRules.fruit = 'refuse';
    const load = marketLoadComposition(
      cfg,
      { wheat: 60, vegetables: 50, fruit: 90 },
      MARKET_FOOD_CAPS,
      SELLER_CAPACITY,
      { basicFood: 'wheat', evolutionBlocking: 'vegetables', priorities: ['fruit'] },
    );
    expect(load.fruit).toBeUndefined(); // refused → excluded even when stocked + prioritized
    expect(load.wheat).toBe(60);
    expect(load.vegetables).toBe(40);
    expect(Object.values(load).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(SELLER_CAPACITY);
  });

  it('bounds each food by its per-food cap and the total by capacity across configurations', () => {
    const cfg = defaultMarketConfig();
    const scenarios: Array<{ stock: Record<string, number>; caps: Record<string, number>; opts: Parameters<typeof marketLoadComposition>[4] }> = [
      { stock: { wheat: 1000, vegetables: 1000 }, caps: { wheat: 200, vegetables: 100 }, opts: { basicFood: 'wheat', evolutionBlocking: 'vegetables' } },
      { stock: { wheat: 80, vegetables: 60 }, caps: { wheat: 50, vegetables: 0 }, opts: { basicFood: 'wheat' } },
      { stock: { wheat: 10, fruit: 10, fish: 10 }, caps: MARKET_FOOD_CAPS, opts: { basicFood: 'wheat', priorities: ['fish'] } },
    ];
    for (const { stock, caps, opts } of scenarios) {
      const load = marketLoadComposition(cfg, stock, caps, SELLER_CAPACITY, opts);
      for (const [f, amt] of Object.entries(load)) {
        expect(amt).toBeLessThanOrEqual(caps[f] ?? SELLER_CAPACITY);
      }
      expect(Object.values(load).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(SELLER_CAPACITY);
    }
  });
});

describe('policyOrder composed over a realistic market-serving house set (MARK-03, decision 5)', () => {
  const houses: HouseServingInfo[] = [
    { id: 'low-evolution', tier: 1, daysSinceVisit: 5, basicFoodDays: 4, missingVariety: 0, distance: 3 },
    { id: 'mid-evolution', tier: 3, daysSinceVisit: 5, basicFoodDays: 4, missingVariety: 3, distance: 3 },
    { id: 'high-evolution', tier: 3, daysSinceVisit: 5, basicFoodDays: 4, missingVariety: 5, distance: 3 },
    { id: 'low-tier', tier: 1, daysSinceVisit: 9, basicFoodDays: 4, missingVariety: 0, distance: 5 },
    { id: 'high-tier', tier: 6, daysSinceVisit: 9, basicFoodDays: 4, missingVariety: 0, distance: 5 },
  ];

  it('promote-evolution orders the higher-missing-variety house first', () => {
    const order = policyOrder('promote-evolution', houses).map((h) => h.id);
    expect(order[0]).toBe('high-evolution'); // highest missingVariety (5)
    expect(order[1]).toBe('mid-evolution'); // then 3
  });

  it('patrician-reserve orders the higher-tier house first', () => {
    const order = policyOrder('patrician-reserve', houses).map((h) => h.id);
    expect(order[0]).toBe('high-tier'); // tier 6
    expect(order.indexOf('high-tier')).toBeLessThan(order.indexOf('mid-evolution'));
    expect(order.indexOf('mid-evolution')).toBeLessThan(order.indexOf('low-tier')); // higher tier served before lower
  });
});
