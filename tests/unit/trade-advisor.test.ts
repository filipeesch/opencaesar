/**
 * Live trade advisor projection (TRAD-01..05, decision 7 — live-derived, never
 * fabricated).
 *
 * 1. Pure projection on a hand-built routes + price snapshot returns exact
 *    cities/orders/quota(used,cap,suspended)/prices(base,current,trend).
 * 2. Live accessor on a real runner after openTradeRoute + setTradeOrder +
 *    ticks reconciles route.enabled, quota counters and price base/current/trend.
 * 3. The suspended flag is true only for the capped good.
 * 4. Unopened cities appear with opened:false and no orders.
 */
import { describe, expect, it } from 'vitest';
import { tradeAdvisorFromState } from '../../src/sim/advisors';
import type { TradePriceSnapshot } from '../../src/sim/advisors';
import { createTradeRoutes } from '../../src/sim/trade';
import { SimRunner } from '../../src/sim/runner';
import { productionChainMap } from '../helpers';

function buildTradeCity(r: SimRunner): void {
  for (let x = 0; x <= 13; x++) r.placeBuilding('road', x, 0);
  r.placeBuilding('warehouse', 12, 1);
}

describe('tradeAdvisorFromState: pure projection', () => {
  it('returns exact cities, orders, quota (used/cap/suspended) and prices', () => {
    const routes = createTradeRoutes();
    routes['massilia'].enabled = true;
    routes['massilia'].orders = { pottery: 'export_above_reserve', wine: 'import_upto_target' };
    routes['massilia'].exportReserve = { pottery: 2 };
    routes['massilia'].importTargets = { wine: 3 };
    routes['massilia'].usedPerGood = { pottery: 2, wine: 1 };
    routes['massilia'].perGoodQuota = { pottery: 2 };
    routes['massilia'].catalogQuota = 12;
    routes['massilia'].usedQuota = 2;
    routes['massilia'].exportProceeds = 120;

    const prices: TradePriceSnapshot = {
      massilia: {
        pottery: { base: 50, current: 52, trend: 'rising' },
        wine: { base: 44, current: 44, trend: 'steady' },
      },
    };

    const v = tradeAdvisorFromState(routes, prices);

    const massilia = v.cities.find((c) => c.cityId === 'massilia')!;
    expect(massilia.opened).toBe(true);
    expect(massilia.landOrSea).toBe('land');
    expect(massilia.orders).toEqual({ pottery: 'export_above_reserve', wine: 'import_upto_target' });
    // suspension only for the capped good (pottery used == cap 2)
    expect(massilia.quota['pottery']).toEqual({ used: 2, cap: 2, suspended: true });
    expect(massilia.quota['wine']).toEqual({ used: 1, cap: 12, suspended: false });
    expect(massilia.prices['pottery']).toEqual({ base: 50, current: 52, trend: 'rising' });
    expect(massilia.prices['wine']).toEqual({ base: 44, current: 44, trend: 'steady' });
    expect(v.totals.exportProceeds).toBe(120);
    expect(v.totals.activeRoutes).toBe(1);
  });

  it('unopened cities appear with opened:false and no orders/quota', () => {
    const routes = createTradeRoutes();
    const v = tradeAdvisorFromState(routes, {});
    const londinium = v.cities.find((c) => c.cityId === 'londinium')!;
    expect(londinium.opened).toBe(false);
    expect(londinium.orders).toEqual({});
    expect(londinium.quota).toEqual({});
    expect(londinium.prices).toEqual({});
  });
});

describe('getTradeAdvisor: live accessor on a real runner', () => {
  it('reconciles route.enabled, per-good quota counters and prices against real state', () => {
    const r = new SimRunner(9, productionChainMap());
    buildTradeCity(r);
    r.openTradeRoute('massilia');
    r.setTradeOrder('massilia', 'pottery', 'export_above_reserve', { reserve: 2 });
    for (let i = 0; i < 200; i++) r.tick();

    const v = r.getTradeAdvisor();
    const m = v.cities.find((c) => c.cityId === 'massilia')!;
    expect(m.opened).toBe(true);
    expect(m.orders['pottery']).toBe('export_above_reserve');
    // quota counters are live: used <= cap, suspended false while status quo holds
    expect(m.quota['pottery'].used).toBeGreaterThanOrEqual(0);
    expect(m.quota['pottery'].used).toBeLessThanOrEqual(m.quota['pottery'].cap);
    expect(m.quota['pottery'].suspended).toBe(false);
    // prices are projected from the runner price snapshot
    expect(m.prices['pottery'].current).toBeGreaterThan(0);
    expect(['rising', 'steady', 'falling']).toContain(m.prices['pottery'].trend);
  });

  it('suspended flag is true only once the capped good reaches its quota', () => {
    const r = new SimRunner(11, productionChainMap());
    buildTradeCity(r);
    const wh = r.getWalkerInternals().buildings.find((b) => b.type === 'warehouse')!;
    wh.stock.pottery = 10;
    r.openTradeRoute('massilia');
    r.setTradeOrder('massilia', 'pottery', 'export_above_reserve', { reserve: 0 });
    r.getTradeRoutes()['massilia'].perGoodQuota = { pottery: 2 };
    for (let i = 0; i < 350; i++) r.tick();

    const m = r.getTradeAdvisor().cities.find((c) => c.cityId === 'massilia')!;
    expect(m.quota['pottery'].used).toBe(2);
    expect(m.quota['pottery'].suspended).toBe(true);
  });
});
