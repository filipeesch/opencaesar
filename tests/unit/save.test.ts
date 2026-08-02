import { describe, expect, it } from 'vitest';
import { deleteSave, listSaves, makeRecord, readSave, writeSave, type StorageLike } from '../../src/game/save';
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
