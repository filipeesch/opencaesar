import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildFoodCity, foodChainMap, runScenario } from '../helpers';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, 'fixtures', 'food-chain-golden.json');

/**
 * Golden snapshot of the happy-path city after 1200 ticks.
 * Regenerate intentionally on mechanic changes:
 *   npm run test:golden:update
 */
describe('golden snapshots', () => {
  it('matches the recorded food-chain snapshot', () => {
    const runner = runScenario(
      12345,
      foodChainMap(),
      (r) => {
        buildFoodCity(r);
        r.setPolicy(0, 0.5);
      },
      1200,
    );
    const state = JSON.parse(runner.getStateJson());

    if (process.env.GOLDEN_UPDATE) {
      mkdirSync(dirname(fixturePath), { recursive: true });
      writeFileSync(fixturePath, JSON.stringify(state, null, 2) + '\n');
      return;
    }

    const recorded = JSON.parse(readFileSync(fixturePath, 'utf8'));
    expect(state).toEqual(recorded);
  });
});
