/**
 * Placeholder palette for the procedural renderer.
 * The game must boot and be fully playable with zero art assets (design D10);
 * these flat colors are swapped for real sprite sheets later.
 */

import type { BuildingType } from '../sim/types';

export const TILE_W = 60;
export const TILE_H = 30;

export const BUILDING_COLORS: Record<Exclude<BuildingType, 'house'>, number> = {
  road: 0xc2b088,
  farm: 0x79b044,
  granary: 0xd8a963,
  market: 0x9d7bd1,
  well: 0x59c4ee,
};

/** House color scales with tier: gray shack → red villa. */
export const HOUSE_COLORS: readonly number[] = [0x9e9d9a, 0xc9a27d, 0xd98c3f, 0xdc562e, 0xc9302c];

export const WALKER_COLORS: Record<'market' | 'well' | 'labor', number> = {
  market: 0xec407a,
  well: 0x29b6f6,
  labor: 0xffa726,
};
