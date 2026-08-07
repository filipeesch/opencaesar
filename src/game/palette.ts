/**
 * Placeholder palette for the procedural renderer.
 * The game must boot and be fully playable with zero art assets (design D10);
 * these flat colors are swapped for real sprite sheets later.
 */

import type { BuildingType } from '../sim/types';

export const TILE_W = 60;
export const TILE_H = 30;

export const BUILDING_COLORS: Record<Exclude<BuildingType, 'house'>, number> = {
  road: 0xc2b088, farm: 0x79b044, granary: 0xd8a963, market: 0x9d7bd1, well: 0x59c4ee,
  fountain: 0x59c4ee, orchard: 0x79b044, engineer_post: 0x9aa0a6, fire_station: 0xd05b4a,
  clinic: 0xef7f6a, hospital: 0xd94f4f, school: 0x6aa5d6, library: 0x8a7fd1, temple: 0xe0c96a, grand_temple: 0x8a5a2b,
  theatre: 0xcf6fd1, amphitheatre: 0xb06ad1, colosseum: 0x9a4fd1,
  forum: 0xc2b088, garden: 0x4f9d4f,
  senate: 0xd9c0a3, palatine: 0xe8d8b8,
  clay_pit: 0xba8a5c, timber_yard: 0x6b8e23, iron_mine: 0x7a7a7a, quarry: 0xb0a89a,
  olive_farm: 0x9caf4f, grape_farm: 0x8e5ea8,
  pottery_workshop: 0xc98a3f, furniture_workshop: 0x8b5a2b, oil_press: 0xd9c565, winery: 0x8e2f4f, tool_workshop: 0x5f6d7a,
  warehouse: 0x9d8b6a, prefecture: 0x8f6db0,
};

/** House color scales with tier: gray shack → red villa. */
export const HOUSE_COLORS: readonly number[] = [0x9e9d9a, 0xc9a27d, 0xd98c3f, 0xdc562e, 0xc9302c];

export const WALKER_COLORS: Record<'market' | 'well' | 'labor' | 'buyer' | 'seller' | 'clinic' | 'school' | 'library' | 'temple' | 'theatre', number> = {
  market: 0xec407a,
  well: 0x29b6f6,
  labor: 0xffa726,
  buyer: 0x66bb6a,
  seller: 0xffb74d,
  clinic: 0xef5350,
  school: 0x42a5f5,
  library: 0x7e57c2,
  temple: 0xffd54f,
  theatre: 0xab47bc,
};

/**
 * Overlay heatmap ramps moved to src/game/ui/overlays.ts in Phase 20 Wave 3:
 * per-service ramps (SERVICE_HUES + overlayHue) replaced the single shared
 * OVERLAY_RAMPS table (18-UI-REVIEW finding #2). See ui/overlays.ts.
 */

/** Convert a '#rrggbb' hex string to a Phaser color number (draw-time only). */
export function hexToPhaser(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}
