import { describe, it, expect } from 'vitest';
import { decideEvolution, DEFAULT_HYSTERESIS } from '../../src/sim/housingEvolution';
import { foodVarietyRequired, varietyBlocksEvolution, nextLevelFoodVarietyNeeded } from '../../src/sim/housingEvolution';

const CFG = DEFAULT_HYSTERESIS;

describe('housing evolution (Phase 16)', () => {
  it('evolves when next-level requirements and desirability are met for the eligibility period', () => {
    // level 3 requires well + market + wheat.
    const satisfied = ['well', 'market', 'wheat'];
    const base = { currentLevel: 2, satisfied, desirability: 20, satisfiedTicks: 0, unsatisfiedTicks: 0 };
    expect(decideEvolution({ ...base, satisfiedTicks: CFG.minSatisfiedTicks - 1 }, CFG)).toBe('none');
    expect(decideEvolution({ ...base, satisfiedTicks: CFG.minSatisfiedTicks }, CFG)).toBe('evolve');
  });

  it('does not evolve when desirability is below the padded requirement', () => {
    const satisfied = ['well', 'market', 'wheat'];
    const r = decideEvolution({ currentLevel: 2, satisfied, desirability: 0, satisfiedTicks: 999, unsatisfiedTicks: 0 }, CFG);
    expect(r).not.toBe('evolve');
  });

  it('devolves after losing requirements past the tolerance period', () => {
    const r = decideEvolution({ currentLevel: 2, satisfied: [], desirability: 20, satisfiedTicks: 0, unsatisfiedTicks: CFG.toleranceTicks }, CFG);
    expect(r).toBe('devolve');
  });

  it('hysteresis prevents oscillation near the boundary (grace before devolve)', () => {
    const r = decideEvolution({ currentLevel: 2, satisfied: [], desirability: 20, satisfiedTicks: 0, unsatisfiedTicks: CFG.toleranceTicks - 1 }, CFG);
    expect(r).toBe('none');
  });
});

describe('food variety requirements per level (AGRI-01, spec §13.4)', () => {
  it('maps levels to required food-type counts (0–4)', () => {
    expect(foodVarietyRequired(0)).toBe(0);
    expect(foodVarietyRequired(1)).toBe(1);
    expect(foodVarietyRequired(2)).toBe(2);
    expect(foodVarietyRequired(3)).toBe(2);
    expect(foodVarietyRequired(4)).toBe(3);
    expect(foodVarietyRequired(5)).toBe(4);
  });

  it('variety blocks evolution only when below the next level requirement', () => {
    expect(varietyBlocksEvolution(4, 2)).toBe(true); // level 4 → 5 needs 4 types
    expect(varietyBlocksEvolution(4, 4)).toBe(false);
    expect(nextLevelFoodVarietyNeeded(4, 2)).toBe(2);
    expect(nextLevelFoodVarietyNeeded(4, 4)).toBe(0);
  });
});
