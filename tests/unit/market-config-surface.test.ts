/**
 * Additive market-config surface (MARK-02, decisions 3+4): marketNeedsRestock
 * honoring targetStock, findSupplier's optional preferredSupplier param, and
 * the SimRunner per-market config registry (setMarketConfig / marketConfig).
 */
import { describe, expect, it } from 'vitest';
import {
  marketNeedsRestock, findSupplier, defaultMarketConfig,
} from '../../src/sim/logistics';
import type { MarketSupplier, MarketConfig } from '../../src/sim/logistics';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';

describe('marketNeedsRestock honors cfg.targetStock (MARK-02 §18.5, decision 3+4)', () => {
  it('reports restock need only when stock + inTransit is below the target', () => {
    const cfg: MarketConfig = defaultMarketConfig();
    cfg.targetStock = 20;
    expect(marketNeedsRestock(cfg, 10, 0)).toBe(true); // below target
    expect(marketNeedsRestock(cfg, 20, 0)).toBe(false); // at target
    expect(marketNeedsRestock(cfg, 25, 0)).toBe(false); // above target
  });

  it('counts in-transit units against the target', () => {
    const cfg: MarketConfig = defaultMarketConfig();
    cfg.targetStock = 20;
    expect(marketNeedsRestock(cfg, 15, 5)).toBe(false); // 15 + 5 = 20 → at target
    expect(marketNeedsRestock(cfg, 5, 10)).toBe(true); // 5 + 10 = 15 < 20 → below
    expect(marketNeedsRestock(cfg, 0, 20)).toBe(false); // 0 + 20 = 20 → covered in transit
  });
});

describe('findSupplier preferred-supplier preference (MARK-02, decision 4)', () => {
  const holder = (id: string, x: number, y: number): MarketSupplier => ({
    id, x, y, hasProduct: (p: string) => p === 'wheat',
  });
  const noHolder = (id: string, x: number, y: number): MarketSupplier => ({
    id, x, y, hasProduct: () => false,
  });

  it('prefers the configured preferredSupplier when it holds the product within radius, even if farther', () => {
    const suppliers = [
      holder('preferred', 8, 8), // farther but configured as preferred
      holder('near', 3, 3),
    ];
    const found = findSupplier(suppliers, 5, 5, 'wheat', 6, 'preferred');
    expect(found?.id).toBe('preferred');
  });

  it('falls back to the nearest holder when the preferred supplier does not hold the product', () => {
    const suppliers = [
      noHolder('preferred', 4, 4), // nearest but holds nothing
      holder('near', 3, 3),
    ];
    const found = findSupplier(suppliers, 5, 5, 'wheat', 5, 'preferred');
    expect(found?.id).toBe('near');
  });

  it('never selects the preferred supplier when it is beyond the radius', () => {
    const suppliers = [
      holder('preferred', 9, 9), // beyond radius 3
      holder('near', 4, 4),
    ];
    const found = findSupplier(suppliers, 5, 5, 'wheat', 3, 'preferred');
    expect(found?.id).toBe('near');
  });

  it('behaves identically to nearest-within-radius when no preferredSupplier is given', () => {
    const suppliers = [holder('far', 8, 8), holder('near', 3, 3)];
    const found = findSupplier(suppliers, 5, 5, 'wheat', 5);
    expect(found?.id).toBe('near');
  });
});

describe('SimRunner per-market config registry (MARK-02, decision 4)', () => {
  it('setMarketConfig stores and marketConfig returns the configured entry', () => {
    const r = new SimRunner(1, SimMap.fromLayout(6, 6, () => 'earth'));
    const cfg = defaultMarketConfig();
    cfg.targetStock = 55;
    cfg.productRules.wheat = 'refuse';
    r.setMarketConfig(7, cfg);
    const got = r.marketConfig(7);
    expect(got.targetStock).toBe(55);
    expect(got.productRules.wheat).toBe('refuse');
    expect(got.buyerRadius).toBe(2); // rest of the default shape kept
    expect(r.hasMarketConfig(7)).toBe(true);
  });

  it('marketConfig defaults to defaultMarketConfig() for an unconfigured market', () => {
    const r = new SimRunner(2, SimMap.fromLayout(6, 6, () => 'earth'));
    expect(r.marketConfig(999)).toEqual(defaultMarketConfig());
    expect(r.hasMarketConfig(999)).toBe(false);
  });

  it('config is per-market isolated: configuring one market does not affect another', () => {
    const r = new SimRunner(3, SimMap.fromLayout(6, 6, () => 'earth'));
    const cfg = defaultMarketConfig();
    cfg.targetStock = 77;
    r.setMarketConfig(1, cfg);
    expect(r.marketConfig(1).targetStock).toBe(77);
    expect(r.marketConfig(2).targetStock).toBe(defaultMarketConfig().targetStock);
    expect(r.marketConfig(2)).toEqual(defaultMarketConfig());
  });
});
