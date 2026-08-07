import { test, expect } from '@playwright/test';
import { openGame, placeOn, runTicks } from './helpers';
// Phase 20 Wave 0 RED scaffold (e2e): sidebar layout contract.
// FAILS TODAY: the game page has no .sidebar / .topbar — Wave 1+ lands them.

test('right sidebar renders build panel, tools, speed, advisor drawer, overlays', async ({ page }) => {
  await openGame(page);

  const sidebar = page.locator('[data-testid="sidebar"]');
  await expect(sidebar).toBeVisible();

  // Build panel: 13-category tabs + 17-building grid (seam: setBuildMode).
  await expect(page.locator('[data-testid="sidebar-build-panel"]')).toBeVisible();
  await expect(page.locator('[data-testid="sidebar-category-tabs"] [data-testid^="category-"]')).toHaveCount(13);
  await expect(page.locator('[data-testid="sidebar-build-grid"] [data-testid^="building-"]')).toHaveCount(17);

  // Tools panel: policy sliders + settings drawer.
  await expect(page.locator('[data-testid="sidebar-tools-panel"]')).toBeVisible();
  await expect(page.locator('[data-testid="sidebar-policy-tax"]')).toBeVisible();
  await expect(page.locator('[data-testid="sidebar-policy-wage"]')).toBeVisible();

  // Speed row: the 5 locked speeds.
  await expect(page.locator('[data-testid="sidebar-speed-row"] [data-testid^="speed-"]')).toHaveCount(5);

  // Advisor drawer + overlay group + pause/restart/save actions.
  await expect(page.locator('[data-testid="sidebar-advisor-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="sidebar-overlay-group"]')).toBeVisible();
  await expect(page.locator('[data-testid="sidebar-pause-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="sidebar-resume-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="sidebar-save-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="sidebar-restart-button"]')).toBeVisible();
});

test('top status bar renders population, date, treasury, ratings', async ({ page }) => {
  await openGame(page);

  const topbar = page.locator('[data-testid="topbar"]');
  await expect(topbar).toBeVisible();
  await expect(page.locator('[data-testid="topbar-population"]')).toBeVisible();
  await expect(page.locator('[data-testid="topbar-date"]')).toBeVisible();
  await expect(page.locator('[data-testid="topbar-treasury"]')).toBeVisible();
  await expect(page.locator('[data-testid="topbar-ratings"]')).toBeVisible();

  // Labels UPPERCASE verbatim from 18-UI-SPEC.
  await expect(page.locator('[data-testid="topbar-population"]')).toContainText('POPULATION');
  await expect(page.locator('[data-testid="topbar-treasury"]')).toContainText('TREASURY');

  // Date derives from SimState.tick: year=floor(tick/360), month=floor((tick%360)/40)+1.
  const state = await page.evaluate(() => window.__cityApi!.state());
  const expectedYear = Math.floor(state.tick / 360);
  const expectedMonth = Math.floor((state.tick % 360) / 40) + 1;
  await expect(page.locator('[data-testid="topbar-date"]')).toContainText(`YEAR ${expectedYear}`);
  await expect(page.locator('[data-testid="topbar-date"]')).toContainText(`MONTH ${expectedMonth}`);
});

// Wave 2 (20-02-01): the advisors drawer re-renders from the live composer on
// tick change — no stale values while the drawer stays open.
test('advisor drawer panel re-renders live data on tick change', async ({ page }) => {
  await openGame(page);

  // Build a working city (management-ui pattern) so wages drain treasury:
  // roads + farm + granary + market + well + houses → evolve → employment.
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
  await runTicks(page, 500); // evolve houses → employed workforce
  const wage = page.getByTestId('policy-wage');
  await wage.evaluate((el: HTMLInputElement) => {
    el.value = '100';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await runTicks(page, 120); // wage spend drains the treasury

  // Open the drawer via the keyboard contract (A) and select Finance.
  await page.keyboard.press('A');
  await expect(page.locator('[data-testid="advisor-drawer"]')).toBeVisible();
  await page.getByTestId('advisor-tab-finance').click();

  const balance = page.locator('[data-testid="advisor-panel-finance"] .row', { hasText: 'Balance' }).locator('b');
  await expect(balance).toBeVisible();
  const before = Number(await balance.textContent());

  // Advance the sim with the drawer open — the panel must reflect the new tick.
  await runTicks(page, 100);

  const after = Number(await balance.textContent());
  expect(after).not.toBe(before);

  // And the tab strip keeps the full 13-tab catalog while the drawer is open.
  await expect(page.locator('[data-testid^="advisor-tab-"]')).toHaveCount(13);
});
