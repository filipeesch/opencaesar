/**
 * Management data layer — advisors, overlays, inspectors (tasks 9.6, 11.2,
 * 11.3, 11.4). These produce the real-data datasets the Phaser views render,
 * reading from the sim systems (ratings, finance, economy, services, water,
 * safety, trade). Self-contained and unit-testable.
 */
import { computeServiceCoverage } from './services';
import { type CityStats, computeTargets, type RatingDecomposition } from './ratings';
import type { TileWater, ReservoirState } from './water';
import { BUILDINGS } from './buildings';
import { HOUSE_TIERS } from './config';
import { dailyFoodConsumption, foodVariety, houseFoodDays, houseFoodFromUnits } from './housing';
import {
  EXTRACTION_SITES, WORKSHOPS,
  EXTRACTION_BUILDING_TYPES, WORKSHOP_BUILDING_TYPES, RAW_OLIVE_GRAPE,
} from './production';
import type { LogisticsAdvisorView } from './logistics';
import { TRADE_CITIES, tradeCityName } from '../../data/trade';
import { quotaFor } from './trade';
import type { TradeOrderMode } from './trade';
import type { TradeRoute } from './types';
import type { Policy } from './types';
import type { FinanceLedger } from './finance';
import type { FirePhase } from './safety';

export interface SimSnapshot {
  population: number;
  treasury: number;
  taxRate: number;
  wageRate: number;
  hasReligion: boolean;
  hasEntertainment: boolean;
  hasEducation: boolean;
  hasHealth: boolean;
  hasWater: boolean;
  hasFood: boolean;
  jobs: number;
  employed: number;
  welfare: Record<string, number>;
  godWorship: Record<string, number>;
  doctorCoverage: number;
  educationCoverage: number;
  entertainmentCoverage: number;
  /** RATE-01: live rating decomposition (from getDerived()) — surfaced as a
   *  pure transform, never a second recompute. */
  decomposition?: RatingDecomposition;
  /** RATE-01: lifetime construction spend (from getDerived()). */
  constructionSpend?: number;
}

export interface AdvisorDataset {
  name: string;
  data: Record<string, number>;
}

/** Finance advisor (FIN-01): a pure projection over injected treasury state. */
export interface TreasuryView {
  balance: number;
  revenue: FinanceLedger['revenue'];
  expenses: FinanceLedger['expenses'];
  debt: number;
  outstandingInterest: number;
  subsidyUsedThisYear: number;
}

/** Live-derived finance advisor view — every number comes from real state. */
export interface FinanceAdvisorView {
  balance: number;
  revenue: FinanceLedger['revenue'];
  expenses: FinanceLedger['expenses'];
  debt: number;
  /** Interest accrued but not yet repaid. */
  interest: number;
  subsidyUsedThisYear: number;
  /** Wage arrears currently owed (any unpaid wages this tick). */
  arrears: boolean;
  /** Year-to-date income minus spending (same formula as monthlyChange). */
  deficit: number;
  /** Denarii dropped this year by the overflow cap. */
  overflowDroppedThisYear: number;
  /** Current tax rate (policy context for the wage/tax spread). */
  taxRate: number;
  /** Current wage rate (policy context for the wage/tax spread). */
  wageRate: number;
}

/** Project a finance advisor view from injected treasury state — never fabricated. */
export function financeAdvisorFromState(account: TreasuryView, arrears: number, policy: Policy): FinanceAdvisorView {
  const revenue = { ...account.revenue };
  const expenses = { ...account.expenses };
  return {
    balance: account.balance,
    revenue,
    expenses,
    debt: account.debt,
    interest: account.outstandingInterest,
    subsidyUsedThisYear: account.subsidyUsedThisYear,
    arrears: arrears > 0,
    deficit: Object.values(revenue).reduce((s, v) => s + (v ?? 0), 0) - Object.values(expenses).reduce((s, v) => s + (v ?? 0), 0),
    overflowDroppedThisYear: expenses['overflow'] ?? 0,
    taxRate: policy.taxRate,
    wageRate: policy.wageRate,
  };
}

export function toCityStats(s: SimSnapshot): CityStats {
  return {
    population: s.population, treasury: s.treasury, taxRate: s.taxRate,
    hasReligion: s.hasReligion, hasEntertainment: s.hasEntertainment, hasEducation: s.hasEducation,
    hasHealth: s.hasHealth, hasWater: s.hasWater, hasFood: s.hasFood,
  };
}

/** Produce the deliverable advisor datasets from a live sim snapshot. */
export function advisorsFrom(s: SimSnapshot): AdvisorDataset[] {
  const targets = computeTargets(toCityStats(s));
  const services = computeServiceCoverage({
    doctorCoverage: s.doctorCoverage, educationCoverage: s.educationCoverage,
    entertainmentCoverage: s.entertainmentCoverage, godWorship: s.godWorship,
  });
  const datasets: AdvisorDataset[] = [
    { name: 'population', data: { population: s.population } },
    { name: 'labor', data: { employed: s.employed, jobs: s.jobs, unemployment: Math.max(0, s.jobs - s.employed) } },
    { name: 'finance', data: { treasury: s.treasury, taxRate: s.taxRate, wageRate: s.wageRate } },
    { name: 'ratings', data: { culture: targets.culture, prosperity: targets.prosperity, stability: targets.stability, favor: targets.favor } },
    { name: 'religion', data: { ...s.godWorship } },
    { name: 'health', data: { wellness: Math.round(services.health * 100) } },
    { name: 'education', data: { literacy: Math.round(services.literacy * 100) } },
    { name: 'entertainment', data: { coverage: Math.round(services.entertainment * 100) } },
  ];
  // RATE-01: surface the decomposition as a flattened pure transform of
  // getDerived() — never a second recompute.
  if (s.decomposition) {
    const buckets: Record<string, number> = {};
    for (const [rating, factors] of Object.entries(s.decomposition)) {
      for (const [factor, value] of Object.entries(factors)) {
        buckets[`${rating}.${factor}`] = value as number;
      }
    }
    datasets.push({ name: 'ratings-decomposition', data: buckets });
  }
  if (s.constructionSpend !== undefined) {
    const ratings = datasets.find((d) => d.name === 'ratings');
    if (ratings) ratings.data.constructionSpend = s.constructionSpend;
  }
  return datasets;
}

/** Per-tile overlay values keyed by name (task 11.4). */
export function overlaysFrom(
  width: number,
  height: number,
  perTile: (x: number, y: number) => Partial<Record<string, number>>,
): Record<string, number[][]> {
  const acc: Record<string, number[][]> = {};
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = perTile(x, y);
      for (const [k, val] of Object.entries(v)) {
        if (!acc[k]) acc[k] = Array.from({ length: height }, () => new Array(width).fill(0));
        acc[k][y][x] = val ?? 0;
      }
    }
  }
  return acc;
}

/** Inputs for the WATR-06 water overlay advisor data (pure projection of the water model). */
export interface WaterOverlayInput {
  width: number;
  height: number;
  grid: TileWater[][];
  aqueductTiles: Set<number>;
  flowing: Set<number>;
  reservoirStates: ReservoirState[];
}

// `grand` (3) is the documented forward mapping for the reserved
// aqueduct-served "grand water" upgrade (IN-02). WaterSystem.compute does not
// emit it yet, so a tile currently reads at most 2 (clean).
const WATER_CLASS_VALUE: Record<string, number> = { none: 0, basic: 1, clean: 2, grand: 3 };

function emptyGrid(width: number, height: number): number[][] {
  return Array.from({ length: height }, () => new Array(width).fill(0));
}

/**
 * WATR-06 water overlay advisor data. Returns per-tile number[][] grids for
 * sources, well/fountain coverage, house water classes, aqueduct present vs
 * flowing, reservoir filled/level, and desirability. Keys follow the
 * AqueductSystem convention `y * 100000 + x` for Set lookups. Pure projection —
 * every painted tile traces back to the injected model state.
 */
export function waterOverlayData(input: WaterOverlayInput): Record<string, number[][]> {
  const { width, height, grid, aqueductTiles, flowing, reservoirStates } = input;
  const sources = emptyGrid(width, height);
  const wellCoverage = emptyGrid(width, height);
  const fountainCoverage = emptyGrid(width, height);
  const houseWaterClass = emptyGrid(width, height);
  const aqueductPresent = emptyGrid(width, height);
  const aqueductFlow = emptyGrid(width, height);
  const reservoirFilled = emptyGrid(width, height);
  const reservoirLevel = emptyGrid(width, height);
  const desirability = emptyGrid(width, height);

  for (const r of reservoirStates) {
    if (!r.filled) continue;
    // Clamp the footprint to the map bounds (WR-01): a reservoir can overhang
    // the map edge, and painting past the grid would either extend a row into a
    // sparse/hole-ridden array (x) or throw TypeError on an undefined row (y).
    for (let y = r.y; y < Math.min(r.y + r.size, height); y++) {
      for (let x = r.x; x < Math.min(r.x + r.size, width); x++) {
        reservoirFilled[y][x] = 1;
        reservoirLevel[y][x] = r.level;
      }
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x];
      const k = y * 100000 + x;
      if (cell.sourceTile) sources[y][x] = 1;
      if (cell.coveredByWell) wellCoverage[y][x] = 1;
      if (cell.coveredByFountain) fountainCoverage[y][x] = 1;
      houseWaterClass[y][x] = WATER_CLASS_VALUE[cell.kind] ?? 0;
      if (aqueductTiles.has(k)) aqueductPresent[y][x] = 1;
      if (aqueductTiles.has(k) && flowing.has(k)) aqueductFlow[y][x] = 1;
      desirability[y][x] = cell.desirability;
    }
  }

  return {
    sources, wellCoverage, fountainCoverage, houseWaterClass,
    aqueductPresent, aqueductFlow, reservoirFilled, reservoirLevel, desirability,
  };
}

/** Per-building safety state fed into the civilization overlay (Phase 11). */
export interface CivilizationBuildingInput {
  x: number;
  y: number;
  /** Footprint width/height in tiles. */
  w: number;
  h: number;
  safety?: { fire: FirePhase; danger: boolean; collapseRisk: number; crime: number };
}

/**
 * Civilization overlay advisor data (Phase 11): per-tile number[][] grids for
 * fire (0..1 by lifecycle phase), structural danger (0/1), collapse risk
 * (0..1), and crime (0..1). Pure projection of the per-building safety state —
 * every painted tile traces back to a building's footprint.
 */
export function civilizationOverlayData(
  width: number,
  height: number,
  buildings: readonly CivilizationBuildingInput[],
): Record<string, number[][]> {
  const fire = emptyGrid(width, height);
  const danger = emptyGrid(width, height);
  const collapse = emptyGrid(width, height);
  const crime = emptyGrid(width, height);
  for (const b of buildings) {
    const fpW = Math.max(1, b.w);
    const fpH = Math.max(1, b.h);
    for (let y = b.y; y < Math.min(b.y + fpH, height); y++) {
      for (let x = b.x; x < Math.min(b.x + fpW, width); x++) {
        const s = b.safety;
        fire[y][x] = !s || s.fire === 'none' ? 0 : s.fire === 'burning' ? 0.9 : s.fire === 'evacuating' ? 0.6 : 1;
        collapse[y][x] = s?.collapseRisk ?? 0;
        crime[y][x] = s?.crime ?? 0;
        danger[y][x] = s?.danger ? 1 : 0;
      }
    }
  }
  return { fire, danger, collapse, crime };
}

/** Residence/production/storage/market walker inspector datasets (task 11.2). */
export function residenceInspection(
  population: number, capacity: number, residentClass: string, services: string[], goods: Record<string, number>,
): Record<string, unknown> {
  return { population, capacity, residentClass, services, goods };
}

export function productionInspection(
  inputs: Record<string, number>, output: Record<string, number>, status: string,
): Record<string, unknown> {
  return { inputs, output, status };
}

export function storageInspection(stock: Record<string, number>, usedSlots: number, capacity: number): Record<string, unknown> {
  return { stock, usedSlots, capacity };
}

export function marketInspection(inventory: Record<string, number>, buyerRadius: number): Record<string, unknown> {
  return { inventory, buyerRadius };
}

export function walkerInspection(id: number, x: number, y: number, status: string, stepsUsed: number, maxSteps: number): Record<string, unknown> {
  return { id, x, y, status, stepsUsed, maxSteps };
}

/**
 * === Food management data (AGRI-03, spec §15/§21/§22/§23) ===
 *
 * The HUD months-of-food indicator, per-food advisor table, bottlenecks,
 * overlays and grouped alerts — every value derived from live sim state
 * (never fabricated, spec §33-23). Deterministic pure functions.
 */
import type { Good, SimState } from './types';

const FOOD_KEYS = ['wheat', 'vegetables', 'fruit', 'meat', 'fish'] as const;
/** Base consumption 0.03 units/person/day (spec §13.2) — 30-day projection. */
export const BASE_CONSUMPTION_PER_PERSON_MONTHLY = 0.03 * 30;

/** Months of food = available units / projected monthly consumption (§15.1). */
export function monthsOfFood(availableUnits: number, projectedMonthlyConsumption: number): number {
  if (projectedMonthlyConsumption <= 0) return availableUnits > 0 ? Infinity : 0;
  return availableUnits / projectedMonthlyConsumption;
}

export type FoodBand = 'green' | 'yellow' | 'orange' | 'red' | 'gray';

/** Visual band (spec §15.2); always paired with icon + text, never color-only. */
export function foodBand(months: number, hasPopulation: boolean): FoodBand {
  if (!hasPopulation) return 'gray';
  if (months === Infinity || months >= 6) return 'green';
  if (months >= 3) return 'yellow';
  if (months >= 1) return 'orange';
  return 'red';
}

export interface FoodHudIndicator {
  months: number;
  band: FoodBand;
  icon: string;
  text: string;
  hasPopulation: boolean;
  projectedMonthlyConsumption: number;
  availableUnits: number;
}

export function foodHudIndicator(input: {
  availableUnits: number;
  projectedMonthlyConsumption: number;
  hasPopulation: boolean;
}): FoodHudIndicator {
  const months = monthsOfFood(input.availableUnits, input.projectedMonthlyConsumption);
  const band = foodBand(months, input.hasPopulation);
  const textBase = months === Infinity ? '∞' : months.toFixed(1).replace('.', ',');
  const text = `${textBase} months`;
  const icon = band === 'red' ? '◉' : band === 'orange' ? '◐' : band === 'yellow' ? '○' : band === 'green' ? '●' : '·';
  return { months, band, icon, text, hasPopulation: input.hasPopulation, projectedMonthlyConsumption: input.projectedMonthlyConsumption, availableUnits: input.availableUnits };
}

/** Tooltip breakdown of the indicator (spec §15.3). */
export interface FoodTooltip {
  productionMonthly: number;
  consumptionMonthly: number;
  balanceMonthly: number;
  stockByFood: Record<string, number>;
  varietyShares: Record<string, number>;
  mainProblems: string[];
}

export function foodTooltip(input: {
  availableByFood: Record<string, number>;
  productionMonthlyByFood: Record<string, number>;
  consumptionMonthlyByFood: Record<string, number>;
  varietyStats: Record<string, number>;
  mainProblems: string[];
}): FoodTooltip {
  const consumptionMonthly = Object.values(input.consumptionMonthlyByFood).reduce((a, b) => a + b, 0);
  const productionMonthly = Object.values(input.productionMonthlyByFood).reduce((a, b) => a + b, 0);
  return {
    productionMonthly,
    consumptionMonthly,
    balanceMonthly: productionMonthly - consumptionMonthly,
    stockByFood: { ...input.availableByFood },
    varietyShares: { ...input.varietyStats },
    mainProblems: [...input.mainProblems],
  };
}

/** Per-food advisor row (spec §21.2). */
export interface FoodAdvisorRow {
  food: string;
  stock: number;
  production: number;
  consumption: number;
  balance: number;
  months: number;
  imports: number;
  exports: number;
}

export interface FoodAdvisorData {
  totalMonths: number;
  totalAvailable: number;
  productionMonthly: number;
  consumptionMonthly: number;
  balanceMonthly: number;
  rows: FoodAdvisorRow[];
  bottlenecks: string[];
  recommendations: string[];
}

/**
 * Bottleneck auto-detection (spec §21.4). A food only shows a deficit
 * bottleneck when its TRUE supply (production + imports − exports) is below its
 * real consumption, or when houses consume it but no stock exists.
 */
export function foodBottlenecks(input: {
  productionMonthlyByFood: Record<string, number>;
  importsMonthlyByFood?: Record<string, number>;
  exportsMonthlyByFood?: Record<string, number>;
  consumptionMonthlyByFood: Record<string, number>;
  stockByFood: Record<string, number>;
  hovelsNearEmpty: number;
}): string[] {
  const out: string[] = [];
  for (const f of FOOD_KEYS) {
    const prod = input.productionMonthlyByFood[f] ?? 0;
    const imp = input.importsMonthlyByFood?.[f] ?? 0;
    const exp = input.exportsMonthlyByFood?.[f] ?? 0;
    const supply = prod + imp - exp;
    const cons = input.consumptionMonthlyByFood[f] ?? 0;
    const stock = input.stockByFood[f] ?? 0;
    if (supply > 0 && cons > supply) out.push(`${f}: supply below consumption`);
    if (cons > 0 && stock <= 0) out.push(`${f}: no stock while houses consume it`);
  }
  if (input.hovelsNearEmpty > 0) out.push(`${input.hovelsNearEmpty} house(s) are out of food`);
  return out;
}

/** Recommendation generation (spec §21.5). */
export function foodRecommendations(bottlenecks: string[], deficits: string[]): string[] {
  const recs: string[] = [];
  for (const d of deficits) recs.push(`Build an additional ${d} source or open an import route`);
  for (const b of bottlenecks) if (b.includes('below consumption')) recs.push('Consider an extra farm or a granary-to-market route');
  return recs;
}

/**
 * Live monthly food flows, fed to `foodAdvisorFromState` by the caller when the
 * sim/runner tracks them (farm outputs per food, trade ledger). Anything absent
 * is derived from the state itself or left genuinely zero — never fabricated.
 */
export interface FoodFlows {
  productionMonthlyByFood?: Record<string, number>;
  importsMonthlyByFood?: Record<string, number>;
  exportsMonthlyByFood?: Record<string, number>;
  consumptionMonthlyByFood?: Record<string, number>;
}

/**
 * Monthly production per food from the live buildings: each staffed (active)
 * farm/orchard outputs its own production spec's good at its per-tick rate over
 * a 30-day month. When richer per-food output exists it is passed via `flows`
 * instead; this default is never hardcoded to zero.
 */
export function monthlyProductionFromState(state: SimState): Record<string, number> {
  const prod: Record<string, number> = {};
  for (const b of state.buildings) {
    const def = BUILDINGS[b.type];
    if (!def?.production || !b.active) continue;
    const food = def.production.good;
    prod[food] = (prod[food] ?? 0) + def.production.perTick * 30;
  }
  return prod;
}

/**
 * Real per-food consumption from live house state: total city consumption
 * (population × base, §13.2) is split across the foods houses have actually
 * received from sellers (§13.3 — any food sustains a home), falling back to
 * wheat-only when houses hold no food inventory. Never invents a per-food
 * consumption out of thin air.
 */
export function monthlyConsumptionFromState(state: SimState): Record<string, number> {
  const popConsumption = state.ratings.population * BASE_CONSUMPTION_PER_PERSON_MONTHLY;
  const delivered: Record<string, number> = {};
  let totalDelivered = 0;
  for (const b of state.buildings) {
    if (!b.house?.foodInventory) continue;
    for (const [f, u] of Object.entries(b.house.foodInventory)) {
      if (u > 0) {
        delivered[f] = (delivered[f] ?? 0) + u;
        totalDelivered += u;
      }
    }
  }
  const consumption: Record<string, number> = {};
  for (const f of FOOD_KEYS) {
    consumption[f] = totalDelivered > 0 ? popConsumption * ((delivered[f] ?? 0) / totalDelivered) : f === 'wheat' ? popConsumption : 0;
  }
  return consumption;
}

/** Derive the food advisor dataset from a live sim snapshot. */
export function foodAdvisorFromState(state: SimState, flows?: Partial<FoodFlows>): FoodAdvisorData {
  const stockByFood: Record<string, number> = {};
  for (const b of state.buildings) {
    if (b.type === 'granary' || b.type === 'market' || b.type === 'farm' || b.type === 'orchard') {
      for (const f of FOOD_KEYS) {
        stockByFood[f] = (stockByFood[f] ?? 0) + (b.stock[f] ?? 0);
      }
    }
  }
  const hovelsNearEmpty = state.buildings.filter((b) => b.house && b.house.foodCooldown <= 0).length;
  const productionByFood = flows?.productionMonthlyByFood ?? monthlyProductionFromState(state);
  const importsByFood = flows?.importsMonthlyByFood ?? {};
  const exportsByFood = flows?.exportsMonthlyByFood ?? {};
  const consumptionByFood = flows?.consumptionMonthlyByFood ?? monthlyConsumptionFromState(state);
  const rows: FoodAdvisorRow[] = FOOD_KEYS.map((f) => {
    const consumption = consumptionByFood[f] ?? 0;
    const stock = stockByFood[f] ?? 0;
    const production = productionByFood[f] ?? 0;
    const imports = importsByFood[f] ?? 0;
    const exports = exportsByFood[f] ?? 0;
    const balance = production + imports - exports - consumption;
    const months = monthsOfFood(stock, consumption);
    return { food: f, stock, production, consumption, balance, months, imports, exports };
  });
  const totalConsumption = rows.reduce((a, r) => a + r.consumption, 0);
  const totalProduction = rows.reduce((a, r) => a + r.production, 0);
  const totalImports = rows.reduce((a, r) => a + r.imports, 0);
  const totalExports = rows.reduce((a, r) => a + r.exports, 0);
  const totalAvailable = rows.reduce((a, r) => a + r.stock, 0);
  const totalMonths = monthsOfFood(totalAvailable, totalConsumption);
  const bottleneckInput = {
    productionMonthlyByFood: productionByFood,
    importsMonthlyByFood: importsByFood,
    exportsMonthlyByFood: exportsByFood,
    consumptionMonthlyByFood: consumptionByFood,
    stockByFood,
    hovelsNearEmpty,
  };
  return {
    totalMonths,
    totalAvailable,
    productionMonthly: totalProduction,
    consumptionMonthly: totalConsumption,
    balanceMonthly: totalProduction + totalImports - totalExports - totalConsumption,
    rows,
    bottlenecks: foodBottlenecks(bottleneckInput),
    recommendations: foodRecommendations(foodBottlenecks(bottleneckInput), []),
  };
}

/** HUD months-of-food indicator derived from a live sim state (spec §15). */
export function foodHudFromState(state: SimState): FoodHudIndicator {
  const { totalAvailable } = foodAdvisorFromState(state);
  const projectedMonthlyConsumption = state.ratings.population * BASE_CONSUMPTION_PER_PERSON_MONTHLY;
  return foodHudIndicator({
    availableUnits: totalAvailable,
    projectedMonthlyConsumption,
    hasPopulation: state.ratings.population > 0,
  });
}

/**
 * Per-tile food overlays (spec §22): general supply days and variety per house,
 * derived from the house's REAL food inventory when one is tracked (§13, via
 * houseFoodDays/foodVariety). Only houses with no inventory yet fall back to the
 * foodCooldown proxy. Buildings without house state read 0 (no invented values).
 */
export function foodOverlayGrids(state: SimState): Record<string, number[][]> {
  const width = state.width;
  const height = state.height;
  const supply = Array.from({ length: height }, () => new Array<number>(width).fill(0));
  const variety = Array.from({ length: height }, () => new Array<number>(width).fill(0));
  for (const b of state.buildings) {
    if (!b.house) continue;
    let days: number;
    let varietyCount: number;
    const inventory = b.house.foodInventory;
    if (inventory && Object.keys(inventory).length > 0) {
      const inv = houseFoodFromUnits(inventory, 'wheat');
      const pop = HOUSE_TIERS[Math.max(0, Math.min(HOUSE_TIERS.length - 1, b.house.tier))].population;
      days = houseFoodDays(inv, dailyFoodConsumption(pop));
      varietyCount = foodVariety(inv);
    } else {
      // No real inventory tracked yet: fall back to the foodCooldown proxy.
      days = b.house.foodCooldown > 0 ? 10 : 0;
      varietyCount = b.house.foodCooldown > 0 ? 1 : 0;
    }
    for (let dy = 0; dy < b.footprint; dy++) {
      for (let dx = 0; dx < b.footprint; dx++) {
        const x = b.x + dx;
        const y = b.y + dy;
        if (x >= 0 && x < width && y >= 0 && y < height) {
          supply[y][x] = days;
          variety[y][x] = varietyCount;
        }
      }
    }
  }
  return { supplyDays: supply, variety };
}

/**
 * Grouped notifications (spec §23.4): identical issues are aggregated into a
 * single high-signal alert instead of one line per building.
 */
export function groupedAlerts(issues: Array<{ key: string; label: string; building: string }>): Array<{ label: string; count: number; buildings: string[] }> {
  const byKey = new Map<string, { label: string; buildings: string[] }>();
  for (const issue of issues) {
    let g = byKey.get(issue.key);
    if (!g) {
      g = { label: issue.label, buildings: [] };
      byKey.set(issue.key, g);
    }
    g.buildings.push(issue.building);
  }
  return [...byKey.values()]
    .map((g) => ({ label: g.label, count: g.buildings.length, buildings: g.buildings }))
    .sort((a, b) => b.count - a.count);
}

/**
 * === Production advisor data (PROD-02, spec §33-23) ===
 *
 * Per-building production rows derived from live sim state — never fabricated.
 * Extraction/workshop/farm raw producers report stock, status, bottleneck, and
 * porter destination. Production state is internal to the runner, so the pure
 * `productionAdvisorRows` reads what SimState serializes (stock, labor) and
 * falls back to 'idle' for workshop internals; the runner passes a per-building
 * `notes` map (recorded during tickProduction) to surface the real statuses.
 */

/** Per-building production advisor row (PROD-02). */
export interface ProductionAdvisorRow {
  id: number;
  kind: 'extraction' | 'workshop';
  buildingType: string;
  commodity: string;
  inputs: Record<string, number>;
  output: number;
  status: string;
  bottleneck: string | null;
  destination: string | null;
  destinationKind: string | null;
  producedLastTick: number;
}

/** Runner-recorded internals for one production building (advisors never invent). */
export interface ProductionInternalNote {
  inputs: Record<string, number>;
  output: number;
  status: string;
  bottleneck: string | null;
  destination: string | null;
  destinationKind: string | null;
  producedLastTick: number;
}

/**
 * Production advisor rows for every extraction/workshop/raw-farm building in
 * the state. When `notes` carries a runner-recorded entry for a building id,
 * those authoritative values are used; otherwise the row derives from what
 * SimState serializes (stock, labor activity) and never invents production
 * internals (workshops without a note read 'idle' with zero stocks).
 */
export function productionAdvisorRows(
  state: SimState,
  notes?: Map<number, ProductionInternalNote> | Record<number, ProductionInternalNote>,
): ProductionAdvisorRow[] {
  const noteFor = (id: number): ProductionInternalNote | undefined => {
    if (!notes) return undefined;
    if (notes instanceof Map) return notes.get(id);
    return notes[id];
  };
  const rows: ProductionAdvisorRow[] = [];
  for (const b of state.buildings) {
    const exKey = EXTRACTION_BUILDING_TYPES[b.type];
    const farm = RAW_OLIVE_GRAPE[b.type];
    const wsKey = WORKSHOP_BUILDING_TYPES[b.type];
    if (!exKey && !farm && !wsKey) continue;

    const note = noteFor(b.id);
    if (note) {
      rows.push({
        id: b.id,
        kind: wsKey ? 'workshop' : 'extraction',
        buildingType: b.type,
        commodity: wsKey ? WORKSHOPS[wsKey].produces : exKey ? EXTRACTION_SITES[exKey].produces : farm!.produces,
        inputs: { ...note.inputs },
        output: note.output,
        status: note.status,
        bottleneck: note.bottleneck,
        destination: note.destination,
        destinationKind: note.destinationKind,
        producedLastTick: note.producedLastTick,
      });
      continue;
    }

    // SimState-only fallback (no internal note): report what is serialized.
    if (wsKey) {
      rows.push({
        id: b.id, kind: 'workshop', buildingType: b.type, commodity: WORKSHOPS[wsKey].produces,
        inputs: {}, output: 0, status: 'idle', bottleneck: null, destination: null, destinationKind: null, producedLastTick: 0,
      });
      continue;
    }
    const commodity = exKey ? EXTRACTION_SITES[exKey].produces : farm!.produces;
    rows.push({
      id: b.id, kind: 'extraction', buildingType: b.type, commodity,
      inputs: {}, output: b.stock[commodity as Good] ?? 0,
      status: b.active ? 'working' : 'blocked', bottleneck: null, destination: null, destinationKind: null, producedLastTick: 0,
    });
  }
  return rows;
}

/** Aggregate production summary over advisor rows (PROD-02). */
export interface ProductionAdvisorSummary {
  workshops: number;
  activeWorkshops: number;
  blocked: number;
  outputFull: number;
  missingInput: number;
  noDestination: number;
  outputStock: Record<string, number>;
}

export function productionAdvisorSummary(rows: ProductionAdvisorRow[]): ProductionAdvisorSummary {
  const summary: ProductionAdvisorSummary = { workshops: 0, activeWorkshops: 0, blocked: 0, outputFull: 0, missingInput: 0, noDestination: 0, outputStock: {} };
  for (const r of rows) {
    if (r.kind === 'workshop') {
      summary.workshops += 1;
      if (r.status === 'working') summary.activeWorkshops += 1;
      if (r.status === 'blocked') summary.blocked += 1;
      if (r.status === 'output_full') summary.outputFull += 1;
      if (r.status === 'missing_input') summary.missingInput += 1;
      if (r.bottleneck === 'no_destination') summary.noDestination += 1;
    } else if (r.status === 'blocked') {
      summary.blocked += 1;
    }
    summary.outputStock[r.commodity] = (summary.outputStock[r.commodity] ?? 0) + r.output;
  }
  return summary;
}

/**
 * Phase 7, WARE-03 (decision 4): the logistics advisor aggregate view derived
 * LIVE from a SimState + production advisor rows — never fabricated (§33-23).
 * Every field traces to sim state: stock = warehouse b.stock + workshop held
 * output; production = sum(producedLastTick) × 30; consumption = × 30 per
 * staffed workshop whose catalog inputs include the commodity (tickWorkshop
 * consumes exactly one unit per input); inTransit = workshop row output (loads
 * pending porter dispatch); bottlenecks = rows with a non-null bottleneck;
 * stopped = inactive logistics/production buildings. Pure and deterministic.
 */
export function logisticsAdvisorFromState(
  state: SimState,
  rows: ProductionAdvisorRow[],
): LogisticsAdvisorView {
  const stock: Record<string, number> = {};
  const production: Record<string, number> = {};
  const consumption: Record<string, number> = {};

  // workshop-held output joins the stock view (loads awaiting porter dispatch)
  for (const row of rows) {
    if (row.kind === 'workshop' && row.output > 0) {
      stock[row.commodity] = (stock[row.commodity] ?? 0) + row.output;
    }
    production[row.commodity] = (production[row.commodity] ?? 0) + row.producedLastTick * 30;
  }

  // every warehouse's physical stock
  for (const b of state.buildings) {
    if (b.type !== 'warehouse') continue;
    for (const [k, v] of Object.entries(b.stock)) {
      if (typeof v !== 'number' || v <= 0) continue;
      stock[k] = (stock[k] ?? 0) + v;
    }
  }

  // consumption: × 30 per staffed workshop consuming each catalog input
  for (const b of state.buildings) {
    const wkind = WORKSHOP_BUILDING_TYPES[b.type];
    if (!wkind || !b.active) continue;
    for (const input of WORKSHOPS[wkind].inputs) {
      consumption[input] = (consumption[input] ?? 0) + 30;
    }
  }

  let inTransit = 0;
  let bottlenecks = 0;
  for (const row of rows) {
    if (row.kind === 'workshop') inTransit += row.output;
    if (row.bottleneck !== null) bottlenecks += 1;
  }

  let stopped = 0;
  for (const b of state.buildings) {
    if (b.active) continue;
    if (b.type === 'warehouse' || WORKSHOP_BUILDING_TYPES[b.type] || EXTRACTION_BUILDING_TYPES[b.type] || RAW_OLIVE_GRAPE[b.type]) {
      stopped += 1;
    }
  }

  return { stock, production, consumption, inTransit, bottlenecks, stopped };
}

/**
 * === Trade advisor (TRAD-01..05, decision 7) ===
 *
 * A pure projection of runner trade state — never fabricated. Every number is
 * derived from the injected per-route trade state (orders, quota counters,
 * proceeds/spend) and the injected per-good price snapshot (base/current/trend).
 * Cities iterate in stable catalog order; goods in catalog buys-then-sells
 * order, so the view is fully deterministic.
 */

/** Serializable per-good price projection produced by the runner. */
export interface TradePriceSnapshotGood {
  base: number;
  current: number;
  trend: 'rising' | 'steady' | 'falling';
}

/** cityId → good → price projection. */
export type TradePriceSnapshot = Record<string, Record<string, TradePriceSnapshotGood>>;

export interface TradeAdvisorCity {
  cityId: string;
  name: string;
  landOrSea: 'land' | 'sea';
  opened: boolean;
  relationship: string;
  orders: Record<string, TradeOrderMode>;
  quota: Record<string, { used: number; cap: number; suspended: boolean }>;
  prices: Record<string, { base: number; current: number; trend: string }>;
}

export interface TradeAdvisorView {
  cities: TradeAdvisorCity[];
  totals: { exportProceeds: number; importSpend: number; activeRoutes: number };
}

export function tradeAdvisorFromState(
  routes: Record<string, TradeRoute>,
  prices: TradePriceSnapshot,
): TradeAdvisorView {
  const cities: TradeAdvisorCity[] = [];
  for (const city of Object.values(TRADE_CITIES)) {
    const route = routes[city.id];
    const opened = !!route?.enabled;
    const orders: Record<string, TradeOrderMode> = {};
    const quotaGoods: string[] = [];
    if (route?.orders) {
      for (const [g, m] of Object.entries(route.orders)) {
        if (m) {
          orders[g] = m as TradeOrderMode;
          quotaGoods.push(g);
        }
      }
    }
    if (route?.usedPerGood) {
      for (const g of Object.keys(route.usedPerGood)) if (!quotaGoods.includes(g)) quotaGoods.push(g);
    }
    const quota: Record<string, { used: number; cap: number; suspended: boolean }> = {};
    for (const g of quotaGoods) {
      const used = route?.usedPerGood?.[g] ?? 0;
      const cap = quotaFor(route ?? {}, g);
      quota[g] = { used, cap, suspended: cap > 0 && used >= cap };
    }
    const pricesRec: Record<string, { base: number; current: number; trend: string }> = {};
    const cityPrices = prices[city.id];
    if (cityPrices) {
      for (const [g, p] of Object.entries(cityPrices)) {
        pricesRec[g] = { base: p.base, current: p.current, trend: p.trend };
      }
    }
    cities.push({
      cityId: city.id,
      name: tradeCityName(city.id) ?? city.name,
      landOrSea: city.landOrSea,
      opened,
      relationship: city.relationship,
      orders,
      quota,
      prices: pricesRec,
    });
  }

  let exportProceeds = 0;
  let importSpend = 0;
  let activeRoutes = 0;
  for (const route of Object.values(routes)) {
    exportProceeds += route.exportProceeds ?? 0;
    importSpend += route.importSpend ?? 0;
    if (route.enabled) activeRoutes += 1;
  }
  return { cities, totals: { exportProceeds, importSpend, activeRoutes } };
}
