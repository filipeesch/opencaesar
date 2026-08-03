import { describe, it, expect } from 'vitest';
import {
  defaultWarehousePolicy, warehouseAccepts, CommercialCenter, ReservationPool, nextPickPriority,
} from '../../src/sim/logistics';

describe('warehouse orders & slots (task 5.4)', () => {
  it('accepts within slot capacity by default and refuses at capacity', () => {
    const p = defaultWarehousePolicy(16);
    expect(warehouseAccepts(p, 'pottery', 0)).toBe(true);
    expect(warehouseAccepts(p, 'pottery', 16)).toBe(false);
  });

  it('refuse and empty orders block a commodity', () => {
    const p = defaultWarehousePolicy(16);
    p.perCommodity.clay = 'refuse';
    expect(warehouseAccepts(p, 'clay', 0)).toBe(false);
    p.perCommodity.clay = 'empty';
    expect(warehouseAccepts(p, 'clay', 0)).toBe(false);
    p.perCommodity.clay = 'request';
    expect(warehouseAccepts(p, 'clay', 0)).toBe(true);
  });
});

describe('commercial center (task 5.5)', () => {
  it('allows a single designation and warns on fallback', () => {
    const cc = new CommercialCenter();
    expect(cc.designate('wh1').ok).toBe(true);
    expect(cc.isDesignated('wh1')).toBe(true);
    const second = cc.designate('wh2');
    expect(second.fallback).toBe(true);
    expect(second.warning).toBeTruthy();
    expect(cc.isDesignated('wh2')).toBe(false);
  });
});

describe('market reservation (task 3.5)', () => {
  it('does not allow double-picking a reserved load', () => {
    const pool = new ReservationPool();
    pool.taxable.set('wheat', 1);
    expect(pool.reserve('wheat')).toBe(true);
    expect(pool.reserve('wheat')).toBe(false); // already reserved — 0 available
    pool.release('wheat');
    expect(pool.reserve('wheat')).toBe(true); // now available again
  });
});

describe('distribution priority (task 3.5)', () => {
  it('fetches essential food before the evolution-blocking good', () => {
    expect(nextPickPriority(['wheat', 'fish'], 'pottery', { wheat: 0, fish: 5 })).toBe('wheat');
    expect(nextPickPriority(['wheat', 'fish'], 'pottery', { wheat: 5, fish: 5 })).toBe('pottery');
  });
});
