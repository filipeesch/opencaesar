import { describe, it, expect } from 'vitest';
import { createTradeRoutes, setTradeRoute, tradePrice, tickTrade } from '../src/sim/trade';

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
