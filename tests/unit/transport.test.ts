import { describe, it, expect } from 'vitest';
import {
  CARAVAN_CAPACITY, SHIP_CAPACITY, createCaravan, caravanStep, createShip, shipDocks, entrepotReceive,
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
