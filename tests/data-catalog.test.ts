import { describe, it, expect } from 'vitest';
import { COMMODITIES, FOOD_TYPES, isHouseGood, commodityName } from '../data/commodities';
import { BUILDINGS, buildingName, isFoodProducer } from '../data/buildings';
import { HOUSING_LEVELS, housingLevelName, housingCapacity } from '../data/housing';
import { TRADE_CITIES } from '../data/trade';
import { EVENTS } from '../data/events';
import { MISSIONS } from '../data/missions';

describe('data catalog', () => {
  it('commodities cover food, raw, manufactured, and luxury goods', () => {
    expect(COMMODITIES['wheat']).toBeDefined();
    expect(FOOD_TYPES.length).toBeGreaterThanOrEqual(4);
    expect(isHouseGood('pottery')).toBe(true);
    expect(commodityName('wheat')).toBe('Wheat');
  });

  it('buildings cover production, water, storage, and monuments', () => {
    expect(BUILDINGS['farm']).toBeDefined();
    expect(BUILDINGS['fountain']).toBeDefined();
    expect(BUILDINGS['granary']).toBeDefined();
    expect(BUILDINGS['colosseum']).toBeDefined();
    expect(isFoodProducer(BUILDINGS['farm'])).toBe(true);
    expect(buildingName('farm')).toBe('Farm');
  });

  it('housing levels are ascending and bounded', () => {
    expect(HOUSING_LEVELS[0].name).toBe('Vacant Lot');
    expect(HOUSING_LEVELS[HOUSING_LEVELS.length - 1].name).toContain('Villa');
    expect(housingLevelName(5)).toBeTruthy();
    expect(housingCapacity(5)).toBeGreaterThan(0);
  });

  it('trade cities exist with buy/sell lists', () => {
    expect(Object.keys(TRADE_CITIES).length).toBeGreaterThan(0);
    expect(TRADE_CITIES['massilia'].buys.length).toBeGreaterThan(0);
  });

  it('events and missions have entries', () => {
    expect(Object.keys(EVENTS).length).toBeGreaterThan(0);
    expect(Object.keys(MISSIONS).length).toBeGreaterThan(0);
  });

  it('event catalog expands to the full non-military ~25-event spec set, preserving the original 8 (RATE-03)', () => {
    const keys = Object.keys(EVENTS);
    expect(keys.length).toBeGreaterThanOrEqual(25);
    // Original 8 preserved byte-identical.
    const original = ['fire', 'collapse', 'earthquake', 'flood', 'pestilence', 'riot', 'good_harvest', 'festival'];
    for (const id of original) expect(EVENTS[id]).toBeDefined();
    expect(EVENTS['fire'].severity).toBe('serious');
    expect(EVENTS['fire'].durationTicks).toBe(60);
    expect(EVENTS['good_harvest'].effect.prosperity).toBe(2);
    // New spec events present.
    for (const id of ['drought', 'epidemic', 'price_rise', 'price_fall', 'strike', 'heat_wave', 'severe_winter']) {
      expect(EVENTS[id]).toBeDefined();
    }
  });

  it('event responses carry non-empty labels and unique ids per event (RATE-03)', () => {
    for (const ev of Object.values(EVENTS)) {
      if (!ev.responses) continue;
      const seen = new Set<string>();
      for (const resp of ev.responses) {
        expect(resp.label.trim().length).toBeGreaterThan(0);
        expect(seen.has(resp.id)).toBe(false);
        seen.add(resp.id);
      }
    }
  });
});

import { validateCatalogs } from '../data/validate';
import { localize, translateAll } from '../data/localization';

describe('data catalog validation + localization', () => {
  it('all catalogs pass load-time validation', () => {
    expect(validateCatalogs()).toEqual([]);
  });

  it('localization resolves known keys and falls back gracefully', () => {
    expect(localize('pt', 'treasury')).toBe('Tesouro');
    expect(localize('en', 'treasury')).toBe('Treasury');
    expect(localize('en', 'missing_key')).toBe('missing_key');
    expect(Object.keys(translateAll('pt')).length).toBeGreaterThan(0);
  });
});

import { BALANCE } from '../data/balance';
import { CONFIG } from '../src/sim/config';

describe('balance catalog equivalence (DATA-02)', () => {
  it('config re-exports the data balance values identically', () => {
    expect({ ...CONFIG } as Record<string, unknown>).toEqual({ ...BALANCE } as Record<string, unknown>);
  });

  it('balance catalog carries the known sentinel values', () => {
    expect(CONFIG.startingTreasury).toBe(1000);
    expect(CONFIG.ticksPerSecond).toBe(4);
    expect(CONFIG.walkerSpeedPerTick).toBe(0.5);
  });
});

import { decomposeRatings } from '../src/sim/ratings';

describe('rating decomposition (task 10.3)', () => {
  it('treats construction separately from the running economy for Prosperity', () => {
    const stats = { population: 1000, treasury: 5000, taxRate: 0.1,
      hasReligion: true, hasEntertainment: true, hasEducation: true, hasHealth: true, hasWater: true, hasFood: true };
    const d = decomposeRatings(stats, 150);
    expect(d.prosperity.construction).toBeGreaterThanOrEqual(0);
    expect(d.prosperity.economy).toBeGreaterThan(0);
    expect(d.culture.religion).toBe(25);
  });
});
