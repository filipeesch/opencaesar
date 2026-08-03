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

/**
 * Slot-based persistence (task 12.2): autosave with rotation and
 * quicksave/quickload slots, layered over the base localStorage envelope.
 */
export const QUICKSAVE_KEY = 'rcb.quicksave';
export const AUTOSAVE_PREFIX = 'rcb.autosave.';

export function writeQuickSave(save: SaveData, storage: StorageLike = defaultStorage()): SaveResult {
  try { storage.setItem(QUICKSAVE_KEY, JSON.stringify(makeRecord(save))); return { ok: true }; }
  catch { return { ok: false, error: 'write' }; }
}

export function readQuickSave(storage: StorageLike = defaultStorage()): SaveRecord | null {
  const raw = storage.getItem(QUICKSAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SaveRecord;
    return parsed?.data?.version ? parsed : null;
  } catch { return null; }
}

/** Write an autosave into the rotation slot, dropping the oldest. */
export function writeAutosave(save: SaveData, slots: number, storage: StorageLike = defaultStorage()): SaveResult {
  try {
    // Shift the rotation: oldest slot N-1 dropped, others move up.
    for (let i = slots - 1; i >= 1; i--) {
      const older = storage.getItem(`${AUTOSAVE_PREFIX}${i - 1}`);
      if (older) storage.setItem(`${AUTOSAVE_PREFIX}${i}`, older);
    }
    storage.setItem(`${AUTOSAVE_PREFIX}0`, JSON.stringify(makeRecord(save)));
    return { ok: true };
  } catch { return { ok: false, error: 'write' }; }
}

export function listAutosaves(slots: number, storage: StorageLike = defaultStorage()): (SaveRecord | null)[] {
  const out: (SaveRecord | null)[] = [];
  for (let i = 0; i < slots; i++) {
    const raw = storage.getItem(`${AUTOSAVE_PREFIX}${i}`);
    if (!raw) { out.push(null); continue; }
    try {
      const rec = JSON.parse(raw) as SaveRecord;
      out.push(rec?.data?.version ? rec : null);
    } catch { out.push(null); }
  }
  return out;
}
