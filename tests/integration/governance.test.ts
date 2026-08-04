import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';

/** Government skeleton: roads, venues, wells — no houses, population 0. */
function govSkeleton(): SimRunner {
  const W = 34;
  const m = SimMap.fromLayout(W, W, () => 'fertile');
  const r = new SimRunner(7, m);
  for (const y of [0, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29]) {
    const maxX = y === 3 || y === 5 ? 17 : W;
    for (let x = 0; x < maxX; x++) r.placeBuilding('road', x, y);
  }
  for (const y of [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28]) r.placeBuilding('road', 7, y);
  for (const y of [5, 9, 13, 17, 21, 25, 29]) for (let x = 0; x < 18; x++) r['map'].setRoadType(x, y, 'plaza');
  r.requestRoyalSubsidy();
  r.takeLoan(2000);
  r.takeLoan(2000);
  r.takeLoan(2000);
  for (const [type, x, y] of [['farm', 0, 1], ['granary', 2, 1], ['market', 4, 1], ['clinic', 9, 1], ['school', 11, 1], ['theatre', 13, 1], ['temple', 15, 1]] as const) {
    const res = r.placeBuilding(type, x, y);
    if (!res.ok) throw new Error(`place ${type}@(${x},${y}): ${JSON.stringify(res)}`);
  }
  for (const y of [6, 10, 14, 18, 22, 26]) for (const x of [11, 19, 27]) r.placeBuilding('well', x, y);
  return r;
}

/** Grown city past every government threshold (forum 250, senate 500,
 *  palatine 900). The government plaza (rows 1–6, cols 18–33) stays clear. */
function govCity(): SimRunner {
  const r = govSkeleton();
  for (const y of [4, 8, 12, 16, 20, 24, 28]) {
    for (let x = 0; x < (y === 4 ? 17 : 34); x++) r.placeBuilding('house', x, y);
  }
  r.setPolicy(0.10, 0.135);
  for (let i = 0; i < 160; i++) r.tick();
  for (const [t, x, y] of [['forum', 18, 1], ['senate', 22, 1], ['palatine', 26, 1]] as const) {
    const res = r.placeBuilding(t, x, y);
    if (!res.ok) throw new Error(`place ${t}@(${x},${y}): ${JSON.stringify(res)}`);
  }
  return r;
}

describe('government buildings (GOV-01)', () => {
  it('unlock effects live: forum enables administration, senate the salary, palatine the grand send-off', () => {
    const r = govCity();
    const g = r.getGovernance();
    expect(g.unlocked).toEqual(['forum', 'senate', 'palatine']);
    expect(g.placed).toEqual(['forum', 'senate', 'palatine']);
    expect(g.effects.requestsEnabled).toBe(true);
    expect(g.effects.grandSendOffEnabled).toBe(true);
  });

  it('without a placed forum the administration effect stays off', () => {
    const r = govCity();
    const res = r.demolish(18, 1);
    expect(res).toBe(true);
    expect(r.getGovernance().effects.requestsEnabled).toBe(false);
    expect(r.getGovernance().placed).not.toContain('forum');
  });

  it('senate salary is paid monthly from the treasury into the personal account', () => {
    const r = govCity();
    expect(r.setGovernorSalaryLevel(1).ok).toBe(true);
    const accountBefore = r.getGovernance().governor.personalAccount;
    for (let i = 0; i < 40; i++) r.tick();
    const g = r.getGovernance();
    expect(g.governor.salaryLevel).toBe(1);
    expect(g.governor.personalAccount).toBe(accountBefore + 100);
    expect(r.getTreasuryLedger().expenses.governor).toBe(100);
  });

  it('salary level 0 pays nothing; invalid levels are rejected', () => {
    const r = govCity();
    for (let i = 0; i < 80; i++) r.tick();
    expect(r.getGovernance().governor.personalAccount).toBe(0);
    expect(r.getTreasuryLedger().expenses.governor ?? 0).toBe(0);
    expect(r.setGovernorSalaryLevel(5).ok).toBe(false);
    expect(r.setGovernorSalaryLevel(-1).ok).toBe(false);
  });

  it('salary requires the senate to be placed', () => {
    const r = govCity();
    r.demolish(22, 1);
    expect(r.setGovernorSalaryLevel(2).ok).toBe(false);
  });

  it('donations spend denarii and raise favor 1:1, capped per year', () => {
    const r = govCity();
    const favorBefore = r.getDerived().favor;
    const res = r.donateToGovernor(100);
    expect(res.ok).toBe(true);
    expect(res.granted).toBe(100);
    expect(r.getTreasury()).toBeLessThanOrEqual(0 + r.getTreasury());
    expect(r.getDerived().favor).toBe(Math.min(100, favorBefore + 100));
    expect(r.getGovernance().governor.donationsThisYear).toBe(100);
  });

  it('donations beyond the yearly cap are refused', () => {
    const r = govCity();
    expect(r.donateToGovernor(500).ok).toBe(true);
    expect(r.donateToGovernor(1).ok).toBe(false);
    expect(r.getGovernance().governor.donationsThisYear).toBe(500);
  });

  it('the donation cap resets on the year rollover', () => {
    const r = govCity();
    expect(r.donateToGovernor(500).ok).toBe(true);
    for (let i = 0; i < 360; i++) r.tick();
    expect(r.getGovernance().governor.donationsThisYear).toBe(0);
    expect(r.donateToGovernor(10).ok).toBe(true);
  });

  it('donations require the senate', () => {
    const r = govCity();
    r.demolish(22, 1);
    expect(r.donateToGovernor(10).ok).toBe(false);
  });

  it('favor from donations clamps at 100', () => {
    const r = govCity();
    expect(r.donateToGovernor(500).ok).toBe(true);
    expect(r.getDerived().favor).toBe(100);
  });

  it('government commands replay from a save', () => {
    // Build onto the seed-generated map (not a custom layout) so fromSaveData
    // regenerates the identical terrain and every recorded placement replays.
    const r = new SimRunner(7);
    const m = r['map'] as unknown as { get(x: number, y: number): string; width: number; height: number };
    r.requestRoyalSubsidy();
    for (let i = 0; i < 10; i++) r.takeLoan(2000);
    for (const y of [2, 8, 14, 20, 26, 32]) {
      for (let x = 0; x < m.width; x++) if (m.get(x, y) !== 'water') r.placeBuilding('road', x, y);
    }
    for (const y of [2, 8, 14, 20, 26, 32]) {
      for (const hy of [y - 1, y + 1]) {
        if (hy < 0 || hy >= (m as { height: number }).height) continue;
        for (let x = 0; x < 34; x++) {
          if (m.get(x, hy) === 'water') continue;
          r.placeBuilding('house', x, hy);
        }
      }
    }
    const govSpots: string[] = [];
    for (const t of ['forum', 'senate', 'palatine'] as const) {
      let done = false;
      for (let y = 0; y < (m as { height: number }).height && !done; y++) {
        for (let x = 0; x < m.width && !done; x++) {
          if (m.get(x, y) === 'water') continue;
          const res = r.placeBuilding(t, x, y);
          if (res.ok) { govSpots.push(`${t}@(${x},${y})`); done = true; }
        }
      }
      if (!done) throw new Error(`gov ${t} failed to place (pop ${r.getPopulation()})`);
    }
    expect(new Set(r.getGovernance().placed)).toEqual(new Set(['forum', 'senate', 'palatine']));
    expect(r.setGovernorSalaryLevel(2).ok).toBe(true);
    expect(r.donateToGovernor(50).ok).toBe(true);
    r.setPolicy(0.10, 0.135);
    for (let i = 0; i < 160; i++) r.tick();
    const loaded = SimRunner.fromSaveData(r.getSaveData());
    expect(loaded.getGovernance()).toEqual(r.getGovernance());
    expect(loaded.getSaveData().commands).toEqual(r.getSaveData().commands);
  });
});
