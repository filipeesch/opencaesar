import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildFoodCity, foodChainMap, runScenario } from '../helpers';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, 'fixtures', 'food-chain-golden.json');
const pausedFixturePath = join(here, 'fixtures', 'paused-commands-golden.json');

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

/**
 * Golden snapshot of the paused-command pipeline: build/demolish/policy orders
 * issued while paused are applied identically on resume (same seed → identical
 * final state). Regenerate intentionally on mechanic changes:
 *   npm run test:golden:update
 */
describe('paused-command pipeline golden', () => {
  it('matches the recorded paused-command snapshot', () => {
    const runner = runScenario(
      24680,
      foodChainMap(),
      (r) => {
        buildFoodCity(r);
        r.setPaused(true);
        r.placeBuilding('road', 10, 6);
        r.setPolicy(0.2, 0.35);
        r.demolish(3, 5); // a road placed by buildFoodCity (row y=5)
        r.setPaused(false);
      },
      1200,
    );
    const state = JSON.parse(runner.getStateJson());

    if (process.env.GOLDEN_UPDATE) {
      mkdirSync(dirname(pausedFixturePath), { recursive: true });
      writeFileSync(pausedFixturePath, JSON.stringify(state, null, 2) + '\n');
      return;
    }

    const recorded = JSON.parse(readFileSync(pausedFixturePath, 'utf8'));
    expect(state).toEqual(recorded);
  });
});
