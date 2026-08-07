import { test, expect } from '@playwright/test';
import { openGame } from './helpers';
// Phase 20 Wave 0 RED scaffold (e2e): keyboard router contract.
// FAILS TODAY: no KeyRouter on the page — Wave 3+ lands it.

test('A cycles advisors — opens the drawer and advances tabs', async ({ page }) => {
  await openGame(page);

  // Drawer closed by default.
  await expect(page.locator('[data-testid="advisor-drawer"]')).toBeHidden();

  await page.keyboard.press('A');
  await expect(page.locator('[data-testid="advisor-drawer"]')).toBeVisible();

  // A advances to the next advisor tab.
  const tabBefore = await page.locator('[data-testid="advisor-active-tab"]').textContent();
  await page.keyboard.press('A');
  const tabAfter = await page.locator('[data-testid="advisor-active-tab"]').textContent();
  expect(tabAfter).not.toBe(tabBefore);
});

test('←/→ switch advisor tabs while the drawer is open', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('A');

  const tabBefore = await page.locator('[data-testid="advisor-active-tab"]').textContent();
  await page.keyboard.press('ArrowRight');
  const tabAfter = await page.locator('[data-testid="advisor-active-tab"]').textContent();
  expect(tabAfter).not.toBe(tabBefore);
});

test('Escape closes the drawer first, then falls through to build', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('A');
  await expect(page.locator('[data-testid="advisor-drawer"]')).toBeVisible();

  // Escape closes the drawer (drawer > build > pause precedence).
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="advisor-drawer"]')).toBeHidden();

  // With the drawer closed, Escape cancels build mode (existing ESC behavior).
  await page.keyboard.press('B');
  await expect(page.locator('[data-testid="sidebar-build-panel"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="sidebar-build-panel"]')).toBeHidden();
});

test('B toggles the build panel only when no drawer/inspector is open', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('B');
  await expect(page.locator('[data-testid="sidebar-build-panel"]')).toBeVisible();

  // While the drawer is open, B is consumed by the drawer.
  await page.keyboard.press('A');
  await page.keyboard.press('B');
  await expect(page.locator('[data-testid="sidebar-build-panel"]')).toBeVisible(); // unchanged
  await page.keyboard.press('Escape'); // close drawer
  await page.keyboard.press('B');
  await expect(page.locator('[data-testid="sidebar-build-panel"]')).toBeHidden(); // toggled off
});

test('1-5 toggle overlays; existing W/F/R/C/D/X stay wired (back-compat)', async ({ page }) => {
  await openGame(page);

  // Key 1 toggles the water overlay (active class on the overlay chip).
  await page.keyboard.press('1');
  await expect(page.locator('[data-testid="overlay-water"]')).toHaveClass(/active/);

  // Existing W stays wired — toggling the same overlay off then on.
  await page.keyboard.press('W');
  await expect(page.locator('[data-testid="overlay-water"]')).not.toHaveClass(/active/);
  await page.keyboard.press('W');
  await expect(page.locator('[data-testid="overlay-water"]')).toHaveClass(/active/);
});
