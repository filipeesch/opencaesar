import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { buildFoodCity, foodChainMap } from '../helpers';

function scriptedRun(seed: number, ticks: number): string {
  const runner = new SimRunner(seed, foodChainMap());
  buildFoodCity(runner);
  runner.setPolicy(0, 0.5);
  for (let i = 0; i < ticks; i++) runner.tick();
  return runner.getStateJson();
}

describe('determinism', () => {
  it('same seed and command sequence produce identical snapshots', () => {
    expect(scriptedRun(1234, 1000)).toBe(scriptedRun(1234, 1000));
  });

  it('same seed with different tick counts differs (state advances)', () => {
    expect(scriptedRun(1234, 500)).not.toBe(scriptedRun(1234, 501));
  });

  it('different seeds diverge once randomness is involved', () => {
    const a = JSON.parse(scriptedRun(1, 1000));
    const b = JSON.parse(scriptedRun(2, 1000));
    expect(JSON.stringify(a.walkers)).not.toBe(JSON.stringify(b.walkers));
  });
});
