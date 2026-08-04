/**
 * Housing: coverage cooldown decay, desirability, and tier evolution.
 * Evolution requires sustained food + water + labor coverage above the
 * desirability threshold; persistent food/water shortfall devolves.
 */

import { CONFIG, HOUSE_TIERS } from './config';
import { TIER_CIVIC_GATES } from '../../data/housing';
import type { Map } from './map';
import { roadDesirability } from './roadTypes';
import type { MessageType, Policy } from './types';
import type { BuildingInstance } from './walkers';

/**
 * Civic service gates (Phase 12, ENTR-01/HEAL-01/EDUC-01): a house needs the
 * listed service access fresh (walker-delivered, see `tickCivic`) to evolve
 * INTO the given 1-indexed tier (TIER_CIVIC_GATES from data/housing.ts).
 * Additive: scenarios without civic buildings have no fresh access, so the
 * gates simply block tiers the house could not satisfy anyway — legacy
 * evolution paths are unchanged.
 */
function civicGateSatisfied(house: NonNullable<BuildingInstance['house']>, tier: number): boolean {
  const requires = TIER_CIVIC_GATES[tier];
  if (!requires) return true;
  return requires.every((s) => (house.services?.[s] ?? 0) > 0);
}

/**
 * Phase 12 civic wellness: decay the walker-delivered service access flags
 * (previously dead state — never decremented), then move the house's
 * health/literacy/entertainment stats toward their covered ceiling while the
 * matching access is fresh. Purely deterministic.
 */
export function tickCivic(house: NonNullable<BuildingInstance['house']>): void {
  if (house.services) {
    for (const [service, ttl] of Object.entries(house.services)) {
      const next = (ttl ?? 0) - 1;
      if (next <= 0) delete house.services[service];
      else house.services[service] = next;
    }
  }
  const civic = (house.civic ??= { health: 0, literacy: 0, entertainment: 0 });
  const fresh = (key: string) => (house.services?.[key] ?? 0) > 0;
  civic.health = clampCivic(civic.health + (fresh('health') ? CONFIG.civicRisePerTick : -CONFIG.civicDecayPerTick));
  civic.literacy = clampCivic(civic.literacy + (fresh('literacy') ? CONFIG.civicRisePerTick : -CONFIG.civicDecayPerTick));
  civic.entertainment = clampCivic(civic.entertainment + (fresh('entertainment') ? CONFIG.civicRisePerTick : -CONFIG.civicDecayPerTick));
}

function clampCivic(v: number): number {
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

/**
 * Desirability of a house tile: base terrain value plus the wage/tax policy
 * spread, plus a bonus per active service (food/water/labor coverage), minus
 * the unpaid-wages penalty — which deepens by one base penalty per full
 * arrears-depth period of consecutive unpaid wages. Clamped to [0, 200].
 */
export function desirabilityOf(
  map: Map,
  x: number,
  y: number,
  policy: Policy,
  wagesUnpaid: boolean,
  services: { food: boolean; water: boolean; labor: boolean } = { food: false, water: false, labor: false },
  arrearsDepth = 0,
): number {
  let base = 0;
  switch (map.get(x, y)) {
    case 'fertile':
      base = 40;
      break;
    case 'earth':
      base = 30;
      break;
    case 'trees':
      base = 20;
      break;
    case 'rock':
      base = 10;
      break;
    default:
      base = 0;
  }
  const policyPart = (policy.wageRate - policy.taxRate) * CONFIG.desirabilityPolicyGain;
  const servicesBonus =
    (services.food ? CONFIG.desirabilityServiceBonus : 0) +
    (services.water ? CONFIG.desirabilityServiceBonus : 0) +
    (services.labor ? CONFIG.desirabilityServiceBonus : 0);
  const penalty = wagesUnpaid ? CONFIG.desirabilityUnpaidWagesPenalty * (1 + arrearsDepth) : 0;
  // Adjacent-road desirability: each orthogonally adjacent road tile contributes
  // its road type's desirability (null/plain roads read as dirt = 0). Roadblock
  // tiles contribute their (0) desirability, adding nothing.
  let roadBonus = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (map.get(nx, ny) === 'road') roadBonus += roadDesirability(map.roadTypeAt(nx, ny) ?? 'dirt');
  }
  const total = base + policyPart + servicesBonus - penalty + roadBonus;
  if (total < 0) return 0;
  if (total > 200) return 200;
  return Math.round(total);
}

/** Desirability needed to reach the given 1-indexed tier (1..5). */
export function tierThreshold(tier: number): number {
  return tier * CONFIG.desirabilityThresholdPerTier;
}

export interface HousingTickResult {
  evolved: number;
  devolved: number;
}

/**
 * Advance every house by one tick: decay service cooldowns, then apply the
 * evolution rules. Emits house-evolved / house-devolved messages.
 * `arrearsDepth` (unpaid-wage arrears steps, 0 = none) deepens the desirability
 * penalty; a house whose desirability stays below its current tier threshold
 * devolves even while food and water hold.
 */
export function tickHousing(
  map: Map,
  buildings: BuildingInstance[],
  policy: Policy,
  wagesUnpaid: boolean,
  emit: (type: MessageType, text: string) => void,
  arrearsDepth = 0,
): HousingTickResult {
  let evolved = 0;
  let devolved = 0;

  for (const b of buildings) {
    const house = b.house;
    if (!house) continue;

    house.foodCooldown = Math.max(0, house.foodCooldown - 1);
    house.waterCooldown = Math.max(0, house.waterCooldown - 1);
    house.laborCooldown = Math.max(0, house.laborCooldown - 1);
    tickCivic(house);

    const hasFood = house.foodCooldown > 0;
    const hasWater = house.waterCooldown > 0;
    const hasLabor = house.laborCooldown > 0;

    if (hasFood && hasWater) {
      const desirability = desirabilityOf(map, b.x, b.y, policy, wagesUnpaid, {
        food: hasFood,
        water: hasWater,
        labor: hasLabor,
      }, arrearsDepth);
      if (desirability < tierThreshold(house.tier)) {
        // Sustained desirability below the current tier devolves (e.g. deep
        // wage arrears), even though food and water are holding.
        house.evolveCounter = 0;
        house.devolveCounter += 1;
        if (house.devolveCounter >= CONFIG.devolveWindowTicks && house.tier > 0) {
          house.tier -= 1;
          house.devolveCounter = 0;
          devolved += 1;
          emit('house-devolved', `House devolved to ${HOUSE_TIERS[house.tier].name}`);
        }
      } else {
        house.devolveCounter = 0;
        if (hasLabor && desirability >= tierThreshold(house.tier + 2)) {
          if (civicGateSatisfied(house, house.tier + 1)) {
            house.evolveCounter += 1;
            if (house.evolveCounter >= CONFIG.evolveWindowTicks && house.tier < HOUSE_TIERS.length - 1) {
              house.tier += 1;
              house.evolveCounter = 0;
              evolved += 1;
              emit('house-evolved', `House evolved to ${HOUSE_TIERS[house.tier].name}`);
            }
          } else {
            // Civic gate unmet: the tier requires service access the house
            // lacks (health/literacy/entertainment) — keep the counter pinned.
            house.evolveCounter = 0;
          }
        } else {
          house.evolveCounter = 0;
        }
      }
    } else {
      house.evolveCounter = 0;
      house.devolveCounter += 1;
      if (house.devolveCounter >= CONFIG.devolveWindowTicks && house.tier > 0) {
        house.tier -= 1;
        house.devolveCounter = 0;
        devolved += 1;
        emit('house-devolved', `House devolved to ${HOUSE_TIERS[house.tier].name}`);
      }
    }
  }

  return { evolved, devolved };
}

/**
 * === House food inventory, consumption & variety (AGRI-01, spec §13) ===
 *
 * Each house holds a per-food inventory, consumes daily from its population,
 * favours the basic food but any food sustains the home (§13.3), counts variety
 * from stock > 0 or a 30-day access memory (§13.4–13.5), stores per class
 * (§13.6), accepts seller deliveries (§13.7) and reacts to shortages (§13.9).
 * Additive to the live foodCooldown model; purely deterministic.
 */

export interface HouseFoodEntry {
  units: number;
  /** Tick of the last delivery of this food (memory anchor). */
  lastDeliveryDay: number;
  /** Days of remaining access memory for this food. */
  accessMemoryDays: number;
  /** Market id that last served this food (spec §12.13). */
  servingMarketId?: string;
}

export interface HouseFoodInventory {
  foods: Partial<Record<string, HouseFoodEntry>>;
  basicFood: string;
}

/** Class-based home food capacity in units (spec §13.6). */
export const HOUSE_FOOD_CAPACITY = [20, 40, 80, 160, 250, 400];

/** Memory & regression tolerance days (spec §13.5). */
export const FOOD_MEMORY_DAYS = 30;
export const FOOD_REGRESSION_TOLERANCE_DAYS = 30;

/** Create an empty house inventory keyed to a tier. */
export function createHouseFood(basicFood = 'wheat'): HouseFoodInventory {
  return { foods: {}, basicFood };
}

/**
 * Build a `HouseFoodInventory` from a flat per-food unit map (e.g. a house's
 * live `foodInventory` record) so the inventory helpers (houseFoodDays,
 * foodVariety) can be reused over state that grew outside the inventory module.
 */
export function houseFoodFromUnits(units: Record<string, number>, basicFood = 'wheat'): HouseFoodInventory {
  const foods: HouseFoodInventory['foods'] = {};
  for (const [f, u] of Object.entries(units)) {
    if (u <= 0) continue;
    foods[f] = { units: u, lastDeliveryDay: 0, accessMemoryDays: FOOD_MEMORY_DAYS };
  }
  return { foods, basicFood };
}

/** Storage capacity for a given house tier index (spec §13.6). */
export function homeStorageCapacity(tier: number): number {
  return HOUSE_FOOD_CAPACITY[Math.max(0, Math.min(HOUSE_FOOD_CAPACITY.length - 1, tier))] ?? 0;
}

/** Daily consumption from population × base × level × difficulty (§13.2). */
export function dailyFoodConsumption(
  population: number,
  basePerPerson = 0.03,
  levelModifier = 1,
  difficultyModifier = 1,
): number {
  return population * basePerPerson * levelModifier * difficultyModifier;
}

/** Total units stored across foods. */
export function totalHouseFood(inv: HouseFoodInventory): number {
  let t = 0;
  for (const e of Object.values(inv.foods)) t += e?.units ?? 0;
  return t;
}

/** Free capacity in units given the tier. */
export function homeFreeCapacity(inv: HouseFoodInventory, tier: number): number {
  return Math.max(0, homeStorageCapacity(tier) - totalHouseFood(inv));
}

/**
 * Consume `need` units daily. The basic food is consumed first (§13.3), but any
 * available food sustains the house — a house with only vegetables never
 * starves for lack of wheat. Returns what could not be consumed (shortfall).
 */
export function consumeHouseFood(inv: HouseFoodInventory, need: number): number {
  let remaining = need;
  if (remaining > 0) {
    const order = [inv.basicFood, ...Object.keys(inv.foods).filter((f) => f !== inv.basicFood)];
    for (const f of order) {
      if (remaining <= 0) break;
      const e = inv.foods[f];
      if (!e || e.units <= 0) continue;
      const take = Math.min(e.units, remaining);
      e.units -= take;
      remaining -= take;
    }
  }
  return remaining;
}

/**
 * Count food variety the house "has": stock > 0 or access within memory (§13.4).
 */
export function foodVariety(inv: HouseFoodInventory): number {
  let variety = 0;
  for (const e of Object.values(inv.foods)) {
    const entry = e as HouseFoodEntry;
    if (entry.units > 0) {
      variety += 1;
    } else if (entry.accessMemoryDays > 0) {
      variety += 1;
    }
  }
  return variety;
}

/** Decay access memory and per-food lastDeliveries past the memory window. */
export function tickHouseFoodMemory(inv: HouseFoodInventory): void {
  for (const e of Object.values(inv.foods)) {
    const entry = e as HouseFoodEntry;
    if (entry.accessMemoryDays > 0) entry.accessMemoryDays -= 1;
  }
}

/**
 * Deliver food from a passing seller (§13.7): respects free capacity, per-food
 * free space and the basic-food priority; returns the amount accepted and
 * records the serving market + delivery day.
 */
export function deliverToHouse(
  inv: HouseFoodInventory,
  food: string,
  amount: number,
  tier: number,
  marketId: string,
  day: number,
): number {
  const free = homeFreeCapacity(inv, tier);
  if (free <= 0 || amount <= 0) return 0;
  const accepted = Math.min(amount, free);
  const entry = inv.foods[food] ?? { units: 0, lastDeliveryDay: 0, accessMemoryDays: 0 };
  entry.units += accepted;
  entry.lastDeliveryDay = day;
  entry.accessMemoryDays = FOOD_MEMORY_DAYS;
  entry.servingMarketId = marketId;
  inv.foods[food] = entry;
  return accepted;
}

/** Days of food remaining at current consumption. */
export function houseFoodDays(inv: HouseFoodInventory, dailyNeed: number): number {
  const total = totalHouseFood(inv);
  if (dailyNeed <= 0) return total > 0 ? Infinity : 0;
  return total / dailyNeed;
}

/** House food states (spec §13.8). */
export type HouseFoodState = 'none-needed' | 'well-stocked' | 'adequate' | 'low' | 'critical' | 'no-food' | 'prolonged-famine' | 'insufficient-variety' | 'awaiting-market';

export function houseFoodState(inv: HouseFoodInventory, dailyNeed: number, requiredVariety: number): HouseFoodState {
  const days = houseFoodDays(inv, dailyNeed);
  if (dailyNeed <= 0) return 'none-needed';
  if (days >= 60) return 'well-stocked';
  if (days >= 30) return 'adequate';
  if (days <= 0) return 'no-food';
  if (days < 10) return 'critical';
  if (requiredVariety > foodVariety(inv)) return 'insufficient-variety';
  return 'low';
}

/** Shortage effects by class of food state (spec §13.9). */
export interface ShortageEffects {
  stopEvolution: boolean;
  moodDrop: number;
  healthDrop: number;
  regression: boolean;
  emigration: boolean;
  crime: boolean;
}

/** Effects given days without food (prolonged famine triggers regression/emigration/crime). */
export function foodShortageEffects(starvedDays: number): ShortageEffects {
  const stopEvolution = starvedDays > 0;
  const moodDrop = starvedDays > 0 ? Math.min(20, starvedDays) : 0;
  const healthDrop = starvedDays > 0 ? Math.min(15, starvedDays) : 0;
  const prolonged = starvedDays >= FOOD_REGRESSION_TOLERANCE_DAYS;
  return {
    stopEvolution,
    moodDrop,
    healthDrop,
    regression: prolonged,
    emigration: prolonged,
    crime: prolonged,
  };
}
