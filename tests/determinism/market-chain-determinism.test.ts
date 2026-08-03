/**
 * Market-chain chunked determinism (MARK-01/02/03, decision 5 determinism).
 *
 * 1. Runner-level chunk identity with a configured per-market config: same-seed
 *    runner ticks at chunk sizes 1/7/50 (with setMarketConfig on the market)
 *    produce byte-identical getStateJson() for seeds {1, 7, 1337}.
 * 2. Fixed-seed buyer/seller walker micro-sequence over the same seeded stub
 *    run twice from identical state yields identical market/granary stock and
 *    house marketCoverage — the decide/load paths are pure or seeded and never
 *    vary.
 * 3. The market chain introduces no Math.random()/Date.now()/new Date()
 *    invocations in the market model or walkers.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { foodChainMap, buildFoodCity } from '../helpers';
import { defaultMarketConfig } from '../../src/sim/logistics';
import { Map as SimMap } from '../../src/sim/map';
import type { BuildingInstance, SimInternals, WalkerInstance } from '../../src/sim/walkers';
import { createWalker, updateWalker } from '../../src/sim/walkers';
import { mulberry32 } from '../../src/sim/rng';
import type { Vec2 } from '../../src/sim/types';

function chunkedRunJson(seed: number, chunk: number, total: number): string {
  const r = new SimRunner(seed, foodChainMap());
  buildFoodCity(r);
  r.setPolicy(0, 0.5);
  const market = r.getWalkerInternals().buildings.find((b) => b.type === 'market')!;
  const cfg = defaultMarketConfig();
  cfg.productRules.fruit = 'refuse'; // one refused product
  cfg.targetStock = 40; // non-default target stock
  r.setMarketConfig(market.id, cfg);
  let ticked = 0;
  while (ticked < total) {
    const n = Math.min(chunk, total - ticked);
    for (let i = 0; i < n; i++) r.tick();
    ticked += n;
  }
  return r.getStateJson();
}

describe('market-chain chunked determinism with a configured per-market config (MARK-01/02/03, decision 5)', () => {
  it('same seed + commands yield byte-identical snapshots regardless of tick batching (chunks 1/7/50)', () => {
    for (const seed of [1, 7, 1337]) {
      const s1 = chunkedRunJson(seed, 1, 200);
      const s7 = chunkedRunJson(seed, 7, 200);
      const s50 = chunkedRunJson(seed, 50, 200);
      expect(s50).toBe(s7);
      expect(s7).toBe(s1);
    }
  });

  it('different seeds with the same layout are runnable (tick 200, buildings present)', () => {
    const a = JSON.parse(chunkedRunJson(1, 7, 200));
    const b = JSON.parse(chunkedRunJson(7, 7, 200));
    expect(a.tick).toBe(200);
    expect(b.tick).toBe(200);
    expect(a.buildings.length).toBeGreaterThan(0);
  });
});

describe('fixed-seed buyer/seller micro-sequence repeat identity', () => {
  function loopMap(): SimMap {
    const m = new SimMap(6, 4, 'earth');
    for (let x = 0; x < 6; x++) {
      m.set(x, 0, 'road');
      m.set(x, 3, 'road');
    }
    for (let y = 0; y < 4; y++) {
      m.set(0, y, 'road');
      m.set(5, y, 'road');
    }
    return m;
  }

  function inside(b: BuildingInstance, x: number, y: number): boolean {
    return x >= b.x && x < b.x + b.footprint && y >= b.y && y < b.y + b.footprint;
  }

  function roadAround(map: SimMap, b: BuildingInstance): Vec2 | null {
    const n = b.footprint;
    for (let i = 0; i < n; i++) {
      if (map.get(b.x + i, b.y - 1) === 'road') return { x: b.x + i, y: b.y - 1 };
      if (map.get(b.x + i, b.y + n) === 'road') return { x: b.x + i, y: b.y + n };
      if (map.get(b.x - 1, b.y + i) === 'road') return { x: b.x - 1, y: b.y + i };
      if (map.get(b.x + n, b.y + i) === 'road') return { x: b.x + n, y: b.y + i };
    }
    return null;
  }

  function stubBuilding(partial: Partial<BuildingInstance> & { id: number; type: BuildingInstance['type']; x: number; y: number }): BuildingInstance {
    return {
      footprint: 1,
      workersAssigned: 0,
      workersRequired: 0,
      active: false,
      laborConnected: false,
      laborCooldown: 0,
      spawnCooldown: 0,
      stock: {},
      ...partial,
    };
  }

  /** Build an identical fresh stub + buildings; run buyer → deposit then seller →
   *  deliver; return the observable end-state (market/granary stock, house
   *  coverage, load). */
  function runMicroSequence(): unknown {
    const map = loopMap();
    const market = stubBuilding({ id: 1, type: 'market', x: 2, y: 1, stock: { wheat: 0 }, workersRequired: 1, workersAssigned: 1 });
    const granary = stubBuilding({ id: 2, type: 'granary', x: 3, y: 1, stock: { wheat: 100 } });
    const house = stubBuilding({ id: 3, type: 'house', x: 3, y: 0, house: { tier: 0, foodCooldown: 0, waterCooldown: 0, laborCooldown: 0, evolveCounter: 0, devolveCounter: 0 } });
    const buildings = [market, granary, house];
    const despawned: WalkerInstance[] = [];
    const byId = new Map(buildings.map((b) => [b.id, b]));
    const live: WalkerInstance[] = [];
    const sim: SimInternals = {
      map,
      rng: mulberry32(7),
      buildings,
      buildingById: (id) => byId.get(id) ?? null,
      buildingAt: (x, y) => buildings.find((b) => inside(b, x, y)) ?? null,
      adjacentRoadTile: (b) => roadAround(map, b),
      despawn: (w) => {
        despawned.push(w);
        const i = live.indexOf(w);
        if (i >= 0) live.splice(i, 1);
      },
      tick: 1,
      walkers: live,
    };

    // Buyer: reserves 40 at departure, deposits 40 at the market on completion.
    const buyer = createWalker('buyer', 2, 0, 10);
    buyer.marketId = market.id;
    updateWalker(sim, buyer); // reserve at departure
    let guard = 0;
    while (!(buyer.carriedAmount === 0 && buyer.carryingGood === null) && guard++ < 300) updateWalker(sim, buyer);

    // Seller: composes a load from market stock, then delivers one unit to the
    // adjacent house, recording marketCoverage.
    const seller = createWalker('seller', 2, 0, 20);
    seller.marketId = market.id;
    updateWalker(sim, seller); // compose load (market stock falls)
    seller.x = 2;
    seller.y = 0;
    seller.next = null;
    seller.state = 'wandering';
    updateWalker(sim, seller); // deliver to adjacent house (3,0)

    return {
      marketWheat: market.stock.wheat,
      granaryWheat: granary.stock.wheat,
      houseFoodInventory: house.house?.foodInventory,
      houseMarketCoverage: house.house?.marketCoverage,
      sellerCarryingLoad: seller.carryingLoad,
    };
  }

  it('a fixed-seed buyer/seller sequence yields identical stock and coverage across runs', () => {
    const run1 = runMicroSequence();
    const run2 = runMicroSequence();
    expect(run2).toEqual(run1);
    const r = run1 as { marketWheat: number; granaryWheat: number; houseFoodInventory?: Record<string, number>; sellerCarryingLoad?: Record<string, number> };
    // Sanity: the sequence really ran — the granary lost the buyer's 40, the
    // seller reloaded the market (market back to 0) and delivered one wheat to
    // the house (leaving 39 in the load).
    expect(r.granaryWheat).toBe(60);
    expect(r.marketWheat).toBe(0);
    expect(r.houseFoodInventory?.wheat).toBe(1);
    expect(r.sellerCarryingLoad?.wheat).toBe(39);
  });
});

describe('no Math.random / wall-clock in the market chain (MARK-01/02/03 determinism audit)', () => {
  it('src/sim/logistics.ts and walkers.ts introduce no Math.random()/Date.now()/new Date() invocations', () => {
    const root = join(__dirname, '..', '..', 'src');
    for (const file of ['logistics.ts', 'walkers.ts']) {
      const src = readFileSync(join(root, 'sim', file), 'utf8');
      expect(/Math\.random\s*\(/.test(src)).toBe(false);
      expect(/Date\.now\s*\(/.test(src)).toBe(false);
      expect(/new\s+Date\s*\(/.test(src)).toBe(false);
    }
  });
});
