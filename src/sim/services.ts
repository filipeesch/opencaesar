/**
 * Civic services (Phases 12 & 13 — tasks 9.1 health, 9.2 education,
 * 9.3 entertainment, 9.4 religion).
 *
 * Service walkers deliver coverage to houses: doctors/barbers raise health,
 * schools/libraries raise literacy, shows raise entertainment, and temples
 * raise each god's worship level (contributing to favor). All coverage is
 * computed from service coverage factors (0..1). Self-contained, additive.
 */
export interface ServiceCoverage {
  health: number; // 0..1
  literacy: number; // 0..1
  entertainment: number; // 0..1
  religion: number; // 0..1 (aggregate worship)
}

export interface ServicePool {
  doctorCoverage: number;
  educationCoverage: number;
  entertainmentCoverage: number;
  // per-god worship contributions (0..1 each)
  godWorship: Record<string, number>;
}

export function computeServiceCoverage(p: ServicePool): ServiceCoverage {
  return {
    health: Math.max(0, Math.min(1, p.doctorCoverage)),
    literacy: Math.max(0, Math.min(1, p.educationCoverage)),
    entertainment: Math.max(0, Math.min(1, p.entertainmentCoverage)),
    religion: Math.max(0, Math.min(1, Object.values(p.godWorship).reduce((s, v) => s + (v ?? 0), 0) / 5)),
  };
}

export const GODS = ['jupiter', 'neptune', 'ceres', 'bacchus', 'mercury'] as const;

/**
 * Religion (task 9.4): a temple's walker coverage raises its god's worship;
 * favor rises with the number of worshipped gods and falls with festivals cost.
 */
export function computeFavor(worship: Record<string, number>): number {
  const worshipped = Object.values(worship).filter((v) => (v ?? 0) > 0).length;
  return Math.min(100, worshipped * 20);
}

export interface FestivalInput {
  cost: number;
  treasury: number;
  worship: number;
}

/** Hold a festival: spend denarii to raise worship/favor (no free exploit). */
export function holdFestival(f: FestivalInput): { ok: boolean; newWorship: number; newFavor: number } {
  if (f.cost <= 0 || f.treasury < f.cost) return { ok: false, newWorship: f.worship, newFavor: computeFavor({ _: f.worship }) };
  const newWorship = Math.min(1, f.worship + 0.1);
  return { ok: true, newWorship, newFavor: computeFavor({ _: newWorship }) };
}

/** Festival tiers (task 9.4). */
export interface FestivalTier {
  id: 'small' | 'medium' | 'large' | 'provincial';
  cost: number;
  prepMonths: number;
  worshipBoost: number;
  favorBoost: number;
}

export const FESTIVAL_TIERS: FestivalTier[] = [
  { id: 'small', cost: 100, prepMonths: 1, worshipBoost: 0.05, favorBoost: 5 },
  { id: 'medium', cost: 250, prepMonths: 2, worshipBoost: 0.1, favorBoost: 10 },
  { id: 'large', cost: 500, prepMonths: 3, worshipBoost: 0.15, favorBoost: 15 },
  { id: 'provincial', cost: 1000, prepMonths: 3, worshipBoost: 0.2, favorBoost: 20 },
];

export interface FestivalPlan {
  tierId: FestivalTier['id'];
  prepRemaining: number;
  ready: boolean;
}

/** Begin preparation for a festival tier; becomes ready after prep months. */
export function startFestival(tierId: FestivalTier['id']): FestivalPlan | null {
  const tier = FESTIVAL_TIERS.find((t) => t.id === tierId);
  return tier ? { tierId, prepRemaining: tier.prepMonths, ready: false } : null;
}

/** Advance festival preparation by one month. */
export function tickFestival(plan: FestivalPlan): void {
  if (plan.ready) return;
  plan.prepRemaining -= 1;
  if (plan.prepRemaining <= 0) plan.ready = true;
}
