/**
 * SC2: running out of money has a visible consequence — wage arrears →
 * desirability penalty → housing downgrade; recovery clears the penalty and
 * the house can re-evolve.
 *
 * Scenario: evolve the food city to tier 2 (healthy), then bankrupt it
 * (drain the treasury, taxRate 0 / wageRate 0.5 so wages are unpaid). Sustained
 * arrears deepen the desirability penalty (arrearsDepth grows after
 * desirabilityArrearsDepthPeriodTicks), pushing desirability below the tier
 * threshold → the house devolves. When taxes resume, arrears clear and the
 * house re-evolves.
 */
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { CONFIG } from '../../src/sim/config';
import { buildFoodCity, foodChainMap } from '../helpers';

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

function firstHouseTier(r: SimRunner): number {
  const h = r.getState().buildings.find((b) => b.type === 'house');
  expect(h).toBeDefined();
  return h!.house!.tier;
}

describe('SC2: wage arrears cause a visible housing downgrade', () => {
  it('persistent unpaid wages produce arrears and devolve houses below their tier threshold', () => {
    const r = new SimRunner(21, foodChainMap());
    buildFoodCity(r);
    // evolve to tier 2 first so the downgrade is measurable
    r.setPolicy(0.5, 0.5);
    for (let i = 0; i < 400; i++) r.tick();
    const before = firstHouseTier(r);
    expect(before).toBeGreaterThanOrEqual(1);

    bankruptCity(r);
    // arrearsDepth reaches 1 after desirabilityArrearsDepthPeriodTicks, then the
    // devolve window (devolveWindowTicks) completes the downgrade
    for (let i = 0; i < CONFIG.desirabilityArrearsDepthPeriodTicks + CONFIG.devolveWindowTicks + 40; i++) r.tick();

    const advisor = r.getFinanceAdvisor();
    expect(advisor.arrears).toBe(true);
    expect(advisor.balance).toBe(0);
    const after = firstHouseTier(r);
    expect(after).toBeLessThan(before);
  });

  it('when the treasury recovers and wages are paid, arrears clear and houses can re-evolve', () => {
    const r = new SimRunner(22, foodChainMap());
    buildFoodCity(r);
    r.setPolicy(0.5, 0.5);
    for (let i = 0; i < 400; i++) r.tick();
    bankruptCity(r);
    for (let i = 0; i < CONFIG.desirabilityArrearsDepthPeriodTicks + CONFIG.devolveWindowTicks + 40; i++) r.tick();
    expect(r.getFinanceAdvisor().arrears).toBe(true);
    const bankruptTier = firstHouseTier(r);

    // recover: restore a balanced policy (taxes exceed wages → treasury grows,
    // arrears clear, and desirability recovers so the house can re-evolve)
    r.setPolicy(0.5, 0.5);
    for (let i = 0; i < 400; i++) r.tick();

    expect(r.getFinanceAdvisor().arrears).toBe(false);
    expect(r.getTreasury()).toBeGreaterThan(0);
    expect(firstHouseTier(r)).toBeGreaterThanOrEqual(bankruptTier);
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
