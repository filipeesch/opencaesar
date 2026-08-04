import { expect, test } from '@playwright/test';
import { getState, placeOn, openGame, pickTile, getCamera } from './helpers';

test.describe('building sprites debug', () => {
  test('debug sprite position with origin(0.5, 1.0)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await openGame(page);

    // Find a fertile tile
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

    // Get camera position and zoom
    const cam = await getCamera(page);
    console.log(`Camera: zoom=${cam.zoom.toFixed(2)}, scrollX=${cam.scrollX.toFixed(2)}, scrollY=${cam.scrollY.toFixed(2)}`);

    // Get granary position from state
    const granary = state.buildings.find(b => b.type === 'granary');
    if (granary) {
      console.log(`Granary: x=${granary.x}, y=${granary.y}, footprint=${granary.footprint}`);
      // Calculate world position
      const TILE_W = 60;
      const TILE_H = 30;
      const wx = (granary.x - granary.y) * (TILE_W / 2) + TILE_W / 2;
      const wy = (granary.x + granary.y) * (TILE_H / 2);
      const screenX = (wx - cam.scrollX) * cam.zoom;
      const screenY = (wy - cam.scrollY) * cam.zoom;
      console.log(`World: wx=${wx.toFixed(2)}, wy=${wy.toFixed(2)}`);
      console.log(`Screen: sx=${screenX.toFixed(2)}, sy=${screenY.toFixed(2)}`);
      console.log(`Screen bottom: sy + footprint*TILE_H*zoom = ${(screenY + granary.footprint * TILE_H * cam.zoom).toFixed(2)}`);
    }

    // Capture screenshot at zoom 1.0
    await page.screenshot({ path: 'e2e/test-results/sprite-debug-zoom1.png' });
    await page.screenshot({ path: 'e2e/test-results/sprite-debug-all.png' });

    expect(errors).toEqual([]);
  });
});
