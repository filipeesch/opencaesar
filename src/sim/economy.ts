/**
 * Economy: worker pool accounting, taxes, wages, treasury, and ratings.
 * Pure functions over building state — the runner wires them into the tick.
 */

import { CONFIG, HOUSE_TIERS } from './config';
import { effectivePopulation, effectiveTaxPerTick, effectiveWorkers } from './housingLive';
import type { Policy, Ratings } from './types';
import type { BuildingInstance } from './walkers';

export interface EconomyResult {
  taxIncome: number;
  wagesDue: number;
  /** Wages that could not be paid (treasury hit zero). */
  wagesUnpaid: number;
}

/** Worker pool: workers contributed by houses whose labor walker is out.
 *  Workers are read from the 21-level stats via the clamped liveStats accessor
 *  (HOUS-01) — never a bare index (NaN guard) — and scaled by the merged
 *  survivor's combined population (CR-02): an absorbed block doubles the block's
 *  workers alongside its population. */
export function workerPool(buildings: BuildingInstance[]): number {
  let total = 0;
  for (const b of buildings) {
    if (b.house && b.house.laborCooldown > 0) total += effectiveWorkers(b);
  }
  return total;
}

/** Workers currently assigned across all buildings. */
export function assignedWorkers(buildings: BuildingInstance[]): number {
  let total = 0;
  for (const b of buildings) total += b.workersAssigned;
  return total;
}

/** Total job positions = sum of all buildings' worker requirements. */
export function totalJobs(buildings: BuildingInstance[]): number {
  let total = 0;
  for (const b of buildings) total += b.workersRequired;
  return total;
}

/**
 * Advance the economy one tick: collect taxes, pay wages (never pushing the
 * treasury below zero). The unpaid remainder is returned for the housing
 * desirability penalty.
 */
export function tickEconomy(
  buildings: BuildingInstance[],
  policy: Policy,
  treasury: number,
): { treasury: number; result: EconomyResult } {
  let taxIncome = 0;
  for (const b of buildings) {
    // CR-02: a merged survivor pays on its combined population, so an absorbed
    // block's residents pay tax too (effective, combined-population scaled).
    if (b.house) taxIncome += effectiveTaxPerTick(b) * policy.taxRate;
  }

  const pool = workerPool(buildings);
  const wagesDue = pool * CONFIG.wagePerWorkerPerTick * policy.wageRate;
  const paid = Math.min(wagesDue, treasury);

  return {
    treasury: treasury + taxIncome - paid,
    result: {
      taxIncome,
      wagesDue,
      wagesUnpaid: wagesDue - paid,
    },
  };
}

/** Population = sum of house effective populations (level capacity, or the
 *  merged combined population when the house resulted from a merge — CR-02). */
export function populationOf(buildings: BuildingInstance[]): number {
  let total = 0;
  for (const b of buildings) {
    if (b.house) total += effectivePopulation(b);
  }
  return total;
}

/**
 * Prosperity (0..100) blends housing quality, employment, and revenue:
 * 40% housing quality (average tier / max tier), 30% employment
 * (assigned / pool), 30% revenue (treasury / target, capped).
 * `cityHappiness` is provided by the caller (it needs map + policy context).
 */
export function computeRatings(
  buildings: BuildingInstance[],
  treasury: number,
  cityHappiness?: number,
): Ratings {
  const population = populationOf(buildings);

  let tierSum = 0;
  let houseCount = 0;
  for (const b of buildings) {
    if (b.house) {
      tierSum += b.house.tier + 1;
      houseCount += 1;
    }
  }
  const housingScore = houseCount > 0 ? tierSum / (HOUSE_TIERS.length * houseCount) : 0;

  const pool = workerPool(buildings);
  const assigned = assignedWorkers(buildings);
  const employment = pool > 0 ? Math.min(1, assigned / pool) : 0;

  const revenueScore = Math.min(1, Math.max(0, treasury) / CONFIG.prosperityRevenueTarget);

  const prosperity = Math.round(100 * (0.4 * housingScore + 0.3 * employment + 0.3 * revenueScore));

  return { population, prosperity, happiness: cityHappiness ?? 0 };
}
