import { describe, it, expect } from 'vitest';
// Phase 20 Wave 0 RED scaffold: per-service overlay hue contract.
// Imports the target module Wave 2 implements. Fails today: module absent.
import { SERVICE_HUES, overlayHue } from '../../src/game/ui/overlays';

/**
 * Locked base hues (band 4) per service from SPEC §4. Ramps darken toward band 0.
 */
const LOCKED_HUES: Record<string, string> = {
  water: '#2b7cc4', // blue — wells/aqueducts
  food: '#6fcf5f', // green — granaries/markets
  fire: '#d05b4a', // red — fire risk
  danger: '#e0642c', // orange — structural danger
  collapse: '#8f5a2b', // brown — collapse
  crime: '#a98fd1', // purple — crime
  coverage: '#2aa4a4', // teal — health/education coverage
  desirability: '#2aa4a4', // teal — desirability
};

describe('overlay hues (per-service palette)', () => {
  it('exports a SERVICE_HUES table covering every overlay service', () => {
    expect(SERVICE_HUES).toBeDefined();
    for (const id of Object.keys(LOCKED_HUES)) {
      expect(SERVICE_HUES[id], `SERVICE_HUES missing ${id}`).toBeDefined();
    }
  });

  it('band-4 base hues match the locked per-service table', () => {
    for (const [id, hue] of Object.entries(LOCKED_HUES)) {
      expect(overlayHue(id, 4), `${id} base hue (band 4)`).toBe(hue);
    }
  });

  it('overlayHue returns a 5-band ramp (0..4) that darkens toward band 0', () => {
    for (const id of Object.keys(LOCKED_HUES)) {
      const ramp = [0, 1, 2, 3, 4].map((b) => overlayHue(id, b));
      expect(ramp.length).toBe(5);
      expect(ramp[4], `${id} band 4 base`).toBe(LOCKED_HUES[id]);
      // Each band is a valid #rrggbb hex.
      for (const hex of ramp) {
        expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
      }
      // Darkening: luminance strictly decreases from band 4 -> band 0.
      const lum = ramp.map((hex) => {
        const n = Number.parseInt(hex.slice(1), 16);
        return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
      });
      for (let i = 0; i < 4; i++) {
        expect(lum[i], `${id} band ${i} must be darker than band ${i + 1}`).toBeLessThan(lum[i + 1]);
      }
    }
  });

  it('unknown overlay id throws (no silent default)', () => {
    expect(() => overlayHue('not-a-service', 4)).toThrow();
  });
});
