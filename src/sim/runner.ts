/**
 * SimRunner — the single public interface to the simulation.
 *
 * Deterministic: all randomness flows through the seeded RNG injected at
 * construction. Same seed + same map + same command sequence → identical
 * state after N ticks (see determinism tests).
 *
 * API: tick(), getState(), placeBuilding(type, x, y), demolish(x, y),
 * setPolicy(tax, wage), getCommandLog(). getState() returns plain serializable data.
 */

import { pickEvent, applyEvent, eventDuration, eventSustainMsg, eventFinalMsg } from './events';
import { EVENTS } from '../../data/events';
import { WALKERS } from '../../data/walkers';
import { BUILDINGS } from './buildings';
import { CONFIG, HOUSE_TIERS } from './config';
import { validateCatalogs, throwCatalogIssues } from '../../data/validate';
import { assignedWorkers, computeRatings, tickEconomy, totalJobs, workerPool } from './economy';
import { cityHappiness, houseHappiness } from './happiness';
import { computeTargets, tickRatings } from './ratings';
import { tickTrade } from './trade';
import {
  resolveTradeOrder, tradeExportGate, importGatedBy, quotaRemaining,
  quotaSuspended, consumeQuota, resetAnnualQuotas, createTradePriceState,
  sampleTradePrice, priceTrend, effectivePrice,
  type TradePriceState, type TradeOrderMode,
} from './trade';
import { COMMODITIES } from '../../data/commodities';
import { TRADE_CITIES, type TradeCityDef } from '../../data/trade';
import { CARAVAN_CAPACITY, SHIP_CAPACITY } from './transport';
import { tickMission } from './missions';
import { computeServiceCoverage, GODS, computeFavor } from './services';
import { TEMPLE_COVERAGE_FACTOR, GRAND_TEMPLE_COVERAGE_FACTOR } from '../../data/religion';
import { computeRisks, tickFire } from './safety';
import { taxCollected } from './taxation';
import { unlockedGov } from './governance';
import { ObjectiveTracker } from './objectives';
import { WaterSystem } from './water';
import { buildCodex } from './campaign';
import { desirabilityOf, tickHousing } from './housing';
import { Treasury, rollYear } from './finance';
import type { FinanceLedger } from './finance';
import { financeAdvisorFromState } from './advisors';
import type { FinanceAdvisorView } from './advisors';
import { defaultWarehousePolicy, warehouseAccepts, defaultMarketConfig } from './logistics';
import type { LogisticsAdvisorView, MarketConfig } from './logistics';
import {
  EXTRACTION_SITES, WORKSHOPS, emptyProduction, satisfiesDeposit, tickWorkshop,
  porterDestination, porterDeliversTo,
  EXTRACTION_BUILDING_TYPES, WORKSHOP_BUILDING_TYPES, RAW_OLIVE_GRAPE, EXTRACTION_OUTPUT_CAPACITY,
} from './production';
import { Map as SimMap } from './map';
import type { TileState } from './tile';
import { findRoadPath } from './pathfind';
import { checkPlacement } from './placement';
import type { Rng } from './rng';
import { mulberry32 } from './rng';
import type {
  BuildingState,
  BuildingType,
  CommandLogEntry,
  Good,
  MessageType,
  PlacementResult,
  Policy,
  SaveCommand,
  SaveData,
  SimMessage,
  SimState,
  Vec2,
  Ratings,
  TradeRoute,
  EventRecord,
  MissionState,
  WalkerState,
  WalkerType,
} from './types';
import type { BuildingInstance, WalkerInstance, SimInternals } from './walkers';
import { createWalker, updateWalker } from './walkers';
import { mayTraverse, walkerProfile } from './walkerProfiles';
import type { LoadDestination } from './production';
import { workshopStatus, workshopBottleneck } from './production';
import { productionAdvisorRows, productionAdvisorSummary, logisticsAdvisorFromState } from './advisors';
import type { ProductionAdvisorRow, ProductionAdvisorSummary, ProductionInternalNote } from './advisors';
import { tradeAdvisorFromState } from './advisors';
import type { TradeAdvisorView, TradePriceSnapshot, TradePriceSnapshotGood } from './advisors';
import { civilizationOverlayData } from './advisors';

/** Deferred commands. These share the exact shape of the replayable
 *  `SaveCommand` type, so a paused queue can be serialized verbatim into a save
 *  and re-enqueued on load, and the same exhaustive dispatch handles both. */
type PendingCommand = SaveCommand;

/** One-time guard: catalogs are validated on the first SimRunner construction
 *  per process (DATA-01). Cheap enough to run once, and the test suite pays no
 *  per-construction cost. INVARIANT: the memo skips re-validation on every later
 *  construction, so BALANCE and all data catalogs must stay immutable at
 *  runtime — do not add mutable catalog re-tuning without re-examining this. */
let catalogsValidated = false;

/** Production-chain constants (Phase 6). Warehouse good capacity matches the
 *  data catalog (data/buildings.ts: warehouse storageCapacity 40); per-commodity
 *  slot limit matches the default warehouse policy. Workshop input stock is
 *  capped so feedstock porters stop feeding an output-full workshop. */
const WAREHOUSE_CAPACITY = 40;
const PRODUCTION_WAREHOUSE_SLOTS = 16;
const WORKSHOP_INPUT_CAPACITY = 10;

function manhattan(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/** Reverse lookup: the catalog walker id a building spawns (fire_station → fireman). */
function walkerIdForBuilding(type: string): WalkerType | null {
  for (const def of Object.values(WALKERS)) {
    if (def.spawnedBy.includes(type)) return def.id as WalkerType;
  }
  return null;
}

/** Live-derived metrics from the running sim, exposed to advisors/UI (WARNING 1). */
export interface DerivedSnapshot {
  population: number;
  culture: number;
  prosperity: number;
  stability: number;
  favor: number;
  employment: { jobs: number; employed: number };
  services: { health: number; literacy: number; entertainment: number; religion: number };
  /** Per-god live worship (Phase 13, RELI-01) — empty without temples. */
  godWorship: Record<string, number>;
  water: { coveredTiles: number; totalTiles: number };
  fireRisk: number;
  collapseRisk: number;
  crime: number;
  treasury: number;
  taxes: number;
  wages: number;
  codex: { buildings: number; goods: number; services: number; gods: number };
  government: string[];
}

export class SimRunner {
  private readonly map: SimMap;
  private readonly rng: Rng;
  private readonly width: number;
  private readonly height: number;
  private readonly seed: number;
  private readonly mapSize: number;

  private tickCount = 0;
  /** Categorized treasury ledger — every revenue/expense write goes through it. */
  private readonly treasuryAccount: Treasury;
  private financeYear = 0;
  /** Consecutive ticks with unpaid wages (drives the arrears depth factor). */
  private unpaidStreakTicks = 0;
  /** Favor penalty from the last loan interest accrual (surfaced via advisor). */
  private loanFavorPenalty = 0;
  private policy: Policy = { taxRate: 0.1, wageRate: 0.1 };
  private lastWagesUnpaid = 0;

  private buildings: BuildingInstance[] = [];
  private walkers: WalkerInstance[] = [];
  private readonly buildingById = new Map<number, BuildingInstance>();
  private readonly occupiedTiles = new Map<number, number>();
  private nextBuildingId = 1;
  private nextWalkerId = 1;

  private messages: SimMessage[] = [];
  private eventLog: EventRecord[] = [];
  private commandLog: CommandLogEntry[] = [];
  /** Per-market configuration registry (MARK-02, decision 4): additive and inert
   *  until setMarketConfig stores an entry. Walkers read it via the
   *  SimInternals.marketConfig hook only when a market is explicitly configured. */
  private marketConfigs = new Map<number, MarketConfig>();
  /** Ordered list of state-changing commands, used to reconstruct a deterministic save. */
  private saveCommands: SaveCommand[] = [];
  private lowFoodWarnCooldown = 0;
  private paused = false;
  private pendingCommands: PendingCommand[] = [];
  private derived: DerivedSnapshot | null = null;
  private objective: ObjectiveTracker | null = null;

  constructor(seed: number, map?: SimMap, mapSize?: number) {
    if (!catalogsValidated) {
      throwCatalogIssues(validateCatalogs());
      catalogsValidated = true;
    }
    this.seed = seed;
    this.rng = mulberry32(seed);
    if (map) {
      this.map = map;
      this.width = map.width;
      this.height = map.height;
      this.mapSize = map.width;
    } else {
      this.width = mapSize ?? CONFIG.defaultMapSize;
      this.height = mapSize ?? CONFIG.defaultMapSize;
      this.mapSize = this.width;
      // Generate the map with THIS rng so the sim body continues the same
      // RNG stream the map generation consumed (required for deterministic
      // replay from a save).
      this.map = SimMap.generate(this.width, this.height, this.rng);
    }
    this.treasuryAccount = new Treasury(CONFIG.startingTreasury);
  }

  // Public API -----------------------------------------------------------------

  /** Advance the simulation by exactly one tick. */
  /** Toggle whether the sim will defer user commands until the next tick. */
  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  getPendingCommandCount(): number {
    return this.pendingCommands.length;
  }

  private drainPendingCommands(): void {
    if (this.pendingCommands.length === 0) return;
    const batch = this.pendingCommands;
    this.pendingCommands = [];
    for (const cmd of batch) applyCommand(this, cmd);
  }

  private enqueue(cmd: PendingCommand): void {
    this.pendingCommands.push(cmd);
  }

  tick(): void {
    this.drainPendingCommands();
    this.tickCount += 1;
    this.tickFinanceRollover();
    this.tickSpawns();
    this.tickLabor();
    this.tickFood();
    this.tickProduction();
    this.tickEconomyInternal();
    tickHousing(
      this.map,
      this.buildings,
      this.policy,
      this.lastWagesUnpaid > 0,
      (type, text) => this.emitMessage(type, text),
      this.arrearsDepth(),
    );

    // Walkers move last: coverage and arrivals see the tick's final services.
    for (const w of [...this.walkers]) updateWalker(this.simInternals(), w);

    // Random events (deterministic by seed + tick), with lifecycle tracking.
    if (this.activeEvent) {
      this.activeEvent.remaining -= 1;
      const ev = this.activeEvent;
      if (ev.remaining <= 0) {
        this.logEvent('event', eventFinalMsg(ev.id), EVENTS[ev.id]?.severity ?? 'mild');
        this.activeEvent = null;
      } else if (ev.remaining === Math.floor(ev.total / 2)) {
        const sustain = eventSustainMsg(ev.id);
        if (sustain) this.logEvent('event', sustain, EVENTS[ev.id]?.severity ?? 'mild');
      }
    }
    if (!this.activeEvent && this.tickCount % 40 === 0) {
      const ev = pickEvent(this.seed, this.tickCount);
      if (ev) {
        const result = applyEvent(ev, { culture: 10, prosperity: this.getState().ratings.prosperity, stability: 10, favor: 10 });
        this.logEvent('event', `${result.name}: ${result.message}`, result.severity);
        this.activeEvent = { id: ev, remaining: eventDuration(ev), total: eventDuration(ev) };
      }
    }

    // Missions / campaign win conditions.
    this.tickMissionSystem();

    // External trade (quota-reset by year).
    this.tickTradeSystem();

    // Anti-hoarding cap: excess above the limit is dropped and ledgered.
    this.tickFinanceCap();

    // Civil safety: per-building fire lifecycle, collapse risk, crime.
    this.tickSafety();

    // Remaining systems read live sim state into a derived snapshot (WARNING 1 fix).
    this.tickDerivedSystems();
  }

  private tickSafety(): void {
    const earthquake = this.activeEvent?.id === 'earthquake';
    const fireEvent = this.activeEvent?.id === 'fire';
    const firemen = this.walkers.filter((w) => w.type === 'fireman');
    for (const b of this.buildings) {
      const fresh = !b.safety;
      const s = (b.safety ??= { fire: 'none', danger: false, collapseRisk: 0, crime: 0, dousedTicks: 0 });
      const fireCoverage = this.safetyCoverage(b, 'fire_station');
      const engineerCoverage = this.safetyCoverage(b, 'engineer_post');
      const securityCoverage = this.safetyCoverage(b, 'prefecture');
      const r = computeRisks({
        density: this.buildingDensity(b),
        ageMonths: this.tickCount / 40,
        fireCoverage,
        engineerCoverage,
        securityCoverage,
      });
      // Fire events / earthquakes raise ignition hazard; stations and nearby
      // firemen provide the brigade response that puts fires out. Surges are
      // sized so only dense neighborhoods (fireRisk above ~0.5) ignite.
      const hazard = Math.min(1, r.fireRisk + (fireEvent ? 0.35 : earthquake ? 0.2 : 0));
      const response = fireCoverage >= 0.5 || this.firemanNear(b, firemen) ? 0.6 : 0;
      s.collapseRisk = Math.min(1, r.collapseRisk + (earthquake ? 0.6 : 0));
      if (s.fire === 'none') {
        // A doused building stays out until its immunity window passes.
        if (s.dousedTicks > 0) s.dousedTicks -= 1;
        else if (hazard > 0.7) s.fire = 'burning';
      } else {
        const next = tickFire(s.fire, hazard, response);
        if (next !== s.fire) {
          s.fire = next;
          // A brigade response extinguishes a burn and douses the site.
          if (next === 'none') s.dousedTicks = 10;
        }
      }
      s.danger = s.danger || s.collapseRisk > 0.8 || s.fire === 'destroyed';
      // Crime starts at the derived level; afterwards it converges toward it,
      // so a patrol (marshal) leaves a visible multi-tick calm.
      s.crime = fresh ? r.crime : s.crime + (r.crime - s.crime) * 0.05;
    }
  }

  /** Structural density: fraction of the 24 tiles within manhattan 3 occupied. */
  private buildingDensity(b: BuildingInstance): number {
    let n = 0;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (dx === 0 && dy === 0) continue;
        const o = this.buildingAt(b.x + dx, b.y + dy);
        if (o && o.id !== b.id) n++;
      }
    }
    return Math.min(1, n / 24);
  }

  /** 1 when an active station of the given type covers the building (radius 6). */
  private safetyCoverage(b: BuildingInstance, stationType: string): number {
    for (const s of this.buildings) {
      if (s.type !== stationType || !s.active) continue;
      if (manhattan(s.x, s.y, b.x, b.y) <= CONFIG.safetyCoverageRadius) return 1;
    }
    return 0;
  }

  /** Fraction of houses with fresh walker-delivered access to a civic service
   *  (Phase 12): the live coverage feeding the advisor service dataset. */
  private civicCoverage(service: string): number {
    let houses = 0;
    let covered = 0;
    for (const b of this.buildings) {
      if (!b.house) continue;
      houses += 1;
      if ((b.house.services?.[service] ?? 0) > 0) covered += 1;
    }
    return houses === 0 ? 0 : covered / houses;
  }

  /** Any fireman walker within manhattan patrol radius of the building. */
  private firemanNear(b: BuildingInstance, firemen: WalkerInstance[]): boolean {
    for (const w of firemen) {
      if (manhattan(w.x, w.y, b.x, b.y) <= CONFIG.safetyPatrolRadius) return true;
    }
    return false;
  }

  private tickDerivedSystems(): void {
    const snapshot = this.derivedSnapshot();
    this.derived = snapshot;
    if (this.objective) {
      this.objective.update({ population: snapshot.population, culture: snapshot.culture, prosperity: snapshot.prosperity, stability: snapshot.stability });
    }
  }

  private tickTradeSystem(): void {
    const year = Math.floor(this.tickCount / 360);
    // Per-good quotas reset on the tick-based year clock (TRAD-04).
    resetAnnualQuotas(this.tradeRoutes, year);

    // Legacy abstract ledger: enabled routes WITHOUT per-good orders keep the
    // original wheat ledger behavior (enableTrade + setImportOrder), so the
    // existing wheat-trade tests and goldens are byte-identical.
    const legacyRoutes: Record<string, import('./trade').TradeRouteState> = {};
    for (const route of Object.values(this.tradeRoutes)) {
      if (route.orders === undefined) legacyRoutes[route.cityId] = route;
    }
    if (Object.keys(legacyRoutes).length > 0) {
      const stock: Record<string, number> = { wheat: 0 };
      for (const b of this.buildings) {
        if ((b.type === 'granary' || b.type === 'farm') && b.stock) {
          stock.wheat = (stock.wheat ?? 0) + (b.stock.wheat ?? 0);
        }
      }
      const result = tickTrade(this.treasuryAccount.balance, stock, legacyRoutes, year);
      const delta = result.treasury - this.treasuryAccount.balance;
      if (delta > 0) this.treasuryAccount.addRevenue('trade', delta);
      else if (delta < 0) this.treasuryAccount.addExpense('trade', -delta);
      this.treasuryAccount.balance = result.treasury;
      // Apply physical export/import stock changes across granaries/farms.
      const exportedWheat = result.exports.wheat ?? 0;
      if (exportedWheat > 0) {
        let remaining = exportedWheat;
        for (const b of this.buildings) {
          if (remaining <= 0) break;
          if ((b.type === 'granary' || b.type === 'farm') && b.stock && (b.stock.wheat ?? 0) > 0) {
            const take = Math.min(remaining, b.stock.wheat ?? 0);
            b.stock.wheat = (b.stock.wheat ?? 0) - take;
            remaining -= take;
          }
        }
      }
      const importedWheat = result.imports.wheat ?? 0;
      if (importedWheat > 0) {
        const granary = this.buildings.find((b) => b.type === 'granary');
        if (granary && granary.stock) {
          granary.stock.wheat = (granary.stock.wheat ?? 0) + importedWheat;
        }
      }
    }

    // Physical path (TRAD-02/04/05 runtime): routes with per-good orders dispatch
    // real caravan/ship walkers against live warehouse/granary stock.
    this.tickTradeRoutes(year);
  }

  /** Per-good price states per city (cityId → good → TradePriceState). */
  private readonly tradePrices = new Map<string, Map<string, TradePriceState>>();
  /** Merchant arrival countdown per (city, good): `cityId:good` → ticks left. */
  private readonly tradeCooldowns = new Map<string, number>();

  /** Primary-orientation base for a good/city trade price (export base when the
   *  city buys the good, else import base) — the advisor's displayed base. */
  private ensureTradePriceState(city: TradeCityDef, good: string): TradePriceState {
    let byGood = this.tradePrices.get(city.id);
    if (!byGood) {
      byGood = new Map();
      this.tradePrices.set(city.id, byGood);
    }
    let state = byGood.get(good);
    if (!state) {
      const isBuy = city.buys.includes(good);
      const base = this.tradeBasePrice(city, good, isBuy || !city.sells.includes(good));
      state = createTradePriceState(base);
      byGood.set(good, state);
    }
    return state;
  }

  /** Base price for a good in a direction, scaled by whole-city and per-good
   *  modifiers (import base always exceeds export base — catalog invariant). */
  private tradeBasePrice(city: TradeCityDef, good: string, isExport: boolean): number {
    const def = COMMODITIES[good];
    if (!def) return 0;
    const base = isExport ? def.baseExportPrice : def.baseImportPrice;
    const whole = city.priceModifier ?? 1;
    const per = city.priceModifiers?.[good] ?? 1;
    return base * whole * per;
  }

  /** Effective transactable price for a good in a direction (modifier applied,
   *  clamped to the balance floor). */
  private tradePriceFor(city: TradeCityDef, good: string, isExport: boolean): number {
    const state = this.ensureTradePriceState(city, good);
    const price = Math.round(this.tradeBasePrice(city, good, isExport) * state.modifier);
    return Math.max(CONFIG.tradePriceFloor, price);
  }

  /** Sample the deterministic per-good price state every tick (injected tick). */
  private sampleRoutePrices(city: TradeCityDef, route: TradeRoute): void {
    for (const good of this.routeGoods(city)) {
      if (resolveTradeOrder(route, good) === 'no_trade') continue;
      const state = this.ensureTradePriceState(city, good);
      const isBuy = city.buys.includes(good);
      const price = this.tradePriceFor(city, good, !isBuy ? false : true);
      sampleTradePrice(state, price, this.tickCount);
      priceTrend(state, this.tickCount);
    }
  }

  /** Stable per-city good iteration: buys first, then sells, in catalog order. */
  private routeGoods(city: TradeCityDef): string[] {
    const goods: string[] = [];
    for (const g of city.buys) if (!goods.includes(g)) goods.push(g);
    for (const g of city.sells) if (!goods.includes(g)) goods.push(g);
    return goods;
  }

  /** Deterministic road tile on the map border acting as the regional entry
   *  (caravans); ships share the marker (no sea graph — maritime leg is
   *  tick-duration + berth/entrepot state). */
  private tradeEntryTile(): Vec2 | null {
    for (let x = 0; x < this.width; x++) {
      if (this.map.get(x, 0) === 'road') return { x, y: 0 };
      if (this.map.get(x, this.height - 1) === 'road') return { x, y: this.height - 1 };
    }
    for (let y = 0; y < this.height; y++) {
      if (this.map.get(0, y) === 'road') return { x: 0, y };
      if (this.map.get(this.width - 1, y) === 'road') return { x: this.width - 1, y };
    }
    return null;
  }

  /** Storage building types that can hold `good` (granary for food, warehouse
   *  otherwise — catalog `storage`). */
  private tradeStorageHosts(good: string): BuildingType[] {
    const def = COMMODITIES[good];
    return def?.storage === 'granary' ? ['granary', 'farm'] : ['warehouse'];
  }

  private totalTradeStock(good: string): number {
    let t = 0;
    for (const b of this.buildings) {
      if (!this.tradeStorageHosts(good).includes(b.type)) continue;
      t += (b.stock as Record<string, number | undefined>)[good] ?? 0;
    }
    return t;
  }

  private storageRoom(b: BuildingInstance, good: string): number {
    const def = COMMODITIES[good];
    if (!def) return 0;
    if (def.storage === 'granary') return Math.max(0, CONFIG.granaryCapacity - this.usedUnits(b.stock));
    const room = Math.max(0, WAREHOUSE_CAPACITY - this.usedUnits(b.stock));
    const usedSlots = Object.keys(b.stock).filter((k) => ((b.stock as Record<string, number | undefined>)[k] ?? 0) > 0).length;
    if (usedSlots >= PRODUCTION_WAREHOUSE_SLOTS) return 0;
    if (!warehouseAccepts(defaultWarehousePolicy(), good, usedSlots)) return 0;
    return room;
  }

  /** Nearest road-reachable storage with stock of `good` (export source). */
  private exportSourceFor(good: string, entry: Vec2): BuildingInstance | null {
    let best: BuildingInstance | null = null;
    let bestDist = Infinity;
    for (const b of this.buildings) {
      if (!this.tradeStorageHosts(good).includes(b.type)) continue;
      if (((b.stock as Record<string, number | undefined>)[good] ?? 0) <= 0) continue;
      const road = this.adjacentRoadTile(b);
      if (!road) continue;
      const path = findRoadPath(this.map, entry, road);
      if (path === null) continue;
      if (path.length < bestDist) {
        bestDist = path.length;
        best = b;
      }
    }
    return best;
  }

  /** Nearest road-reachable storage with room for `good` (import dest). */
  private importStorageFor(good: string, entry: Vec2): BuildingInstance | null {
    let best: BuildingInstance | null = null;
    let bestDist = Infinity;
    for (const b of this.buildings) {
      if (!this.tradeStorageHosts(good).includes(b.type)) continue;
      const room = this.storageRoom(b, good);
      if (room <= 0) continue;
      const road = this.adjacentRoadTile(b);
      if (!road) continue;
      const path = findRoadPath(this.map, entry, road);
      if (path === null) continue;
      if (path.length < bestDist) {
        bestDist = path.length;
        best = b;
      }
    }
    return best;
  }

  private tickTradeRoutes(year: number): void {
    for (const city of Object.values(TRADE_CITIES)) {
      const route = this.tradeRoutes[city.id];
      if (!route || route.orders === undefined || !route.enabled) continue;
      this.sampleRoutePrices(city, route);
      const entry = this.tradeEntryTile();
      if (!entry) continue;
      for (const good of this.routeGoods(city)) {
        this.dispatchTradeGood(city, route, good, year, entry);
      }
    }
  }

  /**
   * Authorize one merchant arrival for a good (per city, good), tick-gated by
   * merchantFrequency. Deterministic: cooldown counts ticks, iteration is in
   * stable catalog order, and no clock/RNG is involved.
   */
  private dispatchTradeGood(city: TradeCityDef, route: TradeRoute, good: string, _year: number, entry: Vec2): void {
    const order = resolveTradeOrder(route, good);
    if (order === 'no_trade' || order === 'stockpile') return; // never move
    const key = `${city.id}:${good}`;
    const cd = this.tradeCooldowns.get(key) ?? 0;
    if (cd > 0) {
      this.tradeCooldowns.set(key, cd - 1);
      return;
    }
    const schedule = (): void => { this.tradeCooldowns.set(key, Math.max(1, city.merchantFrequency)); };
    if (quotaSuspended(route, good)) return;

    const ship = city.landOrSea === 'sea';
    const capacity = ship ? SHIP_CAPACITY : CARAVAN_CAPACITY;

    if (order === 'export_all' || order === 'export_above_reserve') {
      const stockTotal = this.totalTradeStock(good);
      const reserve = order === 'export_above_reserve' ? (route.exportReserve?.[good] ?? 0) : 0;
      const gate = tradeExportGate({ order, stock: stockTotal, reserved: 0, quotaLeft: quotaRemaining(route, good), reserve });
      if (!gate.allowed) {
        schedule();
        return;
      }
      const source = this.exportSourceFor(good, entry);
      if (!source) {
        schedule();
        return;
      }
      const sourceStock = (source.stock as Record<string, number | undefined>)[good] ?? 0;
      const qty = Math.min(
        Math.max(0, order === 'export_above_reserve' ? stockTotal - reserve : stockTotal),
        capacity,
        quotaRemaining(route, good),
        sourceStock,
      );
      if (qty <= 0) {
        schedule();
        return;
      }
      const price = this.tradePriceFor(city, good, true);
      this.treasuryAccount.addRevenue('trade', price * qty);
      route.exportProceeds = (route.exportProceeds ?? 0) + price * qty;
      consumeQuota(route, good, qty);
      this.spawnTradeCarrier(city, good, qty, true, source.id, null);
      schedule();
      return;
    }

    if (order === 'import_upto_target') {
      const target = route.importTargets?.[good] ?? 0;
      if (target <= 0) {
        schedule();
        return;
      }
      const stockTotal = this.totalTradeStock(good);
      const gate = importGatedBy({ order, stock: stockTotal, target, quotaLeft: quotaRemaining(route, good), treasury: this.treasuryAccount.balance, price: this.tradePriceFor(city, good, false) });
      if (!gate.allowed) {
        schedule();
        return;
      }
      const dest = this.importStorageFor(good, entry);
      if (!dest) {
        schedule();
        return;
      }
      const price = this.tradePriceFor(city, good, false);
      const affordable = Math.floor(this.treasuryAccount.balance / price);
      const qty = Math.min(target - stockTotal, capacity, quotaRemaining(route, good), affordable, this.storageRoom(dest, good));
      if (qty <= 0) {
        schedule();
        return;
      }
      this.treasuryAccount.addExpense('trade', price * qty);
      route.importSpend = (route.importSpend ?? 0) + price * qty;
      consumeQuota(route, good, qty);
      this.spawnTradeCarrier(city, good, qty, false, null, dest.id);
      schedule();
      return;
    }
    schedule();
  }

  /** Spawn a caravan/ship at the regional entry; exports collect at the source
   *  (load as they arrive), imports arrive already carrying and deposit at the
   *  destination storage. */
  private spawnTradeCarrier(city: TradeCityDef, good: string, qty: number, isExport: boolean, sourceId: number | null, destId: number | null): void {
    const entry = this.tradeEntryTile();
    if (!entry) return;
    const ship = city.landOrSea === 'sea';
    const type: WalkerType = ship ? 'ship' : 'caravan';
    const w = createWalker(type, entry.x, entry.y, this.nextWalkerId++);
    w.trade = {
      good,
      amount: qty,
      isExport,
      capacity: ship ? SHIP_CAPACITY : CARAVAN_CAPACITY,
      ship,
      sourceBuildingId: sourceId,
      destBuildingId: destId,
      waitTicks: 0,
      loaded: !isExport,
    };
    if (!isExport) {
      w.carryingGood = good as Good;
      w.carriedAmount = qty;
    }
    this.walkers.push(w);
  }

  /** Open a trade route with a partner city (§19.1 TRAD-02): charges the
   *  catalog routeOpeningCost and defaults every good to no_trade (opening never
   *  forces a transaction). */
  openTradeRoute(cityId: string): { ok: boolean; cost: number; error?: string } {
    const city = TRADE_CITIES[cityId];
    if (!city) return { ok: false, cost: 0, error: 'unknown city' };
    const cost = Math.round(city.routeOpeningCost);
    let route = this.tradeRoutes[cityId];
    if (route?.enabled) return { ok: true, cost: 0, error: 'already open' };
    if (this.treasuryAccount.balance < cost) return { ok: false, cost, error: 'insufficient funds' };
    if (!route) {
      route = { cityId, enabled: false, imports: {}, exports: {} };
      this.tradeRoutes[cityId] = route;
    }
    this.treasuryAccount.addExpense('other', cost);
    route.enabled = true;
    route.orders = route.orders ?? {};
    route.openYear = Math.floor(this.tickCount / 360);
    route.catalogQuota = city.annualQuotaPerGood;
    route.lastYear = Math.floor(this.tickCount / 360);
    return { ok: true, cost };
  }

  /** Set a per-good §19.6 order mode (validates the good is traded by the
   *  city). Additive API — never used by the legacy enableTrade path. */
  setTradeOrder(cityId: string, good: string, mode: TradeOrderMode, opts?: { reserve?: number; target?: number }): { ok: boolean; error?: string } {
    const city = TRADE_CITIES[cityId];
    if (!city) return { ok: false, error: 'unknown city' };
    if (!city.buys.includes(good) && !city.sells.includes(good)) {
      return { ok: false, error: `${good} is not traded by ${city.name}` };
    }
    let route = this.tradeRoutes[cityId];
    if (!route) {
      route = { cityId, enabled: false, imports: {}, exports: {} };
      this.tradeRoutes[cityId] = route;
    }
    route.orders = route.orders ?? {};
    route.orders[good] = mode;
    if (opts?.reserve !== undefined) route.exportReserve = { ...route.exportReserve, [good]: opts.reserve };
    if (opts?.target !== undefined) route.importTargets = { ...route.importTargets, [good]: opts.target };
    if (mode !== 'no_trade' && !route.enabled) route.enabled = true;
    return { ok: true };
  }

  /**
   * Live per-god worship (Phase 13): the share of houses with fresh temple
   * access for a god, scaled by the serving temple's coverage factor (grand
   * temples count double). Empty when the city has no temples — the legacy
   * derived state had no religion beyond the hardcoded jupiter stub, which
   * this replaces with real coverage. Purely deterministic.
   */
  private liveGodWorship(): Record<string, number> {
    const temples = this.buildings.filter((b) => (b.type === 'temple' || b.type === 'grand_temple') && b.god);
    if (temples.length === 0) return {};
    const houses = this.buildings.filter((b) => b.house);
    const total = houses.length;
    const factorOf = (type: BuildingType) =>
      type === 'grand_temple' ? GRAND_TEMPLE_COVERAGE_FACTOR : TEMPLE_COVERAGE_FACTOR;
    const worship: Record<string, number> = {};
    for (const t of temples) {
      const god = t.god as string;
      let served = 0;
      for (const h of houses) {
        if ((h.house!.godAccess?.[god] ?? 0) > 0) served += 1;
      }
      const covered = total === 0 ? 0 : served / total;
      const boosted = Math.min(1, covered * factorOf(t.type));
      worship[god] = Math.max(worship[god] ?? 0, boosted);
    }
    return worship;
  }

  private derivedSnapshot(): DerivedSnapshot {
    const population = this.getPopulation();
    const employment = this.getEmployment();
    const has = (cat: string) => this.buildings.some((b) => BUILDINGS[b.type].category === cat);
    const targets = computeTargets({
      population, treasury: this.getTreasury(), taxRate: this.policy.taxRate,
      hasReligion: has('religion'), hasEntertainment: has('entertainment'), hasEducation: has('education'),
      hasHealth: has('health'), hasWater: has('water'), hasFood: has('food'),
    });
    const godWorship = this.liveGodWorship();
    const serviceCoverage = computeServiceCoverage({
      doctorCoverage: this.civicCoverage('health'),
      educationCoverage: this.civicCoverage('literacy'),
      entertainmentCoverage: this.civicCoverage('entertainment'),
      godWorship,
    });
    const water = new WaterSystem();
    const well = this.buildings.find((b) => b.type === 'well' || b.type === 'fountain');
    water.setSources(well ? [{ x: well.x, y: well.y, kind: 'well', active: true, radius: 2 }] : []);
    const grid = water.compute(this.width, this.height, () => 0);
    let coveredTiles = 0;
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) if (grid[y][x].coveredByWell) coveredTiles++;

    let fireRisk = 0; let collapseRisk = 0; let crime = 0;
    for (const b of this.buildings) {
      const r = computeRisks({
        density: this.buildingDensity(b),
        ageMonths: this.tickCount / 40,
        fireCoverage: this.safetyCoverage(b, 'fire_station'),
        engineerCoverage: this.safetyCoverage(b, 'engineer_post'),
        securityCoverage: this.safetyCoverage(b, 'prefecture'),
      });
      fireRisk = Math.max(fireRisk, r.fireRisk); collapseRisk = Math.max(collapseRisk, r.collapseRisk); crime = Math.max(crime, r.crime);
    }
    const taxes = taxCollected(population, 2, this.policy.taxRate, 1);
    const wages = employment.employed * CONFIG.wagePerWorkerPerTick * this.policy.wageRate;
    const codex = buildCodex();
    return {
      population, culture: targets.culture, prosperity: targets.prosperity, stability: targets.stability,
      favor: Math.min(100, targets.favor + computeFavor(godWorship)),
      employment: { jobs: employment.totalJobs, employed: employment.employed },
      services: serviceCoverage,
      godWorship,
      water: { coveredTiles, totalTiles: this.width * this.height },
      fireRisk, collapseRisk, crime, treasury: this.getTreasury(), taxes, wages,
      codex: { buildings: codex.filter((e) => e.kind === 'building').length, goods: codex.filter((e) => e.kind === 'commodity').length, services: codex.filter((e) => e.kind === 'service').length, gods: codex.filter((e) => e.kind === 'god').length },
      government: unlockedGov(population).map((g) => g.id),
    };
  }

  /** Live-derived advisor data (wired from the running sim). */
  getDerived(): DerivedSnapshot {
    return this.derived ?? this.derivedSnapshot();
  }

  /** Civilization overlay (Phase 11): per-tile fire / danger / collapse /
   *  crime grids projected from the live per-building safety state. */
  getCivilizationOverlay(): Record<string, number[][]> {
    return civilizationOverlayData(
      this.width,
      this.height,
      this.buildings.map((b) => {
        const fp = BUILDINGS[b.type].footprint;
        return { x: b.x, y: b.y, w: fp, h: fp, safety: b.safety };
      }),
    );
  }

  /** Civic wellness (Phase 12): live per-house health/literacy/entertainment
   *  stats plus the aggregate advisor coverage. Pure projection — additive,
   *  never serialized. */
  getCivicStats(): {
    coverage: { health: number; literacy: number; entertainment: number };
    houses: { id: number; health: number; literacy: number; entertainment: number }[];
  } {
    return {
      coverage: {
        health: this.civicCoverage('health'),
        literacy: this.civicCoverage('literacy'),
        entertainment: this.civicCoverage('entertainment'),
      },
      houses: this.buildings
        .filter((b) => b.house)
        .map((b) => ({
          id: b.id,
          health: b.house!.civic?.health ?? 0,
          literacy: b.house!.civic?.literacy ?? 0,
          entertainment: b.house!.civic?.entertainment ?? 0,
        })),
    };
  }

  /** Production advisor rows derived from live sim state (PROD-02). Reads the
   *  internal per-building production state recorded by tickProduction. */
  getProductionAdvisorRows(): ProductionAdvisorRow[] {
    return productionAdvisorRows(this.getState(), this.productionNotes());
  }

  /** Production advisor dataset: per-building rows plus an aggregate summary
   *  that counts output stock on the books (workshop output + warehouse stock). */
  getProductionAdvisor(): { rows: ProductionAdvisorRow[]; summary: ProductionAdvisorSummary } {
    const rows = this.getProductionAdvisorRows();
    const summary = productionAdvisorSummary(rows);
    for (const b of this.buildings) {
      if (b.type !== 'warehouse') continue;
      for (const [k, v] of Object.entries(b.stock)) {
        if (typeof v !== 'number' || v <= 0) continue;
        summary.outputStock[k] = (summary.outputStock[k] ?? 0) + v;
      }
    }
    return { rows, summary };
  }

  /** Live logistics advisor (WARE-03, decision 4): every aggregate — stock,
   *  production, consumption, in-transit, bottlenecks, stopped — is derived
   *  from the running sim, never fabricated. Pure projection over live state
   *  and the production advisor rows; does not mutate or restructure SimState. */
  getLogisticsAdvisor(): LogisticsAdvisorView {
    return logisticsAdvisorFromState(this.getState(), this.getProductionAdvisorRows());
  }

  /** Serializable per-good trade price projection (cityId → good →
   *  { base, current, trend }) for the trade advisor. Live-derived, never
   *  fabricated; SimState stays untouched. */
  tradePriceSnapshot(): TradePriceSnapshot {
    const out: TradePriceSnapshot = {};
    for (const city of Object.values(TRADE_CITIES)) {
      const byGood = this.tradePrices.get(city.id);
      if (!byGood) continue;
      const rec: Record<string, TradePriceSnapshotGood> = {};
      for (const good of this.routeGoods(city)) {
        const st = byGood.get(good);
        if (!st) continue;
        rec[good] = {
          base: st.base,
          current: effectivePrice(st, this.tickCount),
          trend: priceTrend(st, this.tickCount),
        };
      }
      if (Object.keys(rec).length > 0) out[city.id] = rec;
    }
    return out;
  }

  /** Live trade advisor (TRAD-01..05, decision 7): every number — routes,
   *  orders, per-good quota used/cap/suspension, prices base/current/trend,
   *  proceeds/spend — is derived from the runner trade state, never fabricated. */
  getTradeAdvisor(): TradeAdvisorView {
    return tradeAdvisorFromState(this.tradeRoutes, this.tradePriceSnapshot());
  }

  /** Hydrate the per-building internal notes from live BuildingInstances. */
  private productionNotes(): Map<number, ProductionInternalNote> {
    const notes = new Map<number, ProductionInternalNote>();
    for (const b of this.buildings) {
      const wkind = WORKSHOP_BUILDING_TYPES[b.type];
      const exKind = EXTRACTION_BUILDING_TYPES[b.type];
      const farm = RAW_OLIVE_GRAPE[b.type];
      if (wkind) {
        if (!b.production) continue;
        const def = WORKSHOPS[wkind];
        const status = workshopStatus(def, b.production);
        const output = b.production.output[def.produces] ?? 0;
        // A workshop with nothing to deliver is not destination-blocked; with
        // output pending it has a destination only when a porter dispatched it.
        const hasDestination = output <= 0 || b.lastDestinationId != null;
        let bottleneck: string | null = null;
        if (status === 'working') {
          if (workshopBottleneck(def, b.production, hasDestination) === 'no_destination') bottleneck = 'no_destination';
        } else {
          bottleneck = status;
        }
        notes.set(b.id, {
          inputs: { ...b.production.inputs },
          output,
          status,
          bottleneck,
          destination: b.lastDestinationId ?? null,
          destinationKind: b.lastDestinationKind ?? null,
          producedLastTick: b.lastProduced ?? 0,
        });
      } else if (exKind || farm) {
        if (!b.production) continue;
        const commodity = exKind ? EXTRACTION_SITES[exKind].produces : farm!.produces;
        const blocked = !b.active || b.production.blocked;
        notes.set(b.id, {
          inputs: {},
          output: (b.stock as Record<string, number | undefined>)[commodity] ?? 0,
          status: blocked ? 'blocked' : 'working',
          bottleneck: null,
          destination: null,
          destinationKind: null,
          producedLastTick: b.lastProduced ?? 0,
        });
      }
    }
    return notes;
  }

  /** Set an objective/win-condition to evaluate each tick. */
  setObjective(target: { population?: number; culture?: number; prosperity?: number; stability?: number; sustainChecks: number }): void {
    this.objective = new ObjectiveTracker(target);
  }

  getObjectiveProgress(): { won: boolean; progress: number } | null {
    if (!this.objective) return null;
    const d = this.derived ?? this.derivedSnapshot();
    const r = this.objective.update({ population: d.population, culture: d.culture, prosperity: d.prosperity, stability: d.stability });
    return { won: r.won, progress: this.objective.progress() };
  }

  private tickMissionSystem(): void {
    if (!this.mission || this.mission.complete || this.mission.failed) return;
    const cityStats = {
      population: this.getPopulation(),
      treasury: this.getTreasury(),
      taxRate: this.policy.taxRate,
      hasReligion: false,
      hasEntertainment: false,
      hasEducation: false,
      hasHealth: false,
      hasWater: this.buildings.some((b) => BUILDINGS[b.type].category === 'water'),
      hasFood: this.buildings.some((b) => BUILDINGS[b.type].category === 'food'),
    };
    const target = computeTargets(cityStats);
    this.missionRatings = tickRatings(this.missionRatings, target);
    tickMission(this.mission, {
      population: cityStats.population,
      culture: this.missionRatings.culture,
      prosperity: this.missionRatings.prosperity,
      stability: this.missionRatings.stability,
      year: Math.floor(this.tickCount / 360),
    });
  }

  /** Place a building at footprint anchor (x, y). Rejected commands leave state unchanged.
   *  Temples/grand temples take an optional `god` (defaults to 'jupiter'). */
  placeBuilding(type: BuildingType, x: number, y: number, options?: { god?: string }): PlacementResult {
    if (this.paused) {
      this.enqueue({ kind: 'place', type, x, y, god: options?.god });
      return { ok: true };
    }
    const def = BUILDINGS[type];
    if (def.category === 'religion' && options?.god && !(GODS as readonly string[]).includes(options.god)) {
      this.commandLog.push({ tick: this.tickCount, command: `place ${type}@${x},${y}`, result: 'invalid-god' });
      return { ok: false, error: 'invalid-god' };
    }
    const result = checkPlacement(
      this.map,
      (tx, ty) => this.occupiedTiles.has(this.tileKey(tx, ty)),
      this.treasuryAccount.balance,
      type,
      x,
      y,
    );
    if (!result.ok) {
      this.commandLog.push({ tick: this.tickCount, command: `place ${type}@${x},${y}`, result: result.error });
      return result;
    }

    this.treasuryAccount.addExpense('other', def.cost);

    const id = this.nextBuildingId++;
    const building: BuildingInstance = {
      id,
      type,
      x,
      y,
      footprint: def.footprint,
      workersAssigned: 0,
      workersRequired: def.workers,
      active: false,
      laborConnected: false,
      laborCooldown: 0,
      spawnCooldown: 0,
      stock: {},
    };
    if (type === 'house') {
      building.house = { tier: 0, foodCooldown: 0, waterCooldown: 0, laborCooldown: 0, evolveCounter: 0, devolveCounter: 0 };
    } else if (def.production || def.storageCapacity !== undefined) {
      building.stock.wheat = 0;
    }

    if (type === 'road') {
      this.map.setRect(x, y, x + def.footprint - 1, y + def.footprint - 1, 'road');
    }
    if (def.category === 'religion') {
      building.god = options?.god ?? 'jupiter';
    }

    this.buildings.push(building);
    this.buildingById.set(id, building);
    for (let dy = 0; dy < def.footprint; dy++) {
      for (let dx = 0; dx < def.footprint; dx++) {
        this.occupiedTiles.set(this.tileKey(x + dx, y + dy), id);
      }
    }

    this.commandLog.push({ tick: this.tickCount, command: `place ${type}@${x},${y}`, result: 'ok' });
    this.saveCommands.push({ kind: 'place', type, x, y, god: building.god });
    return { ok: true };
  }

  /**
   * Demolish the building whose footprint covers (x, y). Returns false when no
   * building occupies the tile. Removes the building from the sim, clears its
   * footprint from the occupancy grid, and (for roads) resets the footprint to
   * 'earth'. While paused, the order is queued (PendingCommand) and applied on
   * the next fixed tick.
   */
  demolish(x: number, y: number): boolean {
    if (this.paused) {
      this.enqueue({ kind: 'demolish', x, y });
      return true;
    }
    const building = this.buildingAt(x, y);
    if (!building) return false;
    const { id, type, footprint } = building;
    this.buildings = this.buildings.filter((b) => b.id !== id);
    this.buildingById.delete(id);
    for (let dy = 0; dy < footprint; dy++) {
      for (let dx = 0; dx < footprint; dx++) {
        this.occupiedTiles.delete(this.tileKey(building.x + dx, building.y + dy));
      }
    }
    if (type === 'road') {
      const x0 = building.x;
      const y0 = building.y;
      const x1 = building.x + footprint - 1;
      const y1 = building.y + footprint - 1;
      this.map.setRect(x0, y0, x1, y1, 'earth');
      // A demolished road must clear its road-type side-channel too (WR-01):
      // otherwise getTileState reports road:false with a phantom
      // roadType (e.g. 'paved') on what is now bare terrain.
      for (let dy = y0; dy <= y1; dy++) {
        for (let dx = x0; dx <= x1; dx++) this.map.setRoadType(dx, dy, null);
      }
    }
    this.commandLog.push({ tick: this.tickCount, command: `demolish ${x},${y}`, result: 'ok' });
    this.saveCommands.push({ kind: 'demolish', x, y });
    return true;
  }

  /** Non-mutating placement check (used by the renderer ghost preview). */
  canPlace(type: BuildingType, x: number, y: number): PlacementResult {
    return checkPlacement(
      this.map,
      (tx, ty) => this.occupiedTiles.has(this.tileKey(tx, ty)),
      this.treasuryAccount.balance,
      type,
      x,
      y,
    );
  }

  /** Set the tax and wage rates (each clamped to 0..1). */
  setPolicy(taxRate: number, wageRate: number): Policy {
    if (this.paused) {
      this.enqueue({ kind: 'setPolicy', taxRate: clamp01(taxRate), wageRate: clamp01(wageRate) });
      return { ...this.policy };
    }
    this.policy = { taxRate: clamp01(taxRate), wageRate: clamp01(wageRate) };
    this.commandLog.push({
      tick: this.tickCount,
      command: `setPolicy ${this.policy.taxRate} ${this.policy.wageRate}`,
      result: 'ok',
    });
    this.saveCommands.push({ kind: 'setPolicy', taxRate: this.policy.taxRate, wageRate: this.policy.wageRate });
    return { ...this.policy };
  }

  /** Current policy snapshot (for UI that edits one slider at a time). */
  getPolicy(): Policy {
    return { ...this.policy };
  }

  /** Plain serializable snapshot of the current simulation state. */
  getState(): SimState {
    const happiness = cityHappiness(
      this.buildings
        .filter((b) => b.house)
        .map((b) => ({
          population: HOUSE_TIERS[b.house!.tier].population,
          happiness: houseHappiness(this.houseHappinessInput(b)),
        })),
    );
    return {
      tick: this.tickCount,
      width: this.width,
      height: this.height,
      tiles: this.map.toGrid(),
      buildings: this.buildings.map((b) => this.toBuildingState(b)),
      walkers: this.walkers.map((w) => this.toWalkerState(w)),
      treasury: this.treasuryAccount.balance,
      policy: { ...this.policy },
      ratings: computeRatings(this.buildings, this.treasuryAccount.balance, happiness),
      totalWorkers: workerPool(this.buildings),
      assignedWorkers: assignedWorkers(this.buildings),
      totalJobs: totalJobs(this.buildings),
      messages: [...this.messages],
      lastTickWagesUnpaid: this.lastWagesUnpaid > 0,
    };
  }

  /** Read-only per-tile simulation state (CORE-03). Returns a shallow copy so no
   *  live reference escapes src/sim/ — mutating the result cannot affect the sim.
   *  Grid-derived fields reflect the authoritative terrain grid: a tile reads
   *  `road: true` exactly when its terrain is a road (placed via placeBuilding,
   *  reset to earth on demolish). */
  getTileState(x: number, y: number): TileState {
    const s = this.map.tileState(x, y);
    return { ...s, road: this.map.get(x, y) === 'road', roadType: this.map.roadTypeAt(x, y) };
  }

  /** Inputs used to derive a house's happiness for the snapshot. */
  /**
   * Ratings — culture, prosperity, stability, and favor derived from city state.
   * Read-only additive accessor.
   */
  getRatings(): Ratings {
    return this.getState().ratings;
  }
  getTreasury(): number {
    return this.getState().treasury;
  }

  /** Categorized year-to-date ledger (additive accessor). */
  getTreasuryLedger(): FinanceLedger {
    return { revenue: { ...this.treasuryAccount.revenue }, expenses: { ...this.treasuryAccount.expenses } };
  }

  getDebt(): number {
    return this.treasuryAccount.debt;
  }

  getSubsidyUsedThisYear(): number {
    return this.treasuryAccount.subsidyUsedThisYear;
  }

  /** Favor penalty from the last annual loan interest accrual. */
  getLoanFavorPenalty(): number {
    return this.loanFavorPenalty;
  }

  /** Finance advisor view — a pure projection of live treasury state. */
  getFinanceAdvisor(): FinanceAdvisorView {
    return financeAdvisorFromState(
      {
        balance: this.treasuryAccount.balance,
        revenue: { ...this.treasuryAccount.revenue },
        expenses: { ...this.treasuryAccount.expenses },
        debt: this.treasuryAccount.debt,
        outstandingInterest: this.treasuryAccount.outstandingInterest,
        subsidyUsedThisYear: this.treasuryAccount.subsidyUsedThisYear,
      },
      this.unpaidStreakTicks,
      { ...this.policy },
    );
  }

  /** Request the bounded annual royal subsidy (once per year, command-replayable). */
  requestRoyalSubsidy(): { ok: boolean; grant: number } {
    if (this.paused) {
      this.enqueue({ kind: 'requestRoyalSubsidy' });
      return { ok: true, grant: 0 };
    }
    const grant = this.treasuryAccount.requestSubsidy(CONFIG.royalSubsidyCap);
    this.commandLog.push({ tick: this.tickCount, command: 'requestRoyalSubsidy', result: 'ok' });
    this.saveCommands.push({ kind: 'requestRoyalSubsidy' });
    return { ok: true, grant };
  }

  /** Take a loan of up to CONFIG.loanMaxAmount denarii (command-replayable). */
  takeLoan(amount: number): { ok: boolean; received: number; error?: string } {
    if (this.paused) {
      this.enqueue({ kind: 'takeLoan', amount });
      return { ok: true, received: 0 };
    }
    if (amount <= 0) return { ok: false, received: 0, error: 'amount must be positive' };
    if (amount > CONFIG.loanMaxAmount) {
      return { ok: false, received: 0, error: `loan exceeds the ${CONFIG.loanMaxAmount} denarii limit` };
    }
    const received = this.treasuryAccount.takeLoan(amount, CONFIG.loanInterestRate);
    this.commandLog.push({ tick: this.tickCount, command: `takeLoan ${amount}`, result: 'ok' });
    this.saveCommands.push({ kind: 'takeLoan', amount });
    return { ok: true, received };
  }

  /** Repay part of the outstanding debt (command-replayable). */
  repayLoan(amount: number): { ok: boolean; repaid: number } {
    if (this.paused) {
      this.enqueue({ kind: 'repayLoan', amount });
      return { ok: true, repaid: 0 };
    }
    if (amount <= 0) return { ok: true, repaid: 0 };
    const repaid = this.treasuryAccount.repayLoan(amount);
    this.commandLog.push({ tick: this.tickCount, command: `repayLoan ${amount}`, result: 'ok' });
    this.saveCommands.push({ kind: 'repayLoan', amount });
    return { ok: true, repaid };
  }

  /** Total residents across all houses. */
  getPopulation(): number {
    return this.getState().ratings.population;
  }

  getEmployment(): { employed: number; unemployed: number; totalJobs: number } {
    const state = this.getState();
    return {
      employed: state.assignedWorkers,
      unemployed: Math.max(0, state.ratings.population - state.assignedWorkers),
      totalJobs: state.totalJobs,
    };
  }

  getEvents(): EventRecord[] {
    return [...this.eventLog];
  }

  startMission(id: string): void {
    this.mission = { id, started: true, complete: false, failed: false, year: 0, objective: id };
  }
  getMission(): MissionState | null {
    return this.mission;
  }

  enableTrade(cityId: string, enabled: boolean): void {
    if (!this.tradeRoutes[cityId]) {
      this.tradeRoutes[cityId] = { cityId, enabled: false, imports: {}, exports: {} };
    }
    this.tradeRoutes[cityId].enabled = enabled;
  }
  getTradeRoutes(): Record<string, TradeRoute> {
    return this.tradeRoutes;
  }

  private mission: MissionState | null = null;
  private missionRatings = { culture: 10, prosperity: 10, stability: 10, favor: 10 };
  private tradeRoutes: Record<string, TradeRoute> = {};
  private activeEvent: { id: string; remaining: number; total: number } | null = null;
  private houseHappinessInput(b: BuildingInstance) {
    const services = {
      food: b.house!.foodCooldown > 0,
      water: b.house!.waterCooldown > 0,
      labor: b.house!.laborCooldown > 0,
    };
    return {
      hasFood: services.food,
      hasWater: services.water,
      hasLabor: services.labor,
      desirability: desirabilityOf(this.map, b.x, b.y, this.policy, this.lastWagesUnpaid > 0, services, this.arrearsDepth()),
      wagesUnpaid: this.lastWagesUnpaid > 0,
    };
  }

  /** Consecutive-unpaid-wage arrears steps (0 = none). */
  private arrearsDepth(): number {
    return Math.floor(this.unpaidStreakTicks / CONFIG.desirabilityArrearsDepthPeriodTicks);
  }

  /** Stable JSON rendering of the snapshot (used by determinism and golden tests). */
  getStateJson(): string {
    return JSON.stringify(this.getState());
  }

  /** Configure a market's behavior per-building (MARK-02, decision 4). Additive
   *  and inert: storing a config changes no runner behavior until the walkers
   *  read it through the SimInternals.marketConfig hook. */
  setMarketConfig(buildingId: number, cfg: MarketConfig): void {
    this.marketConfigs.set(buildingId, cfg);
  }

  /** The configured per-market config, or the default when unset. */
  marketConfig(buildingId: number): MarketConfig {
    return this.marketConfigs.get(buildingId) ?? defaultMarketConfig();
  }

  /** Whether a market has an explicitly-stored per-market config. */
  hasMarketConfig(buildingId: number): boolean {
    return this.marketConfigs.has(buildingId);
  }

  /** The live walker-internals seam the runner itself uses for updateWalker —
   *  read-only exposure so integration tests can drive buyer/seller walkers
   *  against real runner state and assert via getState(). Additive; no
   *  existing behavior changes. */
  getWalkerInternals(): SimInternals {
    return this.simInternals();
  }

  /** Every accepted and rejected command since construction, in order. */
  getCommandLog(): CommandLogEntry[] {
    return [...this.commandLog];
  }

  /** Serializable payload that captures this sim for deterministic resume.
   *  Commands still queued while paused are included so nothing is dropped on
   *  save → reload. */
  getSaveData(): SaveData {
    const data: SaveData = {
      version: 1,
      seed: this.seed,
      mapSize: this.mapSize,
      commands: [...this.saveCommands],
      tickCount: this.tickCount,
      savedAt: Date.now(),
    };
    if (this.pendingCommands.length > 0) {
      data.pendingCommands = this.pendingCommands.map((c) => ({ ...c }));
    }
    data.paused = this.paused;
    return data;
  }

  /**
   * Reconstruct a sim from a save by replaying its command sequence, then
   * ticking to the saved tick count. Because the sim is deterministic, the
   * resulting state equals the original run at save time. Commands that were
   * still pending at save time (the sim was paused) are re-enqueued so the
   * queue survives the round-trip.
   */
  static fromSaveData(save: SaveData): SimRunner {
    // Reconstruct through the no-map path so map generation and the sim body
    // share the same RNG stream, exactly as the original run did.
    const runner = new SimRunner(save.seed, undefined, save.mapSize);
    for (const c of save.commands) applyCommand(runner, c);
    while (runner.tickCount < save.tickCount) runner.tick();
    // Re-queue commands that were deferred (paused) at save time, preserving
    // order, and restore the paused state so the next resume tick drains them
    // exactly as the original run did.
    if (save.pendingCommands && save.pendingCommands.length > 0) {
      for (const c of save.pendingCommands) runner.enqueue({ ...c });
    }
    runner.paused = save.paused ?? false;
    return runner;
  }

  // Tick steps -----------------------------------------------------------------

  /** Spawn walkers from staffed markets, wells, and from every house. */
  private tickSpawns(): void {
    for (const b of this.buildings) {
      let interval: number;
      if (b.type === 'house') interval = CONFIG.laborSpawnEveryTicks;
      else interval = BUILDINGS[b.type].spawnEveryTicks ?? 0;
      if (interval <= 0) continue;
      if (b.type !== 'house' && !b.active) continue;

      b.spawnCooldown -= 1;
      if (b.spawnCooldown > 0) continue;
      b.spawnCooldown = interval;

      const walkerType: WalkerType =
        b.type === 'house' ? 'labor' :
        b.type === 'market' ? 'market' :
        (b.type === 'well' || b.type === 'fountain') ? 'well' :
        // Safety buildings spawn their catalog walkers (fireman/engineer/
        // marshal); every other building keeps the legacy building-named
        // walker type so serialized walker state stays byte-identical.
        (b.type === 'fire_station' || b.type === 'engineer_post' || b.type === 'prefecture')
          ? (walkerIdForBuilding(b.type) ?? (b.type as WalkerType))
          : (b.type as WalkerType);
      // Spawn only onto a road the walker may actually traverse: a 'stop' walker
      // (labor, well, most service walkers) must never spawn onto a
      // service_roadblock it cannot cross — that would trap it at 0 speed
      // (WR-02). 'pass' walkers (market) may still spawn onto a block.
      const spawnProfile = walkerProfile(walkerType);
      const start = this.adjacentRoadTile(b, (x, y) =>
        this.map.get(x, y) === 'road' && mayTraverse(spawnProfile, this.map.roadTypeAt(x, y) ?? 'dirt'),
      );
      if (!start) continue;

      const w = createWalker(walkerType, start.x, start.y, this.nextWalkerId++);
      this.walkers.push(w);
      if ((b.type === 'temple' || b.type === 'grand_temple') && b.god) w.god = b.god;
      if (b.type === 'house' && b.house) b.house.laborCooldown = CONFIG.serviceCooldownTicks;
    }
  }

  /**
   * Assign workers from the reachable pool to labor-connected buildings.
   * Labor connectivity is durable once a labor walker reaches a building (it
   * must be re-established only if the road network is severed, which the sim
   * never does) — so a connected building keeps drawing workers each tick,
   * limited only by the pool and its requirement.
   */
  private tickLabor(): void {
    let pool = workerPool(this.buildings);
    for (const b of this.buildings) {
      if (b.workersRequired <= 0) continue;
      if (!b.laborConnected) {
        b.workersAssigned = 0;
        this.setActive(b, false);
        continue;
      }
      const want = b.workersRequired;
      const give = Math.min(want, pool);
      pool -= give;
      b.workersAssigned = give;
      this.setActive(b, give >= want);
    }
  }

  /** Farm production, then cart transfer from farms to touching granaries. */
  private tickFood(): void {
    for (const b of this.buildings) {
      if (b.type !== 'farm' && b.type !== 'orchard') continue;
      if (!b.active) continue;
      const def = BUILDINGS[b.type];
      if (!def.production) continue;
      const stock = b.stock.wheat ?? 0;
      if (stock < def.production.localCapacity) {
        b.stock.wheat = Math.min(def.production.localCapacity, stock + def.production.perTick);
      }
    }

    for (const farm of this.buildings) {
      if (farm.type !== 'farm' && farm.type !== 'orchard') continue;
      const stock = farm.stock.wheat ?? 0;
      if (stock <= 0) continue;
      // Prefer an adjacent granary, then a road-reachable one.
      let granary = this.findTouchingGranary(farm);
      if (!granary) granary = this.findReachableGranary(farm);
      if (!granary) continue;
      const free = CONFIG.granaryCapacity - (granary.stock.wheat ?? 0);
      if (free <= 0) continue;
      const transfer = Math.min(CONFIG.cartTransferPerTick, stock, free);
      farm.stock.wheat = stock - transfer;
      granary.stock.wheat = (granary.stock.wheat ?? 0) + transfer;
    }

    this.lowFoodWarnCooldown = Math.max(0, this.lowFoodWarnCooldown - 1);
    let hasHouse = false;
    let granaryWheat = 0;
    for (const b of this.buildings) {
      if (b.house) hasHouse = true;
      else if (b.type === 'granary') granaryWheat += b.stock.wheat ?? 0;
    }
    if (hasHouse && granaryWheat === 0 && this.lowFoodWarnCooldown === 0) {
      this.emitMessage('warning', 'Food supply is low — build farms and granaries');
      this.lowFoodWarnCooldown = CONFIG.lowFoodWarnCooldownTicks;
    }
  }

  /** Year rollover: reset the ledger + subsidy guard, then accrue loan interest. */
  private tickFinanceRollover(): void {
    const year = Math.floor(this.tickCount / 360);
    if (year === this.financeYear) return;
    this.financeYear = year;
    rollYear(this.treasuryAccount);
    this.loanFavorPenalty = this.treasuryAccount.accrue(CONFIG.loanInterestRate).favorPenalty;
  }

  /** Anti-hoarding cap: drop the balance above CONFIG.treasuryOverflowLimit. */
  private tickFinanceCap(): void {
    const limit = CONFIG.treasuryOverflowLimit;
    if (this.treasuryAccount.balance <= limit) return;
    this.treasuryAccount.addExpense('overflow', this.treasuryAccount.balance - limit);
  }

  /** Collect taxes, pay wages (treasury never goes below zero). */
  private tickEconomyInternal(): void {
    const { treasury, result } = tickEconomy(this.buildings, this.policy, this.treasuryAccount.balance);
    // Ledger taxes and the wages actually paid; the balance assignment keeps the
    // pre-swap arithmetic byte-for-byte (taxes do not extend wage payment).
    this.treasuryAccount.addRevenue('taxes', result.taxIncome);
    this.treasuryAccount.addExpense('wages', result.wagesDue - result.wagesUnpaid);
    this.treasuryAccount.balance = treasury;
    this.lastWagesUnpaid = result.wagesUnpaid;
    this.unpaidStreakTicks = result.wagesUnpaid > 0 ? this.unpaidStreakTicks + 1 : 0;
  }

  /**
   * Extraction + workshop stepping and porter dispatch (Phase 6, PROD-01/02).
   * Deposit-gated extraction, farm raw production, workshop input consumption /
   * output production, then feedstock porters (raw stock → workshop inputs or
   * warehouse) and output porters (workshop output → warehouse). Deterministic:
   * iterates buildings in placement order and uses no Math.random or clock.
   */
  private tickProduction(): void {
    // (a)+(b) extraction sites (deposit-gated) and raw olive/grape farms.
    for (const b of this.buildings) {
      const kind = EXTRACTION_BUILDING_TYPES[b.type];
      const farm = RAW_OLIVE_GRAPE[b.type];
      if (!kind && !farm) continue;
      b.production ??= { inputs: {}, output: {}, active: b.active, blocked: false };
      b.production.blocked = false;
      if (!b.active) {
        b.production.blocked = true;
        b.lastProduced = 0;
        continue;
      }
      if (kind) {
        const site = EXTRACTION_SITES[kind];
        // WR-01: the deposit gate is evaluated over the WHOLE footprint, not
        // just the anchor tile — an extraction site extracts only when every
        // footprint tile satisfies its deposit (2x2 for clay/iron/timber, 3x3
        // for marble). This matches the stricter "full footprint over the
        // deposit" convention (same as buildings whose `requiredTerrain` must
        // cover the entire footprint): a site whose footprint only partially
        // sits on the deposit is blocked and produces nothing.
        const n = b.footprint;
        let onDeposit = true;
        for (let dy = 0; dy < n && onDeposit; dy++) {
          for (let dx = 0; dx < n; dx++) {
            const terrain = String(this.map.get(b.x + dx, b.y + dy));
            const resourceType = this.map.tileState(b.x + dx, b.y + dy).resourceType;
            if (!satisfiesDeposit(site, terrain, resourceType)) {
              onDeposit = false;
              break;
            }
          }
        }
        if (onDeposit) {
          // IN-01: report the actually-applied delta, not the nominal rate, so
          // a capacity-clamped tick (stock already at EXTRACTION_OUTPUT_CAPACITY)
          // reads producedLastTick = 0 instead of overstating production.
          const before = b.stock[site.produces as Good] ?? 0;
          b.stock[site.produces as Good] = Math.min(EXTRACTION_OUTPUT_CAPACITY, before + site.outputPerTick);
          b.lastProduced = (b.stock[site.produces as Good] as number) - before;
        } else {
          b.production.blocked = true;
          b.lastProduced = 0;
        }
      } else {
        // IN-01: same actual-delta reporting for raw olive/grape farms.
        const before = b.stock[farm!.produces] ?? 0;
        b.stock[farm!.produces] = Math.min(EXTRACTION_OUTPUT_CAPACITY, before + farm!.perTick);
        b.lastProduced = (b.stock[farm!.produces] as number) - before;
      }
    }

    // (c) workshops — labor gate via active, consume inputs, produce output.
    for (const b of this.buildings) {
      const wkind = WORKSHOP_BUILDING_TYPES[b.type];
      if (!wkind) continue;
      const def = WORKSHOPS[wkind];
      b.production ??= emptyProduction(def);
      b.production.active = b.active;
      b.lastProduced = tickWorkshop(def, b.production).produced;
    }

    // (d) feedstock porters — raw producer stock → needy workshop inputs or warehouse.
    for (const b of this.buildings) {
      const commodity = this.producedCommodity(b);
      if (!commodity) continue;
      if (((b.stock as Record<string, number | undefined>)[commodity] ?? 0) <= 0) continue;
      const wDests = this.feedstockWorkshops(commodity, b);
      const whDests = this.warehouseCandidates(commodity, b);
      const chosen = porterDestination(commodity, wDests, whDests);
      if (!chosen) continue;
      if (chosen.kind === 'workshop') {
        const ws = this.buildingById.get(Number(chosen.id));
        if (!ws?.production) continue;
        const moved = this.moveStock(commodity, b.stock as Record<string, number>, {
          stock: ws.production.inputs, capacity: WORKSHOP_INPUT_CAPACITY,
        });
        b.lastDestinationId = moved > 0 ? chosen.id : null;
        b.lastDestinationKind = moved > 0 ? 'workshop' : null;
      } else {
        const wh = this.buildingById.get(Number(chosen.id));
        if (!wh) continue;
        const moved = this.moveStock(commodity, b.stock as Record<string, number>, {
          stock: wh.stock as Record<string, number>, capacity: WAREHOUSE_CAPACITY,
        });
        b.lastDestinationId = moved > 0 ? chosen.id : null;
        b.lastDestinationKind = moved > 0 ? 'warehouse' : null;
      }
    }

    // (e) output porters — workshop output → needy workshop input or nearest warehouse.
    // IN-03: candidates are built via feedstockWorkshops (accepts-aware, so a
    // workshop that requests this good as an input wins per §16.4) with the
    // warehouse fallback — previously the workshop branch was never reachable
    // for finished goods because the porter passed an empty workshop list.
    for (const b of this.buildings) {
      const wkind = WORKSHOP_BUILDING_TYPES[b.type];
      if (!wkind) continue;
      const def = WORKSHOPS[wkind];
      const state = b.production;
      if (!state) continue;
      const out = state.output[def.produces] ?? 0;
      if (out <= 0) {
        b.lastDestinationId = null;
        b.lastDestinationKind = null;
        continue;
      }
      const wDests = this.feedstockWorkshops(def.produces, b);
      const whDests = this.warehouseCandidates(def.produces, b);
      const chosen = porterDestination(def.produces, wDests, whDests);
      if (!chosen) {
        state.blocked = true;
        b.lastDestinationId = null;
        b.lastDestinationKind = null;
        continue;
      }
      if (chosen.kind === 'workshop') {
        const ws = this.buildingById.get(Number(chosen.id));
        if (!ws?.production) {
          state.blocked = true;
          b.lastDestinationId = null;
          b.lastDestinationKind = null;
          continue;
        }
        const moved = porterDeliversTo(def, state, {
          stock: ws.production.inputs, capacity: WORKSHOP_INPUT_CAPACITY,
        });
        state.blocked = moved === 0;
        b.lastDestinationId = moved > 0 ? chosen.id : null;
        b.lastDestinationKind = moved > 0 ? 'workshop' : null;
      } else {
        const wh = this.buildingById.get(Number(chosen.id));
        if (!wh) {
          state.blocked = true;
          b.lastDestinationId = null;
          b.lastDestinationKind = null;
          continue;
        }
        const moved = porterDeliversTo(def, state, { stock: wh.stock as Record<string, number>, capacity: WAREHOUSE_CAPACITY });
        state.blocked = moved === 0;
        b.lastDestinationId = moved > 0 ? chosen.id : null;
        b.lastDestinationKind = moved > 0 ? 'warehouse' : null;
      }
    }
  }

  /** Producer's primary commodity from this building, if it is a raw/extraction producer. */
  private producedCommodity(b: BuildingInstance): string | null {
    const kind = EXTRACTION_BUILDING_TYPES[b.type];
    if (kind) return EXTRACTION_SITES[kind].produces;
    const farm = RAW_OLIVE_GRAPE[b.type];
    if (farm) return farm.produces;
    return null;
  }

  /** Workshop feedstock destinations that are missing `commodity` and have input room. */
  private feedstockWorkshops(commodity: string, from: BuildingInstance): LoadDestination[] {
    const dests: LoadDestination[] = [];
    for (const b of this.buildings) {
      const wkind = WORKSHOP_BUILDING_TYPES[b.type];
      if (!wkind || !b.production) continue;
      const def = WORKSHOPS[wkind];
      if (!b.production.active) continue;
      // missing_input for this commodity and input room (per-input slot cap)
      if ((b.production.inputs[commodity] ?? 0) > 0) continue;
      let used = 0;
      for (const v of Object.values(b.production.inputs)) used += v;
      if (used >= WORKSHOP_INPUT_CAPACITY) continue;
      dests.push({
        id: String(b.id),
        kind: 'workshop',
        accepts: (c: string) => def.inputs.includes(c),
        capacity: WORKSHOP_INPUT_CAPACITY - used,
        distance: manhattan(b.x, b.y, from.x, from.y),
        need: Math.max(1, WORKSHOP_INPUT_CAPACITY - used),
      });
    }
    return dests;
  }

  /** Warehouse destinations that accept `commodity`, have remaining room, and
   *  are reachable from the producer over the road network (decision 2 — a load
   *  moves by road, never teleported). All existing gates (type, capacity,
   *  per-commodity slot limit, warehouseAccepts) are preserved; the road path
   *  is added before pushing a candidate, mirroring findReachableGranary, and
   *  `distance` ranks by road-distance (path length). */
  private warehouseCandidates(commodity: string, from: BuildingInstance): LoadDestination[] {
    const dests: LoadDestination[] = [];
    const srcRoad = this.adjacentRoadTile(from);
    if (!srcRoad) return dests;
    for (const b of this.buildings) {
      if (b.type !== 'warehouse') continue;
      const usedUnits = this.usedUnits(b.stock);
      const room = WAREHOUSE_CAPACITY - usedUnits;
      if (room <= 0) continue;
      const usedSlots = Object.keys(b.stock).filter((k) => ((b.stock as Record<string, number | undefined>)[k] ?? 0) > 0).length;
      if (usedSlots >= PRODUCTION_WAREHOUSE_SLOTS) continue;
      if (!warehouseAccepts(defaultWarehousePolicy(), commodity, usedSlots)) continue;
      const wRoad = this.adjacentRoadTile(b);
      if (!wRoad) continue;
      const path = findRoadPath(this.map, srcRoad, wRoad);
      if (!path) continue;
      dests.push({
        id: String(b.id),
        kind: 'warehouse',
        accepts: () => true,
        capacity: room,
        distance: path.length,
        need: 0,
      });
    }
    return dests;
  }

  /** Total units currently stored in a building stock. */
  private usedUnits(stock: Partial<Record<Good, number>>): number {
    let t = 0;
    for (const v of Object.values(stock ?? {})) t += typeof v === 'number' ? v : 0;
    return t;
  }

  /** Move one whole unit of `commodity` from `source` stock into `dest` stock
   *  (load = 1 unit). Conserves units exactly (source falls by 1, dest rises by
   *  1); never moves below zero and never moves a fractional unit, so a
   *  workshop that consumes whole inputs can never see a negative input.
   *  Returns the moved amount (0 when the source lacks a full unit or dest is
   *  full). */
  private moveStock(
    commodity: string,
    source: Record<string, number>,
    dest: { stock: Record<string, number>; capacity: number },
  ): number {
    const have = source[commodity] ?? 0;
    if (have < 1) return 0;
    let used = 0;
    for (const v of Object.values(dest.stock)) used += v;
    const room = Math.max(0, dest.capacity - used);
    if (room < 1) return 0;
    source[commodity] = have - 1;
    dest.stock[commodity] = (dest.stock[commodity] ?? 0) + 1;
    return 1;
  }

  // Helpers --------------------------------------------------------------------

  private setActive(b: BuildingInstance, active: boolean): void {
    if (b.active === active) return;
    b.active = active;
    const name = BUILDINGS[b.type].name;
    if (active) this.emitMessage('building-active', `${name} staffed and operational`);
    else this.emitMessage('building-inactive', `${name} needs workers`);
  }

  private findTouchingGranary(b: BuildingInstance): BuildingInstance | null {
    for (const other of this.buildings) {
      if (other.type !== 'granary') continue;
      if ((other.stock.wheat ?? 0) >= CONFIG.granaryCapacity) continue;
      if (footprintsTouch(b, other)) return other;
    }
    return null;
  }

  /** Find a granary reachable from the farm over the road network. */
  private findReachableGranary(farm: BuildingInstance): BuildingInstance | null {
    const road = this.adjacentRoadTile(farm);
    if (!road) return null;
    let best: BuildingInstance | null = null;
    let bestDist = Infinity;
    for (const granary of this.buildings) {
      if (granary.type !== 'granary') continue;
      if ((granary.stock.wheat ?? 0) >= CONFIG.granaryCapacity) continue;
      const gRoad = this.adjacentRoadTile(granary);
      if (!gRoad) continue;
      const path = findRoadPath(this.map, road, gRoad);
      if (!path) continue;
      const dist = path.length;
      if (dist < bestDist) {
        bestDist = dist;
        best = granary;
      }
    }
    return best;
  }

  /** Nearest road tile adjacent to a building footprint that satisfies the
   *  optional suitability predicate (default: any road tile), or null. */
  private adjacentRoadTile(b: BuildingInstance, isSuitable?: (x: number, y: number) => boolean): Vec2 | null {
    const n = b.footprint;
    const suitable = (x: number, y: number): boolean =>
      isSuitable ? isSuitable(x, y) : this.map.get(x, y) === 'road';
    for (let i = 0; i < n; i++) {
      if (suitable(b.x + i, b.y - 1)) return { x: b.x + i, y: b.y - 1 };
      if (suitable(b.x + i, b.y + n)) return { x: b.x + i, y: b.y + n };
      if (suitable(b.x - 1, b.y + i)) return { x: b.x - 1, y: b.y + i };
      if (suitable(b.x + n, b.y + i)) return { x: b.x + n, y: b.y + i };
    }
    return null;
  }

  private buildingAt(x: number, y: number): BuildingInstance | null {
    const id = this.occupiedTiles.get(this.tileKey(x, y));
    if (id === undefined) return null;
    return this.buildingById.get(id) ?? null;
  }

  private despawnWalker(w: WalkerInstance): void {
    this.walkers = this.walkers.filter((x) => x.id !== w.id);
  }

  private simInternals() {
    return {
      map: this.map,
      rng: this.rng,
      buildings: this.buildings,
      buildingById: (id: number) => this.buildingById.get(id) ?? null,
      buildingAt: (x: number, y: number) => this.buildingAt(x, y),
      adjacentRoadTile: (b: BuildingInstance) => this.adjacentRoadTile(b),
      despawn: (w: WalkerInstance) => this.despawnWalker(w),
      tick: this.tickCount,
      walkers: this.walkers,
      marketConfig: (id: number) => this.marketConfigs.get(id),
      // TRAD-03 additive hooks: regional entry resolver + storage acceptance.
      tradeEntry: () => this.tradeEntryTile(),
      tradeStorageRoom: (good: string, id: number) => {
        const b = this.buildingById.get(id);
        if (!b) return 0;
        return this.storageRoom(b, good);
      },
      // Civil-safety hooks (Phase 11): walkers trigger state mutation.
      extinguishFire: (id: number) => {
        const b = this.buildingById.get(id);
        if (b?.safety && b.safety.fire !== 'destroyed') {
          b.safety.fire = 'none';
          b.safety.dousedTicks = 10;
        }
      },
      repairBuilding: (id: number) => {
        const b = this.buildingById.get(id);
        if (!b?.safety) return;
        b.safety.danger = false;
        b.safety.collapseRisk = 0;
        if (b.safety.fire === 'destroyed') b.safety.fire = 'none';
      },      patrolCrime: (id: number) => {
        const b = this.buildingById.get(id);
        if (b?.safety) b.safety.crime = Math.max(0, b.safety.crime - 0.3);
      },
    };
  }

  private emitMessage(type: MessageType, text: string): void {
    this.messages.push({ tick: this.tickCount, type, text });
    if (this.messages.length > CONFIG.messageLogCapacity) {
      this.messages.splice(0, this.messages.length - CONFIG.messageLogCapacity);
    }
  }

  private logEvent(type: string, text: string, severity: 'mild' | 'serious' | 'disaster'): void {
    this.eventLog.push({ tick: this.tickCount, type, text, severity });
    if (this.eventLog.length > CONFIG.messageLogCapacity) {
      this.eventLog.splice(0, this.eventLog.length - CONFIG.messageLogCapacity);
    }
  }

  private toBuildingState(b: BuildingInstance): BuildingState {
      const house = b.house
        ? (() => {
            const input = this.houseHappinessInput(b);
            const h: NonNullable<BuildingState['house']> = {
              tier: b.house!.tier,
              tierName: HOUSE_TIERS[b.house!.tier].name,
              populationCapacity: HOUSE_TIERS[b.house!.tier].population,
              foodCooldown: b.house!.foodCooldown,
              waterCooldown: b.house!.waterCooldown,
              laborCooldown: b.house!.laborCooldown,
              services: b.house!.services ? { ...b.house!.services } : undefined,
              desirability: input.desirability,
              happiness: houseHappiness(input),
            };
            if (b.house!.foodInventory) h.foodInventory = { ...b.house!.foodInventory };
            if (b.house!.godAccess && Object.keys(b.house!.godAccess).length > 0) {
              h.godAccess = { ...b.house!.godAccess };
            }
            return h;
          })()
        : undefined;
    return {
      id: b.id,
      type: b.type,
      x: b.x,
      y: b.y,
      footprint: b.footprint,
      workersAssigned: b.workersAssigned,
      workersRequired: b.workersRequired,
      active: b.active,
      laborConnected: b.laborConnected,
      stock: { ...b.stock },
      ...(b.god !== undefined ? { god: b.god } : {}),
      house,
    };
  }

  private toWalkerState(w: WalkerInstance): WalkerState {
    return {
      id: w.id,
      type: w.type,
      x: w.x,
      y: w.y,
      next: w.next ? { ...w.next } : null,
      progress: w.progress,
      state: w.state,
      lifetime: w.lifetime,
      targetBuildingId: w.targetBuildingId,
      carryingGood: w.carryingGood,
      ...(w.god !== undefined ? { god: w.god } : {}),
    };
  }

  private tileKey(x: number, y: number): number {
    // 20 bits each — ample for maps up to 1024x1024 (same scheme as pathfind).
    return (x << 20) | y;
  }
}

/** Apply a replayable save command to a runner. Exhaustive dispatch: adding a
 *  new SaveCommand kind fails typecheck here instead of silently routing to an
 *  unrelated branch. */
function applyCommand(runner: SimRunner, cmd: SaveCommand): void {
  if (cmd.kind === 'place') {
    runner.placeBuilding(cmd.type, cmd.x, cmd.y);
  } else if (cmd.kind === 'setPolicy') {
    runner.setPolicy(cmd.taxRate, cmd.wageRate);
  } else if (cmd.kind === 'demolish') {
    runner.demolish(cmd.x, cmd.y);
  } else if (cmd.kind === 'requestRoyalSubsidy') {
    runner.requestRoyalSubsidy();
  } else if (cmd.kind === 'takeLoan') {
    runner.takeLoan(cmd.amount);
  } else if (cmd.kind === 'repayLoan') {
    runner.repayLoan(cmd.amount);
  } else {
    const exhaustive: never = cmd;
    throw new Error(`unknown command kind: ${(exhaustive as { kind: string }).kind}`);
  }
}

function footprintsTouch(a: BuildingInstance, b: BuildingInstance): boolean {
  const ax2 = a.x + a.footprint - 1;
  const ay2 = a.y + a.footprint - 1;
  const bx2 = b.x + b.footprint - 1;
  const by2 = b.y + b.footprint - 1;
  if (a.x > bx2 + 1 || b.x > ax2 + 1) return false;
  if (a.y > by2 + 1 || b.y > ay2 + 1) return false;
  // Reject actual overlap (placement should prevent it).
  return !(a.x <= bx2 && b.x <= ax2 && a.y <= by2 && b.y <= ay2);
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
