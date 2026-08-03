/**
 * Housing: coverage cooldown decay, desirability, and tier evolution.
 * Evolution requires sustained food + water + labor coverage above the
 * desirability threshold; persistent food/water shortfall devolves.
 */

import { CONFIG, HOUSE_TIERS } from './config';
import type { Map } from './map';
import { roadDesirability } from './roadTypes';
import type { MessageType, Policy } from './types';
import type { BuildingInstance } from './walkers';

/**
 * Desirability of a house tile: base terrain value plus the wage/tax policy
 * spread, plus a bonus per active service (food/water/labor coverage), minus
 * a penalty while wages go unpaid. Clamped to [0, 200].
 */
export function desirabilityOf(
  map: Map,
  x: number,
  y: number,
  policy: Policy,
  wagesUnpaid: boolean,
  services: { food: boolean; water: boolean; labor: boolean } = { food: false, water: false, labor: false },
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
  const penalty = wagesUnpaid ? CONFIG.desirabilityUnpaidWagesPenalty : 0;
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
 */
export function tickHousing(
  map: Map,
  buildings: BuildingInstance[],
  policy: Policy,
  wagesUnpaid: boolean,
  emit: (type: MessageType, text: string) => void,
): HousingTickResult {
  let evolved = 0;
  let devolved = 0;

  for (const b of buildings) {
    const house = b.house;
    if (!house) continue;

    house.foodCooldown = Math.max(0, house.foodCooldown - 1);
    house.waterCooldown = Math.max(0, house.waterCooldown - 1);
    house.laborCooldown = Math.max(0, house.laborCooldown - 1);

    const hasFood = house.foodCooldown > 0;
    const hasWater = house.waterCooldown > 0;
    const hasLabor = house.laborCooldown > 0;

    if (hasFood && hasWater) {
      house.devolveCounter = 0;
      const desirability = desirabilityOf(map, b.x, b.y, policy, wagesUnpaid, {
        food: hasFood,
        water: hasWater,
        labor: hasLabor,
      });
      if (hasLabor && desirability >= tierThreshold(house.tier + 2)) {
        house.evolveCounter += 1;
        if (house.evolveCounter >= CONFIG.evolveWindowTicks && house.tier < HOUSE_TIERS.length - 1) {
          house.tier += 1;
          house.evolveCounter = 0;
          evolved += 1;
          emit('house-evolved', `House evolved to ${HOUSE_TIERS[house.tier].name}`);
        }
      } else {
        house.evolveCounter = 0;
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
