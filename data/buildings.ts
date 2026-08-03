/**
 * Building catalog — data-driven building definitions.
 */

export type BuildingCategory =
  | 'roads'
  | 'housing'
  | 'water'
  | 'food'
  | 'raw'
  | 'workshop'
  | 'storage'
  | 'commerce'
  | 'engineering'
  | 'safety'
  | 'health'
  | 'education'
  | 'entertainment'
  | 'religion'
  | 'government'
  | 'ornament'
  | 'monument';

export interface BuildingDef {
  id: string;
  name: string;
  category: BuildingCategory;
  /** Footprint as [w, h]. */
  footprint: [number, number];
  cost: number;
  workers: number;
  requiresRoad: boolean;
  /** Produces this commodity when staffed (workshops). */
  produces?: string;
  /** Consumes this commodity as input (workshops). */
  consumes?: string;
  /** Walkers this building spawns for services. */
  spawns?: string[];
  /** Service radius (fountain, temple, etc.), 0 = none (walkers only). */
  serviceRadius?: number;
  /** Desirability effect radius, if any. */
  desirability?: { effect: number; radius: number; falloff: number };
  /** Whether a road-adjacent entrance is required and the building can operate only with road access. */
  roadAccessRequired?: boolean;
  /** Storage capacity (warehouse/granary). */
  storageCapacity?: number;
  /** Storage accepts only food (granary) or general (warehouse). */
  storageKind?: 'food' | 'general';
  /** Monuments/administrative require population/rating thresholds. */
  requiredPopulation?: number;
  requiredRating?: { culture?: number; prosperity?: number; stability?: number; favor?: number };
}

export const BUILDINGS: Record<string, BuildingDef> = {
  // Infrastructure
  road: {
    id: 'road', name: 'Road', category: 'roads', footprint: [1, 1], cost: 4, workers: 0, requiresRoad: false,
  },
  paved_road: {
    id: 'paved_road', name: 'Paved Road', category: 'roads', footprint: [1, 1], cost: 12, workers: 0, requiresRoad: false,
    desirability: { effect: 2, radius: 1, falloff: 1 },
  },
  plaza: {
    id: 'plaza', name: 'Plaza', category: 'roads', footprint: [2, 2], cost: 60, workers: 0, requiresRoad: true,
    desirability: { effect: 8, radius: 3, falloff: 1 },
  },
  bridge: {
    id: 'bridge', name: 'Bridge', category: 'roads', footprint: [1, 3], cost: 24, workers: 0, requiresRoad: false,
  },
  roadblock: {
    id: 'roadblock', name: 'Service Roadblock', category: 'roads', footprint: [1, 1], cost: 20, workers: 0, requiresRoad: false,
  },
  // Housing
  house: {
    id: 'house', name: 'House', category: 'housing', footprint: [1, 1], cost: 20, workers: 0, requiresRoad: true,
  },
  // Water
  well: {
    id: 'well', name: 'Well', category: 'water', footprint: [1, 1], cost: 30, workers: 2, requiresRoad: true,
    serviceRadius: 4, spawns: ['well'],
  },
  reservoir: {
    id: 'reservoir', name: 'Reservoir', category: 'water', footprint: [3, 3], cost: 400, workers: 10, requiresRoad: true,
    spawns: ['fountain'],
  },
  fountain: {
    id: 'fountain', name: 'Fountain', category: 'water', footprint: [1, 1], cost: 80, workers: 4, requiresRoad: true,
    serviceRadius: 6, spawns: ['fountain'],
    desirability: { effect: 4, radius: 2, falloff: 1 },
  },
  // Food
  farm: {
    id: 'farm', name: 'Farm', category: 'food', footprint: [3, 3], cost: 160, workers: 10, requiresRoad: true,
    produces: 'wheat',
  },
  vegetable_farm: {
    id: 'vegetable_farm', name: 'Vegetable Farm', category: 'food', footprint: [3, 3], cost: 170, workers: 10, requiresRoad: true,
    produces: 'vegetables',
  },
  orchard: {
    id: 'orchard', name: 'Orchard', category: 'food', footprint: [3, 3], cost: 180, workers: 10, requiresRoad: true,
    produces: 'fruit',
  },
  cattle_ranch: {
    id: 'cattle_ranch', name: 'Cattle Ranch', category: 'food', footprint: [3, 3], cost: 200, workers: 10, requiresRoad: true,
    produces: 'meat',
  },
  fishing_wharf: {
    id: 'fishing_wharf', name: 'Fishing Wharf', category: 'food', footprint: [2, 2], cost: 140, workers: 6, requiresRoad: true,
    produces: 'fish',
  },
  market: {
    id: 'market', name: 'Market', category: 'commerce', footprint: [2, 2], cost: 150, workers: 6, requiresRoad: true,
    spawns: ['market'],
  },
  granary: {
    id: 'granary', name: 'Granary', category: 'storage', footprint: [2, 2], cost: 120, workers: 3, requiresRoad: true,
    storageCapacity: 32, storageKind: 'food',
  },
  // Raw producers
  clay_pit: {
    id: 'clay_pit', name: 'Clay Pit', category: 'raw', footprint: [2, 2], cost: 120, workers: 8, requiresRoad: true,
    produces: 'clay',
  },
  timber_yard: {
    id: 'timber_yard', name: 'Timber Yard', category: 'raw', footprint: [2, 2], cost: 130, workers: 8, requiresRoad: true,
    produces: 'timber',
  },
  iron_mine: {
    id: 'iron_mine', name: 'Iron Mine', category: 'raw', footprint: [2, 2], cost: 220, workers: 12, requiresRoad: true,
    produces: 'iron',
  },
  olive_farm: {
    id: 'olive_farm', name: 'Olive Farm', category: 'raw', footprint: [2, 2], cost: 150, workers: 8, requiresRoad: true,
    produces: 'olives',
  },
  grape_farm: {
    id: 'grape_farm', name: 'Grape Farm', category: 'raw', footprint: [2, 2], cost: 150, workers: 8, requiresRoad: true,
    produces: 'grapes',
  },
  quarry: {
    id: 'quarry', name: 'Marble Quarry', category: 'raw', footprint: [3, 3], cost: 400, workers: 16, requiresRoad: true,
    produces: 'marble',
  },
  // Workshops
  pottery_workshop: {
    id: 'pottery_workshop', name: 'Pottery Workshop', category: 'workshop', footprint: [2, 2], cost: 200, workers: 8, requiresRoad: true,
    produces: 'pottery', consumes: 'clay',
  },
  furniture_workshop: {
    id: 'furniture_workshop', name: 'Furniture Workshop', category: 'workshop', footprint: [2, 2], cost: 210, workers: 8, requiresRoad: true,
    produces: 'furniture', consumes: 'timber',
  },
  oil_press: {
    id: 'oil_press', name: 'Oil Press', category: 'workshop', footprint: [2, 2], cost: 190, workers: 8, requiresRoad: true,
    produces: 'oil', consumes: 'olives',
  },
  winery: {
    id: 'winery', name: 'Winery', category: 'workshop', footprint: [2, 2], cost: 190, workers: 8, requiresRoad: true,
    produces: 'wine', consumes: 'grapes',
  },
  tool_workshop: {
    id: 'tool_workshop', name: 'Tool Workshop', category: 'workshop', footprint: [2, 2], cost: 230, workers: 8, requiresRoad: true,
    produces: 'tools', consumes: 'iron',
  },
  // Storage
  warehouse: {
    id: 'warehouse', name: 'Warehouse', category: 'storage', footprint: [2, 2], cost: 150, workers: 3, requiresRoad: true,
    storageCapacity: 40, storageKind: 'general',
  },
  // Engineering
  engineer_post: {
    id: 'engineer_post', name: 'Engineer Post', category: 'engineering', footprint: [1, 1], cost: 60, workers: 3, requiresRoad: true,
    spawns: ['engineer'],
  },
  // Safety
  fire_station: {
    id: 'fire_station', name: 'Fire Station', category: 'safety', footprint: [2, 2], cost: 150, workers: 6, requiresRoad: true,
    spawns: ['fireman'],
  },
  // Health
  clinic: {
    id: 'clinic', name: 'Clinic', category: 'health', footprint: [1, 1], cost: 80, workers: 4, requiresRoad: true,
    spawns: ['doctor'],
  },
  hospital: {
    id: 'hospital', name: 'Hospital', category: 'health', footprint: [2, 2], cost: 300, workers: 10, requiresRoad: true,
    spawns: ['doctor'],
  },
  // Education
  school: {
    id: 'school', name: 'School', category: 'education', footprint: [1, 1], cost: 90, workers: 4, requiresRoad: true,
    spawns: ['teacher'],
  },
  library: {
    id: 'library', name: 'Library', category: 'education', footprint: [2, 2], cost: 250, workers: 8, requiresRoad: true,
    spawns: ['librarian'],
  },
  // Entertainment
  theatre: {
    id: 'theatre', name: 'Theatre', category: 'entertainment', footprint: [3, 3], cost: 500, workers: 12, requiresRoad: true,
    spawns: ['entertainer'],
  },
  amphitheatre: {
    id: 'amphitheatre', name: 'Amphitheatre', category: 'entertainment', footprint: [4, 4], cost: 900, workers: 20, requiresRoad: true,
    spawns: ['entertainer'],
  },
  // Religion
  temple: {
    id: 'temple', name: 'Temple', category: 'religion', footprint: [2, 2], cost: 400, workers: 8, requiresRoad: true,
    spawns: ['priest'], serviceRadius: 8,
  },
  // Government
  forum: {
    id: 'forum', name: 'Forum', category: 'government', footprint: [3, 3], cost: 600, workers: 10, requiresRoad: true,
    spawns: ['official'],
  },
  senate: {
    id: 'senate', name: 'Senate', category: 'government', footprint: [3, 3], cost: 1200, workers: 20, requiresRoad: true,
    spawns: ['senator'],
    requiredPopulation: 1000,
  },
  // Ornament
  garden: {
    id: 'garden', name: 'Garden', category: 'ornament', footprint: [1, 1], cost: 20, workers: 0, requiresRoad: true,
    desirability: { effect: 3, radius: 2, falloff: 1 },
  },
  statue: {
    id: 'statue', name: 'Statue', category: 'ornament', footprint: [1, 1], cost: 60, workers: 0, requiresRoad: true,
    desirability: { effect: 4, radius: 2, falloff: 1 },
  },
  // Monument
  grand_temple: {
    id: 'grand_temple', name: 'Grand Temple', category: 'monument', footprint: [4, 4], cost: 2500, workers: 40, requiresRoad: true,
    spawns: ['priest'], serviceRadius: 12,
    requiredRating: { culture: 40 },
  },
  colosseum: {
    id: 'colosseum', name: 'Colosseum', category: 'monument', footprint: [5, 5], cost: 4000, workers: 60, requiresRoad: true,
    spawns: ['entertainer'],
    requiredRating: { culture: 60 },
  },
};

export function buildingName(id: string): string {
  return BUILDINGS[id]?.name ?? id;
}

export function isFoodProducer(b: BuildingDef): boolean {
  return Boolean(b.produces) && ['wheat', 'vegetables', 'fruit', 'meat', 'fish'].includes(b.produces!);
}

export function isRawProducer(b: BuildingDef): boolean {
  return Boolean(b.produces) && ['clay', 'timber', 'iron', 'marble', 'olives', 'grapes'].includes(b.produces!);
}
