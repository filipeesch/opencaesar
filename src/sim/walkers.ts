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
import type { BuildingType, Good, Vec2, WalkerType } from './types';

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
}

/** House-only simulation state (undefined on non-house buildings). */
export interface HouseInstance {
  tier: number;
  foodCooldown: number;
  waterCooldown: number;
  laborCooldown: number;
  evolveCounter: number;
  devolveCounter: number;
}

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
  };
}

/** Advance a walker by one tick. May despawn it (via sim.despawn). */
export function updateWalker(sim: SimInternals, w: WalkerInstance): void {
  w.lifetime -= 1;
  if (w.lifetime <= 0) {
    sim.despawn(w);
    return;
  }

  // Coverage first: houses next to the walker receive its service flag.
  applyCoverage(sim, w);

  // Arrival at the objective: apply its effect, possibly despawn.
  if (w.state === 'seeking' && w.targetBuildingId !== null && w.path.length === 0) {
    const keepGoing = handleArrival(sim, w);
    if (!keepGoing) return;
    w.state = 'wandering';
    w.targetBuildingId = null;
  }

  if (w.state === 'wandering') decide(sim, w);

  move(sim, w);
}

/** Apply the walker's service to houses adjacent to its current tile. */
function applyCoverage(sim: SimInternals, w: WalkerInstance): void {
  if (w.type === 'well') {
    serviceHousesAround(sim, w, 'water');
  } else if (w.type === 'market' && w.carryingGood === 'wheat' && w.carriedAmount > 0) {
    serviceHousesAround(sim, w, 'food');
  }
}

function serviceHousesAround(sim: SimInternals, w: WalkerInstance, service: 'food' | 'water'): void {
  for (const d of DIRS) {
    const b = sim.buildingAt(w.x + d.x, w.y + d.y);
    if (b && b.house) {
      if (service === 'food') b.house.foodCooldown = CONFIG.serviceCooldownTicks;
      else b.house.waterCooldown = CONFIG.serviceCooldownTicks;
    }
  }
}

/** Pick a new objective (market: granary/house; labor: building; well: none). */
function decide(sim: SimInternals, w: WalkerInstance): void {
  if (w.type === 'market') decideMarket(sim, w);
  else if (w.type === 'labor') decideLabor(sim, w);
}

function decideMarket(sim: SimInternals, w: WalkerInstance): void {
  if (w.carryingGood === 'wheat' && w.carriedAmount > 0) {
    const house = nearestHouseNeeding(sim, w, 'food');
    if (house) startSeeking(sim, w, house);
    return;
  }
  const granary = nearestGranaryWithWheat(sim, w);
  if (granary) startSeeking(sim, w, granary);
}

function decideLabor(sim: SimInternals, w: WalkerInstance): void {
  const b = nearestBuildingNeedingLabor(sim, w);
  if (b) startSeeking(sim, w, b);
}

/** Turn the walker toward a building. Returns false when unreachable. */
function startSeeking(sim: SimInternals, w: WalkerInstance, target: BuildingInstance): boolean {
  const to = sim.adjacentRoadTile(target);
  if (!to) return false;
  const path = findRoadPath(sim.map, { x: w.x, y: w.y }, to);
  if (path === null) return false;
  // Drop the start tile itself — the walker is already standing on it.
  if (path.length > 0 && path[0].x === w.x && path[0].y === w.y) path.shift();
  w.state = 'seeking';
  w.targetBuildingId = target.id;
  w.path = path;
  return true;
}

/**
 * The walker stands on the goal tile next to its target building.
 * Returns false when the walker despawned and must not continue.
 */
function handleArrival(sim: SimInternals, w: WalkerInstance): boolean {
  const target = sim.buildingById(w.targetBuildingId ?? -1);
  if (!target) return true;

  if (w.type === 'market') {
    if (w.carryingGood === 'wheat' && w.carriedAmount > 0) {
      // Deliver one unit of food to the target house.
      if (target.house) target.house.foodCooldown = CONFIG.serviceCooldownTicks;
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
    target.laborCooldown = CONFIG.serviceCooldownTicks;
    sim.despawn(w);
    return false;
  }
  return true;
}

/**
 * Advance the walker a fraction of a tile toward its next tile. Movement is
 * sub-tile (CONFIG.walkerSpeedPerTick per tick): the walker crosses a tile
 * boundary only once `progress` reaches 1, so the renderer can interpolate
 * smoothly between (x, y) and `next` instead of teleporting tile to tile.
 */
function move(sim: SimInternals, w: WalkerInstance): void {
  // Choose a destination tile when the walker has none pending.
  if (w.next === null) {
    if (w.state === 'seeking' && w.path.length > 0) {
      w.next = w.path[0];
    } else {
      // Wandering: pick a road neighbor via the seeded RNG. Stuck on a dead
      // end (no road neighbor) means standing still until the lifetime ends.
      const neighbors = roadNeighbors(sim.map, w.x, w.y);
      if (neighbors.length === 0) return;
      w.next = neighbors[randInt(sim.rng, 0, neighbors.length - 1)];
    }
  }

  w.progress += CONFIG.walkerSpeedPerTick;
  if (w.progress >= 1 && w.next) {
    w.progress -= 1;
    w.x = w.next.x;
    w.y = w.next.y;
    w.next = null;
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
    if (b.laborCooldown > 0) continue;
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
