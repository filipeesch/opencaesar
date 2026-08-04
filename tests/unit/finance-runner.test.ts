/**
 * Runner-level treasury wiring (FIN-01, Phase 10 wave 1).
 *
 * The bare `treasury: number` was replaced by a `Treasury` instance; every
 * revenue/expense write goes through categorized addRevenue/addExpense while
 * the balance arithmetic stays byte-identical to the pre-swap implementation.
 */
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { CONFIG } from '../../src/sim/config';
import { buildFoodCity, foodChainMap, place, productionChainMap, runScenario } from '../helpers';

/** Total denarii buildFoodCity spends on construction per the runtime catalog (roads x0 + farm 80 + granary 120 + market 100 + 4 houses x20 + well 40). */
const FOOD_CITY_COST = 420;

describe('runner treasury wiring (FIN-01)', () => {
  it('lands taxes under revenue and wages under expenses in the ledger', () => {
    const r = runScenario(12345, foodChainMap(), (rr) => {
      buildFoodCity(rr);
      rr.setPolicy(0.1, 0.1);
    }, 200);
    const ledger = r.getTreasuryLedger();
    expect(ledger.revenue.taxes ?? 0).toBeGreaterThan(0);
    expect(ledger.expenses.wages ?? 0).toBeGreaterThan(0);
    // Ledger stays consistent with the balance (no double-counting): the only
    // expenses besides wages are the construction costs recorded as 'other'.
    expect(r.getTreasury()).toBeCloseTo(
      CONFIG.startingTreasury - FOOD_CITY_COST + (ledger.revenue.taxes ?? 0) - (ledger.expenses.wages ?? 0),
      9,
    );
    expect((ledger.expenses.other ?? 0)).toBe(FOOD_CITY_COST);
  });

  it('tracks unpaid wages as arrears in the finance advisor', () => {
    const r = runScenario(12345, foodChainMap(), (rr) => {
      buildFoodCity(rr);
      rr.setPolicy(0, 1); // no taxes, full wages → treasury drains
    }, 400);
    expect(r.getTreasury()).toBe(0);
    expect(r.getState().lastTickWagesUnpaid).toBe(true);
    const advisor = r.getFinanceAdvisor();
    expect(advisor.arrears).toBe(true);
    expect(advisor.balance).toBe(0);
  });

  it('keeps the balance equal to the ledger-implied arithmetic at every tick (no bypass writes)', () => {
    const r = runScenario(12345, foodChainMap(), (rr) => {
      buildFoodCity(rr);
      rr.setPolicy(0.1, 0.5);
    }, 0);
    let expected = CONFIG.startingTreasury - FOOD_CITY_COST;
    let prevTaxes = 0;
    let prevWages = 0;
    for (let i = 0; i < 300; i++) {
      r.tick();
      const ledger = r.getTreasuryLedger();
      const dTaxes = (ledger.revenue.taxes ?? 0) - prevTaxes;
      const dWages = (ledger.expenses.wages ?? 0) - prevWages;
      prevTaxes += dTaxes;
      prevWages += dWages;
      expected = expected + dTaxes - dWages;
      expect(r.getTreasury()).toBeCloseTo(expected, 9);
    }
    expect(prevWages).toBeGreaterThan(0);
  });

  it('books export proceeds under trade revenue', () => {
    const r = runScenario(12345, productionChainMap(), (rr) => {
      for (let x = 0; x <= 13; x++) place(rr, 'road', x, 0);
      place(rr, 'warehouse', 12, 1);
      rr.getWalkerInternals().buildings.find((b) => b.type === 'warehouse')!.stock.pottery = 40;
      rr.openTradeRoute('massilia');
      rr.setTradeOrder('massilia', 'pottery', 'export_above_reserve', { reserve: 2 });
    }, 50);
    const ledger = r.getTreasuryLedger();
    expect(ledger.revenue.trade ?? 0).toBeGreaterThan(0);
  });
});

describe('royal subsidy, loans and overflow (FIN-01)', () => {
  it('grants the royal subsidy once per year and refuses a second grant', () => {
    const r = runScenario(12345, foodChainMap(), (rr) => {
      buildFoodCity(rr);
      rr.setPolicy(0, 0.5); // no tax income so the treasury stays low
    }, 0);
    expect(r.getTreasury()).toBe(CONFIG.startingTreasury - FOOD_CITY_COST);
    const first = r.requestRoyalSubsidy();
    // The grant is bounded by the shortfall to a 1000-denarii treasury, not the cap.
    expect(first.grant).toBe(1000 - (CONFIG.startingTreasury - FOOD_CITY_COST));
    expect(r.getTreasury()).toBe(1000);
    expect(r.getSubsidyUsedThisYear()).toBe(first.grant);
    expect(r.requestRoyalSubsidy().grant).toBe(0); // same year → refused

    // Next year (rollover happens on tick 360): the subsidy is usable again.
    for (let i = 0; i < 360; i++) r.tick();
    expect(r.getSubsidyUsedThisYear()).toBe(0);
    expect(r.getTreasury()).toBe(0); // wages drained the balance with no tax income
    const next = r.requestRoyalSubsidy();
    expect(next.grant).toBe(CONFIG.royalSubsidyCap);
    expect(r.getTreasury()).toBe(CONFIG.royalSubsidyCap);
    expect(r.getTreasuryLedger().revenue.subsidy ?? 0).toBe(CONFIG.royalSubsidyCap);
  });

  it('takes loans, accrues tick-based annual interest, and repays', () => {
    const r = new SimRunner(12345, foodChainMap());
    const loan = r.takeLoan(1000);
    expect(loan).toEqual({ ok: true, received: 1000 });
    expect(r.getTreasury()).toBe(2000);
    expect(r.getDebt()).toBe(1000);
    expect(r.getTreasuryLedger().revenue.loan ?? 0).toBe(1000);
    expect(r.getFinanceAdvisor().debt).toBe(1000);

    for (let i = 0; i < 360; i++) r.tick(); // year boundary → interest accrues
    expect(r.getDebt()).toBe(1100); // 1000 + 10%
    expect(r.getFinanceAdvisor().interest).toBe(200); // 100 upfront charge + 100 accrued
    expect(r.getLoanFavorPenalty()).toBe(2); // debt 1100 > 1000 → floor(1100/500)

    const repay = r.repayLoan(500);
    expect(repay.repaid).toBe(500);
    expect(r.getDebt()).toBe(600);
  });

  it('rejects loans beyond the limit and non-positive amounts', () => {
    const r = new SimRunner(1, foodChainMap());
    expect(r.takeLoan(CONFIG.loanMaxAmount + 1).ok).toBe(false);
    expect(r.takeLoan(0).ok).toBe(false);
    expect(r.getDebt()).toBe(0);
  });

  it('caps the treasury at the overflow limit and ledgeres the dropped excess', () => {
    const r = new SimRunner(1, foodChainMap());
    r.takeLoan(2000);
    r.takeLoan(2000);
    r.tick();
    expect(r.getTreasury()).toBe(5000); // 1000 + 4000, at the cap, nothing dropped
    expect(r.getFinanceAdvisor().overflowDroppedThisYear).toBe(0);

    r.takeLoan(1000); // 6000 > 5000
    expect(r.getTreasury()).toBe(6000); // the cap applies on the finance tick
    r.tick();
    expect(r.getTreasury()).toBe(CONFIG.treasuryOverflowLimit);
    expect(r.getTreasuryLedger().expenses.overflow ?? 0).toBe(1000);
    expect(r.getFinanceAdvisor().overflowDroppedThisYear).toBe(1000);
    r.tick();
    expect(r.getTreasury()).toBe(CONFIG.treasuryOverflowLimit);
    expect(r.getTreasuryLedger().expenses.overflow ?? 0).toBe(1000);
  });

  it('replays subsidy and loan commands identically from SaveData', () => {
    const seed = 24680;
    const original = new SimRunner(seed);
    const take = original.takeLoan(1500);
    expect(take.received).toBe(1500);
    original.setPolicy(0, 0.8);
    original.repayLoan(600);
    for (let i = 0; i < 400; i++) original.tick(); // crosses the year-1 interest accrual
    expect(original.getDebt()).toBe(990); // 1500 - 600 = 900, +10% interest = 990
    const json = original.getStateJson();

    const replay = SimRunner.fromSaveData(original.getSaveData());
    expect(replay.getStateJson()).toBe(json);
    expect(replay.getDebt()).toBe(original.getDebt());
    expect(replay.getFinanceAdvisor().interest).toBe(original.getFinanceAdvisor().interest);
  });
});
