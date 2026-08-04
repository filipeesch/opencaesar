/**
 * Walker lifecycle: road movement, service coverage, objective handling, and
 * despawn. Pure functions over the SimInternals contract — no Phaser, and all
 * randomness flows through the injected seeded RNG.
 *
 * Coverage model: each tick, a walker's service is applied to houses on tiles
 * orthogonally adjacent to the tile it currently occupies. Services carry a
 * cooldown and must be re-supplied (see runner for cooldown decay).
 */

import { CONFIG } from './config';
import type { Map } from './map';
import { findRoadPath, roadNeighbors } from './pathfind';
import type { Rng } from './rng';
import { randInt } from './rng';
import { roadSpeedMultiplier } from './roadTypes';
import type { BuildingType, Good, Vec2, WalkerType } from './types';
import type { FirePhase } from './safety';
import type { WalkerProfile } from './walkerProfiles';
import { walkerProfile, mayTraverse } from './walkerProfiles';
import {
  MARKET_FOOD_CAPS, SELLER_CAPACITY, marketAgents, nextFoodToFetch, pickGranary,
  sellerLoadComposition, recordMarketVisit, marketNeedsRestock,
} from './logistics';
import type { GranaryCandidate, MarketCoverage, MarketFoodState, MarketConfig } from './logistics';
import type { ProductionState } from './production';

export interface WalkerInstance {
  id: number;
  type: WalkerType;
  /** Tile the walker is currently crossing (its departure tile). */
  x: number;
  y: number;
  /** Tile being walked toward, or null while standing on `next`/idle. */
  next: Vec2 | null;
  /** Fraction 0..1 of the way from (x, y) to `next`. */
  progress: number;
  /** 'seeking' = following a planned path; 'wandering' = RNG choice at junctions. */
  state: 'seeking' | 'wandering';
  /** Remaining ticks before the walker despawns. */
  lifetime: number;
  /** Remaining tiles to traverse (current tile excluded, goal tile included). */
  path: Vec2[];
  /** Building id the walker intends to reach, or null. */
  targetBuildingId: number | null;
  carryingGood: Good | null;
  carriedAmount: number;
  /** Tile the walker was spawned on; used by return-policy wandering. */
  origin: Vec2 | null;
  /** Road tiles walked since leaving `origin` (0 when back at it). */
  stepsTaken: number;
  /** Market building a buyer/seller belongs to (deposit/reload/coverage target). */
  marketId?: number;
  /** God a temple/grand_temple walker worships (per-god coverage, Phase 13). */
  god?: string;
  /** Buyer: granary whose stock the in-trip units were reserved from (restored on failure). */
  reservedGranaryId?: number;
  /** Seller: the multi-food load currently being carried to houses (units per food). */
  carryingLoad?: Record<string, number>;
  /** Trade transport (caravan/ship) payload (TRAD-03, additive). Drives the
   *  physical load/unload between a source storage and a destination. */
  trade?: TradeCarrierPayload;
}

/** Physical trade-transport trip (TRAD-03). `loaded` flips once the walker has
 *  its cargo: exports load at the source storage and leave the region (dest null
 *  in the runner); imports arrive already carrying and deposit at the dest. */
export interface TradeCarrierPayload {
  good: string;
  /** Maximum loads the merchant was dispatched to move. */
  amount: number;
  isExport: boolean;
  /** Load ceiling (CARAVAN_CAPACITY 8 / SHIP_CAPACITY 16). */
  capacity: number;
  /** Sea transport (berth/wharf rules via transport.ts). */
  ship?: boolean;
  /** Storage the export load is collected from / an import would return to. */
  sourceBuildingId?: number | null;
  /** Storage an import is deposited into (or an export's destination in tests). */
  destBuildingId?: number | null;
  /** Ticks the merchant has been waiting for a road/berth (§19.3). */
  waitTicks: number;
  /** True once the walker holds its cargo. */
  loaded: boolean;
}

/** House-only simulation state (undefined on non-house buildings). */
export interface HouseInstance {
  tier: number;
  foodCooldown: number;
  waterCooldown: number;
  laborCooldown: number;
  evolveCounter: number;
  devolveCounter: number;
  /** Service access delivered by walkers (health/literacy/religion/entertainment). */
  services?: Partial<Record<string, number>>;
  /** Per-god temple access: fresh walker TTL per god (worship driver, Phase 13).
   *  Internal only — never serialized to BuildingState, so goldens/SimState
   *  stay byte-identical. */
  godAccess?: Record<string, number>;
  /** Per-food physical units a house has received from sellers (live food state, §13). */
  foodInventory?: Record<string, number>;
  /** Per-house market coverage bookkeeping (§12.13). */
  marketCoverage?: MarketCoverage;
  /** Civic wellness (Phase 12): health/literacy/entertainment 0..100 stats
   *  driven by walker-delivered service access. Internal only — never
   *  serialized, so goldens/SimState stay byte-identical. */
  civic?: HouseCivicState;
}

/** Civic wellness per house (Phase 12). Internal to the sim run. */
export interface HouseCivicState {
  /** 0..100, rises while health service access is fresh, decays otherwise. */
  health: number;
  /** 0..100, rises while literacy service access is fresh (school/library). */
  literacy: number;
  /** 0..100, rises while entertainment access is fresh (theatre/amphitheatre). */
  entertainment: number;
}

const SERVICE_BY_WALKER: Record<string, string> = {
  clinic: 'health',
  hospital: 'health',
  school: 'literacy',
  library: 'literacy',
  temple: 'religion',
  theatre: 'entertainment',
  amphitheatre: 'entertainment',
  colosseum: 'entertainment',
};

export interface BuildingInstance {
  id: number;
  type: BuildingType;
  /** Footprint anchor (top-left tile). */
  x: number;
  y: number;
  footprint: number;
  workersAssigned: number;
  workersRequired: number;
  active: boolean;
  laborConnected: boolean;
  laborCooldown: number;
  /** Countdown to the next service-walker spawn, if the building spawns any. */
  spawnCooldown: number;
  stock: Partial<Record<Good, number>>;
  house?: HouseInstance;
  /** Internal production/workshop state (extraction sites, workshops). Not
   *  serialized to BuildingState — kept internal so goldens/SimState are
   *  unaffected. */
  production?: ProductionState;
  /** Units produced by this building on the last tick (advisor). */
  lastProduced?: number;
  /** Building id a porter moved the last load to, or null (advisor). */
  lastDestinationId?: string | null;
  /** Kind of the last porter destination ('workshop' | 'warehouse'), or null. */
  lastDestinationKind?: 'workshop' | 'warehouse' | null;
  /** Civil-safety state (fire lifecycle, structural danger, crime). Internal
   *  only — never serialized to BuildingState, so goldens/SimState stay
   *  byte-identical. Consumed by the derived risk overlay and advisors. */
  safety?: BuildingSafetyState;
  /** God this temple/grand_temple worships (Phase 13, per-god coverage). */
  god?: string;
}

/** Civil-safety per-building state (Phase 11). Internal to the sim run. */
export interface BuildingSafetyState {
  /** Fire lifecycle phase (none → burning → evacuating → destroyed). */
  fire: FirePhase;
  /** Structurally unsafe (collapse risk high / fire-destroyed) until repaired. */
  danger: boolean;
  /** Live collapse risk 0..1 (for the risk overlay). */
  collapseRisk: number;
  /** Live crime level 0..1 (patrols lower it). */
  crime: number;
  /** Ticks a doused building stays immune to re-ignition (firemen response). */
  dousedTicks: number;
}

/**
 * The slice of SimRunner state walkers may touch. Walkers never mutate the map
 * or the building registry — only building service fields and themselves.
 */
export interface SimInternals {
  map: Map;
  rng: Rng;
  /** All buildings in placement order (stable iteration for deterministic tie-breaks). */
  buildings: BuildingInstance[];
  buildingById: (id: number) => BuildingInstance | null;
  buildingAt: (x: number, y: number) => BuildingInstance | null;
  /** Nearest road tile adjacent to a building footprint, or null. */
  adjacentRoadTile: (b: BuildingInstance) => Vec2 | null;
  despawn: (w: WalkerInstance) => void;
  /** Current sim tick (optional; used to timestamp market-visit coverage). */
  tick?: number;
  /** Live walker list (optional; used to count units already in transit toward a
   *  market so an explicitly-configured target stock accounts for them). */
  walkers?: readonly WalkerInstance[];
  /** Per-market config lookup (MARK-02, decision 4): returns the explicitly-set
   *  config for a market, or undefined when unconfigured (legacy path). */
  marketConfig?: (id: number) => MarketConfig | undefined;
  /** TRAD-03 additive: regional trade entry tile resolver. */
  tradeEntry?: () => Vec2 | null;
  /** TRAD-03 additive: free storage room for a good at a building id. */
  tradeStorageRoom?: (good: string, buildingId: number) => number;
  /** Civil-safety hooks (Phase 11): the runner owns state mutation; walkers
   *  trigger it when serving a nearby building. All optional — additive. */
  extinguishFire?: (buildingId: number) => void;
  repairBuilding?: (buildingId: number) => void;
  patrolCrime?: (buildingId: number) => void;
}

const DIRS: readonly Vec2[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** Create a walker standing on a road tile, idle until its first decide. */
export function createWalker(type: WalkerType, x: number, y: number, id: number): WalkerInstance {
  return {
    id,
    type,
    x,
    y,
    next: null,
    progress: 0,
    state: 'wandering',
    lifetime: CONFIG.walkerLifetimeTicks,
    path: [],
    targetBuildingId: null,
    carryingGood: null,
    carriedAmount: 0,
    origin: { x, y },
    stepsTaken: 0,
  };
}

/** Advance a walker by one tick. May despawn it (via sim.despawn). */
export function updateWalker(sim: SimInternals, w: WalkerInstance): void {
  w.lifetime -= 1;
  if (w.lifetime <= 0) {
    // A buyer/seller that never completed returns its held stock (never lose
    // product — WR-02), then despawns.
    releaseWalkerLoad(sim, w);
    sim.despawn(w);
    return;
  }

  const profile = walkerProfile(w.type);

  // Coverage first: houses next to the walker receive its service flag.
  applyCoverage(sim, w, profile);

  // Arrival at the objective: apply its effect, possibly despawn.
  if (w.state === 'seeking' && w.targetBuildingId !== null && w.path.length === 0) {
    const keepGoing = handleArrival(sim, w, profile);
    if (!keepGoing) return;
    w.state = 'wandering';
    w.targetBuildingId = null;
  }

  if (w.state === 'wandering') decide(sim, w, profile);

  move(sim, w, profile);
}

/** Apply the walker's service to houses adjacent to its current tile. */
function applyCoverage(sim: SimInternals, w: WalkerInstance, profile: WalkerProfile): void {
  if (w.type === 'well') {
    serviceHousesAround(sim, w, 'water', profile);
  } else if (w.type === 'seller' && w.carryingLoad) {
    deliverToAdjacentHouses(sim, w, profile);
  } else if (w.type === 'market' && w.carryingGood === 'wheat' && w.carriedAmount > 0) {
    serviceHousesAround(sim, w, 'food', profile);
  } else if (w.type === 'fireman') {
    // Fireman extinguishes burning buildings it walks past.
    for (const d of DIRS) {
      const b = sim.buildingAt(w.x + d.x, w.y + d.y);
      if (!b || !b.safety || b.safety.fire === 'none') continue;
      if (b.safety.fire !== 'destroyed') sim.extinguishFire?.(b.id);
    }
  } else if (w.type === 'engineer') {
    // Engineer repairs buildings marked structurally dangerous.
    for (const d of DIRS) {
      const b = sim.buildingAt(w.x + d.x, w.y + d.y);
      if (b?.safety?.danger) sim.repairBuilding?.(b.id);
    }
  } else if (w.type === 'marshal') {
    // Marshal patrols: calms crime near buildings it passes (peaceful).
    for (const d of DIRS) {
      const b = sim.buildingAt(w.x + d.x, w.y + d.y);
      if (b?.safety) sim.patrolCrime?.(b.id);
    }
  } else if (w.god) {
    // Temple/grand_temple walker: per-god worship access (Phase 13) plus the
    // legacy generic religion flag so advisor religion coverage stays.
    serviceGodAround(sim, w, w.god, profile);
    serviceHousesAround(sim, w, 'religion', profile);
  } else if (SERVICE_BY_WALKER[w.type]) {
    serviceHousesAround(sim, w, SERVICE_BY_WALKER[w.type], profile);
  }
}

/** Per-god temple access (Phase 13): fresh TTL per god on adjacent houses. */
function serviceGodAround(sim: SimInternals, w: WalkerInstance, god: string, profile: WalkerProfile): void {
  for (const d of DIRS) {
    const b = sim.buildingAt(w.x + d.x, w.y + d.y);
    if (b && b.house) {
      b.house.godAccess = b.house.godAccess ?? {};
      b.house.godAccess[god] = profile.serviceTTL;
    }
  }
}

/**
 * Seller delivery (§12.9–12.12): a wandering seller carrying a multi-food load
 * drops one unit of its basic-first load into each adjacent house that needs
 * food, marks the house fed (foodCooldown), and records per-house market
 * coverage (§12.13). Physical units leave the load and land in the house's
 * inventory — no teleportation, no loss.
 */
function deliverToAdjacentHouses(sim: SimInternals, w: WalkerInstance, profile: WalkerProfile): void {
  const load = w.carryingLoad;
  if (!load) return;
  for (const d of DIRS) {
    const b = sim.buildingAt(w.x + d.x, w.y + d.y);
    if (!b || !b.house) continue;
    if (b.house.foodCooldown > 0) continue; // recently fed — not hungry
    const food = nextLoadedFood(load);
    if (!food) continue;
    load[food] = (load[food] ?? 0) - 1;
    if ((load[food] ?? 0) <= 0) delete load[food];
    b.house.foodCooldown = profile.serviceTTL;
    b.house.foodInventory = b.house.foodInventory ?? {};
    b.house.foodInventory[food] = (b.house.foodInventory[food] ?? 0) + 1;
    const cov = b.house.marketCoverage ?? {
      houseId: String(b.id), lastMarketVisit: 0, lastFoodDelivery: 0, servingMarketId: '', foodDeliveredByType: {},
    };
    const marketId = w.marketId != null ? String(w.marketId) : '';
    if (marketId) {
      recordMarketVisit(cov, sim.tick ?? 1, food, 1, marketId);
    } else {
      cov.lastFoodDelivery += 1;
    }
    b.house.marketCoverage = cov;
  }
}

/** The first food with units left in a seller's load (basic-first ordering). */
function nextLoadedFood(load: Record<string, number>): string | null {
  for (const f of FOOD_KEYS) if ((load[f] ?? 0) > 0) return f;
  for (const [f, v] of Object.entries(load)) if (v > 0) return f;
  return null;
}

function serviceHousesAround(sim: SimInternals, w: WalkerInstance, service: string, profile: WalkerProfile): void {
  for (const d of DIRS) {
    const b = sim.buildingAt(w.x + d.x, w.y + d.y);
    if (b && b.house) {
      if (service === 'food') b.house.foodCooldown = profile.serviceTTL;
      else if (service === 'water') b.house.waterCooldown = profile.serviceTTL;
      else {
        b.house.services = b.house.services ?? {};
        b.house.services[service] = profile.serviceTTL;
      }
    }
  }
}

/** Pick a new objective (market: granary/house; labor: building; well: none). */
function decide(sim: SimInternals, w: WalkerInstance, profile: WalkerProfile): void {
  if (w.type === 'market') decideMarket(sim, w, profile);
  else if (w.type === 'labor') decideLabor(sim, w, profile);
  else if (w.type === 'buyer') decideBuyer(sim, w, profile);
  else if (w.type === 'seller') decideSeller(sim, w);
  else if (w.type === 'caravan' || w.type === 'ship') decideTrade(sim, w, profile);
}

/**
 * TRAD-03 trade-transport decision (caravan/ship): empty exports seek their
 * source storage to collect; loaded transports head to their destination storage
 * (or leave the region when the export has no destination building). A transport
 * with no reachable road/berth waits a limited window (§19.3) then leaves
 * without trading — releaseWalkerLoad returns any held product first.
 */
function decideTrade(sim: SimInternals, w: WalkerInstance, profile: WalkerProfile): void {
  const tr = w.trade;
  if (!tr) {
    // A bare caravan/ship with no payload has nothing to trade — leave quietly.
    sim.despawn(w);
    return;
  }
  if (tr.loaded) {
    const dest = tr.destBuildingId != null ? sim.buildingById(tr.destBuildingId) : null;
    if (dest && startSeeking(sim, w, dest, profile)) return;
    if (tr.isExport && tr.destBuildingId == null) {
      // Export leaving the region: cargo already credited where collected.
      w.carryingGood = null;
      w.carriedAmount = 0;
      sim.despawn(w);
      return;
    }
    waitThenLeave(sim, w, tr);
    return;
  }
  // Not loaded yet — exports must first collect from the source storage.
  if (tr.isExport) {
    const src = tr.sourceBuildingId != null ? sim.buildingById(tr.sourceBuildingId) : null;
    if (src && startSeeking(sim, w, src, profile)) return;
  }
  waitThenLeave(sim, w, tr);
}

/** Wait a limited §19.3 window for a road/berth, then leave without trading. */
function waitThenLeave(sim: SimInternals, w: WalkerInstance, tr: TradeCarrierPayload): void {
  tr.waitTicks += 1;
  if (tr.waitTicks > CONFIG.merchantWaitTicks) {
    releaseWalkerLoad(sim, w);
    sim.despawn(w);
  }
}

function decideMarket(sim: SimInternals, w: WalkerInstance, profile: WalkerProfile): void {
  if (w.carryingGood === 'wheat' && w.carriedAmount > 0) {
    const house = nearestHouseNeeding(sim, w, 'food');
    if (house) startSeeking(sim, w, house, profile);
    return;
  }
  const granary = nearestGranaryWithWheat(sim, w);
  if (granary) startSeeking(sim, w, granary, profile);
}

function decideLabor(sim: SimInternals, w: WalkerInstance, profile: WalkerProfile): void {
  const b = nearestBuildingNeedingLabor(sim, w);
  if (b) startSeeking(sim, w, b, profile);
}

/** Foods the food-supply chain tracks (mirrors advisor FOOD_KEYS). */
const FOOD_KEYS = ['wheat', 'vegetables', 'fruit', 'meat', 'fish'];
/** Units a buyer fetches per trip (WR-02; bounded by granary availability). */
const BUYER_FETCH_AMOUNT = 40;

/**
 * Market buyer destination walker (§12.5, WR-02): choose which food to fetch
 * with nextFoodToFetch, reserve the units at the granary immediately (so they
 * cannot be double-picked), travel, then return the load to the market. The
 * granary's stock is reduced at departure (reservation holds) and the units
 * physically land in the market only on deposit; a trip that never completes
 * returns them to the granary.
 */
function decideBuyer(sim: SimInternals, w: WalkerInstance, profile: WalkerProfile): void {
  if (w.carryingGood !== null && w.carriedAmount > 0) {
    // Return leg: deposit the load at the market.
    const market = buyerMarket(sim, w);
    if (market && startSeeking(sim, w, market, profile)) return;
    // No market reachable → restore the reservation (never lose product).
    releaseWalkerLoad(sim, w);
    sim.despawn(w);
    return;
  }
  const market = buyerMarket(sim, w);
  if (!market) return;
  const eff = market.workersRequired > 0 ? market.workersAssigned / market.workersRequired : 0;
  if (marketAgents(eff).buyers <= 0) return; // market staffs no buyer at this efficiency (§12.3)
  // An explicitly-configured per-market config (MARK-02, decision 4) changes the
  // buyer's radius, refused-product gate, and restock target; unconfigured
  // markets keep the legacy hardcoded path below.
  const cfg = sim.marketConfig?.(market.id);
  const state = marketFoodState(sim, market, cfg);
  const food = nextFoodToFetch(state);
  if (!food) return;
  // WR-01: a configured market's restock target already covered by stock plus
  // units in transit — a buyer must not dispatch another fetch for that food,
  // or the fetch would overshoot the configured target.
  if (cfg && readFood(market, food) + state.inTransit[food] >= cfg.targetStock) return;
  const granary = pickBuyerGranary(sim, w, market, food, profile, cfg?.buyerRadius);
  if (!granary) return;
  const stock = readFood(granary, food);
  const take = Math.min(BUYER_FETCH_AMOUNT, stock);
  if (take <= 0) return;
  // Reserve-and-collect at departure: back the units out of the granary now so
  // no second buyer can pick them; they arrive at the market only on deposit.
  writeFood(granary, food, stock - take);
  w.carryingGood = food as Good;
  w.carriedAmount = take;
  w.reservedGranaryId = granary.id;
  startSeeking(sim, w, granary, profile);
}

/**
 * Market seller wandering walker (§12.9–12.12, WR-02): at its home market it
 * composes a multi-food load (sellerLoadComposition) and deducts it from market
 * stock; while wandering it delivers units to adjacent hungry houses
 * (see deliverToAdjacentHouses). Runs reload only at the market (origin).
 */
function decideSeller(sim: SimInternals, w: WalkerInstance): void {
  if (w.carryingLoad && loadAmount(w.carryingLoad) > 0) return; // mid-delivery run
  const market = w.marketId != null ? sim.buildingById(w.marketId) : nearestMarket(sim, w);
  if (!market) return;
  const eff = market.workersRequired > 0 ? market.workersAssigned / market.workersRequired : 1;
  if (marketAgents(eff).sellers <= 0) return; // market staffs no seller at this efficiency (§12.3)
  // Reload only while standing at the market (physical origin of the load).
  if (!w.origin || w.x !== w.origin.x || w.y !== w.origin.y) return;
  const load = sellerLoadComposition(market.stock as Record<string, number>, MARKET_FOOD_CAPS, SELLER_CAPACITY, FOOD_KEYS);
  if (loadAmount(load) <= 0) return;
  for (const [f, amt] of Object.entries(load)) {
    writeFood(market, f, Math.max(0, readFood(market, f) - amt));
  }
  w.carryingLoad = load;
}

function loadAmount(load: Record<string, number>): number {
  let t = 0;
  for (const v of Object.values(load)) t += v;
  return t;
}

function buyerMarket(sim: SimInternals, w: WalkerInstance): BuildingInstance | null {
  if (w.marketId != null) {
    const m = sim.buildingById(w.marketId);
    if (m) return m;
  }
  return nearestMarket(sim, w);
}

function nearestMarket(sim: SimInternals, w: WalkerInstance): BuildingInstance | null {
  let best: BuildingInstance | null = null;
  let bestDist = Infinity;
  for (const b of sim.buildings) {
    if (b.type !== 'market') continue;
    const d = manhattan(w.x, w.y, b.x, b.y);
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best;
}

/** Market demand signal for buyer food choice. Unconfigured markets (cfg
 *  undefined) use the legacy path: restock whatever is below its per-food cap,
 *  basic food first when completely absent (§12.6–12.7). An explicitly-configured
 *  market (MARK-02, decision 4) instead skips refused products, counts units
 *  already in transit, and derives each food's demand from cfg.targetStock via
 *  marketNeedsRestock — a food at/above its target (or refused) never triggers
 *  a fetch. */
function marketFoodState(sim: SimInternals, market: BuildingInstance, cfg?: MarketConfig): MarketFoodState {
  const current: Record<string, number> = {};
  const inTransit: Record<string, number> = {};
  const expectedConsumption: Record<string, number> = {};
  for (const f of FOOD_KEYS) {
    if (cfg && cfg.productRules[f] === 'refuse') continue; // refused product → never fetched
    const stock = readFood(market, f);
    current[f] = stock;
    if (!cfg) {
      const cap = MARKET_FOOD_CAPS[f] ?? 0;
      expectedConsumption[f] = stock >= cap ? 0 : 1;
    } else {
      inTransit[f] = foodInTransit(sim, market.id, f);
      expectedConsumption[f] = marketNeedsRestock(cfg, stock, inTransit[f]) ? 1 : 0;
    }
  }
  return { current, inTransit, expectedConsumption, basicFood: 'wheat', evolutionBlocking: null };
}

/** Units of `food` already committed (in transit) toward `marketId` by live
 *  buyers — counts against the configured target stock. 0 when the walker list
 *  is not exposed (legacy stub behavior). */
function foodInTransit(sim: SimInternals, marketId: number, food: string): number {
  const ws = sim.walkers;
  if (!ws) return 0;
  let total = 0;
  for (const w of ws) {
    if (w.type === 'buyer' && w.marketId === marketId && w.carryingGood === (food as Good)) {
      total += w.carriedAmount;
    }
  }
  return total;
}

/** Best road-reachable granary with available stock of `food` (scoreGranary/
 *  pickGranary). When `radius` is given (an explicitly-configured buyerRadius),
 *  candidates are additionally filtered to granaries within that Manhattan
 *  distance from the market — otherwise the legacy nearest-reachable search. */
function pickBuyerGranary(sim: SimInternals, w: WalkerInstance, market: BuildingInstance, food: string, profile: WalkerProfile, radius?: number): BuildingInstance | null {
  const candidates: GranaryCandidate[] = [];
  for (const b of sim.buildings) {
    if (b.type !== 'granary') continue;
    const avail = readFood(b, food);
    if (avail <= 0) continue;
    if (radius !== undefined && manhattan(market.x, market.y, b.x, b.y) > radius) continue;
    const to = sim.adjacentRoadTile(b);
    if (!to) continue;
    const path = findRoadPath(sim.map, { x: w.x, y: w.y }, to, traversableFor(sim, profile));
    if (path === null) continue;
    candidates.push({ id: String(b.id), roadDistance: path.length, congestion: 0, priority: 0, available: avail, blockRisk: 0 });
  }
  const chosen = pickGranary(candidates);
  if (!chosen) return null;
  const g = sim.buildingById(Number(chosen.id));
  return g && g.type === 'granary' ? g : null;
}

/** Read a food's units from a building's good stock (string-keyed access). */
function readFood(b: BuildingInstance, food: string): number {
  return (b.stock as Record<string, number | undefined>)[food] ?? 0;
}

/** Write a food's units into a building's good stock (string-keyed access). */
function writeFood(b: BuildingInstance, food: string, value: number): void {
  (b.stock as Record<string, number | undefined>)[food] = value;
}

/**
 * Return any stock a buyer/seller still holds when a trip fails or expires so
 * product is never destroyed without a handoff (WR-02).
 */
function releaseWalkerLoad(sim: SimInternals, w: WalkerInstance): void {
  if (w.type === 'buyer' && w.carryingGood && w.carriedAmount > 0 && w.reservedGranaryId != null) {
    const g = sim.buildingById(w.reservedGranaryId);
    if (g && g.stock) writeFood(g, w.carryingGood, readFood(g, w.carryingGood) + w.carriedAmount);
    w.carryingGood = null;
    w.carriedAmount = 0;
    w.reservedGranaryId = undefined;
  }
  if (w.type === 'seller' && w.carryingLoad) {
    const leftover = loadAmount(w.carryingLoad);
    if (leftover > 0) {
      const market = w.marketId != null ? sim.buildingById(w.marketId) : nearestMarket(sim, w);
      if (market && market.stock) {
        for (const [f, amt] of Object.entries(w.carryingLoad)) {
          if (amt > 0) writeFood(market, f, readFood(market, f) + amt);
        }
      }
    }
    w.carryingLoad = {};
  }
  if ((w.type === 'caravan' || w.type === 'ship') && w.trade && w.carryingGood && w.carriedAmount > 0) {
    // TRAD-03 no-loss: an export trip that fails/expires returns its held cargo
    // to the source storage. An import's held cargo came from the region entry
    // (never city storage), so there is nothing to restore — it leaves with the
    // merchant rather than vanishing from anywhere.
    if (w.trade.isExport && w.trade.sourceBuildingId != null) {
      const src = sim.buildingById(w.trade.sourceBuildingId);
      if (src && src.stock) writeFood(src, w.carryingGood, readFood(src, w.carryingGood) + w.carriedAmount);
    }
    w.carryingGood = null;
    w.carriedAmount = 0;
  }
}

/** Turn the walker toward a building. Returns false when unreachable. */
function startSeeking(sim: SimInternals, w: WalkerInstance, target: BuildingInstance, profile: WalkerProfile): boolean {
  const to = sim.adjacentRoadTile(target);
  if (!to) return false;
  const path = findRoadPath(sim.map, { x: w.x, y: w.y }, to, traversableFor(sim, profile));
  if (path === null) return false;
  // findRoadPath returns only the intermediate tiles strictly between the
  // walker's current tile and the goal (both excluded), so the walker reaches
  // the goal tile by adjacency — there is never a start tile to drop here.
  w.state = 'seeking';
  w.targetBuildingId = target.id;
  w.path = path;
  return true;
}

/**
 * The walker stands on the goal tile next to its target building.
 * Returns false when the walker despawned and must not continue.
 */
function handleArrival(sim: SimInternals, w: WalkerInstance, profile: WalkerProfile): boolean {
  const target = sim.buildingById(w.targetBuildingId ?? -1);
  if (!target) return true;

  if (w.type === 'market') {
    if (w.carryingGood === 'wheat' && w.carriedAmount > 0) {
      // Deliver one unit of food to the target house.
      if (target.house) target.house.foodCooldown = profile.serviceTTL;
      w.carriedAmount -= 1;
      if (w.carriedAmount <= 0) {
        w.carryingGood = null;
        w.carriedAmount = 0;
      }
      if (w.carriedAmount <= 0) {
        sim.despawn(w);
        return false;
      }
    } else {
      // Fetch wheat from the target granary (up to the configured amount).
      const stock = target.stock.wheat ?? 0;
      const take = Math.min(CONFIG.marketFetchAmount, stock);
      if (take > 0) {
        target.stock.wheat = stock - take;
        w.carryingGood = 'wheat';
        w.carriedAmount = take;
      }
    }
  } else if (w.type === 'buyer') {
    // Arrive home: physically deposit the reserved load into the market stock.
    if (target.type === 'market' && w.carryingGood && w.carriedAmount > 0) {
      writeFood(target, w.carryingGood, readFood(target, w.carryingGood) + w.carriedAmount);
      w.carryingGood = null;
      w.carriedAmount = 0;
      w.reservedGranaryId = undefined;
      sim.despawn(w);
      return false;
    }
    // Arrived at the granary source: the next decide turns the walker home.
  } else if (w.type === 'labor') {
    target.laborConnected = true;
    target.laborCooldown = profile.serviceTTL;
    sim.despawn(w);
    return false;
  } else if (w.type === 'caravan' || w.type === 'ship') {
    const tr = w.trade;
    if (!tr) {
      sim.despawn(w);
      return false;
    }
    if (tr.loaded && w.carryingGood && w.carriedAmount > 0) {
      // Arrived at the destination storage — deposit the carried load.
      if (target.stock) {
        writeFood(target, w.carryingGood, readFood(target, w.carryingGood) + w.carriedAmount);
      }
      w.carryingGood = null;
      w.carriedAmount = 0;
      sim.despawn(w);
      return false;
    }
    if (!tr.loaded && tr.isExport) {
      // Arrived at the source storage — collect what exists up to capacity.
      const avail = readFood(target, tr.good);
      const take = Math.min(tr.amount, avail, tr.capacity);
      if (take > 0) {
        writeFood(target, tr.good, avail - take);
        w.carryingGood = tr.good as Good;
        w.carriedAmount = take;
      }
      tr.loaded = true;
      // A stock-poor source may collect nothing — the caravan leaves empty.
      if (tr.destBuildingId == null) {
        sim.despawn(w);
        return false;
      }
      return true;
    }
    return true;
  }
  return true;
}

/**
 * Per-walker traversability predicate: a tile is passable when it is road
 * terrain AND the walker's profile may traverse its road type (roadblock
 * policies honored for service_roadblock tiles).
 */
function traversableFor(sim: SimInternals, profile: WalkerProfile): (x: number, y: number) => boolean {
  return (x: number, y: number): boolean =>
    sim.map.get(x, y) === 'road' && mayTraverse(profile, sim.map.roadTypeAt(x, y) ?? 'dirt');
}

/**
 * Advance the walker a fraction of a tile toward its next tile. Movement is
 * sub-tile (profile.movementSpeed per tick): the walker crosses a tile
 * boundary only once `progress` reaches 1, so the renderer can interpolate
 * smoothly between (x, y) and `next` instead of teleporting tile to tile.
 */
function move(sim: SimInternals, w: WalkerInstance, profile: WalkerProfile): void {
  const returning = profile.returnPolicy && profile.category === 'wandering';

  // Choose a destination tile when the walker has none pending.
  if (w.next === null) {
    if (w.state === 'seeking' && w.path.length > 0) {
      w.next = w.path[0];
    } else {
      // Wandering: pick a road neighbor via the seeded RNG, restricted to tiles
      // the walker's profile permits. Stuck on a dead end (no road neighbor)
      // means standing still until the lifetime ends.
      let neighbors = roadNeighbors(sim.map, w.x, w.y).filter((nb) => traversableFor(sim, profile)(nb.x, nb.y));
      if (neighbors.length === 0) return;
      // Return-policy wandering: when the walker has walked maxRoadSteps from
      // its origin, choose the next step from neighbors that reduce Manhattan
      // distance home (tie-broken by the seeded RNG).
      if (returning && w.origin && w.stepsTaken >= profile.maxRoadSteps) {
        const origin = w.origin;
        const homeward = neighbors.filter(
          (nb) => manhattan(nb.x, nb.y, origin.x, origin.y) < manhattan(w.x, w.y, origin.x, origin.y),
        );
        if (homeward.length > 0) neighbors = homeward;
      }
      w.next = neighbors[randInt(sim.rng, 0, neighbors.length - 1)];
    }
  }

  // Speed is per-tick progress scaled by the profile's base movement speed and
  // the current tile's road-type multiplier (bare 'road' reads as dirt = 1x).
  // A service_roadblock's 0 multiplier means "blocked"; a walker permitted to
  // pass one (roadblock policy 'pass') crosses it at base speed instead.
  const rt = sim.map.roadTypeAt(w.x, w.y) ?? 'dirt';
  // A service_roadblock's 0 multiplier bars *entry* for non-'pass' walkers, not
  // *exit*. A walker already standing on one (spawned there, or a block paved
  // under it at runtime) must still be able to leave at base speed — a 0
  // multiplier would otherwise freeze it with progress stuck at 0 forever
  // (WR-02). Non-'pass' walkers never *select* a block as their next tile
  // (traversableFor/findRoadPath bar it), so base speed on a block only ever
  // means leaving it.
  const speed = rt === 'service_roadblock' ? 1 : roadSpeedMultiplier(rt);
  w.progress += profile.movementSpeed * speed;
  if (w.progress >= 1 && w.next) {
    w.progress -= 1;
    w.x = w.next.x;
    w.y = w.next.y;
    w.next = null;
    if (returning && w.origin) {
      if (w.x === w.origin.x && w.y === w.origin.y) w.stepsTaken = 0;
      else w.stepsTaken += 1;
    }
    if (w.state === 'seeking' && w.path.length > 0) w.path.shift();
  }
}

function nearestHouseNeeding(sim: SimInternals, w: WalkerInstance, service: 'food' | 'water'): BuildingInstance | null {
  let best: BuildingInstance | null = null;
  let bestDist = Infinity;
  for (const b of sim.buildings) {
    if (!b.house) continue;
    if (service === 'food' && b.house.foodCooldown > 0) continue;
    if (service === 'water' && b.house.waterCooldown > 0) continue;
    const d = manhattan(w.x, w.y, b.x, b.y);
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best;
}

function nearestGranaryWithWheat(sim: SimInternals, w: WalkerInstance): BuildingInstance | null {
  let best: BuildingInstance | null = null;
  let bestDist = Infinity;
  for (const b of sim.buildings) {
    if (b.type !== 'granary') continue;
    if ((b.stock.wheat ?? 0) <= 0) continue;
    const d = manhattan(w.x, w.y, b.x, b.y);
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best;
}

function nearestBuildingNeedingLabor(sim: SimInternals, w: WalkerInstance): BuildingInstance | null {
  let best: BuildingInstance | null = null;
  let bestDist = Infinity;
  for (const b of sim.buildings) {
    if (b.workersRequired <= 0) continue;
    // Reachability is durable; only buildings not yet connected need a labor walker.
    if (b.laborConnected) continue;
    const d = manhattan(w.x, w.y, b.x, b.y);
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best;
}

function manhattan(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}
