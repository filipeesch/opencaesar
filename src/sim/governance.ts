/**
 * Governance & Admin Requests (Phase 14 — tasks 10.1, 10.2).
 *
 * Government buildings unlock at population thresholds and confer effects.
 * Administrative requests carry a title/description, quantity, deadline,
 * reward and penalty, and may be satisfied in full or partially.
 * Self-contained, additive.
 */
export interface GovBuilding {
  id: string;
  name: string;
  /** Minimum population to unlock. */
  threshold: number;
  /** Effect granted while active. */
  effect: string;
}

export const GOV_BUILDINGS: GovBuilding[] = [
  { id: 'forum', name: 'Forum', threshold: 1000, effect: 'unlocks administration' },
  { id: 'senate', name: 'Senate', threshold: 2000, effect: 'governor salary' },
  { id: 'palatine', name: 'Governor Palace', threshold: 5000, effect: 'grand send-off' },
];

/** Which government buildings are unlocked at a given population. */
export function unlockedGov(population: number): GovBuilding[] {
  return GOV_BUILDINGS.filter((g) => population >= g.threshold);
}

export type RequestType = 'goods' | 'denarii' | 'population';

export interface AdminRequest {
  id: string;
  title: string;
  description: string;
  type: RequestType;
  amount: number;
  deadlineMonths: number;
  reward: number;
  penalty: number;
  delivered: number;
}

export function createRequest(r: Omit<AdminRequest, 'delivered'>): AdminRequest {
  return { ...r, delivered: 0 };
}

export type RequestResult =
  | { status: 'deliver'; reward: number }
  | { status: 'partial'; delivered: number; remaining: number }
  | { status: 'expired'; penalty: number };

/** Accept a delivery toward a request; returns the outcome. */
export function deliverRequest(req: AdminRequest, amount: number, monthsElapsed: number): RequestResult {
  const added = Math.min(amount, req.amount - req.delivered);
  req.delivered += added;
  if (req.delivered >= req.amount) {
    return { status: 'deliver', reward: req.reward };
  }
  if (monthsElapsed > req.deadlineMonths) {
    return { status: 'expired', penalty: req.penalty };
  }
  return { status: 'partial', delivered: req.delivered, remaining: req.amount - req.delivered };
}
