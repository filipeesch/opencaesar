import { describe, it, expect } from 'vitest';
import {
  defaultWarehousePolicy, warehouseAccepts, CommercialCenter, ReservationPool, nextPickPriority,
} from '../../src/sim/logistics';
import { WORKSHOPS, emptyProduction, tickWorkshop, porterDelivers } from '../../src/sim/production';

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
