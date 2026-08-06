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

  it('sanitizes parseable-but-invalid stored values back to defaults (WR-01)', () => {
    const storage = memStore();
    // Hand-edited / hostile values that parse but violate the schema.
    storage.setItem(
      OPTIONS_KEY,
      JSON.stringify({
        textSize: 'gigantic', // not in {small,normal,large}
        graphicsQuality: 'ultra', // not in {low,medium,high}
        audioMusic: 7, // out of [0,1]
        audioSfx: -2, // out of [0,1]
        gameSpeedDefault: 0, // not positive-finite
        reducedMotion: 'yes', // not a boolean
      }),
    );
    const o = loadOptions(storage);
    // Enums whitelist + gameSpeedDefault positive-finite + non-boolean
    // reducedMotion fall back to defaults; out-of-range numerics are CLAMPED
    // to [0,1] (the "clamp numeric fields to range" half of the fix).
    expect(o.textSize).toBe(DEFAULT_OPTIONS.textSize);
    expect(o.graphicsQuality).toBe(DEFAULT_OPTIONS.graphicsQuality);
    expect(o.audioMusic).toBeCloseTo(1); // 7 clamped to max
    expect(o.audioSfx).toBeCloseTo(0); // -2 clamped to min
    expect(o.gameSpeedDefault).toBe(DEFAULT_OPTIONS.gameSpeedDefault);
    expect(o.reducedMotion).toBe(DEFAULT_OPTIONS.reducedMotion);
  });

  it('clamps out-of-range numeric values to [0,1] and keeps in-range enums (WR-01)', () => {
    const storage = memStore();
    storage.setItem(
      OPTIONS_KEY,
      JSON.stringify({ audioMusic: 1.5, audioSfx: -0.5, textSize: 'large', graphicsQuality: 'high' }),
    );
    const o = loadOptions(storage);
    expect(o.audioMusic).toBeCloseTo(1); // clamped
    expect(o.audioSfx).toBeCloseTo(0); // clamped
    expect(o.textSize).toBe('large'); // valid enum passes through
    expect(o.graphicsQuality).toBe('high'); // valid enum passes through
  });
});
