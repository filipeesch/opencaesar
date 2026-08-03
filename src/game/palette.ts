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
  clinic: 0xef7f6a, school: 0x6aa5d6, library: 0x8a7fd1, temple: 0xe0c96a, theatre: 0xcf6fd1,
  forum: 0xc2b088, garden: 0x4f9d4f,
};

/** House color scales with tier: gray shack → red villa. */
export const HOUSE_COLORS: readonly number[] = [0x9e9d9a, 0xc9a27d, 0xd98c3f, 0xdc562e, 0xc9302c];

export const WALKER_COLORS: Record<'market' | 'well' | 'labor' | 'clinic' | 'school' | 'library' | 'temple' | 'theatre', number> = {
  market: 0xec407a,
  well: 0x29b6f6,
  labor: 0xffa726,
  clinic: 0xef5350,
  school: 0x42a5f5,
  library: 0x7e57c2,
  temple: 0xffd54f,
  theatre: 0xab47bc,
};
