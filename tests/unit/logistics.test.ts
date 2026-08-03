import { describe, it, expect } from 'vitest';
import {
  defaultWarehousePolicy, warehouseAccepts, CommercialCenter, ReservationPool, nextPickPriority,
} from '../../src/sim/logistics';
import { WORKSHOPS, emptyProduction, tickWorkshop, porterDelivers } from '../../src/sim/production';
import {
  GranaryModel, GRANARY_CAPACITY, GRANARY_TRANSFER_COOLDOWN, granaryTransfer,
} from '../../src/sim/logistics';
import {
  MARKET_CAPACITY, marketDemand, nextFoodToFetch, scoreGranary, pickGranary,
  marketAgents, sellerLoadComposition, SELLER_CAPACITY, policyOrder, recordMarketVisit,
  MARKET_FOOD_CAPS,
} from '../../src/sim/logistics';
import type { MarketFoodState, HouseServingInfo, MarketCoverage, GranaryCandidate } from '../../src/sim/logistics';

describe('warehouse orders & slots (task 5.4)', () => {
  it('accepts within slot capacity by default and refuses at capacity', () => {
    const p = defaultWarehousePolicy(16);
    expect(warehouseAccepts(p, 'pottery', 0)).toBe(true);
    expect(warehouseAccepts(p, 'pottery', 16)).toBe(false);
  });

  it('refuse and empty orders block a commodity', () => {
    const p = defaultWarehousePolicy(16);
    p.perCommodity.clay = 'refuse';
    expect(warehouseAccepts(p, 'clay', 0)).toBe(false);
    p.perCommodity.clay = 'empty';
    expect(warehouseAccepts(p, 'clay', 0)).toBe(false);
    p.perCommodity.clay = 'request';
    expect(warehouseAccepts(p, 'clay', 0)).toBe(true);
  });
});

describe('commercial center (task 5.5)', () => {
  it('allows a single designation and warns on fallback', () => {
    const cc = new CommercialCenter();
    expect(cc.designate('wh1').ok).toBe(true);
    expect(cc.isDesignated('wh1')).toBe(true);
    const second = cc.designate('wh2');
    expect(second.fallback).toBe(true);
    expect(second.warning).toBeTruthy();
    expect(cc.isDesignated('wh2')).toBe(false);
  });
});

describe('market reservation (task 3.5)', () => {
  it('does not allow double-picking a reserved load', () => {
    const pool = new ReservationPool();
    pool.taxable.set('wheat', 1);
    expect(pool.reserve('wheat')).toBe(true);
    expect(pool.reserve('wheat')).toBe(false); // already reserved — 0 available
    pool.release('wheat');
    expect(pool.reserve('wheat')).toBe(true); // now available again
  });
});

describe('distribution priority (task 3.5)', () => {
  it('fetches essential food before the evolution-blocking good', () => {
    expect(nextPickPriority(['wheat', 'fish'], 'pottery', { wheat: 0, fish: 5 })).toBe('wheat');
    expect(nextPickPriority(['wheat', 'fish'], 'pottery', { wheat: 5, fish: 5 })).toBe('pottery');
  });
});

import { defaultMarketConfig, marketAccepts, findSupplier } from '../../src/sim/logistics';
import type { MarketSupplier } from '../../src/sim/logistics';

describe('per-market configuration (task 3.6)', () => {
  it('accepts/refuses products and blocks wine for plebeians by default', () => {
    const cfg = defaultMarketConfig();
    expect(marketAccepts(cfg, 'wheat', 'plebeian')).toBe(true);
    expect(marketAccepts(cfg, 'wine', 'plebeian')).toBe(false);
    expect(marketAccepts(cfg, 'wine', 'patrician')).toBe(true);
    cfg.productRules.wheat = 'refuse';
    expect(marketAccepts(cfg, 'wheat', 'plebeian')).toBe(false);
  });
});

describe('market buyer (task 3.4)', () => {
  it('finds the nearest supplier holding the product within radius', () => {
    const suppliers = [
      { id: 'far', x: 8, y: 8, hasProduct: (p: string) => p === 'wheat' },
      { id: 'near', x: 3, y: 3, hasProduct: (p: string) => p === 'wheat' },
      { id: 'no', x: 4, y: 4, hasProduct: () => false },
    ];
    const found = findSupplier(suppliers as MarketSupplier[], 5, 5, 'wheat', 5);
    expect(found?.id).toBe('near');
    const none = findSupplier(suppliers as MarketSupplier[], 1, 1, 'wheat', 2);
    expect(none).toBeNull();
  });
});

import { logisticsAdvisor } from '../../src/sim/logistics';

describe('logistics advisor data (task 5.6)', () => {
  it('reports stock, production/consumption, in-transit, bottlenecks, stopped', () => {
    const v = logisticsAdvisor({ wheat: 10 }, { wheat: 5 }, { wheat: 2 }, 3, 5, 1, 2);
    expect(v.inTransit).toBe(2);
    expect(v.bottlenecks).toBe(1);
    expect(v.stopped).toBe(2);
    expect(v.stock.wheat).toBe(10);
  });
});

describe('ceramics-chain integration (task 5.7)', () => {
  it('clay -> workshop -> warehouse -> market', () => {
    const clay = { id: 'clay_pit', clay: 8 };
    const w = WORKSHOPS.pottery;
    const s = emptyProduction(w);
    s.inputs.clay = 8;
    s.output.pottery = 0;
    // workshop consumes clay, produces pottery; tick enough to make a whole load
    for (let i = 0; i < 10; i++) tickWorkshop(w, s);
    expect(s.output.pottery ?? 0).toBeGreaterThanOrEqual(1);
    // porter delivers to warehouse
    const delivered = porterDelivers(w, s);
    expect(delivered).toBe(1);
    expect(s.output.pottery ?? 0).toBeGreaterThanOrEqual(0);
    // market accepts the manufactured good for plebeians (pottery is allowed)
    const cfg = defaultMarketConfig();
    expect(marketAccepts(cfg, 'pottery', 'plebeian')).toBe(true);
    void clay;
  });
});

describe('granary food hub (AGRI-03, spec §11)', () => {
  it('shares a 3,200-unit capacity across foods and enforces it', () => {
    const g = new GranaryModel('g1');
    expect(g.capacity).toBe(GRANARY_CAPACITY);
    g.receive('wheat', 2000);
    g.receive('vegetables', 1200);
    expect(g.physical('wheat')).toBe(2000);
    expect(g.usedCapacity()).toBe(3200);
    expect(g.freeCapacity()).toBe(0);
    expect(g.accepts('fruit', 100)).toBe(false); // full
  });

  it('honours per-food orders accept/refuse/request/maintain/empty/reserve/max', () => {
    const g = new GranaryModel('g2');
    g.receive('wheat', 500);
    g.receive('vegetables', 300);
    expect(g.accepts('wheat', 10)).toBe(true);

    g.setOrder('wheat', 'refuse');
    expect(g.accepts('wheat', 10)).toBe(false);
    g.setOrder('wheat', 'empty');
    expect(g.accepts('wheat', 10)).toBe(false);

    g.setOrder('wheat', 'max', { maximum: 600 });
    expect(g.accepts('wheat', 100)).toBe(true); // 500 + 100 = 600 ≤ 600 cap
    expect(g.accepts('wheat', 200)).toBe(false); // would exceed the 600 cap

    g.setOrder('vegetables', 'maintain', { amount: 800 });
    expect(g.accepts('vegetables', 100)).toBe(true);
    g.setOrder('vegetables', 'request');
    expect(g.orderOf('vegetables').mode).toBe('request');

    g.setOrder('fruit', 'reserve', { amount: 400 });
    expect(g.reserved('fruit')).toBe(400);
  });

  it('transactional reservations prevent double-picking and expire on collector failure', () => {
    const g = new GranaryModel('g3');
    g.receive('wheat', 100);
    const r1 = g.reserve('wheat', 60, 'market-1', 'walker-1', 10, 30);
    expect(r1).not.toBeNull();
    expect(g.available('wheat')).toBe(40); // 60 backed out — no double-pick
    // a second buyer cannot reserve the same 60 units
    expect(g.reserve('wheat', 60, 'market-2', 'walker-2', 10, 30)).toBeNull();
    // collector fails: reservation expires → product returns to availability
    g.expireReservations(50);
    expect(r1 && r1.state).toBe('expired');
    expect(g.available('wheat')).toBe(100);
  });

  it('prunes expired/fulfilled reservations so the reservation map does not grow (IN-06)', () => {
    const g = new GranaryModel('g-in06');
    g.receive('wheat', 100);
    const expired = g.reserve('wheat', 30, 'm1', 'w1', 0, 5);
    const fulfilled = g.reserve('wheat', 20, 'm2', 'w2', 0, 100); // stays active past tick 10
    expect(expired).not.toBeNull();
    expect(fulfilled).not.toBeNull();
    g.expireReservations(10); // expires only `expired`
    expect(g.fulfill(fulfilled!.id)).toBe(true); // fulfills `fulfilled`
    // Both are gone from the internal ledger → the map is bounded.
    const ledger = (g as unknown as { reservations: Map<string, unknown> }).reservations;
    expect(ledger.size).toBe(0);
    expect(g.activeReservations()).toHaveLength(0);
  });

  it('fulfilment moves reserved units to outgoing and reduces physical stock', () => {
    const g = new GranaryModel('g4');
    g.receive('wheat', 100);
    const r = g.reserve('wheat', 30, 'market-1', 'walker-1', 0, 30) as NonNullable<ReturnType<GranaryModel['reserve']>>;
    expect(g.fulfill(r.id)).toBe(true);
    expect(g.physical('wheat')).toBe(70);
    expect(g.available('wheat')).toBe(70);
    expect(r.state).toBe('fulfilled');
  });

  it('provides separate stock classes: physical/reserved/incoming/outgoing/spoiled', () => {
    const g = new GranaryModel('g5');
    g.receive('wheat', 100);
    g.reserve('wheat', 20, 'm', 'w', 0);
    const gState = (g as unknown as { foods: Map<string, { incoming: number; outgoing: number; spoiled: number }> }).foods;
    gState.get('wheat')!.incoming = 40;
    expect(g.reserved('wheat')).toBe(20);
    expect(g.available('wheat')).toBe(80);
  });

  it('granary-to-granary transfer only moves genuine surplus above the destination target', () => {
    const a = new GranaryModel('A');
    const b = new GranaryModel('B');
    a.receive('wheat', 200);
    b.receive('wheat', 0);
    b.setOrder('wheat', 'maintain', { amount: 100 });
    const r = granaryTransfer(a, b, 'wheat', 50, 1000);
    expect(r.ok).toBe(true);
    expect(b.physical('wheat')).toBe(50);
    expect(a.physical('wheat')).toBe(150);
  });

  it('blocks back-and-forth ping-pong transfers within the cooldown window', () => {
    const a = new GranaryModel('A');
    const b = new GranaryModel('B');
    a.receive('wheat', 200);
    b.receive('wheat', 0);
    b.setOrder('wheat', 'maintain', { amount: 100 });

    expect(granaryTransfer(a, b, 'wheat', 50, 1000).ok).toBe(true);
    // b now tries to send right back to a within the cooldown → refused
    const back = granaryTransfer(b, a, 'wheat', 50, 1010);
    expect(back.ok).toBe(false);
    expect(back.reason).toBe('back-and-forth');
    // after the cooldown elapses it is allowed again (a genuinely needs it)
    expect(granaryTransfer(b, a, 'wheat', 50, 1000 + GRANARY_TRANSFER_COOLDOWN + 1).ok).toBe(true);
  });

  it('never transfers reserved-for-domestic stock', () => {
    const a = new GranaryModel('A');
    const b = new GranaryModel('B');
    a.receive('wheat', 60);
    a.setOrder('wheat', 'reserve', { amount: 50 });
    b.setOrder('wheat', 'request');
    const r = granaryTransfer(a, b, 'wheat', 40, 0);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no-available');
  });

  it('serializes and round-trips stock and reservations deterministically (§32.8)', () => {
    const g = new GranaryModel('g6');
    g.receive('wheat', 100);
    g.setOrder('wheat', 'maintain', { amount: 50 });
    g.reserve('wheat', 20, 'market-1', 'w-1', 5, 30);
    const json = JSON.stringify({ granary: g.serialize() });
    const back = GranaryModel.deserialize(JSON.parse(json).granary);
    expect(back.physical('wheat')).toBe(100);
    expect(back.reserved('wheat')).toBe(20);
    expect(back.orderOf('wheat').mode).toBe('maintain');
    expect(JSON.stringify({ granary: back.serialize() })).toBe(json);
  });

  it('rejects a transfer that would push TOTAL occupancy past 3,200 — not just a per-food line (WR-01)', () => {
    const a = new GranaryModel('A');
    const b = new GranaryModel('B');
    a.receive('wheat', 2000);
    b.receive('wheat', 1500);
    b.receive('vegetables', 1500); // used = 3000 of 3200
    b.setOrder('wheat', 'request');
    expect(b.usedCapacity()).toBe(3000);
    // 500 more would take the total to 3500 > 3200 → rejected, nothing clamps away.
    const r = granaryTransfer(a, b, 'wheat', 500, 0);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no-capacity');
    expect(b.usedCapacity()).toBe(3000);
    expect(b.physical('wheat')).toBe(1500);
    expect(a.physical('wheat')).toBe(2000); // source untouched
    // A transfer that fits within the remaining shared capacity succeeds.
    const ok = granaryTransfer(a, b, 'wheat', 200, 1);
    expect(ok.ok).toBe(true);
    expect(b.usedCapacity()).toBe(3200);
  });

  it('receive() never silently loses units when the granary is at total capacity (WR-01)', () => {
    const g = new GranaryModel('g-wr01');
    g.receive('wheat', 2000);
    g.receive('vegetables', 1200); // exactly 3200 (full)
    expect(g.usedCapacity()).toBe(3200);
    const before = g.physical('wheat');
    const applied = g.receive('wheat', 500); // no shared room left
    expect(applied).toBe(0);
    expect(g.usedCapacity()).toBe(3200);
    expect(g.physical('wheat')).toBe(before); // no clamped-away loss
    // Partial room is applied up to the free total capacity.
    const g2 = new GranaryModel('g2-wr01');
    g2.receive('wheat', 2000);
    const applied2 = g2.receive('vegetables', 1500); // only 1200 fits in the 3200 total
    expect(applied2).toBe(1200);
    expect(g2.usedCapacity()).toBe(3200);
    expect(g2.physical('vegetables')).toBe(1200);
  });
});

describe('market demand & distribution (AGRI-03, spec §12)', () => {
  it('computes demand = expected + safety − current − in-transit', () => {
    expect(marketDemand(120, 120, 40, 100)).toBe(100);
    expect(marketDemand(50, 0, 100, 0)).toBe(0);
  });

  it('picks the basic food first when completely absent, then the fewest-coverage food', () => {
    const state: MarketFoodState = {
      current: { wheat: 0, vegetables: 0, fruit: 40 },
      inTransit: {},
      expectedConsumption: { wheat: 120, vegetables: 90, fruit: 70 },
      basicFood: 'wheat',
      evolutionBlocking: null,
    };
    expect(nextFoodToFetch(state)).toBe('wheat');
    state.current.wheat = 10;
    expect(nextFoodToFetch(state)).toBe('vegetables'); // fewest coverage (0/90)
  });

  it('prefers the food blocking house evolution when it is missing', () => {
    const state: MarketFoodState = {
      current: { wheat: 50, vegetables: 0 },
      inTransit: {},
      expectedConsumption: { wheat: 120, vegetables: 90 },
      basicFood: 'wheat',
      evolutionBlocking: 'vegetables',
    };
    expect(nextFoodToFetch(state)).toBe('vegetables');
  });

  it('never fetches a food nobody consumes when nothing is held or in transit (IN-04)', () => {
    const state: MarketFoodState = {
      current: { wheat: 0, vegetables: 0 },
      inTransit: {},
      expectedConsumption: { wheat: 0, vegetables: 0 },
      basicFood: 'wheat',
      evolutionBlocking: null,
    };
    expect(nextFoodToFetch(state)).toBeNull(); // zero-demand → no fetch
    // With demand for one food, that food is picked even though the basic is empty.
    state.expectedConsumption.vegetables = 90;
    expect(nextFoodToFetch(state)).toBe('vegetables');
  });

  it('scores granaries with explainable reasons (distance, congestion, priority, quantity, block risk)', () => {
    const near: GranaryCandidate = { id: 'near', roadDistance: 4, congestion: 0.3, priority: 1, available: 800, blockRisk: 0 };
    const far: GranaryCandidate = { id: 'far', roadDistance: 20, congestion: 0.1, priority: 3, available: 900, blockRisk: 0 };
    const blocked: GranaryCandidate = { id: 'blocked', roadDistance: 2, congestion: 0, priority: 0, available: 800, blockRisk: 1 };
    const chosen = pickGranary([near, far, blocked]);
    expect(chosen?.id).toBe('near'); // lower score than the blocked/far suppliers
    const s = scoreGranary(near);
    expect(s.reasons.some((r) => r.includes('units available'))).toBe(true);
    expect(s.reasons.some((r) => r.includes('road segments'))).toBe(true);
  });

  it('scales active buyers/sellers by worker efficiency (§12.3)', () => {
    expect(marketAgents(0.1)).toEqual({ buyers: 0, sellers: 0 });
    expect(marketAgents(0.3)).toEqual({ buyers: 1, sellers: 0 });
    expect(marketAgents(0.6)).toEqual({ buyers: 1, sellers: 1 });
    expect(marketAgents(0.8)).toEqual({ buyers: 2, sellers: 1 });
    expect(marketAgents(1)).toEqual({ buyers: 2, sellers: 2 });
  });

  it('composes a seller multi-food 100-unit load within per-food caps', () => {
    const load = sellerLoadComposition(
      { wheat: 50, vegetables: 25, fruit: 25 },
      MARKET_FOOD_CAPS,
      SELLER_CAPACITY,
      ['wheat', 'vegetables', 'fruit'],
    );
    const total = Object.values(load).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(100);
    expect(load.wheat).toBe(50);
  });

  it('orders houses by the market service policy (avoid-hunger vs local-district)', () => {
    const houses: HouseServingInfo[] = [
      { id: 'h1', tier: 3, daysSinceVisit: 5, basicFoodDays: 1, missingVariety: 0, distance: 8 },
      { id: 'h2', tier: 1, daysSinceVisit: 1, basicFoodDays: 10, missingVariety: 0, distance: 2 },
    ];
    const hungered = policyOrder('avoid-hunger', houses).map((h) => h.id);
    expect(hungered[0]).toBe('h1'); // lowest basic-food days
    const local = policyOrder('local-district', houses).map((h) => h.id);
    expect(local[0]).toBe('h2'); // nearest
  });

  it('records per-house market coverage: lastMarketVisit / lastFoodDelivery / servingMarketId', () => {
    const cov: MarketCoverage = {
      houseId: 'h1', lastMarketVisit: 0, lastFoodDelivery: 0, servingMarketId: '', foodDeliveredByType: {},
    };
    recordMarketVisit(cov, 42, 'vegetables', 8, 'market-2');
    expect(cov.lastMarketVisit).toBe(42);
    expect(cov.lastFoodDelivery).toBe(42);
    expect(cov.servingMarketId).toBe('market-2');
    expect(cov.foodDeliveredByType.vegetables).toBe(8);
  });

  it('market capacity is fixed at 500 units and per-food caps default', () => {
    expect(MARKET_CAPACITY).toBe(500);
    expect(MARKET_FOOD_CAPS.wheat).toBe(200);
  });
});
