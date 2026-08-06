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

import { pickEvent, applyEvent, eventDuration, eventSustainMsg, eventFinalMsg, resolveResponse } from './events';
import { EVENTS } from '../../data/events';
import { WALKERS } from '../../data/walkers';
import { BUILDINGS } from './buildings';
import { CONFIG, HOUSE_TIERS } from './config';
import { validateCatalogs, throwCatalogIssues } from '../../data/validate';
import { assignedWorkers, computeRatings, tickEconomy, totalJobs, workerPool } from './economy';
import { cityHappiness, houseHappiness } from './happiness';
import { computeTargets, decomposeRatings, clampRating } from './ratings';
import type { CityStats, RatingDecomposition } from './ratings';
import { createGovernor, donate, payGovernor, GOVERNOR_SALARY_LEVELS } from './governor';
import type { GovernorState } from './governor';
import { tickTrade } from './trade';
import {
  resolveTradeOrder, tradeExportGate, importGatedBy, quotaRemaining,
  quotaSuspended, consumeQuota, resetAnnualQuotas, createTradePriceState,
  sampleTradePrice, priceTrend, effectivePrice, applyPriceEvent,
  type TradePriceState, type TradeOrderMode,
} from './trade';
import { COMMODITIES } from '../../data/commodities';
import { TRADE_CITIES, type TradeCityDef } from '../../data/trade';
import { CARAVAN_CAPACITY, SHIP_CAPACITY } from './transport';
import { MISSIONS, EXTRA_MISSIONS } from '../../data/missions';
import { campaignMissions } from './missions';
import { computeServiceCoverage, GODS, computeFavor, FESTIVAL_TIERS, startFestival, tickFestival } from './services';
import type { FestivalPlan, FestivalTier } from './services';
import { TEMPLE_COVERAGE_FACTOR, GRAND_TEMPLE_COVERAGE_FACTOR, FESTIVAL_BOOST_WINDOW_TICKS, MONTH_TICKS } from '../../data/religion';
import { computeRisks, tickFire } from './safety';
import { taxCollected } from './taxation';
import { unlockedGov, GOV_BUILDINGS, govThreshold } from './governance';
import { pickRequest, entryById } from '../../data/requests';
import type { RequestDef } from '../../data/requests';
import { ObjectiveTracker } from './objectives';
import { WaterSystem } from './water';
import type { WaterSource, WaterSourceKind } from './water';
import { buildCodex, lookupEntry, TUTORIAL_ELIGIBILITY, TUTORIAL_STEP_ORDER, tutorialText, TUTORIAL_EXPANDED, TUTORIAL_CODEX_REF, nextTutorialCurrent } from './campaign';
import type { CodexEntry, CodexKind, HouseView, CityView, TutorialStepId, TutorialPrompt, TutorialView } from './campaign';
import { desirabilityOf, tickHousing } from './housing';
import { housingLevelName } from '../../data/housing';
import { effectivePopulation, effectiveWorkers, deriveSatisfied } from './housingLive';
import { ageOnMonth, netMigration, residentsForHouse, wageBand, unemploymentBand, IMPERIAL_WAGE_REFERENCE } from './population';
import { buildLaborSectors, applySectorAssignments, SECTOR_IDS } from './labor';
import { foodShortageEffects } from './housing';
import { findMergePartner, mergeProposal, targetFootprint } from './housingMerge';
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
  ActiveRequest,
  RequestHistoryEntry,
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
import { civilizationOverlayData, waterOverlayData } from './advisors';

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
/** POP-02 ([ASSUMED A5]) — months of starvation (foodCooldown <= 0 at month
 *  cadence) before a house's foodShortageEffects emigration path drains
 *  residents; and the max residents famished out per month per house. Module-
 *  local (balance-parity — never a BALANCE/CONFIG key). */
const FAMINE_EMIGRATION_MONTHS = 3;
const FAMINE_EMIGRANTS_PER_MONTH = 2;
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
  /** RATE-01: per-factor decomposition of the four ratings (one computation
   *  with the ratings above — never a second recompute). */
  decomposition: RatingDecomposition;
  /** RATE-01/D-02: lifetime construction spend (build + route-open costs),
   *  separated from the Prosperity operating-balance factor. */
  constructionSpend: number;
  /** RATE-02/D-03: trailing-360-tick window of exported loads (deterministic). */
  annualExports: number;
  /** POP-01: total residents across all houses (== population by construction —
   *  Σ effectivePopulation over houses). Golden-safe: getStateJson serializes
   *  getState, never this snapshot. */
  residentCount: number;
  /** POP-01: live per-class resident breakdown from HouseInstance internals
   *  (0/0 row when no residency initialized yet — total function). */
  residentsByClass?: { plebeian: number; patrician: number };
  /** POP-02: the closing migration month's internal deltas (0 by default —
   *  total function, empty cities safe). Golden-safe: getStateJson serializes
   *  getState, never this snapshot. */
  immigration?: number;
  emigration?: number;
  homeless?: number;
  /** POP-04: urban wage policy vs the module-local imperial reference
   *  (IMPERIAL_WAGE_REFERENCE) — a pure projection of this.policy.wageRate
   *  (total function; see population.ts wageBand). Golden-safe: getStateJson
   *  serializes getState, never this snapshot. */
  wageBand: { band: 'below' | 'at' | 'above'; relative: number };
  /** POP-04: the derived unemployment rate bucketed into labelled tiers
   *  (population.ts unemploymentBand) — a pure projection of the already
   *  computed unemploymentRate, never a second recompute. */
  unemploymentBand: { label: string; rate: number };
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
  /** Festival preparation in progress, or null (Phase 13, RELI-01). */
  private festivalPlan: FestivalPlan | null = null;
  /** Active festival worship/favor boost window, or null. */
  private festivalBoost: { tierId: FestivalTier['id']; remaining: number } | null = null;
  /** Governor finances (Phase 14, GOV-01): salary + personal account + donations. */
  private governor: GovernorState = createGovernor();
  /** Favor granted by governor donations (applied in derivedSnapshot, clamped 100). */
  private governorFavorBonus = 0;
  /** Active administrative requests (GOV-02), instance id `${id}@${arrivalTick}`. */
  private requests: ActiveRequest[] = [];
  /** Last few settled requests (completed or expired) for the advisor view. */
  private requestHistory: RequestHistoryEntry[] = [];
  private lowFoodWarnCooldown = 0;
  private paused = false;
  private pendingCommands: PendingCommand[] = [];
  private derived: DerivedSnapshot | null = null;
  /** CAMPAIGN-03: the codex is built once per runner (pure catalogs) and reused
   *  by getCodex() and the per-snapshot derived codex count — enrichment must
   *  not make every snapshot rebuild the full encyclopedia (T-17-06 perf). */
  private codexCache: { entries: CodexEntry[] } | null = null;
  /** True while recorded commands are being replayed (save load, paused-command
   *  drain) so state-dependent placement gates — already enforced when the
   *  command was first issued — do not reject the recorded placement. */
  private replaying = false;
  private objective: ObjectiveTracker | null = null;
  /** RATE-01/D-02: lifetime construction spend accumulator — incremented beside
   *  the build/route-open treasury captures (placeBuilding/openTradeRoute) and
   *  re-derives byte-identically from replaying saveCommands. It lands only in
   *  the Prosperity construction bucket, never the operating-balance factor. */
  private constructionSpend = 0;
  /** RATE-02/D-03 (WR-01/WR-02 fix): per-tick exported-load ring for the true
   *  trailing-360-tick annualExports window. Each tick's slot is zeroed before
   *  the trade system runs and incremented ONLY on the physical EXPORT path
   *  (never imports — WR-02), so summing the 360 slots always covers exactly
   *  the last 360 ticks (WR-01). Deterministic from tickCount + live trade
   *  state — no wall-clock, no schema change, survives the quota reset. */
  private readonly tickExportCounts = new Array<number>(360).fill(0);
  /** POP-02: the closing migration month's deltas, reset every %40 month and
   *  surfaced as DerivedSnapshot.immigration/emigration/homeless (total
   *  functions — 0 by default). Internal-only; never serialized. */
  private lastMigration = { immigration: 0, emigration: 0, homeless: 0 };
  /** POP-03: per-sector labor config (pinned/paused), additive and inert until
   *  a player issues setLaborSectorState. Defaults to unpinned/unpaused for any
   *  sector absent (marketConfigs precedent). Internal-only — never serialized;
   *  reconstructed on load by replaying setLaborSectorState commands. */
  private laborSectorCfg = new Map<string, { pinned: boolean; paused: boolean }>();
  /** POP-03: per-sector staffing from the last tickLabor run — the reserve floor
   *  a pinned sector is guaranteed under a shrunken pool (Pitfall 2 runner-level
   *  reserve semantics). Internal-only; re-derives deterministically from ticks. */
  private laborSectorAssigned = new Map<string, number>();

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
    this.replaying = true;
    for (const cmd of batch) applyCommand(this, cmd);
    this.replaying = false;
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

    // HOUS-02: deterministic adjacent-house merging on the month cadence. Runs
    // right after evolution so it sees the tick's final levels, then walkers
    // move (coverage/arrivals see the merged state).
    // POP-01/02: the per-residence cohort sync and the month migration follow
    // immediately after — residency re-derives residents for the tick's final
    // levels (merge/evolution), then migration adjusts internal occupancy
    // (vacancy-bounded netMigration + famine emigration). All mutation lives
    // HERE (inside tick(), %40 cadence) so save/load replay re-derives
    // byte-identically.
    if (this.tickCount % 40 === 0) {
      this.tickHousingMerge();
      this.tickResidency();
      this.tickPopulationMigration();
    }

    // Walkers move last: coverage and arrivals see the tick's final services.
    for (const w of [...this.walkers]) updateWalker(this.simInternals(), w);

    // Random events (deterministic by seed + tick), with lifecycle tracking.
    // RATE-03 (BUG 2 fix): effects are applied LIVE — an active-event rating
    // modifier is computed and removed at conclusion — never discarded.
    if (this.activeEvent) {
      this.activeEvent.remaining -= 1;
      const ev = this.activeEvent;
      if (ev.remaining <= 0) {
        this.logEvent('event', eventFinalMsg(ev.id), EVENTS[ev.id]?.severity ?? 'mild');
        this.activeEvent = null;
        // WR-05: a recorded response applies to a single OCCURRENCE only —
        // clear it on conclusion so a later occurrence of the same event type
        // starts fresh instead of silently re-applying the old choice.
        delete this.eventResponseByEvent[ev.id];
        this.refreshEventDelta();
      } else if (ev.remaining === Math.floor(ev.total / 2)) {
        const sustain = eventSustainMsg(ev.id);
        if (sustain) this.logEvent('event', sustain, EVENTS[ev.id]?.severity ?? 'mild');
      }
    }
    if (!this.activeEvent && this.tickCount % 40 === 0) {
      const ev = pickEvent(this.seed, this.tickCount);
      if (ev) {
        const live = this.derived ?? this.derivedSnapshot();
        const result = applyEvent(ev, { culture: live.culture, prosperity: live.prosperity, stability: live.stability, favor: live.favor });
        this.logEvent('event', `${result.name}: ${result.message}`, result.severity);
        this.activeEvent = { id: ev, remaining: eventDuration(ev), total: eventDuration(ev) };
        this.refreshEventDelta();
        // price_rise/price_fall adjust pricing on EXISTING price states only.
        const def = EVENTS[ev];
        if (def?.priceModify) this.applyEventPriceModifier(def.priceModify);
        // A recorded conclude response (replayed early) ends the event next tick.
        const respId = this.eventResponseByEvent[ev];
        const resp = respId ? def?.responses?.find((r) => r.id === respId) : undefined;
        if (resp?.effect?.conclude) this.activeEvent.remaining = 0;
      }
    }

    // Festivals (Phase 13): prep advances one month per tick at the 40-tick
    // month cadence; a finished prep opens the worship/favor boost window.
    if (this.tickCount % 40 === 0) {
      if (this.festivalPlan) {
        tickFestival(this.festivalPlan);
        if (this.festivalPlan.ready) {
          this.festivalBoost = { tierId: this.festivalPlan.tierId, remaining: FESTIVAL_BOOST_WINDOW_TICKS };
          this.festivalPlan = null;
        }
      } else if (this.festivalBoost) {
        this.festivalBoost.remaining -= MONTH_TICKS;
        if (this.festivalBoost.remaining <= 0) this.festivalBoost = null;
      }
    }

    // Governor (Phase 14, GOV-01): with a placed senate, the monthly salary
    // is paid from the treasury into the governor's personal account.
    if (this.tickCount % 40 === 0 && this.hasPlacedGov('senate')) {
      const paid = payGovernor(this.governor, this.treasuryAccount.balance);
      if (paid.salary > 0) this.treasuryAccount.addExpense('governor', paid.salary);
    }

    // Administrative requests (GOV-02): monthly arrival + completion/expiry.
    if (this.tickCount % 40 === 0) this.tickRequests();

    // Missions / campaign win conditions.
    this.tickMissionSystem();

    // External trade (quota-reset by year).
    this.tickTradeSystem();

    // Anti-hoarding cap: excess above the limit is dropped and ledgered.
    this.tickFinanceCap();

    // Civil safety: per-building fire lifecycle, collapse risk, crime.
    this.tickSafety();

    // RATE-03 (CR-01/WR-04): apply any replay-deferred event response whose
    // original application tick has now been reached (cost + effect at the SAME
    // tick the original run applied it, so the ledger and the live derived
    // effect window stay byte-identical). Runs immediately before the derived
    // snapshot so the snapshot reflects the response exactly as the original
    // run did at that tick. A no-op when the sim is not replaying a save.
    this.applyDueEventResponses();

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

  /** Effective population of a house: the combined population when this
   *  instance resulted from a merge, else the level's live population. Delegates
   *  to the shared housingLive accessor so every consumer counts merged
   *  residents identically (CR-02). */
  private effectiveHousePopulation(h: BuildingInstance): number {
    return effectivePopulation(h);
  }

  /** Tile keys (x<<20|y) covered by a building's footprint. */
  private buildingTileKeys(b: BuildingInstance): Set<number> {
    const keys = new Set<number>();
    for (let dy = 0; dy < b.footprint; dy++) {
      for (let dx = 0; dx < b.footprint; dx++) {
        keys.add(this.tileKey(b.x + dx, b.y + dy));
      }
    }
    return keys;
  }

  /**
   * HOUS-02: deterministic adjacent-house merging on the month cadence.
   * Fixed placement-order scan over this.buildings — a mergeable same-level
   * house whose contiguous block fits the target-level footprint grows into
   * it: the survivor keeps its id/origin, gains the footprint and the combined
   * population of both blocks, occupiedTiles are re-keyed to the whole new
   * square, and the absorbed instance is dropped (tiles freed / re-keyed).
   * No RNG/clock, no new SaveCommand — replay re-derives every merge from the
   * same tick history, so getStateJson() stays byte-identical.
   */
  private tickHousingMerge(): void {
    // Snapshot the scan order: merges mutate this.buildings in place.
    for (const a of [...this.buildings]) {
      if (!a.house) continue;
      if (a.house.mergeable !== true) continue;
      const level = a.house.level ?? 0;
      if (level > 20) continue;
      const footprint = targetFootprint(level);
      if (a.footprint >= footprint) continue; // already grown (or floor 1x1)
      if (!this.buildingById.has(a.id)) continue; // absorbed earlier this pass

      const neighbour = findMergePartner(a, this.buildings);
      if (!neighbour?.house) continue;
      if (neighbour.house.mergeable !== true) continue;
      if ((neighbour.house.level ?? 0) !== level) continue;

      const exempt = new Set<number>([...this.buildingTileKeys(a), ...this.buildingTileKeys(neighbour)]);
      const proposal = mergeProposal(
        a,
        neighbour,
        footprint,
        (x, y) => this.occupiedTiles.has(this.tileKey(x, y)),
        exempt,
      );
      if (!proposal) continue;

      const survivor = proposal.survivor;
      const absorbed = proposal.absorbed;
      // CR-01: the block is anchored at the UNION min-corner (not the survivor
      // origin) so it contains the absorbed house too. Relocate the survivor to
      // that corner so its geometry (buildingTileKeys, adjacency, re-keying)
      // matches the placed square for any later merge pass.
      survivor.x = proposal.originX;
      survivor.y = proposal.originY;
      survivor.footprint = proposal.footprint;
      survivor.house!.combinedPopulation =
        this.effectiveHousePopulation(survivor) + this.effectiveHousePopulation(absorbed);

      // Re-key occupancy: whole new footprint square to the survivor id.
      for (let dy = 0; dy < survivor.footprint; dy++) {
        for (let dx = 0; dx < survivor.footprint; dx++) {
          this.occupiedTiles.set(this.tileKey(survivor.x + dx, survivor.y + dy), survivor.id);
        }
      }

      // Free the absorbed instance's former tiles (its origin tiles are
      // released; tiles inside the survivor square are re-keyed above).
      for (const key of this.buildingTileKeys(absorbed)) {
        if (this.occupiedTiles.get(key) === absorbed.id) this.occupiedTiles.delete(key);
      }

      // Walker-target safety: repoint any walker whose objective is the
      // absorbed building to the survivor (walkers.ts tolerates a missing
      // target too, but repointing keeps deliveries/labor on track).
      this.repointWalkersTowards(absorbed.id, survivor.id);

      // Drop the absorbed instance from the registry.
      this.buildings = this.buildings.filter((b) => b.id !== absorbed.id);
      this.buildingById.delete(absorbed.id);

      this.emitMessage('house-merged', `House merged to ${housingLevelName(level)}`);
    }
  }

  /** Repoint walkers whose target/dest/source building is `from` to `to`,
   *  so a walker (or trade carrier) whose objective references the absorbed
   *  house is redirected to the merger instead of dangling (WR-03). */
  private repointWalkersTowards(from: number, to: number): void {
    for (const w of this.walkers) {
      if (w.targetBuildingId === from) w.targetBuildingId = to;
      if (w.trade?.destBuildingId === from) w.trade.destBuildingId = to;
      if (w.trade?.sourceBuildingId === from) w.trade.sourceBuildingId = to;
    }
  }

  /**
   * POP-01: per-residence cohort sync on the month cadence (tickCount % 40, right
   * after tickHousingMerge so it sees the tick's final levels). Every house keeps
   * an internal-only `residents` array derived FROM the level-based
   * effectivePopulation — never serialized, so goldens/SimState stay
   * byte-identical. On a level change/merge the cohort is re-derived fresh via
   * residentsForHouse (mulberry32 seeded by a house-stable salt of id + level +
   * month — the shared RNG stream is NEVER touched, each cohort gets its own
   * seeded RNG); otherwise it is aged one month. Occupancy is kept at the house's
   * effective population and never exceeds it — a devolve becomes over-full and
   * re-derives.
   */
  private tickResidency(): void {
    for (const b of this.buildings) {
      if (!b.house) continue;
      const h = b.house;
      const level = h.level ?? 0;
      const capacity = this.effectiveHousePopulation(b);
      if (
        h.residents === undefined ||
        h.residentsDerivedLevel !== level ||
        h.residentsDerivedCapacity !== capacity
      ) {
        const salt = (b.id * 2654435761 + level * 73856093 + Math.floor(this.tickCount / 40) * 19349663) >>> 0;
        h.residents = residentsForHouse(level, capacity, salt === 0 ? 1 : salt, (s) => mulberry32(s));
        h.residentsDerivedLevel = level;
        h.residentsDerivedCapacity = capacity;
        h.nextResidentId = h.residents.length + 1;
      } else {
        ageOnMonth(h.residents);
      }
    }
  }

  /**
   * POP-02: month-cadence migration (tickCount % 40, right after tickResidency
   * so the cohort reflects this tick's final levels). Pure over deterministic
   * state: an attractiveness blend from ALREADY-derived inputs (desirability,
   * civic coverage, unemployment — never a second recompute) drives
   * vacancy-bounded immigration via netMigration (0 when the city is full ⇒
   * golden-neutral), and foodShortageEffects-driven famine emigration creates
   * vacancy for later months to refill. All deltas live on internal occupancy
   * + DerivedSnapshot — getState()/toBuildingState/workerPool/tax/populationOf
   * stay capacity-based (Pitfall 3 / A6); NO immigration/emigration walkers
   * are spawned (A7). Deterministic and replay-byte-identical.
   */
  private tickPopulationMigration(): void {
    const snapshot = this.derived ?? this.derivedSnapshot();
    // Unemployment from ALREADY-derived values (never a second recompute).
    const population = snapshot.population;
    const unemploymentRate =
      population > 0
        ? Math.max(0, Math.min(1, (population - snapshot.employment.employed) / population))
        : 0;
    const houses = this.buildings.filter((b) => b.house);

    // Attractiveness blend [ASSUMED A5] — module-local weights.
    let desirabilityNorm = 0;
    for (const b of houses) {
      const input = this.houseHappinessInput(b);
      desirabilityNorm += Math.max(0, Math.min(1, input.desirability / 200));
    }
    const desirabilityAvg = houses.length === 0 ? 0 : desirabilityNorm / houses.length;
    const civicAvg =
      (this.civicCoverage('health') + this.civicCoverage('literacy') + this.civicCoverage('entertainment')) / 3;
    const attractiveness = Math.max(
      0,
      Math.min(1, 0.35 * desirabilityAvg + 0.25 * civicAvg + 0.4 * (1 - unemploymentRate)),
    );

    this.lastMigration = { immigration: 0, emigration: 0, homeless: 0 };

    // Famine emigration: houses starving past FAMINE_EMIGRATION_MONTHS drain
    // residents (foodShortageEffects(starvedMonths * 10).emigration — the
    // housing.ts emigrate/regress/crime vocabulary). Deterministic house order;
    // a fed month resets the counter, so transient gaps don't emigrate.
    for (const b of houses) {
      const h = b.house!;
      const fed = (h.foodCooldown ?? 0) > 0;
      h.starvedMonths = fed ? 0 : (h.starvedMonths ?? 0) + 1;
      if (
        !fed &&
        h.starvedMonths >= FAMINE_EMIGRATION_MONTHS &&
        foodShortageEffects(h.starvedMonths * 10).emigration &&
        (h.residents?.length ?? 0) > 0
      ) {
        const leave = Math.min(h.residents!.length, FAMINE_EMIGRANTS_PER_MONTH);
        h.residents!.splice(0, leave);
        this.lastMigration.emigration += leave;
        this.lastMigration.homeless += leave;
      }
    }

    // Immigration: vacancy-bounded netMigration into under-occupied houses in
    // deterministic placement order. A full city has capacityAvailable 0 ⇒ mig 0
    // (golden-neutral by construction, Pitfall 3).
    let capacityAvailable = 0;
    for (const b of houses) {
      const h = b.house!;
      const capacity = this.effectiveHousePopulation(b);
      capacityAvailable += Math.max(0, capacity - (h.residents?.length ?? capacity));
    }
    const mig = netMigration({ attractiveness, unemployment: unemploymentRate, capacityAvailable });
    if (mig > 0) {
      let toBook = mig;
      for (const b of houses) {
        if (toBook <= 0) break;
        const h = b.house!;
        const capacity = this.effectiveHousePopulation(b);
        const room = capacity - (h.residents?.length ?? 0);
        if (room <= 0) continue;
        this.bookResidents(b, Math.min(room, toBook));
        toBook -= Math.min(room, toBook);
      }
      this.lastMigration.immigration = mig;
    }
  }

  /** POP-01/02: deterministically book `n` new residents into a house (used by
   *  migration to fill vacancy). The new residents reuse the residentsForHouse
   *  derivation (class from tierOfLevel, age from a house-stable seeded RNG) and
   *  sequential nextResidentId — never Math.random, never the shared RNG. */
  private bookResidents(b: BuildingInstance, n: number): void {
    const h = b.house;
    if (!h) return;
    if (h.residents === undefined) h.residents = [];
    const level = h.level ?? 0;
    const tier = Math.floor(level / 4);
    const patricianShare = tier >= 3 ? Math.min(0.6, (tier - 2) * 0.2) : 0;
    const salt = (b.id * 40503 + level * 719939 + 17) >>> 0;
    const rng = mulberry32(salt === 0 ? 1 : salt);
    const capacity = this.effectiveHousePopulation(b);
    for (let i = 0; i < n; i++) {
      if (h.residents.length >= capacity) break;
      const id = h.nextResidentId ?? h.residents.length + 1;
      const isPatrician = patricianShare > 0 && rng.next() < patricianShare;
      h.residents.push({
        id,
        class: isPatrician ? 'patrician' : 'plebeian',
        age: 16 + Math.floor(rng.next() * 45), // workforce-age immigrant
        employed: false,
      });
      h.nextResidentId = id + 1;
    }
  }

  private tickDerivedSystems(): void {
    const snapshot = this.derivedSnapshot();
    this.derived = snapshot;
    // RATE-02 (BUG 1 fix): the objective is updated ONLY on the month cadence
    // (tickCount % 40 === 0), so sustainChecks counts months, not ticks — and
    // never on reads (see getObjectiveProgress). Every target metric is fed
    // from the same snapshot.
    if (this.tickCount % 40 === 0 && this.objective) {
      this.objective.update({
        population: snapshot.population,
        culture: snapshot.culture,
        prosperity: snapshot.prosperity,
        stability: snapshot.stability,
        favor: snapshot.favor,
        treasury: snapshot.treasury,
        annualExports: snapshot.annualExports,
      });
    }
  }

  private tickTradeSystem(): void {
    const year = Math.floor(this.tickCount / 360);
    // RATE-02/D-03 (WR-01 fix): zero this tick's export ring slot BEFORE the
    // trade system runs so each slot holds exactly one tick's exports and the
    // summed window always covers the last 360 ticks. Deterministic from
    // tickCount + live trade state — byte-identical across chunked ticking and
    // a save/load replay (the ring re-derives from replaying the same ticks).
    this.tickExportCounts[this.tickCount % 360] = 0;
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
      // WR-02: the trailing-360 annualExports window counts EXPORTS only — the
      // ring is incremented here (physical export path), never on the import
      // path below.
      this.tickExportCounts[this.tickCount % 360] += qty;
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
    this.constructionSpend += cost;
    route.enabled = true;
    route.orders = route.orders ?? {};
    route.openYear = Math.floor(this.tickCount / 360);
    route.catalogQuota = city.annualQuotaPerGood;
    route.lastYear = Math.floor(this.tickCount / 360);
    // RATE-02: route openings are replayed as SaveCommands so a save/load
    // round-trip reconstructs the exact trade state (and the annualExports
    // window that derives from it). Skipped for startMission sub-effects
    // (T-17-03 — the single {kind:'startMission'} command is the record).
    if (!this.suppressCommandRecording) {
      this.commandLog.push({ tick: this.tickCount, command: `openTradeRoute ${cityId}`, result: 'ok' });
      this.saveCommands.push({ kind: 'openTradeRoute', cityId });
    }
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
    // RATE-02: per-good orders are replayed as SaveCommands so the physical
    // trade path (and the annualExports window) survives save/load. Skipped for
    // startMission sub-effects (T-17-03 — the single startMission command is the
    // complete deterministic record).
    if (!this.suppressCommandRecording) {
      this.commandLog.push({ tick: this.tickCount, command: `setTradeOrder ${cityId} ${good} ${mode}`, result: 'ok' });
      this.saveCommands.push({ kind: 'setTradeOrder', cityId, good, mode, reserve: opts?.reserve, target: opts?.target });
    }
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
    if (temples.length === 0 && !this.festivalBoost) return {};
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
    // Festival boost (Phase 13): honors every god while the window is active,
    // raising each god's worship (gods without temples rise from 0).
    if (this.festivalBoost) {
      const tier = FESTIVAL_TIERS.find((t) => t.id === this.festivalBoost!.tierId);
      const boost = tier?.worshipBoost ?? 0;
      for (const god of GODS) worship[god] = Math.min(1, (worship[god] ?? 0) + boost);
    }
    return worship;
  }

  /** RATE-01: average house tier / max tier (0..1) — the Prosperity housing factor. */
  private avgHousingLevel(): number {
    const houses = this.buildings.filter((b) => b.house);
    if (houses.length === 0) return 0;
    let sum = 0;
    for (const b of houses) sum += b.house!.tier;
    return sum / houses.length / Math.max(1, HOUSE_TIERS.length - 1);
  }

  /** RATE-01: share of high-tier housing (Domus+) — the Prosperity patricians factor. */
  private patricianShare(): number {
    const houses = this.buildings.filter((b) => b.house);
    if (houses.length === 0) return 0;
    let high = 0;
    for (const b of houses) if (b.house!.tier >= 3) high += 1;
    return high / houses.length;
  }

  /** RATE-01: fraction of trade cities with an enabled route — the Prosperity trade factor. */
  private tradeActivity(): number {
    const total = Object.keys(TRADE_CITIES).length;
    if (total === 0) return 0;
    let enabled = 0;
    for (const route of Object.values(this.tradeRoutes)) if (route.enabled) enabled += 1;
    return Math.min(1, enabled / total);
  }

  /** RATE-01: granary/farm wheat stock as a fraction of aggregate capacity (0..1). */
  private supplyLevelFactor(): number {
    const hosts = this.buildings.filter((b) => b.type === 'granary' || b.type === 'farm');
    if (hosts.length === 0) return 0;
    let stock = 0;
    for (const b of hosts) stock += (b.stock?.wheat ?? 0);
    const capacity = hosts.length * CONFIG.granaryCapacity;
    return Math.min(1, stock / Math.max(1, capacity));
  }

  /** RATE-01: share of settled administrative requests that were rewarded (0..1). */
  private requestFulfillment(): number {
    if (this.requestHistory.length === 0) return 0;
    let rewards = 0;
    for (const h of this.requestHistory) if (h.outcome === 'reward') rewards += 1;
    return rewards / this.requestHistory.length;
  }

  /** RATE-02/D-03 (WR-01/WR-02 fix): the trailing-360-tick annual-export
   *  window — the sum of each of the last 360 ticks' EXPORTED loads (the
   *  per-tick ring; imports are excluded). Deterministic (replay-derivable
   *  from tickCount + trade state), never wall-clock, and never a lifetime
   *  accumulator. */
  private annualExportsTotal(): number {
    let total = 0;
    for (let i = 0; i < this.tickExportCounts.length; i++) total += this.tickExportCounts[i];
    return total;
  }

  /** RATE-03: price_rise/price_fall modify EXISTING per-city/good price states
   *  only (a no-op when none exist, so golden runs with no routes stay intact). */
  private applyEventPriceModifier(mod: { good?: string; delta: number }): void {
    for (const [, byGood] of this.tradePrices) {
      if (mod.good) {
        const st = byGood.get(mod.good);
        if (st) applyPriceEvent(st, mod.delta, this.tickCount);
      } else {
        for (const st of byGood.values()) applyPriceEvent(st, mod.delta, this.tickCount);
      }
    }
  }

  /** Severity multiplier for scaling an event's own rating deltas when a
   *  response alters its severity (mild < serious < disaster). */
  private static severityMultiplier(s: string): number {
    switch (s) {
      case 'disaster': return 1.5;
      case 'serious': return 1;
      case 'mild':
      default: return 0.5;
    }
  }

  /** RATE-03: recompute the active-event rating modifier from the event's base
   *  effect, scaled by any recorded response's severity, plus the response's own
   *  rating deltas. Zero when no event is active. */
  private refreshEventDelta(): void {
    let d = { culture: 0, prosperity: 0, stability: 0, favor: 0 };
    if (this.activeEvent) {
      const ev = EVENTS[this.activeEvent.id];
      if (ev) {
        const respId = this.eventResponseByEvent[ev.id];
        const resp = respId ? ev.responses?.find((r) => r.id === respId) : undefined;
        const scale = resp?.effect?.severity
          ? SimRunner.severityMultiplier(resp.effect.severity) / SimRunner.severityMultiplier(ev.severity)
          : 1;
        d = {
          culture: Math.round((ev.effect.culture ?? 0) * scale) + (resp?.effect?.culture ?? 0),
          prosperity: Math.round((ev.effect.prosperity ?? 0) * scale) + (resp?.effect?.prosperity ?? 0),
          stability: Math.round((ev.effect.stability ?? 0) * scale) + (resp?.effect?.stability ?? 0),
          favor: Math.round((ev.effect.favor ?? 0) * scale) + (resp?.effect?.favor ?? 0),
        };
      }
    }
    this.activeEventDelta = d;
  }

  /** RATE-03: respond to an active event with a player choice. A valid choice
   *  mutates the outcome (treasury cost via the ledger, altered severity, or
   *  early conclusion); unknown/inactive events or unknown choices are rejected
   *  with no state change. Replayable as a SaveCommand (the response is recorded
   *  so an event that re-fires during replay shapes the same outcome).
   *
   *  `applyTick` is the tick the response was first issued live (`tick` on the
   *  saved command). On a save-load replay the effect + treasury cost are
   *  deferred to that same tick (CR-01/WR-04) so the ledger and the live
   *  derived-ratings effect window reproduce the original run exactly.
   */
  respondEvent(eventId: string, choiceId: string, applyTick?: number): { ok: boolean; error?: string } {
    const ev = EVENTS[eventId];
    const choice = resolveResponse(eventId, choiceId);
    // Validation shared by the direct and paused paths (WR-03: a paused-queued
    // response must clear the same active-event / funds gates as a direct one).
    const validate = (): string | null => {
      if (!ev || !choice) return 'unknown-choice';
      if (!this.activeEvent) return 'no-active-event';
      if (this.activeEvent.id !== eventId) return 'no-active-event';
      if (choice.effect.treasuryCost && this.treasuryAccount.balance < choice.effect.treasuryCost) return 'not-enough-money';
      return null;
    };

    if (this.paused) {
      const err = validate();
      if (err) {
        this.commandLog.push({ tick: this.tickCount, command: `respondEvent ${eventId}:${choiceId}`, result: err === 'not-enough-money' ? 'not-enough-money' : 'invalid-type' });
        return { ok: false, error: err };
      }
      this.enqueue({ kind: 'respondEvent', eventId, choiceId, tick: this.tickCount });
      return { ok: true };
    }

    // Replay / paused-queue drain: the command was already validated when first
    // issued, so accept without re-running the state gates.
    if (this.replaying) {
      if (!ev || !choice) return { ok: false, error: 'unknown-choice' };
      const issuedTick = applyTick ?? this.tickCount;
      if (issuedTick <= this.tickCount) {
        // Already at/after the application tick (paused-drain) — apply now.
        this.applyRecordedResponse(eventId, choiceId, true);
      } else {
        // CR-01/WR-04: replayed at tick 0 but the response is not due yet —
        // defer so the cost is booked and the effect shaped at the ORIGINAL
        // application tick (applyDueEventResponses), not at the reconstruction.
        this.deferredEventResponses.push({ eventId, choiceId, applyTick: issuedTick });
      }
      return { ok: true };
    }

    const err = validate();
    if (err) {
      this.commandLog.push({ tick: this.tickCount, command: `respondEvent ${eventId}:${choiceId}`, result: err === 'not-enough-money' ? 'not-enough-money' : 'invalid-type' });
      return { ok: false, error: err };
    }
    // Live accept: record the choice, apply any treasury cost through the
    // ledger, and shape the ongoing rating modifier / early conclusion.
    this.applyRecordedResponse(eventId, choiceId, true);
    this.commandLog.push({ tick: this.tickCount, command: `respondEvent ${eventId}:${choiceId}`, result: 'ok' });
    this.saveCommands.push({ kind: 'respondEvent', eventId, choiceId, tick: this.tickCount });
    return { ok: true };
  }

  /** RATE-03: accept a validated response — record the choice, charge any
   *  treasury cost through the ledger, and shape the event's continuing rating
   *  modifier / early conclusion. Shared by the live, paused-drain, and
   *  deferred-replay application paths. */
  private applyRecordedResponse(eventId: string, choiceId: string, chargeCost: boolean): void {
    const choice = resolveResponse(eventId, choiceId);
    if (!choice) return;
    const active = !!this.activeEvent && this.activeEvent.id === eventId;
    this.eventResponseByEvent[eventId] = choiceId;
    if (chargeCost && choice.effect.treasuryCost && choice.effect.treasuryCost > 0) {
      this.treasuryAccount.addExpense('other', choice.effect.treasuryCost);
    }
    if (active && choice.effect.conclude) {
      this.activeEvent!.remaining = 0;
    }
    this.refreshEventDelta();
    this.derived = null;
  }

  /** RATE-03 (CR-01/WR-04): apply any replay-deferred event response whose
   *  original application tick has been reached. Runs once per tick just before
   *  the derived snapshot. Bookkeeping: the treasury cost is charged with the
   *  ordinary clamped-`addExpense` because the reconstructed balance at the
   *  application tick equals the balance the original run had when the response
   *  was accepted (the live path already guaranteed funds) — so no clamp
   *  divergence and the ledger stays byte-identical. A no-op when live. */
  private applyDueEventResponses(): void {
    if (this.deferredEventResponses.length === 0) return;
    const due = this.deferredEventResponses.filter((d) => d.applyTick <= this.tickCount);
    if (due.length === 0) return;
    this.deferredEventResponses = this.deferredEventResponses.filter((d) => d.applyTick > this.tickCount);
    for (const d of due) this.applyRecordedResponse(d.eventId, d.choiceId, true);
  }


  private derivedSnapshot(): DerivedSnapshot {
    const population = this.getPopulation();
    const employment = this.getEmployment();
    const has = (cat: string) => this.buildings.some((b) => BUILDINGS[b.type].category === cat);
    const godWorship = this.liveGodWorship();
    const festivalFavorBoost = this.festivalBoost
      ? (FESTIVAL_TIERS.find((t) => t.id === this.festivalBoost!.tierId)?.favorBoost ?? 0)
      : 0;
    const serviceCoverage = computeServiceCoverage({
      doctorCoverage: this.civicCoverage('health'),
      educationCoverage: this.civicCoverage('literacy'),
      entertainmentCoverage: this.civicCoverage('entertainment'),
      godWorship,
    });
    // RATE-01: the CityStats fed to computeTargets carries the live normalized
    // factor inputs so the decomposition reflects real buildings, and
    // decomposeRatings consumes the SAME CityStats — one computation, never a
    // second recompute of the rating.
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
    let religionCoverage = 0;
    for (const v of Object.values(godWorship)) religionCoverage = Math.max(religionCoverage, v ?? 0);
    const unemploymentRate = population > 0
      ? Math.max(0, Math.min(1, (population - employment.employed) / population))
      : 0;
    const cityStats: CityStats = {
      population, treasury: this.getTreasury(), taxRate: this.policy.taxRate,
      hasReligion: has('religion'), hasEntertainment: has('entertainment'), hasEducation: has('education'),
      hasHealth: has('health'), hasWater: has('water'), hasFood: has('food'),
      // Culture.
      educationCoverage: serviceCoverage.literacy,
      entertainmentCoverage: serviceCoverage.entertainment,
      religionCoverage,
      festivalBoost: this.festivalBoost ? 1 : 0,
      // Prosperity.
      housingLevel: this.avgHousingLevel(),
      patricianShare: this.patricianShare(),
      operatingBalance: Math.min(1, this.getTreasury() / 2000),
      unemployment: unemploymentRate,
      wagesPaid: this.lastWagesUnpaid > 0 ? 0 : this.policy.wageRate,
      tradeActivity: this.tradeActivity(),
      longTermStability: this.lastWagesUnpaid > 0 ? 0.4 : 0.8,
      debtBurden: Math.min(1, this.getDebt() / 2000),
      // Stability.
      healthCoverage: serviceCoverage.health,
      fireRiskFactor: fireRisk,
      crimeFactor: crime,
      supplyLevel: this.supplyLevelFactor(),
      employmentLevel: 1 - unemploymentRate,
      collapseRiskFactor: collapseRisk,
      residentialStability: this.lastWagesUnpaid > 0 ? 0.3 : 0.7,
      // Favor (factors without a live source yet keep a neutral baseline so the
      // bucket always renders).
      requestsFulfilled: this.requestFulfillment(),
      giftsGiven: this.governorFavorBonus > 0 ? 0.5 : 0,
      objectivesMet: this.objective ? 0.5 : 0,
      tributePaid: 0.5,
      salaryLevel: this.governor.salaryLevel / Math.max(1, GOVERNOR_SALARY_LEVELS.length - 1),
      performance: this.lastWagesUnpaid > 0 ? 0.3 : 0.7,
    };
    const targets = computeTargets(cityStats);
    // RATE-03: the active event's rating modifier is applied to the live
    // derived ratings (removed at conclusion). It is derived-only — NEVER
    // written into getState(), so goldens and the economy computeRatings path
    // stay untouched.
    const eventMod = this.activeEvent ? this.activeEventDelta : { culture: 0, prosperity: 0, stability: 0, favor: 0 };
    const water = new WaterSystem();
    water.setSources(this.liveWaterSources());
    const grid = water.compute(this.width, this.height, () => 0);
    let coveredTiles = 0;
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) if (grid[y][x].coveredByWell || grid[y][x].coveredByFountain) coveredTiles++;

    const taxes = taxCollected(population, 2, this.policy.taxRate, 1);
    const wages = employment.employed * CONFIG.wagePerWorkerPerTick * this.policy.wageRate;
    const codex = this.codexCache?.entries ?? (this.codexCache = { entries: buildCodex() }).entries;
    const decomposition = decomposeRatings(cityStats, this.constructionSpend);
    return {
      population,
      culture: clampRating(targets.culture + eventMod.culture),
      prosperity: clampRating(targets.prosperity + eventMod.prosperity),
      stability: clampRating(targets.stability + eventMod.stability),
      favor: clampRating(Math.min(100, targets.favor + computeFavor(godWorship) + festivalFavorBoost + this.governorFavorBonus) + eventMod.favor),
      employment: { jobs: employment.totalJobs, employed: employment.employed },
      services: serviceCoverage,
      godWorship,
      water: { coveredTiles, totalTiles: this.width * this.height },
      fireRisk, collapseRisk, crime, treasury: this.getTreasury(), taxes, wages,
      codex: { buildings: codex.filter((e) => e.kind === 'building').length, goods: codex.filter((e) => e.kind === 'commodity').length, services: codex.filter((e) => e.kind === 'service').length, gods: codex.filter((e) => e.kind === 'god').length },
      government: unlockedGov(population).map((g) => g.id),
      decomposition,
      constructionSpend: this.constructionSpend,
      annualExports: this.annualExportsTotal(),
      // POP-01: per-residence totals projected from live internals (total
      // functions — 0/0 row when no residency initialized yet). Golden-safe:
      // getStateJson serializes getState, not this derived snapshot.
      residentCount: population,
      residentsByClass: this.residentsByClass(),
      // POP-02: the closing migration month's internal deltas (0 by default —
      // total function, empty cities safe).
      immigration: this.lastMigration.immigration,
      emigration: this.lastMigration.emigration,
      homeless: this.lastMigration.homeless,
      // POP-04: urban wage/employment-band reports — pure projections of the
      // live policy + this tick's already-computed unemploymentRate (never a
      // second recompute), both total functions (empty-city safe).
      wageBand: wageBand({
        wageRate: this.policy.wageRate,
        imperialReference: IMPERIAL_WAGE_REFERENCE,
      }),
      unemploymentBand: unemploymentBand(unemploymentRate),
    };
  }

  /** POP-01: live per-class resident totals over internal house residents (0/0
   *  when no residency has been initialized — total function, empty-city safe). */
  private residentsByClass(): { plebeian: number; patrician: number } {
    let plebeian = 0;
    let patrician = 0;
    for (const b of this.buildings) {
      if (!b.house?.residents) continue;
      for (const r of b.house.residents) {
        if (r.class === 'patrician') patrician += 1;
        else plebeian += 1;
      }
    }
    return { plebeian, patrician };
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

  /**
   * Water overlay (UI-03): per-tile water grids aggregating ALL live
   * well/fountain sources — never find()-first semantics. Pure read-only
   * projection over this.buildings (no caching, deterministic for a 40x40 grid);
   * the aqueduct/reservoir systems are not wired into the runner (reservoir is
   * not a placeable BuildingType), so those grids read zero by design.
   */
  getWaterOverlay(): Record<string, number[][]> {
    const ws = new WaterSystem();
    ws.setSources(this.liveWaterSources());
    const grid = ws.compute(this.width, this.height, () => 0);
    return waterOverlayData({
      width: this.width,
      height: this.height,
      grid,
      aqueductTiles: new Set(),
      flowing: new Set(),
      reservoirStates: [],
    });
  }

  /**
   * UI-03 desirability overlay: the same per-tile desirability the sim applies
   * to house evolution (`desirabilityOf`) — terrain + policy spread + adjacent
   * road bonus, plus each live house's actual service coverage on its footprint.
   * Pure projection (read-only, deterministic, never serialized); the water-only
   * `desirability` grid (well/fountain additive delta) is intentionally NOT the
   * surface this exposes — it would be blank everywhere except near sources
   * (WR-05).
   */
  getDesirabilityOverlay(): number[][] {
    const width = this.width;
    const height = this.height;
    // Per-tile service coverage from live houses (footprint-aware merge).
    const servicesAt = new Map<string, { food: boolean; water: boolean; labor: boolean }>();
    for (const b of this.buildings) {
      if (!b.house) continue;
      const fp = Math.max(1, b.footprint ?? 1);
      const svc = {
        food: b.house.foodCooldown > 0,
        water: b.house.waterCooldown > 0,
        labor: b.house.laborCooldown > 0,
      };
      for (let dy = 0; dy < fp; dy++) {
        for (let dx = 0; dx < fp; dx++) {
          servicesAt.set(`${b.y + dy}:${b.x + dx}`, svc);
        }
      }
    }
    const wagesUnpaid = this.lastWagesUnpaid > 0;
    const arrears = this.arrearsDepth();
    const grid: number[][] = [];
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        const svc = servicesAt.get(`${y}:${x}`) ?? { food: false, water: false, labor: false };
        row.push(desirabilityOf(this.map, x, y, this.policy, wagesUnpaid, svc, arrears));
      }
      grid.push(row);
    }
    return grid;
  }

  /** Every live well/fountain as an active water source (shared by the water
   *  overlay and the derived water %, so the two always agree). Fountains keep
   *  their kind so they land in `fountainCoverage`, not `wellCoverage`. */
  private liveWaterSources(): WaterSource[] {
    return this.buildings
      .filter((b) => b.type === 'well' || b.type === 'fountain')
      .map((b) => ({
        x: b.x,
        y: b.y,
        kind: (b.type === 'fountain' ? 'fountain' : 'well') as WaterSourceKind,
        active: true,
        radius: 2,
      }));
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

  /** CAMPAIGN-02: the pure per-house predicate input — the runner's live
   *  BuildingInstance/ HouseInstance state mapped into the campaign.ts shape.
   *  A house `workersRequired` is its live workforce contribution (a roof house
   *  contributes its level's workers), so `!laborConnected && workersRequired >
   *  0` reads "occupied but road/network-isolated". Deterministic — read-only,
   *  never mutates state, no wall-clock. */
  private houseViews(): HouseView[] {
    return this.buildings.filter((b) => b.house).map((b) => ({
      id: b.id,
      level: b.house!.level ?? 0,
      laborConnected: b.laborConnected,
      workersRequired: effectiveWorkers(b),
      desirability: desirabilityOf(this.map, b.x, b.y, this.policy, this.lastWagesUnpaid > 0, {
        food: b.house!.foodCooldown > 0,
        water: b.house!.waterCooldown > 0,
        labor: b.house!.laborCooldown > 0,
      }, this.arrearsDepth()),
      foodCooldown: b.house!.foodCooldown,
      waterCooldown: b.house!.waterCooldown,
      laborCooldown: b.house!.laborCooldown,
      services: b.house!.services ? ({ ...b.house!.services } as Record<string, number>) : undefined,
      godAccess: b.house!.godAccess ? ({ ...b.house!.godAccess } as Record<string, number>) : undefined,
      foodInventory: b.house!.foodInventory ? ({ ...b.house!.foodInventory } as Record<string, number>) : undefined,
      satisfied: deriveSatisfied(b.house!, this.buildings),
    }));
  }

  /** CAMPAIGN-02: city-wide predicate inputs (storage stock, exports, mission
   *  targets, food producers) — built from live state, deterministic. */
  private cityView(): CityView {
    const d = this.derived ?? this.derivedSnapshot();
    const hasStorageStock = this.buildings.some((b) => {
      for (const v of Object.values(b.stock)) if ((v ?? 0) > 0) return true;
      return false;
    });
    const hasFoodProducer = this.buildings.some((b) => BUILDINGS[b.type]?.production != null);
    let missionTargets: CityView['missionTargets'];
    if (this.mission) {
      const def = MISSIONS[this.mission.id] ?? EXTRA_MISSIONS[this.mission.id];
      if (def) {
        missionTargets = {
          population: def.targetPopulation,
          culture: def.targetCulture,
          prosperity: def.targetProsperity,
          stability: def.targetStability,
          favor: def.targetFavor,
          treasury: def.targetTreasury,
          annualExports: def.targetAnnualExports,
        };
      }
    }
    return {
      hasStorageStock,
      annualExports: d.annualExports,
      missionActive: !!this.mission,
      missionTargets,
      hasFoodProducer,
    };
  }

  /** CAMPAIGN-02: the catalog-order steps whose pure predicate is true over
   *  current state. Deterministic from state — never wall-clock. */
  private tutorialEligibleSteps(): TutorialStepId[] {
    const d = this.derived ?? this.derivedSnapshot();
    const houses = this.houseViews();
    const city = this.cityView();
    return TUTORIAL_STEP_ORDER.filter((s) => TUTORIAL_ELIGIBILITY[s].eligible(d, houses, city));
  }

  /** CAMPAIGN-02: the tutorial state the UI reads — a PURE derived accessor
   *  (never serialized, computed on read from state + the dismissed set). Each
   *  eligible-cause step carries the house ids that triggered it (the 'show
   *  where' highlight; introduction steps ring empty). `current` is the first
   *  catalog-order eligible step not dismissed. */
  getTutorial(): TutorialView {
    const eligibleSteps = this.tutorialEligibleSteps();
    const houses = this.houseViews();
    const prompts: TutorialPrompt[] = eligibleSteps.map((step) => {
      const highlight = TUTORIAL_ELIGIBILITY[step].highlight
        ? TUTORIAL_ELIGIBILITY[step].highlight!(houses)
        : [];
      return {
        step,
        shortText: tutorialText(step),
        expandedText: TUTORIAL_EXPANDED[step],
        codexRef: TUTORIAL_CODEX_REF[step],
        highlight,
      };
    });
    const eligible = prompts.filter((p) => !this.dismissedTutorialSteps.has(p.step));
    const currentId = nextTutorialCurrent(new Set(), this.dismissedTutorialSteps, eligibleSteps);
    return {
      current: eligible.find((p) => p.step === currentId) ?? null,
      eligible,
      dismissed: [...this.dismissedTutorialSteps],
    };
  }

  /** CAMPAIGN-03: the full codex encyclopedia — a PURE derived accessor over the
   *  data catalogs, built once and cached (the per-snapshot derived count reuses
   *  it). Exposes per-category counts and an id/kind lookup. Never serialized. */
  getCodex(): {
    entries: CodexEntry[];
    categories: Record<string, number>;
    lookupEntry: (id: string, kind?: CodexKind) => CodexEntry | undefined;
  } {
    const entries = this.codexCache?.entries ?? (this.codexCache = { entries: buildCodex() }).entries;
    const categories: Record<string, number> = {};
    for (const e of entries) categories[e.kind] = (categories[e.kind] ?? 0) + 1;
    return {
      entries,
      categories,
      lookupEntry: (id: string, kind?: CodexKind) => lookupEntry(entries, id, kind),
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

  /** Set an objective/win-condition to evaluate on the month cadence. Each
   *  target may be undefined (= not required); sustainChecks defaults to 3. */
  setObjective(target: { population?: number; culture?: number; prosperity?: number; stability?: number; favor?: number; treasury?: number; annualExports?: number; sustainChecks?: number }): void {
    this.objective = new ObjectiveTracker(target);
  }

  /** RATE-02 (BUG 1 fix): a PURE read of the last monthly objective update —
   *  calling this never advances the sustain counter. Returns progress as
   *  sustained/sustainChecks clamped 0..1. */
  getObjectiveProgress(): { won: boolean; progress: number; sustained: number; sustainChecks: number } | null {
    if (!this.objective) return null;
    const o = this.objective;
    const r = o.lastResult();
    return {
      won: r.won,
      progress: Math.min(1, r.sustained / o.sustainChecks),
      sustained: r.sustained,
      sustainChecks: o.sustainChecks,
    };
  }

  /** RATE-02 (D-03): the mission/completion path is unified on the sustained
   *  ObjectiveTracker — a mission wins only after ALL its targets (incl. new
   *  treasury/favor/annualExports) are held for the sustain period (default 3
   *  months) on the month cadence. Time-limit failure is preserved and
   *  shortfalls stay visible (the mission reads not-complete, never failed,
   *  while below threshold). */
  private tickMissionSystem(): void {
    if (!this.mission || this.mission.complete || this.mission.failed) return;
    const def = MISSIONS[this.mission.id] ?? EXTRA_MISSIONS[this.mission.id];
    if (!def) {
      // WR-06 (legacy semantics): an unknown mission id FAILS rather than
      // auto-completing via an all-undefined ObjectiveTracker ok-chain.
      this.mission.failed = true;
      return;
    }
    // Time-limit failure preserved (year − start year > timeLimitYears). A
    // per-mission override (modifiers.timeLimitYears) wins over the flat field.
    const year = Math.floor(this.tickCount / 360);
    const limitYears = def.modifiers?.timeLimitYears ?? def.timeLimitYears;
    if (limitYears && year - this.mission.year > limitYears) {
      this.mission.failed = true;
      return;
    }
    if (!this.missionTracker) {
      this.missionTracker = new ObjectiveTracker({
        population: def.targetPopulation,
        culture: def.targetCulture,
        prosperity: def.targetProsperity,
        stability: def.targetStability,
        favor: def.targetFavor,
        treasury: def.targetTreasury,
        annualExports: def.targetAnnualExports,
        sustainChecks: def.sustainChecks ?? 3,
      });
    }
    if (this.tickCount % 40 === 0) {
      const d = this.derived ?? this.derivedSnapshot();
      const r = this.missionTracker.update({
        population: d.population,
        culture: d.culture,
        prosperity: d.prosperity,
        stability: d.stability,
        favor: d.favor,
        treasury: d.treasury,
        annualExports: d.annualExports,
      });
      if (r.won) this.mission.complete = true;
    }
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
    if (def.category === 'government') {
      const gov = GOV_BUILDINGS.find((g) => g.id === type);
      if (!this.replaying && gov && this.getPopulation() < govThreshold(gov.id)) {
        this.commandLog.push({ tick: this.tickCount, command: `place ${type}@${x},${y}`, result: 'not-unlocked' });
        return { ok: false, error: 'not-unlocked' };
      }
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
    this.constructionSpend += def.cost;

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
      building.house = { tier: 0, level: 1, satisfiedTicks: 0, unsatisfiedTicks: 0, mergeable: true, foodCooldown: 0, waterCooldown: 0, laborCooldown: 0, evolveCounter: 0, devolveCounter: 0 };
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

    // CAMPAIGN-01 (T-17-03): a startMission sub-effect (mission preplace) must
    // not self-record — the single {kind:'startMission'} command is the record.
    if (!this.suppressCommandRecording) {
      this.commandLog.push({ tick: this.tickCount, command: `place ${type}@${x},${y}`, result: 'ok' });
      this.saveCommands.push({ kind: 'place', type, x, y, god: building.god });
    }
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
          // CR-02: happiness weighting uses the house's EFFECTIVE population so
          // a merged block's combined residents weight happiness correctly.
          population: effectivePopulation(b),
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

  /**
   * Hold a festival (Phase 13, RELI-01): spend the tier cost now, prep over
   * `prepMonths` months, then a boost window raises every god's worship and
   * favor. Rejected commands leave state unchanged. One festival at a time —
   * a running plan or an active boost blocks a new one.
   */
  holdFestival(tierId: string): { ok: boolean; error?: string } {
    if (this.paused) {
      this.enqueue({ kind: 'holdFestival', tierId });
      return { ok: true };
    }
    const tier = FESTIVAL_TIERS.find((t) => t.id === tierId);
    if (!tier) return { ok: false, error: 'unknown-tier' };
    if (this.festivalPlan || this.festivalBoost) return { ok: false, error: 'festival-in-progress' };
    if (this.getTreasury() < tier.cost) return { ok: false, error: 'not-enough-money' };
    this.treasuryAccount.addExpense('festival', tier.cost);
    this.festivalPlan = startFestival(tier.id);
    this.commandLog.push({ tick: this.tickCount, command: `holdFestival ${tier.id}`, result: 'ok' });
    this.saveCommands.push({ kind: 'holdFestival', tierId });
    return { ok: true };
  }

  /** Festival status for the religion advisor: the tier in prep, the active
   *  boost tier, and its remaining ticks. Read-only. */
  getFestival(): { prepTier: string | null; boostTier: string | null; boostRemaining: number } {
    return {
      prepTier: this.festivalPlan?.tierId ?? null,
      boostTier: this.festivalBoost?.tierId ?? null,
      boostRemaining: this.festivalBoost?.remaining ?? 0,
    };
  }

  /** Whether a government building of the given id is placed and active. */
  private hasPlacedGov(id: string): boolean {
    return this.buildings.some((b) => b.type === id);
  }

  /**
   * Set the governor's salary level (0..4, Senate required). Replayable.
   * Paid monthly from the treasury while the Senate stands.
   */
  setGovernorSalaryLevel(level: number): { ok: boolean; error?: string } {
    if (this.paused) {
      this.enqueue({ kind: 'setGovernorSalaryLevel', level });
      return { ok: true };
    }
    if (!Number.isInteger(level) || level < 0 || level > GOVERNOR_SALARY_LEVELS.length - 1) {
      return { ok: false, error: 'unknown-level' };
    }
    if (!this.hasPlacedGov('senate')) return { ok: false, error: 'senate-required' };
    this.governor.salaryLevel = level;
    this.commandLog.push({ tick: this.tickCount, command: `setGovernorSalaryLevel ${level}`, result: 'ok' });
    this.saveCommands.push({ kind: 'setGovernorSalaryLevel', level });
    return { ok: true };
  }

  /**
   * Donate denarii to the governor: 1 denarius = 1 favor, capped per year
   * (Senate required). Replayable.
   */
  donateToGovernor(amount: number): { ok: boolean; granted?: number; error?: string } {
    if (this.paused) {
      this.enqueue({ kind: 'donateToGovernor', amount });
      return { ok: true };
    }
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'unknown-amount' };
    if (!this.hasPlacedGov('senate')) return { ok: false, error: 'senate-required' };
    if (this.governor.donationsThisYear >= CONFIG.governorDonationCap) return { ok: false, error: 'cap-reached' };
    const result = donate(this.governor, Math.floor(amount), {
      treasury: this.treasuryAccount.balance,
      favor: 0,
      yearlyCap: CONFIG.governorDonationCap,
    });
    if (!result.ok) return { ok: false, error: 'not-enough-money' };
    const granted = this.treasuryAccount.balance - result.treasury;
    this.treasuryAccount.addExpense('governor', granted);
    this.governorFavorBonus = Math.min(100, this.governorFavorBonus + result.favor);
    this.derived = null;
    this.commandLog.push({ tick: this.tickCount, command: `donateToGovernor ${amount}`, result: 'ok' });
    this.saveCommands.push({ kind: 'donateToGovernor', amount });
    return { ok: true, granted };
  }

  /** Governance view for the advisor: unlock state, placed buildings, live
   *  effects, and the governor's finances. Read-only. */
  getGovernance(): {
    unlocked: string[];
    placed: string[];
    effects: { requestsEnabled: boolean; salaryLevel: number; grandSendOffEnabled: boolean };
    governor: { salaryLevel: number; personalAccount: number; donationsThisYear: number };
  } {
    const pop = this.getPopulation();
    const unlocked = unlockedGov(pop).map((g) => g.id);
    const placed = GOV_BUILDINGS.map((g) => g.id).filter((id) => this.hasPlacedGov(id));
    return {
      unlocked,
      placed,
      effects: {
        requestsEnabled: this.hasPlacedGov('forum'),
        salaryLevel: this.governor.salaryLevel,
        grandSendOffEnabled: this.hasPlacedGov('palatine'),
      },
      governor: {
        salaryLevel: this.governor.salaryLevel,
        personalAccount: this.governor.personalAccount,
        donationsThisYear: this.governor.donationsThisYear,
      },
    };
  }

  /** Total residents across all houses. */
  getPopulation(): number {
    return this.getState().ratings.population;
  }

  // Requests (GOV-02) -------------------------------------------------------

  /** Request id reference (catalog id) for a given live request instance. */
  private requestDefOf(id: string): RequestDef | undefined {
    const catalogId = id.split('@')[0];
    return entryById(catalogId);
  }

  /** First storage host (stable building order) holding stock of `good`. */
  private requestSourceFor(good: string): BuildingInstance | null {
    for (const b of this.buildings) {
      if (!this.tradeStorageHosts(good).includes(b.type)) continue;
      if (((b.stock as Record<string, number | undefined>)[good] ?? 0) <= 0) continue;
      return b;
    }
    return null;
  }

  /** Month cadence: deterministically arrive new requests and settle active ones. */
  private tickRequests(): void {
    // Arrival: forum placed graces the forum's administration, at most 3 active.
    if (this.hasPlacedGov('forum') && this.requests.length < 3) {
      const placed = GOV_BUILDINGS.map((g) => g.id).filter((id) => this.hasPlacedGov(id));
      const picked = pickRequest(this.seed, this.tickCount, this.getPopulation(), placed);
      if (picked) {
        this.requests.push({
          id: `${picked.id}@${this.tickCount}`,
          requestId: picked.id,
          arrivalTick: this.tickCount,
          delivered: 0,
        });
      }
    }
    // Completion / expiry, checked on the same month cadence.
    const population = this.getPopulation();
    for (const req of [...this.requests]) {
      const def = this.requestDefOf(req.id);
      if (!def) { this.requests = this.requests.filter((r) => r !== req); continue; }
      const monthsElapsed = (this.tickCount - req.arrivalTick) / MONTH_TICKS;
      if (def.type === 'population') req.delivered = population;
      if (req.delivered >= def.amount) {
        this.treasuryAccount.addRevenue('other', def.reward);
        this.settleRequest(req, 'reward');
      } else if (monthsElapsed > def.deadlineMonths) {
        this.treasuryAccount.addExpense('other', def.penalty);
        this.settleRequest(req, 'penalty');
      }
    }
  }

  /** Move a settled request to the history ring (keeps at most 5). */
  private settleRequest(req: ActiveRequest, outcome: 'reward' | 'penalty'): void {
    this.requests = this.requests.filter((r) => r !== req);
    this.requestHistory.push({
      id: req.id,
      requestId: req.requestId,
      arrivalTick: req.arrivalTick,
      outcome,
      tick: this.tickCount,
    });
    if (this.requestHistory.length > 5) this.requestHistory = this.requestHistory.slice(-5);
  }

  /**
   * Deliver a quantity of a good toward an active goods request. Consumes the
   * stock of the first storage host that holds it (stable iteration). Replayable.
   */
  deliverGoods(requestId: string, good: string, qty: number): { ok: boolean; error?: string; delivered?: number } {
    if (this.paused) {
      this.enqueue({ kind: 'deliverGoods', requestId, good, qty });
      return { ok: true };
    }
    if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: 'unknown-amount' };
    const req = this.requests.find((r) => r.id === requestId);
    if (!req) return { ok: false, error: 'unknown-request' };
    const def = this.requestDefOf(requestId);
    if (!def || def.type !== 'goods' || def.good !== good) return { ok: false, error: 'wrong-good' };
    const source = this.requestSourceFor(good);
    if (!source) return { ok: false, error: 'no-stock' };
    const take = Math.min(qty, (source.stock as Record<string, number | undefined>)[good] ?? 0);
    if (take <= 0) return { ok: false, error: 'no-stock' };
    (source.stock as Record<string, number | undefined>)[good] = ((source.stock as Record<string, number | undefined>)[good] ?? 0) - take;
    req.delivered += take;
    this.commandLog.push({ tick: this.tickCount, command: `deliverGoods ${requestId} ${take}`, result: 'ok' });
    this.saveCommands.push({ kind: 'deliverGoods', requestId, good, qty: take });
    return { ok: true, delivered: req.delivered };
  }

  /**
   * Pay denarii toward an active denarii / grand send-off request. Treasury
   * funded only; deducts from the treasury and credits `delivered`. Replayable.
   */
  payRequest(requestId: string, amount: number): { ok: boolean; error?: string; delivered?: number } {
    if (this.paused) {
      this.enqueue({ kind: 'payRequest', requestId, amount });
      return { ok: true };
    }
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'unknown-amount' };
    const req = this.requests.find((r) => r.id === requestId);
    if (!req) return { ok: false, error: 'unknown-request' };
    const def = this.requestDefOf(requestId);
    if (!def || (def.type !== 'denarii' && def.type !== 'send_off')) return { ok: false, error: 'wrong-request-type' };
    const paid = Math.min(amount, this.treasuryAccount.balance);
    if (paid <= 0) return { ok: false, error: 'not-enough-money' };
    this.treasuryAccount.addExpense('other', paid);
    req.delivered += paid;
    if (req.delivered > def.amount) req.delivered = def.amount;
    this.commandLog.push({ tick: this.tickCount, command: `payRequest ${requestId} ${paid}`, result: 'ok' });
    this.saveCommands.push({ kind: 'payRequest', requestId, amount: paid });
    return { ok: true, delivered: req.delivered };
  }

  /** Live administrative requests (active + the last few settled), read-only. */
  getRequests(): {
    active: Array<{
      id: string; requestId: string; title: string; description: string; type: string;
      arrivalTick: number; amount: number; delivered: number;
      deadlineMonths: number; monthsLeft: number;
    }>;
    history: Array<{ requestId: string; title: string; outcome: 'reward' | 'penalty'; tick: number }>;
  } {
    return {
      active: this.requests.map((req) => {
        const def = this.requestDefOf(req.id);
        const monthsElapsed = (this.tickCount - req.arrivalTick) / MONTH_TICKS;
        return {
          id: req.id,
          requestId: req.requestId,
          title: def?.title ?? req.requestId,
          description: def?.description ?? '',
          type: def?.type ?? 'goods',
          arrivalTick: req.arrivalTick,
          amount: def?.amount ?? 0,
          delivered: def?.type === 'population' ? this.getPopulation() : req.delivered,
          deadlineMonths: def?.deadlineMonths ?? 0,
          monthsLeft: Math.max(0, (def?.deadlineMonths ?? 0) - Math.floor(monthsElapsed)),
        };
      }),
      history: this.requestHistory.map((h) => ({
        requestId: h.requestId,
        title: entryById(h.requestId)?.title ?? h.requestId,
        outcome: h.outcome,
        tick: h.tick,
      })),
    };
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

  /** Start a campaign mission. Replayable and recordable (CAMPAIGN-01): the
   *  whole effect reconstructs from the recorded {kind:'startMission'} command,
   *  so getMission()/getMissionProgress() survive save/load without any SaveData
   *  schema change.
   *
   *  - Start-year fix: `mission.year` is the CURRENT year (floor(tickCount/360)),
   *    so a time-limited mission started on an already-ticked runner counts its
   *    limit from mission start and does NOT instantly fail (RESEARCH Pitfall 1).
   *  - Sequential gate (LIVE calls only, skipped during replay — precedent: the
   *    government gate `!this.replaying && gov`, so a replayed startMission(N)
   *    is not blocked even though N-1's win only happens during the post-replay
   *    month-gate ticks): mission N+1 unlocks only when N is complete; a
   *    running/incomplete mission blocks a DIFFERENT id; a fresh runner may
   *    start ANY single mission (sandbox / winnability probe).
   *  - Per-mission sub-effects (treasury credit / starters / routes / time-limit
   *    override) are applied by 17-01-03 under a suppressCommandRecording guard
   *    so this ONE command is the complete deterministic record (T-17-03).
   */
  startMission(id: string, startingYear?: number): { ok: boolean; error?: string } {
    if (this.paused) {
      // WR-01: a paused-queued start must clear the same sequential unlock gate
      // and mission-id check as a direct start. The queue drains with
      // replaying=true, which would otherwise bypass the live-only gate; the
      // precedent is the Phase-15 respondEvent paused-path fix (validate before
      // enqueue). The start YEAR is authored now (tickCount cannot advance while
      // paused, so it equals the drain-tick year) and carried on the command.
      const unlock = this.missionUnlocked(id);
      if (!unlock.ok) return unlock;
      if (!(MISSIONS[id] ?? EXTRA_MISSIONS[id])) return { ok: false, error: 'unknown-mission' };
      this.enqueue({ kind: 'startMission', id, year: startingYear ?? Math.floor(this.tickCount / 360) });
      return { ok: true };
    }
    if (!this.replaying) {
      const unlock = this.missionUnlocked(id);
      if (!unlock.ok) return unlock;
    }
    const def = MISSIONS[id] ?? EXTRA_MISSIONS[id];
    if (!def) return { ok: false, error: 'unknown-mission' };
    // CR-01 start-year fix: mission.year is the TRUE start year (floor of the
    // start tickCount/360). The SaveCommand carries this year so a replayed
    // start — which fromSaveData runs at tick 0 — restores it verbatim instead
    // of recomputing 0, so a time-limited mission started on a long-run runner
    // never instantly-fails at the first month gate after save → load.
    const year = startingYear ?? Math.floor(this.tickCount / 360);
    this.mission = {
      id,
      started: true,
      complete: false,
      failed: false,
      year,
      objective: id,
    };
    this.missionTracker = null;
    this.commandLog.push({ tick: this.tickCount, command: `startMission ${id}`, result: 'ok' });
    // The single deterministic replay record for the whole mission start.
    // Pushed UNCONDITIONALLY — including on replay — so a replayed startMission
    // re-embeds its own record (CR-02: the standard SaveCommand pattern, cf.
    // placeBuilding/openTradeRoute). Without it, a save taken from a LOADED
    // runner drops the record and a later load finds no mission at all; with it,
    // a save → load → save cycle reproduces the command stream exactly once
    // (sub-effects stay suppressed by suppressCommandRecording on both paths).
    this.saveCommands.push({ kind: 'startMission', id, year });

    // Per-mission sub-effects (CAMPAIGN-01): treasury credit, policy override,
    // preplaced starter buildings, and routes are applied deterministically. All
    // sub-effect mutations run under suppressCommandRecording (ON BOTH the live
    // call AND replay) so they do NOT self-record — the one {kind:'startMission'}
    // command above is the complete deterministic record (T-17-03): a
    // save → load → save cycle never grows saveCommands. The terrain itself is
    // read-only (missionMaps Assumption A4): callers construct the runner with
    // `new SimRunner(seed, missionMap(def))` and load with
    // `SimRunner.fromSaveData(save, missionMap(def))`.
    this.suppressCommandRecording = true;
    // WR-04: collect every mandated sub-step failure (preplace / route / order)
    // instead of swallowing it — a partial start must NOT be reported as a clean
    // `{ ok: true }`. The mission and its record are still applied (deterministic
    // and replayable — replay reproduces exactly the same partial state), and the
    // return surfaces the failing causes so the caller/UI can react.
    const subErrors: string[] = [];
    try {
      if (def.modifiers) {
        const credit = def.modifiers.startingTreasuryCredit ?? def.startingDenarii;
        if (credit) this.treasuryAccount.addRevenue('other', credit);
        if (def.modifiers.startingPolicy) {
          const p = def.modifiers.startingPolicy;
          if (p.taxRate !== undefined) this.policy.taxRate = clamp01(p.taxRate);
          if (p.wageRate !== undefined) this.policy.wageRate = clamp01(p.wageRate);
        }
      }
      if (def.map?.preplace) {
        for (const p of def.map.preplace) {
          const res = this.placeBuilding(p.type as BuildingType, p.x, p.y, p.god !== undefined ? { god: p.god } : undefined);
          if (!res.ok) subErrors.push(`preplace ${p.type}@${p.x},${p.y}: ${res.error}`);
        }
      }
      if (def.routes) {
        for (const route of def.routes) {
          const op = this.openTradeRoute(route.cityId);
          if (!op.ok) subErrors.push(`route ${route.cityId}: ${op.error}`);
          if (route.good && route.order) {
            const ord = this.setTradeOrder(route.cityId, route.good, route.order);
            if (!ord.ok) subErrors.push(`order ${route.cityId}/${route.good}: ${ord.error}`);
            if (route.quota !== undefined) {
              const tr = this.tradeRoutes[route.cityId];
              if (tr) tr.perGoodQuota = { ...(tr.perGoodQuota ?? {}), [route.good]: route.quota };
            }
          }
        }
      }
    } finally {
      this.suppressCommandRecording = false;
    }
    return subErrors.length > 0
      ? { ok: false, error: subErrors.join('; ') }
      : { ok: true };
  }

  /** CAMPAIGN-01 progression gate (pure): whether `id` may be started on the
   *  LIVE runner. See startMission for the exact unlock semantics. */
  private missionUnlocked(id: string): { ok: boolean; error?: string } {
    const order = campaignMissions();
    if (!order.includes(id)) return { ok: false, error: 'unknown-mission' };
    if (!this.mission) return { ok: true }; // fresh runner / sandbox: any single mission
    if (this.mission.id === id) return { ok: true }; // same-id restart/no-op
    if (this.mission.complete) {
      const idx = order.indexOf(this.mission.id);
      if (idx >= 0 && order[idx + 1] === id) return { ok: true };
    }
    return { ok: false, error: 'locked' };
  }

  /** RATE-02: PURE read of the active mission's sustained tracker — mission.progress
   *  is never exposed through getObjectiveProgress because wiring the mission
   *  tracker into `this.objective` would double-update it on the month cadence
   *  (tickMissionSystem AND tickDerivedSystems), halving the sustain period. */
  getMissionProgress(): { won: boolean; progress: number; sustained: number; sustainChecks: number } | null {
    if (!this.missionTracker) return null;
    const o = this.missionTracker;
    const r = o.lastResult();
    return {
      won: r.won,
      progress: Math.min(1, r.sustained / o.sustainChecks),
      sustained: r.sustained,
      sustainChecks: o.sustainChecks,
    };
  }

  /** CAMPAIGN-01: the sequential campaign position, purely derived (never
   *  serialized). nextUnlocked = 'tutorial' on a fresh runner; the mission after
   *  the current one once it is complete; the current id while failed (retry) or
   *  in-progress (same-id no-op). */
  getCampaignProgress(): { current: MissionState | null; nextUnlocked: string | null } {
    if (!this.mission) return { current: null, nextUnlocked: 'tutorial' };
    if (this.mission.complete) {
      const order = campaignMissions();
      const idx = order.indexOf(this.mission.id);
      return { current: this.mission, nextUnlocked: idx >= 0 ? (order[idx + 1] ?? null) : null };
    }
    return { current: this.mission, nextUnlocked: this.mission.id };
  }
  getMission(): MissionState | null {
    return this.mission;
  }

  /** "Don't show again" tutorial preference (CAMPAIGN-02): a replayable
   *  SaveCommand whose dismissed set reconstructs from replayed commands — never
   *  serialized into SaveData. getTutorial() (17-02-01) reads the set. */
  dismissTutorialStep(step: string): { ok: boolean; error?: string } {
    if (!TUTORIAL_STEP_ORDER.includes(step as TutorialStepId)) {
      return { ok: false, error: 'unknown-step' };
    }
    this.commandLog.push({ tick: this.tickCount, command: `dismissTutorialStep ${step}`, result: 'ok' });
    this.dismissedTutorialSteps.add(step);
    // Pushed UNCONDITIONALLY (CR-02: standard SaveCommand pattern) so a replayed
    // dismissal re-embeds itself and a save taken from a LOADED runner keeps the
    // dismissal — otherwise a second round-trip would silently drop it.
    this.saveCommands.push({ kind: 'dismissTutorialStep', step });
    return { ok: true };
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
  /** RATE-02 (D-03): sustained ObjectiveTracker driving the active mission. */
  private missionTracker: ObjectiveTracker | null = null;
  /** CAMPAIGN-02: tutorial steps the player dismissed ("don't show again").
   *  Reconstructed purely from replayed {kind:'dismissTutorialStep'} commands —
   *  never a SaveData field, so getTutorial() is deterministic from state. */
  private dismissedTutorialSteps = new Set<string>();
  /** CAMPAIGN-01 (T-17-03): while true, state-mutating public methods
   *  (placeBuilding / openTradeRoute / setTradeOrder) apply their effect but do
   *  NOT record commandLog/saveCommands. startMission wraps its per-mission
   *  sub-effects (treasury credit / preplaced buildings / routes) with this flag
   *  ON BOTH the live call AND replay, so the single {kind:'startMission'}
   *  command is the complete deterministic record and a save → load → save cycle
   *  never duplicates records (command-bloat). */
  private suppressCommandRecording = false;
  private tradeRoutes: Record<string, TradeRoute> = {};
  private activeEvent: { id: string; remaining: number; total: number } | null = null;
  /** RATE-03: response choice recorded per event id (construct-init) so the
   *  lifecycle shapes the post-response effect deterministically even when the
   *  event re-fires during replay. */
  private readonly eventResponseByEvent: Record<string, string> = {};
  /** RATE-03 (CR-01/WR-04): event responses replayed at tick 0 whose effect
   *  must wait until their ORIGINAL application tick so the live derived-ratings
   *  effect window and the treasury ledger stay byte-identical to the run that
   *  was saved (see applyDueEventResponses). */
  private deferredEventResponses: { eventId: string; choiceId: string; applyTick: number }[] = [];
  /** RATE-03: active-event rating modifier (0s when no event is active). */
  private activeEventDelta = { culture: 0, prosperity: 0, stability: 0, favor: 0 };
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

  /**
   * UI-04 inspector seam: a thin read-only resolve of a building or walker id
   * returning its serialized snapshot (via the standard getState() path — the
   * golden-byte shape) PLUS its live internal instance for the enriched pure
   * *Inspection projections. Null for an unknown id. Never mutates and never
   * grows BuildingState/WalkerState.
   *
   * CR-01: building and walker ids come from two independent counters that
   * BOTH start at 1, so a walker whose numeric id equals a live building id is
   * indistinguishable by id alone. Callers that provably want a walker (the
   * hud-walker-inspect handler, navInspector walker cycling, renderWalkerInspector)
   * MUST pass `kind: 'walker'`; the default (undefined/'building') preserves the
   * original building-first resolution for every existing building caller.
   */
  getInspector(id: number, kind?: 'building' | 'walker'): {
    kind: 'building' | 'walker';
    snapshotId: number;
    building?: BuildingState;
    walker?: WalkerState;
    internals?: BuildingInstance | WalkerInstance;
  } | null {
    if (kind !== 'walker') {
      const b = this.buildingById.get(id);
      if (b) {
        return {
          kind: 'building',
          snapshotId: id,
          building: this.getState().buildings.find((x) => x.id === id),
          internals: b,
        };
      }
    }
    const w = this.walkers.find((walk) => walk.id === id);
    if (w) {
      return {
        kind: 'walker',
        snapshotId: id,
        walker: this.getState().walkers.find((x) => x.id === id),
        internals: w,
      };
    }
    return null;
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
   *
   * `map` is optional: pass the SAME map the original run was constructed with
   * to round-trip a custom-map city. A seed-generated original (no map) needs
   * no map — fromSaveData regenerates the identical seed map.
   */
  static fromSaveData(save: SaveData, map?: SimMap): SimRunner {
    // Reconstruct through the no-map path so map generation and the sim body
    // share the same RNG stream, exactly as the original run did.
    const runner = new SimRunner(save.seed, map, save.mapSize);
    runner.replaying = true;
    for (const c of save.commands) applyCommand(runner, c);
    runner.replaying = false;
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
   * POP-03: assign workers from the reachable pool to labor-connected buildings
   * by sector priority 1..5 (LABOR_SECTOR_PRIORITY) — replacing the legacy
   * greedy placement-order loop. Pinned sectors get a RUNNER-LEVEL reserve
   * (their prior staffing is set aside before the general pool split — the weak
   * pure-function pinned branch of allocateWorkers is NOT relied on, Pitfall 2)
   * and then participate in the general pass, so pinning is a guaranteed floor,
   * never an upper cap (WR-01); paused sectors report needed=0 and their
   * workers spill to other sectors.
   * Every labor.test.ts invariant is preserved: assigned ≤ pool, per-building
   * assigned ≤ required, surplus pool fills all jobs (activation via setActive
   * exactly as before). Deterministic — placement order, no RNG/wall-clock.
   */
  private tickLabor(): void {
    // Buildings that lost labor connectivity release their workers.
    for (const b of this.buildings) {
      if (b.workersRequired <= 0) continue;
      if (!b.laborConnected) {
        b.workersAssigned = 0;
        this.setActive(b, false);
      }
    }
    const pool = workerPool(this.buildings);
    const sectors = buildLaborSectors(this.buildings, this.laborSectorCfg);

    // 1) Reserve-guard (Pitfall 2): a pinned sector keeps its prior assigned
    //    (bounded by its needed and the remaining pool) — set aside BEFORE the
    //    general pool split. The pure-function pinned branch of allocateWorkers
    //    is NOT relied upon: it would staff a pinned sector up to needed on a
    //    growing pool, while the runner reserve must preserve prior staffing
    //    (the per-sector tracking the pure branch has no access to).
    const ordered = [...sectors].sort((a, b) => a.priority - b.priority);
    let remaining = pool;
    for (const s of ordered) {
      if (!s.pinned) continue;
      const prior = this.laborSectorAssigned.get(s.id) ?? 0;
      const give = Math.min(s.needed, prior, remaining);
      s.assigned = give;
      remaining -= give;
    }
    // 2) Allocate the leftover over the priority ordering — pinned sectors
    //    INCLUDED (WR-01): a pinned sector is a guaranteed floor, not an upper
    //    cap, so one pinned while unstaffed regains workers once the pool grows
    //    ("surplus fills all" holds for it too), while its reserve is never
    //    reduced because the pass only adds to each sector's remaining demand.
    for (const s of ordered) {
      if (remaining <= 0) break;
      if (s.assigned >= s.needed) continue;
      const assign = Math.min(s.needed - s.assigned, remaining);
      s.assigned += assign;
      remaining -= assign;
    }

    // 3) Distribute to buildings (per-building caps respected) + activate.
    applySectorAssignments(this.buildings, sectors);
    for (const b of this.buildings) {
      if (b.workersRequired <= 0) continue;
      if (!b.laborConnected) continue;
      this.setActive(b, b.workersAssigned >= b.workersRequired);
    }
    // 4) Track per-sector staffing for the next tick's pinned reserve floor.
    for (const s of sectors) this.laborSectorAssigned.set(s.id, s.assigned);
  }

  /** POP-03: read-only per-sector labor view (pinned/paused from the private
   *  store, needed live from buildLaborSectors, assigned from the last tickLabor
   *  run's per-sector tracking — a freshly built sector row starts at assigned 0
   *  until the next tickLabor). Never fabricates — advisors/UI consume only this
   *  getter, mirroring marketConfig. */
  getLaborSectors(): Array<{ id: string; priority: number; needed: number; assigned: number; pinned: boolean; paused: boolean }> {
    const sectors = buildLaborSectors(this.buildings, this.laborSectorCfg);
    return sectors.map((s) => ({
      id: s.id,
      priority: s.priority,
      needed: s.needed,
      assigned: this.laborSectorAssigned.get(s.id) ?? 0,
      pinned: s.pinned,
      paused: this.laborSectorCfg.get(s.id)?.paused === true,
    }));
  }

  /** POP-03: pin/pause/restore-auto a labor sector (replayable SaveCommand).
   *  Unknown sector ids and non-boolean flags are rejected with {ok:false}
   *  (never a raw throw — ASVS V5; the saveCodec validateCommand case guards
   *  the replayed stream before fromSaveData). While paused the command
   *  enqueues and applies on the resume tick (paused-enqueue precedent).
   *  Live+replay merge the new flags into the per-sector store — a call with
   *  only one flag preserves the other — and record via the push-on-accept
   *  pattern (commandLog + saveCommands, respecting suppressCommandRecording).
   *  Internal-only: sector config reconstructs on load by replaying the
   *  command, never a SaveData schema field. */
  setLaborSectorState(sector: string, opts: { pinned?: boolean; paused?: boolean }): { ok: boolean; error?: string } {
    if (!SECTOR_IDS.includes(sector)) {
      return { ok: false, error: 'unknown-sector' };
    }
    if (opts.pinned !== undefined && typeof opts.pinned !== 'boolean') {
      return { ok: false, error: 'invalid-config' };
    }
    if (opts.paused !== undefined && typeof opts.paused !== 'boolean') {
      return { ok: false, error: 'invalid-config' };
    }
    if (this.paused && !this.replaying) {
      this.enqueue({ kind: 'setLaborSectorState', sector, pinned: opts.pinned, paused: opts.paused });
      return { ok: true };
    }
    const current = this.laborSectorCfg.get(sector) ?? { pinned: false, paused: false };
    const merged = {
      pinned: opts.pinned !== undefined ? opts.pinned : current.pinned,
      paused: opts.paused !== undefined ? opts.paused : current.paused,
    };
    this.laborSectorCfg.set(sector, merged);
    if (!this.suppressCommandRecording) {
      this.commandLog.push({
        tick: this.tickCount,
        command: `setLaborSectorState ${sector}${
          opts.pinned !== undefined ? ` pinned=${opts.pinned}` : ''
        }${opts.paused !== undefined ? ` paused=${opts.paused}` : ''}`,
        result: 'ok',
      });
      this.saveCommands.push({ kind: 'setLaborSectorState', sector, pinned: opts.pinned, paused: opts.paused });
    }
    return { ok: true };
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
    this.governor.donationsThisYear = 0;
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
            const lvl = b.house!.level ?? 0;
            const h: NonNullable<BuildingState['house']> = {
              tier: b.house!.tier,
              tierName: HOUSE_TIERS[b.house!.tier].name,
              level: lvl,
              levelName: housingLevelName(lvl),
              // CR-02: the serialized capacity reflects the merged combined
              // population (a 2x2 of two level-11 houses shows 480, not 240).
              populationCapacity: effectivePopulation(b),
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
    runner.placeBuilding(cmd.type, cmd.x, cmd.y, cmd.god !== undefined ? { god: cmd.god } : undefined);
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
  } else if (cmd.kind === 'holdFestival') {
    runner.holdFestival(cmd.tierId);
  } else if (cmd.kind === 'setGovernorSalaryLevel') {
    runner.setGovernorSalaryLevel(cmd.level);
  } else if (cmd.kind === 'donateToGovernor') {
    runner.donateToGovernor(cmd.amount);
  } else if (cmd.kind === 'deliverGoods') {
    runner.deliverGoods(cmd.requestId, cmd.good, cmd.qty);
  } else if (cmd.kind === 'payRequest') {
    runner.payRequest(cmd.requestId, cmd.amount);
  } else if (cmd.kind === 'openTradeRoute') {
    runner.openTradeRoute(cmd.cityId);
  } else if (cmd.kind === 'setTradeOrder') {
    runner.setTradeOrder(cmd.cityId, cmd.good, cmd.mode, { reserve: cmd.reserve, target: cmd.target });
  } else if (cmd.kind === 'respondEvent') {
    runner.respondEvent(cmd.eventId, cmd.choiceId, cmd.tick);
  } else if (cmd.kind === 'startMission') {
    runner.startMission(cmd.id, cmd.year);
  } else if (cmd.kind === 'dismissTutorialStep') {
    runner.dismissTutorialStep(cmd.step);
  } else if (cmd.kind === 'setLaborSectorState') {
    runner.setLaborSectorState(cmd.sector, cmd);
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
