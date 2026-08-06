/**
 * Population & Labor (Section 2 — tasks 2.1..2.7).
 *
 * Per-residence population model (capacity, class, age bands, employment),
 * age-band workforce eligibility (plebeians 16–60 work), migration by
 * attractiveness, a labor pool with priority-1..5 sectors, and an urban wage
 * policy compared against an imperial reference. Self-contained, additive.
 */
import type { Rng } from './rng';
export type ResidentClass = 'plebeian' | 'patrician';

export interface Resident {
  id: number;
  class: ResidentClass;
  age: number;
  employed: boolean;
}

/** Model population per residence. */
export class Residence {
  readonly capacity: number;
  readonly residentClass: ResidentClass;
  readonly inhabitants: Resident[] = [];
  private nextId = 1;

  constructor(capacity = 5, residentClass: ResidentClass = 'plebeian') {
    this.capacity = capacity;
    this.residentClass = residentClass;
  }

  get population(): number {
    return this.inhabitants.length;
  }

  /** Spawn a new resident if there is room. */
  moveIn(residentClass: ResidentClass, age = 30): boolean {
    if (this.population >= this.capacity) return false;
    this.inhabitants.push({ id: this.nextId++, class: this.residentClass ?? residentClass, age, employed: false });
    return true;
  }

  /** Number of residents of working age (16–60) who could be employed. */
  workforce(): number {
    return this.inhabitants.filter((r) => r.age >= 16 && r.age <= 60).length;
  }

  employedCount(): number {
    return this.inhabitants.filter((r) => r.employed).length;
  }
}

/** Workforce eligibility: plebeians 16–60 work; patricians/children/elderly do not. */
export function isEligible(resident: Resident): boolean {
  return resident.class === 'plebeian' && resident.age >= 16 && resident.age <= 60;
}

export interface MigrationInput {
  /** 0..1 attractiveness (services, jobs, desirability). */
  attractiveness: number;
  unemployment: number; // 0..1
  capacityAvailable: number;
}

/** Net migration: positive = immigration. Bounded by available house capacity. */
export function netMigration(i: MigrationInput): number {
  const pull = (i.attractiveness - i.unemployment) * 10;
  const capped = Math.min(Math.floor(pull), Math.floor(i.capacityAvailable));
  return Math.max(0, capped);
}

export type SectorPriority = 1 | 2 | 3 | 4 | 5;

export interface LaborSector {
  id: string;
  priority: SectorPriority;
  needed: number;
  assigned: number;
  pinned: boolean;
}

/** Allocate scarce workers to higher-priority sectors first. */
export function allocateWorkers(sectors: LaborSector[], pool: number): number {
  let remaining = pool;
  const ordered = [...sectors].sort((a, b) => a.priority - b.priority);
  for (const s of ordered) {
    if (!s.pinned && remaining <= 0) break;
    const assign = Math.min(s.needed, remaining);
    s.assigned = assign;
    remaining -= assign;
  }
  return remaining;
}

export interface WagePolicy {
  wageRate: number; // 0..1
  imperialReference: number; // reference wage
}

/** Wage band reporting compared to the imperial reference. */
export function wageBand(p: WagePolicy): { band: 'below' | 'at' | 'above'; relative: number } {
  // IN-03: the guarded reference feeds BOTH the ratio and the band comparison,
  // so a reference of 0 (unreachable in production — IMPERIAL_WAGE_REFERENCE is
  // 0.3) keeps the two consistent at the boundary instead of reporting 'above'
  // for any wageRate > 0 while dividing by 1.
  const ref = p.imperialReference || 1;
  return {
    relative: p.wageRate / ref,
    band: p.wageRate < ref ? 'below' : p.wageRate > ref ? 'above' : 'at',
  };
}

// ============================================================================
// Phase 19.1 (POP-01/02/04) — additive pure deterministic helpers wiring the
// orphaned module into the live sim. NO RNG/wall-clock beyond the injected
// seeded factory; tuning stays module-local (balance-parity — never a
// BALANCE/CONFIG key).
// ============================================================================

/** Patricians first appear at house tier >= 3 (tierOfLevel bucket, POP-01 A4). */
const PATRICIAN_MIN_TIER = 3;
/** Patrician share added per tier above the minimum (capped at 0.6). */
const PATRICIAN_SHARE_PER_TIER = 0.2;
const PATRICIAN_SHARE_CAP = 0.6;
/** Age-band boundaries: children 0-15, workforce 16-60, elderly 61+. */
const CHILDREN_MAX_AGE = 15;
const WORKFORCE_MAX_AGE = 60;
const ELDERLY_MAX_AGE = 80;
/** Age-band draw weights (children / workforce / elderly). */
const CHILD_WEIGHT = 0.25;
const WORKFORCE_WEIGHT = 0.55;
const ELDERLY_WEIGHT = 0.2;

/** Patrician fraction of a house cohort by level (tier >= 3 introduces them). */
function patricianFraction(level: number): number {
  const tier = Math.floor((Number.isFinite(level) ? level : 0) / 4);
  if (tier < PATRICIAN_MIN_TIER) return 0;
  return Math.min(PATRICIAN_SHARE_CAP, (tier - (PATRICIAN_MIN_TIER - 1)) * PATRICIAN_SHARE_PER_TIER);
}

/** Deterministic age in the children/workforce/elderly bands from a seeded RNG. */
function rngAge(rng: Rng): number {
  const u = Math.max(0, Math.min(0.9999999, rng.next()));
  if (u < CHILD_WEIGHT) return 1 + Math.floor((u / CHILD_WEIGHT) * CHILDREN_MAX_AGE);
  if (u < CHILD_WEIGHT + WORKFORCE_WEIGHT) {
    const t = (u - CHILD_WEIGHT) / WORKFORCE_WEIGHT;
    return CHILDREN_MAX_AGE + 1 + Math.floor(t * (WORKFORCE_MAX_AGE - CHILDREN_MAX_AGE));
  }
  const t = (u - CHILD_WEIGHT - WORKFORCE_WEIGHT) / ELDERLY_WEIGHT;
  return WORKFORCE_MAX_AGE + 1 + Math.floor(t * (ELDERLY_MAX_AGE - WORKFORCE_MAX_AGE));
}

/**
 * Deterministically build a cohort of exactly `capacity` residents for a house
 * (POP-01). Count equals the house's effective population (occupancy/capacity).
 * Class share honors tierOfLevel: tier >= 3 introduces patricians. Ages are
 * drawn from a mulberry32 RNG seeded by `salt` (a house-stable integer — id +
 * level + tick month — NEVER Math.random), bucketed into children/workforce/
 * elderly. Employment starts false. ids run 1..capacity. Same seed + same salt
 * + same capacity → byte-identical cohort (save/load replay reproduces it).
 */
export function residentsForHouse(
  level: number | undefined,
  capacity: number,
  salt: number,
  seeded: (seed: number) => Rng,
): Resident[] {
  const cap = Math.max(0, Math.floor(capacity));
  const nonPatrician = 1 - patricianFraction(level ?? 0);
  const rng = seeded(salt >>> 0);
  const cohort: Resident[] = [];
  for (let id = 1; id <= cap; id++) {
    const r = rng.next();
    cohort.push({
      id,
      class: r < nonPatrician ? 'plebeian' : 'patrician',
      age: rngAge(rng),
      employed: false,
    });
  }
  return cohort;
}

/** Month aging (POP-01): every resident ages one year per %40 month. Class/id
 *  stay stable; employment is never auto-granted (workforce eligibility is a
 *  read-only predicate). Deterministic — no RNG. */
export function ageOnMonth(residents: Resident[]): void {
  for (const r of residents) r.age += 1;
}

/** Module-local imperial wage reference (POP-04, [ASSUMED A1]). Inside (0,1)
 *  because setPolicy clamps wageRate to 0..1 — a stock wage can sit below or
 *  above it. Pure reporting semantics; no treasury/behavior effect. */
export const IMPERIAL_WAGE_REFERENCE = 0.3;

/** Unemployment-band thresholds into labelled tiers (POP-04, [ASSUMED A2]).
 *  A total pure function: NaN/out-of-range is clamped into 0..1 so empty-city
 *  advisors compose without throwing (Pitfall 5). */
export function unemploymentBand(rate: number): { label: string; rate: number } {
  const clamped = Number.isFinite(rate) ? Math.max(0, Math.min(1, rate)) : 0;
  const label = clamped <= 0.15 ? 'healthy' : clamped <= 0.35 ? 'moderate' : 'high';
  return { label, rate: clamped };
}
