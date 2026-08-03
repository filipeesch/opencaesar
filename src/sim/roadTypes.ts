/**
 * Road types (ROAD-02 / task 1.7).
 *
 * Each road type has a movement speed multiplier and a desirability effect,
 * so paving decisions matter for both travel and house desirability. Types are
 * data-driven and additive — the existing 'road' terrain remains the default
 * (dirt) road.
 */
export type RoadType =
  | 'dirt'
  | 'paved'
  | 'plaza'
  | 'bridge'
  | 'service_roadblock'
  | 'wharf_access'
  | 'stairs';

export interface RoadTypeDef {
  id: RoadType;
  name: string;
  /** Movement speed multiplier relative to dirt (1 = baseline). */
  speedMultiplier: number;
  /** Desirability contribution to adjacent houses. */
  desirability: number;
  /** Whether walkers may pass over this road type. */
  passable: boolean;
}

export const ROAD_TYPES: Record<RoadType, RoadTypeDef> = {
  dirt: { id: 'dirt', name: 'Dirt Road', speedMultiplier: 1, desirability: 0, passable: true },
  paved: { id: 'paved', name: 'Paved Road', speedMultiplier: 1.25, desirability: 1, passable: true },
  plaza: { id: 'plaza', name: 'Plaza', speedMultiplier: 1.1, desirability: 4, passable: true },
  bridge: { id: 'bridge', name: 'Bridge', speedMultiplier: 1, desirability: 0, passable: true },
  service_roadblock: { id: 'service_roadblock', name: 'Service Roadblock', speedMultiplier: 0, desirability: 0, passable: false },
  wharf_access: { id: 'wharf_access', name: 'Wharf Access', speedMultiplier: 1, desirability: 0, passable: true },
  stairs: { id: 'stairs', name: 'Stairs', speedMultiplier: 0.8, desirability: 0, passable: true },
};

export function roadTypeName(id: RoadType | string): string {
  return ROAD_TYPES[id as RoadType]?.name ?? 'Road';
}

export function roadSpeedMultiplier(id: RoadType | string): number {
  return ROAD_TYPES[id as RoadType]?.speedMultiplier ?? 1;
}

export function roadDesirability(id: RoadType | string): number {
  return ROAD_TYPES[id as RoadType]?.desirability ?? 0;
}

export function isRoadPassable(id: RoadType | string): boolean {
  return ROAD_TYPES[id as RoadType]?.passable ?? false;
}
