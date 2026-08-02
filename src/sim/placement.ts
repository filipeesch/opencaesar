/**
 * Building placement validation. Pure and side-effect free: the caller
 * (SimRunner) commits the placement only after this returns ok.
 *
 * Check order (cheapest first): type → bounds → occupancy → terrain →
 * road access → affordability.
 */

import { BUILDINGS } from './buildings';
import type { Map } from './map';
import type { BuildingType, PlacementResult } from './types';

/**
 * Validate placing `type` at footprint anchor (x, y).
 * `isOccupied` must return true for any tile already claimed by a building.
 */
export function checkPlacement(
  map: Map,
  isOccupied: (x: number, y: number) => boolean,
  treasury: number,
  type: BuildingType,
  x: number,
  y: number,
): PlacementResult {
  const def = BUILDINGS[type];
  if (!def) return { ok: false, error: 'invalid-type' };

  const n = def.footprint;

  if (x < 0 || y < 0 || x + n > map.width || y + n > map.height) {
    return { ok: false, error: 'out-of-bounds' };
  }

  for (let dy = 0; dy < n; dy++) {
    for (let dx = 0; dx < n; dx++) {
      if (isOccupied(x + dx, y + dy)) return { ok: false, error: 'occupied' };
    }
  }

  let matching = 0;
  for (let dy = 0; dy < n; dy++) {
    for (let dx = 0; dx < n; dx++) {
      const t = map.get(x + dx, y + dy);
      if (t === 'out-of-bounds') return { ok: false, error: 'out-of-bounds' };
      if (!def.allowedTerrains.includes(t)) return { ok: false, error: 'terrain' };
      if (def.requiredTerrain !== undefined && t === def.requiredTerrain) matching++;
    }
  }
  // Every footprint tile must be the required terrain unless a minimum count
  // is specified (e.g. farm needs at least 2 fertile tiles, rest buildable).
  const need = def.minRequiredTiles ?? (def.requiredTerrain !== undefined ? n * n : 0);
  if (matching < need) return { ok: false, error: 'terrain' };

  if (def.requiresRoad && !hasRoadEdge(map, x, y, n)) {
    return { ok: false, error: 'road-access' };
  }

  if (treasury < def.cost) return { ok: false, error: 'not-enough-money' };

  return { ok: true };
}

/** True when at least one footprint edge touches a road tile. */
function hasRoadEdge(map: Map, x: number, y: number, n: number): boolean {
  for (let i = 0; i < n; i++) {
    if (map.get(x + i, y - 1) === 'road') return true;
    if (map.get(x + i, y + n) === 'road') return true;
    if (map.get(x - 1, y + i) === 'road') return true;
    if (map.get(x + n, y + i) === 'road') return true;
  }
  return false;
}
