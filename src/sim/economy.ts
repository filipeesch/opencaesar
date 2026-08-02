/**
 * Economy: worker pool accounting, taxes, wages, treasury, and ratings.
 * Pure functions over building state — the runner wires them into the tick.
 */

import { CONFIG, HOUSE_TIERS } from './config';
import type { Policy, Ratings } from './types';
import type { BuildingInstance } from './walkers';

export interface EconomyResult {
  taxIncome: number;
  wagesDue: number;
  /** Wages that could not be paid (treasury hit zero). */
  wagesUnpaid: number;
}

/** Worker pool: workers contributed by houses whose labor walker is out. */
export function workerPool(buildings: BuildingInstance[]): number {
  let total = 0;
  for (const b of buildings) {
    if (b.house && b.house.laborCooldown > 0) total += HOUSE_TIERS[b.house.tier].workers;
  }
  return total;
}

/** Workers currently assigned across all buildings. */
export function assignedWorkers(buildings: BuildingInstance[]): number {
  let total = 0;
  for (const b of buildings) total += b.workersAssigned;
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
    if (b.house) taxIncome += HOUSE_TIERS[b.house.tier].taxPerTick * policy.taxRate;
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

/** Population = sum of house tier capacities. */
export function populationOf(buildings: BuildingInstance[]): number {
  let total = 0;
  for (const b of buildings) {
    if (b.house) total += HOUSE_TIERS[b.house.tier].population;
  }
  return total;
}

/**
 * Prosperity (0..100) blends housing quality, employment, and revenue:
 * 40% housing quality (average tier / max tier), 30% employment
 * (assigned / pool), 30% revenue (treasury / target, capped).
 */
export function computeRatings(buildings: BuildingInstance[], treasury: number): Ratings {
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

  return { population, prosperity };
}
