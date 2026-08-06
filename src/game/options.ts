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

// Valid enum unions for the sanitization pass — module-local constants
// (balance-parity; no new data/balance.ts keys without a CONFIG consumer).
const TEXT_SIZES = new Set<OptionsSchema['textSize']>(['small', 'normal', 'large']);
const GRAPHICS_QUALITIES = new Set<OptionsSchema['graphicsQuality']>(['low', 'medium', 'high']);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Shape/range pass at the persistence boundary (WR-01). deserializeOptions
 * merges parseable-but-invalid stored values (e.g. {"textSize":"gigantic"},
 * {"audioMusic":7}) straight into OptionsSchema, bypassing the "defaults on
 * corrupt" guarantee (only unparseable JSON fell back to defaults). Sanitize
 * so ANY invalid field value resolves to its DEFAULT: clamp audio to [0,1],
 * whitelist the two enum unions, coerce reducedMotion to boolean, and require
 * gameSpeedDefault positive-finite. Unknown future fields are preserved
 * (forward-compat — a shallow spread is corrected field-by-field).
 */
function sanitizeOptions(o: OptionsSchema): OptionsSchema {
  const result: OptionsSchema & Record<string, unknown> = { ...o };
  if (!TEXT_SIZES.has(result.textSize)) result.textSize = DEFAULT_OPTIONS.textSize;
  if (!GRAPHICS_QUALITIES.has(result.graphicsQuality)) result.graphicsQuality = DEFAULT_OPTIONS.graphicsQuality;
  result.audioMusic = Number.isFinite(result.audioMusic) ? clamp01(result.audioMusic) : DEFAULT_OPTIONS.audioMusic;
  result.audioSfx = Number.isFinite(result.audioSfx) ? clamp01(result.audioSfx) : DEFAULT_OPTIONS.audioSfx;
  result.gameSpeedDefault =
    Number.isFinite(result.gameSpeedDefault) && result.gameSpeedDefault > 0
      ? result.gameSpeedDefault
      : DEFAULT_OPTIONS.gameSpeedDefault;
  result.reducedMotion = typeof result.reducedMotion === 'boolean' ? result.reducedMotion : DEFAULT_OPTIONS.reducedMotion;
  return result as OptionsSchema;
}

/**
 * Load the persisted options, merged with defaults forward-compat: a missing or
 * corrupt store returns DEFAULT_OPTIONS (deserializeOptions try/catch), and a
 * partial stored value merges with defaults while unknown future fields are
 * preserved (mergeOptions spread semantics). Values crossing the persistence
 * boundary are sanitized (sanitizeOptions) so malformed-but-parseable JSON can
 * never reach the DOM (body[data-text-size]/[data-reduced-motion]) or the
 * settings drawer unsanitized.
 */
export function loadOptions(storage: StorageLike = defaultStorage()): OptionsSchema {
  try {
    return sanitizeOptions(deserializeOptions(storage.getItem(OPTIONS_KEY)));
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
