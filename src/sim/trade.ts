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
}

export function createTradeRoutes(): Record<string, TradeRouteState> {
  const routes: Record<string, TradeRouteState> = {};
  for (const city of Object.values(TRADE_CITIES)) {
    routes[city.id] = { cityId: city.id, enabled: false, imports: {}, exports: {} };
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
 * Returns updated treasury and per-route import/export totals.
 */
export function tickTrade(
  treasury: number,
  stock: Record<string, number>,
  routes: Record<string, TradeRouteState>,
): { treasury: number; active: number } {
  let active = 0;
  for (const route of Object.values(routes)) {
    if (!route.enabled) continue;
    const city = TRADE_CITIES[route.cityId];
    if (!city) continue;
    active += 1;
    // Export surplus goods the city buys.
    for (const good of city.buys) {
      const amount = stock[good] ?? 0;
      if (amount <= 0) continue;
      treasury += tradePrice(good, route.cityId, true) * amount;
      stock[good] = 0;
      route.exports[good] = amount;
    }
    // Import goods the city sells, capped by treasury.
    for (const good of city.sells) {
      const price = tradePrice(good, route.cityId, false);
      const amount = Math.min(1, Math.floor(treasury / price));
      if (amount <= 0) continue;
      treasury -= price * amount;
      stock[good] = (stock[good] ?? 0) + amount;
      route.imports[good] = amount;
    }
  }
  return { treasury, active };
}
