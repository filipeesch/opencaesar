/**
 * Trade cities — data-driven trading partners. Each city buys/sells commodities.
 */

export interface TradeCityDef {
  id: string;
  name: string;
  /** Distance in "months" affects trade profit/arrival cadence. */
  distance: number;
  /** Commodities this city buys (exports) at a markup. */
  buys: string[];
  /** Commodities this city sells (imports) at a discount. */
  sells: string[];
  /** Price modifiers applied on top of base export/import prices. */
  priceModifier: number;
}

export const TRADE_CITIES: Record<string, TradeCityDef> = {
  massilia: {
    id: 'massilia', name: 'Massilia', distance: 3, priceModifier: 0.9,
    buys: ['wheat', 'pottery', 'furniture', 'oil', 'wine', 'tools', 'marble'],
    sells: ['wheat', 'pottery', 'furniture', 'oil', 'wine', 'tools', 'marble', 'clay', 'timber', 'iron'],
  },
  caralis: {
    id: 'caralis', name: 'Caralis', distance: 6, priceModifier: 1.1,
    buys: ['vegetables', 'fruit', 'meat', 'fish', 'pottery', 'wine'],
    sells: ['wheat', 'pottery', 'wine', 'oil', 'iron', 'timber'],
  },
  londinium: {
    id: 'londinium', name: 'Londinium', distance: 8, priceModifier: 1.3,
    buys: ['pottery', 'furniture', 'tools', 'wine', 'oil'],
    sells: ['wheat', 'meat', 'timber', 'iron', 'fish'],
  },
  tarraco: {
    id: 'tarraco', name: 'Tarraco', distance: 10, priceModifier: 1.5,
    buys: ['marble', 'tools', 'wine'],
    sells: ['wheat', 'pottery', 'clay', 'iron'],
  },
};

export function tradeCityName(id: string): string {
  return TRADE_CITIES[id]?.name ?? id;
}
