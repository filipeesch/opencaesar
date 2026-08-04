/**
 * TRAD-01 / DATA-01 — the §19.1 regional-map catalog fields per city and the
 * load-time validation that refuses corrupt data. Every extended field
 * (landOrSea, routeOpeningCost, merchantFrequency, annualQuotaPerGood,
 * relationship, priceModifiers) is asserted on the real catalog and each is
 * proven to trip the REAL validateCatalogs() guard when corrupted (probe
 * catalogs injected through the validator's optional `tradeCatalog` override).
 */
import { describe, it, expect } from 'vitest';
import { TRADE_CITIES, tradeCityName, type TradeCityDef } from '../../data/trade';
import { validateCatalogs } from '../../data/validate';
import { COMMODITIES } from '../../data/commodities';

function catalogWith(mutate: (city: TradeCityDef) => void): Record<string, TradeCityDef> {
  const clone: Record<string, TradeCityDef> = {};
  for (const [id, city] of Object.entries(TRADE_CITIES)) {
    clone[id] = JSON.parse(JSON.stringify(city)) as TradeCityDef;
  }
  mutate(clone['massilia']);
  return clone;
}

function tradeIssueMessages(catalog: Record<string, TradeCityDef>): string[] {
  return validateCatalogs(catalog)
    .filter((i) => i.catalog === 'trade')
    .map((i) => i.message);
}

describe('TRAD-01 §19.1 trade-city catalog', () => {
  it('every city carries the §19.1 fields with valid values', () => {
    expect(Object.keys(TRADE_CITIES).length).toBeGreaterThanOrEqual(4);
    for (const city of Object.values(TRADE_CITIES)) {
      expect(['land', 'sea']).toContain(city.landOrSea);
      expect(city.routeOpeningCost).toBeGreaterThan(0);
      expect(city.merchantFrequency).toBeGreaterThan(0);
      expect(city.buys.length).toBeGreaterThan(0);
      expect(city.sells.length).toBeGreaterThan(0);
      expect(city.relationship).toBeDefined();
      expect(typeof city.priceModifier).toBe('number');
      expect(city.annualQuotaPerGood).toBeGreaterThan(0);
      // every bought/sold good resolves in COMMODITIES
      for (const good of [...city.buys, ...city.sells]) {
        expect(COMMODITIES[good], `good ${good} of ${city.id}`).toBeDefined();
      }
    }
  });

  it('has at least one land city and one sea city', () => {
    const land = Object.values(TRADE_CITIES).filter((c) => c.landOrSea === 'land');
    const sea = Object.values(TRADE_CITIES).filter((c) => c.landOrSea === 'sea');
    expect(land.length).toBeGreaterThanOrEqual(1);
    expect(sea.length).toBeGreaterThanOrEqual(1);
  });

  it('opening costs / frequencies / quotas follow the §19.7 ordering', () => {
    expect(TRADE_CITIES['massilia'].routeOpeningCost).toBe(500);
    expect(TRADE_CITIES['caralis'].routeOpeningCost).toBe(800);
    expect(TRADE_CITIES['londinium'].routeOpeningCost).toBe(1200);
    expect(TRADE_CITIES['tarraco'].routeOpeningCost).toBe(1500);
    expect(TRADE_CITIES['massilia'].merchantFrequency).toBeLessThan(TRADE_CITIES['tarraco'].merchantFrequency);
  });

  it('validateCatalogs() stays clean (guard green) on the real catalog', () => {
    expect(validateCatalogs().filter((i) => i.catalog === 'trade')).toEqual([]);
    expect(validateCatalogs()).toEqual([]);
  });

  it('a corrupted §19.1 field trips the real validateCatalogs() (validation engaged)', () => {
    expect(tradeIssueMessages(catalogWith((c) => { c.routeOpeningCost = 0; }))).toEqual(
      expect.arrayContaining([expect.stringContaining('opening cost')]),
    );
    expect(tradeIssueMessages(catalogWith((c) => { c.buys = []; }))).toEqual(
      expect.arrayContaining([expect.stringContaining('empty buys/sells')]),
    );
    expect(tradeIssueMessages(catalogWith((c) => { c.landOrSea = 'air' as 'land'; }))).toEqual(
      expect.arrayContaining([expect.stringContaining("landOrSea must be 'land'")]),
    );
    expect(tradeIssueMessages(catalogWith((c) => { c.annualQuotaPerGood = -1; }))).toEqual(
      expect.arrayContaining([expect.stringContaining('annual quota per good')]),
    );
    expect(tradeIssueMessages(catalogWith((c) => { c.merchantFrequency = 0; }))).toEqual(
      expect.arrayContaining([expect.stringContaining('merchant frequency')]),
    );
    expect(tradeIssueMessages(catalogWith((c) => { c.relationship = 'war' as 'neutral'; }))).toEqual(
      expect.arrayContaining([expect.stringContaining('relationship')]),
    );
  });

  it('a bought/sold good missing from COMMODITIES is flagged by the guard', () => {
    const catalog = catalogWith((c) => { c.buys = ['spices']; });
    expect(tradeIssueMessages(catalog)).toEqual(expect.arrayContaining([expect.stringContaining("'spices'")]));
  });

  it('priceModifiers coverage: a bought/sold good missing its modifier is flagged', () => {
    const catalog = catalogWith((c) => { c.priceModifiers = { wheat: 0.9 }; });
    expect(tradeIssueMessages(catalog)).toEqual(expect.arrayContaining([expect.stringContaining('priceModifiers')]));
  });

  it('tradeCityName resolves a known city and falls back to the id (legacy behavior)', () => {
    expect(tradeCityName('massilia')).toBe('Massilia');
    expect(tradeCityName('unknown')).toBe('unknown');
  });
});
