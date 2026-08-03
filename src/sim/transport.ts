/**
 * Trade transport (Section 6 — tasks 6.3, 6.4).
 *
 * Land caravans carry up to 8 loads and require a road to travel; merchant
 * ships carry up to 16 loads via a commercial wharf with a berth queue, and
 * cannot pass under low bridges. A shared port/entrepot buffers goods on
 * arrival. Self-contained, additive.
 */
export const CARAVAN_CAPACITY = 8;
export const SHIP_CAPACITY = 16;

export type TransportStatus = 'idle' | 'travelling' | 'waiting' | 'arrived';

export interface LandCaravan {
  id: string;
  capacity: number;
  loads: number;
  status: TransportStatus;
}

export function createCaravan(id: string, capacity = CARAVAN_CAPACITY): LandCaravan {
  return { id, capacity, loads: 0, status: 'idle' };
}

/** Caravans require a road to travel; otherwise they wait at the entrance. */
export function caravanStep(c: LandCaravan, hasRoad: boolean): void {
  if (c.status === 'idle') {
    c.status = hasRoad ? 'travelling' : 'waiting';
    return;
  }
  if (c.status === 'travelling') {
    c.status = 'arrived';
  }
}

export interface Berth {
  id: string;
  berths: number;
  inUse: number;
}

export interface MerchantShip {
  id: string;
  capacity: number;
  loads: number;
  /** True when the route passes a low bridge the ship cannot fit under. */
  blockedByLowBridge: boolean;
  waiting: boolean;
}

export function createShip(id: string, capacity = SHIP_CAPACITY): MerchantShip {
  return { id, capacity, loads: 0, blockedByLowBridge: false, waiting: false };
}

/** A ship needs a free berth at the wharf; it queues when all berths are busy. */
export function shipDocks(ship: MerchantShip, berth: Berth): boolean {
  if (ship.blockedByLowBridge) {
    ship.waiting = true;
    return false;
  }
  if (berth.inUse >= berth.berths) {
    ship.waiting = true;
    return false;
  }
  berth.inUse += 1;
  ship.waiting = false;
  return true;
}

export interface Entrepot {
  capacity: number;
  stored: number;
}

export function entrepotReceive(e: Entrepot, amount: number): number {
  const accepted = Math.min(amount, e.capacity - e.stored);
  e.stored += accepted;
  return accepted;
}

/**
 * === Physical-load state machine (spec §25) ===
 *
 * Every food load passes through a strict lifecycle. Invalid transitions raise
 * a development error (fail loud in tests); cancellation returns the product to
 * its source stock instead of letting it vanish (§33-22). Deterministic.
 */

export type LoadState =
  | 'CREATED'
  | 'AVAILABLE'
  | 'RESERVED'
  | 'ASSIGNED'
  | 'PICKING_UP'
  | 'IN_TRANSIT'
  | 'WAITING_TO_UNLOAD'
  | 'DELIVERED'
  | 'CONSUMED'
  | 'EXPORTED'
  | 'SPOILED'
  | 'CANCELLED'
  | 'LOST';

export interface FoodLoad {
  id: string;
  commodity: string;
  units: number;
  state: LoadState;
  origin: string;
  destination: string | null;
  /** Places a load has been stored at on this trip (ping-pong detection, §24.4). */
  lastLocations: string[];
  lastTransferReason: string | null;
  lastTransferTimestamp: number;
}

export function createFoodLoad(id: string, commodity: string, units: number, origin: string, at = 0): FoodLoad {
  return {
    id,
    commodity,
    units,
    state: 'CREATED',
    origin,
    destination: null,
    lastLocations: [origin],
    lastTransferReason: null,
    lastTransferTimestamp: at,
  };
}

/** Allowed single transitions (missing edge => invalid). */
const LOAD_EDGES: Partial<Record<LoadState, LoadState[]>> = {
  CREATED: ['AVAILABLE', 'CANCELLED'],
  AVAILABLE: ['RESERVED', 'CANCELLED', 'SPOILED'],
  RESERVED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['PICKING_UP', 'CANCELLED'],
  PICKING_UP: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['WAITING_TO_UNLOAD', 'DELIVERED', 'CANCELLED', 'LOST'],
  WAITING_TO_UNLOAD: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['AVAILABLE', 'CONSUMED', 'EXPORTED', 'SPOILED', 'CANCELLED'],
  CONSUMED: [],
  EXPORTED: [],
  SPOILED: [],
  CANCELLED: [],
  LOST: [],
};

/** Transition a load; throws on an invalid (unlisted) transition. */
export function transitionLoad(load: FoodLoad, next: LoadState, at = 0, reason?: string): LoadState {
  const allowed = LOAD_EDGES[load.state] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`invalid load transition ${load.state} -> ${next} for load ${load.id}`);
  }
  load.state = next;
  load.lastTransferTimestamp = at;
  if (reason !== undefined) load.lastTransferReason = reason;
  return next;
}

/**
 * Cancel a load that cannot complete (collector vanished, route removed, refused
 * mid-transit). The product is returned to the named source stock slot so it is
 * never lost — callers apply `units` back onto `source.units` (spec §25).
 */
export function cancelLoad(load: FoodLoad, reason: string, at = 0): void {
  transitionLoad(load, 'CANCELLED', at, reason);
}

