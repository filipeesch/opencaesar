/**
 * Commodity catalog — data-driven definitions of every tradable/consumable good.
 * Balance lives here, not scattered in simulation code.
 */

export type CommodityCategory = 'food' | 'raw' | 'manufactured' | 'luxury' | 'special';

export interface CommodityDef {
  id: string;
  name: string;
  category: CommodityCategory;
  /** Where the commodity is stored (granary = food only; warehouse = everything else). */
  storage: 'granary' | 'warehouse';
  /** How many months one load lasts a household (foods are shorter-lived). */
  durabilityMonths: number;
  baseImportPrice: number;
  baseExportPrice: number;
  houseGood: boolean;
  tradable: boolean;
  icon: string;
}

export const COMMODITIES: Record<string, CommodityDef> = {
  wheat: {
    id: 'wheat',
    name: 'Wheat',
    category: 'food',
    storage: 'granary',
    durabilityMonths: 1,
    baseImportPrice: 40,
    baseExportPrice: 30,
    houseGood: true,
    tradable: true,
    icon: 'commodity_wheat',
  },
  vegetables: {
    id: 'vegetables',
    name: 'Vegetables',
    category: 'food',
    storage: 'granary',
    durabilityMonths: 1,
    baseImportPrice: 34,
    baseExportPrice: 25,
    houseGood: true,
    tradable: true,
    icon: 'commodity_vegetables',
  },
  fruit: {
    id: 'fruit',
    name: 'Fruit',
    category: 'food',
    storage: 'granary',
    durabilityMonths: 1,
    baseImportPrice: 44,
    baseExportPrice: 33,
    houseGood: true,
    tradable: true,
    icon: 'commodity_fruit',
  },
  meat: {
    id: 'meat',
    name: 'Meat',
    category: 'food',
    storage: 'granary',
    durabilityMonths: 1,
    baseImportPrice: 48,
    baseExportPrice: 36,
    houseGood: true,
    tradable: true,
    icon: 'commodity_meat',
  },
  fish: {
    id: 'fish',
    name: 'Fish',
    category: 'food',
    storage: 'granary',
    durabilityMonths: 1,
    baseImportPrice: 46,
    baseExportPrice: 34,
    houseGood: true,
    tradable: true,
    icon: 'commodity_fish',
  },
  clay: {
    id: 'clay',
    name: 'Clay',
    category: 'raw',
    storage: 'warehouse',
    durabilityMonths: 24,
    baseImportPrice: 24,
    baseExportPrice: 18,
    houseGood: false,
    tradable: true,
    icon: 'commodity_clay',
  },
  timber: {
    id: 'timber',
    name: 'Timber',
    category: 'raw',
    storage: 'warehouse',
    durabilityMonths: 24,
    baseImportPrice: 28,
    baseExportPrice: 21,
    houseGood: false,
    tradable: true,
    icon: 'commodity_timber',
  },
  iron: {
    id: 'iron',
    name: 'Iron Ore',
    category: 'raw',
    storage: 'warehouse',
    durabilityMonths: 24,
    baseImportPrice: 40,
    baseExportPrice: 30,
    houseGood: false,
    tradable: true,
    icon: 'commodity_iron',
  },
  marble: {
    id: 'marble',
    name: 'Marble',
    category: 'raw',
    storage: 'warehouse',
    durabilityMonths: 36,
    baseImportPrice: 60,
    baseExportPrice: 45,
    houseGood: false,
    tradable: true,
    icon: 'commodity_marble',
  },
  olives: {
    id: 'olives',
    name: 'Olives',
    category: 'raw',
    storage: 'warehouse',
    durabilityMonths: 12,
    baseImportPrice: 32,
    baseExportPrice: 24,
    houseGood: false,
    tradable: true,
    icon: 'commodity_olives',
  },
  grapes: {
    id: 'grapes',
    name: 'Grapes',
    category: 'raw',
    storage: 'warehouse',
    durabilityMonths: 12,
    baseImportPrice: 34,
    baseExportPrice: 26,
    houseGood: false,
    tradable: true,
    icon: 'commodity_grapes',
  },
  pottery: {
    id: 'pottery',
    name: 'Pottery',
    category: 'manufactured',
    storage: 'warehouse',
    durabilityMonths: 12,
    baseImportPrice: 48,
    baseExportPrice: 36,
    houseGood: true,
    tradable: true,
    icon: 'commodity_pottery',
  },
  furniture: {
    id: 'furniture',
    name: 'Furniture',
    category: 'manufactured',
    storage: 'warehouse',
    durabilityMonths: 10,
    baseImportPrice: 52,
    baseExportPrice: 39,
    houseGood: true,
    tradable: true,
    icon: 'commodity_furniture',
  },
  oil: {
    id: 'oil',
    name: 'Oil',
    category: 'manufactured',
    storage: 'warehouse',
    durabilityMonths: 8,
    baseImportPrice: 50,
    baseExportPrice: 37,
    houseGood: true,
    tradable: true,
    icon: 'commodity_oil',
  },
  wine: {
    id: 'wine',
    name: 'Wine',
    category: 'manufactured',
    storage: 'warehouse',
    durabilityMonths: 9,
    baseImportPrice: 54,
    baseExportPrice: 40,
    houseGood: true,
    tradable: true,
    icon: 'commodity_wine',
  },
  tools: {
    id: 'tools',
    name: 'Tools',
    category: 'manufactured',
    storage: 'warehouse',
    durabilityMonths: 6,
    baseImportPrice: 58,
    baseExportPrice: 44,
    houseGood: false,
    tradable: true,
    icon: 'commodity_tools',
  },
};

export const FOOD_TYPES = ['wheat', 'vegetables', 'fruit', 'meat', 'fish'] as const;

export function isFood(id: string): boolean {
  return FOOD_TYPES.includes(id as (typeof FOOD_TYPES)[number]);
}

export function isHouseGood(id: string): boolean {
  const def = COMMODITIES[id];
  return def ? def.houseGood : false;
}

export function commodityName(id: string): string {
  return COMMODITIES[id]?.name ?? id;
}
