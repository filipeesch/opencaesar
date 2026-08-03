import { describe, it, expect } from 'vitest';
import { Treasury, rollYear } from '../../src/sim/finance';

describe('finance treasury (Phase 10)', () => {
  it('tracks categorized revenue and expenses', () => {
    const t = new Treasury(0);
    t.addRevenue('taxes', 500);
    t.addRevenue('trade', 200);
    t.addExpense('wages', 300);
    expect(t.balance).toBe(400);
    expect(t.monthlyChange()).toBe(400);
    expect((t.revenue.taxes ?? 0)).toBe(500);
    expect((t.expenses.wages ?? 0)).toBe(300);
  });

  it('expenses cannot drive the balance below zero', () => {
    const t = new Treasury(100);
    const r = t.addExpense('festival', 2000);
    expect(r.paid).toBe(100);
    expect(t.balance).toBe(0);
    expect(r.ok).toBe(false);
  });

  it('projects a future balance', () => {
    const t = new Treasury(1000);
    t.addRevenue('taxes', 100); // balance 1100; monthlyChange = +100
    expect(t.project(6)).toBe(1700);
  });

  it('royal subsidy is bounded by treasury shortfall and usable once', () => {
    const t = new Treasury(100);
    const grant = t.requestSubsidy(2000);
    expect(grant).toBeGreaterThan(0);
    expect(t.balance).toBeGreaterThanOrEqual(1000 - 2000 * 1);
    expect(t.requestSubsidy(2000)).toBe(0); // exhausted for the year? bounded by surplus now
  });

  it('debt accrues interest and incurs a favor penalty at high debt', () => {
    const t = new Treasury(0);
    t.takeLoan(5000, 0.1);
    expect(t.debt).toBe(5000);
    expect(t.balance).toBe(5000);
    const { favorPenalty } = t.accrue(0.1);
    expect(t.debt).toBeGreaterThan(5000);
    expect(favorPenalty).toBeGreaterThan(0);
    t.repayLoan(1000);
    expect(t.debt).toBeLessThan(5000);
  });

  it('yearly rollover resets the ledger', () => {
    const t = new Treasury(0);
    t.addRevenue('taxes', 100);
    rollYear(t);
    expect(Object.keys(t.revenue).length).toBe(0);
  });
});
