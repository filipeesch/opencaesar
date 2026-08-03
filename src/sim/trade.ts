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
    // Import goods the city sells, capped by treasury.
    for (const good of city.sells) {
      const price = tradePrice(good, route.cityId, false);
      const amount = Math.min(1, Math.floor(treasury / price));
      if (amount <= 0) continue;
      treasury -= price * amount;
      stock[good] = (stock[good] ?? 0) + amount;
      route.imports[good] = amount;
      importsTotal[good] = (importsTotal[good] ?? 0) + amount;
    }
  }
  return { treasury, active, exports: exportsTotal, imports: importsTotal };
}
