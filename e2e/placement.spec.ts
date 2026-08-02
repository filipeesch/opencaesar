import { expect, test } from '@playwright/test';
import { findBuilding, getState, openGame, pickTile, placeOn, runTicks, tileCenter, toastText, zoomOut } from './helpers';

test('builds a road and a house by clicking the canvas in build mode', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openGame(page);
  await zoomOut(page);

  await page.getByTestId('build-road').click();
  await expect(page.getByTestId('build-road')).toHaveClass(/active/);

  const roadTile = await pickTile(page, (tiles, x, y) => {
    if (tiles[y][x] !== 'earth') return false;
    return tiles[y][x + 1] !== 'water';
  });
  expect(roadTile, 'expected an earth tile with a buildable neighbor').not.toBeNull();

  const roadPoint = await tileCenter(page, roadTile!.tx, roadTile!.ty);
  await page.mouse.click(roadPoint.x, roadPoint.y);
  await page.waitForTimeout(300);
  expect(await findBuilding(page, 'road', roadTile!.tx, roadTile!.ty)).toBe(true);

  await page.getByTestId('build-house').click();
  await expect(page.getByTestId('build-house')).toHaveClass(/active/);
  const housePoint = await tileCenter(page, roadTile!.tx + 1, roadTile!.ty);
  await page.mouse.click(housePoint.x, housePoint.y);
  await page.waitForTimeout(300);
  expect(await findBuilding(page, 'house', roadTile!.tx + 1, roadTile!.ty)).toBe(true);
  // A successful single click must not pop a spurious "occupied" toast.
  expect(await toastText(page)).toBe('');

  const finalState = await getState(page);
  expect(finalState.buildings.some((b) => b.type === 'road')).toBe(true);
  expect(finalState.buildings.some((b) => b.type === 'house')).toBe(true);

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('build-house')).not.toHaveClass(/active/);
  expect(errors).toEqual([]);
});

test('farm only places on fertile terrain, otherwise shows a toast', async ({ page }) => {
  await openGame(page);
  await zoomOut(page);

  await page.getByTestId('build-farm').click();

  const site = await pickTile(page, (tiles, x, y) => {
    if (x === 0 || x + 2 > tiles[0].length || y + 2 > tiles.length) return false;
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        if (tiles[y + dy][x + dx] !== 'fertile') return false;
      }
    }
    return tiles[y][x - 1] !== 'water';
  });
  const bad = await pickTile(page, (tiles, x, y) => tiles[y][x] === 'trees');
  expect(site, 'expected an in-viewport fertile tile with a buildable road spot').not.toBeNull();
  expect(bad, 'expected an in-viewport trees tile').not.toBeNull();

  const before = (await getState(page)).buildings.length;
  const badPoint = await tileCenter(page, bad!.tx, bad!.ty);
  await page.mouse.click(badPoint.x, badPoint.y);
  await page.waitForTimeout(300);
  expect((await page.getByTestId('toast').textContent()) ?? '').toContain('Cannot place Farm');
  const afterBad = (await getState(page)).buildings.length;
  expect(afterBad).toBe(before);

  await page.getByTestId('build-road').click();
  const roadPoint = await tileCenter(page, site!.tx - 1, site!.ty);
  await page.mouse.click(roadPoint.x, roadPoint.y);
  await page.waitForTimeout(300);
  expect(await findBuilding(page, 'road', site!.tx - 1, site!.ty)).toBe(true);

  await page.getByTestId('build-farm').click();
  const goodPoint = await tileCenter(page, site!.tx, site!.ty);
  await page.mouse.click(goodPoint.x, goodPoint.y);
  await page.waitForTimeout(300);
  expect(await findBuilding(page, 'farm', site!.tx, site!.ty)).toBe(true);
});

test('drag-paints a row of road tiles in build mode', async ({ page }) => {
  await openGame(page);
  await zoomOut(page);

  const start = await pickTile(page, (tiles, x, y) => {
    if (x + 3 >= tiles[0].length) return false;
    for (let i = 0; i < 4; i++) {
      if (tiles[y][x + i] === 'water') return false;
    }
    return true;
  });
  expect(start, 'expected an in-viewport earth strip').not.toBeNull();

  await page.getByTestId('build-road').click();
  const p0 = await tileCenter(page, start!.tx, start!.ty);
  await page.mouse.move(p0.x, p0.y);
  await page.mouse.down();

  const p1 = await tileCenter(page, start!.tx + 3, start!.ty);
  await page.mouse.move(p1.x, p1.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  const state = await getState(page);
  for (let i = 0; i < 4; i++) {
    expect(state.buildings.some((b) => b.type === 'road' && b.x === start!.tx + i && b.y === start!.ty)).toBe(true);
  }
});

test('a full supply chain grows the HUD population with no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await openGame(page);
  await zoomOut(page);

  // Ratings baseline: prosperity on an empty map (stable — no buildings yet).
  const prosperityStart = Number(await page.getByTestId('stat-prosperity').textContent());

  // Road + farm are placed through the real UI (click in build mode).
  await page.getByTestId('build-road').click();
  const roadPoint = await tileCenter(page, 3, 15);
  await page.mouse.click(roadPoint.x, roadPoint.y);
  await page.waitForTimeout(300);
  expect(await findBuilding(page, 'road', 3, 15)).toBe(true);

  await page.getByTestId('build-farm').click();
  const farmPoint = await tileCenter(page, 3, 16);
  await page.mouse.click(farmPoint.x, farmPoint.y);
  await page.waitForTimeout(300);
  expect(await findBuilding(page, 'farm', 3, 16)).toBe(true);

  // Complete the connected road network and the rest of the chain.
  const roads: [number, number][] = [
    [2, 15], [4, 15], [5, 15], [6, 15],
    [2, 16], [2, 17], [2, 18], [3, 18], [4, 18], [5, 18], [1, 18],
  ];
  for (const [x, y] of roads) {
    const r = await placeOn(page, 'road', x, y);
    expect(r.ok, `road@${x},${y} rejected`).toBe(true);
  }
  const buildings: { type: 'granary' | 'market' | 'house' | 'well'; x: number; y: number }[] = [
    { type: 'granary', x: 5, y: 16 },
    { type: 'market', x: 6, y: 18 },
    { type: 'house', x: 2, y: 19 },
    { type: 'house', x: 3, y: 19 },
    { type: 'house', x: 4, y: 19 },
    { type: 'house', x: 5, y: 19 },
    { type: 'well', x: 1, y: 19 },
  ];
  for (const { type, x, y } of buildings) {
    const r = await placeOn(page, type, x, y);
    expect(r.ok, `${type}@${x},${y} rejected`).toBe(true);
  }

  // Let the HUD reflect the placed buildings (it refreshes on a sim tick).
  await runTicks(page, 1);
  await page.waitForTimeout(200);

  const popBefore = Number(await page.getByTestId('stat-population').textContent());
  expect(popBefore).toBeGreaterThan(0);

  await runTicks(page, 2000);
  await page.waitForTimeout(300);

  const popAfter = Number(await page.getByTestId('stat-population').textContent());
  expect(popAfter).toBeGreaterThan(popBefore);

  // Population only grows through house evolution — prove it happened.
  const state = await getState(page);
  expect(state.buildings.some((b) => b.house && b.house.tier > 0)).toBe(true);

  // Ratings move with the economy: building a working city raises prosperity
  // above the empty-map baseline (the HUD reflects the sim's ratings).
  const prosperityAfter = Number(await page.getByTestId('stat-prosperity').textContent());
  expect(prosperityAfter).toBeGreaterThan(prosperityStart);
  expect(errors).toEqual([]);
});

test('policy sliders update the sim policy and HUD labels', async ({ page }) => {
  await openGame(page);

  const tax = page.getByTestId('policy-tax');
  await tax.evaluate((el: HTMLInputElement) => {
    el.value = '40';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const wage = page.getByTestId('policy-wage');
  await wage.evaluate((el: HTMLInputElement) => {
    el.value = '25';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await page.waitForTimeout(300);
  const policy = (await getState(page)).policy;
  expect(policy.taxRate).toBeCloseTo(0.4, 5);
  expect(policy.wageRate).toBeCloseTo(0.25, 5);
  await expect(page.getByTestId('policy-tax-value')).toHaveText('40%');
  await expect(page.getByTestId('policy-wage-value')).toHaveText('25%');
});
