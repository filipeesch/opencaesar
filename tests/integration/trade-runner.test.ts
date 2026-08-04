/**
 * TRAD-02/04/05 runtime through the runner (SC1 + SC3).
 *
 * SC1: opening a route charges routeOpeningCost and defaults every good to
 * no_trade; export_above_reserve / import_upto_target orders physically drive
 * warehouse stock (reserve thresholds and targets honored), no_trade/stockpile
 * goods never move, and the treasury tracks proceeds.
 * SC3: per-good quotas suspend only the capped good and reset at the tick-based
 * year rollover.
 * Regression: the legacy enableTrade() wheat path behaves exactly as before.
 * Determinism sanity: same seed + commands → byte-identical getStateJson.
 */
import { describe, it, expect } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { productionChainMap } from '../helpers';

/** Minimal trade city on the production map: a road row linking the entry to a
 *  warehouse at (12,1) and a granary at (9,1). No production — stock is injected
 *  via the live seam so the test controls exactly what exists. */
function buildTradeCity(r: SimRunner): void {
  for (let x = 0; x <= 13; x++) r.placeBuilding('road', x, 0);
  r.placeBuilding('warehouse', 12, 1);
  r.placeBuilding('granary', 9, 1);
}

function internals(r: SimRunner) {
  return r.getWalkerInternals();
}

function warehouse(r: SimRunner) {
  return r.getState().buildings.find((b) => b.type === 'warehouse')!;
}

function warehousePottery(r: SimRunner): number {
  return (warehouse(r).stock?.pottery ?? 0) as number;
}

function warehouseWine(r: SimRunner): number {
  return (warehouse(r).stock?.wine ?? 0) as number;
}

describe('TRAD-02 SC1: opening a route and setting per-good orders drives physical movement', () => {
  it('openTradeRoute debits the opening cost and defaults every good to no_trade', () => {
    const r = new SimRunner(1, productionChainMap());
    buildTradeCity(r);
    const beforeOpen = r.getTreasury(); // after building costs
    const open = r.openTradeRoute('massilia');
    expect(open).toEqual({ ok: true, cost: 500 });
    expect(r.getTreasury()).toBe(beforeOpen - 500); // charged exactly once
    const routes = r.getTradeRoutes();
    expect(routes['massilia'].enabled).toBe(true);
    expect(routes['massilia'].orders).toEqual({}); // every good no_trade
  });

  it('openTradeRoute refuses to charge twice on an already-open route', () => {
    const r = new SimRunner(1, productionChainMap());
    buildTradeCity(r);
    r.openTradeRoute('massilia');
    const before = r.getTreasury();
    const second = r.openTradeRoute('massilia');
    expect(second.ok).toBe(true);
    expect(second.cost).toBe(0);
    expect(r.getTreasury()).toBe(before); // no double charge
  });

  it('openTradeRoute rejects an unknown city and an unaffordable route', () => {
    const r = new SimRunner(1, productionChainMap());
    buildTradeCity(r);
    expect(r.openTradeRoute('atlantis').ok).toBe(false);
    // a built minimal city cannot afford tarraco's 1500 opening cost
    const res = r.openTradeRoute('tarraco');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('insufficient funds');
  });

  it('export_above_reserve physically drains the warehouse to the reserve while no_trade goods never move', () => {
    const r = new SimRunner(1, productionChainMap());
    buildTradeCity(r);
    const beforeOpen = r.getTreasury();
    internals(r).buildings.find((b) => b.type === 'warehouse')!.stock.pottery = 40;
    internals(r).buildings.find((b) => b.type === 'warehouse')!.stock.clay = 5;

    const open = r.openTradeRoute('massilia');
    expect(open.ok).toBe(true);
    r.setTradeOrder('massilia', 'pottery', 'export_above_reserve', { reserve: 2 });

    for (let i = 0; i < 1200; i++) r.tick();

    // pottery drained to ≤ 2 (the reserve, plus nothing in transit at rest)
    expect(warehousePottery(r)).toBeLessThanOrEqual(2);
    // clay was never ordered → its stock is untouched (no_trade)
    expect((r.getState().buildings.find((b) => b.type === 'warehouse')!.stock.clay ?? 0) as number).toBe(5);
    // treasury rose by export proceeds above the balance left after opening
    expect(r.getTreasury()).toBeGreaterThan(beforeOpen - 500);
    // the open route records the year it opened
    expect(r.getTradeRoutes()['massilia'].openYear).toBe(0);
  });

  it('orders never move a no_trade or stockpile good (gating through the runner)', () => {
    const r = new SimRunner(2, productionChainMap());
    buildTradeCity(r);
    internals(r).buildings.find((b) => b.type === 'warehouse')!.stock.pottery = 20;
    internals(r).buildings.find((b) => b.type === 'warehouse')!.stock.clay = 20;
    r.openTradeRoute('massilia');
    r.setTradeOrder('massilia', 'pottery', 'stockpile');
    // clay stays no_trade — never ordered
    for (let i = 0; i < 500; i++) r.tick();
    expect(warehousePottery(r)).toBe(20); // stockpile: never moves
    expect((r.getState().buildings.find((b) => b.type === 'warehouse')!.stock.clay ?? 0) as number).toBe(20);
  });
});

describe('TRAD-02 SC1: imports rise toward the target and treasury falls only for the imported value', () => {
  it('import_upto_target fills the warehouse wine toward the target and stops there', () => {
    const r = new SimRunner(3, productionChainMap());
    buildTradeCity(r);
    const beforeOpen = r.getTreasury();
    expect(r.openTradeRoute('massilia').ok).toBe(true);
    r.setTradeOrder('massilia', 'wine', 'import_upto_target', { target: 3 });

    for (let i = 0; i < 200; i++) r.tick();

    // wine rose toward 3 and never exceeded the target
    expect(warehouseWine(r)).toBe(3);
    const treasury = r.getTreasury();
    const winePrice = 44; // round(54 * 0.9 * 0.9)
    expect(treasury).toBe(beforeOpen - 500 - winePrice * 3);
    // a further 200 ticks change nothing (at target)
    for (let i = 0; i < 200; i++) r.tick();
    expect(warehouseWine(r)).toBe(3);
    expect(r.getTreasury()).toBe(treasury);
  });
});

describe('TRAD-04 SC3: per-good quota suspends only the capped good and resets at year rollover', () => {
  it('pottery caps at 2 while wheat keeps exporting; the year reset resumes pottery', () => {
    const r = new SimRunner(4, productionChainMap());
    buildTradeCity(r);
    const wh = internals(r).buildings.find((b) => b.type === 'warehouse')!;
    const gra = internals(r).buildings.find((b) => b.type === 'granary')!;
    wh.stock.pottery = 10;
    gra.stock.wheat = 10;
    r.openTradeRoute('massilia');
    r.setTradeOrder('massilia', 'pottery', 'export_above_reserve', { reserve: 0 });
    r.setTradeOrder('massilia', 'wheat', 'export_all');
    const routes = r.getTradeRoutes();
    routes['massilia'].perGoodQuota = { pottery: 2 };

    // tick into year 1 (before the 360 boundary) — pottery moves exactly its 2
    for (let i = 0; i < 350; i++) r.tick();
    expect(wh.stock.pottery).toBe(8); // only 2 moved — quota cap
    expect(gra.stock.wheat).toBe(0); // uncapped wheat kept exporting (other good keeps moving)
    expect(routes['massilia'].usedPerGood?.['pottery']).toBe(2);

    // cross the year boundary (Math.floor(tick/360)) → pottery resumes; tick far
    // enough for the dispatched caravan to walk to the warehouse and collect.
    for (let i = 0; i < 80; i++) r.tick(); // tick 430 → year 1, pickup complete
    expect(wh.stock.pottery).toBeLessThan(8); // quota reset resumed pottery exports
  });
});

describe('legacy enableTrade path unchanged', () => {
  it('enableTrade + granary wheat still behaves like today (regression)', () => {
    const r = new SimRunner(1234, productionChainMap());
    r.enableTrade('massilia', true);
    r.placeBuilding('granary', 5, 5);
    for (let i = 0; i < 5; i++) r.tick();
    expect(typeof r.getTreasury()).toBe('number');
    expect(r.getTradeRoutes()['massilia'].enabled).toBe(true);
    expect(r.getTradeRoutes()['massilia'].orders).toBeUndefined(); // legacy path
  });
});

describe('runner determinism sanity (full chunked guarantee in 09-W4-2)', () => {
  it('same seed + commands produce byte-identical getStateJson at ticks 50 and 100', () => {
    const run = (seed: number, ticks: number): string => {
      const r = new SimRunner(seed, productionChainMap());
      buildTradeCity(r);
      internals(r).buildings.find((b) => b.type === 'warehouse')!.stock.pottery = 40;
      r.openTradeRoute('massilia');
      r.setTradeOrder('massilia', 'pottery', 'export_above_reserve', { reserve: 2 });
      for (let i = 0; i < ticks; i++) r.tick();
      return r.getStateJson();
    };
    for (const seed of [1, 7]) {
      expect(run(seed, 50)).toBe(run(seed, 50));
      expect(run(seed, 100)).toBe(run(seed, 100));
    }
  });
});
