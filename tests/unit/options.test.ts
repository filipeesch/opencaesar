import { describe, expect, it } from 'vitest';
import { loadOptions, saveOptions, OPTIONS_KEY } from '../../src/game/options';
import { DEFAULT_OPTIONS, type OptionsSchema } from '../../src/sim/ui';
import type { StorageLike } from '../../src/game/save';

/**
 * Phase 19 (PERS-02): the persisted shell-state options store. Options live
 * under the 'rcb.options' key — disjoint from rcb.save — and are NEVER part of
 * SaveData/getStateJson. loadOptions merges with defaults forward-compat
 * (unknown future fields preserved), corrupt/missing stores fall back to
 * defaults, and saveOptions returns the typed SaveResult envelope.
 */
function memStore(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  };
}

const custom: OptionsSchema = {
  graphicsQuality: 'high',
  audioMusic: 0.2,
  audioSfx: 0.5,
  gameSpeedDefault: 2,
  textSize: 'large',
  reducedMotion: true,
};

describe('options store (rcb.options)', () => {
  it('round-trips DEFAULT_OPTIONS under the rcb.options key', () => {
    const storage = memStore();
    expect(saveOptions(DEFAULT_OPTIONS, storage)).toEqual({ ok: true });
    // Disjointness: the save envelope key must never be touched by options.
    expect(storage.getItem('rcb.save')).toBeNull();
    expect(JSON.parse(storage.getItem(OPTIONS_KEY)!)).toEqual(DEFAULT_OPTIONS);
    expect(loadOptions(storage)).toEqual(DEFAULT_OPTIONS);
  });

  it('returns DEFAULT_OPTIONS when the store is missing', () => {
    expect(loadOptions(memStore())).toEqual(DEFAULT_OPTIONS);
  });

  it('returns DEFAULT_OPTIONS for corrupt JSON under the key', () => {
    const storage = memStore();
    storage.setItem(OPTIONS_KEY, '{not valid json');
    expect(loadOptions(storage)).toEqual(DEFAULT_OPTIONS);
  });

  it('merges a partial stored value with defaults', () => {
    const storage = memStore();
    storage.setItem(OPTIONS_KEY, JSON.stringify({ textSize: 'large' }));
    const o = loadOptions(storage);
    expect(o.textSize).toBe('large');
    expect(o.audioMusic).toBeCloseTo(0.6); // default preserved
    expect(o.audioSfx).toBeCloseTo(0.8); // default preserved
    expect(o.reducedMotion).toBe(false); // default preserved
    expect(o.graphicsQuality).toBe('medium');
    expect(o.gameSpeedDefault).toBe(1);
  });

  it('preserves unknown future fields at the data level (forward-compat)', () => {
    const storage = memStore();
    const withFuture = { ...DEFAULT_OPTIONS, someFutureField: 7 } as OptionsSchema & {
      someFutureField: number;
    };
    expect(saveOptions(withFuture, storage)).toEqual({ ok: true });
    const back = loadOptions(storage) as OptionsSchema & { someFutureField: number };
    expect(back).toMatchObject(DEFAULT_OPTIONS);
    expect(back.someFutureField).toBe(7);
  });

  it('round-trips a full custom schema exactly', () => {
    const storage = memStore();
    expect(saveOptions(custom, storage)).toEqual({ ok: true });
    expect(loadOptions(storage)).toEqual(custom);
  });
});
