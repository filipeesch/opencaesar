/**
 * Phase 7, WARE-01 (decision 5): ReservationPool tick-based expiry is
 * deterministic — released by an expiry deadline computed from an injected tick
 * `now` and a constant `expiresIn`, never a wall clock. Same (now, expiresIn)
 * inputs are guaranteed to produce identical outcomes across pools.
 */
import { describe, it, expect } from 'vitest';
import { ReservationPool } from '../../src/sim/logistics';

describe('reservation pool expiry is deterministic (decision 5)', () => {
  it('reserveWithExpiry backs the amount out of availability immediately like plain reserve', () => {
    const pool = new ReservationPool();
    pool.taxable.set('wheat', 5);
    expect(pool.available('wheat')).toBe(5);
    expect(pool.reserveWithExpiry('wheat', 2, 10, 30)).toBe(true);
    expect(pool.reserved('wheat')).toBe(2);
    expect(pool.available('wheat')).toBe(3);
  });

  it('an unexpired reservation still holds — nothing is released before its deadline', () => {
    const pool = new ReservationPool();
    pool.taxable.set('wheat', 5);
    pool.reserveWithExpiry('wheat', 2, 10, 30); // expires at tick 40
    expect(pool.expireReservations(39)).toBe(0);
    expect(pool.reserved('wheat')).toBe(2);
    expect(pool.available('wheat')).toBe(3);
  });

  it('at the expiry tick the reserved units return to availability and can be re-reserved', () => {
    const pool = new ReservationPool();
    pool.taxable.set('wheat', 5);
    pool.reserveWithExpiry('wheat', 2, 10, 30); // expires at tick 40
    expect(pool.expireReservations(40)).toBe(1);
    expect(pool.reserved('wheat')).toBe(0);
    expect(pool.available('wheat')).toBe(5);
    expect(pool.reserve('wheat', 1)).toBe(true);
    expect(pool.available('wheat')).toBe(4);
  });

  it('identical (now, expiresIn) inputs produce identical outcomes across pools', () => {
    const build = () => {
      const p = new ReservationPool();
      p.taxable.set('wheat', 8);
      p.reserveWithExpiry('wheat', 3, 10, 30);
      p.taxable.set('pottery', 6);
      p.reserveWithExpiry('pottery', 4, 20, 10);
      return p;
    };
    const a = build();
    const b = build();
    // both expire the same set at the same sampled ticks
    expect(a.expireReservations(30)).toBe(1); // pottery (20+10) expired, wheat (40) not
    expect(b.expireReservations(30)).toBe(1);
    expect({ wheat: a.available('wheat'), pottery: a.available('pottery') }).toEqual(
      { wheat: b.available('wheat'), pottery: b.available('pottery') },
    );
    expect(a.expireReservations(40)).toBe(1); // wheat now expired
    expect(b.expireReservations(40)).toBe(1);
    expect(a.available('wheat')).toBe(8);
    expect(b.available('wheat')).toBe(8);
  });

  it('plain reserve() is unaffected — it never writes the expiry ledger and never expires', () => {
    const pool = new ReservationPool();
    pool.taxable.set('wheat', 5);
    expect(pool.reserve('wheat', 2)).toBe(true);
    expect(pool.reserved('wheat')).toBe(2);
    expect(pool.expireReservations(100000)).toBe(0); // no expiry entries
    expect(pool.reserved('wheat')).toBe(2); // plain reserve still held
    expect(pool.available('wheat')).toBe(3);
  });
});

describe('over-reservation guard (WR-03)', () => {
  it('requesting more than available returns false and never over-reserves', () => {
    const pool = new ReservationPool();
    pool.taxable.set('wheat', 3);
    expect(pool.reserve('wheat', 5)).toBe(false);
    expect(pool.reserved('wheat')).toBe(0);
    expect(pool.available('wheat')).toBe(3);

    expect(pool.reserve('wheat', 3)).toBe(true);
    expect(pool.available('wheat')).toBe(0);
    // an amount that exceeds the now-exhausted remainder also fails
    expect(pool.reserve('wheat', 1)).toBe(false);
    expect(pool.reserved('wheat')).toBe(3);
    expect(pool.available('wheat')).toBe(0);
  });

  it('reserveWithExpiry inherits the no-over-reserve guard', () => {
    const pool = new ReservationPool();
    pool.taxable.set('wheat', 3);
    expect(pool.reserveWithExpiry('wheat', 5, 10, 30)).toBe(false);
    expect(pool.reserved('wheat')).toBe(0);
    expect(pool.available('wheat')).toBe(3);
    expect(pool.expireReservations(100000)).toBe(0); // nothing recorded

    expect(pool.reserveWithExpiry('wheat', 3, 10, 30)).toBe(true);
    expect(pool.reserved('wheat')).toBe(3);
    expect(pool.available('wheat')).toBe(0);
    expect(pool.expireReservations(40)).toBe(1);
    expect(pool.reserved('wheat')).toBe(0);
    expect(pool.available('wheat')).toBe(3);
  });
});
