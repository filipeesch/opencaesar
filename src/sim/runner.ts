/**
 * SimRunner — the single public interface to the simulation.
 *
 * Deterministic: all randomness flows through the seeded RNG injected at
 * construction. Same seed + same map + same command sequence → identical
 * state after N ticks (see determinism tests).
 *
 * API: tick(), getState(), placeBuilding(type, x, y), setPolicy(tax, wage),
 * getCommandLog(). getState() returns plain serializable data.
 */

import { pickEvent, applyEvent, eventDuration, eventSustainMsg, eventFinalMsg } from './events';
import { EVENTS } from '../../data/events';
import { BUILDINGS } from './buildings';
import { CONFIG, HOUSE_TIERS } from './config';
import { assignedWorkers, computeRatings, tickEconomy, totalJobs, workerPool } from './economy';
import { cityHappiness, houseHappiness } from './happiness';
import { computeTargets, tickRatings } from './ratings';
import { tickTrade } from './trade';
import { tickMission } from './missions';
import { computeServiceCoverage } from './services';
import { computeRisks } from './safety';
import { taxCollected } from './taxation';
import { unlockedGov } from './governance';
import { ObjectiveTracker } from './objectives';
import { WaterSystem } from './water';
import { buildCodex } from './campaign';
import { desirabilityOf, tickHousing } from './housing';
import { Map as SimMap } from './map';
import { checkPlacement } from './placement';
import type { Rng } from './rng';
import { mulberry32 } from './rng';
import type {
  BuildingState,
  BuildingType,
  CommandLogEntry,
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
} from './types';
import type { BuildingInstance, WalkerInstance } from './walkers';
import { createWalker, updateWalker } from './walkers';

type PendingCommand =
  | { kind: 'place'; type: BuildingType; x: number; y: number }
  | { kind: 'policy'; taxRate: number; wageRate: number };

/** Live-derived metrics from the running sim, exposed to advisors/UI (WARNING 1). */
export interface DerivedSnapshot {
  population: number;
  culture: number;
  prosperity: number;
  stability: number;
  favor: number;
  employment: { jobs: number; employed: number };
  services: { health: number; literacy: number; entertainment: number; religion: number };
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
  private treasury: number;
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
  /** Ordered list of state-changing commands, used to reconstruct a deterministic save. */
  private saveCommands: SaveCommand[] = [];
  private lowFoodWarnCooldown = 0;
  private paused = false;
  private pendingCommands: PendingCommand[] = [];
  private derived: DerivedSnapshot | null = null;
  private objective: ObjectiveTracker | null = null;

  constructor(seed: number, map?: SimMap, mapSize?: number) {
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
    this.treasury = CONFIG.startingTreasury;
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
    for (const cmd of batch) {
      if (cmd.kind === 'place') this.placeBuilding(cmd.type, cmd.x, cmd.y);
      else this.setPolicy(cmd.taxRate, cmd.wageRate);
    }
  }

  private enqueue(cmd: PendingCommand): void {
    this.pendingCommands.push(cmd);
  }

  tick(): void {
    this.drainPendingCommands();
    this.tickCount += 1;
    this.tickSpawns();
    this.tickLabor();
    this.tickFood();
    this.tickEconomyInternal();
    tickHousing(this.map, this.buildings, this.policy, this.lastWagesUnpaid > 0, (type, text) =>
      this.emitMessage(type, text),
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

    // Remaining systems read live sim state into a derived snapshot (WARNING 1 fix).
    this.tickDerivedSystems();
  }

  private tickDerivedSystems(): void {
    const snapshot = this.derivedSnapshot();
    this.derived = snapshot;
    if (this.objective) {
      this.objective.update({ population: snapshot.population, culture: snapshot.culture, prosperity: snapshot.prosperity, stability: snapshot.stability });
    }
  }

  private tickTradeSystem(): void {
    const stock: Record<string, number> = { wheat: 0 };
    for (const b of this.buildings) {
      if ((b.type === 'granary' || b.type === 'farm') && b.stock) {
        stock.wheat = (stock.wheat ?? 0) + (b.stock.wheat ?? 0);
      }
    }
    const year = Math.floor(this.tickCount / 360);
    const result = tickTrade(this.treasury, stock, this.tradeRoutes as never, year);
    this.treasury = result.treasury;
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

  private derivedSnapshot(): DerivedSnapshot {
    const population = this.getPopulation();
    const employment = this.getEmployment();
    const has = (cat: string) => this.buildings.some((b) => BUILDINGS[b.type].category === cat);
    const targets = computeTargets({
      population, treasury: this.getTreasury(), taxRate: this.policy.taxRate,
      hasReligion: has('religion'), hasEntertainment: has('entertainment'), hasEducation: has('education'),
      hasHealth: has('health'), hasWater: has('water'), hasFood: has('food'),
    });
    const serviceCoverage = computeServiceCoverage({
      doctorCoverage: this.buildings.some((b) => b.type === 'well') ? 0.5 : 0,
      educationCoverage: 0, entertainmentCoverage: 0, godWorship: {},
    });
    const water = new WaterSystem();
    const well = this.buildings.find((b) => b.type === 'well');
    water.setSources(well ? [{ x: well.x, y: well.y, kind: 'well', active: true, radius: 2 }] : []);
    const grid = water.compute(this.width, this.height, () => 0);
    let coveredTiles = 0;
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) if (grid[y][x].coveredByWell) coveredTiles++;

    let fireRisk = 0; let collapseRisk = 0; let crime = 0;
    for (const b of this.buildings) {
      const r = computeRisks({ density: b.type === 'house' ? 0.8 : 0.4, ageMonths: this.tickCount / 40, fireCoverage: 0, engineerCoverage: 0, securityCoverage: 0 });
      fireRisk = Math.max(fireRisk, r.fireRisk); collapseRisk = Math.max(collapseRisk, r.collapseRisk); crime = Math.max(crime, r.crime);
    }
    const taxes = taxCollected(population, 2, this.policy.taxRate, 1);
    const wages = employment.employed * CONFIG.wagePerWorkerPerTick * this.policy.wageRate;
    const codex = buildCodex();
    return {
      population, culture: targets.culture, prosperity: targets.prosperity, stability: targets.stability, favor: targets.favor,
      employment: { jobs: employment.totalJobs, employed: employment.employed },
      services: serviceCoverage,
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

  /** Place a building at footprint anchor (x, y). Rejected commands leave state unchanged. */
  placeBuilding(type: BuildingType, x: number, y: number): PlacementResult {
    if (this.paused) {
      this.enqueue({ kind: 'place', type, x, y });
      return { ok: true };
    }
    const result = checkPlacement(
      this.map,
      (tx, ty) => this.occupiedTiles.has(this.tileKey(tx, ty)),
      this.treasury,
      type,
      x,
      y,
    );
    if (!result.ok) {
      this.commandLog.push({ tick: this.tickCount, command: `place ${type}@${x},${y}`, result: result.error });
      return result;
    }

    const def = BUILDINGS[type];
    this.treasury -= def.cost;

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

    this.buildings.push(building);
    this.buildingById.set(id, building);
    for (let dy = 0; dy < def.footprint; dy++) {
      for (let dx = 0; dx < def.footprint; dx++) {
        this.occupiedTiles.set(this.tileKey(x + dx, y + dy), id);
      }
    }

    this.commandLog.push({ tick: this.tickCount, command: `place ${type}@${x},${y}`, result: 'ok' });
    this.saveCommands.push({ kind: 'place', type, x, y });
    return { ok: true };
  }

  /** Non-mutating placement check (used by the renderer ghost preview). */
  canPlace(type: BuildingType, x: number, y: number): PlacementResult {
    return checkPlacement(
      this.map,
      (tx, ty) => this.occupiedTiles.has(this.tileKey(tx, ty)),
      this.treasury,
      type,
      x,
      y,
    );
  }

  /** Set the tax and wage rates (each clamped to 0..1). */
  setPolicy(taxRate: number, wageRate: number): Policy {
    if (this.paused) {
      this.enqueue({ kind: 'policy', taxRate: clamp01(taxRate), wageRate: clamp01(wageRate) });
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
      treasury: this.treasury,
      policy: { ...this.policy },
      ratings: computeRatings(this.buildings, this.treasury, happiness),
      totalWorkers: workerPool(this.buildings),
      assignedWorkers: assignedWorkers(this.buildings),
      totalJobs: totalJobs(this.buildings),
      messages: [...this.messages],
      lastTickWagesUnpaid: this.lastWagesUnpaid > 0,
    };
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
      desirability: desirabilityOf(this.map, b.x, b.y, this.policy, this.lastWagesUnpaid > 0, services),
      wagesUnpaid: this.lastWagesUnpaid > 0,
    };
  }

  /** Stable JSON rendering of the snapshot (used by determinism and golden tests). */
  getStateJson(): string {
    return JSON.stringify(this.getState());
  }

  /** Every accepted and rejected command since construction, in order. */
  getCommandLog(): CommandLogEntry[] {
    return [...this.commandLog];
  }

  /** Serializable payload that captures this sim for deterministic resume. */
  getSaveData(): SaveData {
    return {
      version: 1,
      seed: this.seed,
      mapSize: this.mapSize,
      commands: [...this.saveCommands],
      tickCount: this.tickCount,
      savedAt: Date.now(),
    };
  }

  /**
   * Reconstruct a sim from a save by replaying its command sequence, then
   * ticking to the saved tick count. Because the sim is deterministic, the
   * resulting state equals the original run at save time.
   */
  static fromSaveData(save: SaveData): SimRunner {
    // Reconstruct through the no-map path so map generation and the sim body
    // share the same RNG stream, exactly as the original run did.
    const runner = new SimRunner(save.seed, undefined, save.mapSize);
    for (const c of save.commands) {
      if (c.kind === 'place') {
        runner.placeBuilding(c.type, c.x, c.y);
      } else {
        runner.setPolicy(c.taxRate, c.wageRate);
      }
    }
    while (runner.tickCount < save.tickCount) runner.tick();
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

      const start = this.adjacentRoadTile(b);
      if (!start) continue;

      const walkerType = b.type === 'house' ? 'labor' : b.type === 'market' ? 'market' : 'well';
      const w = createWalker(walkerType, start.x, start.y, this.nextWalkerId++);
      this.walkers.push(w);
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
      if (b.type !== 'farm' || !b.active) continue;
      const stock = b.stock.wheat ?? 0;
      if (stock < CONFIG.farmStorageCapacity) {
        b.stock.wheat = Math.min(CONFIG.farmStorageCapacity, stock + CONFIG.farmProductionPerTick);
      }
    }

    for (const farm of this.buildings) {
      if (farm.type !== 'farm') continue;
      const stock = farm.stock.wheat ?? 0;
      if (stock <= 0) continue;
      const granary = this.findTouchingGranary(farm);
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

  /** Collect taxes, pay wages (treasury never goes below zero). */
  private tickEconomyInternal(): void {
    const { treasury, result } = tickEconomy(this.buildings, this.policy, this.treasury);
    this.treasury = treasury;
    this.lastWagesUnpaid = result.wagesUnpaid;
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

  private adjacentRoadTile(b: BuildingInstance): Vec2 | null {
    const n = b.footprint;
    for (let i = 0; i < n; i++) {
      if (this.map.get(b.x + i, b.y - 1) === 'road') return { x: b.x + i, y: b.y - 1 };
      if (this.map.get(b.x + i, b.y + n) === 'road') return { x: b.x + i, y: b.y + n };
      if (this.map.get(b.x - 1, b.y + i) === 'road') return { x: b.x - 1, y: b.y + i };
      if (this.map.get(b.x + n, b.y + i) === 'road') return { x: b.x + n, y: b.y + i };
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
          return {
            tier: b.house!.tier,
            tierName: HOUSE_TIERS[b.house!.tier].name,
            populationCapacity: HOUSE_TIERS[b.house!.tier].population,
            foodCooldown: b.house!.foodCooldown,
            waterCooldown: b.house!.waterCooldown,
            laborCooldown: b.house!.laborCooldown,
            desirability: input.desirability,
            happiness: houseHappiness(input),
          };
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
    };
  }

  private tileKey(x: number, y: number): number {
    // 20 bits each — ample for maps up to 1024x1024 (same scheme as pathfind).
    return (x << 20) | y;
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
