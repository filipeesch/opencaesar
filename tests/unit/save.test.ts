import { describe, expect, it } from 'vitest';
import { deleteSave, listSaves, loadSavedGame, makeRecord, readSave, writeSave, type StorageLike } from '../../src/game/save';
import type { SaveData } from '../../src/sim/types';

function memStore(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  };
}

const fakeSave: SaveData = {
  version: 1,
  seed: 42,
  mapSize: 40,
  commands: [],
  tickCount: 123,
  savedAt: 1000,
};

describe('save storage layer', () => {
  it('round-trips a save through write then read', () => {
    const storage = memStore();
    expect(writeSave(fakeSave, storage)).toEqual({ ok: true });
    const record = readSave(storage);
    expect(record?.data.seed).toBe(42);
    expect(record?.data.tickCount).toBe(123);
    expect(record?.meta.tick).toBe(123);
  });

  it('returns null for a missing save', () => {
    expect(readSave(memStore())).toBeNull();
    expect(listSaves(memStore())).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    const storage = memStore();
    storage.setItem('rcb.save', '{not valid json');
    expect(readSave(storage)).toBeNull();
  });

  it('returns null for JSON without a valid version', () => {
    const storage = memStore();
    storage.setItem('rcb.save', JSON.stringify({ hello: 'world' }));
    expect(readSave(storage)).toBeNull();
  });

  it('deleteSave removes the saved game', () => {
    const storage = memStore();
    writeSave(fakeSave, storage);
    expect(deleteSave(storage)).toEqual({ ok: true });
    expect(readSave(storage)).toBeNull();
  });

  it('makeRecord builds metadata from the payload', () => {
    const rec = makeRecord(fakeSave);
    expect(rec.meta).toMatchObject({ seed: 42, mapSize: 40, tick: 123 });
  });
});

/**
 * Phase 19 (PERS-01): the validated load path. loadSavedGame() is the
 * read → parse → migrate → validate chain hooked into the HomeScene load
 * click-through: only {ok:true} reaches scene.start('Main',{save}). Missing /
 * corrupt / unknown-version / structurally-invalid saves return a typed
 * {ok:false, error, reason} — never a raw throw and never a silent load.
 */
describe('loadSavedGame (read → parse → migrate → validate)', () => {
  it('returns a typed read failure when no save exists', () => {
    const res = loadSavedGame(memStore());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('read');
  });

  it('returns a typed parse failure for corrupt JSON', () => {
    const storage = memStore();
    storage.setItem('rcb.save', '{not valid json');
    const res = loadSavedGame(storage);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('parse');
  });

  it('round-trips a valid v1 save with data unchanged', () => {
    const storage = memStore();
    expect(writeSave(fakeSave, storage)).toEqual({ ok: true });
    const res = loadSavedGame(storage);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.seed).toBe(42);
      expect(res.data.tickCount).toBe(123);
      expect(res.data.version).toBe(1);
    }
  });

  it('returns a typed migrate failure for an unknown older version', () => {
    const storage = memStore();
    storage.setItem('rcb.save', JSON.stringify(makeRecord({ ...fakeSave, version: 0 } as unknown as SaveData)));
    const res = loadSavedGame(storage);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('migrate');
      expect(typeof res.reason).toBe('string');
      expect(res.reason!.length).toBeGreaterThan(0);
    }
  });

  it('returns a typed migrate failure for a save newer than SAVE_VERSION', () => {
    const storage = memStore();
    storage.setItem(
      'rcb.save',
      JSON.stringify(makeRecord({ ...fakeSave, version: 999 } as unknown as SaveData)),
    );
    const res = loadSavedGame(storage);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('migrate');
      expect(typeof res.reason).toBe('string');
      expect(res.reason!.length).toBeGreaterThan(0);
    }
  });

  it('returns a typed validate failure for a structurally-invalid v1 save', () => {
    const storage = memStore();
    storage.setItem('rcb.save', JSON.stringify(makeRecord({ ...fakeSave, commands: 'x' } as unknown as SaveData)));
    const res = loadSavedGame(storage);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('validate');
      expect(typeof res.reason).toBe('string');
      expect(res.reason!.length).toBeGreaterThan(0);
    }
  });
});
