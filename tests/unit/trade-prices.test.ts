/**
 * TRAD-05 — the additive TradePriceState model: base/history/trend/modifier,
 * deterministic sampling under injected ticks, the import>export catalog
 * invariant, BALANCE.trade consumption (balance-parity), and the legacy
 * tradePrice export unchanged.
 */
import { describe, it, expect } from 'vitest';
import { COMMODITIES } from '../../data/commodities';
import { BALANCE } from '../../data/balance';
import {
  tradePrice,
  createTradePriceState, sampleTradePrice, priceTrend, effectivePrice, applyPriceEvent,
} from '../../src/sim/trade';
import type { TradePriceState } from '../../src/sim/trade';

describe('TRAD-05 import > export data invariant', () => {
  it('every commodity satisfies baseImportPrice > baseExportPrice', () => {
    for (const def of Object.values(COMMODITIES)) {
      expect(def.baseImportPrice, `${def.id} import`).toBeGreaterThan(def.baseExportPrice);
    }
  });
});

describe('TRAD-05 price state model (§19.5)', () => {
  it('createTradePriceState holds base and an empty history with default ring size', () => {
    const s = createTradePriceState(30);
    expect(s.base).toBe(30);
    expect(s.history).toEqual([]);
    expect(s.modifier).toBe(1);
    expect(s.historySize).toBe(BALANCE.tradePriceHistoryWindow);
  });

  it('sampleTradePrice pushes deterministic history and does not duplicate on the same tick', () => {
    const s = createTradePriceState(30);
    sampleTradePrice(s, 31, 10);
    sampleTradePrice(s, 32, 11);
    sampleTradePrice(s, 32, 11); // same tick → no duplicate
    expect(s.history).toEqual([31, 32]);
    // identical (price, at) sequences → identical histories
    const a = createTradePriceState(30);
    const b = createTradePriceState(30);
    for (const [p, at] of [[31, 1], [32, 2], [29, 3]] as Array<[number, number]>) {
      sampleTradePrice(a, p, at);
      sampleTradePrice(b, p, at);
    }
    expect(a).toEqual(b);
  });

  it('priceTrend across the window returns rising/steady/falling per the tolerance', () => {
    const window = BALANCE.tradePriceHistoryWindow;
    const s = createTradePriceState(30);
    // steady: all within ±tolerance of the first entry
    for (let i = 0; i < window + 1; i++) sampleTradePrice(s, 30, i);
    expect(priceTrend(s, window + 1)).toBe('steady');
    // rising: latest far above earlier
    const r = createTradePriceState(30);
    for (let i = 0; i < window + 1; i++) sampleTradePrice(r, 30 + i * 5, i);
    expect(priceTrend(r, window + 1)).toBe('rising');
    // falling: latest far below earlier
    const f = createTradePriceState(30);
    for (let i = 0; i < window + 1; i++) sampleTradePrice(f, 40 - i * 5, i);
    expect(priceTrend(f, window + 1)).toBe('falling');
  });

  it('effectivePrice = round(base × modifier) with clamping at the floor, never ≤ 0', () => {
    const s = createTradePriceState(30);
    expect(effectivePrice(s, 0)).toBe(30);
    applyPriceEvent(s, 0.5, 1);
    expect(effectivePrice(s, 1)).toBe(45); // round(30 * 1.5)
    const floor = createTradePriceState(1);
    applyPriceEvent(floor, -5, 1);
    expect(effectivePrice(floor, 2)).toBe(BALANCE.tradePriceFloor);
    expect(effectivePrice(floor, 2)).toBeGreaterThanOrEqual(1);
  });

  it('applyPriceEvent shifts effective price both directions deterministically and does not pollute history', () => {
    const s = createTradePriceState(30);
    const histLenBefore = s.history.length;
    applyPriceEvent(s, 0.2, 5);
    const up = effectivePrice(s, 5);
    applyPriceEvent(s, -0.4, 6);
    const down = effectivePrice(s, 6);
    expect(up).toBeGreaterThan(30);
    expect(down).toBeLessThan(up);
    expect(s.history.length).toBe(histLenBefore); // no history writes
  });

  it('tradePrice export still returns the legacy value (unchanged)', () => {
    expect(tradePrice('wheat', 'massilia', true)).toBe(27);
    expect(tradePrice('wheat', 'massilia', false)).toBe(36);
  });
});

describe('BALANCE.trade keys are exposed and consumed', () => {
  it('the new trade keys exist', () => {
    expect(BALANCE.tradePriceHistoryWindow).toBe(8);
    expect(BALANCE.tradePriceSteadyTolerance).toBe(1);
    expect(BALANCE.tradePriceFloor).toBe(1);
    expect(BALANCE.merchantWaitTicks).toBe(120);
  });

  it('created price state uses a serializable plain shape', () => {
    const s: TradePriceState = createTradePriceState(10);
    expect(JSON.parse(JSON.stringify(s))).toEqual({ base: 10, history: [], trend: 'steady', modifier: 1, historySize: 8 });
  });
});
