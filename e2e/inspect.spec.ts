import { expect, test } from '@playwright/test';
import { openGame, pickTile, placeOn, tileCenter, zoomOut } from './helpers';

test('clicking a house opens a popup with tier and desirability', async ({ page }) => {
  await openGame(page);
  await zoomOut(page);

  const earth = await pickTile(page, (t, x, y) => t[y][x] === 'earth');
  expect(earth).not.toBeNull();
  await placeOn(page, 'road', earth!.tx, earth!.ty);
  expect((await placeOn(page, 'house', earth!.tx, earth!.ty + 1)).ok).toBe(true);

  const point = await tileCenter(page, earth!.tx, earth!.ty + 1);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(200);

  const popup = page.getByTestId('building-popup');
  await expect(popup).toBeVisible();
  await expect(popup).toContainText('House');
  await expect(popup).toContainText('Desirability');
});

test('clicking a farm shows its wheat stock', async ({ page }) => {
  await openGame(page);
  await zoomOut(page);

  const fertile = await pickTile(
    page,
    (t, x, y) =>
      y > 0 &&
      t[y][x] === 'fertile' &&
      t[y][x + 1] === 'fertile' &&
      t[y + 1][x] === 'fertile' &&
      t[y + 1][x + 1] === 'fertile' &&
      t[y - 1][x] !== 'water' &&
      t[y - 1][x] !== 'road',
  );
  expect(fertile).not.toBeNull();
  await placeOn(page, 'road', fertile!.tx, fertile!.ty - 1);
  const placed = await placeOn(page, 'farm', fertile!.tx, fertile!.ty);
  expect(placed.ok).toBe(true);

  const point = await tileCenter(page, fertile!.tx, fertile!.ty);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(200);

  const popup = page.getByTestId('building-popup');
  await expect(popup).toBeVisible();
  await expect(popup).toContainText('Farm');
  await expect(popup).toContainText('Wheat');
});

test('clicking empty terrain closes the popup', async ({ page }) => {
  await openGame(page);
  await zoomOut(page);

  const earth = await pickTile(page, (t, x, y) => t[y][x] === 'earth');
  expect(earth).not.toBeNull();
  await placeOn(page, 'road', earth!.tx, earth!.ty);
  await placeOn(page, 'house', earth!.tx, earth!.ty + 1);

  const point = await tileCenter(page, earth!.tx, earth!.ty + 1);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(200);
  await expect(page.getByTestId('building-popup')).toBeVisible();

  // Click a different earth tile that has no building.
  const empty = await pickTile(page, (t, x, y) => t[y][x] === 'earth' && !(x === earth!.tx && (y === earth!.ty || y === earth!.ty + 1)));
  expect(empty).not.toBeNull();
  const emptyPoint = await tileCenter(page, empty!.tx, empty!.ty);
  await page.mouse.click(emptyPoint.x, emptyPoint.y);
  await page.waitForTimeout(200);

  await expect(page.getByTestId('building-popup')).toBeHidden();
});

test('ESC closes an open popup', async ({ page }) => {
  await openGame(page);
  await zoomOut(page);

  const earth = await pickTile(page, (t, x, y) => t[y][x] === 'earth');
  expect(earth).not.toBeNull();
  await placeOn(page, 'road', earth!.tx, earth!.ty);
  await placeOn(page, 'house', earth!.tx, earth!.ty + 1);

  const point = await tileCenter(page, earth!.tx, earth!.ty + 1);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(200);
  await expect(page.getByTestId('building-popup')).toBeVisible();

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await expect(page.getByTestId('building-popup')).toBeHidden();
});

