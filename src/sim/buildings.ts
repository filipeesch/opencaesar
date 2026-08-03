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
  /** Minimum number of footprint tiles that must be `requiredTerrain` (farm needs fertile). */
  minRequiredTiles?: number;
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
    allowedTerrains: ['fertile', 'earth', 'trees', 'rock'],
    requiredTerrain: 'fertile',
    // A farm needs at least 2 fertile tiles in its 2x2 footprint; the rest may
    // be other buildable terrain (so clumps of fertile land are enough).
    minRequiredTiles: 2,
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
    workers: 1,
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
  fountain: {
    type: 'fountain',
    name: 'Fountain',
    category: 'water',
    footprint: 1,
    cost: 60,
    allowedTerrains: ['earth', 'fertile', 'trees', 'rock'],
    requiresRoad: true,
    workers: 1,
    spawnEveryTicks: CONFIG.wellSpawnEveryTicks,
  },
  orchard: {
    type: 'orchard',
    name: 'Orchard',
    category: 'food',
    footprint: 2,
    cost: 90,
    allowedTerrains: ['fertile', 'earth', 'trees', 'rock'],
    requiredTerrain: 'fertile',
    minRequiredTiles: 2,
    requiresRoad: true,
    workers: 1,
    production: { good: 'wheat', perTick: CONFIG.farmProductionPerTick, localCapacity: CONFIG.farmStorageCapacity },
  },
  engineer_post: {
    type: 'engineer_post', name: 'Engineering Post', category: 'engineering',
    footprint: 1, cost: 70, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 1,
  },
  fire_station: {
    type: 'fire_station', name: 'Fire Station', category: 'safety',
    footprint: 2, cost: 120, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 2,
  },
  clinic: {
    type: 'clinic', name: 'Clinic', category: 'health',
    footprint: 1, cost: 110, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 1,
  },
  school: {
    type: 'school', name: 'School', category: 'education',
    footprint: 2, cost: 150, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 2,
  },
  library: {
    type: 'library', name: 'Library', category: 'education',
    footprint: 1, cost: 130, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 1,
  },
  temple: {
    type: 'temple', name: 'Temple', category: 'religion',
    footprint: 2, cost: 160, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 2,
  },
  theatre: {
    type: 'theatre', name: 'Theatre', category: 'entertainment',
    footprint: 2, cost: 180, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 2,
  },
  forum: {
    type: 'forum', name: 'Forum', category: 'government',
    footprint: 2, cost: 220, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 2,
  },
  garden: {
    type: 'garden', name: 'Garden', category: 'ornament',
    footprint: 1, cost: 30, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: false, workers: 0,
  },
};

/** Immutable house-tier table exposed for UI and tests. */
export { HOUSE_TIERS } from './config';

export function isGood(g: string): g is Good {
  return g === 'wheat';
}
