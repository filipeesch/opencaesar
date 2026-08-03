import { describe, expect, it } from 'vitest';
import { Map as SimMap } from '../../src/sim/map';
import { mulberry32 } from '../../src/sim/rng';
import type { TileType } from '../../src/sim/types';

function hasBuildableFarmSite(map: SimMap): boolean {
  let found = false;
  map.forEach((x, y, t) => {
    if (found || t !== 'fertile') return;
    if (x + 2 > map.width || y + 2 > map.height) return;
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        if (map.get(x + dx, y + dy) !== 'fertile') return;
      }
    }
    found = true;
  });
  return found;
}

/** Count 4-connected components of `tile` (orthogonal neighbours only). */
function countComponents(map: SimMap, tile: TileType): number {
  const seen = new Set<number>();
  const w = map.width;
  let components = 0;
  const flood = (startX: number, startY: number): void => {
    const stack: Array<[number, number]> = [[startX, startY]];
    seen.add(startY * w + startX);
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= map.height) continue;
        if (map.get(nx, ny) !== tile) continue;
        const key = ny * w + nx;
        if (seen.has(key)) continue;
        seen.add(key);
        stack.push([nx, ny]);
      }
    }
  };
  map.forEach((x, y, t) => {
    if (t !== tile || seen.has(y * w + x)) return;
    components++;
    flood(x, y);
  });
  return components;
}

describe('generated maps', () => {
  it('always contain at least one 2x2 fertile patch so farms are buildable', () => {
    for (let seed = 0; seed < 25; seed++) {
      const map = SimMap.generate(40, 40, mulberry32(seed));
      expect(hasBuildableFarmSite(map), `seed ${seed}`).toBe(true);
    }
  });

  it('render water as a few connected bodies (ocean/lakes), not scattered tiles', () => {
    for (let seed = 0; seed < 25; seed++) {
      const map = SimMap.generate(40, 40, mulberry32(seed));
      const components = countComponents(map, 'water');
      expect(components, `seed ${seed} water components`).toBeLessThanOrEqual(6);
    }
  });

  it('render rock as a few connected clusters, not scattered tiles', () => {
    for (let seed = 0; seed < 25; seed++) {
      const map = SimMap.generate(40, 40, mulberry32(seed));
      const components = countComponents(map, 'rock');
      expect(components, `seed ${seed} rock components`).toBeLessThanOrEqual(8);
    }
  });

  it('leave enough buildable land for a city', () => {
    for (let seed = 0; seed < 10; seed++) {
      const map = SimMap.generate(40, 40, mulberry32(seed));
      let land = 0;
      map.forEach((_x, _y, t) => {
        if (t !== 'water') land++;
      });
      expect(land / (map.width * map.height), `seed ${seed} land share`).toBeGreaterThan(0.6);
    }
  });

  it('are deterministic for a given seed', () => {
    const a = SimMap.generate(40, 40, mulberry32(1337)).toGrid();
    const b = SimMap.generate(40, 40, mulberry32(1337)).toGrid();
    expect(b).toEqual(a);
  });

  it('WR-02: every generated map carries a full-footprint deposit region of each kind (clay/iron 2x2, marble 3x3) on buildable land', () => {
    // Without deposit seeding, live-play extraction of clay/iron/marble would be
    // permanently blocked by the deposit gate — only timber (trees terrain)
    // could produce. Each generated map must guarantee a footprint-sized block
    // of every resource on non-water land so each extraction site is buildable.
    const cases = [
      { kind: 'clay_deposit', footprint: 2 },
      { kind: 'iron_deposit', footprint: 2 },
      { kind: 'marble_deposit', footprint: 3 },
    ] as const;
    for (let seed = 0; seed < 25; seed++) {
      const map = SimMap.generate(40, 40, mulberry32(seed));
      for (const { kind, footprint } of cases) {
        let found = false;
        map.forEach((x, y, t) => {
          if (found || t === 'water') return;
          if (x + footprint > map.width || y + footprint > map.height) return;
          let ok = true;
          for (let dy = 0; dy < footprint && ok; dy++) {
            for (let dx = 0; dx < footprint; dx++) {
              if (map.tileState(x + dx, y + dy).resourceType !== kind) { ok = false; break; }
            }
          }
          if (ok) found = true;
        });
        expect(found, `seed ${seed} ${kind}`).toBe(true);
      }

      // A full 2x2 trees patch so the timber yard's full-footprint gate is
      // buildable too.
      let treesOk = false;
      map.forEach((x, y, t) => {
        if (treesOk || t !== 'trees') return;
        if (x + 2 > map.width || y + 2 > map.height) return;
        if (map.get(x + 1, y) === 'trees' && map.get(x, y + 1) === 'trees' && map.get(x + 1, y + 1) === 'trees') treesOk = true;
      });
      expect(treesOk, `seed ${seed} trees 2x2`).toBe(true);
    }
  });
});
