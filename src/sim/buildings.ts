import { CONFIG } from './config';
import type { BuildingCategory, BuildingType, Good, TileType } from './types';

export interface BuildingDef {
  type: BuildingType;
  name: string;
  category: BuildingCategory;
  /** Square footprint size in tiles (n x n). */
  footprint: number;
  /** Cost in denarii deducted from the treasury on placement. */
  cost: number;
  /** Terrain types a placement is allowed on. */
  allowedTerrains: TileType[];
  /** If set, every footprint tile must be this terrain (e.g. farm → fertile). */
  requiredTerrain?: TileType;
  /** True if at least one footprint edge must touch a road tile. */
  requiresRoad: boolean;
  /** Workers required for the building to be active. */
  workers: number;
  /** Storage capacity for goods (granary). */
  storageCapacity?: number;
  /** Production definition (farm). */
  production?: { good: Good; perTick: number; localCapacity: number };
  /** Spawn interval for the building's service walker, if any. */
  spawnEveryTicks?: number;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  road: {
    type: 'road',
    name: 'Road',
    category: 'roads',
    footprint: 1,
    cost: 0,
    allowedTerrains: ['earth', 'fertile', 'trees', 'rock'],
    requiresRoad: false,
    workers: 0,
  },
  house: {
    type: 'house',
    name: 'House',
    category: 'housing',
    footprint: 1,
    cost: 20,
    allowedTerrains: ['earth', 'fertile', 'trees', 'rock'],
    requiresRoad: true,
    workers: 0,
  },
  farm: {
    type: 'farm',
    name: 'Farm',
    category: 'food',
    footprint: 2,
    cost: 80,
    allowedTerrains: ['fertile'],
    requiredTerrain: 'fertile',
    requiresRoad: true,
    workers: 1,
    production: { good: 'wheat', perTick: CONFIG.farmProductionPerTick, localCapacity: CONFIG.farmStorageCapacity },
  },
  granary: {
    type: 'granary',
    name: 'Granary',
    category: 'infrastructure',
    footprint: 2,
    cost: 120,
    allowedTerrains: ['earth', 'fertile', 'trees', 'rock'],
    requiresRoad: true,
    workers: 0,
    storageCapacity: CONFIG.granaryCapacity,
  },
  market: {
    type: 'market',
    name: 'Market',
    category: 'infrastructure',
    footprint: 2,
    cost: 100,
    allowedTerrains: ['earth', 'fertile', 'trees', 'rock'],
    requiresRoad: true,
    workers: 1,
    spawnEveryTicks: CONFIG.marketSpawnEveryTicks,
  },
  well: {
    type: 'well',
    name: 'Well',
    category: 'water',
    footprint: 1,
    cost: 40,
    allowedTerrains: ['earth', 'fertile', 'trees', 'rock'],
    requiresRoad: true,
    workers: 1,
    spawnEveryTicks: CONFIG.wellSpawnEveryTicks,
  },
};

/** Immutable house-tier table exposed for UI and tests. */
export { HOUSE_TIERS } from './config';

export function isGood(g: string): g is Good {
  return g === 'wheat';
}
