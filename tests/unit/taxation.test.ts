import { describe, it, expect } from 'vitest';
import { Treasury } from '../../src/sim/finance';
import { taxCollected, financeAdvisorView, TAX_MULTIPLIERS } from '../../src/sim/taxation';

describe('taxation (task 7.2)', () => {
  it('tax scales with residents, level multiplier, rate, and coverage', () => {
    const high = taxCollected(100, 5, 1, 1);
    const low = taxCollected(100, 5, 0.5, 0.5);
    expect(high).toBeGreaterThan(low);
    expect(taxCollected(100, 5, 1, 0)).toBe(0); // no registration coverage → no tax
    expect(TAX_MULTIPLIERS.length).toBeGreaterThanOrEqual(5);
  });
});

describe('finance advisor data (task 7.5)', () => {
  it('reads real revenue/expense and projects from the treasury', () => {
    const t = new Treasury(1000);
    t.addRevenue('taxes', 200);
    t.addExpense('wages', 100);
    const v = financeAdvisorView(t, 200, 50, 6);
    expect(v.balance).toBe(1100);
    expect(v.monthlyChange).toBe(100);
    expect(v.projection).toBe(1700); // 1100 + 100*6
    expect(v.taxes).toBe(200);
    expect(v.salary).toBe(50);
  });
});
