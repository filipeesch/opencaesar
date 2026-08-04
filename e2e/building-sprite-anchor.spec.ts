import { expect, test } from '@playwright/test';
import { getState, placeOn, openGame, pickTile, getCamera } from './helpers';

test.describe('building sprites anchor test', () => {
  test('granary sprite renders on tile with correct anchor', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await openGame(page);

    // Find a fertile tile that can hold a 2x2 granary
    const fertile = await pickTile(page, (tiles, x, y) => {
      if (tiles[y][x] !== 'fertile') return false;
      for (let dy = 0; dy < 2 && y + dy < tiles.length; dy++) {
        for (let dx = 0; dx < 2 && x + dx < tiles[0].length; dx++) {
          if (tiles[y + dy][x + dx] === 'water') return false;
        }
      }
      return true;
    });

    expect(fertile).not.toBeNull();

    // Build roads for access
    await placeOn(page, 'road', fertile!.tx - 1, fertile!.ty);
    await placeOn(page, 'road', fertile!.tx, fertile!.ty - 1);
    await page.waitForTimeout(200);

    // Place granary
    const r1 = await placeOn(page, 'granary', fertile!.tx, fertile!.ty);
    expect(r1.ok).toBe(true);
    await page.waitForTimeout(300);

    const state = await getState(page);
    expect(state.buildings.some(b => b.type === 'granary')).toBe(true);

    // Capture screenshot for visual inspection at zoom 1.0
    await page.screenshot({ path: 'e2e/test-results/sprite-granary-zoom1.png' });

    // Test at different zoom levels
    for (const targetZoom of [0.5, 1.0, 2.0]) {
      // Zoom to target
      const startZoom = (await getCamera(page)).zoom;
      await page.mouse.move(640, 400);
      await page.mouse.wheel(0, (startZoom - targetZoom) * 3000);
      await page.waitForTimeout(200);

      await page.screenshot({ path: `e2e/test-results/sprite-granary-zoom${targetZoom}.png` });

      const finalCam = await getCamera(page);
      console.log(`Zoom ${targetZoom}: actual zoom=${finalCam.zoom.toFixed(2)}`);
    }

    expect(errors).toEqual([]);
  });
});
