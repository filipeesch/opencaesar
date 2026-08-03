/**
 * Governor finances (task 7.4).
 *
 * Governor salary levels plus a personal account; donations and gifts raise
 * favor with a bounded, non-exploitable structure (donations are capped per
 * year and cost denarii in a 1:1 way — no repeated free favor farming).
 * Self-contained, additive.
 */
export const GOVERNOR_SALARY_LEVELS = [0, 100, 150, 250, 500] as const;

export interface GovernorState {
  salaryLevel: number;
  personalAccount: number;
  donationsThisYear: number;
}

export function createGovernor(salaryLevel = 0): GovernorState {
  return { salaryLevel, personalAccount: 0, donationsThisYear: 0 };
}

/** Pay the governor their salary into their personal account; reduces treasury. */
export function payGovernor(g: GovernorState, treasury: number): { salary: number; treasury: number } {
  const salary = GOVERNOR_SALARY_LEVELS[g.salaryLevel] ?? 0;
  const paid = Math.min(salary, treasury);
  g.personalAccount += paid;
  return { salary: paid, treasury: treasury - paid };
}

export interface DonationInput {
  treasury: number;
  favor: number;
  yearlyCap: number;
}

/** Donate denarii for favor (1 denarius = 1 favor), capped per year. */
export function donate(g: GovernorState, amount: number, input: DonationInput): { ok: boolean; favor: number; treasury: number } {
  const capped = Math.min(amount, input.yearlyCap - g.donationsThisYear);
  if (capped <= 0 || input.treasury < capped) return { ok: false, favor: input.favor, treasury: input.treasury };
  g.donationsThisYear += capped;
  return { ok: true, favor: input.favor + capped, treasury: input.treasury - capped };
}
