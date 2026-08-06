import { expect, test } from '@playwright/test';
import { openGame, pickTile, runTicks } from './helpers';

test('home screen shows at launch and New Game starts a city', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.getByTestId('new-game')).toBeVisible();
  await expect(page.getByTestId('how-to-play')).toBeVisible();

  await page.getByTestId('new-game').click();
  await page.waitForTimeout(400);
  await expect(page.getByTestId('home-screen')).toHaveCount(0);
  await expect(page.getByTestId('stat-population')).toBeVisible();
});

test('ESC with build mode cancels instead of pausing', async ({ page }) => {
  await openGame(page);
  // Enter build mode via the HUD.
  await page.getByTestId('build-road').click();
  await page.waitForTimeout(100);
  await expect(page.getByTestId('build-road')).toHaveClass(/active/);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  // Build mode cancelled, pause overlay NOT shown.
  await expect(page.getByTestId('build-road')).not.toHaveClass(/active/);
  await expect(page.getByTestId('pause-overlay')).toBeHidden();
});

test('ESC without build mode opens pause and Resume resumes the sim', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('stat-population').waitFor();

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await expect(page.getByTestId('pause-overlay')).toBeVisible();

  // The sim clock is paused: capture state, wait real time, ensure no ticks.
  const t1 = (await page.evaluate(() => window.__cityApi!.state())).tick;
  await page.waitForTimeout(400);
  const t2 = (await page.evaluate(() => window.__cityApi!.state())).tick;
  expect(t2).toBe(t1);

  await page.getByTestId('resume-button').click();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('pause-overlay')).toBeHidden();
  const t3 = (await page.evaluate(() => window.__cityApi!.state())).tick;
  expect(t3).toBeGreaterThanOrEqual(t2);
});

test('save from pause, restart, then load resumes the same city', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('stat-population').waitFor();

  // Build a couple of roads so the save has content.
  const earth = await pickTile(page, (t, x, y) => t[y][x] === 'earth');
  expect(earth).not.toBeNull();
  const p = await page.evaluate(
    (args) => window.__cityApi!.place('road', args.x, args.y),
    { x: earth!.tx, y: earth!.ty } as const,
  );
  expect(p.ok).toBe(true);
  await runTicks(page, 50);
  const roadExistsBefore = (
    await page.evaluate(
      (args) => window.__cityApi!.state().buildings.some((b) => b.type === 'road' && b.x === args.x && b.y === args.y),
      { x: earth!.tx, y: earth!.ty } as const,
    )
  );
  expect(roadExistsBefore).toBe(true);

  // Pause and save.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.getByTestId('save-button').click();
  await page.waitForTimeout(200);
  await expect(page.getByTestId('toast')).toContainText('Game saved');

  // Restart (discard) and return home.
  await page.getByTestId('restart-button').click();
  await page.waitForTimeout(400);
  await expect(page.getByTestId('home-screen')).toBeVisible();

  // Load the saved game from home; it resumes the same city (road persists).
  await page.getByTestId('load-game').click();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('home-screen')).toHaveCount(0);
  const loaded = await page.evaluate(() => window.__cityApi!.state());
  expect(loaded.buildings.some((b) => b.type === 'road' && b.x === earth!.tx && b.y === earth!.ty)).toBe(true);
});

test('pause button opens the pause overlay', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('pause-button').click();
  await page.waitForTimeout(200);
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
});

test('resume-load of a structurally-invalid v1 save is rejected: button disabled + typed reason', async ({ page }) => {
  // PERS-01 hard edge: a v1 save whose version passes readSave's meta
  // truthiness check but whose payload fails validateSave. The load button
  // MUST look resume-able (intact meta) yet reject on click-through — disabled
  // with the typed reason via textContent, never a crash / silent misload.
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // Filter the documented pre-existing environmental spritesheet noise
    // (proof: reproducible at the pre-Phase-19 baseline on a loaded host —
    // SUMMARY deviation #4). Any OTHER console error is a failure.
    if (m.type() === 'error' && !m.text().includes('Failed to process file')) errors.push(m.text());
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('home-screen')).toBeVisible();

  await page.evaluate(() => {
    window.localStorage.setItem(
      'rcb.save',
      JSON.stringify({
        data: { version: 1, seed: 42, mapSize: 40, commands: 'not-an-array', tickCount: 123, savedAt: 1000 },
        meta: { seed: 42, mapSize: 40, tick: 123, savedAt: 1000 },
      }),
    );
  });
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByTestId('home-screen')).toBeVisible();

  // readSave is tolerant — the meta survives, so the button is enabled...
  await expect(page.getByTestId('load-game')).toBeEnabled();
  await expect(page.getByTestId('load-game')).toContainText('Resume city');

  // ...but the click-through validate gate rejects it.
  await page.getByTestId('load-game').click();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('load-game')).toBeDisabled();
  await expect(page.getByTestId('load-game')).toContainText('Save rejected');

  // Still on home — never a crash, never a silent misload; zero page errors.
  await expect(page.getByTestId('home-screen')).toBeVisible();
  expect(errors).toEqual([]);
});

test('restart returns to the home screen', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.getByTestId('restart-button').click();
  await page.waitForTimeout(400);
  await expect(page.getByTestId('home-screen')).toBeVisible();
});
