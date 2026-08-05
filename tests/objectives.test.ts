import { describe, it, expect } from 'vitest';
import { ObjectiveTracker } from '../src/sim/objectives';
import type { MetricSnapshot } from '../src/sim/objectives';

/**
 * Wave 0 (Phase 15, RATE-02) scaffold for the sustained objectives surface.
 *
 * Targets the Phase-15 API: ObjectiveTarget may carry population/culture/
 * prosperity/stability/favor/treasury/annualExports (each undefined = not
 * required) with sustainChecks defaulting to 3 months; MetricSnapshot carries
 * population/culture/prosperity/stability/treasury/favor/annualExports. This
 * file is RED until task 15-02-01 extends objectives.ts.
 */

const base = (over: Partial<MetricSnapshot> = {}): MetricSnapshot => ({
  population: 1000,
  culture: 60,
  prosperity: 55,
  stability: 70,
  favor: 50,
  treasury: 10000,
  annualExports: 20,
  ...over,
});

describe('objectives sustained-period tracker (Phase 15, RATE-02)', () => {
  it('sustainChecks 2: two consecutive passes win; a single miss resets the counter', () => {
    const t = new ObjectiveTracker({
      population: 1000, culture: 60, prosperity: 55, stability: 70, sustainChecks: 2,
    });
    const r1 = t.update(base());
    const r2 = t.update(base());
    expect(r1.won).toBe(false);
    expect(r2.won).toBe(true);
    expect(r2.sustained).toBe(2);

    const r3 = t.update(base({ population: 999 })); // miss resets
    expect(r3.won).toBe(false);
    expect(r3.sustained).toBe(0);
  });

  it('treasury/favor/annualExports thresholds are enforced when set and skipped when undefined', () => {
    const t = new ObjectiveTracker({
      population: 1000, treasury: 10000, favor: 50, annualExports: 20, sustainChecks: 1,
    });
    expect(t.update(base()).won).toBe(true);
    expect(t.update(base({ treasury: 9999 })).won).toBe(false);
    expect(t.update(base({ favor: 49 })).won).toBe(false);
    expect(t.update(base({ annualExports: 19 })).won).toBe(false);

    // undefined targets are not required: a tracker with only a population
    // threshold wins on the snapshot even when the extras are low.
    const t2 = new ObjectiveTracker({ population: 1000, sustainChecks: 1 });
    expect(t2.update(base({ treasury: 0, favor: 0, annualExports: 0 })).won).toBe(true);
  });

  it('defaults to 3 sustain checks when sustainChecks is omitted', () => {
    const t = new ObjectiveTracker({ population: 1000 });
    expect(t.update(base()).won).toBe(false);
    expect(t.update(base()).won).toBe(false);
    expect(t.update(base()).won).toBe(true);
  });

  it('progress() returns sustained/sustainChecks clamped to 0..1', () => {
    const t = new ObjectiveTracker({ population: 1000, sustainChecks: 3 });
    expect(t.progress()).toBe(0);
    t.update(base());
    t.update(base());
    expect(t.progress()).toBeCloseTo(2 / 3);
    expect(t.progress()).toBeGreaterThanOrEqual(0);
    expect(t.progress()).toBeLessThanOrEqual(1);
  });
});
