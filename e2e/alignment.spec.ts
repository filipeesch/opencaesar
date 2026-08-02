import { expect, test } from '@playwright/test';
import { getCamera, getState, openGame, pickTile } from './helpers';
import { TILE_H, TILE_W } from '../src/game/palette';

/**
 * Sample one canvas pixel. WebGL readPixels works because the game is built
 * with preserveDrawingBuffer; the framebuffer y axis is flipped.
 */
function canvasPixel(page: import('@playwright/test').Page, x: number, y: number): Promise<number[] | null> {
  return page.evaluate(([px, py]) => {
    const c = document.querySelector('canvas');
    if (!c) return null;
    const gl = c.getContext('webgl') || c.getContext('webgl2');
    if (gl) {
      const buf = new Uint8Array(4);
      gl.readPixels(px, c.height - py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return [buf[0], buf[1], buf[2]];
    }
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const d = ctx.getImageData(px, py, 1, 1).data;
    return [d[0], d[1], d[2]];
  }, [x, y]);
}

/** Screen point of a tile's rendered diamond center (Phaser's render convention). */
async function renderedCenter(page: import('@playwright/test').Page, tx: number, ty: number): Promise<{ x: number; y: number }> {
  const cam = await getCamera(page);
  const wx = (tx - ty) * (TILE_W / 2) + TILE_W / 2;
  const wy = (tx + ty) * (TILE_H / 2) + TILE_H / 2;
  return { x: Math.round((wx - cam.scrollX) * cam.zoom), y: Math.round((wy - cam.scrollY) * cam.zoom) };
}

/** True for the ghost preview fill (green=valid, red=invalid) over any terrain. */
function isGhostFill(rgb: number[] | null): boolean {
  if (!rgb) return false;
  const [r, g, b] = rgb;
  return (g > 140 && g > r + 25 && g > b + 25) || (r > 140 && r > g + 25 && r > b + 25);
}

function near(a: number[] | null, b: number[], tol = 30): boolean {
  if (!a) return false;
  return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;
}

const TERRAIN_RGB: Record<string, number[]> = {
  earth: [138, 116, 76],
  water: [77, 110, 165],
  fertile: [111, 144, 66],
  trees: [76, 122, 46],
  rock: [141, 141, 136],
  road: [194, 176, 136],
};

test('build mode preview diamond aligns with the rendered tilemap tile', async ({ page }) => {
  await openGame(page);

  // The tilemap renders the tile diamond centered at tileTop + (30, 15); verify
  // against the terrain color at the center of a known in-view tile first.
  // Trees are excluded because the canopy is so dark that the 0.35-alpha ghost
  // fill blends to a muddy brown that is indistinguishable from bare terrain.
  const target = await pickTile(page, (tiles, x, y) => !['water', 'road', 'trees'].includes(tiles[y][x]));
  expect(target, 'expected an in-view tile').not.toBeNull();
  const state = await getState(page);
  const center = await renderedCenter(page, target!.tx, target!.ty);
  const px = await canvasPixel(page, center.x, center.y);
  expect(near(px, TERRAIN_RGB[state.tiles[target!.ty][target!.tx]]), 'tilemap diamond center should show its own terrain').toBe(true);

  // Enter build mode and hover the picked tile: the ghost diamond must cover
  // exactly that tile's diamond and nothing else (green=valid, red=invalid,
  // either way the fill belongs to the hovered tile).
  await page.getByTestId('build-house').click();
  await page.mouse.move(center.x, center.y);
  await page.waitForTimeout(200);

  expect(isGhostFill(await canvasPixel(page, center.x, center.y)), 'ghost covers the hovered tile center').toBe(true);

  const above = await renderedCenter(page, target!.tx, target!.ty - 1);
  const below = await renderedCenter(page, target!.tx, target!.ty + 1);
  const left = await renderedCenter(page, target!.tx - 1, target!.ty);
  const right = await renderedCenter(page, target!.tx + 1, target!.ty);
  for (const [label, p, tx, ty] of [
    ['above', above, target!.tx, target!.ty - 1],
    ['below', below, target!.tx, target!.ty + 1],
    ['left', left, target!.tx - 1, target!.ty],
    ['right', right, target!.tx + 1, target!.ty],
  ] as const) {
    const pxN = await canvasPixel(page, p.x, p.y);
    expect(isGhostFill(pxN), `ghost must not spill onto the ${label} tile`).toBe(false);
    expect(
      near(pxN, TERRAIN_RGB[state.tiles[ty][tx]]),
      `neighbor ${label} should keep its own terrain`,
    ).toBe(true);
  }
});

test('drag that starts over the HUD still pans the camera', async ({ page }) => {
  await openGame(page);

  // The HUD column has pointer-events; pressing there and dragging onto the
  // canvas must still pan the map.
  const before = await getCamera(page);
  await page.mouse.move(1200, 400);
  await page.mouse.down();
  await page.mouse.move(900, 400, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  const after = await getCamera(page);
  expect(after.scrollX - before.scrollX).toBeGreaterThan(200);
});

test('middle-drag pans the camera in any mode', async ({ page }) => {
  await openGame(page);

  const before = await getCamera(page);
  await page.mouse.move(640, 400);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(840, 400, { steps: 5 });
  await page.mouse.up({ button: 'middle' });
  await page.waitForTimeout(100);
  const after = await getCamera(page);
  expect(after.scrollX - before.scrollX).toBeLessThan(-150);

  // And it must still pan while a build mode is active.
  await page.getByTestId('build-road').click();
  const before2 = await getCamera(page);
  await page.mouse.move(640, 400);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(840, 400, { steps: 5 });
  await page.mouse.up({ button: 'middle' });
  await page.waitForTimeout(100);
  const after2 = await getCamera(page);
  expect(after2.scrollX - before2.scrollX).toBeLessThan(-150);
});

test('left-drag pans after zooming (no build mode)', async ({ page }) => {
  await openGame(page);

  await page.mouse.move(640, 400);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -120);
  await page.waitForTimeout(100);

  const before = await getCamera(page);
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(840, 400, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  const after = await getCamera(page);
  expect(after.scrollX - before.scrollX).toBeLessThan(-150);
});
