/**
 * Walker categories & per-type data (ROAD-03 / task 1.8).
 *
 * Service walkers are categorized as wandering, destination, or recruiter, with
 * per-type movement and road data. The base catalog in `data/walkers.ts` holds
 * identity; this module merges category and movement data (from data) and
 * exposes defaults so callers always get a complete profile.
 */
import { WALKERS } from '../../data/walkers';

export type WalkerCategory = 'wandering' | 'destination' | 'recruiter';
export type RoadBlockPolicy = 'stop' | 'pass';

export interface WalkerProfile {
  id: string;
  category: WalkerCategory;
  /** How many road tiles a wandering walker travels before turning back. */
  maxRoadSteps: number;
  /** Ticks a delivered service stays fresh before it must be renewed. */
  serviceTTL: number;
  /** Ticks between spawns of this walker from its building. */
  spawnInterval: number;
  /** Fraction of a tile moved per tick on a normal dirt road. */
  movementSpeed: number;
  /** Road types this walker may traverse. */
  allowedRoadTypes: string[];
  /** Behavior when blocked by a service roadblock. */
  roadblockPolicy: RoadBlockPolicy;
  /** Radius (in tiles) a recruiter serves from its current tile (0 = road-only). */
  serviceRadiusFromCurrentTile: number;
  /** Preferred travel direction, used as a tiebreaker at intersections. */
  preferredDirection: 'left' | 'right' | 'straight';
  /** Whether a wandering walker must return to its origin building. */
  returnPolicy: boolean;
}

const CATEGORY_BY_ID: Record<string, WalkerCategory> = {
  well: 'wandering',
  fountain: 'wandering',
  market: 'destination',
  engineer: 'wandering',
  fireman: 'wandering',
  doctor: 'wandering',
  teacher: 'wandering',
  librarian: 'wandering',
  entertainer: 'wandering',
  priest: 'wandering',
  official: 'recruiter',
  senator: 'recruiter',
};

const DEFAULT_PROFILE: Omit<WalkerProfile, 'id'> = {
  category: 'wandering',
  maxRoadSteps: 8,
  serviceTTL: 120,
  spawnInterval: 40,
  movementSpeed: 0.5,
  allowedRoadTypes: ['dirt', 'paved', 'plaza', 'bridge'],
  roadblockPolicy: 'stop',
  serviceRadiusFromCurrentTile: 0,
  preferredDirection: 'straight',
  returnPolicy: true,
};

export function walkerCategory(id: string): WalkerCategory {
  return CATEGORY_BY_ID[id] ?? 'wandering';
}

export function walkerProfile(id: string): WalkerProfile {
  const defined = WALKERS[id];
  const category = walkerCategory(id);
  return {
    ...DEFAULT_PROFILE,
    category,
    spawnInterval: category === 'recruiter' ? 60 : DEFAULT_PROFILE.spawnInterval,
    ...(defined ? { id: defined.id } : { id }),
  };
}

export function allWalkerProfiles(): WalkerProfile[] {
  return Object.keys(WALKERS).map(walkerProfile);
}
