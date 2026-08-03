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
});
