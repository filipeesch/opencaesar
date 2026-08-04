/**
 * Administrative requests — deterministic (seed + tick) governor requests.
 *
 * Requests arrive on the month cadence while a forum is placed, at most 3
 * active at a time, drawn by weighted roll from this catalog. Every request
 * carries a quantity, a deadline in months, a reward for full delivery, and a
 * penalty for expiry. Rewards/penalties are constant per entry, so outcomes
 * are deterministic. All values are flat data — no randomness, no clocks.
 */
import { hash } from '../src/sim/events';

export type RequestType = 'goods' | 'denarii' | 'population' | 'send_off';

export interface RequestDef {
  id: string;
  title: string;
  /** Player-visible flavor line. */
  description: string;
  type: RequestType;
  /** For `goods`, the commodity id delivered (see data/commodities.ts). */
  good?: string;
  /** Quantity to deliver / pay / the population target. */
  amount: number;
  deadlineMonths: number;
  /** Denarii credited to the treasury on full delivery. */
  reward: number;
  /** Denarii charged against the treasury if the deadline passes. */
  penalty: number;
  /** Probability weight for monthly selection. */
  weight: number;
  /** Government building that must be placed for this request to be eligible. */
  requires?: 'palatine';
}

export const REQUEST_CATALOG: RequestDef[] = [
  {
    id: 'grain_delivery', title: 'Grain Delivery',
    description: 'Deliver 150 loads of wheat to the capital.',
    type: 'goods', good: 'wheat', amount: 150, deadlineMonths: 12,
    reward: 300, penalty: 150, weight: 20,
  },
  {
    id: 'amphora_delivery', title: 'Amphora Delivery',
    description: 'Deliver 100 amphorae of pottery for the festival.',
    type: 'goods', good: 'pottery', amount: 100, deadlineMonths: 12,
    reward: 250, penalty: 125, weight: 15,
  },
  {
    id: 'wine_delivery', title: 'Wine Delivery',
    description: 'Deliver 100 amphorae of wine to the governor.',
    type: 'goods', good: 'wine', amount: 100, deadlineMonths: 12,
    reward: 250, penalty: 125, weight: 15,
  },
  {
    id: 'oil_delivery', title: 'Oil Delivery',
    description: 'Deliver 80 amphorae of olive oil for the baths.',
    type: 'goods', good: 'oil', amount: 80, deadlineMonths: 12,
    reward: 200, penalty: 100, weight: 12,
  },
  {
    id: 'tax_tithe', title: 'Tax Tithe',
    description: 'Pay 200 denarii as this year\'s tithe.',
    type: 'denarii', amount: 200, deadlineMonths: 6,
    reward: 150, penalty: 100, weight: 18,
  },
  {
    id: 'population_drive', title: 'Population Drive',
    description: 'Grow the city to 1500 inhabitants.',
    type: 'population', amount: 1500, deadlineMonths: 18,
    reward: 500, penalty: 250, weight: 8,
  },
  {
    id: 'grand_send_off', title: 'Grand Send-Off',
    description: 'Contribute 2000 denarii to the grand send-off.',
    type: 'send_off', amount: 2000, deadlineMonths: 6,
    reward: 3000, penalty: 0, weight: 6, requires: 'palatine',
  },
];

/* Non-eligible requests keep the roll window small: total weight is far
 * below the roll modulus, so most months no request arrives (null). */
const ROLL_RANGE = 1000;

/** Catalog entry for a request id (undefined when unknown). */
export function entryById(id: string): RequestDef | undefined {
  return REQUEST_CATALOG.find((r) => r.id === id);
}

/** Weighted eligible request for a (seed, tick), or null most months.
 *  Eligibility: the optional government requirement is placed and population
 *  requests target a population still above the current one. */
export function pickRequest(
  seed: number,
  tick: number,
  population: number,
  unlockedIds: readonly string[],
): RequestDef | null {
  const eligible = REQUEST_CATALOG.filter((r) => {
    if (r.requires && !unlockedIds.includes(r.requires)) return false;
    if (r.type === 'population' && population >= r.amount) return false;
    return true;
  });
  if (eligible.length === 0) return null;
  const total = eligible.reduce((s, r) => s + r.weight, 0);
  let roll = hash(seed, tick) % ROLL_RANGE;
  if (roll >= total) return null;
  for (const r of eligible) {
    roll -= r.weight;
    if (roll < 0) return r;
  }
  return null;
}
