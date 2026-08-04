import { describe, expect, it } from 'vitest';
import { REQUEST_CATALOG, entryById, pickRequest } from '../../data/requests';
import { hash } from '../../src/sim/events';

describe('administrative requests catalog (GOV-02)', () => {
  it('catalog defines the planned seven request types with flat numbers', () => {
    const byId = Object.fromEntries(REQUEST_CATALOG.map((r) => [r.id, r]));
    expect(REQUEST_CATALOG.length).toBe(7);
    expect(byId.grain_delivery).toMatchObject({ type: 'goods', good: 'wheat', amount: 150, deadlineMonths: 12, reward: 300, penalty: 150 });
    expect(byId.amphora_delivery).toMatchObject({ type: 'goods', good: 'pottery', amount: 100, reward: 250, penalty: 125 });
    expect(byId.wine_delivery).toMatchObject({ type: 'goods', good: 'wine', amount: 100 });
    expect(byId.oil_delivery).toMatchObject({ type: 'goods', good: 'oil', amount: 80 });
    expect(byId.tax_tithe).toMatchObject({ type: 'denarii', amount: 200, deadlineMonths: 6 });
    expect(byId.population_drive).toMatchObject({ type: 'population', amount: 1500, deadlineMonths: 18 });
    expect(byId.grand_send_off).toMatchObject({ type: 'send_off', amount: 2000, reward: 3000, requires: 'palatine' });
  });

  it('entryById resolves known ids and rejects unknown ones', () => {
    expect(entryById('wine_delivery')?.id).toBe('wine_delivery');
    expect(entryById('no_such_request')).toBeUndefined();
  });

  it('pickRequest is deterministic per (seed, tick)', () => {
    const a = pickRequest(7, 1230, 800, ['forum', 'senate']);
    const b = pickRequest(7, 1230, 800, ['forum', 'senate']);
    expect(a?.id).toBe(b?.id);
  });

  it('pickRequest returns null most months (total weight well below the roll range)', () => {
    let hits = 0;
    let total = 0;
    for (let tick = 400; tick < 400 + 2000; tick++) {
      if (pickRequest(7, tick, 800, ['forum', 'senate'])) hits++;
      total++;
    }
    // With total catalog weight ~94 vs roll range 1000, ~9% of months arrive.
    expect(hits).toBeGreaterThan(0);
    expect(hits / total).toBeLessThan(0.3);
  });

  it('grand_send_off is only eligible once the palatine is unlocked', () => {
    let seen = 0;
    let eligibleSeen = 0;
    for (let tick = 400; tick < 400 + 4000; tick++) {
      const withoutPal = pickRequest(7, tick, 2500, ['forum', 'senate']);
      const withPal = pickRequest(7, tick, 2500, ['forum', 'senate', 'palatine']);
      if (withoutPal?.id === 'grand_send_off') seen++;
      if (withPal?.id === 'grand_send_off') eligibleSeen++;
    }
    expect(seen).toBe(0);
    expect(eligibleSeen).toBeGreaterThan(0);
  });

  it('population requests are filtered out once the target population is reached', () => {
    let seenAtTarget = 0;
    let seenBelow = 0;
    for (let tick = 400; tick < 400 + 4000; tick++) {
      if (pickRequest(7, tick, 1600, ['forum', 'senate'])?.id === 'population_drive') seenAtTarget++;
      if (pickRequest(7, tick, 600, ['forum', 'senate'])?.id === 'population_drive') seenBelow++;
    }
    expect(seenAtTarget).toBe(0);
    expect(seenBelow).toBeGreaterThan(0);
  });

  it('eligible pool weight uses only the requests allowed at that population', () => {
    // At pop 100 no population_drive (target 1500) and no palatine gate → still non-null occasionally.
    let hits = 0;
    for (let tick = 400; tick < 400 + 2000; tick++) {
      if (pickRequest(7, tick, 100, ['forum'])) hits++;
    }
    expect(hits).toBeGreaterThan(0);
  });

  it('hash is the deterministic source (no RNG/clock in requests chain)', () => {
    expect(hash(7, 1230)).toBe(hash(7, 1230));
    expect(hash(7, 1230)).not.toBe(hash(8, 1230));
  });
});
