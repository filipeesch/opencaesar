/**
 * Trade cities — data-driven trading partners. Each city buys/sells commodities.
 *
 * Phase 9 (TRAD-01): the §19.1 regional-map model — each city carries land/sea
 * routing, a route-opening cost, a merchant arrival frequency, an optional
 * annual quota cap per good, per-good price modifiers, a diplomatic standing,
 * and optional event keys. All fields are deterministic data.
 */

export type LandOrSea = 'land' | 'sea';
export type CityRelationship = 'neutral' | 'friendly' | 'hostile';

export interface TradeCityDef {
  id: string;
  name: string;
  /** Distance in "months" affects trade profit/arrival cadence. */
  distance: number;
  /** Commodities this city buys (exports) at a markup. */
  buys: string[];
  /** Commodities this city sells (imports) at a discount. */
  sells: string[];
  /** Whole-city price modifier applied on top of base export/import prices. */
  priceModifier: number;
  /** §19.1 how trade with the city reaches the region: land (road caravan)
   *  or sea (merchant ship). */
  landOrSea: LandOrSea;
  /** §19.1 denarii charged against the treasury when the route is opened. */
  routeOpeningCost: number;
  /** §19.1 ticks between merchant arrivals on this route. */
  merchantFrequency: number;
  /** §19.1 optional default annual per-good quota cap in loads (0/unset = limited
   *  only by the route's own legacy annualQuota, which 0 means unlimited). */
  annualQuotaPerGood?: number;
  /** §19.1 diplomatic standing (business standing — a commercial relationship
   *  only, never a hostile-uses-of-force reading). */
  relationship: CityRelationship;
  /** §19.1 optional event keys the city participates in. */
  events?: string[];
  /** §19.1 per-good price modifiers applied on top of the whole-city
   *  priceModifier and the commodity base. Default 1 when absent. */
  priceModifiers?: Partial<Record<string, number>>;
}

export const TRADE_CITIES: Record<string, TradeCityDef> = {
  massilia: {
    id: 'massilia', name: 'Massilia', distance: 3, priceModifier: 0.9,
    landOrSea: 'land', routeOpeningCost: 500, merchantFrequency: 160,
    annualQuotaPerGood: 12, relationship: 'neutral',
    buys: ['wheat', 'pottery', 'furniture', 'oil', 'wine', 'tools', 'marble'],
    sells: ['wheat', 'pottery', 'furniture', 'oil', 'wine', 'tools', 'marble', 'clay', 'timber', 'iron'],
    priceModifiers: {
      wheat: 0.95, pottery: 0.9, furniture: 0.88, oil: 0.92, wine: 0.9,
      tools: 0.85, marble: 0.95, clay: 0.9, timber: 0.88, iron: 0.9,
    },
  },
  caralis: {
    id: 'caralis', name: 'Caralis', distance: 6, priceModifier: 1.1,
    landOrSea: 'sea', routeOpeningCost: 800, merchantFrequency: 220,
    annualQuotaPerGood: 15, relationship: 'neutral',
    buys: ['vegetables', 'fruit', 'meat', 'fish', 'pottery', 'wine'],
    sells: ['wheat', 'pottery', 'wine', 'oil', 'iron', 'timber'],
    priceModifiers: {
      vegetables: 1.05, fruit: 1.1, meat: 1.15, fish: 1.1, pottery: 1.1,
      wine: 1.05, wheat: 1.1, oil: 1.15, iron: 1.1, timber: 1.05,
    },
  },
  londinium: {
    id: 'londinium', name: 'Londinium', distance: 8, priceModifier: 1.3,
    landOrSea: 'sea', routeOpeningCost: 1200, merchantFrequency: 300,
    annualQuotaPerGood: 30, relationship: 'neutral',
    buys: ['pottery', 'furniture', 'tools', 'wine', 'oil'],
    sells: ['wheat', 'meat', 'timber', 'iron', 'fish'],
    priceModifiers: {
      pottery: 1.3, furniture: 1.25, tools: 1.3, wine: 1.35, oil: 1.3,
      wheat: 1.3, meat: 1.35, timber: 1.25, iron: 1.3, fish: 1.3,
    },
  },
  tarraco: {
    id: 'tarraco', name: 'Tarraco', distance: 10, priceModifier: 1.5,
    landOrSea: 'land', routeOpeningCost: 1500, merchantFrequency: 420,
    annualQuotaPerGood: 40, relationship: 'neutral',
    buys: ['marble', 'tools', 'wine'],
    sells: ['wheat', 'pottery', 'clay', 'iron'],
    priceModifiers: {
      marble: 1.5, tools: 1.45, wine: 1.55, wheat: 1.5, pottery: 1.5,
      clay: 1.45, iron: 1.5,
    },
  },
};

export function tradeCityName(id: string): string {
  return TRADE_CITIES[id]?.name ?? id;
}
