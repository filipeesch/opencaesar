/**
 * Housing levels — data-driven housing evolution requirements and rewards.
 * A house levels up when it has access to the required services/goods; it
 * levels down when it loses them.
 */

export interface HousingLevelDef {
  level: number;
  name: string;
  /** Maximum residents housed at this level. */
  capacity: number;
  /** Tax revenue per resident per month. */
  taxPerCapita: number;
  /** Merge footprint (n x n) of the largest block a level can grow into
   *  (game.md §11.3): 1x1 for levels 0-10, 2x2 for 11-14, 3x3 for 15-18,
   *  4x4 for 19-20. Monotonic; drives the HOUS-02 merge ladder. */
  footprint: number;
  /** Services required to reach this level (service keys). */
  requires: string[];
  /** Goods required to reach this level (commodity ids). */
  requiresGoods: string[];
  /** Desirability contribution of a house at this level. */
  desirability: number;
}

export const HOUSING_LEVELS: readonly HousingLevelDef[] = [
  // NOTE: 'tools' (data/commodities.ts houseGood:false) is a workshop good with
  // no per-house delivery path — it is intentionally excluded from the
  // cumulative housing requirements. The catalog-consistency gate in
  // data/validate.ts enforces requiresGoods ⊆ FOOD_TYPES ∪ houseGood.
  { level: 0, name: 'Vacant Lot', capacity: 0, taxPerCapita: 0, footprint: 1, requires: [], requiresGoods: [], desirability: 0 },
  { level: 1, name: 'Crude Hut', capacity: 20, taxPerCapita: 1, footprint: 1, requires: ['well'], requiresGoods: [], desirability: 1 },
  { level: 2, name: 'Hut', capacity: 40, taxPerCapita: 2, footprint: 1, requires: ['well'], requiresGoods: ['wheat'], desirability: 2 },
  { level: 3, name: 'Rough Hovel', capacity: 60, taxPerCapita: 3, footprint: 1, requires: ['well', 'market'], requiresGoods: ['wheat'], desirability: 3 },
  { level: 4, name: 'Hovel', capacity: 80, taxPerCapita: 4, footprint: 1, requires: ['well', 'market'], requiresGoods: ['wheat', 'pottery'], desirability: 4 },
  { level: 5, name: 'Decrepit Insulae', capacity: 100, taxPerCapita: 5, footprint: 1, requires: ['well', 'market', 'fountain'], requiresGoods: ['wheat', 'pottery'], desirability: 5 },
  { level: 6, name: 'Poor Insulae', capacity: 120, taxPerCapita: 6, footprint: 1, requires: ['well', 'market', 'fountain'], requiresGoods: ['wheat', 'pottery', 'vegetables'], desirability: 6 },
  { level: 7, name: 'Average Insulae', capacity: 150, taxPerCapita: 7, footprint: 1, requires: ['market', 'fountain', 'school'], requiresGoods: ['wheat', 'pottery', 'vegetables', 'fish'], desirability: 7 },
  { level: 8, name: 'Fair Insulae', capacity: 180, taxPerCapita: 8, footprint: 1, requires: ['market', 'fountain', 'school', 'clinic'], requiresGoods: ['wheat', 'pottery', 'vegetables', 'fish', 'furniture'], desirability: 8 },
  { level: 9, name: 'Good Insulae', capacity: 200, taxPerCapita: 9, footprint: 1, requires: ['market', 'fountain', 'school', 'clinic', 'library'], requiresGoods: ['wheat', 'pottery', 'vegetables', 'fish', 'furniture', 'wine'], desirability: 9 },
  { level: 10, name: 'Common Apartments', capacity: 220, taxPerCapita: 10, footprint: 1, requires: ['market', 'fountain', 'school', 'clinic', 'library', 'theatre'], requiresGoods: ['wheat', 'pottery', 'vegetables', 'fish', 'furniture', 'wine', 'oil'], desirability: 10 },
  { level: 11, name: 'Pleasant Apartments', capacity: 240, taxPerCapita: 11, footprint: 2, requires: ['market', 'fountain', 'hospital', 'school', 'library', 'theatre', 'temple'], requiresGoods: ['wheat', 'pottery', 'vegetables', 'fruit', 'fish', 'furniture', 'wine', 'oil'], desirability: 11 },
  { level: 12, name: 'Snazzy Apartments', capacity: 260, taxPerCapita: 12, footprint: 2, requires: ['market', 'fountain', 'hospital', 'school', 'library', 'theatre', 'temple', 'amphitheatre'], requiresGoods: ['wheat', 'pottery', 'vegetables', 'fruit', 'fish', 'meat', 'furniture', 'wine', 'oil'], desirability: 12 },
  { level: 13, name: 'Decrepit Small Villa', capacity: 280, taxPerCapita: 13, footprint: 2, requires: ['market', 'fountain', 'hospital', 'school', 'library', 'theatre', 'temple', 'amphitheatre', 'forum'], requiresGoods: ['wheat', 'pottery', 'vegetables', 'fruit', 'fish', 'meat', 'furniture', 'wine', 'oil'], desirability: 13 },
  { level: 14, name: 'Poor Small Villa', capacity: 300, taxPerCapita: 14, footprint: 2, requires: ['market', 'fountain', 'hospital', 'school', 'library', 'theatre', 'temple', 'amphitheatre', 'forum', 'garden'], requiresGoods: ['wheat', 'pottery', 'vegetables', 'fruit', 'fish', 'meat', 'furniture', 'wine', 'oil'], desirability: 14 },
  { level: 15, name: 'Average Small Villa', capacity: 320, taxPerCapita: 15, footprint: 3, requires: ['market', 'fountain', 'hospital', 'school', 'library', 'theatre', 'temple', 'amphitheatre', 'forum', 'garden'], requiresGoods: ['wheat', 'pottery', 'vegetables', 'fruit', 'fish', 'meat', 'furniture', 'wine', 'oil'], desirability: 15 },
  { level: 16, name: 'Good Small Villa', capacity: 340, taxPerCapita: 16, footprint: 3, requires: ['market', 'fountain', 'hospital', 'school', 'library', 'theatre', 'temple', 'amphitheatre', 'forum', 'garden', 'senate'], requiresGoods: ['wheat', 'pottery', 'vegetables', 'fruit', 'fish', 'meat', 'furniture', 'wine', 'oil'], desirability: 16 },
  { level: 17, name: 'Poor Big Villa', capacity: 360, taxPerCapita: 17, footprint: 3, requires: ['market', 'fountain', 'hospital', 'school', 'library', 'theatre', 'temple', 'amphitheatre', 'forum', 'garden', 'senate'], requiresGoods: ['wheat', 'pottery', 'vegetables', 'fruit', 'fish', 'meat', 'furniture', 'wine', 'oil'], desirability: 17 },
  { level: 18, name: 'Average Big Villa', capacity: 380, taxPerCapita: 18, footprint: 3, requires: ['market', 'fountain', 'hospital', 'school', 'library', 'theatre', 'temple', 'amphitheatre', 'forum', 'garden', 'senate'], requiresGoods: ['wheat', 'pottery', 'vegetables', 'fruit', 'fish', 'meat', 'furniture', 'wine', 'oil'], desirability: 18 },
  { level: 19, name: 'Good Big Villa', capacity: 400, taxPerCapita: 19, footprint: 4, requires: ['market', 'fountain', 'hospital', 'school', 'library', 'theatre', 'temple', 'amphitheatre', 'forum', 'garden', 'senate'], requiresGoods: ['wheat', 'pottery', 'vegetables', 'fruit', 'fish', 'meat', 'furniture', 'wine', 'oil'], desirability: 19 },
  { level: 20, name: 'Luxury Villa', capacity: 420, taxPerCapita: 20, footprint: 4, requires: ['market', 'fountain', 'hospital', 'school', 'library', 'theatre', 'temple', 'amphitheatre', 'forum', 'garden', 'senate', 'grand_temple'], requiresGoods: ['wheat', 'pottery', 'vegetables', 'fruit', 'fish', 'meat', 'furniture', 'wine', 'oil'], desirability: 20 },
];

export function housingLevelName(level: number): string {
  const lvl = HOUSING_LEVELS.find((l) => l.level === level);
  return lvl ? lvl.name : 'Unknown';
}

export function housingCapacity(level: number): number {
  const lvl = HOUSING_LEVELS.find((l) => l.level === level);
  return lvl ? lvl.capacity : 0;
}

/**
 * Civic service gates for the live 5-tier house model (Phase 12): service
 * access a house must have fresh (walker-delivered) to evolve INTO the given
 * tier index — the live-sim counterpart of the HOUSING_LEVELS service
 * requirements above. Domus (index 3) needs health, Villa (index 4) needs
 * literacy; the entertainment key mirrors the 21-level model's highest
 * requirement and is unreachable in the 5-tier live model. Legacy tiers
 * (Shack/Hovel/Insula) need no services, so scenarios without civic buildings
 * are behaviorally unchanged.
 */
export const TIER_CIVIC_GATES: Readonly<Record<number, readonly string[]>> = {
  3: ['health'],
  4: ['literacy'],
  5: ['entertainment'],
};
