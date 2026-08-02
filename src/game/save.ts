/**
 * Save/load persistence over localStorage. A save is a versioned JSON
 * envelope containing a deterministic SimRunner save payload plus metadata.
 */

import type { SaveData } from '../sim/types';

export const SAVE_KEY = 'rcb.save';

/** Thin storage abstraction so the layer is unit-testable without a browser. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveMeta {
  seed: number;
  mapSize: number;
  tick: number;
  savedAt: number;
}

export interface SaveRecord {
  data: SaveData;
  meta: SaveMeta;
}

export type SaveResult = { ok: true } | { ok: false; error: 'read' | 'write' | 'parse' };

function defaultStorage(): StorageLike {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    /* fall through */
  }
  return memoryStorage;
}

const memoryStore = new Map<string, string>();
const memoryStorage: StorageLike = {
  getItem: (k) => memoryStore.get(k) ?? null,
  setItem: (k, v) => void memoryStore.set(k, v),
  removeItem: (k) => void memoryStore.delete(k),
};

/** Build the persisted record (data + metadata) for a save. */
export function makeRecord(data: SaveData): SaveRecord {
  return {
    data,
    meta: {
      seed: data.seed,
      mapSize: data.mapSize,
      tick: data.tickCount,
      savedAt: data.savedAt,
    },
  };
}

/** Read the current save from storage. Returns null when none (or corrupt). */
export function readSave(storage: StorageLike = defaultStorage()): SaveRecord | null {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveRecord;
    if (!parsed?.data?.version) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Write a save to storage. */
export function writeSave(save: SaveData, storage: StorageLike = defaultStorage()): SaveResult {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(makeRecord(save)));
    return { ok: true };
  } catch {
    return { ok: false, error: 'write' };
  }
}

/** Remove the current save. */
export function deleteSave(storage: StorageLike = defaultStorage()): SaveResult {
  try {
    storage.removeItem(SAVE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, error: 'write' };
  }
}

/** Meta-only view for the load list; null when no save exists. */
export function listSaves(storage: StorageLike = defaultStorage()): SaveRecord | null {
  return readSave(storage);
}
