/**
 * options — the persisted shell-state store (PERS-02). Options are VIEW/SHELL
 * state, persisted under their OWN localStorage key ('rcb.options') disjoint
 * from the save envelope (rcb.save/rcb.quicksave/rcb.autosave.*). They are
 * NEVER part of SaveData/getStateJson — the golden-byte contract. Mirrors the
 * save.ts layering (StorageLike + typed SaveResult + defaultStorage) and wires
 * the ui.ts options codec (serialize/deserialize/merge/DEFAULT_OPTIONS).
 */

import { DEFAULT_OPTIONS, deserializeOptions, serializeOptions, type OptionsSchema } from '../sim/ui';
import { defaultStorage, type SaveResult, type StorageLike } from './save';
import { setMusicVolume, setSfxVolume } from './audio';

/** localStorage key for the options envelope — disjoint from all save keys. */
export const OPTIONS_KEY = 'rcb.options';

/**
 * Load the persisted options, merged with defaults forward-compat: a missing or
 * corrupt store returns DEFAULT_OPTIONS (deserializeOptions try/catch), and a
 * partial stored value merges with defaults while unknown future fields are
 * preserved (mergeOptions spread semantics).
 */
export function loadOptions(storage: StorageLike = defaultStorage()): OptionsSchema {
  try {
    return deserializeOptions(storage.getItem(OPTIONS_KEY));
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}

/** Persist the options under rcb.options; typed SaveResult on write failure. */
export function saveOptions(o: OptionsSchema, storage: StorageLike = defaultStorage()): SaveResult {
  try {
    storage.setItem(OPTIONS_KEY, serializeOptions(o));
    return { ok: true };
  } catch {
    return { ok: false, error: 'write' };
  }
}

/**
 * Apply the options to the running shell — body data-attrs (text-size /
 * reduced-motion) + the audio mix seam. Touches view/shell ONLY, NEVER the sim
 * (Pitfall 5). graphicsQuality is applied at boot (RenderConfig is
 * context-creation-only — main.ts) and gameSpeedDefault is applied once at
 * MainScene boot (19-02-02), NOT here (Pitfall 6).
 */
export function applyOptions(o: OptionsSchema): void {
  document.body.dataset.textSize = o.textSize;
  document.body.dataset.reducedMotion = String(o.reducedMotion);
  setMusicVolume(o.audioMusic);
  setSfxVolume(o.audioSfx);
}
