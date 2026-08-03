/**
 * Finance (Phase 10 — tasks 7.1, 7.3).
 *
 * Treasury bookkeeping with categorized revenue/expenses, monthly/annual
 * tracking, a projection/balance model, royal subsidy requests, and debt with
 * interest + favor reduction. Self-contained, additive to the live sim.
 */
export type FinCategory = 'taxes' | 'wages' | 'trade' | 'subsidy' | 'festival' | 'loan' | 'other';

export interface FinanceLedger {
  revenue: Partial<Record<FinCategory, number>>;
  expenses: Partial<Record<FinCategory, number>>;
}

export class Treasury {
  balance: number;
  revenue: Partial<Record<FinCategory, number>> = {};
  expenses: Partial<Record<FinCategory, number>> = {};
  debt = 0;
  readonly yearlyReset: boolean;
  private subsidyUsedThisYear = 0;

  constructor(startingBalance: number, opts: { yearlyReset?: boolean } = {}) {
    this.balance = startingBalance;
    this.yearlyReset = opts.yearlyReset ?? false;
  }

  /** Record revenue; returns the new balance. */
  addRevenue(cat: FinCategory, amount: number): number {
    if (amount <= 0) return this.balance;
    this.revenue[cat] = (this.revenue[cat] ?? 0) + amount;
    this.balance += amount;
    return this.balance;
  }

  /** Record an expense; clamps spending so the balance never goes below 0. */
  addExpense(cat: FinCategory, amount: number): { ok: boolean; paid: number; balance: number } {
    if (amount <= 0) return { ok: true, paid: 0, balance: this.balance };
    const paid = Math.min(amount, this.balance);
    this.expenses[cat] = (this.expenses[cat] ?? 0) + paid;
    this.balance -= paid;
    return { ok: paid >= amount, paid, balance: this.balance };
  }

  monthlyChange(): number {
    const roc = Object.values(this.revenue).reduce((s, v) => s + (v ?? 0), 0);
    const ex = Object.values(this.expenses).reduce((s, v) => s + (v ?? 0), 0);
    return roc - ex;
  }

  /** Project a future balance given a running surplus/deficit per period. */
  project(periods: number, changePerPeriod = this.monthlyChange()): number {
    return this.balance + changePerPeriod * periods;
  }

  /** Request a bounded royal subsidy (usable once per year). */
  requestSubsidy(cap: number): number {
    if (this.subsidyUsedThisYear >= cap) return 0;
    const grant = Math.max(0, Math.min(cap - this.subsidyUsedThisYear, 1000 - this.balance));
    if (grant <= 0) return 0;
    this.subsidyUsedThisYear += grant;
    this.addRevenue('subsidy', grant);
    return grant;
  }

  takeLoan(amount: number, interestRate: number): number {
    if (amount <= 0) return 0;
    this.debt += amount;
    this.addRevenue('loan', amount);
    this.outstandingInterest = (this.outstandingInterest ?? 0) + amount * interestRate;
    return amount;
  }

  outstandingInterest = 0;

  /** Accrue one period of interest; high debt reduces favor. */
  accrue(interestRate: number): { favorPenalty: number } {
    if (this.debt <= 0) {
      this.outstandingInterest = 0;
      return { favorPenalty: 0 };
    }
    const interest = Math.floor(this.debt * interestRate);
    this.debt += interest;
    this.outstandingInterest += interest;
    const favorPenalty = this.debt > 1000 ? Math.min(10, Math.floor(this.debt / 500)) : 0;
    return { favorPenalty };
  }

  repayLoan(amount: number): number {
    const paid = Math.min(this.debt, amount, this.balance);
    this.balance -= paid;
    this.debt -= paid;
    this.outstandingInterest = Math.max(0, this.outstandingInterest - paid);
    return paid;
  }
}

/** Reset monthly/annual tracking (e.g. on the yearly rollover). */
export function rollYear(t: Treasury): void {
  t.revenue = {};
  t.expenses = {};
}
