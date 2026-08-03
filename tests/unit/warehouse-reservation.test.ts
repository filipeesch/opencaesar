/**
 * Phase 7, WARE-01 (decision 5): ReservationPool tick-based expiry is
 * deterministic — released by an expiry deadline computed from an injected tick
 * `now` and a constant `expiresIn`, never a wall clock. Same (now, expiresIn)
 * inputs are guaranteed to produce identical outcomes across pools.
 *
 * Expiry is tracked per reservation entry, so each reserveWithExpiry expires at
 * its own deadline (a later call never extends an earlier one) and plain
 * reserve() entries are never released by expireReservations.
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

describe('per-entry expiry contract (WR-01 / WR-02)', () => {
  it('a mix of plain reserve + reserveWithExpiry releases only the entries whose deadline passed (WR-01)', () => {
    const pool = new ReservationPool();
    pool.taxable.set('wheat', 10);
    expect(pool.reserve('wheat', 2)).toBe(true); // plain — never expires
    expect(pool.reserveWithExpiry('wheat', 3, 10, 30)).toBe(true); // expires 40
    expect(pool.reserveWithExpiry('wheat', 1, 20, 5)).toBe(true); // expires 25
    expect(pool.reserved('wheat')).toBe(6);
    expect(pool.available('wheat')).toBe(4);

    // tick 25: only the 1-unit entry (20+5) has reached its deadline
    expect(pool.expireReservations(25)).toBe(1);
    expect(pool.reserved('wheat')).toBe(5);
    expect(pool.available('wheat')).toBe(5);

    // tick 40: the 3-unit entry (10+30) expires; the plain 2 units stay
    expect(pool.expireReservations(40)).toBe(1);
    expect(pool.reserved('wheat')).toBe(2); // plain reserve untouched
    expect(pool.available('wheat')).toBe(8);

    // a far-future expiry sweep still never releases the plain reserve
    expect(pool.expireReservations(100000)).toBe(0);
    expect(pool.reserved('wheat')).toBe(2);
    expect(pool.available('wheat')).toBe(8);
  });

  it('a second reserveWithExpiry does not extend the first entry\'s deadline (WR-02)', () => {
    const pool = new ReservationPool();
    pool.taxable.set('wheat', 10);
    expect(pool.reserveWithExpiry('wheat', 2, 10, 30)).toBe(true); // expires 40
    expect(pool.reserveWithExpiry('wheat', 1, 15, 30)).toBe(true); // expires 45
    expect(pool.reserved('wheat')).toBe(3);
    expect(pool.available('wheat')).toBe(7);

    // at tick 40 only the first entry (2 units) is released, not all 3
    expect(pool.expireReservations(40)).toBe(1);
    expect(pool.reserved('wheat')).toBe(1);
    expect(pool.available('wheat')).toBe(9);

    // at tick 45 the second entry releases independently
    expect(pool.expireReservations(45)).toBe(1);
    expect(pool.reserved('wheat')).toBe(0);
    expect(pool.available('wheat')).toBe(10);
  });
});
