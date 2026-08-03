import { describe, it, expect } from 'vitest';
import {
  CARAVAN_CAPACITY, SHIP_CAPACITY, createCaravan, caravanStep, createShip, shipDocks, entrepotReceive,
} from '../../src/sim/transport';
import {
  createFoodLoad, transitionLoad, cancelLoad,
} from '../../src/sim/transport';

describe('land caravans (task 6.3)', () => {
  it('ships carry 8 loads max and require a road to travel', () => {
    expect(CARAVAN_CAPACITY).toBe(8);
    const c = createCaravan('c1');
    caravanStep(c, false);
    expect(c.status).toBe('waiting');
    const c2 = createCaravan('c2');
    caravanStep(c2, true);
    expect(c2.status).toBe('travelling');
    caravanStep(c2, true);
    expect(c2.status).toBe('arrived');
  });
});

describe('merchant ships & wharf (task 6.4)', () => {
  it('carries 16 loads and queues at the wharf when berths are full', () => {
    expect(SHIP_CAPACITY).toBe(16);
    const ship = createShip('s1');
    const berth = { id: 'wharf', berths: 1, inUse: 0 };
    expect(shipDocks(ship, berth)).toBe(true);
    expect(shipDocks(ship, berth)).toBe(false); // second ship queues — berth full
  });

  it('cannot pass under a low bridge', () => {
    const ship = createShip('s2');
    ship.blockedByLowBridge = true;
    const berth = { id: 'wharf', berths: 2, inUse: 0 };
    expect(shipDocks(ship, berth)).toBe(false);
    expect(ship.waiting).toBe(true);
  });
});

describe('entrepot (task 6.3/6.4)', () => {
  it('buffers goods up to capacity', () => {
    const e = { capacity: 10, stored: 0 };
    expect(entrepotReceive(e, 6)).toBe(6);
    expect(entrepotReceive(e, 10)).toBe(4); // only 4 fit
    expect(e.stored).toBe(10);
  });
});

describe('physical-load state machine (AGRI-02, spec §25)', () => {
  it('walks the full lifecycle CREATED → AVAILABLE → RESERVED → ASSIGNED → PICKING_UP → IN_TRANSIT → DELIVERED → CONSUMED', () => {
    const load = createFoodLoad('l1', 'wheat', 100, 'farm-1');
    expect(load.state).toBe('CREATED');
    transitionLoad(load, 'AVAILABLE');
    transitionLoad(load, 'RESERVED', 5);
    transitionLoad(load, 'ASSIGNED', 6);
    transitionLoad(load, 'PICKING_UP', 7);
    transitionLoad(load, 'IN_TRANSIT', 8);
    transitionLoad(load, 'DELIVERED', 20);
    transitionLoad(load, 'CONSUMED', 40);
    expect(load.state).toBe('CONSUMED');
  });

  it('raises a development error on an invalid transition', () => {
    const load = createFoodLoad('l2', 'fish', 50, 'wharf-1');
    transitionLoad(load, 'AVAILABLE');
    expect(() => transitionLoad(load, 'IN_TRANSIT')).toThrow(/invalid load transition AVAILABLE -> IN_TRANSIT/);
  });

  it('cancellation returns the product to the source — nothing disappears without a cause', () => {
    const load = createFoodLoad('l3', 'meat', 80, 'farm-3');
    transitionLoad(load, 'AVAILABLE');
    transitionLoad(load, 'RESERVED', 10);
    cancelLoad(load, 'no road to destination', 15);
    expect(load.state).toBe('CANCELLED');
    expect(load.lastTransferReason).toBe('no road to destination');
    // the 80 units survive on the load for the caller to fold back into source stock
    expect(load.units).toBe(80);
    expect(load.origin).toBe('farm-3');
  });

  it('tracking last locations enables ping-pong detection (spec §24.4)', () => {
    const load = createFoodLoad('l4', 'wheat', 100, 'granary-A');
    load.lastLocations.push('granary-B', 'granary-A');
    expect(load.lastLocations).toEqual(['granary-A', 'granary-B', 'granary-A']);
  });
});
