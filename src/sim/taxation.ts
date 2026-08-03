/**
 * Taxation & Finance advisor data (Section 7 — tasks 7.2, 7.5).
 *
 * Per-level tax multipliers, collector coverage (registration coverage loss),
 * and the numbers the finance advisor reads from real revenue/expense/tax
 * data. Self-contained, additive to the finance treasury.
 */
import type { Treasury } from './finance';

export const TAX_MULTIPLIERS: number[] = [0.1, 0.2, 0.3, 0.5, 0.8, 1, 1.2, 1.5, 1.8, 2];

/** Tax owed by `residents` at house level `level`, scaled by rate and coverage. */
export function taxCollected(
  residents: number,
  level: number,
  rate: number, // 0..1
  registrationCoverage: number, // 0..1
): number {
  const multiplier = TAX_MULTIPLIERS[level] ?? TAX_MULTIPLIERS[TAX_MULTIPLIERS.length - 1];
  return Math.round(residents * multiplier * rate * registrationCoverage);
}

export interface FinanceAdvisorView {
  revenue: Record<string, number>;
  expenses: Record<string, number>;
  balance: number;
  dept: number;
  monthlyChange: number;
  projection: number;
  taxes: number;
  salary: number;
}

/** Build the advisor's read model from a Treasury plus tax/salary inputs. */
export function financeAdvisorView(
  t: Treasury,
  taxes: number,
  salary: number,
  projectionMonths = 12,
): FinanceAdvisorView {
  return {
    revenue: { ...t.revenue } as Record<string, number>,
    expenses: { ...t.expenses } as Record<string, number>,
    balance: t.balance,
    dept: t.debt,
    monthlyChange: t.monthlyChange(),
    projection: t.project(projectionMonths),
    taxes,
    salary,
  };
}
