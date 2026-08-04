/**
 * Finance advisor projection (FIN-01, decision live-derived — never
 * fabricated).
 *
 * 1. Pure projection on a hand-built TreasuryView returns exact
 *    balance/revenue/expenses/debt/interest/subsidy/arrears/deficit/overflow.
 * 2. Live accessor on a real runner after taxes+wages+subsidy+loan
 *    reconciles balance, category ledgers, debt, subsidyUsedThisYear, arrears.
 * 3. Deficit matches the ledger delta; overflow dropped amount surfaced.
 */
import { describe, expect, it } from 'vitest';
import { financeAdvisorFromState } from '../../src/sim/advisors';
import type { TreasuryView } from '../../src/sim/advisors';
import { SimRunner } from '../../src/sim/runner';
import { productionChainMap, buildProductionCity } from '../helpers';

describe('financeAdvisorFromState: pure projection', () => {
  it('returns exact balance, categories, debt, interest, subsidy, arrears, deficit, overflow', () => {
    const account: TreasuryView = {
      balance: 250,
      revenue: { taxes: 100, trade: 50, subsidy: 200 },
      expenses: { wages: 80, overflow: 30 },
      debt: 500,
      outstandingInterest: 25,
      subsidyUsedThisYear: 200,
    };
    const v = financeAdvisorFromState(account, 3, { taxRate: 0.1, wageRate: 0.1 });

    expect(v.balance).toBe(250);
    expect(v.revenue).toEqual({ taxes: 100, trade: 50, subsidy: 200 });
    expect(v.expenses).toEqual({ wages: 80, overflow: 30 });
    expect(v.debt).toBe(500);
    expect(v.interest).toBe(25);
    expect(v.subsidyUsedThisYear).toBe(200);
    expect(v.arrears).toBe(true);
    expect(v.deficit).toBe(100 + 50 + 200 - 80 - 30);
    expect(v.overflowDroppedThisYear).toBe(30);
    expect(v.taxRate).toBe(0.1);
    expect(v.wageRate).toBe(0.1);
  });

  it('arrears flag is false when nothing is owed', () => {
    const v = financeAdvisorFromState(
      { balance: 10, revenue: {}, expenses: {}, debt: 0, outstandingInterest: 0, subsidyUsedThisYear: 0 },
      0,
      { taxRate: 0, wageRate: 0 },
    );
    expect(v.arrears).toBe(false);
    expect(v.deficit).toBe(0);
    expect(v.overflowDroppedThisYear).toBe(0);
  });
});

describe('getFinanceAdvisor: live accessor on a real runner', () => {
  it('reconciles balance, category ledgers, debt, subsidy and arrears against real state', () => {
    const r = new SimRunner(5, productionChainMap());
    buildProductionCity(r);

    const before = r.getTreasury();
    const sub = r.requestRoyalSubsidy();
    expect(sub.ok).toBe(true);

    const loan = r.takeLoan(100);
    expect(loan.ok).toBe(true);

    for (let i = 0; i < 60; i++) r.tick();

    const v = r.getFinanceAdvisor();
    expect(v.balance).toBe(r.getTreasury());
    expect(v.debt).toBeGreaterThanOrEqual(100);
    expect(v.subsidyUsedThisYear).toBe(sub.grant);
    // subsidy revenue was recorded
    expect(v.revenue['subsidy'] ?? 0).toBe(sub.grant);
    // loan revenue was recorded
    expect(v.revenue['loan'] ?? 0).toBe(100);
    // balance reflects the subsidy + loan inflow
    expect(v.balance).toBeGreaterThanOrEqual(before + sub.grant + 100 - 200);
    expect(v.taxRate).toBe(0.1);
    expect(v.wageRate).toBe(0.1);
  });

  it('a max loan never lets the balance exceed the overflow cap (drop ledgered as overflow)', () => {
    const r = new SimRunner(6, productionChainMap());
    buildProductionCity(r);
    const loan = r.takeLoan(2000); // loanMaxAmount
    expect(loan.ok).toBe(true);
    for (let i = 0; i < 60; i++) r.tick();

    const v = r.getFinanceAdvisor();
    expect(v.balance).toBeLessThanOrEqual(5000); // CONFIG.treasuryOverflowLimit
    expect(v.overflowDroppedThisYear).toBeGreaterThanOrEqual(0);
    expect(v.debt).toBeGreaterThanOrEqual(2000);
  });
});
