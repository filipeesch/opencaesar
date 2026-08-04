/**
 * TRAD-04 — per-route per-good annual quotas with per-good-only suspension,
 * countdown/clamping, and a deterministic tick-based year reset.
 */
import { describe, it, expect } from 'vitest';
import {
  createTradeRoutes, setTradeRoute, tickTrade,
  quotaFor, quotaRemaining, quotaSuspended, consumeQuota, resetAnnualQuotas,
} from '../../src/sim/trade';
import type { TradeRouteState } from '../../src/sim/trade';

function routeWith(over: Partial<TradeRouteState>): TradeRouteState {
  return { cityId: 'massilia', enabled: true, imports: {}, exports: {}, ...over };
}

describe('TRAD-04 per-good quotas (§19.7)', () => {
  it('quotaFor resolves per-good override > catalog default > legacy annualQuota > 0 (unlimited)', () => {
    expect(quotaFor(routeWith({ perGoodQuota: { pottery: 5 }, catalogQuota: 12, annualQuota: 0 }), 'pottery')).toBe(5);
    expect(quotaFor(routeWith({ catalogQuota: 12, annualQuota: 0 }), 'pottery')).toBe(12);
    expect(quotaFor(routeWith({ annualQuota: 3 }), 'pottery')).toBe(3);
    expect(quotaFor(routeWith({}), 'pottery')).toBe(0); // unlimited
  });

  it('quotaRemaining counts down via consumeQuota and clamps at 0', () => {
    const route = routeWith({ perGoodQuota: { pottery: 3 } });
    expect(quotaRemaining(route, 'pottery')).toBe(3);
    consumeQuota(route, 'pottery', 2);
    expect(quotaRemaining(route, 'pottery')).toBe(1);
    consumeQuota(route, 'pottery', 5);
    expect(quotaRemaining(route, 'pottery')).toBe(0); // clamped, never negative
    // uncapped route → Infinity
    expect(quotaRemaining(routeWith({}), 'wheat')).toBe(Infinity);
  });

  it('quotaSuspended turns true only for the capped good, isolating other goods', () => {
    const route = routeWith({ perGoodQuota: { pottery: 12 } });
    consumeQuota(route, 'pottery', 12);
    expect(quotaSuspended(route, 'pottery')).toBe(true);
    // a pottery cap must not suspend wine on the same route (§19.7)
    expect(quotaSuspended(route, 'wine')).toBe(false);
    // uncapped good never suspends
    expect(quotaSuspended(routeWith({}), 'wine')).toBe(false);
  });

  it('resetAnnualQuotas resets only on year change and reports the count', () => {
    const routes = createTradeRoutes();
    const route = routes['massilia'];
    route.perGoodQuota = { pottery: 12 };
    consumeQuota(route, 'pottery', 4);
    route.usedQuota = 4;
    expect(quotaSuspended(route, 'pottery')).toBe(false);

    // every route (here all 4 cities) was reset on the first call
    const n1 = resetAnnualQuotas(routes, 1);
    expect(n1).toBe(Object.keys(routes).length);
    expect(route.usedPerGood).toEqual({});
    expect(route.usedQuota).toBe(0);
    expect(route.lastYear).toBe(1);

    // same year: nothing resets
    expect(resetAnnualQuotas(routes, 1)).toBe(0);

    // next year resets again
    consumeQuota(route, 'pottery', 2);
    expect(resetAnnualQuotas(routes, 2)).toBe(Object.keys(routes).length);
    expect(route.usedPerGood).toEqual({});
  });

  it('determinism: identical route maps reset identically for identical (routes, year)', () => {
    const a = createTradeRoutes();
    const b = createTradeRoutes();
    a['caralis'].perGoodQuota = { wine: 4 };
    b['caralis'].perGoodQuota = { wine: 4 };
    consumeQuota(a['caralis'], 'wine', 1);
    consumeQuota(b['caralis'], 'wine', 1);
    expect(resetAnnualQuotas(a, 5)).toBe(resetAnnualQuotas(b, 5));
    expect(a).toEqual(b);
  });

  it('legacy single-annualQuota tickTrade path unchanged (caps annual exports, resets annually)', () => {
    const routes = createTradeRoutes();
    setTradeRoute(routes, 'massilia', true);
    const route = routes['massilia'];
    route.annualQuota = 2;
    const r1 = tickTrade(1000, { wheat: 10 }, routes, 1);
    expect(r1.exports.wheat ?? 0).toBe(2);
    expect(r1.exports.pottery ?? 0).toBeGreaterThanOrEqual(0);
    const r2 = tickTrade(1000, { wheat: 10 }, routes, 1);
    expect(r2.exports.wheat ?? 0).toBe(0); // same year: exhausted
    const r3 = tickTrade(1000, { wheat: 10 }, routes, 2);
    expect(r3.exports.wheat ?? 0).toBe(2); // new year: reset
  });
});
