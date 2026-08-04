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

/** Resolution levels for building sprite sheets (zoom LOD). */
export const BUILDING_RESOLUTIONS = [30, 60, 90, 120, 150];

/** Best resolution for default zoom (zoom 1.0). */
export const DEFAULT_BUILDING_RESOLUTION = 150;

/**
 * Select the best base resolution for a given zoom level.
 * Returns the pixel-per-tile resolution at zoom 1.0.
 * 
 * Mapping designed so zoom 1.0 (default) uses 90px for good visual quality.
 * zoom 0.5 -> 30px, zoom 0.75 -> 60px, zoom 1.0 -> 90px, zoom 1.5+ -> 150px
 */
export function selectBuildingResolution(zoom: number): number {
  const idx = Math.round((zoom - 0.5) / 0.25);
  return BUILDING_RESOLUTIONS[Math.max(0, Math.min(BUILDING_RESOLUTIONS.length - 1, idx))]!;
}

/**
 * Building sprite metadata — tracks the original sprite dimensions so the
 * renderer can scale correctly regardless of the asset's natural aspect.
 */
export interface BuildingSpriteMeta {
  key: string;
  /** Original sprite width before scaling. */
  origWidth: number;
  /** Original sprite height before scaling. */
  origHeight: number;
}

/** Cached metadata per building type+resolution. */
const SPRITE_META: Map<string, BuildingSpriteMeta> = new Map();

export function getSpriteMeta(key: string): BuildingSpriteMeta | null {
  return SPRITE_META.get(key) ?? null;
}

export function preloadSpriteMeta(key: string, texture: Phaser.Textures.Texture): void {
  const src = texture.getSourceImage();
  if (src) {
    SPRITE_META.set(key, { key, origWidth: src.width, origHeight: src.height });
  }
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
export const SHEET_BUILDINGS: ReadonlySet<BuildingType> = new Set(['granary', 'farm']);
