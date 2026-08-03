/**
 * Reservation no-double-pick contention tests (MARK-01, decision 1; spec §18.3).
 *
 * Proves a load reserved in transit cannot be double-picked, at three levels:
 * 1. ReservationPool — two buyers contending for one granary's seed never
 *    over-allocate (total reserved never exceeds the seed; a reserve beyond
 *    remaining availability is refused) and tick-based expiry releases exactly
 *    the held amount, idempotently.
 * 2. GranaryModel — a transactional reservation backs units out of `available`
 *    so a second buyer cannot take them; expiry restores availability.
 * 3. Walker decideBuyer semantics — two buyers decrement granary stock at
 *    departure; the total they carry never exceeds the original stock and the
 *    granary never goes negative; a trip that never completes restores the full
 *    reservation (releaseWalkerLoad) so product is never silently destroyed.
 */
import { describe, expect, it } from 'vitest';
import { ReservationPool, GranaryModel } from '../../src/sim/logistics';
import { Map as SimMap } from '../../src/sim/map';
import type { BuildingInstance, SimInternals, WalkerInstance } from '../../src/sim/walkers';
import { createWalker, updateWalker } from '../../src/sim/walkers';
import { mulberry32 } from '../../src/sim/rng';
import type { Vec2 } from '../../src/sim/types';

function loopMap(): SimMap {
  const m = new SimMap(6, 4, 'earth');
  for (let x = 0; x < 6; x++) {
    m.set(x, 0, 'road');
    m.set(x, 3, 'road');
  }
  for (let y = 0; y < 4; y++) {
    m.set(0, y, 'road');
    m.set(5, y, 'road');
  }
  return m;
}

function inside(b: BuildingInstance, x: number, y: number): boolean {
  return x >= b.x && x < b.x + b.footprint && y >= b.y && y < b.y + b.footprint;
}

function roadAround(map: SimMap, b: BuildingInstance): Vec2 | null {
  const n = b.footprint;
  for (let i = 0; i < n; i++) {
    if (map.get(b.x + i, b.y - 1) === 'road') return { x: b.x + i, y: b.y - 1 };
    if (map.get(b.x + i, b.y + n) === 'road') return { x: b.x + i, y: b.y + n };
    if (map.get(b.x - 1, b.y + i) === 'road') return { x: b.x - 1, y: b.y + i };
    if (map.get(b.x + n, b.y + i) === 'road') return { x: b.x + n, y: b.y + i };
  }
  return null;
}

function stubBuilding(partial: Partial<BuildingInstance> & { id: number; type: BuildingInstance['type']; x: number; y: number }): BuildingInstance {
  return {
    footprint: 1,
    workersAssigned: 0,
    workersRequired: 0,
    active: false,
    laborConnected: false,
    laborCooldown: 0,
    spawnCooldown: 0,
    stock: {},
    ...partial,
  };
}

describe('no double-pick: reservation holds during transit (MARK-01 §18.3, decision 1)', () => {
  it('ReservationPool: two buyers contend for one load — total reserved never exceeds the seed', () => {
    const pool = new ReservationPool();
    pool.taxable.set('wheat', 100);
    // Buyer 1 reserves 40 — available drops to 60.
    expect(pool.reserve('wheat', 40)).toBe(true);
    expect(pool.available('wheat')).toBe(60);
    // Buyer 2 can take a second, DISJOINT 40 of the remaining stock (the real
    // guarantee is that the pool never over-allocates: the sum of all buyers'
    // holds never exceeds the seed).
    expect(pool.reserve('wheat', 40)).toBe(true);
    expect(pool.available('wheat')).toBe(20);
    expect(pool.reserved('wheat')).toBe(80); // 40 + 40, never more than 100
    // A third buyer attempting another 40 beyond the remaining 20 is refused.
    expect(pool.reserve('wheat', 40)).toBe(false);
    expect(pool.available('wheat')).toBe(20);
  });

  it('ReservationPool: a second reserve of the same amount fails once the load is exhausted', () => {
    const pool = new ReservationPool();
    pool.taxable.set('wheat', 40);
    expect(pool.reserve('wheat', 40)).toBe(true);
    expect(pool.available('wheat')).toBe(0);
    // The same 40 cannot be double-picked: available is 0.
    expect(pool.reserve('wheat', 40)).toBe(false);
    expect(pool.reserved('wheat')).toBe(40);
  });

  it('ReservationPool: tick-based expiry releases exactly the held amount, idempotently', () => {
    const pool = new ReservationPool();
    pool.taxable.set('wheat', 100);
    expect(pool.reserveWithExpiry('wheat', 40, 0, 30)).toBe(true); // expires at tick 30
    expect(pool.available('wheat')).toBe(60);
    // Still held before the deadline.
    expect(pool.expireReservations(29)).toBe(0);
    expect(pool.available('wheat')).toBe(60);
    // At the deadline exactly the reserved 40 returns to availability.
    expect(pool.expireReservations(30)).toBe(1);
    expect(pool.available('wheat')).toBe(100);
    // A second call releases nothing (idempotent).
    expect(pool.expireReservations(1000)).toBe(0);
    expect(pool.available('wheat')).toBe(100);
  });

  it('GranaryModel: a transactional reservation holds, a second buyer is refused, expiry restores availability', () => {
    const g = new GranaryModel('g-contention');
    g.receive('wheat', 100);
    const r1 = g.reserve('wheat', 60, 'buyer-1', 'walker-1', 10, 30);
    expect(r1).not.toBeNull();
    expect(g.available('wheat')).toBe(40); // 60 backed out — no double-pick
    // A second buyer cannot reserve the same 60 units.
    expect(g.reserve('wheat', 60, 'buyer-2', 'walker-2', 10, 30)).toBeNull();
    expect(g.available('wheat')).toBe(40);
    // Collector never comes: the reservation expires and availability returns to 100.
    g.expireReservations(50);
    expect(r1!.state).toBe('expired');
    expect(g.available('wheat')).toBe(100);
  });

  it('walker decideBuyer semantics: two buyers reading reduced stock never hold more than the granary starts with', () => {
    const map = loopMap();
    const market = stubBuilding({ id: 1, type: 'market', x: 2, y: 1, stock: { wheat: 0 }, workersRequired: 1, workersAssigned: 1 });
    const granary = stubBuilding({ id: 2, type: 'granary', x: 3, y: 1, stock: { wheat: 100 } });
    const despawned: WalkerInstance[] = [];
    const byId = new Map<number, BuildingInstance>([[market.id, market], [granary.id, granary]]);
    const sim: SimInternals = {
      map,
      rng: mulberry32(3),
      buildings: [market, granary],
      buildingById: (id) => byId.get(id) ?? null,
      buildingAt: (x, y) => [market, granary].find((b) => inside(b, x, y)) ?? null,
      adjacentRoadTile: (b) => roadAround(map, b),
      despawn: (w) => {
        despawned.push(w);
      },
      tick: 1,
    };

    // Buyer 1 reserves 40 at departure: granary 100 → 60.
    const buyer1 = createWalker('buyer', 2, 0, 10);
    buyer1.marketId = market.id;
    updateWalker(sim, buyer1);
    expect(buyer1.carriedAmount).toBe(40);
    expect(granary.stock.wheat).toBe(60);

    // Buyer 2's first decide reads the REDUCED stock (60) and can take at most
    // 40 — it never over-reserves: the granary would go to 20, sum carried = 80.
    const buyer2 = createWalker('buyer', 2, 0, 11);
    buyer2.marketId = market.id;
    updateWalker(sim, buyer2);
    expect(buyer2.carriedAmount).toBe(40);
    expect(granary.stock.wheat).toBe(20);
    // The total held by both buyers never exceeds the original 100 and the
    // granary never goes negative.
    expect(buyer1.carriedAmount + buyer2.carriedAmount).toBeLessThanOrEqual(100);
    expect(granary.stock.wheat).toBeGreaterThanOrEqual(0);

    // Both buyers complete their round-trips: nothing is lost or double-picked.
    // Market receives exactly what the two reserved (40 + 40); granary keeps 20.
    for (const b of [buyer1, buyer2]) {
      let guard = 0;
      while (!despawned.includes(b) && guard++ < 300) updateWalker(sim, b);
    }
    expect(market.stock.wheat).toBe(80);
    expect(granary.stock.wheat).toBe(20);
    expect((market.stock.wheat ?? 0) + (granary.stock.wheat ?? 0)).toBe(100);
  });

  it('walker restore-on-failure: a never-completing buyer returns its reservation to the granary (releaseWalkerLoad)', () => {
    const map = loopMap();
    const market = stubBuilding({ id: 1, type: 'market', x: 2, y: 1, stock: { wheat: 0 }, workersRequired: 1, workersAssigned: 1 });
    const granary = stubBuilding({ id: 2, type: 'granary', x: 3, y: 1, stock: { wheat: 100 } });
    const despawned: WalkerInstance[] = [];
    const byId = new Map<number, BuildingInstance>([[market.id, market], [granary.id, granary]]);
    const sim: SimInternals = {
      map,
      rng: mulberry32(3),
      buildings: [market, granary],
      buildingById: (id) => byId.get(id) ?? null,
      buildingAt: (x, y) => [market, granary].find((b) => inside(b, x, y)) ?? null,
      adjacentRoadTile: (b) => roadAround(map, b),
      despawn: (w) => {
        despawned.push(w);
      },
      tick: 1,
    };

    const buyer = createWalker('buyer', 2, 0, 20);
    buyer.marketId = market.id;
    updateWalker(sim, buyer); // reserves 40 — granary 60
    expect(granary.stock.wheat).toBe(60);
    // The buyer's trip fails: its market disappears, so the return leg cannot
    // resolve → releaseWalkerLoad restores the reservation (never lost).
    buyer.marketId = 999;
    sim.buildings = [granary];
    let guard = 0;
    while (!despawned.includes(buyer) && guard++ < 300) updateWalker(sim, buyer);
    expect(granary.stock.wheat).toBe(100); // restored exactly
    expect(despawned).toContain(buyer);
  });
});
