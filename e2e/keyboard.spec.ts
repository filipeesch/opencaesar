import { test, expect } from '@playwright/test';
import { openGame, pickTile, placeOn, runTicks, tileCenter, zoomOut } from './helpers';
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

test('Escape closes the settings drawer and overlay bar instead of pausing (WR-05)', async ({ page }) => {
  await openGame(page);

  // Settings drawer open: Escape closes it — the pause overlay never appears.
  await page.getByTestId('controls-settings').click();
  await expect(page.getByTestId('settings-drawer')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('settings-drawer')).toBeHidden();
  await expect(page.getByTestId('pause-overlay')).toBeHidden();

  // Overlay bar open: Escape closes it; only then does Escape pause.
  await page.getByTestId('controls-overlays').click();
  await expect(page.getByTestId('overlay-bar')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('overlay-bar')).toBeHidden();
  await expect(page.getByTestId('pause-overlay')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
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

test('arrow keys on a focused slider never flip the inspector card (WR-01)', async ({ page }) => {
  await openGame(page);
  await zoomOut(page);

  // Two houses so the same-kind cycling list has 2 entries — without the
  // focus guard, ArrowRight on the focused policy slider would step the card.
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
  const card = page.getByTestId('building-popup');
  await expect(card).toBeVisible();
  const navLabel = page.getByTestId('inspector-nav-label');
  await expect(navLabel).toHaveText(/1\/2/);

  // Focus the tax slider (a range input the browser owns) and arrow it: the
  // router must not leak ←/→ to the inspector card.
  await page.getByTestId('policy-tax').click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  await expect(navLabel).toHaveText(/1\/2/);
  await expect(card).toContainText('House');
});
