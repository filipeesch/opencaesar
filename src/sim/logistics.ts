/**
 * Logistics — warehouses, markets & distribution (Phases 7 & 8; tasks 5.4, 5.5,
 * 3.4, 3.5, 3.6).
 *
 * - Warehouses store one load per slot with per-commodity orders
 *   (accept/refuse/request/maintain/empty/reserve).
 * - A single Commercial Center may be designated; a second designation falls
 *   back with a warning, and a full center is reported.
 * - Markets track inventory with a reservation pool so a load in transit is not
 *   double-picked, and distribute by priority (essential food first).
 * Self-contained, additive.
 */
export type WarehouseReorder = 'accept' | 'refuse' | 'request' | 'maintain' | 'empty' | 'reserve';

export interface WarehousePolicy {
  perCommodity: Partial<Record<string, WarehouseReorder>>;
  slotCapacity: number;
}

export function defaultWarehousePolicy(slotCapacity = 16): WarehousePolicy {
  return { perCommodity: {}, slotCapacity };
}

/** Whether a warehouse with `policy` may hold one more slot of `commodity`. */
export function warehouseAccepts(policy: WarehousePolicy, commodity: string, usedSlots: number): boolean {
  if (usedSlots >= policy.slotCapacity) return false;
  const cmd = policy.perCommodity[commodity] ?? 'accept';
  return cmd !== 'refuse' && cmd !== 'empty';
}

/** Commercial Center handles: exactly one may be designated. */
export class CommercialCenter {
  private designation: string | null = null;
  private warning: string | null = null;

  designate(id: string): { ok: boolean; warning?: string; fallback?: boolean } {
    if (this.designation !== null && this.designation !== id) {
      this.warning = `Commercial Center already designated (${this.designation}). Fallback: ${id}.`;
      return { ok: true, fallback: true, warning: this.warning };
    }
    this.designation = id;
    this.warning = null;
    return { ok: true };
  }

  isDesignated(id: string): boolean {
    return this.designation === id;
  }

  allowedToExport(): string | null {
    return this.designation;
  }
}

/** A load in transit is reserved so it cannot be double-picked. */
export class ReservationPool {
  readonly taxable = new Map<string, number>(); // commodity -> reserved loads
  private reservations = new Map<string, number>();

  reserve(commodity: string, amount = 1): boolean {
    const have = this.available(commodity);
    if (have < 1) return false;
    this.reservations.set(commodity, (this.reservations.get(commodity) ?? 0) + amount);
    return true;
  }

  available(commodity: string): number {
    const total = this.taxable.get(commodity) ?? 0;
    const reserved = this.reservations.get(commodity) ?? 0;
    return Math.max(0, total - reserved);
  }

  release(commodity: string, amount = 1): void {
    const cur = this.reservations.get(commodity) ?? 0;
    this.reservations.set(commodity, Math.max(0, cur - amount));
  }

  reserved(commodity: string): number {
    return this.reservations.get(commodity) ?? 0;
  }
}

/**
 * Distribution priority (task 3.5): pick which commodity a market buyer should
 * fetch next — essential food first, then the evolution-blocking good, else
 * the most depleted stock.
 */
export function nextPickPriority(
  foods: string[],
  evolutionBlocking: string | null,
  current: Record<string, number>,
): string | null {
  for (const f of foods) {
    if ((current[f] ?? 0) <= 0) return f;
  }
  if (evolutionBlocking && (current[evolutionBlocking] ?? 0) <= 0) return evolutionBlocking;
  return null;
}

/** Per-market configuration (task 3.6). */
export interface MarketConfig {
  productRules: Partial<Record<string, 'accept' | 'refuse'>>;
  targetStock: number;
  buyerRadius: number;
  /** Block wine for plebeian households. */
  blockWineForPlebeians: boolean;
  preferredSupplier: string | null;
}

export function defaultMarketConfig(): MarketConfig {
  return { productRules: {}, targetStock: 20, buyerRadius: 2, blockWineForPlebeians: true, preferredSupplier: null };
}

/** Whether a market accepts a product for a given resident class. */
export function marketAccepts(cfg: MarketConfig, product: string, residentClass: string): boolean {
  if (cfg.productRules[product] === 'refuse') return false;
  if (cfg.blockWineForPlebeians && product === 'wine' && residentClass === 'plebeian') return false;
  return true;
}

/** Market buyer model (task 3.4): wander to the nearest supplier within range. */
export interface MarketSupplier {
  id: string;
  x: number;
  y: number;
  hasProduct: (product: string) => boolean;
}

export function findSupplier(suppliers: MarketSupplier[], marketX: number, marketY: number, product: string, radius: number): MarketSupplier | null {
  let best: MarketSupplier | null = null;
  let bestDist = Infinity;
  for (const s of suppliers) {
    if (!s.hasProduct(product)) continue;
    const d = Math.abs(s.x - marketX) + Math.abs(s.y - marketY);
    if (d <= radius && d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

/** Production/logistics advisor data (task 5.6). */
export interface LogisticsAdvisorView {
  stock: Record<string, number>;
  production: Record<string, number>;
  consumption: Record<string, number>;
  inTransit: number;
  bottlenecks: number;
  stopped: number;
}

export function logisticsAdvisor(
  stock: Record<string, number>,
  production: Record<string, number>,
  consumption: Record<string, number>,
  portsActive: number,
  totalPorters: number,
  bottlenecks: number,
  stopped: number,
): LogisticsAdvisorView {
  return { stock, production, consumption, inTransit: totalPorters - portsActive, bottlenecks, stopped };
}

/**
 * === Granary food hub (AGRI-03, spec §11) ===
 *
 * The granary is the food hub: shared capacity across foods, per-food orders
 * (accept/refuse/request/maintain/empty/reserve/max), separate stock classes
 * (physical/available/reserved/incoming/outgoing/spoiled, §11.7), transactional
 * reservations that expire (§11.8) and prevent double-pick, and granary-to-
 * granary transfers guarded against ping-pong/cycles (§24.3–24.4). Additive to
 * the live sim's wheat transfer; all functions deterministic.
 */

/** Shared granary capacity in units = 32 loads of 100 (spec §11.3). */
import { UNITS_PER_LOAD } from './agriculture';
export const GRANARY_CAPACITY = 32 * UNITS_PER_LOAD;
/** Transfer cooldown window in ticks/days (§24.3: 90 days). */
export const GRANARY_TRANSFER_COOLDOWN = 90;

export type GranaryOrderMode = 'accept' | 'refuse' | 'request' | 'maintain' | 'empty' | 'reserve' | 'max';

export interface GranaryOrder {
  mode: GranaryOrderMode;
  /** Target stock for 'maintain'; reserve amount for 'reserve'; 0 otherwise. */
  amount?: number;
  /** Absolute cap for 'max'; any positive amount sets a cap. */
  maximum?: number;
  /** Receive priority 0..5 (5 = critical), spec §11.6. */
  priority?: number;
}

export interface GranaryFoodState {
  /** Units physically stored in the granary. */
  physical: number;
  /** Units moving toward this granary. */
  incoming: number;
  /** Units leaving (in transit out / reserved for collection). */
  outgoing: number;
  /** Units that spoiled in storage. */
  spoiled: number;
  order: GranaryOrder;
}

export interface GranaryReservation {
  id: string;
  food: string;
  amount: number;
  owner: string;
  collector: string | null;
  /** Tick at which the reservation expires if not collected. */
  expiresAt: number;
  state: 'active' | 'fulfilled' | 'expired' | 'cancelled';
}

export const DEFAULT_GRANARY_ORDER: GranaryOrder = { mode: 'accept', amount: 0, maximum: GRANARY_CAPACITY, priority: 3 };

export class GranaryModel {
  readonly id: string;
  readonly capacity: number;
  private foods = new Map<string, GranaryFoodState>();
  private reservations = new Map<string, GranaryReservation>();
  private nextReservationId = 1;
  /** recentTransfer[targetId][food] = tick — ping-pong guard (§24.3). */
  recentOut = new Map<string, Map<string, number>>();
  recentIn = new Map<string, Map<string, number>>();

  constructor(id: string, capacity = GRANARY_CAPACITY) {
    this.id = id;
    this.capacity = capacity;
  }

  /** Configure the per-food order (spec §11.5). */
  setOrder(food: string, mode: GranaryOrderMode, opts: Omit<GranaryOrder, 'mode'> = {}): void {
    this.state(food).order = { ...DEFAULT_GRANARY_ORDER, ...opts, mode };
    if (mode === 'max' && opts.maximum !== undefined) {
      this.state(food).order.maximum = opts.maximum;
    }
  }

  orderOf(food: string): GranaryOrder {
    return { ...(this.foods.get(food)?.order ?? DEFAULT_GRANARY_ORDER) };
  }

  private state(food: string): GranaryFoodState {
    let s = this.foods.get(food);
    if (!s) {
      s = { physical: 0, incoming: 0, outgoing: 0, spoiled: 0, order: { ...DEFAULT_GRANARY_ORDER } };
      this.foods.set(food, s);
    }
    return s;
  }

  /** Units physically stored of a food. */
  physical(food: string): number {
    return this.foods.get(food)?.physical ?? 0;
  }

  /** Total used capacity across all accounting classes (physical + incoming). */
  usedCapacity(): number {
    let total = 0;
    for (const s of this.foods.values()) total += s.physical + s.incoming;
    return total;
  }

  freeCapacity(): number {
    return Math.max(0, this.capacity - this.usedCapacity());
  }

  /** Amount reserved by per-food 'reserve' order + active transactional reservations. */
  reserved(food: string): number {
    const orderReserve = this.foods.get(food)?.order.mode === 'reserve' ? (this.foods.get(food)?.order.amount ?? 0) : 0;
    let txReserved = 0;
    for (const r of this.reservations.values()) {
      if (r.food === food && r.state === 'active') txReserved += r.amount;
    }
    return orderReserve + txReserved;
  }

  /** Available for collection = physical - reserved (spec §11.7 availableStock). */
  available(food: string): number {
    return Math.max(0, this.physical(food) - this.reserved(food));
  }

  /** Whether the granary accepts a new delivery of `food` of `amount` units. */
  accepts(food: string, amount: number): boolean {
    const order = this.orderOf(food);
    if (order.mode === 'refuse' || order.mode === 'empty') return false;
    const perFood = order.maximum ?? this.capacity;
    if (this.physical(food) + Math.max(0, amount) > perFood) return false;
    if (this.usedCapacity() + Math.max(0, amount) > this.capacity) return false;
    return true;
  }

  /**
   * Receive a physical delivery of `amount` units (caller gates with accepts).
   * Returns the units actually stored. The total shared capacity is never
   * silently exceeded: a delivery that would push usedCapacity() past
   * `capacity` is refused outright (applies 0) rather than clamped away, so
   * overflow is never a silent-product-loss vector.
   */
  receive(food: string, amount: number): number {
    if (amount <= 0) return 0;
    const s = this.state(food);
    const free = this.capacity - this.usedCapacity();
    if (free <= 0) return 0;
    const applied = Math.min(amount, free);
    s.physical += applied;
    return applied;
  }

  /**
   * Transactional reservation (spec §11.8): creates a tracked reservation that
   * backs the amount out of `available` immediately so no double-pick occurs,
   * and expires if never collected. Returns null when the food cannot be
   * reserved (none available, or the granary refuses markets).
   */
  reserve(food: string, amount: number, owner: string, collector: string | null, now: number, expiresIn = 30): GranaryReservation | null {
    const order = this.orderOf(food);
    if (order.mode === 'refuse' || order.mode === 'empty') return null;
    if (amount <= 0 || amount > this.available(food)) return null;
    const r: GranaryReservation = {
      id: `res-${this.id}-${this.nextReservationId++}`,
      food,
      amount,
      owner,
      collector,
      expiresAt: now + expiresIn,
      state: 'active',
    };
    this.reservations.set(r.id, r);
    return r;
  }

  /** A collector confirmed pickup: reserved units move to outgoing (leave stock). */
  fulfill(reservationId: string): boolean {
    const r = this.reservations.get(reservationId);
    if (!r || r.state !== 'active') return false;
    const s = this.state(r.food);
    const take = Math.min(r.amount, s.physical);
    s.physical -= take;
    s.outgoing += take;
    r.state = 'fulfilled';
    return true;
  }

  /** Move `amount` of `food` out to a destination (used by granaryTransfer). */
  fulfillByFood(food: string, amount: number): void {
    const s = this.state(food);
    const take = Math.min(amount, s.physical);
    s.physical -= take;
    s.outgoing += take;
  }

  /** Incoming units arrive (reduces incoming, adds physical). */
  incomingArrives(food: string, amount: number): void {
    const s = this.state(food);
    const applied = Math.min(amount, s.incoming);
    s.incoming -= applied;
    s.physical = Math.min(this.capacity, s.physical + applied);
  }

  /** Record inbound/outbound transfers for ping-pong detection (§24.3). */
  stamp(map: Map<string, Map<string, number>>, otherId: string, food: string, now: number): void {
    let inner = map.get(otherId);
    if (!inner) {
      inner = new Map();
      map.set(otherId, inner);
    }
    inner.set(food, now);
  }

  /** Expire reservations past `now`; expired product returns to availability. */
  expireReservations(now: number): number {
    let expired = 0;
    for (const r of this.reservations.values()) {
      if (r.state === 'active' && r.expiresAt <= now) {
        r.state = 'expired';
        expired += 1;
      }
    }
    return expired;
  }

  activeReservations(): GranaryReservation[] {
    return [...this.reservations.values()].filter((r) => r.state === 'active');
  }

  reservationsOfOwner(owner: string): GranaryReservation[] {
    return [...this.reservations.values()].filter((r) => r.state === 'active' && r.owner === owner);
  }

  /** Recent exchange with `otherId` for `food` within `cooldown` ticks (ping-pong guard). */
  recentlyExchanged(otherId: string, food: string, now: number, cooldown = GRANARY_TRANSFER_COOLDOWN): boolean {
    const out = this.recentOut.get(otherId)?.get(food) ?? -Infinity;
    const inn = this.recentIn.get(otherId)?.get(food) ?? -Infinity;
    return now - Math.max(out, inn) < cooldown;
  }

  /** Total spoiled across all foods. */
  totalSpoiled(): number {
    let t = 0;
    for (const s of this.foods.values()) t += s.spoiled;
    return t;
  }

  /** Serialize for deterministic save/load (§32.8). */
  serialize(): unknown {
    const foodMap: Record<string, GranaryFoodState> = {};
    for (const [k, s] of this.foods) foodMap[k] = { ...s, order: { ...s.order } };
    return {
      id: this.id,
      capacity: this.capacity,
      nextReservationId: this.nextReservationId,
      foods: foodMap,
      reservations: [...this.reservations.entries()].map(([, r]) => ({ ...r })),
      recentOut: toPlain(this.recentOut),
      recentIn: toPlain(this.recentIn),
    };
  }

  static deserialize(raw: unknown): GranaryModel {
    const d = raw as {
      id: string; capacity: number; nextReservationId: number;
      foods: Record<string, GranaryFoodState>;
      reservations: Array<GranaryReservation & { id: string }>;
      recentOut: Record<string, Record<string, number>>;
      recentIn: Record<string, Record<string, number>>;
    };
    const g = new GranaryModel(d.id, d.capacity);
    g.nextReservationId = d.nextReservationId ?? 1;
    for (const [food, s] of Object.entries(d.foods ?? {})) {
      g.foods.set(food, { ...s, order: { ...DEFAULT_GRANARY_ORDER, ...s.order } });
    }
    for (const r of d.reservations ?? []) {
      g.reservations.set(r.id, { ...r });
    }
    for (const other of Object.keys(d.recentOut ?? {})) {
      for (const [food, ts] of Object.entries(d.recentOut[other])) g.stamp(g.recentOut, other, food, ts);
    }
    for (const other of Object.keys(d.recentIn ?? {})) {
      for (const [food, ts] of Object.entries(d.recentIn[other])) g.stamp(g.recentIn, other, food, ts);
    }
    return g;
  }
}

function toPlain(map: Map<string, Map<string, number>>): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const [k, inner] of map) out[k] = Object.fromEntries(inner);
  return out;
}

/**
 * === Market demand & distribution (spec §12) ===
 *
 * Market internal capacity (500 units) with per-food caps, demand = expected
 * consumption + safety stock − current − in-transit (§12.6), a food-choice
 * order (§12.7), explainable granary supplier scoring (§12.8), buyer/seller
 * agent counts scaled by worker efficiency (§12.3), seller multi-food load
 * composition (§12.10), per-market service policy (§12.15) and per-house
 * coverage bookkeeping (§12.13). Purely deterministic.
 */

/** Market internal capacity in units (spec §12.4). */
export const MARKET_CAPACITY = 500;
/** Per-food default caps (spec §12.4). */
export const MARKET_FOOD_CAPS: Record<string, number> = {
  wheat: 200, vegetables: 100, fruit: 100, meat: 50, fish: 50,
};
/** Seller load capacity (spec §12.10). */
export const SELLER_CAPACITY = 100;
/** Seller route limits (spec §12.12). */
export const SELLER_MAX_ROAD_STEPS = 40;
export const SELLER_MAX_DAYS_OUT = 60;

/** Market demand = expected consumption + safety − current − in-transit (§12.6). */
export function marketDemand(
  expectedConsumption: number,
  safetyStock: number,
  current: number,
  inTransit: number,
): number {
  return Math.max(0, expectedConsumption + safetyStock - current - inTransit);
}

export interface MarketFoodState {
  /** Units the market holds of each food. */
  current: Record<string, number>;
  /** Units already in transit toward the market. */
  inTransit: Record<string, number>;
  /** Expected monthly consumption of the houses served. */
  expectedConsumption: Record<string, number>;
  /** Basic food species (consumed first, §13.3). */
  basicFood: string;
  /** Food whose absence blocks house evolution (evolutionBlocking). */
  evolutionBlocking: string | null;
  /** Per-food safety stock (default 0). */
  safetyStock?: Record<string, number>;
}

/**
 * Choose which food a market buyer should fetch next (spec §12.7):
 *  1. basic food completely absent
 *  2. food with the fewest days of coverage
 *  3. food blocking house evolution
 *  4. food below its minimum stock
 *  5. food with the highest monthly demand
 *  6. highest configured priority
 * Foods with no demand (zero expected consumption, zero current stock, nothing
 * in transit) are never picked — a buyer does not fetch food nobody expects
 * (IN-04).
 */
export function nextFoodToFetch(state: MarketFoodState, priority?: Record<string, number>): string | null {
  const foods = Object.keys(state.current);
  if (foods.length === 0) return null;
  const [basic] = foods.filter((f) => f === state.basicFood);
  if (basic !== undefined && (state.current[basic] ?? 0) <= 0 && (state.inTransit[basic] ?? 0) <= 0 && (state.expectedConsumption[basic] ?? 0) > 0) return basic;
  // fewest days of coverage = highest current/consumption drawdown
  let best: string | null = null;
  let bestCoverage = Infinity;
  for (const f of foods) {
    const cons = (state.expectedConsumption[f] ?? 0);
    if (cons <= 0 && (state.current[f] ?? 0) <= 0 && (state.inTransit[f] ?? 0) <= 0) continue; // no demand, nothing held (IN-04)
    const coverage = cons > 0 ? (state.current[f] ?? 0) / cons : (state.current[f] ?? 0) > 0 ? Infinity : 0;
    if (coverage < bestCoverage) {
      bestCoverage = coverage;
      best = f;
    }
  }
  if (best !== null && state.evolutionBlocking && (state.current[state.evolutionBlocking] ?? 0) <= 0) {
    return state.evolutionBlocking;
  }
  if (best === null) return null;
  const prio = priority?.[best] ?? 0;
  const fallback = foods
    .filter((f) => (state.current[f] ?? 0) <= 0 && ((state.expectedConsumption[f] ?? 0) > 0 || (state.inTransit[f] ?? 0) > 0))
    .sort((a, b) => (priority?.[b] ?? 0) - (priority?.[a] ?? 0))[0];
  return prio > 0 ? best : (fallback ?? best);
}

export interface GranaryCandidate {
  id: string;
  /** Road distance in segments (§5.4). */
  roadDistance: number;
  /** 0..1 congestion on the route. */
  congestion: number;
  /** Receive priority for markets (higher is better, spec §11.6). */
  priority: number;
  /** Available units at the granary. */
  available: number;
  /** Block risk: +1 if the buyer cannot cross a block. */
  blockRisk: number;
}

export interface SupplierScore {
  id: string;
  score: number;
  /** Human-readable reasons (spec §12.8). */
  reasons: string[];
}

/**
 * Explainable granary supplier scoring (spec §12.8):
 *   score = distance×2 + congestion×10 − priority − available/50 + blockRisk×50
 * Lower is better; the chosen supplier is backed by listed reasons.
 */
export function scoreGranary(c: GranaryCandidate): SupplierScore {
  const distanceW = c.roadDistance * 2;
  const congestionW = c.congestion * 10;
  const priorityW = c.priority;
  const qtyW = c.available / 50;
  const blockW = c.blockRisk * 50;
  const score = distanceW + congestionW - priorityW - qtyW + blockW;
  const reasons: string[] = [];
  reasons.push(`${c.available} units available`);
  reasons.push(`${c.roadDistance} road segments away`);
  if (c.priority > 0) reasons.push(`priority ${c.priority} for markets`);
  if (c.blockRisk > 0) reasons.push(`buyer blocked from crossing`);
  if (c.congestion > 0.5) reasons.push(`route ${Math.round(c.congestion * 100)}% congested`);
  return { id: c.id, score: Math.max(0, Math.round(score * 10) / 10), reasons };
}

/** Pick the best supplier (lowest score) among available, null when none. */
export function pickGranary(candidates: GranaryCandidate[]): SupplierScore | null {
  if (candidates.length === 0) return null;
  let best: SupplierScore | null = null;
  for (const c of candidates) {
    if (c.available <= 0) continue;
    const s = scoreGranary(c);
    if (best === null || s.score < best.score) best = s;
  }
  return best;
}

/** Active buyer/seller counts by worker efficiency (spec §12.3). */
export function marketAgents(efficiency: number): { buyers: number; sellers: number } {
  const e = Math.max(0, Math.min(1, efficiency));
  if (e < 0.25) return { buyers: 0, sellers: 0 };
  if (e < 0.5) return { buyers: 1, sellers: 0 };
  if (e < 0.75) return { buyers: 1, sellers: 1 };
  if (e < 1) return { buyers: 2, sellers: 1 };
  return { buyers: 2, sellers: 2 };
}

/**
 * Compose a seller's multi-food load (spec §12.10): fill the 100-unit capacity
 * following priority — basic food, then foods missing in houses, then the
 * evolution-blocking good, then restock of low inventories (§12.11).
 */
export function sellerLoadComposition(
  marketStock: Record<string, number>,
  perFoodCap: Record<string, number>,
  capacity = SELLER_CAPACITY,
  priorities: string[] = [],
): Record<string, number> {
  const load: Record<string, number> = {};
  const capped: string[] = Object.keys(marketStock).filter((f) => (marketStock[f] ?? 0) > 0 && (perFoodCap[f] ?? 0) > 0);
  const ordered = [...priorities.filter((f) => capped.includes(f)), ...capped.filter((f) => !priorities.includes(f))];
  let remaining = capacity;
  for (const f of ordered) {
    if (remaining <= 0) break;
    const canTake = Math.min(remaining, marketStock[f] ?? 0, perFoodCap[f] ?? capacity);
    if (canTake > 0) {
      load[f] = canTake;
      remaining -= canTake;
    }
  }
  return load;
}

/** Per-market service policies (spec §12.15). */
export type MarketServicePolicy = 'balanced' | 'avoid-hunger' | 'promote-evolution' | 'local-district' | 'patrician-reserve';

export interface HouseServingInfo {
  id: string;
  tier: number;
  /** Days since the house was last visited by any seller. */
  daysSinceVisit: number;
  /** Days of basic-food inventory remaining (∞ when well stocked). */
  basicFoodDays: number;
  /** Missing variety needed to evolve (0 = not blocking). */
  missingVariety: number;
  distance: number;
}

/** Per-house coverage bookkeeping (spec §12.13). */
export interface MarketCoverage {
  houseId: string;
  lastMarketVisit: number;
  lastFoodDelivery: number;
  servingMarketId: string;
  foodDeliveredByType: Record<string, number>;
}

/** Sort eligible houses by the market's service policy (spec §12.15). */
export function policyOrder(policy: MarketServicePolicy, houses: HouseServingInfo[]): HouseServingInfo[] {
  const list = [...houses];
  switch (policy) {
    case 'avoid-hunger':
      return list.sort((a, b) => a.basicFoodDays - b.basicFoodDays || a.daysSinceVisit - b.daysSinceVisit);
    case 'promote-evolution':
      return list.sort((a, b) => b.missingVariety - a.missingVariety || a.daysSinceVisit - b.daysSinceVisit);
    case 'local-district':
      return list.sort((a, b) => a.distance - b.distance || a.daysSinceVisit - b.daysSinceVisit);
    case 'patrician-reserve':
      return list.sort((a, b) => b.tier - a.tier || a.daysSinceVisit - b.daysSinceVisit);
    default:
      return list.sort((a, b) => a.daysSinceVisit - b.daysSinceVisit);
  }
}

/** Record a house covered by a market seller (spec §12.13). */
export function recordMarketVisit(cov: MarketCoverage, tick: number, food: string, amount: number, marketId: string): void {
  cov.lastMarketVisit = tick;
  cov.lastFoodDelivery = tick;
  cov.servingMarketId = marketId;
  cov.foodDeliveredByType[food] = (cov.foodDeliveredByType[food] ?? 0) + amount;
}

export interface TransferCheck {
  ok: boolean;
  reason: 'no-available' | 'no-capacity' | 'below-target' | 'no-request' | 'back-and-forth' | 'refuse' | 'ok';
}

/**
 * Granary-to-granary transfer with benefit + cycle/cooldown guards (spec §11.9,
 * §24.3–24.4). A transfer only happens when the destination is genuinely below
 * its maintain target (or requesting), the source has available stock, the
 * destination has capacity, and the two have not recently exchanged this food
 * (ping-pong prevention). Transfers never violate reservations.
 */
export function granaryTransfer(
  source: GranaryModel,
  dest: GranaryModel,
  food: string,
  amount: number,
  now: number,
): TransferCheck {
  const destOrder = dest.orderOf(food);
  if (destOrder.mode === 'refuse' || destOrder.mode === 'empty') return { ok: false, reason: 'refuse' };
  const available = source.available(food);
  if (amount > available) return { ok: false, reason: 'no-available' };
  const belowTarget =
    destOrder.mode === 'request' ||
    (destOrder.mode === 'maintain' && dest.physical(food) < (destOrder.amount ?? 0)) ||
    destOrder.mode === 'accept';
  if (!belowTarget) return { ok: false, reason: 'below-target' };
  // Shared-capacity gate across ALL foods (WR-01): a multi-food granary must
  // never be pushed past its total capacity, not just a per-food physical line.
  if (dest.usedCapacity() + amount > dest.capacity) return { ok: false, reason: 'no-capacity' };
  if (dest.physical(food) + amount > (dest.orderOf(food).maximum ?? dest.capacity)) {
    return { ok: false, reason: 'no-capacity' };
  }
  if (source.recentlyExchanged(dest.id, food, now) || dest.recentlyExchanged(source.id, food, now)) {
    return { ok: false, reason: 'back-and-forth' };
  }
  source.fulfillByFood(food, amount);
  dest.receive(food, amount);
  source.stamp(source.recentOut, dest.id, food, now);
  dest.stamp(dest.recentIn, source.id, food, now);
  return { ok: true, reason: 'ok' };
}

