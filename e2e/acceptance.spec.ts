import { expect, test } from '@playwright/test';
import { getState, openGame, pickTile, runTicks, tileCenter, zoomOut } from './helpers';

/**
 * §54 acceptance: no central control is decorative — every HUD control must
 * change real game/sim state when clicked. (task 12.6)
 */
test('build menu toggles a real build mode', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('B'); // WR-03: build panel is closed at boot
  await page.getByTestId('build-house').click();
  await expect(page.getByTestId('build-house')).toHaveClass(/active/);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('build-house')).not.toHaveClass(/active/);
});

test('pause halts simulated time and resume restores it', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('pause-button').click();
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  const tickAtPause = (await getState(page)).tick;
  await page.waitForTimeout(600);
  expect((await getState(page)).tick).toBe(tickAtPause); // time frozen
  await page.getByTestId('resume-button').click();
  await expect(page.getByTestId('pause-overlay')).toBeHidden();
  await page.waitForTimeout(400);
  expect((await getState(page)).tick).toBeGreaterThan(tickAtPause); // time resumes
});

test('placing a building actually adds it to the sim state', async ({ page }) => {
  await openGame(page);
  await zoomOut(page);
  await page.keyboard.press('B'); // WR-03: build panel is closed at boot
  await page.getByTestId('build-road').click();
  const target = await pickTile(page, (tiles, x, y) => tiles[y][x] !== 'water');
  const point = await tileCenter(page, target!.tx, target!.ty);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(300);
  const state = await getState(page);
  expect(state.buildings.some((b) => b.type === 'road')).toBe(true);
  await page.keyboard.press('Escape');
});

test('policy sliders update live sim policy', async ({ page }) => {
  await openGame(page);
  await runTicks(page, 10);
  await page.getByTestId('policy-tax').fill('35');
  await page.getByTestId('policy-tax').dispatchEvent('change');
  await page.waitForTimeout(200);
  expect((await getState(page)).policy.taxRate).toBeCloseTo(0.35, 2);
});

test('build menu exposes the full construction catalog (not just 6 types)', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('B'); // WR-03: build panel is closed at boot
  for (const type of ['road', 'house', 'garden', 'fountain', 'orchard', 'granary', 'fire_station', 'clinic', 'school', 'temple', 'theatre', 'forum']) {
    await expect(page.getByTestId(`build-${type}`)).toBeVisible();
  }
  // category tabs exist for the new groups
  for (const cat of ['water', 'education', 'religion', 'government', 'ornament']) {
    await expect(page.getByTestId(`category-${cat}`)).toBeVisible();
  }
});
