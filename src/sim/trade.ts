/**
 * Trade — self-contained import/export pricing and routing.
 */

import { COMMODITIES } from '../../data/commodities';
import { TRADE_CITIES } from '../../data/trade';

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
}

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
    options: dangerous ? ['cancel', 'sell-anyway', 'reduce', 'raise-reserve'] : ['sell-anyway'],
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
