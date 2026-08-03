/** Core shared types for the simulation. Plain data only — no Phaser anywhere. */

export interface Vec2 {
  x: number;
  y: number;
}

/** Terrain type of a single tile. */
export type TileType = 'earth' | 'water' | 'fertile' | 'trees' | 'rock' | 'road';

/** Marker returned by out-of-bounds tile queries (never undefined). */
export type TileQuery = TileType | 'out-of-bounds';

/** Tradable/consumable good types. */
export type Good = 'wheat' | 'pottery' | 'vegetables' | 'fruit' | 'fish' | 'meat' | 'furniture' | 'wine' | 'oil' | 'tools' | 'clay' | 'timber' | 'iron' | 'marble' | 'olives' | 'grapes';

export type BuildingType =
  | 'road' | 'house' | 'farm' | 'granary' | 'market' | 'well'
  | 'fountain' | 'orchard' | 'engineer_post' | 'fire_station' | 'clinic'
  | 'school' | 'library' | 'temple' | 'theatre' | 'forum' | 'garden';

export type BuildingCategory =
  | 'roads' | 'housing' | 'food' | 'water' | 'infrastructure'
  | 'engineering' | 'safety' | 'health' | 'education' | 'entertainment'
  | 'religion' | 'government' | 'ornament';

export type WalkerType = 'market' | 'well' | 'labor';

export type PlacementError =
  | 'invalid-type'
  | 'out-of-bounds'
  | 'occupied'
  | 'terrain'
  | 'road-access'
  | 'not-enough-money';

export type PlacementResult = { ok: true } | { ok: false; error: PlacementError };

export interface Policy {
  /** Tax rate as a fraction 0..1. */
  taxRate: number;
  /** Wage rate as a fraction 0..1. */
  wageRate: number;
}

export type MessageType = 'building-inactive' | 'building-active' | 'house-evolved' | 'house-devolved' | 'warning';

export interface SimMessage {
  tick: number;
  type: MessageType;
  text: string;
}

export interface CommandLogEntry {
  tick: number;
  command: string;
  result: 'ok' | PlacementError;
}

/** A replayable command (structured form of a CommandLogEntry for save/load). */
export type SaveCommand =
  | { kind: 'place'; type: BuildingType; x: number; y: number }
  | { kind: 'setPolicy'; taxRate: number; wageRate: number };

/** Serializable save payload capturing everything needed to resume a sim deterministically. */
export interface SaveData {
  version: 1;
  seed: number;
  mapSize: number;
  commands: SaveCommand[];
  tickCount: number;
  savedAt: number;
}

/** Public state of a single building. */
export interface BuildingState {
  id: number;
  type: BuildingType;
  x: number;
  y: number;
  footprint: number;
  workersAssigned: number;
  workersRequired: number;
  active: boolean;
  laborConnected: boolean;
  stock: Partial<Record<Good, number>>;
  /** House-only fields (undefined for other building types). */
  house?: {
    tier: number;
    tierName: string;
    populationCapacity: number;
    foodCooldown: number;
    waterCooldown: number;
    laborCooldown: number;
    /** Current desirability of the house tile (same value the evolution logic uses). */
    desirability: number;
    /** Resident happiness 0..100, derived from coverage, desirability, and wages. */
    happiness: number;
  };
}

/** Public state of a single walker. */
export interface WalkerState {
  id: number;
  type: WalkerType;
  /** Tile the walker is currently crossing (departure tile). */
  x: number;
  y: number;
  /** Tile the walker is walking toward, or null when standing still. */
  next: Vec2 | null;
  /** Fraction 0..1 of the way from (x, y) toward `next`. */
  progress: number;
  state: string;
  lifetime: number;
  /** Building id the walker is heading for, or null when wandering/idle. */
  targetBuildingId: number | null;
  carryingGood: Good | null;
}

export interface Ratings {
  population: number;
  prosperity: number;
  /** City-wide happiness 0..100 (population-weighted average of house happiness). */
  happiness: number;
}

/** Full public snapshot of the simulation — plain serializable data. */

export interface TradeRoute {
  cityId: string;
  enabled: boolean;
  imports: Partial<Record<string, number>>;
  exports: Partial<Record<string, number>>;
  /** Annual export quota in loads; 0 = unlimited. */
  annualQuota?: number;
  /** Quota used so far this year. */
  usedQuota?: number;
  /** Last year the quota was reset. */
  lastYear?: number;
}

export interface EventRecord {
  tick: number;
  type: string;
  text: string;
  severity: 'mild' | 'serious' | 'disaster';
}

export interface MissionState {
  id: string;
  started: boolean;
  complete: boolean;
  failed: boolean;
  year: number;
  objective: string;
}

export interface SimState {
  tick: number;
  width: number;
  height: number;
  tiles: TileType[][];
  buildings: BuildingState[];
  walkers: WalkerState[];
  treasury: number;
  policy: Policy;
  ratings: Ratings;
  totalWorkers: number;
  assignedWorkers: number;
  /** Total jobs = sum of all buildings' worker requirements. */
  totalJobs: number;
  messages: SimMessage[];
  lastTickWagesUnpaid: boolean;
}
