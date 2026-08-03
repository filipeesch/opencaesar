/**
 * Walker categories & per-type data (ROAD-03 / task 1.8).
 *
 * Service walkers are categorized as wandering, destination, or recruiter, with
 * per-type movement and road data. The base catalog in `data/walkers.ts` holds
 * identity; this module merges category and movement data (from data) and
 * exposes defaults so callers always get a complete profile.
 */
import { WALKERS } from '../../data/walkers';
import { CONFIG } from './config';
import { isRoadPassable } from './roadTypes';

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
  buyer: 'destination',
  seller: 'wandering',
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
  // Defaults deliberately match the CONFIG constants so wiring the profiles in
  // changes no baseline behavior — the consumed CONFIG references also keep the
  // DATA-02 balance-parity invariant (every key consumed outside the re-export).
  serviceTTL: CONFIG.serviceCooldownTicks,
  spawnInterval: 40,
  movementSpeed: CONFIG.walkerSpeedPerTick,
  allowedRoadTypes: ['dirt', 'paved', 'plaza', 'bridge'],
  roadblockPolicy: 'stop',
  serviceRadiusFromCurrentTile: 0,
  preferredDirection: 'straight',
  returnPolicy: true,
};

export function walkerCategory(id: string): WalkerCategory {
  return CATEGORY_BY_ID[id] ?? 'wandering';
}

/**
 * Default roadblock policy per category: what a walker does at a
 * `service_roadblock` tile (configurable, enforced by pathfinding/movement).
 */
export const ROADBLOCK_POLICY_BY_CATEGORY: Record<WalkerCategory, RoadBlockPolicy> = {
  wandering: 'stop',
  destination: 'pass',
  recruiter: 'stop',
};

/**
 * Whether a walker profile may traverse a tile of the given road type. A
 * `service_roadblock` tile is granted solely by the profile's roadblock policy
 * (independent of `isRoadPassable`, which is false for roadblocks); every other
 * type requires the road type to be normally passable AND allowed.
 */
export function mayTraverse(profile: WalkerProfile, type: string): boolean {
  return type === 'service_roadblock'
    ? profile.roadblockPolicy === 'pass'
    : isRoadPassable(type) && profile.allowedRoadTypes.includes(type);
}

export function walkerProfile(id: string): WalkerProfile {
  const defined = WALKERS[id];
  const category = walkerCategory(id);
  return {
    ...DEFAULT_PROFILE,
    category,
    spawnInterval: category === 'recruiter' ? 60 : DEFAULT_PROFILE.spawnInterval,
    roadblockPolicy: ROADBLOCK_POLICY_BY_CATEGORY[category] ?? 'stop',
    ...(defined ? { id: defined.id } : { id }),
  };
}

export function allWalkerProfiles(): WalkerProfile[] {
  return Object.keys(WALKERS).map(walkerProfile);
}
