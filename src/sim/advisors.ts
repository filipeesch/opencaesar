/**
 * Management data layer — advisors, overlays, inspectors (tasks 9.6, 11.2,
 * 11.3, 11.4). These produce the real-data datasets the Phaser views render,
 * reading from the sim systems (ratings, finance, economy, services, water,
 * safety, trade). Self-contained and unit-testable.
 */
import { computeServiceCoverage } from './services';
import { type CityStats, computeTargets } from './ratings';
import type { TileWater, ReservoirState } from './water';
import { BUILDINGS } from './buildings';
import { HOUSE_TIERS } from './config';
import { dailyFoodConsumption, foodVariety, houseFoodDays, houseFoodFromUnits } from './housing';

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
}

export interface AdvisorDataset {
  name: string;
  data: Record<string, number>;
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
  return [
    { name: 'population', data: { population: s.population } },
    { name: 'labor', data: { employed: s.employed, jobs: s.jobs, unemployment: Math.max(0, s.jobs - s.employed) } },
    { name: 'finance', data: { treasury: s.treasury, taxRate: s.taxRate, wageRate: s.wageRate } },
    { name: 'ratings', data: { culture: targets.culture, prosperity: targets.prosperity, stability: targets.stability, favor: targets.favor } },
    { name: 'religion', data: { ...s.godWorship } },
    { name: 'health', data: { wellness: Math.round(services.health * 100) } },
    { name: 'education', data: { literacy: Math.round(services.literacy * 100) } },
    { name: 'entertainment', data: { coverage: Math.round(services.entertainment * 100) } },
  ];
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
import type { SimState } from './types';

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
