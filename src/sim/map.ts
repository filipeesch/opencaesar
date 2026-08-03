import { CONFIG } from './config';
import type { Rng } from './rng';
import { randFloat } from './rng';
import type { TileQuery, TileType, Vec2 } from './types';
import type { RoadType } from './roadTypes';
import type { TileState } from './tile';
import { defaultTileState } from './tile';

const OUT_OF_BOUNDS: TileQuery = 'out-of-bounds';

/**
 * The tile grid of the simulation. Size-parameterized, constructible from an
 * explicit layout (for scenarios/tests) or procedurally from a seeded RNG.
 */
export class Map {
  readonly width: number;
  readonly height: number;
  private tiles: TileType[][];
  private states: TileState[][];

  constructor(width: number, height: number, fill: TileType = 'earth') {
    this.width = width;
    this.height = height;
    this.tiles = [];
    this.states = [];
    for (let y = 0; y < height; y++) {
      const row: TileType[] = [];
      const srow: TileState[] = [];
      for (let x = 0; x < width; x++) {
        row.push(fill);
        srow.push(defaultTileState());
      }
      this.tiles.push(row);
      this.states.push(srow);
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

    // Deposit seeding (WR-02): without this, TileState.resourceType is only
    // ever written by test helpers, so on every generated map (real gameplay)
    // the clay pit, iron mine and marble quarry would be permanently blocked by
    // their own deposit gate — only the timber yard could ever produce. We seed
    // deposits deterministically (seeded RNG only, no Math.random): a few
    // ambient clusters per resource for variety, plus a guaranteed full-footprint
    // block per resource (mirroring the fertile-farm guarantee above) so every
    // seed is guaranteed a buildable site of each kind.
    seedDeposits(map, width, height, rng);
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

  /** Read the expanded per-tile state. Falls back to a default if never set. */
  tileState(x: number, y: number): TileState {
    if (this.inBounds(x, y) && this.states[y]) return this.states[y][x];
    return defaultTileState();
  }

  /** Mutate the expanded per-tile state in place (no-op when out of bounds). */
  mutateTileState(x: number, y: number, fn: (s: TileState) => void): void {
    if (!this.inBounds(x, y) || !this.states[y]) return;
    fn(this.states[y][x]);
  }

  /** Road-type refinement of a tile (null = plain dirt road) or null when out of
   *  bounds / never set. Terrain authority is untouched — 'road' stays 'road'. */
  roadTypeAt(x: number, y: number): RoadType | null {
    if (!this.inBounds(x, y) || !this.states[y]) return null;
    return this.states[y][x].roadType;
  }

  /** Set the road-type refinement of a tile (null resets to plain dirt road);
   *  no-ops when out of bounds. Does not change terrain. */
  setRoadType(x: number, y: number, type: RoadType | null): void {
    if (!this.inBounds(x, y) || !this.states[y]) return;
    this.states[y][x].roadType = type;
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

/**
 * Deposit resources (WR-02): the resourceType each extraction building needs
 * under its full footprint, mapped to the footprint size. Clay/iron use 2x2
 * sites (clay pit, iron mine), marble needs a 3x3 (marble quarry).
 */
const DEPOSIT_LAYOUT: ReadonlyArray<{ kind: string; footprint: number }> = [
  { kind: 'clay_deposit', footprint: 2 },
  { kind: 'iron_deposit', footprint: 2 },
  { kind: 'marble_deposit', footprint: 3 },
];

/**
 * Seed deposit resourceType tiles on a generated map (WR-02). Deterministic —
 * the only randomness flows through the injected seeded RNG (never
 * Math.random), so a given seed yields identical deposits across runs and the
 * sim body continues the same RNG stream the map generation consumed.
 *
 * Strategy, mirroring the terrain generation: a few ambient clusters per
 * resource for map variety, PLUS a guaranteed full-footprint block per resource
 * (deterministic scan, no RNG) so every seed is buildable for each extraction
 * kind — and a guaranteed 2x2 trees patch so the timber yard's full-footprint
 * gate has forest terrain to sit on too.
 */
function seedDeposits(map: Map, width: number, height: number, rng: Rng): void {
  // Ambient deposit clusters (seeded RNG): carve organic patches over land.
  for (const { kind, footprint } of DEPOSIT_LAYOUT) {
    const clusters = 2 + Math.floor(rng.next() * 2);
    const radius = footprint + 1;
    for (let i = 0; i < clusters; i++) {
      const cx = footprint + rng.next() * Math.max(1, width - footprint * 2);
      const cy = footprint + rng.next() * Math.max(1, height - footprint * 2);
      carveDeposit(map, cx, cy, radius, kind);
    }
  }

  // Guaranteed buildable full-footprint block per deposit kind (no RNG) so a
  // site placed there passes the full-footprint deposit gate on any map.
  for (const { kind, footprint } of DEPOSIT_LAYOUT) {
    guaranteeDepositBlock(map, kind, footprint);
  }

  // Guarantee a solid 2x2 trees patch for the timber yard (2x2 footprint).
  guaranteeTreesBlock(map);
}

/** Carve an organic blob of `resourceType` over land (never water). */
function carveDeposit(map: Map, cx: number, cy: number, radius: number, kind: string): void {
  const r = Math.max(2, radius);
  const salt = kind === 'clay_deposit' ? 31 : kind === 'iron_deposit' ? 37 : 41;
  const x0 = Math.max(0, Math.floor(cx - r - 1));
  const x1 = Math.min(map.width - 1, Math.ceil(cx + r + 1));
  const y0 = Math.max(0, Math.floor(cy - r - 1));
  const y1 = Math.min(map.height - 1, Math.ceil(cy + r + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (map.get(x, y) === 'water') continue;
      const dx = x - cx;
      const dy = y - cy;
      const wob = hash2d(x, y, salt) - 0.5;
      if (Math.sqrt(dx * dx + dy * dy) <= r + wob * r * 0.35) {
        map.mutateTileState(x, y, (s) => {
          s.resourceType = kind;
        });
      }
    }
  }
}

/**
 * Force a full `footprint`x`footprint` block of `kind` somewhere on non-water
 * land — the deposit-gate equivalent of the fertile-farm guarantee.
 */
function guaranteeDepositBlock(map: Map, kind: string, footprint: number): void {
  for (let y = 1; y <= map.height - footprint - 1; y++) {
    for (let x = 1; x <= map.width - footprint - 1; x++) {
      let land = true;
      for (let dy = 0; dy < footprint; dy++) {
        for (let dx = 0; dx < footprint; dx++) {
          if (map.get(x + dx, y + dy) === 'water') {
            land = false;
            break;
          }
        }
        if (!land) break;
      }
      if (!land) continue;
      for (let dy = 0; dy < footprint; dy++) {
        for (let dx = 0; dx < footprint; dx++) {
          map.mutateTileState(x + dx, y + dy, (s) => {
            s.resourceType = kind;
          });
        }
      }
      return;
    }
  }
}

/**
 * Force a solid 2x2 trees patch on non-water, non-fertile land so the timber
 * yard (2x2 footprint, full-footprint trees gate) is buildable on any map.
 * Skips fertile so it never overwrites the farm guarantee block.
 */
function guaranteeTreesBlock(map: Map): void {
  for (let y = 1; y <= map.height - 3; y++) {
    for (let x = 1; x <= map.width - 3; x++) {
      const land =
        map.get(x, y) !== 'water' && map.get(x, y) !== 'fertile' &&
        map.get(x + 1, y) !== 'water' && map.get(x + 1, y) !== 'fertile' &&
        map.get(x, y + 1) !== 'water' && map.get(x, y + 1) !== 'fertile' &&
        map.get(x + 1, y + 1) !== 'water' && map.get(x + 1, y + 1) !== 'fertile';
      if (!land) continue;
      map.set(x, y, 'trees');
      map.set(x + 1, y, 'trees');
      map.set(x, y + 1, 'trees');
      map.set(x + 1, y + 1, 'trees');
      return;
    }
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
