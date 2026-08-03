/**
 * Per-market configuration behavior matrix (MARK-02, decision 3; spec §18.5/§12.14).
 *
 * Locks the pre-drafted market config model in src/sim/logistics.ts:
 * MarketConfig / defaultMarketConfig / marketAccepts / findSupplier. This file
 * is test-only — no source is modified — it asserts the documented per-config
 * behaviors: per-product accept/refuse with resident-class interplay
 * (wine-for-plebeians blocked by default, unblocked by toggle), per-product
 * independence, and findSupplier nearest-within-radius selection plus its
 * radius boundary (nothing beyond the radius, no non-holding supplier).
 */
import { describe, expect, it } from 'vitest';
import {
  defaultMarketConfig, marketAccepts, findSupplier,
} from '../../src/sim/logistics';
import type { MarketSupplier } from '../../src/sim/logistics';

describe('defaultMarketConfig (MARK-02 §18.5/§12.14, decision 3)', () => {
  it('yields the documented defaults: no rules, target 20, radius 2, wine blocked, no preferred supplier', () => {
    const cfg = defaultMarketConfig();
    expect(cfg.productRules).toEqual({});
    expect(cfg.targetStock).toBe(20);
    expect(cfg.buyerRadius).toBe(2);
    expect(cfg.blockWineForPlebeians).toBe(true);
    expect(cfg.preferredSupplier).toBeNull();
  });
});

describe('marketAccepts per-product accept/refuse with resident-class interplay (MARK-02, decision 3)', () => {
  it('accepts wheat/vegetables/pottery for both plebeian and patrician by default', () => {
    const cfg = defaultMarketConfig();
    for (const cls of ['plebeian', 'patrician']) {
      expect(marketAccepts(cfg, 'wheat', cls)).toBe(true);
      expect(marketAccepts(cfg, 'vegetables', cls)).toBe(true);
      expect(marketAccepts(cfg, 'pottery', cls)).toBe(true);
    }
  });

  it('refuses wine for plebeian while accepting it for patrician by default', () => {
    const cfg = defaultMarketConfig();
    expect(marketAccepts(cfg, 'wine', 'plebeian')).toBe(false);
    expect(marketAccepts(cfg, 'wine', 'patrician')).toBe(true);
  });

  it('unblocking wine for plebeians (blockWineForPlebeians = false) accepts it', () => {
    const cfg = defaultMarketConfig();
    cfg.blockWineForPlebeians = false;
    expect(marketAccepts(cfg, 'wine', 'plebeian')).toBe(true);
  });

  it('a productRules refuse refuses that product for both classes while leaving others accepted', () => {
    const cfg = defaultMarketConfig();
    cfg.productRules.wheat = 'refuse';
    expect(marketAccepts(cfg, 'wheat', 'plebeian')).toBe(false);
    expect(marketAccepts(cfg, 'wheat', 'patrician')).toBe(false);
    // Other products are unaffected.
    expect(marketAccepts(cfg, 'vegetables', 'plebeian')).toBe(true);
    expect(marketAccepts(cfg, 'vegetables', 'patrician')).toBe(true);
  });

  it('is per-product independent — refusing one product does not affect another', () => {
    const cfg = defaultMarketConfig();
    cfg.productRules.wheat = 'refuse';
    expect(marketAccepts(cfg, 'wheat', 'plebeian')).toBe(false);
    for (const p of ['vegetables', 'fruit', 'meat', 'fish', 'pottery', 'wine']) {
      const expected = p === 'wine' ? false : true; // wine still blocked for plebeians
      expect(marketAccepts(cfg, p, 'plebeian')).toBe(expected);
    }
  });
});

describe('findSupplier nearest-within-radius selection (MARK-01 §18.3, MARK-02 buyer radius)', () => {
  const wheatHolder = (id: string, x: number, y: number): MarketSupplier => ({
    id, x, y, hasProduct: (p: string) => p === 'wheat',
  });
  const noHolder = (id: string, x: number, y: number): MarketSupplier => ({
    id, x, y, hasProduct: () => false,
  });

  it('returns the nearest product-holding supplier within radius (near wins over far)', () => {
    const suppliers = [
      wheatHolder('far', 8, 8),
      wheatHolder('near', 3, 3),
      noHolder('closer', 2, 2), // nearest but does not hold the product
    ];
    const found = findSupplier(suppliers, 5, 5, 'wheat', 5);
    expect(found?.id).toBe('near');
  });

  it('returns null when the only holder is beyond the given radius', () => {
    const suppliers = [wheatHolder('beyond', 8, 8)];
    const found = findSupplier(suppliers, 5, 5, 'wheat', 2);
    expect(found).toBeNull();
  });

  it('returns null when no supplier holds the product at all', () => {
    const suppliers = [noHolder('a', 3, 3), noHolder('b', 4, 4)];
    const found = findSupplier(suppliers, 5, 5, 'wheat', 5);
    expect(found).toBeNull();
  });

  it('never selects a supplier that does not hold the product, even when it is nearest', () => {
    const suppliers = [
      noHolder('nearest-non-holder', 4, 4),
      wheatHolder('slightly-farther', 6, 6),
    ];
    const found = findSupplier(suppliers, 5, 5, 'wheat', 5);
    expect(found?.id).toBe('slightly-farther');
  });

  it('a holder exactly at the radius boundary is chosen; one unit beyond is not', () => {
    const onBoundary = [wheatHolder('at-edge', 7, 5)]; // manhattan 2 from (5,5), radius 2
    expect(findSupplier(onBoundary, 5, 5, 'wheat', 2)?.id).toBe('at-edge');
    const justBeyond = [wheatHolder('past-edge', 8, 5)]; // manhattan 3
    expect(findSupplier(justBeyond, 5, 5, 'wheat', 2)).toBeNull();
  });
});
