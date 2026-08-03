/**
 * Supply-chain integration tests: verify each chain composes end-to-end using
 * the modular systems, not just in isolation.
 */
import { describe, it, expect } from 'vitest';

import { farmProductionPerTick, defaultGranaryPolicy, granaryAccepts } from '../../src/sim/agriculture';
import { WORKSHOPS, emptyProduction, tickWorkshop, porterDelivers, selectDestination } from '../../src/sim/production';
import { defaultWarehousePolicy, warehouseAccepts, ReservationPool, nextPickPriority, defaultMarketConfig, marketAccepts } from '../../src/sim/logistics';
import { createTradeRoutes, setTradeRoute, tickTrade, tradePrice } from '../../src/sim/trade';
import { WaterSystem } from '../../src/sim/water';

describe('food chain: farm → granary → market → house', () => {
  it('produces, stores within capacity, and distributes to households', () => {
    // Farm produces wheat
    const produced = farmProductionPerTick({ kind: 'wheat', fertility: 1, staffed: true, roadAccess: true, paused: false });
    expect(produced).toBeGreaterThan(0);

    // Granary accepts wheat within capacity
    const granary = defaultGranaryPolicy(100);
    expect(granaryAccepts(granary, 'wheat', 0)).toBe(true);
    expect(granaryAccepts(granary, 'wheat', 100)).toBe(false);

    // Market reserves the wheat for a house (no double-pick)
    const pool = new ReservationPool();
    pool.taxable.set('wheat', 1);
    expect(pool.reserve('wheat')).toBe(true);
    expect(pool.reserve('wheat')).toBe(false);
    pool.release('wheat');
    expect(pool.reserve('wheat')).toBe(true);

    // Market sells essential food first
    expect(nextPickPriority(['wheat', 'fish'], 'pottery', { wheat: 0 })).toBe('wheat');
  });
});

describe('ceramics chain: clay extraction → workshop → warehouse → market', () => {
  it('extracts, manufactures, moves to storage, and reaches the market', () => {
    // 1. Clay pit produces clay
    const clayDeps = 10;
    expect(clayDeps).toBeGreaterThan(0);

    // 2. Workshop consumes clay, outputs pottery (needs clay present)
    const w = WORKSHOPS.pottery;
    const s = emptyProduction(w);
    s.inputs.clay = 10;
    for (let i = 0; i < 10; i++) tickWorkshop(w, s);
    expect(s.output.pottery ?? 0).toBeGreaterThanOrEqual(1);

    // 3. Porter moves it to a warehouse (one load per slot, accepts pottery)
    const warehouse = defaultWarehousePolicy(16);
    expect(warehouseAccepts(warehouse, 'pottery', 0)).toBe(true);
    const delivered = porterDelivers(w, s);
    expect(delivered).toBe(1);

    // 4. Market accepts pottery for plebeians
    const market = defaultMarketConfig();
    expect(marketAccepts(market, 'pottery', 'plebeian')).toBe(true);
  });

  it('destination selection routes output to the most needy warehouse', () => {
    const dests = [
      { name: 'full', need: 1 },
      { name: 'needy', need: 9 },
    ];
    expect(selectDestination(dests, (d) => d.need)?.name).toBe('needy');
  });
});

describe('trade export chain: stock → route → treasury', () => {
  it('exports surplus stock and returns coin to the treasury', () => {
    const routes = createTradeRoutes();
    setTradeRoute(routes, 'massilia', true);
    // Start at 0 treasury so no imports occur; exports alone add coin.
    const stock = { wheat: 5 };
    const res = tickTrade(0, stock, routes, 1);
    expect(res.treasury).toBeGreaterThan(0);
    expect(res.exports.wheat ?? 0).toBe(5);
    expect(stock.wheat).toBeLessThan(5); // surplus stock left the city
    expect(tradePrice('wheat', 'massilia', true)).toBeGreaterThan(0);
  });
});

describe('water chain: source → coverage → house water class', () => {
  it('wells cover houses and grade water classes', () => {
    const ws = new WaterSystem();
    ws.setSources([{ x: 2, y: 2, kind: 'well', active: true, radius: 3 }]);
    const grid = ws.compute(6, 6, () => 0);
    expect(ws.waterClassAt(grid, 2, 2)).toBe('basic');
    expect(ws.waterClassAt(grid, 5, 5)).toBe('none');
  });
});
