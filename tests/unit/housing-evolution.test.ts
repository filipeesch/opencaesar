import { describe, it, expect } from 'vitest';
import { decideEvolution, DEFAULT_HYSTERESIS } from '../../src/sim/housingEvolution';

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
