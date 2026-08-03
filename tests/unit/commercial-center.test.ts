/**
 * Phase 7, WARE-02 (decision 3): a single Commercial Center designation with
 * fallback-on-full. A second designation request falls back with a warning and
 * never replaces the current designation; when the designated center is full,
 * resolveFull picks the first alternative warehouse that accepts the commodity
 * with a warning naming both, or holds the delivery with a warning (never
 * discarding) when none accepts.
 */
import { describe, it, expect } from 'vitest';
import { CommercialCenter } from '../../src/sim/logistics';

const accepts = (id: string) => ({ id, accepts: () => true });
const refuses = (id: string) => ({ id, accepts: () => false });
const acceptsPottery = (id: string) => ({ id, accepts: (c: string) => c === 'pottery' });

describe('single designation (WARE-02)', () => {
  it('keeps the first designation and falls back on a second request', () => {
    const cc = new CommercialCenter();
    expect(cc.designate('wh1').ok).toBe(true);
    expect(cc.isDesignated('wh1')).toBe(true);

    const second = cc.designate('wh2');
    expect(second.ok).toBe(true);
    expect(second.fallback).toBe(true);
    expect(second.warning).toBeTruthy();
    expect(cc.isDesignated('wh2')).toBe(false);
    expect(cc.isDesignated('wh1')).toBe(true);
  });
});

describe('fallback on full (WARE-02 §17.4)', () => {
  it('resolves to an accepting alternative with a warning naming both warehouses', () => {
    const cc = new CommercialCenter();
    cc.designate('wh1');
    const result = cc.resolveFull('pottery', [accepts('wh2')]);
    expect(result.id).toBe('wh2');
    expect(result.warning).toContain('wh1');
    expect(result.warning).toContain('wh2');
  });

  it('picks the first accepting alternative', () => {
    const cc = new CommercialCenter();
    cc.designate('wh1');
    const result = cc.resolveFull('pottery', [refuses('wh2'), acceptsPottery('wh3')]);
    expect(result.id).toBe('wh3');
    expect(result.warning).toContain('wh3');
  });

  it('with all candidates refusing, returns id null and a hold/not-discarded warning', () => {
    const cc = new CommercialCenter();
    cc.designate('wh1');
    const result = cc.resolveFull('pottery', [refuses('wh2'), refuses('wh3')]);
    expect(result.id).toBeNull();
    expect(result.warning).toContain('wh1');
    expect(result.warning).toMatch(/held/i);
    expect(result.warning).toMatch(/nothing discarded/i);
  });

  it('before any designation, returns null with a No Commercial Center warning', () => {
    const cc = new CommercialCenter();
    const result = cc.resolveFull('pottery', [accepts('wh2')]);
    expect(result.id).toBeNull();
    expect(result.warning).toBe('No Commercial Center designated.');
  });

  it('excludes the full designated center from the fallback search even when it is first (WR-04)', () => {
    const cc = new CommercialCenter();
    cc.designate('wh1');
    // designated center first in the candidate list and accepting — it must be skipped
    const result = cc.resolveFull('pottery', [accepts('wh1'), accepts('wh2')]);
    expect(result.id).toBe('wh2');
    expect(result.warning).toContain('wh1');
    expect(result.warning).toContain('wh2');
  });

  it('when only the full designated center exists, fallback finds none and holds (no discard) (WR-04)', () => {
    const cc = new CommercialCenter();
    cc.designate('wh1');
    const result = cc.resolveFull('pottery', [accepts('wh1')]);
    expect(result.id).toBeNull();
    expect(result.warning).toContain('wh1');
    expect(result.warning).toMatch(/held/i);
    expect(result.warning).toMatch(/nothing discarded/i);
  });

  it('is a stable pure read — it does not mutate the designation', () => {
    const cc = new CommercialCenter();
    cc.designate('wh1');
    const first = cc.resolveFull('pottery', [accepts('wh2')]);
    const second = cc.resolveFull('pottery', [accepts('wh2')]);
    expect(second).toEqual(first);
    // designation still intact and usable afterwards
    expect(cc.isDesignated('wh1')).toBe(true);
    expect(cc.designate('wh1').ok).toBe(true);
    expect(cc.isDesignated('wh1')).toBe(true);
  });
});
