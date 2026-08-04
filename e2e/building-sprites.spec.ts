import { expect, test } from '@playwright/test';
import { getState, placeOn, openGame, pickTile, getCamera } from './helpers';

test.describe('building sprites', () => {
  test('building sprites render correctly', async ({ page }) => {
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
    const hasGranary = state.buildings.some(b => b.type === 'granary');
    expect(hasGranary).toBe(true);

    // Capture screenshot for visual inspection
    await page.screenshot({ path: 'e2e/test-results/building-sprite-granary.png', fullPage: false });

    const cam = await getCamera(page);
    console.log(`Camera: zoom=${cam.zoom.toFixed(2)}`);
    expect(errors).toEqual([]);
  });
});
