/**
 * Happiness: a 0..100 resident satisfaction score per house, and the
 * population-weighted city rating. Derived from the same coverage and
 * desirability the rest of the sim uses — never stored as mutable state.
 */

import { CONFIG } from './config';

export interface HouseHappinessInput {
  hasFood: boolean;
  hasWater: boolean;
  hasLabor: boolean;
  /** Desirability 0..200 (see housing.desirabilityOf). */
  desirability: number;
  wagesUnpaid: boolean;
}

/** Per-house happiness (0..100). Weights are tuned in CONFIG (see config.ts). */
export function houseHappiness(input: HouseHappinessInput): number {
  const coverage =
    (input.hasFood ? CONFIG.happinessFoodWeight : 0) +
    (input.hasWater ? CONFIG.happinessWaterWeight : 0) +
    (input.hasLabor ? CONFIG.happinessLaborWeight : 0);
  const desirability = (Math.min(200, input.desirability) / 200) * CONFIG.happinessDesirabilityWeight;
  const wage = input.wagesUnpaid ? 0 : CONFIG.happinessWagesWeight;
  const total = coverage + desirability + wage;
  if (total < 0) return 0;
  if (total > 100) return 100;
  return Math.round(total);
}

/**
 * City Happiness rating: population-weighted average of per-house happiness,
 * so many happy residents dominate a few unhappy ones (and empty slums do not
 * dilute a served core).
 */
export function cityHappiness(
  houses: Array<{
    population: number;
    happiness: number;
  }>,
): number {
  let pop = 0;
  let sum = 0;
  for (const h of houses) {
    pop += h.population;
    sum += h.population * h.happiness;
  }
  if (pop === 0) return 0;
  return Math.round(sum / pop);
}
