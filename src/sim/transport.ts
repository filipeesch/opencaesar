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
