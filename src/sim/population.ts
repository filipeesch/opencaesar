/**
 * Population & Labor (Section 2 — tasks 2.1..2.7).
 *
 * Per-residence population model (capacity, class, age bands, employment),
 * age-band workforce eligibility (plebeians 16–60 work), migration by
 * attractiveness, a labor pool with priority-1..5 sectors, and an urban wage
 * policy compared against an imperial reference. Self-contained, additive.
 */
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
  return {
    relative: p.wageRate / (p.imperialReference || 1),
    band: p.wageRate < p.imperialReference ? 'below' : p.wageRate > p.imperialReference ? 'above' : 'at',
  };
}
