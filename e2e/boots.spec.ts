import { expect, test } from '@playwright/test';
import { getState, openGame, pickTile, tileCenter, zoomOut } from './helpers';

test('boots the game shell with HUD and test API', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await openGame(page);
  await page.keyboard.press('B'); // WR-03: build panel is closed at boot

  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('Roman City Builder')).toBeVisible();
  await expect(page.getByTestId('build-road')).toBeVisible();
  await expect(page.getByTestId('build-house')).toBeVisible();
  await expect(page.getByTestId('build-farm')).toBeVisible();
  await expect(page.getByTestId('policy-tax')).toBeVisible();
  await expect(page.getByTestId('policy-wage')).toBeVisible();

  const state = await getState(page);
  expect(state.width).toBe(40);
  expect(state.height).toBe(40);
  expect(state.treasury).toBe(1000);
  expect(state.tick).toBeGreaterThan(0);

  await page.waitForTimeout(1000);
  const pop = await page.getByTestId('stat-population').textContent();
  const treasury = await page.getByTestId('stat-treasury').textContent();
  expect(pop).toMatch(/^\d+$/);
  expect(treasury).toMatch(/^\d+$/);

  expect(errors).toEqual([]);
});

test('placement errors surface as a HUD toast', async ({ page }) => {
  await openGame(page);
  await zoomOut(page);

  await page.keyboard.press('B'); // WR-03: build panel is closed at boot
  await page.getByTestId('build-house').click();
  await expect(page.getByTestId('build-house')).toHaveClass(/active/);

  const before = (await getState(page)).buildings.length;
  const target = await pickTile(page, (tiles, x, y) => tiles[y][x] !== 'water');
  expect(target, 'expected an in-viewport map tile').not.toBeNull();
  const point = await tileCenter(page, target!.tx, target!.ty);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(300);

  const toast = await page.getByTestId('toast').textContent();
  expect(toast).toContain('Cannot place House');

  const after = (await getState(page)).buildings.length;
  expect(after).toBe(before);

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('build-house')).not.toHaveClass(/active/);
});
