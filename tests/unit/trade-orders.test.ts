/**
 * TRAD-02 / TRAD-05 (gating) — the §19.6 order-mode matrix and the §19.9
 * export/import transaction gates, plus a regression that the legacy trade
 * surface (tickTrade/setImportOrder/setTradeRoute/tradePrice) is unchanged.
 */
import { describe, it, expect } from 'vitest';
import {
  createTradeRoutes, setTradeRoute, setImportOrder, tickTrade, tradePrice,
  resolveTradeOrder, exportAllowed, exportableAmount, tradeExportGate, importGatedBy,
} from '../../src/sim/trade';
import type { TradeOrderMode } from '../../src/sim/trade';

function route(): ReturnType<typeof createTradeRoutes> {
  const routes = createTradeRoutes();
  routes['massilia'].orders = { pottery: 'export_above_reserve', wheat: 'export_all', wine: 'import_upto_target', clay: 'stockpile' } as Partial<Record<string, TradeOrderMode>>;
  routes['massilia'].exportReserve = { pottery: 2 };
  routes['massilia'].importTargets = { wine: 3 };
  return routes;
}

describe('TRAD-02 order modes (§19.6)', () => {
  it('resolveTradeOrder defaults to no_trade and returns the configured mode', () => {
    const routes = createTradeRoutes();
    expect(resolveTradeOrder(routes['massilia'], 'wheat')).toBe('no_trade');
    expect(resolveTradeOrder(route()['massilia'], 'pottery')).toBe('export_above_reserve');
  });

  it('createTradeRoutes emits routes with no orders (all goods no_trade)', () => {
    const routes = createTradeRoutes();
    for (const r of Object.values(routes)) {
      expect(r.orders).toBeUndefined();
      expect(resolveTradeOrder(r, 'wheat')).toBe('no_trade');
    }
  });

  it('exportAllowed matrix: stockpile/no_trade never export, export_all exports unreserved stock', () => {
    expect(exportAllowed('no_trade', 0, 5, 0)).toBe(false);
    expect(exportAllowed('stockpile', 0, 5, 0)).toBe(false);
    expect(exportAllowed('export_all', 0, 5, 0)).toBe(true);
    expect(exportAllowed('export_all', 0, 0, 0)).toBe(false);
    // reserved units are never exportable, even under export_all
    expect(exportAllowed('export_all', 0, 5, 5)).toBe(false);
    // import mode never exports
    expect(exportAllowed('import_upto_target', 0, 5, 0)).toBe(false);
  });

  it('export_above_reserve exports only the surplus above the threshold', () => {
    expect(exportAllowed('export_above_reserve', 2, 3, 0)).toBe(true);
    expect(exportableAmount('export_above_reserve', 2, 3, 0)).toBe(1);
    expect(exportAllowed('export_above_reserve', 2, 2, 0)).toBe(false);
    expect(exportableAmount('export_above_reserve', 2, 2, 0)).toBe(0);
    // reserved amount is subtracted before the threshold
    expect(exportAllowed('export_above_reserve', 2, 4, 1)).toBe(true);
    expect(exportableAmount('export_above_reserve', 2, 4, 1)).toBe(1);
  });

  it('tradeExportGate reasons for the §19.9 export conditions', () => {
    expect(tradeExportGate({ order: 'no_trade', stock: 5, reserved: 0, quotaLeft: 1 }).reason).toBe('not_ordered');
    expect(tradeExportGate({ order: 'stockpile', stock: 5, reserved: 0, quotaLeft: 1 }).reason).toBe('not_ordered');
    expect(tradeExportGate({ order: 'export_all', stock: 0, reserved: 0, quotaLeft: 1 }).reason).toBe('no_stock');
    expect(tradeExportGate({ order: 'export_all', stock: 5, reserved: 5, quotaLeft: 1 }).reason).toBe('reserved');
    expect(tradeExportGate({ order: 'export_above_reserve', stock: 2, reserved: 0, quotaLeft: 1, reserve: 2 }).reason).toBe('below_threshold');
    expect(tradeExportGate({ order: 'export_all', stock: 5, reserved: 0, quotaLeft: 0 }).reason).toBe('quota_exhausted');
    expect(tradeExportGate({ order: 'export_all', stock: 5, reserved: 0, quotaLeft: 1 })).toEqual({ allowed: true, reason: 'ok' });
  });

  it('import gating: below-target + quota + affordable → allowed, else a reason', () => {
    const ok = { order: 'import_upto_target' as TradeOrderMode, stock: 0, target: 3, quotaLeft: 2, treasury: 100, price: 40 };
    expect(importGatedBy(ok)).toEqual({ allowed: true, reason: 'ok' });
    expect(importGatedBy({ ...ok, stock: 3 }).reason).toBe('at_target');
    expect(importGatedBy({ ...ok, stock: 4 }).reason).toBe('at_target');
    expect(importGatedBy({ ...ok, quotaLeft: 0 }).reason).toBe('quota_exhausted');
    expect(importGatedBy({ ...ok, price: 200 }).reason).toBe('unaffordable');
    expect(importGatedBy({ ...ok, order: 'no_trade' }).reason).toBe('not_ordered');
    expect(importGatedBy({ ...ok, order: 'export_all' }).reason).toBe('not_ordered');
  });
});

describe('legacy trade surface unchanged (regression)', () => {
  it('setTradeRoute / setImportOrder / tradePrice behave exactly as before', () => {
    const routes = createTradeRoutes();
    setTradeRoute(routes, 'massilia', true);
    expect(routes['massilia'].enabled).toBe(true);
    setImportOrder(routes, 'massilia', 'pottery', 3);
    expect(routes['massilia'].imports['pottery']).toBe(3);
    expect(routes['massilia'].enabled).toBe(true);
    expect(tradePrice('wheat', 'massilia', true)).toBe(27); // round(30 * 0.9)
    expect(tradePrice('wheat', 'massilia', false)).toBe(36); // round(40 * 0.9)
  });

  it('tickTrade honors setImportOrder targets under the legacy abstract ledger', () => {
    const routes = createTradeRoutes();
    setImportOrder(routes, 'massilia', 'pottery', 3);
    const stock: Record<string, number> = {};
    const r1 = tickTrade(1000, stock, routes, 1);
    expect(r1.imports.pottery ?? 0).toBeGreaterThan(0);
    expect(stock.pottery ?? 0).toBeLessThanOrEqual(3);
  });
});
