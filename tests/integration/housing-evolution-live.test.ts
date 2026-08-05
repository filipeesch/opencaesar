/**
 * Live housing evolution + hysteresis + merge integration (Phase 16,
 * HOUS-01 / HOUS-02).
 *
 * Uses real SimRunner cities (all-fertile, road grid, real service buildings,
 * a stocked warehouse for the non-food cumulative good ladder) with a
 * deterministic per-tick pump for the houses UNDER TEST — the pump keeps the
 * living requirements (cooldowns, wellness services, god access, per-house food
 * inventory) continuously satisfied so the decideEvolution path is exercised
 * without walker-latency flakiness. The control house is never pumped and stays
 * at the natural food+water+services floor.
 *
 * Describes (targetable individually with `vitest -t`):
 *   - 'progression': a fully-served house climbs the 21-level ladder via
 *     decideEvolution; a control caps at the floor; at most one level per
 *     eligibility period; level names appear in house-evolved messages.
 *   - 'devolve': removing the only water source + holding past toleranceTicks
 *     devolves the house; the grace period prevents immediate oscillation.
 *   - 'merge': adjacent same-level houses merge on the month cadence — 2x2 at a
 *     footprint-gated level and 4x4 at the top of the ladder — with combined
 *     population, occupiedTiles re-keyed, absorbed instance gone, house-merged.
 */
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';
import { DEFAULT_HYSTERESIS } from '../../src/sim/housingEvolution';
import { liveStats, tierOfLevel } from '../../src/sim/housingLive';
import type { BuildingInstance, HouseInstance } from '../../src/sim/walkers';
import type { BuildingType } from '../../src/sim/types';

const MIN_TICKS = DEFAULT_HYSTERESIS.minSatisfiedTicks;
const tileKey = (x: number, y: number): number => (x << 20) | y;

/** Bypass the gov-unlock population gate (forum/senate unlock at 250/500 pop):
 *  these pumped scenarios hold the houses at their starting levels by design,
 *  so no lasting population is grown before the government buildings are placed.
 *  Uses the replay path, which records the same saveCommands a real placement
 *  would, keeping save/load replay byte-identical. Test-only gate bypass. */
function placeGov(r: SimRunner, type: 'forum' | 'senate', x: number, y: number): void {
  const rr = r as unknown as { replaying: boolean };
  rr.replaying = true;
  try {
    const res = r.placeBuilding(type, x, y);
    if (!res.ok) throw new Error(`place ${type}@(${x},${y}): ${JSON.stringify(res)}`);
  } finally {
    rr.replaying = false;
  }
}

/** All-fertile 46x46 service city with a road grid and every cumulative service. */
function serviceCity(houseSlots: Array<[number, number]>): SimRunner {
  const W = 46;
  const m = SimMap.fromLayout(W, W, () => 'fertile');
  const r = new SimRunner(7, m);
  const place = (t: BuildingType, x: number, y: number) => {
    const res = r.placeBuilding(t, x, y);
    if (!res.ok) throw new Error(`place ${t}@(${x},${y}): ${JSON.stringify(res)}`);
  };
  r.requestRoyalSubsidy();
  for (let i = 0; i < 12; i++) r.takeLoan(2000);
  // Road rows every 8 tiles (bands of 7 free rows) + a vertical spine for reachability.
  for (let x = 0; x < W - 1; x++) for (const y of [4, 12, 20, 28, 36, 44]) place('road', x, y);
  for (let y = 0; y < W; y++) place('road', W - 1, y);
  // Services/cluster in band y=5..11 (top-anchored at y=5).
  place('farm', 2, 5); // 3x3
  place('granary', 8, 5); // 2x2
  place('market', 12, 5); // 2x2
  place('warehouse', 16, 5); // 2x2
  place('well', 22, 5);
  place('fountain', 24, 5);
  place('school', 26, 5);
  place('clinic', 28, 5);
  place('library', 30, 5); // 2x2
  place('hospital', 34, 5); // 2x2
  // Civic/leisure/religion/gov in band y=13..19.
  place('theatre', 2, 13); // 3x3
  place('temple', 8, 13); // 2x2
  place('amphitheatre', 14, 13); // 4x4
  placeGov(r, 'senate', 22, 13); // 3x3 (gov unlock gate bypassed)
  placeGov(r, 'forum', 28, 13); // 3x3 (gov unlock gate bypassed)
  place('garden', 34, 13);
  place('grand_temple', 36, 13); // 4x4
  // Houses (top-anchored at y=29, road y=28 above).
  for (const [x, y] of houseSlots) place('house', x, y);
  r.setPolicy(0, 0.5);
  // Stock the warehouse with every non-food cumulative requirement.
  const wh = (r['buildings'] as BuildingInstance[]).find((b) => b.type === 'warehouse')!;
  const stock = wh.stock as Record<string, number>;
  for (const g of ['pottery', 'furniture', 'wine', 'oil', 'tools']) stock[g] = 200;
  return r;
}

function housesOf(r: SimRunner): BuildingInstance[] {
  return (r['buildings'] as BuildingInstance[]).filter((b) => b.type === 'house');
}

function maxLevel(r: SimRunner): number {
  return Math.max(...housesOf(r).map((b) => b.house!.level ?? 0));
}

/**
 * Deterministic per-tick pump: keeps food/water/labor cooldowns, wellness
 * services, god access and the per-house food inventory continuous. `meat`
 * gates the level-12+ food requirement so a house can be held exactly at a
 * given level (used to hold a merge-eligible level until the month merge step).
 */
function pumpHouse(h: HouseInstance, opts: { meat?: boolean } = {}): void {
  h.foodCooldown = 120;
  h.waterCooldown = 120;
  h.laborCooldown = 120;
  h.services = { health: 120, literacy: 120, entertainment: 120 };
  h.godAccess = { jupiter: 120 };
  h.foodInventory = { wheat: 50, vegetables: 50, fruit: 50, fish: 50, meat: opts.meat ? 50 : 0 };
}

function pumpAndTick(r: SimRunner, ids: number[], fn: (h: HouseInstance) => void, n: number): void {
  for (let i = 0; i < n; i++) {
    for (const b of housesOf(r)) if (ids.includes(b.id)) fn(b.house!);
    // WAGE-MECHANIC ISOLATION (test-only, mirrors the pump's walker-latency
    // bypass and placeGov's gate bypass): keep the tiny 2-house city's treasury
    // funded so the unpaid-wages desirability penalty never distorts the
    // 21-level housing ladder under test — a real city earns this from many
    // houses + trade, which these evolution-focused scenarios don't model.
    (r as unknown as { treasuryAccount: { balance: number } }).treasuryAccount.balance = 5000;
    r.tick();
  }
}

function buildingState(r: SimRunner, id: number) {
  return r.getState().buildings.find((b) => b.id === id);
}

describe('progression (HOUS-01 live 21-level ladder)', () => {
  it('a fully-served house reaches a high level via decideEvolution while a control caps at the floor', () => {
    const r = serviceCity([[0, 29], [4, 29]]);
    const [target, control] = housesOf(r);
    pumpAndTick(r, [target.id], (h) => pumpHouse(h, { meat: true }), 1500);

    const t = buildingState(r, target.id)!;
    const c = buildingState(r, control.id)!;
    expect(t.house!.level).toBeGreaterThanOrEqual(11);
    // house.tier is the derived bucket of house.level, never the decision source.
    expect(t.house!.tier).toBe(tierOfLevel(t.house!.level));
    // the unpumped control stays at the food+water+services floor (no foodInventory → no wheat).
    expect(c.house!.level).toBeLessThanOrEqual(1);
    // level names appear in the house-evolved messages.
    expect(r.getState().messages.some((m) => m.type === 'house-evolved' && /^House evolved to /.test(m.text))).toBe(true);
    // population/tax/workers scale via the 21-level stats (never NaN).
    expect(r.getState().ratings.population).toBeGreaterThan(0);
    expect(Number.isFinite(r.getState().ratings.population)).toBe(true);
  });

  it('a sustained maximally-desirable house climbs at least to level 16 (cap-30 ladder reachable)', () => {
    const r = serviceCity([[0, 29], [4, 29]]);
    const [target] = housesOf(r);
    pumpAndTick(r, [target.id], (h) => pumpHouse(h, { meat: true }), 2000);
    expect(maxLevel(r)).toBeGreaterThanOrEqual(16);
    expect(buildingState(r, target.id)!.house!.level).toBe(maxLevel(r));
  });

  it('steps at most one level per eligibility period (minSatisfiedTicks respected)', () => {
    const r = serviceCity([[0, 29], [4, 29]]);
    const [target] = housesOf(r);
    pumpAndTick(r, [target.id], (h) => pumpHouse(h, { meat: true }), 3 * MIN_TICKS + 2);
    const t = buildingState(r, target.id)!;
    // Houses place at the occupied baseline (level 1), so after ~3*60 ticks a
    // well-served house has passed at most 3 evolve windows → max level 1+3.
    expect(t.house!.level).toBeLessThanOrEqual(4);
  });
});

describe('devolve (HOUS-02 hysteresis + tolerance)', () => {
  function devolveCity(): SimRunner {
    const r = serviceCity([[0, 29], [4, 29]]);
    const well = (r['buildings'] as BuildingInstance[]).find((b) => b.type === 'well')!;
    // keep a single well for water (demolished to devolve); the fountain provides no water source.
    const fountain = (r['buildings'] as BuildingInstance[]).find((b) => b.type === 'fountain')!;
    r.demolish(fountain.x, fountain.y);
    void well;
    return r;
  }

  it('losing the only water source devolves past toleranceTicks and does not oscillate', () => {
    const r = devolveCity();
    const target = housesOf(r)[0];
    // climb to a mid level (well -> water coverage, market, wheat, pottery).
    pumpAndTick(r, [target.id], (h) => pumpHouse(h, { meat: true }), 500);
    const before = (r['buildings'] as BuildingInstance[]).find((b) => b.id === target.id)!.house!.level ?? 0;
    expect(before).toBeGreaterThanOrEqual(3);

    // demolish the ONLY well and stop pumping — water lapses, then the tolerance window.
    const well = (r['buildings'] as BuildingInstance[]).find((b) => b.type === 'well')!;
    r.demolish(well.x, well.y);
    for (let i = 0; i < 400; i++) r.tick();

    let house = (r['buildings'] as BuildingInstance[]).find((b) => b.id === target.id)!;
    expect(house.house!.level ?? 0).toBeLessThan(before);
    expect(r.getState().messages.some((m) => m.type === 'house-devolved')).toBe(true);

    // grace period: level never rebounds (no evolve/devolve oscillation).
    const floorAfter = house.house!.level ?? 0;
    for (let i = 0; i < 100; i++) r.tick();
    house = (r['buildings'] as BuildingInstance[]).find((b) => b.id === target.id)!;
    expect(house.house!.level ?? 0).toBeLessThanOrEqual(floorAfter);
  });
});

describe('merge (HOUS-02 deterministic adjacent-house merging)', () => {
  it('merges two adjacent same-level 1x1 houses into a 2x2 at a footprint-gated level', () => {
    const r = serviceCity([[10, 29], [11, 29]]);
    const [a, b] = housesOf(r);
    // directly plant both at the footprint-gated level 11 (merge ladder: 2x2),
    // held without meat so they stay at exactly 11 until the month merge step.
    a.house!.level = 11;
    b.house!.level = 11;
    pumpAndTick(r, [a.id, b.id], (h) => pumpHouse(h, { meat: false }), 91);

    const survivors = housesOf(r);
    const merged = survivors.find((s) => s.footprint === 2);
    expect(merged, 'a 2x2 merged survivor should exist').toBeDefined();
    expect(merged!.house!.level).toBe(11);
    expect(merged!.house!.combinedPopulation).toBe(2 * liveStats(11).population);
    expect(survivors.some((s) => s.id !== merged!.id || s.footprint === 1)).toBe(false);

    // occupiedTiles re-keyed: buildingAt resolves the survivor on both original tiles.
    const occ = (r as any).occupiedTiles as Map<number, number>;
    expect(occ.get(tileKey(10, 29))).toBe(merged!.id);
    expect(occ.get(tileKey(11, 29))).toBe(merged!.id);
    expect((r as any).buildingAt(10, 30)!.id).toBe(merged!.id);
    expect(r.getState().messages.some((m) => m.type === 'house-merged')).toBe(true);

    // CR-02: the combined population is NOT write-only — the city-level
    // consumers (population, workers, serialized capacity) all see the doubled
    // merged block. Old behavior counted 240; the merged 2x2 counts 480.
    const s = r.getState();
    expect(s.ratings.population).toBe(2 * liveStats(11).population);
    expect(s.totalWorkers).toBe(2 * liveStats(11).workers);
    const mergedState = s.buildings.find((bb) => bb.id === merged!.id)!;
    expect(mergedState.house!.populationCapacity).toBe(2 * liveStats(11).population);
  });

  it('merges two 2x2 houses into a 4x4 at the top of the ladder (levels 19-20)', () => {
    const r = serviceCity([[20, 29], [21, 29], [22, 29], [23, 29]]);
    const [h0, h1, h2, h3] = housesOf(r);
    // Construct two 2x2 survivors at level 20 (as if two earlier merges occurred):
    // survivor A at (20,29) covering (20..21,29..30), survivor B at (22,29).
    h0.house!.level = 20;
    h0.footprint = 2;
    h2.house!.level = 20;
    h2.footprint = 2;
    const occ = (r as any).occupiedTiles as Map<number, number>;
    for (const [x, y] of [[20, 29], [21, 29], [20, 30], [21, 30]]) occ.set(tileKey(x, y), h0.id);
    for (const [x, y] of [[22, 29], [23, 29], [22, 30], [23, 30]]) occ.set(tileKey(x, y), h2.id);
    (r as any).buildings = (r as any).buildings.filter((b: BuildingInstance) => b.id !== h1.id && b.id !== h3.id);
    (r as any).buildingById.delete(h1.id);
    (r as any).buildingById.delete(h3.id);

    pumpAndTick(r, [h0.id, h2.id], (h) => pumpHouse(h, { meat: true }), 91);

    const survivors = housesOf(r);
    const big = survivors.find((s) => s.footprint === 4);
    expect(big, 'a 4x4 merged survivor should exist').toBeDefined();
    expect(big!.house!.level).toBe(20);
    expect(big!.house!.combinedPopulation).toBe(2 * liveStats(20).population);
    for (let dy = 0; dy < 4; dy++) {
      for (let dx = 0; dx < 4; dx++) {
        expect(occ.get(tileKey(20 + dx, 29 + dy))).toBe(big!.id);
      }
    }
    expect(r.getState().messages.some((m) => m.type === 'house-merged')).toBe(true);
  });
});
