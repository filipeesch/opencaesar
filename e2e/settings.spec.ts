import { expect, test } from '@playwright/test';

/**
 * Phase 19 (PERS-02): the Settings drawer lives in the HUD control bar
 * (controls-settings) following the Phase-18 drawer pattern. Editing + saving
 * options persists under rcb.options and applies immediately (body
 * data-attrs + audio mix); a quality change notes it applies on next launch
 * (RenderConfig is context-creation-only). Phase-18 convention: pageerror /
 * console errors are captured and asserted empty.
 */
test.describe('settings drawer', () => {
  test.beforeEach(async ({ page }) => {
    // Clean options so the defaults-fallback assertions are deterministic.
    await page.goto('/?test&seed=1337', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__cityApi);
    await page.evaluate(() => window.localStorage.removeItem('rcb.options'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__cityApi);
  });

  test('opens the drawer with the six controls pre-filled from defaults', async ({ page }) => {
    await page.getByTestId('controls-settings').click();
    await expect(page.getByTestId('settings-drawer')).toBeVisible();
    await expect(page.getByTestId('opt-graphics')).toHaveValue('medium');
    await expect(page.getByTestId('opt-music')).toHaveValue('0.6');
    await expect(page.getByTestId('opt-sfx')).toHaveValue('0.8');
    await expect(page.getByTestId('opt-speed')).toHaveValue('1');
    await expect(page.getByTestId('opt-text-size')).toHaveValue('normal');
    await expect(page.getByTestId('opt-reduced-motion')).not.toBeChecked();
  });

  test('toggles options and saves with an Options saved toast', async ({ page }) => {
    await page.getByTestId('controls-settings').click();
    await page.getByTestId('opt-text-size').selectOption('large');
    await page.getByTestId('opt-reduced-motion').check();
    await page.getByTestId('settings-save').click();
    await expect(page.getByTestId('toast')).toContainText('Options saved');
    // Applied immediately: the body data-attrs carry the shell state.
    const attrs = await page.evaluate(() => ({
      ts: document.body.dataset.textSize,
      rm: document.body.dataset.reducedMotion,
    }));
    expect(attrs.ts).toBe('large');
    expect(attrs.rm).toBe('true');
  });

  test('settings persist across a page reload', async ({ page }) => {
    await page.getByTestId('controls-settings').click();
    await page.getByTestId('opt-text-size').selectOption('large');
    await page.getByTestId('opt-reduced-motion').check();
    await page.getByTestId('settings-save').click();
    await expect(page.getByTestId('toast')).toContainText('Options saved');

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__cityApi);
    await page.getByTestId('controls-settings').click();
    await expect(page.getByTestId('opt-text-size')).toHaveValue('large');
    await expect(page.getByTestId('opt-reduced-motion')).toBeChecked();
    const attrs = await page.evaluate(() => ({
      ts: document.body.dataset.textSize,
      rm: document.body.dataset.reducedMotion,
    }));
    expect(attrs.ts).toBe('large');
    expect(attrs.rm).toBe('true');
  });

  test('no page errors or console errors across the flow', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.getByTestId('controls-settings').click();
    await page.getByTestId('opt-text-size').selectOption('large');
    await page.getByTestId('opt-reduced-motion').check();
    await page.getByTestId('settings-save').click();
    await page.waitForTimeout(200);
    expect(errors).toEqual([]);
  });
});
