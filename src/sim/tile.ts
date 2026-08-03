/**
 * Expanded per-tile simulation state (CORE-03).
 *
 * This is a side-channel to the terrain `TileType` grid: the terrain array
 * remains the authority for placement/pathfinding/rendering (so those systems
 * are unaffected), while this bag exposes the richer fields the full spec calls
 * for. All fields default to "neutral" so reading them is always safe.
 */
export interface TileState {
  elevation: number;
  fertility: number;
  resourceType: string | null;
  resourceAmount: number;
  waterDepth: number;
  aqueduct: boolean;
  road: boolean;
  desirability: number;
  fireRisk: number;
  collapseRisk: number;
  pollution: number;
  traffic: number;
  serviceCoverage: number;
  ownership: 'none' | 'residential' | 'commercial' | 'industrial' | 'civic';
  blocked: boolean;
}

export function defaultTileState(): TileState {
  return {
    elevation: 0,
    fertility: 0,
    resourceType: null,
    resourceAmount: 0,
    waterDepth: 0,
    aqueduct: false,
    road: false,
    desirability: 0,
    fireRisk: 0,
    collapseRisk: 0,
    pollution: 0,
    traffic: 0,
    serviceCoverage: 0,
    ownership: 'none',
    blocked: false,
  };
}
