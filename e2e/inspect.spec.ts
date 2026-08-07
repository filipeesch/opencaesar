import { expect, test } from '@playwright/test';
import { getState, openGame, pickTile, placeOn, runTicks, tileCenter, zoomOut } from './helpers';

// Phase 20 Wave 4 (20-04-01): the building/walker inspector is a CARD inside
// the sidebar inspector host (UI-RED-05) — the Phase-18 fixed bottom-center
// popup host is gone. Every assertion below targets the sidebar-hosted card;
// the legacy `building-popup` testid is preserved on the card root.
function inspectorCard(page: import('@playwright/test').Page) {
  return page.getByTestId('sidebar-inspector-host').getByTestId('building-popup');
}

test('clicking a house opens an inspector card in the sidebar with tier and desirability', async ({ page }) => {
  await openGame(page);
  await zoomOut(page);

  const earth = await pickTile(page, (t, x, y) => t[y][x] === 'earth');
  expect(earth).not.toBeNull();
  await placeOn(page, 'road', earth!.tx, earth!.ty);
  expect((await placeOn(page, 'house', earth!.tx, earth!.ty + 1)).ok).toBe(true);

  const point = await tileCenter(page, earth!.tx, earth!.ty + 1);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(200);

  // The card lives INSIDE the sidebar inspector host (not a fixed popup).
  const sidebar = page.getByTestId('sidebar');
  await expect(sidebar).toBeVisible();
  const card = inspectorCard(page);
  await expect(card).toBeVisible();
  await expect(card).toContainText('House');
  await expect(card).toContainText('Desirability');
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

  const card = inspectorCard(page);
  await expect(card).toBeVisible();
  await expect(card).toContainText('Farm');
  await expect(card).toContainText('Wheat');
});

test('clicking empty terrain closes the inspector card', async ({ page }) => {
  await openGame(page);
  await zoomOut(page);

  const earth = await pickTile(page, (t, x, y) => t[y][x] === 'earth');
  expect(earth).not.toBeNull();
  await placeOn(page, 'road', earth!.tx, earth!.ty);
  await placeOn(page, 'house', earth!.tx, earth!.ty + 1);

  const point = await tileCenter(page, earth!.tx, earth!.ty + 1);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(200);
  await expect(inspectorCard(page)).toBeVisible();

  // Click a different earth tile that has no building.
  const empty = await pickTile(page, (t, x, y) => t[y][x] === 'earth' && !(x === earth!.tx && (y === earth!.ty || y === earth!.ty + 1)));
  expect(empty).not.toBeNull();
  const emptyPoint = await tileCenter(page, empty!.tx, empty!.ty);
  await page.mouse.click(emptyPoint.x, emptyPoint.y);
  await page.waitForTimeout(200);

  await expect(inspectorCard(page)).toBeHidden();
});

test('ESC closes an open inspector card', async ({ page }) => {
  await openGame(page);
  await zoomOut(page);

  const earth = await pickTile(page, (t, x, y) => t[y][x] === 'earth');
  expect(earth).not.toBeNull();
  await placeOn(page, 'road', earth!.tx, earth!.ty);
  await placeOn(page, 'house', earth!.tx, earth!.ty + 1);

  const point = await tileCenter(page, earth!.tx, earth!.ty + 1);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(200);
  await expect(inspectorCard(page)).toBeVisible();

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await expect(inspectorCard(page)).toBeHidden();
});

test('residence inspector card shows enriched live fields (UI-04)', async ({ page }) => {
  await openGame(page);
  await zoomOut(page);

  const earth = await pickTile(page, (t, x, y) => t[y][x] === 'earth');
  expect(earth).not.toBeNull();
  await placeOn(page, 'road', earth!.tx, earth!.ty);
  await placeOn(page, 'house', earth!.tx, earth!.ty + 1);
  await runTicks(page, 200); // let the house evolve (level > 0 + live internals)

  const point = await tileCenter(page, earth!.tx, earth!.ty + 1);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(200);

  const card = inspectorCard(page);
  await expect(card).toBeVisible();
  // Enriched fields (level + tier + safety) are rendered from live internals.
  await expect(card).toContainText('House');
  await expect(card).toContainText('Level');
  await expect(card).toContainText('Tier');
  await expect(card).toContainText('Desirability');
});

test('inspector Next/Prev cycles same-kind houses in stable id order (UI-04)', async ({ page }) => {
  await openGame(page);
  await zoomOut(page);

  // Two separated house sites.
  const s1 = await pickTile(page, (t, x, y) => t[y][x] === 'earth');
  expect(s1).not.toBeNull();
  await placeOn(page, 'road', s1!.tx, s1!.ty);
  expect((await placeOn(page, 'house', s1!.tx, s1!.ty + 1)).ok).toBe(true);

  const s2 = await pickTile(
    page,
    (t, x, y) => t[y][x] === 'earth' && !(x === s1!.tx && (y === s1!.ty || y === s1!.ty + 1)),
  );
  expect(s2, 'expected a second disjoint earth tile').not.toBeNull();
  await placeOn(page, 'road', s2!.tx, s2!.ty);
  expect((await placeOn(page, 'house', s2!.tx, s2!.ty + 1)).ok).toBe(true);
  await runTicks(page, 2);

  // Click the first house; inspect from a stable position.
  const p1 = await tileCenter(page, s1!.tx, s1!.ty + 1);
  await page.mouse.click(p1.x, p1.y);
  await page.waitForTimeout(200);
  const card = inspectorCard(page);
  await expect(card).toBeVisible();

  const navLabel = page.getByTestId('inspector-nav-label');
  await expect(navLabel).toHaveText(/1\/2/);
  const next = page.getByTestId('inspector-next');
  await expect(next).toBeEnabled();
  await next.click();
  await page.waitForTimeout(120);
  await expect(navLabel).toHaveText(/2\/2/);

  const prev = page.getByTestId('inspector-prev');
  await expect(prev).toBeEnabled();
  await prev.click();
  await page.waitForTimeout(120);
  await expect(navLabel).toHaveText(/1\/2/);

  // Close × closes the card.
  await page.getByTestId('popup-close').click();
  await expect(card).toBeHidden();
});

test('←/→ and Escape drive the sidebar inspector card (key-router precedence)', async ({ page }) => {
  await openGame(page);
  await zoomOut(page);

  // Two houses so the same-kind list has 2 entries.
  const s1 = await pickTile(page, (t, x, y) => t[y][x] === 'earth');
  expect(s1).not.toBeNull();
  await placeOn(page, 'road', s1!.tx, s1!.ty);
  expect((await placeOn(page, 'house', s1!.tx, s1!.ty + 1)).ok).toBe(true);
  const s2 = await pickTile(
    page,
    (t, x, y) => t[y][x] === 'earth' && !(x === s1!.tx && (y === s1!.ty || y === s1!.ty + 1)),
  );
  expect(s2).not.toBeNull();
  await placeOn(page, 'road', s2!.tx, s2!.ty);
  expect((await placeOn(page, 'house', s2!.tx, s2!.ty + 1)).ok).toBe(true);
  await runTicks(page, 2);

  const p1 = await tileCenter(page, s1!.tx, s1!.ty + 1);
  await page.mouse.click(p1.x, p1.y);
  await page.waitForTimeout(200);
  const card = inspectorCard(page);
  await expect(card).toBeVisible();

  // → steps to the next house, ← steps back (inspector precedence: the
  // arrows must never leak to the drawer/build/pause).
  const navLabel = page.getByTestId('inspector-nav-label');
  await expect(navLabel).toHaveText(/1\/2/);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(120);
  await expect(navLabel).toHaveText(/2\/2/);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(120);
  await expect(navLabel).toHaveText(/1\/2/);

  // Escape closes the card first (before build/pause fall-through).
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  await expect(card).toBeHidden();
});

test('clicking a walker tile opens the walker inspector card (UI-04)', async ({ page }) => {
  await openGame(page);
  await zoomOut(page);

  // Build the proven worker city (placement.spec layout) on seed 1337 so
  // well/market/labor walkers spawn.
  const roads: [number, number][] = [
    [2, 15], [4, 15], [5, 15], [6, 15],
    [2, 16], [2, 17], [2, 18], [3, 18], [4, 18], [5, 18], [1, 18],
  ];
  for (const [x, y] of roads) expect((await placeOn(page, 'road', x, y)).ok, `road@${x},${y}`).toBe(true);
  for (const [type, x, y] of [
    ['farm', 3, 16], ['granary', 5, 16], ['market', 6, 18], ['well', 1, 19],
  ] as const) {
    expect((await placeOn(page, type, x, y)).ok, `${type}@${x},${y}`).toBe(true);
  }
  for (const [x, y] of [[2, 19], [3, 19], [4, 19], [5, 19]] as const) {
    expect((await placeOn(page, 'house', x, y)).ok, `house@${x},${y}`).toBe(true);
  }
  await runTicks(page, 400); // let walkers spawn and circulate

  // Click a tile currently holding a walker, retrying within a short window
  // while the sim runs (walkers move on the tick cadence).
  let opened = false;
  let tries = 0;
  while (!opened && tries < 40) {
    const state = await getState(page);
    const walker = state.walkers[0];
    if (walker) {
      const point = await tileCenter(page, walker.x, walker.y);
      await page.mouse.click(point.x, point.y);
      await page.waitForTimeout(80);
      const card = inspectorCard(page);
      const visible = await card.isVisible().catch(() => false);
      if (visible) {
        opened = true;
        await expect(card).toContainText(/Walker/);
        break;
      }
    }
    tries += 1;
  }
  expect(opened, 'expected the walker inspector to open on a walker tile click').toBe(true);
});
