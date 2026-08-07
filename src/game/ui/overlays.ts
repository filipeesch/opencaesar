/**
 * Per-service overlay hues (Phase 20, SPEC §4).
 *
 * View-only palette data: each overlay service maps to a base hue (band 4),
 * and `overlayHue(id, band)` returns a 5-step ramp (band 0..4) that darkens
 * toward band 0. Never imported by the sim. Unknown ids throw — no silent
 * default (test-locked).
 */

export type ServiceHueId =
  | 'water' | 'food' | 'fire' | 'danger' | 'collapse' | 'crime'
  | 'coverage' | 'desirability';

/** Locked base hues (band 4) per service — SPEC §4 table. The table is
 *  string-indexed so callers can look ids up dynamically; overlayHue() is the
 *  validated accessor (throws on unknown ids). */
export const SERVICE_HUES: Record<string, string> = {
  water: '#2b7cc4', // blue — wells/aqueducts
  food: '#6fcf5f', // green — granaries/markets
  fire: '#d05b4a', // red — fire risk
  danger: '#e0642c', // orange — structural danger
  collapse: '#8f5a2b', // brown — collapse
  crime: '#a98fd1', // purple — crime
  coverage: '#2aa4a4', // teal — health/education coverage
  desirability: '#2aa4a4', // teal — desirability
};

/** Luminance factors per band: band 4 keeps the base hue, band 0 is 20% of
 *  it — strictly decreasing luminance toward band 0. */
const BAND_FACTORS: readonly number[] = [0.2, 0.4, 0.6, 0.8, 1.0];

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number): string => Math.round(v).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Darken a base hue toward black by the given luminance factor. */
function darken(hue: string, factor: number): string {
  const [r, g, b] = hexToRgb(hue);
  return rgbToHex(r * factor, g * factor, b * factor);
}

/** 5-band ramp for an overlay service: band 4 = base hue, darkening to band 0. */
export function rampFor(hue: string): readonly string[] {
  return BAND_FACTORS.map((f) => darken(hue, f));
}

/**
 * Hue of the given overlay service at band 0..4. Band 4 is the locked base
 * hue (SPEC §4); bands 0..3 darken toward black. Throws on unknown ids so a
 * misspelled service never paints a silent default ramp.
 */
export function overlayHue(id: string, band: number): string {
  const hue = SERVICE_HUES[id as ServiceHueId];
  if (!hue) throw new Error(`unknown overlay service: ${id}`);
  const b = Math.min(4, Math.max(0, Math.floor(band)));
  return darken(hue, BAND_FACTORS[b]);
}
