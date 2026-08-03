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
