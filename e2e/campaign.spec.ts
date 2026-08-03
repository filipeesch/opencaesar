import { expect, test } from '@playwright/test';
import { openGame, runTicks } from './helpers';

/**
 * Full-chain acceptance: drive an objective/win-condition to completion through
 * the live sim — ties the modular systems into the running game (10.6 / 12.6).
 */
test('winning a trivial objective is reported through the live sim', async ({ page }) => {
  await openGame(page);
  // The city already has population > 0, so a 1-check population objective is trivially winnable.
  const result = await page.evaluate(() => {
    const api = window.__cityApi!;
    api.setObjective({ population: 0, sustainChecks: 1 });
    api.runTicks(10);
    return api.objectiveProgress();
  });
  expect(result).not.toBeNull();
  expect(result!.won).toBe(true);
  expect(result!.progress).toBe(1);
});

test('derived advisor data is live and coherent after a long run', async ({ page }) => {
  await openGame(page);
  await runTicks(page, 2000);
  const d = await page.evaluate(() => window.__cityApi!.derived());
  expect(d).not.toBeNull();
  expect(typeof d.population).toBe('number');
  expect(d.water.totalTiles).toBeGreaterThan(0);
  expect(d.codex.buildings).toBeGreaterThan(0);
});

test('long haul of the sim does not error (systems wired into tick)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openGame(page);
  await runTicks(page, 2000);
  expect(errors).toEqual([]);
});
