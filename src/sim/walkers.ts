/**
 * Walker lifecycle: road movement, service coverage, objective handling, and
 * despawn. Pure functions over the SimInternals contract — no Phaser, and all
 * randomness flows through the injected seeded RNG.
 *
 * Coverage model: each tick, a walker's service is applied to houses on tiles
 * orthogonally adjacent to the tile it currently occupies. Services carry a
 * cooldown and must be re-supplied (see runner for cooldown decay).
 */

import { CONFIG } from './config';
import type { Map } from './map';
import { findRoadPath, roadNeighbors } from './pathfind';
import type { Rng } from './rng';
import { randInt } from './rng';
import { roadSpeedMultiplier } from './roadTypes';
import type { BuildingType, Good, Vec2, WalkerType } from './types';
import type { WalkerProfile } from './walkerProfiles';
import { walkerProfile, mayTraverse } from './walkerProfiles';

export interface WalkerInstance {
  id: number;
  type: WalkerType;
  /** Tile the walker is currently crossing (its departure tile). */
  x: number;
  y: number;
  /** Tile being walked toward, or null while standing on `next`/idle. */
  next: Vec2 | null;
  /** Fraction 0..1 of the way from (x, y) to `next`. */
  progress: number;
  /** 'seeking' = following a planned path; 'wandering' = RNG choice at junctions. */
  state: 'seeking' | 'wandering';
  /** Remaining ticks before the walker despawns. */
  lifetime: number;
  /** Remaining tiles to traverse (current tile excluded, goal tile included). */
  path: Vec2[];
  /** Building id the walker intends to reach, or null. */
  targetBuildingId: number | null;
  carryingGood: Good | null;
  carriedAmount: number;
  /** Tile the walker was spawned on; used by return-policy wandering. */
  origin: Vec2 | null;
  /** Road tiles walked since leaving `origin` (0 when back at it). */
  stepsTaken: number;
}

/** House-only simulation state (undefined on non-house buildings). */
export interface HouseInstance {
  tier: number;
  foodCooldown: number;
  waterCooldown: number;
  laborCooldown: number;
  evolveCounter: number;
  devolveCounter: number;
  /** Service access delivered by walkers (health/literacy/religion/entertainment). */
  services?: Partial<Record<string, number>>;
}

const SERVICE_BY_WALKER: Record<string, string> = {
  clinic: 'health',
  school: 'literacy',
  library: 'literacy',
  temple: 'religion',
  theatre: 'entertainment',
};

export interface BuildingInstance {
  id: number;
  type: BuildingType;
  /** Footprint anchor (top-left tile). */
  x: number;
  y: number;
  footprint: number;
  workersAssigned: number;
  workersRequired: number;
  active: boolean;
  laborConnected: boolean;
  laborCooldown: number;
  /** Countdown to the next service-walker spawn, if the building spawns any. */
  spawnCooldown: number;
  stock: Partial<Record<Good, number>>;
  house?: HouseInstance;
}

/**
 * The slice of SimRunner state walkers may touch. Walkers never mutate the map
 * or the building registry — only building service fields and themselves.
 */
export interface SimInternals {
  map: Map;
  rng: Rng;
  /** All buildings in placement order (stable iteration for deterministic tie-breaks). */
  buildings: BuildingInstance[];
  buildingById: (id: number) => BuildingInstance | null;
  buildingAt: (x: number, y: number) => BuildingInstance | null;
  /** Nearest road tile adjacent to a building footprint, or null. */
  adjacentRoadTile: (b: BuildingInstance) => Vec2 | null;
  despawn: (w: WalkerInstance) => void;
}

const DIRS: readonly Vec2[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** Create a walker standing on a road tile, idle until its first decide. */
export function createWalker(type: WalkerType, x: number, y: number, id: number): WalkerInstance {
  return {
    id,
    type,
    x,
    y,
    next: null,
    progress: 0,
    state: 'wandering',
    lifetime: CONFIG.walkerLifetimeTicks,
    path: [],
    targetBuildingId: null,
    carryingGood: null,
    carriedAmount: 0,
    origin: { x, y },
    stepsTaken: 0,
  };
}

/** Advance a walker by one tick. May despawn it (via sim.despawn). */
export function updateWalker(sim: SimInternals, w: WalkerInstance): void {
  w.lifetime -= 1;
  if (w.lifetime <= 0) {
    sim.despawn(w);
    return;
  }

  const profile = walkerProfile(w.type);

  // Coverage first: houses next to the walker receive its service flag.
  applyCoverage(sim, w, profile);

  // Arrival at the objective: apply its effect, possibly despawn.
  if (w.state === 'seeking' && w.targetBuildingId !== null && w.path.length === 0) {
    const keepGoing = handleArrival(sim, w, profile);
    if (!keepGoing) return;
    w.state = 'wandering';
    w.targetBuildingId = null;
  }

  if (w.state === 'wandering') decide(sim, w, profile);

  move(sim, w, profile);
}

/** Apply the walker's service to houses adjacent to its current tile. */
function applyCoverage(sim: SimInternals, w: WalkerInstance, profile: WalkerProfile): void {
  if (w.type === 'well') {
    serviceHousesAround(sim, w, 'water', profile);
  } else if (w.type === 'market' && w.carryingGood === 'wheat' && w.carriedAmount > 0) {
    serviceHousesAround(sim, w, 'food', profile);
  } else if (SERVICE_BY_WALKER[w.type]) {
    serviceHousesAround(sim, w, SERVICE_BY_WALKER[w.type], profile);
  }
}

function serviceHousesAround(sim: SimInternals, w: WalkerInstance, service: string, profile: WalkerProfile): void {
  for (const d of DIRS) {
    const b = sim.buildingAt(w.x + d.x, w.y + d.y);
    if (b && b.house) {
      if (service === 'food') b.house.foodCooldown = profile.serviceTTL;
      else if (service === 'water') b.house.waterCooldown = profile.serviceTTL;
      else {
        b.house.services = b.house.services ?? {};
        b.house.services[service] = profile.serviceTTL;
      }
    }
  }
}

/** Pick a new objective (market: granary/house; labor: building; well: none). */
function decide(sim: SimInternals, w: WalkerInstance, profile: WalkerProfile): void {
  if (w.type === 'market') decideMarket(sim, w, profile);
  else if (w.type === 'labor') decideLabor(sim, w, profile);
}

function decideMarket(sim: SimInternals, w: WalkerInstance, profile: WalkerProfile): void {
  if (w.carryingGood === 'wheat' && w.carriedAmount > 0) {
    const house = nearestHouseNeeding(sim, w, 'food');
    if (house) startSeeking(sim, w, house, profile);
    return;
  }
  const granary = nearestGranaryWithWheat(sim, w);
  if (granary) startSeeking(sim, w, granary, profile);
}

function decideLabor(sim: SimInternals, w: WalkerInstance, profile: WalkerProfile): void {
  const b = nearestBuildingNeedingLabor(sim, w);
  if (b) startSeeking(sim, w, b, profile);
}

/** Turn the walker toward a building. Returns false when unreachable. */
function startSeeking(sim: SimInternals, w: WalkerInstance, target: BuildingInstance, profile: WalkerProfile): boolean {
  const to = sim.adjacentRoadTile(target);
  if (!to) return false;
  const path = findRoadPath(sim.map, { x: w.x, y: w.y }, to, traversableFor(sim, profile));
  if (path === null) return false;
  // findRoadPath returns only the intermediate tiles strictly between the
  // walker's current tile and the goal (both excluded), so the walker reaches
  // the goal tile by adjacency — there is never a start tile to drop here.
  w.state = 'seeking';
  w.targetBuildingId = target.id;
  w.path = path;
  return true;
}

/**
 * The walker stands on the goal tile next to its target building.
 * Returns false when the walker despawned and must not continue.
 */
function handleArrival(sim: SimInternals, w: WalkerInstance, profile: WalkerProfile): boolean {
  const target = sim.buildingById(w.targetBuildingId ?? -1);
  if (!target) return true;

  if (w.type === 'market') {
    if (w.carryingGood === 'wheat' && w.carriedAmount > 0) {
      // Deliver one unit of food to the target house.
      if (target.house) target.house.foodCooldown = profile.serviceTTL;
      w.carriedAmount -= 1;
      if (w.carriedAmount <= 0) {
        w.carryingGood = null;
        w.carriedAmount = 0;
      }
      if (w.carriedAmount <= 0) {
        sim.despawn(w);
        return false;
      }
    } else {
      // Fetch wheat from the target granary (up to the configured amount).
      const stock = target.stock.wheat ?? 0;
      const take = Math.min(CONFIG.marketFetchAmount, stock);
      if (take > 0) {
        target.stock.wheat = stock - take;
        w.carryingGood = 'wheat';
        w.carriedAmount = take;
      }
    }
  } else if (w.type === 'labor') {
    target.laborConnected = true;
    target.laborCooldown = profile.serviceTTL;
    sim.despawn(w);
    return false;
  }
  return true;
}

/**
 * Per-walker traversability predicate: a tile is passable when it is road
 * terrain AND the walker's profile may traverse its road type (roadblock
 * policies honored for service_roadblock tiles).
 */
function traversableFor(sim: SimInternals, profile: WalkerProfile): (x: number, y: number) => boolean {
  return (x: number, y: number): boolean =>
    sim.map.get(x, y) === 'road' && mayTraverse(profile, sim.map.roadTypeAt(x, y) ?? 'dirt');
}

/**
 * Advance the walker a fraction of a tile toward its next tile. Movement is
 * sub-tile (profile.movementSpeed per tick): the walker crosses a tile
 * boundary only once `progress` reaches 1, so the renderer can interpolate
 * smoothly between (x, y) and `next` instead of teleporting tile to tile.
 */
function move(sim: SimInternals, w: WalkerInstance, profile: WalkerProfile): void {
  const returning = profile.returnPolicy && profile.category === 'wandering';

  // Choose a destination tile when the walker has none pending.
  if (w.next === null) {
    if (w.state === 'seeking' && w.path.length > 0) {
      w.next = w.path[0];
    } else {
      // Wandering: pick a road neighbor via the seeded RNG, restricted to tiles
      // the walker's profile permits. Stuck on a dead end (no road neighbor)
      // means standing still until the lifetime ends.
      let neighbors = roadNeighbors(sim.map, w.x, w.y).filter((nb) => traversableFor(sim, profile)(nb.x, nb.y));
      if (neighbors.length === 0) return;
      // Return-policy wandering: when the walker has walked maxRoadSteps from
      // its origin, choose the next step from neighbors that reduce Manhattan
      // distance home (tie-broken by the seeded RNG).
      if (returning && w.origin && w.stepsTaken >= profile.maxRoadSteps) {
        const origin = w.origin;
        const homeward = neighbors.filter(
          (nb) => manhattan(nb.x, nb.y, origin.x, origin.y) < manhattan(w.x, w.y, origin.x, origin.y),
        );
        if (homeward.length > 0) neighbors = homeward;
      }
      w.next = neighbors[randInt(sim.rng, 0, neighbors.length - 1)];
    }
  }

  // Speed is per-tick progress scaled by the profile's base movement speed and
  // the current tile's road-type multiplier (bare 'road' reads as dirt = 1x).
  // A service_roadblock's 0 multiplier means "blocked"; a walker permitted to
  // pass one (roadblock policy 'pass') crosses it at base speed instead.
  const rt = sim.map.roadTypeAt(w.x, w.y) ?? 'dirt';
  // A service_roadblock's 0 multiplier bars *entry* for non-'pass' walkers, not
  // *exit*. A walker already standing on one (spawned there, or a block paved
  // under it at runtime) must still be able to leave at base speed — a 0
  // multiplier would otherwise freeze it with progress stuck at 0 forever
  // (WR-02). Non-'pass' walkers never *select* a block as their next tile
  // (traversableFor/findRoadPath bar it), so base speed on a block only ever
  // means leaving it.
  const speed = rt === 'service_roadblock' ? 1 : roadSpeedMultiplier(rt);
  w.progress += profile.movementSpeed * speed;
  if (w.progress >= 1 && w.next) {
    w.progress -= 1;
    w.x = w.next.x;
    w.y = w.next.y;
    w.next = null;
    if (returning && w.origin) {
      if (w.x === w.origin.x && w.y === w.origin.y) w.stepsTaken = 0;
      else w.stepsTaken += 1;
    }
    if (w.state === 'seeking' && w.path.length > 0) w.path.shift();
  }
}

function nearestHouseNeeding(sim: SimInternals, w: WalkerInstance, service: 'food' | 'water'): BuildingInstance | null {
  let best: BuildingInstance | null = null;
  let bestDist = Infinity;
  for (const b of sim.buildings) {
    if (!b.house) continue;
    if (service === 'food' && b.house.foodCooldown > 0) continue;
    if (service === 'water' && b.house.waterCooldown > 0) continue;
    const d = manhattan(w.x, w.y, b.x, b.y);
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best;
}

function nearestGranaryWithWheat(sim: SimInternals, w: WalkerInstance): BuildingInstance | null {
  let best: BuildingInstance | null = null;
  let bestDist = Infinity;
  for (const b of sim.buildings) {
    if (b.type !== 'granary') continue;
    if ((b.stock.wheat ?? 0) <= 0) continue;
    const d = manhattan(w.x, w.y, b.x, b.y);
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best;
}

function nearestBuildingNeedingLabor(sim: SimInternals, w: WalkerInstance): BuildingInstance | null {
  let best: BuildingInstance | null = null;
  let bestDist = Infinity;
  for (const b of sim.buildings) {
    if (b.workersRequired <= 0) continue;
    // Reachability is durable; only buildings not yet connected need a labor walker.
    if (b.laborConnected) continue;
    const d = manhattan(w.x, w.y, b.x, b.y);
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best;
}

function manhattan(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}
