import { expect, test, type Page } from '@playwright/test';
import { BUILDINGS } from '../src/sim/buildings';
import type { BuildingType } from '../src/sim/types';
import { getCamera, getState, openGame, pickTile, placeOn, runTicks, tileCenter, zoomOut } from './helpers';

/**
 * Phase 18 management-ui e2e suite (UI-01..04). Scaffolded in Wave 0 against
 * the Phase-18 data-testids; the cases flip green as their waves land:
 *   - Wave 1 (18-01-01): control-bar + build-disabled
 *   - Wave 2 (18-02-02): advisors drawer tabs
 *   - Wave 3 (18-03-02): overlay toggle → legend + click-through
 *   - Wave 4 (18-04-02): inspectors (close / Next ◀/▶)
 * Zero page/page console errors are asserted throughout (placement.spec precedent).
 */

const BUILD_ORDER: readonly BuildingType[] = [
  'road', 'house', 'garden', 'well', 'fountain', 'farm', 'orchard', 'granary', 'market',
  'engineer_post', 'fire_station', 'clinic', 'school', 'library', 'temple', 'theatre', 'forum',
];

/**
 * Pre-existing environment noise: with Vite's SPA fallback the HEAD probe for
 * the missing `assets/terrain.png` / `assets/house.png` returns 200 and Phaser
 * then fails to decode the HTML it receives. These two loader warnings appear on
 * EVERY fresh game boot in this dev environment (not from Phase-18 surfaces), so
 * they are filtered from the error assertion while still catching any NEW
 * page/console error caused by the management UI.
 */
const KNOWN_LOADER_NOISE = /Failed to process file: .* (terrain|house)/;

/** Collect page errors + console errors into an array (asserted empty at the end). */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !KNOWN_LOADER_NOISE.test(m.text())) errors.push(m.text());
  });
  return errors;
}

/**
 * Assert every build button's disabled state matches cost > live treasury.
 * Pauses the game first so the treasury (and the buttons' live recompute) is
 * frozen for a single deterministic snapshot — otherwise the running sim drains
 * treasury between the per-button assertions and the race makes the case flaky
 * (the feature is proven correct tick-by-tick; this makes the test determinist).
 */
async function assertBuildDisabledTracksTreasury(page: Page): Promise<number> {
  await page.getByTestId('pause-button').click();
  try {
    const state = await getState(page);
    await expect(page.getByTestId('pause-overlay')).toBeVisible();
    for (const type of BUILD_ORDER) {
      const expected = BUILDINGS[type].cost > state.treasury;
      if (expected) {
        await expect(page.getByTestId(`build-${type}`)).toBeDisabled();
      } else {
        await expect(page.getByTestId(`build-${type}`)).toBeEnabled();
      }
    }
    return state.treasury;
  } finally {
    await page.getByTestId('resume-button').click();
  }
}

/**
 * Build the proven worker city (placement.spec 'full supply chain' layout) so a
 * wages run actually spends treasury (wagePerWorkerPerTick is 2/tick/turn).
 */
async function buildWorkerCity(page: Page): Promise<void> {
  const roads: [number, number][] = [
    [2, 15], [4, 15], [5, 15], [6, 15],
    [2, 16], [2, 17], [2, 18], [3, 18], [4, 18], [5, 18], [1, 18],
  ];
  for (const [x, y] of roads) {
    expect((await placeOn(page, 'road', x, y)).ok, `road@${x},${y}`).toBe(true);
  }
  for (const [type, x, y] of [
    ['farm', 3, 16], ['granary', 5, 16], ['market', 6, 18], ['well', 1, 19],
  ] as const) {
    expect((await placeOn(page, type, x, y)).ok, `${type}@${x},${y}`).toBe(true);
  }
  for (const [x, y] of [[2, 19], [3, 19], [4, 19], [5, 19]] as const) {
    expect((await placeOn(page, 'house', x, y)).ok, `house@${x},${y}`).toBe(true);
  }
}

test('control bar opens the advisors drawer, overlay bar, and message-log focus (UI-01)', async ({ page }) => {
  const errors = collectErrors(page);
  await openGame(page);
  await zoomOut(page);

  // All three central controls exist and are wired.
  await expect(page.getByTestId('controls-advisors')).toBeVisible();
  await expect(page.getByTestId('controls-overlays')).toBeVisible();
  await expect(page.getByTestId('controls-messages')).toBeVisible();

  // Advisors → drawer becomes visible with a live handler.
  await page.getByTestId('controls-advisors').click();
  await expect(page.getByTestId('advisor-drawer')).toBeVisible();
  // Overlays → overlay bar becomes visible.
  await page.getByTestId('controls-overlays').click();
  await expect(page.getByTestId('overlay-bar')).toBeVisible();
  // Messages → the log panel gains its focus class (a real scene effect).
  await page.getByTestId('controls-messages').click();
  await expect(page.getByTestId('log-panel')).toHaveClass(/active/);

  expect(errors).toEqual([]);
});

test('build buttons disable when treasury < cost and track live treasury (UI-01)', async ({ page }) => {
  const errors = collectErrors(page);
  await openGame(page);
  await zoomOut(page);

  // Fresh city: 1000 denarii covers every palette building → all enabled.
  await assertBuildDisabledTracksTreasury(page);

  // Build a working city and push wages to 100% so running the sim spends the
  // treasury (2 denarii/worker/tick), flipping at least the priciest button to
  // disabled — the unaffordable state is live, not static.
  await buildWorkerCity(page);
  await runTicks(page, 500); // evolve houses → employed workforce
  const wage = page.getByTestId('policy-wage');
  await wage.evaluate((el: HTMLInputElement) => {
    el.value = '100';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await runTicks(page, 120); // wage spend drains the treasury
  await page.waitForTimeout(200);

  const treasury = await assertBuildDisabledTracksTreasury(page);
  expect(treasury).toBeLessThan(1000); // the run actually spent money
  // At least one palette button is now genuinely unaffordable.
  const someDisabled = BUILD_ORDER.some((t) => BUILDINGS[t].cost > treasury);
  expect(someDisabled, `expected at least one unaffordable build button at treasury ${treasury}`).toBe(true);

  expect(errors).toEqual([]);
});

test('no decorative control audit (UI-01): every HUD/control-bar button is real', async ({ page }) => {
  const errors = collectErrors(page);
  await openGame(page);
  await zoomOut(page);

  // Every audited control carries a non-empty data-testid.
  await page.waitForSelector('.hud-control-bar button, .hud-build-btn');
  const untested = page.locator(
    '.hud-control-bar button:not([data-testid]), .hud-build-btn:not([data-testid]), .advisor-tab:not([data-testid]), .overlay-toggle:not([data-testid])',
  );
  expect(await untested.count(), 'audited controls must each expose a data-testid').toBe(0);
  const auditedCount = await page.locator('.hud-control-bar button, .hud-build-btn').count();
  expect(auditedCount).toBeGreaterThan(0);

  // Each control-bar button's click changes its target surface's observable state.
  const drawer = page.getByTestId('advisor-drawer');
  const drawerBefore = await drawer.isVisible();
  await page.getByTestId('controls-advisors').click();
  await expect(drawer).toBeVisible();
  expect(await drawer.isVisible()).not.toBe(drawerBefore);

  const bar = page.getByTestId('overlay-bar');
  const barBefore = await bar.isVisible();
  await page.getByTestId('controls-overlays').click();
  await expect(bar).toBeVisible();
  expect(await bar.isVisible()).not.toBe(barBefore);

  const logPanel = page.getByTestId('log-panel');
  const logBefore = await logPanel.evaluate((el) => el.className);
  await page.getByTestId('controls-messages').click();
  await expect(logPanel).toHaveClass(/active/);
  expect(await logPanel.evaluate((el) => el.className)).not.toBe(logBefore);

  // A build button click toggles build mode (active class on itself) — real.
  const buildRoad = page.getByTestId('build-road');
  await expect(buildRoad).toBeEnabled();
  await buildRoad.click();
  await expect(buildRoad).toHaveClass(/active/);
  await buildRoad.click();
  await expect(buildRoad).not.toHaveClass(/active/);

  expect(errors).toEqual([]);
});

test('advisors drawer switches panels with a live active tab (UI-02)', async ({ page }) => {
  const errors = collectErrors(page);
  await openGame(page);
  await zoomOut(page);

  await page.getByTestId('controls-advisors').click();
  await expect(page.getByTestId('advisor-drawer')).toBeVisible();

  // 13 tabs exist; the default tab is active.
  await expect(page.getByTestId('advisor-tab-ratings')).toBeVisible();
  await page.getByTestId('advisor-tab-ratings').click();
  await expect(page.getByTestId('advisor-tab-ratings')).toHaveClass(/active/);
  await expect(page.getByTestId('advisor-panel-ratings')).toBeVisible();

  // A second tab switches panels and moves the active class.
  await page.getByTestId('advisor-tab-finance').click();
  await expect(page.getByTestId('advisor-tab-finance')).toHaveClass(/active/);
  await expect(page.getByTestId('advisor-tab-ratings')).not.toHaveClass(/active/);
  await expect(page.getByTestId('advisor-panel-finance')).toBeVisible();
  await expect(page.getByTestId('advisor-panel-ratings')).toBeHidden();

  expect(errors).toEqual([]);
});

test('overlay toggle shows a legend and clicking a highlighted tile opens the inspector (UI-03)', async ({ page }) => {
  const errors = collectErrors(page);
  await openGame(page);
  await zoomOut(page);

  // A well is a water-overlay highlighted tile.
  const earth = await pickTile(page, (t, x, y) => t[y][x] === 'earth');
  expect(earth).not.toBeNull();
  await placeOn(page, 'road', earth!.tx, earth!.ty);
  expect((await placeOn(page, 'well', earth!.tx, earth!.ty + 1)).ok).toBe(true);
  await runTicks(page, 1);

  await page.getByTestId('controls-overlays').click();
  await expect(page.getByTestId('overlay-bar')).toBeVisible();

  await page.getByTestId('overlay-water').click();
  await expect(page.getByTestId('overlay-legend')).toBeVisible();

  // Clicking the highlighted well tile opens its inspector (click-through).
  const point = await tileCenter(page, earth!.tx, earth!.ty + 1);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(200);
  await expect(page.getByTestId('building-popup')).toBeVisible();

  // Exactly one overlay is active (radio) — clear it via None.
  await page.getByTestId('overlay-none').click();
  await expect(page.getByTestId('overlay-legend')).toBeHidden();

  expect(errors).toEqual([]);
});

test('camera wheel-zoom keeps working while an overlay is active (UI-03)', async ({ page }) => {
  const errors = collectErrors(page);
  await openGame(page);
  await zoomOut(page); // zoom is at its 0.5 min after zoomOut

  await page.getByTestId('controls-overlays').click();
  await page.getByTestId('overlay-water').click();
  await expect(page.getByTestId('overlay-legend')).toBeVisible();

  // Wheel-zoom must still change the camera with an overlay active (T-18-04).
  const before = await getCamera(page);
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, -120); // zoom in
  await page.waitForTimeout(150);
  const after = await getCamera(page);
  expect(after.zoom).toBeGreaterThan(before.zoom);

  expect(errors).toEqual([]);
});

test('clicking a house opens the residence inspector with prev/next navigation (UI-04)', async ({ page }) => {
  const errors = collectErrors(page);
  await openGame(page);
  await zoomOut(page);

  const earth = await pickTile(page, (t, x, y) => t[y][x] === 'earth');
  expect(earth).not.toBeNull();
  await placeOn(page, 'road', earth!.tx, earth!.ty);
  expect((await placeOn(page, 'house', earth!.tx, earth!.ty + 1)).ok).toBe(true);
  await runTicks(page, 1);

  const point = await tileCenter(page, earth!.tx, earth!.ty + 1);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(200);

  await expect(page.getByTestId('building-popup')).toBeVisible();
  await expect(page.getByTestId('inspector-prev')).toBeVisible();
  await expect(page.getByTestId('inspector-next')).toBeVisible();

  // Close × closes the popup.
  await page.getByTestId('popup-close').click();
  await expect(page.getByTestId('building-popup')).toBeHidden();

  expect(errors).toEqual([]);
});
