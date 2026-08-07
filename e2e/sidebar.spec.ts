import { test, expect } from '@playwright/test';
import { openGame } from './helpers';
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
