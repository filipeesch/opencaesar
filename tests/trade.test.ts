import { describe, it, expect } from 'vitest';
import { createTradeRoutes, setTradeRoute, setImportOrder, tradePrice, tickTrade } from '../src/sim/trade';
import {
  exportableSurplus, exportableAboveMonths, dangerousExport, importDestinationPriority,
} from '../src/sim/trade';

describe('trade', () => {
  it('createTradeRoutes provides a route per partner city', () => {
    const routes = createTradeRoutes();
    expect(Object.keys(routes).length).toBeGreaterThan(0);
    for (const route of Object.values(routes)) {
      expect(route.enabled).toBe(false);
    }
  });

  it('setTradeRoute toggles a route', () => {
    const routes = createTradeRoutes();
    setTradeRoute(routes, 'massilia', true);
    expect(routes['massilia'].enabled).toBe(true);
  });

  it('tradePrice applies city modifier', () => {
    const price = tradePrice('wheat', 'massilia', true);
    expect(price).toBeGreaterThan(0);
  });

  it('tickTrade exports surplus and imports affordable goods', () => {
    const routes = createTradeRoutes();
    setTradeRoute(routes, 'massilia', true);
    const stock: Record<string, number> = { wheat: 5, pottery: 3 };
    const before = 1000;
    const res = tickTrade(before, stock, routes);
    // Wheat was exported (stock cleared), pottery too.
    expect(stock['wheat']).toBeLessThan(5); // wheat was exported and partially re-imported
    expect(res.treasury).not.toBe(before);
    expect(res.active).toBeGreaterThan(0);
  });

  it('disabled routes do not trade', () => {
    const routes = createTradeRoutes();
    const stock: Record<string, number> = { wheat: 5 };
    const res = tickTrade(1000, stock, routes);
    expect(res.active).toBe(0);
    expect(stock['wheat']).toBe(5);
  });
});

describe('trade quotas', () => {
  it('caps annual exports and suspends the route at the cap', () => {
    const routes = createTradeRoutes();
    setTradeRoute(routes, 'massilia', true);
    const route = routes['massilia'];
    route.annualQuota = 2;
    const stock: Record<string, number> = { wheat: 10 };
    const r1 = tickTrade(1000, { ...stock }, routes, 1);
    expect(r1.exports.wheat ?? 0).toBe(2);
    expect(routes['massilia'].usedQuota).toBe(2);
    // same year: quota exhausted → no further export
    const r2 = tickTrade(1000, { wheat: 10 }, routes, 1);
    expect(r2.exports.wheat ?? 0).toBe(0);
    // new year resets the quota
    const r3 = tickTrade(1000, { wheat: 10 }, routes, 2);
    expect(r3.exports.wheat ?? 0).toBe(2);
    expect(routes['massilia'].usedQuota).toBe(2);
  });
});

describe('import gating by order (treasury not drained blindly)', () => {
  it('imports nothing unless a commodity is explicitly ordered', () => {
    const routes = createTradeRoutes();
    setTradeRoute(routes, 'massilia', true); // enabled but no import orders
    const stock: Record<string, number> = {};
    const res = tickTrade(1000, stock, routes, 1);
    // Only exports happen; no blind imports of every sellable good.
    expect(Object.keys(res.imports).length).toBe(0);
    expect(res.treasury).toBe(1000); // treasury unchanged (no exports available, no imports)
  });

  it('imports up to an ordered target and stops at the target', () => {
    const routes = createTradeRoutes();
    setImportOrder(routes, 'massilia', 'pottery', 3);
    const stock: Record<string, number> = {};
    const r1 = tickTrade(1000, stock, routes, 1);
    expect(r1.imports.pottery ?? 0).toBeGreaterThan(0);
    expect(stock.pottery ?? 0).toBeLessThanOrEqual(3);
    // a second tick imports less/zero once the target is reached
    const r2 = tickTrade(1000, stock, routes, 1);
    expect((stock.pottery ?? 0)).toBeLessThanOrEqual(3);
    void r2;
  });
});

describe('food export with urban reserves (spec §14, TRAD-04)', () => {
  it('exportable surplus = available − projected consumption − admin reserves − in-transit', () => {
    expect(exportableSurplus(2000, 1200, 300, 100)).toBe(400);
    expect(exportableSurplus(1200, 1200, 300, 0)).toBe(0); // reserve floor respected
    expect(exportableSurplus(500, 1200, 0, 0)).toBe(0); // below consumption → nothing
  });

  it('export-above-reserve respects the configured urban reserve in months', () => {
    expect(exportableAboveMonths(2000, 400, 3)).toBe(800); // 1200 reserved = 3 months
    expect(exportableAboveMonths(2000, 400, 6)).toBe(0);
  });

  it('flags a dangerous export that would drop coverage below the floor and offers options', () => {
    const safe = dangerousExport(2000, 400, 200);
    expect(safe.dangerous).toBe(false);
    expect(safe.options).toContain('sell-anyway');

    const risky = dangerousExport(2000, 400, 1000, 3);
    expect(risky.dangerous).toBe(true);
    expect(risky.monthsAfterSale).toBe(2.5); // 1000 left / 400 per month
    expect(risky.options).toEqual(expect.arrayContaining(['cancel', 'sell-anyway', 'reduce', 'raise-reserve']));
  });

  it('ranks import destinations: food center > requesting > below-target > accepts', () => {
    const center = importDestinationPriority(true, 'accept', false);
    const requesting = importDestinationPriority(false, 'request', false);
    const below = importDestinationPriority(false, 'maintain', true);
    const accepts = importDestinationPriority(false, 'accept', false);
    expect(center.priority).toBeLessThan(requesting.priority);
    expect(requesting.priority).toBeLessThan(below.priority);
    expect(below.priority).toBeLessThan(accepts.priority);
    // A refusing/emptying granary never presents as 'accepts' (IN-02).
    const refuses = importDestinationPriority(false, 'refuse', false);
    const empties = importDestinationPriority(false, 'empty', false);
    expect(refuses.reason).toBe('refuses');
    expect(empties.reason).toBe('refuses');
    expect(refuses.priority).toBe(99);
  });

  it('never allows a sale that exports reserved-for-domestic stock', () => {
    // reserved stock is excluded from what is "available" for export
    expect(exportableSurplus(0, 0, 0, 0)).toBe(0);
    expect(exportableSurplus(100, 100, 100, 0)).toBe(0);
  });
});
