/**
 * SC2: running out of money has a visible consequence — wage arrears →
 * desirability penalty → housing downgrade; recovery clears the penalty and
 * the house can re-evolve.
 *
 * Scenario: evolve the food city (houses land at Crude Hut, level 1), then
 * bankrupt it (drain the treasury, taxRate 0 / wageRate 0.5 so wages are
 * unpaid). Sustained arrears deepen the desirability penalty (arrearsDepth
 * grows after desirabilityArrearsDepthPeriodTicks), pushing desirability below
 * the current level's tolerance → the house devolves after toleranceTicks.
 * When taxes resume, arrears clear and the house re-evolves.
 */
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';
import { CONFIG } from '../../src/sim/config';
import { DEFAULT_HYSTERESIS } from '../../src/sim/housingEvolution';
import { buildFoodCity, foodChainMap } from '../helpers';
import type { BuildingInstance } from '../../src/sim/walkers';
import type { BuildingType } from '../../src/sim/types';

/** Drain the treasury by placing buildings across the map until nearly broke. */
function bankruptCity(r: SimRunner): void {
  for (let y = 0; y < 12 && r.getTreasury() >= 80; y++) {
    for (let x = 0; x < 12 && r.getTreasury() >= 80; x++) r.placeBuilding('fountain', x, y);
  }
  for (let y = 0; y < 12 && r.getTreasury() >= 20; y++) {
    for (let x = 0; x < 12 && r.getTreasury() >= 20; x++) r.placeBuilding('garden', x, y);
  }
  for (let y = 0; y < 12 && r.getTreasury() >= 4; y++) {
    for (let x = 0; x < 12 && r.getTreasury() >= 4; x++) r.placeBuilding('road', x, y);
  }
  // taxRate 0 (no income), wageRate 0.5 (wages due) → treasury stays at 0
  r.setPolicy(0, 0.5);
}

/**
 * A service-rich city that can hold a mid-level house (level 6, over Warm
 * Insulae requiring well/market/fountain + wheat/pottery/vegetables): every
 * cumulative service/good of levels 0-6 is present, so the ONLY downgrade
 * driver left is the unpaid-wages desirability penalty (desirability 0 < the
 * level's tolerance window) — the SC2 scenario under the 21-level model.
 */
function midLevelCity(): SimRunner {
  const m = SimMap.fromLayout(24, 24, () => 'fertile');
  const r = new SimRunner(21, m);
  const place = (t: BuildingType, x: number, y: number) => {
    const res = r.placeBuilding(t, x, y);
    if (!res.ok) throw new Error(`place ${t}@(${x},${y}): ${JSON.stringify(res)}`);
  };
  r.requestRoyalSubsidy();
  for (let i = 0; i < 10; i++) r.takeLoan(2000);
  // Road rows (1, 5, 9, 13, 17, 21) + a vertical spine at x=13 linking them.
  for (const y of [1, 5, 9, 13, 17, 21]) for (let x = 0; x < 24; x++) if (x !== 13) place('road', x, y);
  for (let y = 0; y < 24; y++) place('road', 13, y);
  place('farm', 0, 2); // 3x3
  place('granary', 4, 2); // 2x2
  place('market', 7, 2); // 2x2
  place('warehouse', 10, 2); // 2x2
  place('well', 16, 6); // adjacent to road row y=5
  place('fountain', 18, 6); // adjacent to road row y=5
  place('house', 2, 8); // adjacent to road row y=9
  place('house', 4, 8); // adjacent to road row y=9
  // warehouse carries the non-food cumulative goods of levels 0-6.
  const wh = (r['buildings'] as BuildingInstance[]).find((b) => b.type === 'warehouse')!;
  const stock = wh.stock as Record<string, number>;
  for (const g of ['pottery', 'vegetables']) stock[g] = 200;
  r.setPolicy(0.5, 0.5);
  // A mid-level house (level 6) whose requirements are present; the wage
  // penalty below drives it down (desirability tolerance 6-5 = 1 > 0).
  const hs = (r['buildings'] as BuildingInstance[]).filter((b) => b.type === 'house');
  hs[0].house!.level = 6;
  return r;
}

function firstHouseLevel(r: SimRunner): number {
  const h = r.getState().buildings.find((b) => b.type === 'house');
  expect(h).toBeDefined();
  return h!.house!.level;
}

describe('SC2: wage arrears cause a visible housing downgrade', () => {
  it('persistent unpaid wages produce arrears and devolve houses below their level threshold', () => {
    const r = midLevelCity();
    // The mid-level house starts at level 6 (over Warm Insulae).
    expect(firstHouseLevel(r)).toBe(6);

    bankruptCity(r);
    // arrearsDepth reaches 1 after desirabilityArrearsDepthPeriodTicks, then the
    // tolerance window (toleranceTicks, the 21-level hysteresis) completes the
    // downgrade.
    for (let i = 0; i < CONFIG.desirabilityArrearsDepthPeriodTicks + DEFAULT_HYSTERESIS.toleranceTicks + 40; i++) r.tick();

    const advisor = r.getFinanceAdvisor();
    expect(advisor.arrears).toBe(true);
    expect(advisor.balance).toBe(0);
    const after = firstHouseLevel(r);
    expect(after).toBeLessThan(6);
  });

  it('when the treasury recovers and wages are paid, arrears clear and houses can re-evolve', () => {
    const r = midLevelCity();
    bankruptCity(r);
    for (let i = 0; i < CONFIG.desirabilityArrearsDepthPeriodTicks + DEFAULT_HYSTERESIS.toleranceTicks + 40; i++) r.tick();
    expect(r.getFinanceAdvisor().arrears).toBe(true);
    const bankruptLevel = firstHouseLevel(r);

    // recover: restore a balanced policy (taxes exceed wages → treasury grows,
    // arrears clear, and desirability recovers so the house can re-evolve)
    r.setPolicy(0.5, 0.5);
    for (let i = 0; i < 400; i++) r.tick();

    expect(r.getFinanceAdvisor().arrears).toBe(false);
    expect(r.getTreasury()).toBeGreaterThan(0);
    expect(firstHouseLevel(r)).toBeGreaterThanOrEqual(bankruptLevel);
  });
});

describe('SC2: finance advisor reflects arrears live', () => {
  it('a healthy city reports no arrears and a positive balance', () => {
    const r = new SimRunner(23, foodChainMap());
    buildFoodCity(r);
    r.setPolicy(0.5, 0.2);
    for (let i = 0; i < 120; i++) r.tick();
    const v = r.getFinanceAdvisor();
    expect(v.arrears).toBe(false);
    expect(v.balance).toBe(r.getTreasury());
  });
});
