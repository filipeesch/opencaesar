import { CONFIG } from './config';
import type { Rng } from './rng';
import { randFloat } from './rng';
import type { TileQuery, TileType, Vec2 } from './types';

const OUT_OF_BOUNDS: TileQuery = 'out-of-bounds';

/**
 * The tile grid of the simulation. Size-parameterized, constructible from an
 * explicit layout (for scenarios/tests) or procedurally from a seeded RNG.
 */
export class Map {
  readonly width: number;
  readonly height: number;
  private tiles: TileType[][];

  constructor(width: number, height: number, fill: TileType = 'earth') {
    this.width = width;
    this.height = height;
    this.tiles = [];
    for (let y = 0; y < height; y++) {
      const row: TileType[] = [];
      for (let x = 0; x < width; x++) row.push(fill);
      this.tiles.push(row);
    }
  }

  /** Build a map from a layout function; tiles the function returns undefined for stay 'earth'. */
  static fromLayout(width: number, height: number, layout: (x: number, y: number) => TileType | undefined): Map {
    const map = new Map(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = layout(x, y);
        if (t !== undefined) map.tiles[y][x] = t;
      }
    }
    return map;
  }

  /** Default map size used when the game boots without an explicit size. */
  static defaultSize(): number {
    return CONFIG.defaultMapSize;
  }

  /**
   * Procedurally generate a map from a seeded RNG (deterministic for a given seed).
   * Terrain is placed as coherent bodies rather than scattered tiles:
   * a coastal ocean anchored to the north-west corner, a few inland lakes,
   * clustered rocky outcrops, scattered woodland, and fertile soil as patches
   * of at least 2x2 tiles so that farms (2x2, fertile-only) can actually be
   * built on generated maps.
   */
  static generate(width: number, height: number, rng: Rng): Map {
    const map = new Map(width, height, 'earth');

    // A coastal sea anchored to the north-west corner, bleeding off the map
    // edge so it reads as ocean rather than an inland lake.
    const oceanR = 13 + rng.next() * 6;
    blob(map, -oceanR * 0.5, -oceanR * 0.25, oceanR, 'water');

    // A few inland lakes with organic shorelines.
    const lakes = 2 + Math.floor(rng.next() * 2);
    for (let i = 0; i < lakes; i++) {
      blob(map, 6 + rng.next() * (width - 12), 6 + rng.next() * (height - 12), 3 + rng.next() * 3, 'water');
    }

    // Rocky hill clusters (never submerged).
    const outcrops = 3 + Math.floor(rng.next() * 2);
    for (let i = 0; i < outcrops; i++) {
      blob(map, 4 + rng.next() * (width - 8), 4 + rng.next() * (height - 8), 2.5 + rng.next() * 2.5, 'rock');
    }

    // Scattered woodland over the remaining earth.
    map.forEach((x, y, t) => {
      if (t === 'earth' && rng.next() < 0.15) map.set(x, y, 'trees');
    });

    // Fertile soil as coherent patches so farms (which need >=2 fertile tiles)
    // are buildable on generated maps. Bigger, tighter patches than before so
    // fertile land reads as a few farmable regions rather than scattered specks.
    const patches = 3 + Math.floor(rng.next() * 2);
    for (let i = 0; i < patches; i++) {
      const cx = Math.floor(rng.next() * width);
      const cy = Math.floor(rng.next() * height);
      blob(map, cx, cy, 4 + rng.next() * 3, 'fertile');
    }
    // Guarantee at least one buildable farm site: force a full 2x2 fertile
    // square somewhere (a farm needs at least 2 fertile in its footprint, but a
    // solid 2x2 guarantees it on any map).
    outerFarm: for (let y = 1; y < height - 3; y++) {
      for (let x = 1; x < width - 3; x++) {
        if (!(map.get(x, y) === 'water' || map.get(x + 1, y) === 'water' || map.get(x, y + 1) === 'water' || map.get(x + 1, y + 1) === 'water')) {
          map.set(x, y, 'fertile');
          map.set(x + 1, y, 'fertile');
          map.set(x, y + 1, 'fertile');
          map.set(x + 1, y + 1, 'fertile');
          break outerFarm;
        }
      }
    }
    return map;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x: number, y: number): TileQuery {
    if (!this.inBounds(x, y)) return OUT_OF_BOUNDS;
    return this.tiles[y][x];
  }

  set(x: number, y: number, tile: TileType): void {
    if (!this.inBounds(x, y)) return;
    this.tiles[y][x] = tile;
  }

  setRect(x1: number, y1: number, x2: number, y2: number, tile: TileType): void {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) this.set(x, y, tile);
    }
  }

  fill(tile: TileType): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) this.tiles[y][x] = tile;
    }
  }

  forEach(cb: (x: number, y: number, tile: TileType) => void): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) cb(x, y, this.tiles[y][x]);
    }
  }

  /** All tiles in a rectangular region. */
  region(x1: number, y1: number, x2: number, y2: number): TileType[][] {
    const out: TileType[][] = [];
    for (let y = y1; y <= y2; y++) {
      const row: TileType[] = [];
      for (let x = x1; x <= x2; x++) row.push(this.get(x, y) === OUT_OF_BOUNDS ? 'rock' : this.tiles[y][x]);
      out.push(row);
    }
    return out;
  }

  /** Serialize as row-major arrays (stable for golden-file comparisons). */
  toGrid(): TileType[][] {
    return this.tiles.map((row) => [...row]);
  }

  /**
   * Convenience: pick a random in-bounds tile (seeded RNG). Used by property
   * tests and generators, never by gameplay logic.
   */
  randomTile(rng: Rng): Vec2 {
    return { x: Math.floor(randFloat(rng, 0, this.width)), y: Math.floor(randFloat(rng, 0, this.height)) };
  }
}

/** Deterministic 2D hash -> [0, 1). */
function hash2d(x: number, y: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + salt * 1274126177) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295;
}

/**
 * Carve an organic blob of `tile` centred at (cx, cy) with the given radius.
 * The coastline wobbles smoothly via bilinearly-interpolated hash noise (so the
 * shape stays a single connected body) and always keeps a solid core, which
 * guarantees the blob never fragments into scattered specks. Non-water tiles
 * are never carved over existing water, so rock clusters and fertile patches
 * cannot be submerged.
 */
function blob(map: Map, cx: number, cy: number, radius: number, tile: TileType): void {
  const salt = tile === 'water' ? 11 : 23;
  const cell = Math.max(2, radius * 0.5);
  const core = radius * 0.6;
  const reach = radius * 1.5;
  const x0 = Math.max(0, Math.floor(cx - reach - 2));
  const x1 = Math.min(map.width - 1, Math.ceil(cx + reach + 2));
  const y0 = Math.max(0, Math.floor(cy - reach - 2));
  const y1 = Math.min(map.height - 1, Math.ceil(cy + reach + 2));
  const noiseAt = (gx: number, gy: number): number => hash2d(gx, gy, salt) - 0.5;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (tile !== 'water' && map.get(x, y) === 'water') continue;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < core) {
        map.set(x, y, tile);
        continue;
      }
      const gx = x / cell;
      const gy = y / cell;
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      const fx = gx - ix;
      const fy = gy - iy;
      const w00 = noiseAt(ix, iy);
      const w10 = noiseAt(ix + 1, iy);
      const w01 = noiseAt(ix, iy + 1);
      const w11 = noiseAt(ix + 1, iy + 1);
      const wob = (w00 * (1 - fx) + w10 * fx) * (1 - fy) + (w01 * (1 - fx) + w11 * fx) * fy;
      if (d < radius + wob * radius * 0.6) map.set(x, y, tile);
    }
  }
}
