import { type Page } from '@playwright/test';
import { TILE_H, TILE_W } from '../src/game/palette';
import type { BuildingType, PlacementResult, SimState, TileType } from '../src/sim/types';

declare global {
  interface Window {
    __cityApi?: {
      place: (type: BuildingType, x: number, y: number) => PlacementResult;
      runTicks: (n: number) => void;
      state: () => SimState;
      camera: () => { zoom: number; scrollX: number; scrollY: number };
    };
  }
}

export const VIEW_W = 1280;
export const VIEW_H = 800;
const CAM_CX = VIEW_W / 2;
const CAM_CY = VIEW_H / 2;

export async function openGame(page: Page): Promise<void> {
  await page.goto('/?test&seed=1337', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__cityApi);
}

export function getState(page: Page): Promise<SimState> {
  return page.evaluate(() => window.__cityApi!.state());
}

export function placeOn(page: Page, type: BuildingType, x: number, y: number): Promise<PlacementResult> {
  return page.evaluate(
    (args) => window.__cityApi!.place(args.type, args.x, args.y),
    { type, x, y } as const,
  );
}

/** Fast-forward the simulation by `n` ticks (test-only API). */
export function runTicks(page: Page, n: number): Promise<void> {
  return page.evaluate((count) => window.__cityApi!.runTicks(count), n);
}

export function getCamera(page: Page): Promise<{ zoom: number; scrollX: number; scrollY: number }> {
  return page.evaluate(() => window.__cityApi!.camera());
}

/** Zoom out to the minimum so the whole 40x40 map fits in the viewport. */
export async function zoomOut(page: Page): Promise<void> {
  await page.mouse.move(CAM_CX, CAM_CY);
  for (let i = 0; i < 20; i++) {
    const cam = await getCamera(page);
    if (cam.zoom <= 0.51) return;
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(50);
  }
}

/**
 * Screen coordinates of a tile's rendered diamond center. Phaser renders each
 * iso tile's texture diamond centered on ((tx-ty)*W/2 + W/2, (tx+ty)*H/2 + H/2);
 * Screen = (world - scroll) * zoom (camera at origin).
 */
export async function tileCenter(page: Page, tx: number, ty: number): Promise<{ x: number; y: number }> {
  const cam = await getCamera(page);
  const wx = (tx - ty) * (TILE_W / 2) + TILE_W / 2;
  const wy = (tx + ty) * (TILE_H / 2) + TILE_H / 2;
  return { x: (wx - cam.scrollX) * cam.zoom, y: (wy - cam.scrollY) * cam.zoom };
}

export async function findBuilding(page: Page, type: BuildingType, tx: number, ty: number): Promise<boolean> {
  const state = await getState(page);
  return state.buildings.some((b) => b.type === type && b.x === tx && b.y === ty);
}

/**
 * Find the first tile matching a predicate whose computed screen center is
 * safely inside the viewport (clear of the HUD column on the right).
 */
export async function pickTile(
  page: Page,
  predicate: (tiles: TileType[][], x: number, y: number) => boolean,
): Promise<{ tx: number; ty: number } | null> {
  const state = await getState(page);
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (!predicate(state.tiles, x, y)) continue;
      const screen = await tileCenter(page, x, y);
      if (screen.x < 60 || screen.x > VIEW_W - 300 || screen.y < 60 || screen.y > VIEW_H - 60) continue;
      return { tx: x, ty: y };
    }
  }
  return null;
}

export async function toastText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="toast"]') as HTMLElement | null;
    return el && el.style.display !== 'none' ? el.textContent ?? '' : '';
  });
}
