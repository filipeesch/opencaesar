import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';

/**
 * Civilization overlay (SAFE-03 / W3): per-tile fire / danger / collapse /
 * crime grids projected from the live per-building safety state. Every painted
 * tile traces back to a building footprint.
 */

const W = 40;
const H = 30;

function denseMap(): SimMap {
  const m = new SimMap(W, H, 'earth');
  for (let x = 0; x < W; x++) {
    m.set(x, 17, 'road');
    m.set(x, 19, 'road');
    m.set(x, 21, 'road');
    m.set(x, 23, 'road');
  }
  for (let y = 0; y < H; y++) {
    m.set(10, y, 'road');
    m.set(25, y, 'road');
  }
  return m;
}

function buildDenseCity(r: SimRunner): void {
  for (let x = 3; x <= 7; x++) for (const y of [18, 20, 22]) r.placeBuilding('house', x, y);
}

describe('civilization overlay', () => {
  it('returns fire/danger/collapse/crime grids sized to the map', () => {
    const r = new SimRunner(5, denseMap());
    buildDenseCity(r);
    for (let i = 0; i < 10; i++) r.tick();
    const ov = r.getCivilizationOverlay();
    expect(Object.keys(ov).sort()).toEqual(['collapse', 'crime', 'danger', 'fire']);
    for (const grid of Object.values(ov)) {
      expect(grid.length).toBe(H);
      expect(grid[0].length).toBe(W);
    }
  });

  it('paints every building footprint onto the fire grid', () => {
    const r = new SimRunner(5, denseMap());
    buildDenseCity(r);
    for (let i = 0; i < 10; i++) r.tick();
    const ov = r.getCivilizationOverlay();
    for (let x = 3; x <= 7; x++) for (const y of [18, 20, 22]) {
      expect(typeof ov.fire[y][x]).toBe('number');
      expect(ov.fire[y][x]).toBe(0);
    }
    // Bare earth between the blocks stays unpainted (roads are not buildings).
    expect(ov.fire[17][5]).toBe(0);
  });

  it('destroyed buildings read fire=1 and danger=1 on their footprint', () => {
    const r = new SimRunner(1, denseMap());
    buildDenseCity(r);
    let sawDestroyed = false;
    for (let i = 0; i < 200; i++) {
      r.tick();
      const ov = r.getCivilizationOverlay();
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (ov.fire[y][x] === 1) {
            sawDestroyed = true;
            expect(ov.danger[y][x]).toBe(1);
          }
          expect(ov.fire[y][x]).toBeGreaterThanOrEqual(0);
          expect(ov.fire[y][x]).toBeLessThanOrEqual(1);
          expect(ov.crime[y][x]).toBeGreaterThanOrEqual(0);
          expect(ov.crime[y][x]).toBeLessThanOrEqual(1);
          expect(ov.collapse[y][x]).toBeGreaterThanOrEqual(0);
          expect(ov.collapse[y][x]).toBeLessThanOrEqual(1);
          expect(ov.danger[y][x] === 0 || ov.danger[y][x] === 1).toBe(true);
        }
      }
    }
    expect(sawDestroyed).toBe(true);
  });

  it('crime grid reflects prefecture coverage', () => {
    const covered = new SimRunner(5, denseMap());
    buildDenseCity(covered);
    covered.placeBuilding('prefecture', 5, 24);
    for (let i = 0; i < 400; i++) covered.tick();
    const ov = covered.getCivilizationOverlay();
    let maxCrime = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ov.crime[y][x] > maxCrime) maxCrime = ov.crime[y][x];
    expect(maxCrime).toBeLessThanOrEqual(0.01);
  });
});
