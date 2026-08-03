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
    spawnEveryTicks: CONFIG.marketSpawnEveryTicks,
  },
  school: {
    type: 'school', name: 'School', category: 'education',
    footprint: 2, cost: 150, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 2,
    spawnEveryTicks: CONFIG.marketSpawnEveryTicks,
  },
  library: {
    type: 'library', name: 'Library', category: 'education',
    footprint: 1, cost: 130, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 1,
    spawnEveryTicks: CONFIG.marketSpawnEveryTicks,
  },
  temple: {
    type: 'temple', name: 'Temple', category: 'religion',
    footprint: 2, cost: 160, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 2,
    spawnEveryTicks: CONFIG.marketSpawnEveryTicks,
  },
  theatre: {
    type: 'theatre', name: 'Theatre', category: 'entertainment',
    footprint: 2, cost: 180, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 2,
    spawnEveryTicks: CONFIG.marketSpawnEveryTicks,
  },
  forum: {
    type: 'forum', name: 'Forum', category: 'government',
    footprint: 2, cost: 220, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 2,
  },
  garden: {
    type: 'garden', name: 'Garden', category: 'ornament',
    footprint: 1, cost: 30, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: false, workers: 0,
  },
  // Raw producers (PROD-01) — deposits may be listed first so placement reads
  // natural on the required terrain; no spawnEveryTicks → no walkers spawned.
  clay_pit: {
    type: 'clay_pit', name: 'Clay Pit', category: 'raw',
    footprint: 2, cost: 120, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 8,
  },
  timber_yard: {
    type: 'timber_yard', name: 'Timber Yard', category: 'raw',
    footprint: 2, cost: 130, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 8,
  },
  iron_mine: {
    type: 'iron_mine', name: 'Iron Mine', category: 'raw',
    footprint: 2, cost: 220, allowedTerrains: ['rock', 'earth', 'fertile', 'trees'], requiresRoad: true, workers: 12,
  },
  quarry: {
    type: 'quarry', name: 'Marble Quarry', category: 'raw',
    footprint: 3, cost: 400, allowedTerrains: ['rock', 'earth', 'fertile', 'trees'], requiresRoad: true, workers: 16,
  },
  olive_farm: {
    type: 'olive_farm', name: 'Olive Farm', category: 'raw',
    footprint: 2, cost: 150, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 8,
  },
  grape_farm: {
    type: 'grape_farm', name: 'Grape Farm', category: 'raw',
    footprint: 2, cost: 150, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 8,
  },
  // Workshops (PROD-02)
  pottery_workshop: {
    type: 'pottery_workshop', name: 'Pottery Workshop', category: 'workshop',
    footprint: 2, cost: 200, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 8,
  },
  furniture_workshop: {
    type: 'furniture_workshop', name: 'Furniture Workshop', category: 'workshop',
    footprint: 2, cost: 210, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 8,
  },
  oil_press: {
    type: 'oil_press', name: 'Oil Press', category: 'workshop',
    footprint: 2, cost: 190, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 8,
  },
  winery: {
    type: 'winery', name: 'Winery', category: 'workshop',
    footprint: 2, cost: 190, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 8,
  },
  tool_workshop: {
    type: 'tool_workshop', name: 'Tool Workshop', category: 'workshop',
    footprint: 2, cost: 230, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 8,
  },
  // Storage (PROD-02 destination)
  warehouse: {
    type: 'warehouse', name: 'Warehouse', category: 'storage',
    footprint: 2, cost: 150, allowedTerrains: ['earth', 'fertile', 'trees', 'rock'], requiresRoad: true, workers: 3,
  },
};

/** Immutable house-tier table exposed for UI and tests. */
export { HOUSE_TIERS } from './config';

export function isGood(g: string): g is Good {
  return g === 'wheat';
}
