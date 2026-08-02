/**
 * Art manifest + loader state.
 *
 * Sprite sheets are keyed by type and referenced from `public/assets/`. The
 * game boots with zero required art assets (design D10): BootScene tries to
 * load each sheet in the manifest and, for any sheet that is missing, registers
 * a procedural placeholder texture under the same key. Renderers must not
 * assume a sheet came from a file — they check `sheetLoaded(key)` only to pick
 * between the manifest art and the procedural fallback, and they always read
 * the texture by its manifest key.
 */

import type { BuildingType, TileType } from '../sim/types';
import { TILE_H, TILE_W } from './palette';

/** Height of a house sheet frame (footprint diamond + roof rise). */
export const HOUSE_FRAME_H = 48;
/** Y (in frame pixels) of the footprint diamond's top vertex within a house frame. */
export const HOUSE_FOOT_TOP_Y = 18;

export interface SheetSpec {
  /** Texture key registered by the loader and used by renderers. */
  key: string;
  /** URL relative to the app root (served from public/). */
  url: string;
  /** Frame size in pixels. */
  frameWidth: number;
  frameHeight: number;
}

/** The art manifest: sprite sheets keyed by type. */
export const SHEETS: readonly SheetSpec[] = [
  { key: 'terrain', url: 'assets/terrain.png', frameWidth: TILE_W, frameHeight: TILE_H },
  { key: 'house', url: 'assets/house.png', frameWidth: TILE_W, frameHeight: HOUSE_FRAME_H },
];

/** Terrain tile type → tile index within the terrain sheet. */
export const TERRAIN_FRAME: Record<TileType, number> = {
  earth: 0,
  water: 1,
  fertile: 2,
  trees: 3,
  rock: 4,
  road: 5,
};

/** House tier → frame index within the house sheet. */
export function houseFrame(tier: number): number {
  return Math.max(0, Math.min(4, tier));
}

/** Texture keys that loaded successfully from the manifest (rest use placeholders). */
export const sheetLoaded = new Set<string>();

export function isSheetLoaded(key: string): boolean {
  return sheetLoaded.has(key);
}

/** Building types backed by a manifest sheet (used to pick the renderer). */
export const SHEET_BUILDINGS: ReadonlySet<BuildingType> = new Set(['house']);
