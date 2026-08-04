/**
 * Trade — self-contained import/export pricing and routing.
 */

import { COMMODITIES } from '../../data/commodities';
import { TRADE_CITIES } from '../../data/trade';
import { CONFIG } from './config';

export interface TradeRouteState {
  cityId: string;
  enabled: boolean;
  imports: Partial<Record<string, number>>;
  exports: Partial<Record<string, number>>;
  /** Annual export quota in loads; 0 = unlimited. */
  annualQuota?: number;
  /** Quota used so far this year. */
  usedQuota?: number;
  /** Last year the quota was reset. */
  lastYear?: number;
  // --- Additive Phase 9 surfaces (TRAD-02/04/05). All optional so
  // createTradeRoutes() output and every legacy read stay unchanged. ---
  /** Per-good §19.6 order modes. Absent = legacy abstract-ledger route. */
  orders?: Partial<Record<string, TradeOrderMode>>;
  /** export_above_reserve threshold per good (loads kept in the city). */
  exportReserve?: Partial<Record<string, number>>;
  /** import_upto_target target stock per good (loads). */
  importTargets?: Partial<Record<string, number>>;
  /** Per-good annual quota override (TRAD-04). */
  perGoodQuota?: Partial<Record<string, number>>;
  /** Per-good quota used so far this year (TRAD-04). */
  usedPerGood?: Partial<Record<string, number>>;
  /** Catalog annualQuotaPerGood carried onto the route (TRAD-04). */
  catalogQuota?: number;
  /** Year the route was opened (Math.floor(tick/360) convention). */
  openYear?: number;
  /** Denarii earned by exports on this route (live runner accounting; advisor). */
  exportProceeds?: number;
  /** Denarii spent on imports on this route (live runner accounting; advisor). */
  importSpend?: number;
}

/**
 * §19.6 order mode per commodity. The classic Caesar-3 order-mode model — there
 * is no "priority" mode here; that requirement is explicitly out of scope for
 * TRAD-02 (documented to avoid silent requirements drift).
 */
export type TradeOrderMode =
  | 'no_trade'
  | 'export_all'
  | 'export_above_reserve'
  | 'import_upto_target'
  | 'stockpile';

/** Effective order for a good: the configured mode, else 'no_trade'. */
export function resolveTradeOrder(route: TradeRouteState, good: string): TradeOrderMode {
  return route.orders?.[good] ?? 'no_trade';
}

/**
 * §19.6 export predicate (pure): whether the city may export `stock` of a good
 * under the given order. `reserve` is the export_above_reserve threshold in
 * loads, `reserved` the amount reserved for domestic use (never exportable).
 */
export function exportAllowed(order: TradeOrderMode, reserve: number, stock: number, reserved: number): boolean {
  if (order === 'no_trade' || order === 'stockpile') return false;
  if (order === 'export_all') return stock > reserved;
  // export_above_reserve: the surplus must strictly exceed the threshold, else
  // there is nothing to export above the retained reserve.
  if (order === 'export_above_reserve') return stock - reserved > reserve;
  return false;
}

/** Exportable load count under an order (surplus above reserve/threshold). */
export function exportableAmount(order: TradeOrderMode, reserve: number, stock: number, reserved: number): number {
  if (!exportAllowed(order, reserve, stock, reserved)) return 0;
  if (order === 'export_all') return Math.max(0, stock - reserved);
  if (order === 'export_above_reserve') return Math.max(0, stock - reserved - reserve);
  return 0;
}

/**
 * §19.9 export transaction gate (pure, deterministic). Every export requires
 * the good to exist, not be reserved, meet its threshold (export_above_reserve),
 * and still have quoted quota. Reasons: 'not_ordered' / 'no_stock' / 'reserved'
 * / 'below_threshold' / 'quota_exhausted' / 'ok'.
 */
export interface TradeExportGateInput {
  order: TradeOrderMode;
  stock: number;
  reserved: number;
  quotaLeft: number;
  /** export_above_reserve threshold in loads (default 0 = export any surplus). */
  reserve?: number;
}

export function tradeExportGate(g: TradeExportGateInput): { allowed: boolean; reason: string | null } {
  if (g.order !== 'export_all' && g.order !== 'export_above_reserve') {
    return { allowed: false, reason: 'not_ordered' };
  }
  if (g.stock <= 0) return { allowed: false, reason: 'no_stock' };
  if (g.stock <= g.reserved) return { allowed: false, reason: 'reserved' };
  if (g.order === 'export_above_reserve' && (g.stock - g.reserved <= (g.reserve ?? 0))) {
    return { allowed: false, reason: 'below_threshold' };
  }
  if (g.quotaLeft <= 0) return { allowed: false, reason: 'quota_exhausted' };
  return { allowed: true, reason: 'ok' };
}

/**
 * §19.9 import transaction gate (pure, deterministic). An import happens only
 * when the good is below its target, quota remains, and the treasury can cover
 * the price of one load. Storage acceptance is asserted at the runner.
 * Reasons: 'not_ordered' / 'at_target' / 'quota_exhausted' / 'unaffordable' /
 * 'ok'.
 */
export interface ImportGateInput {
  order: TradeOrderMode;
  stock: number;
  target: number;
  quotaLeft: number;
  treasury: number;
  price: number;
}

export function importGatedBy(g: ImportGateInput): { allowed: boolean; reason: string | null } {
  if (g.order !== 'import_upto_target') return { allowed: false, reason: 'not_ordered' };
  if (g.stock >= g.target) return { allowed: false, reason: 'at_target' };
  if (g.quotaLeft <= 0) return { allowed: false, reason: 'quota_exhausted' };
  if (g.price > g.treasury) return { allowed: false, reason: 'unaffordable' };
  return { allowed: true, reason: 'ok' };
}

/**
 * === Per-route per-good annual quotas (§19.7, TRAD-04) ===
 *
 * Resolution order: a per-good override (`route.perGoodQuota[good]`) wins, then
 * the catalog default carried onto the route (`route.catalogQuota`), then the
 * legacy per-route `route.annualQuota`. A cap of 0 (or absent, after the chain)
 * means unlimited. A capped good suspends ONLY itself — other goods on the same
 * route keep trading. Reset is tick-based on the runner year clock
 * (`Math.floor(tick / 360)` via `resetAnnualQuotas`), never wall-clock.
 */

/** The annual quota cap for a good on a route; 0 = unlimited. */
export function quotaFor(route: TradeRouteState, good: string): number {
  const per = route.perGoodQuota?.[good];
  if (per !== undefined && per > 0) return per;
  if (route.catalogQuota !== undefined && route.catalogQuota > 0) return route.catalogQuota;
  return route.annualQuota ?? 0;
}

/** Loads of `good` still within quota this year (Infinity when uncapped). */
export function quotaRemaining(route: TradeRouteState, good: string): number {
  const cap = quotaFor(route, good);
  if (cap <= 0) return Infinity;
  return Math.max(0, cap - (route.usedPerGood?.[good] ?? 0));
}

/** True exactly when a capped good has consumed its full quota (per-good only). */
export function quotaSuspended(route: TradeRouteState, good: string): boolean {
  const cap = quotaFor(route, good);
  if (cap <= 0) return false;
  return (route.usedPerGood?.[good] ?? 0) >= cap;
}

/** Account `amount` loads of `good` against the route's per-good quota. */
export function consumeQuota(route: TradeRouteState, good: string, amount: number): void {
  route.usedPerGood = route.usedPerGood ?? {};
  route.usedPerGood[good] = (route.usedPerGood[good] ?? 0) + amount;
  route.usedQuota = (route.usedQuota ?? 0) + amount;
}

/**
 * Reset every route's per-good (and legacy per-route) quota when the tick-based
 * year changes. Deterministic: iterates Object.values(routes) in stable
 * insertion order; a no-op (returns 0) when called again within the same year.
 * Returns how many routes were reset.
 */
export function resetAnnualQuotas(routes: Record<string, TradeRouteState>, year: number): number {
  let reset = 0;
  for (const route of Object.values(routes)) {
    if (route.lastYear === year) continue;
    route.usedPerGood = {};
    route.usedQuota = 0;
    route.lastYear = year;
    reset += 1;
  }
  return reset;
}

/**
 * === Trade price state (§19.5, TRAD-05) ===
 *
 * Per good/city: a base price (mirroring the commodities catalog, so the import
 * price always exceeds the export price for the same good), an injected-tick
 * history ring (deterministic — no wall clock), a rising/steady/falling trend,
 * and a multiplicative modifier (event/relationship premium >0 or discount).
 * All functions are pure and deterministic.
 */

export interface TradePriceState {
  /** Base price for the good (import or export orientation per use). */
  base: number;
  /** Ring of recently sampled prices, newest last (max historySize). */
  history: number[];
  trend: 'rising' | 'steady' | 'falling';
  /** Multiplicative event/relationship modifier (>0 premium, <0 discount). */
  modifier: number;
  /** Ring depth for `history`. */
  historySize: number;
  /** Monotonic tick the history was last sampled at (duplicate suppression). */
  lastSampledAt?: number;
}

export function createTradePriceState(base: number, historySize = CONFIG.tradePriceHistoryWindow): TradePriceState {
  return { base, history: [], trend: 'steady', modifier: 1, historySize };
}

/** Push `price` into the history ring keyed by the injected monotonic `at`;
 *  a repeat at the same `at` does not duplicate the ring. */
export function sampleTradePrice(state: TradePriceState, price: number, at: number): void {
  if (state.lastSampledAt === at) return;
  state.lastSampledAt = at;
  state.history.push(price);
  if (state.history.length > state.historySize) state.history.shift();
}

/** Trend from the latest history entry vs the entry `window` steps earlier;
 *  steady within the catalog tolerance (in denarii). Deterministic on history. */
export function priceTrend(state: TradePriceState, at: number): 'rising' | 'steady' | 'falling' {
  void at;
  const hist = state.history;
  const window = CONFIG.tradePriceHistoryWindow;
  const tol = CONFIG.tradePriceSteadyTolerance;
  const latest = hist[hist.length - 1];
  const earlier = hist[Math.max(0, hist.length - 1 - window)];
  if (hist.length < 2 || earlier === undefined) {
    state.trend = 'steady';
    return state.trend;
  }
  if (latest - earlier > tol) state.trend = 'rising';
  else if (earlier - latest > tol) state.trend = 'falling';
  else state.trend = 'steady';
  return state.trend;
}

/** Effective transactable price: the last sampled price (or base when never
 *  sampled) scaled by the modifier, clamped to >= CONFIG.tradePriceFloor. */
export function effectivePrice(state: TradePriceState, at: number): number {
  void at;
  const last = state.history.length > 0 ? state.history[state.history.length - 1] : state.base;
  const price = Math.round(last * state.modifier);
  return Math.max(CONFIG.tradePriceFloor, price);
}

/** Deterministic event/shortage modifier entry: shifts the modifier by `delta`
 *  and does NOT write into the history. Positive delta ⇒ higher effective price;
 *  negative ⇒ lower. */
export function applyPriceEvent(state: TradePriceState, delta: number, at: number): void {
  void at;
  state.modifier = Math.max(0.01, state.modifier + delta);
}

/** Ticks a trade merchant (caravan/ship) waits for a road/berth before leaving
 *  without trading (§19.3). Consumed here to keep the balance-parity invariant;
 *  used by the transport walkers in 09-W3. */
export const MERCHANT_WAIT_TICKS = CONFIG.merchantWaitTicks;

export function createTradeRoutes(): Record<string, TradeRouteState> {
  const routes: Record<string, TradeRouteState> = {};
  for (const city of Object.values(TRADE_CITIES)) {
    routes[city.id] = { cityId: city.id, enabled: false, imports: {}, exports: {}, annualQuota: 0, usedQuota: 0 };
  }
  return routes;
}

export function setTradeRoute(routes: Record<string, TradeRouteState>, cityId: string, enabled: boolean): void {
  if (!TRADE_CITIES[cityId]) return;
  const route = routes[cityId];
  if (!route) return;
  route.enabled = enabled;
}

/**
 * Set a per-commodity import order (target stock) for a route. Imports only
 * occur for goods explicitly ordered, up to the target, so the treasury is not
 * drained by importing everything available.
 */
export function setImportOrder(routes: Record<string, TradeRouteState>, cityId: string, good: string, target: number): void {
  const route = routes[cityId];
  if (!route || target <= 0) return;
  route.imports[good] = target;
  if (!route.enabled) route.enabled = true;
}

export function tradePrice(goodId: string, cityId: string, isExport: boolean): number {
  const city = TRADE_CITIES[cityId];
  const def = COMMODITIES[goodId];
  if (!city || !def) return 0;
  const base = isExport ? def.baseExportPrice : def.baseImportPrice;
  return Math.round(base * city.priceModifier);
}

/**
 * Run one month of trade against the given treasury and stock.
 * Resets annual quotas when `year` changes, enforces the cap (suspending a
 * route when its export quota is exhausted), and returns updated treasury and
 * the number of active routes.
 */
export function tickTrade(
  treasury: number,
  stock: Record<string, number>,
  routes: Record<string, TradeRouteState>,
  year = 0,
): { treasury: number; active: number; exports: Record<string, number>; imports: Record<string, number> } {
  let active = 0;
  const exportsTotal: Record<string, number> = {};
  const importsTotal: Record<string, number> = {};
  for (const route of Object.values(routes)) {
    if (!route.enabled) continue;
    const city = TRADE_CITIES[route.cityId];
    if (!city) continue;
    // Yearly quota reset.
    if (route.usedQuota === undefined || route.lastYear !== year) {
      route.usedQuota = 0;
      route.lastYear = year;
    }
    // Suspended at quota cap (when a cap is set and reached).
    if (route.annualQuota && (route.usedQuota ?? 0) >= route.annualQuota) continue;
    active += 1;
    // Export surplus goods the city buys, within the remaining quota.
    for (const good of city.buys) {
      const amount = stock[good] ?? 0;
      if (amount <= 0) continue;
      let sell = amount;
      if (route.annualQuota) {
        const remaining = route.annualQuota - (route.usedQuota ?? 0);
        sell = Math.min(amount, remaining);
      }
      if (sell <= 0) continue;
      treasury += tradePrice(good, route.cityId, true) * sell;
      stock[good] = amount - sell;
      route.exports[good] = sell;
      exportsTotal[good] = (exportsTotal[good] ?? 0) + sell;
      route.usedQuota = (route.usedQuota ?? 0) + sell;
    }
    // Import goods the city sells, but only those explicitly ordered (route.imports
    // is a target stock per good). This gates imports by demand so the treasury is
    // not drained by importing every sellable good every tick.
    for (const good of city.sells) {
      const target = route.imports[good] ?? 0;
      if (target <= 0) continue; // not ordered → do not import
      const current = stock[good] ?? 0;
      const need = target - current;
      if (need <= 0) continue;
      const price = tradePrice(good, route.cityId, false);
      const amount = Math.min(1, need, Math.floor(treasury / price));
      if (amount <= 0) continue;
      treasury -= price * amount;
      stock[good] = current + amount;
      route.imports[good] = Math.max(target, current + amount); // keep the target
      importsTotal[good] = (importsTotal[good] ?? 0) + amount;
    }
  }
  return { treasury, active, exports: exportsTotal, imports: importsTotal };
}

/**
 * === Food trade with urban reserves (spec §14, TRAD-04) ===
 *
 * Imports are steered toward a configured target; exports are only taken from
 * the surplus above the urban reserve: exportable = available − projected city
 * consumption − admin reserves − in-transit to markets (§14.4). Reserved-for-
 * domestic stock is never exported (§14.3), and a sale that would drop the city
 * below a coverage floor raises a dangerous-export warning with actionable
 * options (§14.5). Deterministic pure functions.
 */

/** Exportable surplus per the spec §14.4 formula. */
export function exportableSurplus(
  available: number,
  projectedCityConsumption: number,
  adminReserves: number,
  inTransitToMarkets: number,
): number {
  return Math.max(0, available - projectedCityConsumption - adminReserves - inTransitToMarkets);
}

/** Exportable portion of a food given an urban reserve in months (spec §14.4). */
export function exportableAboveMonths(
  available: number,
  monthlyConsumption: number,
  reserveMonths: number,
  adminReserves = 0,
  inTransitToMarkets = 0,
): number {
  const reserve = monthlyConsumption * reserveMonths + adminReserves + inTransitToMarkets;
  return Math.max(0, available - reserve);
}

export interface DangerousExportCheck {
  /** Months of coverage remaining if the sale completed. */
  monthsAfterSale: number;
  dangerous: boolean;
  warning: string;
  options: Array<'cancel' | 'sell-anyway' | 'reduce' | 'raise-reserve'>;
}

/**
 * Evaluate whether selling `sellAmount` would leave the city dangerously low on
 * food (spec §14.5). When the remaining coverage drops below `dangerFloorMonths`
 * the caller must offer cancel / sell-anyway / reduce / raise-reserve.
 */
export function dangerousExport(
  available: number,
  monthlyConsumption: number,
  sellAmount: number,
  dangerFloorMonths = 3,
): DangerousExportCheck {
  const after = monthlyConsumption > 0 ? (available - sellAmount) / monthlyConsumption : Infinity;
  const dangerous = monthlyConsumption > 0 && after < dangerFloorMonths;
  return {
    monthsAfterSale: monthlyConsumption > 0 ? Math.round(after * 10) / 10 : Infinity,
    dangerous,
    warning: dangerous
      ? `This sale reduces the food reserve to ${Math.round(after * 10) / 10} month(s) of coverage.`
      : 'This sale leaves the urban reserve intact.',
    // Only a dangerous sale raises approval options; a safe sale offers none
    // (IN-03) — no pointless 'sell-anyway' gate on non-dangerous exports.
    options: dangerous ? ['cancel', 'sell-anyway', 'reduce', 'raise-reserve'] : [],
  };
}

/** Quality scoring of import destination priority (spec §14.2). */
export type ImportDestinationReason =
  | 'food-center'
  | 'requesting'
  | 'below-target'
  | 'accepts'
  | 'entrepot-temporary'
  | 'refuses';

export function importDestinationPriority(
  isFoodCenter: boolean,
  mode: 'request' | 'maintain' | 'accept' | 'refuse' | 'empty',
  belowTarget: boolean,
): { reason: ImportDestinationReason; priority: number } {
  if (mode === 'refuse' || mode === 'empty') return { reason: 'refuses', priority: 99 };
  if (isFoodCenter) return { reason: 'food-center', priority: 0 };
  if (mode === 'request') return { reason: 'requesting', priority: 1 };
  if (mode === 'maintain' && belowTarget) return { reason: 'below-target', priority: 2 };
  return { reason: 'accepts', priority: 3 };
}
