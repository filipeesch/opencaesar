/**
 * Housing Evolution (Phase 16 — tasks 1.9 / HOUS-01..02).
 *
 * Data-driven 21+ level progression with cumulative requirements and
 * hysteresis. A house evolves up when it satisfies the next level's cumulative
 * goods/services/desirability for the minimum eligibility period; it devolves
 * when it loses requirements past the tolerance period. Separate evolve and
 * devolve limits plus a grace period prevent oscillation. Pure logic,
 * additive to the live sim's existing housing.
 */
import { HOUSING_LEVELS } from '../../data/housing';

export interface EvolutionInput {
  currentLevel: number;
  /** Requirements (goods + services) the house currently has satisfied. */
  satisfied: string[];
  /** House desirability. */
  desirability: number;
  /** Ticks requirements have been satisfied consecutively. */
  satisfiedTicks: number;
  /** Ticks requirements have been missing consecutively. */
  unsatisfiedTicks: number;
}

export type EvolutionAction = 'evolve' | 'devolve' | 'none';

export interface HysteresisConfig {
  /** Extra desirability a house needs above the level's requirement to evolve. */
  evolveDesirabilityPadding: number;
  /** How far below requirement before devolving. */
  devolveDesirabilityTolerance: number;
  /** Ticks satisfied before evolution is allowed. */
  minSatisfiedTicks: number;
  /** Ticks unsatisfied before devolution triggers. */
  toleranceTicks: number;
}

export const DEFAULT_HYSTERESIS: HysteresisConfig = {
  evolveDesirabilityPadding: 5,
  devolveDesirabilityTolerance: 5,
  minSatisfiedTicks: 60,
  toleranceTicks: 90,
};

function levelDef(level: number) {
  return HOUSING_LEVELS.find((l) => l.level === level);
}

/** Whether the requirements of level `target` are fully satisfied. */
function requirementsSatisfied(target: number, satisfied: string[]): boolean {
  const def = levelDef(target);
  if (!def) return true;
  const need = [...def.requires, ...def.requiresGoods];
  return need.every((r) => satisfied.includes(r));
}

export function decideEvolution(input: EvolutionInput, cfg: HysteresisConfig = DEFAULT_HYSTERESIS): EvolutionAction {
  const next = input.currentLevel + 1;
  const current = levelDef(input.currentLevel);
  const nextDef = levelDef(next);

  // Evolve: requirements met, desirability high enough, eligibility period met.
  if (nextDef) {
    const reqMet = requirementsSatisfied(next, input.satisfied);
    const needDesirability = nextDef.desirability + cfg.evolveDesirabilityPadding;
    if (reqMet && input.desirability >= needDesirability && input.satisfiedTicks >= cfg.minSatisfiedTicks) {
      return 'evolve';
    }
  }

  // Devolve: current level's requirements lost past tolerance.
  if (current && input.currentLevel > 0) {
    const reqMet = requirementsSatisfied(input.currentLevel, input.satisfied);
    const tooLow = input.desirability < current.desirability - cfg.devolveDesirabilityTolerance;
    if ((!reqMet || tooLow) && input.unsatisfiedTicks >= cfg.toleranceTicks) {
      return 'devolve';
    }
  }

  return 'none';
}

/**
 * === Food variety requirements per evolution level (AGRI-01, spec §13.4) ===
 *
 * Maps each housing level to the number of food types the house must have
 * access to. Consulted by the food system before reporting evolution-blocking
 * shortages; additive and deterministic.
 */
export const FOOD_VARIETY_REQUIREMENT: Record<number, number> = {
  0: 0, // Tent/shack
  1: 1, // Hut/cabin
  2: 2,
  3: 2,
  4: 3,
  5: 4,
};

/** Number of food types required for a given housing level (spec §13.4). */
export function foodVarietyRequired(level: number): number {
  return FOOD_VARIETY_REQUIREMENT[Math.max(0, Math.min(5, level))] ?? 0;
}

/** Whether missing variety blocks evolution at `level` given the current variety. */
export function varietyBlocksEvolution(level: number, variety: number): boolean {
  return foodVarietyRequired(level) > variety;
}

/** The next level's variety requirement (used for "needs X more type" messages). */
export function nextLevelFoodVarietyNeeded(level: number, variety: number): number {
  const need = foodVarietyRequired(Math.min(5, level + 1));
  return Math.max(0, need - variety);
}
