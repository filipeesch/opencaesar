/**
 * Determinism of 21-level housing evolution + merging (Phase 16, HOUS-02).
 *
 * The merge and the satisfied/unsatisfied counter accumulation are derived
 * purely from tick history (tickCount % 40 month cadence, fixed placement-order
 * scan, counter fields) — no RNG or wall-clock anywhere in housing.ts /
 * housingLive.ts / housingMerge.ts / data/housing.ts. This proves:
 *   1. chunked byte identity (1/7/50) for a city that evolves AND merges,
 *   2. fromSaveData -> getStateJson byte identity for the natural economy,
 *   3. the no-RNG/clock file-scope audit over the phase's deterministic files.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';
import { buildFoodCity, foodChainMap } from '../helpers';
import { liveStats } from '../../src/sim/housingLive';
import type { BuildingInstance, HouseInstance } from '../../src/sim/walkers';
import type { BuildingType } from '../../src/sim/types';

/** Deterministic per-tick pump (mirrors the integration scaffold). */
function pumpHouse(h: HouseInstance, meat = false): void {
  h.foodCooldown = 120;
  h.waterCooldown = 120;
  h.laborCooldown = 120;
  h.services = { health: 120, literacy: 120, entertainment: 120 };
  h.godAccess = { jupiter: 120 };
  h.foodInventory = { wheat: 50, vegetables: 50, fruit: 50, fish: 50, meat: meat ? 50 : 0 };
}

function evolveMergeCity(r: SimRunner): void {
  r.requestRoyalSubsidy();
  for (let i = 0; i < 12; i++) r.takeLoan(2000);
  const W = 46;
  for (let x = 0; x < W - 1; x++) for (const y of [4, 12, 20, 28, 36, 44]) r.placeBuilding('road', x, y);
  for (let y = 0; y < W; y++) r.placeBuilding('road', W - 1, y);
  const place = (t: BuildingType, x: number, y: number) => {
    const res = r.placeBuilding(t, x, y);
    if (!res.ok) throw new Error(`place ${t}@(${x},${y}): ${JSON.stringify(res)}`);
  };
  /** Bypass the gov-unlock population gate via the replay path (the placements
   *  still push saveCommands, so save/load replay is byte-identical). */
  const placeGov = (t: 'forum' | 'senate', x: number, y: number) => {
    const rr = r as unknown as { replaying: boolean };
    rr.replaying = true;
    try {
      const res = r.placeBuilding(t, x, y);
      if (!res.ok) throw new Error(`place ${t}@(${x},${y}): ${JSON.stringify(res)}`);
    } finally {
      rr.replaying = false;
    }
  };
  place('farm', 2, 5);
  place('granary', 8, 5);
  place('market', 12, 5);
  place('warehouse', 16, 5);
  place('well', 22, 5);
  place('fountain', 24, 5);
  place('school', 26, 5);
  place('clinic', 28, 5);
  place('library', 30, 5);
  place('hospital', 34, 5);
  place('theatre', 2, 13);
  place('temple', 8, 13);
  place('amphitheatre', 14, 13);
  placeGov('senate', 22, 13);
  placeGov('forum', 28, 13);
  place('garden', 34, 13);
  place('grand_temple', 36, 13);
  for (const [x, y] of [[10, 29], [11, 29]] as Array<[number, number]>) place('house', x, y);
  const wh = (r['buildings'] as BuildingInstance[]).find((b) => b.type === 'warehouse')!;
  const stock = wh.stock as Record<string, number>;
  for (const g of ['pottery', 'furniture', 'wine', 'oil', 'tools']) stock[g] = 200;
  r.setPolicy(0, 0.5);
  // Plant both houses at the footprint-gated level 11 so the month merge step
  // merges them into a 2x2 WITH combinedPopulation (held without meat so they
  // never evolve past 11 and clear the override).
  const [a, b] = (r['buildings'] as BuildingInstance[]).filter((x) => x.type === 'house');
  a.house!.level = 11;
  b.house!.level = 11;
}

function chunkedEvolveMerge(seed: number, chunk: number, total: number): string {
  const m = SimMap.fromLayout(46, 46, () => 'fertile');
  const r = new SimRunner(seed, m);
  evolveMergeCity(r);
  const ids = (r['buildings'] as BuildingInstance[]).filter((x) => x.type === 'house').map((x) => x.id);
  let ticked = 0;
  while (ticked < total) {
    const n = Math.min(chunk, total - ticked);
    for (let i = 0; i < n; i++) {
      for (const b of r['buildings'] as BuildingInstance[]) if (ids.includes(b.id)) pumpHouse(b.house!);
      r.tick();
    }
    ticked += n;
  }
  return r.getStateJson();
}

describe('housing evolution + merge chunked determinism (Phase 16)', () => {
  it('a city that evolves AND merges is byte-identical across chunks 1/7/50', () => {
    for (const seed of [1, 7, 1337]) {
      const a = chunkedEvolveMerge(seed, 1, 200);
      const b = chunkedEvolveMerge(seed, 7, 200);
      const c = chunkedEvolveMerge(seed, 50, 200);
      expect(a, `seed ${seed} chunk 1 vs 7`).toBe(b);
      expect(b, `seed ${seed} chunk 7 vs 50`).toBe(c);
    }
  });

  it('the merged city went through a 2x2 merge (footprint/combined population byte-identity)', () => {
    const m = SimMap.fromLayout(46, 46, () => 'fertile');
    const r = new SimRunner(7, m);
    evolveMergeCity(r);
    const ids = (r['buildings'] as BuildingInstance[]).filter((x) => x.type === 'house').map((x) => x.id);
    for (let i = 0; i < 90; i++) {
      for (const b of r['buildings'] as BuildingInstance[]) if (ids.includes(b.id)) pumpHouse(b.house!);
      r.tick();
    }
    const state = JSON.parse(r.getStateJson());
    const mergedHouse = r['buildings'].find((b: BuildingInstance) => b.type === 'house' && b.footprint === 2);
    expect(mergedHouse).toBeDefined();
    expect(mergedHouse!.house!.combinedPopulation).toBe(2 * liveStats(11).population);
    expect(state.messages.some((mm: { type: string }) => mm.type === 'house-merged')).toBe(true);
  });
});

describe('save->load determinism on the natural economy', () => {
  it('fromSaveData round-trips byte-identically (counters included)', () => {
    const buildTick = (ticks: number) => {
      const r = new SimRunner(7, foodChainMap());
      buildFoodCity(r);
      r.setPolicy(0, 0.5);
      for (let i = 0; i < ticks; i++) r.tick();
      return r;
    };
    const r = buildTick(1200);
    // Round-trip onto the SAME custom map (food-chain layout) so replay
    // reconstructs the city identically — the established repo convention
    // for custom-map saves (export-window/event-response determinism).
    const loaded = SimRunner.fromSaveData(r.getSaveData(), foodChainMap());
    expect(loaded.getStateJson()).toBe(r.getStateJson());
    expect(loaded.getState().tick).toBe(r.getState().tick);
  });
});

describe('no RNG / wall-clock in the housing evolution + merge chain', () => {
  it('housing.ts / housingLive.ts / housingMerge.ts / data/housing.ts are deterministic', () => {
    const root = join(__dirname, '..', '..');
    for (const file of ['src/sim/housing.ts', 'src/sim/housingLive.ts', 'src/sim/housingMerge.ts', 'data/housing.ts']) {
      const src = readFileSync(join(root, file), 'utf8');
      expect(/Math\.random\s*\(/.test(src), `${file}: Math.random()`).toBe(false);
      expect(/Date\.now\s*\(/.test(src), `${file}: Date.now()`).toBe(false);
      expect(/new\s+Date\s*\(/.test(src), `${file}: new Date()`).toBe(false);
    }
  });
});
