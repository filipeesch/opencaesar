/**
 * Live housing bridge (Phase 16, HOUS-01).
 *
 * Pure functions that wire the data-driven 21-level housing catalog
 * (data/housing.ts HOUSING_LEVELS, levels 0-20) into the live sim as the single
 * source of truth for a house's progression. Role-analog of economy.ts: pure
 * functions over building state, deterministic, no RNG/wall-clock.
 *
 *  - HOUSING_LIVE_STATS: one {population, workers, taxPerTick} entry per level,
 *    derived from the catalog (workers ≈ capacity/5 — the legacy ~5:1 HOUSE_TIERS
 *    ratio; taxPerTick ≈ capacity*taxPerCapita/20). Tuning stays module-local —
 *    never added to data/balance.ts (balance-parity gate).
 *  - levelDesirability: the mandatory 0-200 -> 1-30 normalizer (cap 30, NOT 20)
 *    so the full 21-level ladder is satisfiable: decideEvolution's evolve path
 *    requires desirability >= next.desirability + padding (5), i.e. level 20
 *    needs 25, which a cap-30 normalizer reaches (raw 200 -> 30).
 *  - tierOfLevel: the derived 0-4 bucket (keeps the HOUSE_TIERS.length rating
 *    denominator and the tier>=3 patrician bar valid). Never the decision source.
 *  - liveStats: the ONLY way consumers read the table — clamps the input so an
 *    out-of-range/undefined level can never yield undefined (NaN guard).
 *  - deriveSatisfied: the per-house requirement-key vocabulary the evolution
 *    counters consume. Goods resolve via per-house foodInventory for FOOD_TYPES
 *    and via a deterministic city-stock proxy for non-food house goods.
 */
import { HOUSING_LEVELS, type HousingLevelDef } from '../../data/housing';
import { isFood } from '../../data/commodities';
import type { BuildingInstance, HouseInstance } from './walkers';

export interface LiveHouseStats {
  population: number;
  workers: number;
  taxPerTick: number;
}

/** Workers a level contributes: max(1, round(capacity / 5)) — the legacy 5:1 ratio. */
function levelWorkers(def: HousingLevelDef): number {
  return Math.max(1, Math.round(def.capacity / 5));
}

/**
 * Tax per tick a level pays: max(1, round(capacity * taxPerCapita / 20)),
 * floored at 3 × the level's workers so every rung of the 21-level ladder is
 * solvent at the stock policy (a house's tax income covers its own workers'
 * wage bill — wages = workers × wagePerWorkerPerTick(2) × wageRate(0.135) ≈
 * 0.27×workers, taxes = taxPerTick × taxRate(0.1), so break-even needs
 * taxPerTick ≈ 2.7×workers; the floor of 3×workers keeps a small margin).
 *
 * WHY: without this floor, the bottom half of the ladder is structurally
 * loss-making (a level-1 house with 4 workers pays only 1 denarius/tick tax
 * vs 1.08 in wages), so wages go unpaid → the unpaid-wages desirability
 * penalty drives desirability to 0 → no house can ever evolve → the entire
 * natural economy (governance unlocks, religion, requests, food chain, …)
 * never bootstraps. The legacy HOUSE_TIERS were solvent exactly this way
 * (Shack: tax 5 vs 0.27 wages). Module-local constant, never a BALANCE key.
 */
const LEVEL_TAX_PER_WORKER = 5;

function levelTaxPerTick(def: HousingLevelDef): number {
  const derived = Math.max(1, Math.round((def.capacity * def.taxPerCapita) / 20));
  return Math.max(LEVEL_TAX_PER_WORKER * levelWorkers(def), derived);
}

/** The 21-entry live stats table, one per HOUSING_LEVELS level. */
export const HOUSING_LIVE_STATS: readonly LiveHouseStats[] = HOUSING_LEVELS.map((l) => ({
  population: l.capacity,
  workers: levelWorkers(l),
  taxPerTick: levelTaxPerTick(l),
}));

/** Normalize a house tile's 0-200 desirability to 1-30 (cap 30 keeps the full
 *  21-level ladder satisfiable — level 20's padded requirement is 25). */
export function levelDesirability(tileDesirability: number): number {
  const raw = Number.isFinite(tileDesirability) ? tileDesirability : 0;
  if (raw <= 0) return 0;
  const v = Math.round(raw / 6);
  if (v < 0) return 0;
  if (v > 30) return 30;
  return v;
}

/** Derived 0-4 tier bucket of a house level (0-3→0, 4-7→1, ... 16-20→4). */
export function tierOfLevel(level: number): number {
  const l = Number.isFinite(level) ? level : 0;
  const clamped = Math.max(0, Math.min(20, Math.floor(l)));
  return Math.min(4, Math.floor(clamped / 4));
}

/** Clamped accessor — the ONLY way consumers read HOUSING_LIVE_STATS. */
export function liveStats(level: number | undefined): LiveHouseStats {
  const l = level ?? 0;
  const clamped = Math.max(0, Math.min(HOUSING_LIVE_STATS.length - 1, Math.round(l)));
  return HOUSING_LIVE_STATS[clamped];
}

function levelDef(level: number): HousingLevelDef | undefined {
  return HOUSING_LEVELS.find((l) => l.level === level);
}

/** Whether every requires+requiresGoods key of `level` is present in `satisfied`. */
export function requirementsMet(level: number, satisfied: string[]): boolean {
  const def = levelDef(level);
  if (!def) return true;
  const need = [...def.requires, ...def.requiresGoods];
  return need.every((r) => satisfied.includes(r));
}

/** Deterministic city-stock proxy: any building holds units of `g` (storage
 *  buildings are the practical carriers; sum across the registry is safe). */
function cityGoodsAccess(g: string, buildings: readonly BuildingInstance[]): boolean {
  let total = 0;
  for (const b of buildings) total += (b.stock as Record<string, number | undefined>)?.[g] ?? 0;
  return total > 0;
}

function hasCityStructure(buildings: readonly BuildingInstance[], type: string): boolean {
  return buildings.some((b) => b.type === type);
}

/** The per-house requirement-key vocabulary (RESEARCH Pattern 2 key map).
 *  Only the union of requires+requiresGoods keys this house currently holds. */
export function deriveSatisfied(house: HouseInstance, buildings: readonly BuildingInstance[]): string[] {
  const satisfied: string[] = [];
  const water = (house.waterCooldown ?? 0) > 0;
  const food = (house.foodCooldown ?? 0) > 0;
  const wellness = house.services ?? {};
  const fresh = (key: string) => (wellness[key] ?? 0) > 0;
  const godAccessActive =
    house.godAccess !== undefined && Object.values(house.godAccess).some((ttl) => ttl > 0);
  const has = (type: string, service?: string) =>
    hasCityStructure(buildings, type) && (service === undefined || fresh(service));
  const hasGood = (g: string) =>
    isFood(g) ? (house.foodInventory?.[g] ?? 0) > 0 : cityGoodsAccess(g, buildings);

  if (water) satisfied.push('well', 'fountain');
  if (food) satisfied.push('market');

  // Wellness-gated services: need a city building of the type AND a fresh
  // walker-delivered wellness flag (SERVICE_BY_WALKER mapping).
  if (has('school', 'literacy')) satisfied.push('school');
  if (has('clinic', 'health')) satisfied.push('clinic');
  if (has('library', 'literacy')) satisfied.push('library');
  if (has('theatre', 'entertainment')) satisfied.push('theatre');
  if (has('hospital', 'health')) satisfied.push('hospital');
  if (has('amphitheatre', 'entertainment')) satisfied.push('amphitheatre');
  if (has('colosseum', 'entertainment')) satisfied.push('colosseum');

  // Religion: any godAccess TTL active satisfies temple + grand_temple.
  if (godAccessActive) satisfied.push('temple', 'grand_temple');

  // City-presence government/ornament services (deterministic fallback).
  if (hasCityStructure(buildings, 'forum')) satisfied.push('forum');
  if (hasCityStructure(buildings, 'garden')) satisfied.push('garden');
  if (hasCityStructure(buildings, 'senate')) satisfied.push('senate');

  // Goods: the union of every requiresGoods key across the ladder. FOOD_TYPES
  // resolve via per-house foodInventory (household food state, §13); all other
  // house goods resolve via the deterministic city-stock proxy (real home
  // delivery arrives with the distribution phases).
  const allGoods = new Set<string>();
  for (const lvl of HOUSING_LEVELS) for (const g of lvl.requiresGoods) allGoods.add(g);
  for (const g of allGoods) if (hasGood(g)) satisfied.push(g);

  return satisfied;
}
