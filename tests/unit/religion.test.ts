/**
 * Religion unit tests (Phase 13, RELI-01): per-god access decay, worship
 * aggregation, favor contribution, and temple placement god validation.
 */
import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';
import { tickCivic } from '../../src/sim/housing';
import { computeFavor, computeServiceCoverage, GODS } from '../../src/sim/services';
import type { HouseInstance } from '../../src/sim/walkers';

function fakeHouse(): HouseInstance {
  return {
    tier: 0,
    foodCooldown: 0,
    waterCooldown: 0,
    laborCooldown: 0,
    evolveCounter: 0,
    devolveCounter: 0,
  };
}

describe('per-god access decay (RELI-01)', () => {
  it('godAccess TTL decrements per tick and is dropped at zero', () => {
    const house = fakeHouse();
    house.godAccess = { ceres: 3, neptune: 1 };
    tickCivic(house);
    expect(house.godAccess).toEqual({ ceres: 2 });
    tickCivic(house);
    expect(house.godAccess).toEqual({ ceres: 1 });
    tickCivic(house);
    expect(house.godAccess).toEqual({});
  });

  it('decay is per-god — other gods keep their TTL untouched', () => {
    const house = fakeHouse();
    house.godAccess = { jupiter: 50 };
    house.services = { health: 10 };
    tickCivic(house);
    expect(house.godAccess).toEqual({ jupiter: 49 });
    expect(house.services).toEqual({ health: 9 });
  });
});

describe('worship aggregation (RELI-01)', () => {
  it('aggregate religion coverage is the average worship across the 5 gods', () => {
    expect(computeServiceCoverage({ doctorCoverage: 0, educationCoverage: 0, entertainmentCoverage: 0, godWorship: { ceres: 0.5 } }).religion).toBeCloseTo(0.1);
    expect(computeServiceCoverage({ doctorCoverage: 0, educationCoverage: 0, entertainmentCoverage: 0, godWorship: { jupiter: 1, neptune: 1, ceres: 1, bacchus: 1, mercury: 1 } }).religion).toBe(1);
    expect(computeServiceCoverage({ doctorCoverage: 0, educationCoverage: 0, entertainmentCoverage: 0, godWorship: {} }).religion).toBe(0);
  });

  it('computeFavor grants +20 per worshipped god, clamped at 100', () => {
    expect(computeFavor({})).toBe(0);
    expect(computeFavor({ ceres: 0.3 })).toBe(20);
    expect(computeFavor({ jupiter: 1, neptune: 0.1, ceres: 0.9, bacchus: 0.4, mercury: 0.01 })).toBe(100);
  });
});

function tinyRunner(): SimRunner {
  const m = SimMap.fromLayout(8, 8, () => 'earth');
  const r = new SimRunner(7, m);
  for (let x = 0; x <= 6; x++) r.placeBuilding('road', x, 0);
  for (let x = 0; x <= 4; x++) r.placeBuilding('road', x, 1);
  return r;
}

describe('temple placement (RELI-01)', () => {
  it('rejects an unknown god with invalid-god and spends nothing', () => {
    const r = tinyRunner();
    const before = r.getTreasury();
    const res = r.placeBuilding('temple', 2, 2, { god: 'satan' });
    expect(res).toEqual({ ok: false, error: 'invalid-god' });
    expect(r.getTreasury()).toBe(before);
  });

  it('defaults to jupiter when no god is given (legacy compatibility)', () => {
    const r = tinyRunner();
    const res = r.placeBuilding('temple', 2, 2);
    expect(res.ok).toBe(true);
    const b = r.getState().buildings.find((x) => x.type === 'temple');
    expect(b?.god).toBe('jupiter');
  });

  it('persists a custom god on the building and in the replayable command', () => {
    const r = tinyRunner();
    r.placeBuilding('temple', 2, 2, { god: 'ceres' });
    const b = r.getState().buildings.find((x) => x.type === 'temple');
    expect(b?.god).toBe('ceres');
    const cmds = r['saveCommands'] as Array<{ kind: string; type: string; god?: string }>;
    expect(cmds.some((c) => c.kind === 'place' && c.type === 'temple' && c.god === 'ceres')).toBe(true);
  });

  it('every GOD is accepted', () => {
    for (const god of GODS) {
      const r = tinyRunner();
      const res = r.placeBuilding('temple', 2, 2, { god });
      expect(res.ok).toBe(true);
    }
  });

  it('grand_temple accepts a god and defaults to jupiter', () => {
    const r = tinyRunner();
    r.takeLoan(2000);
    expect(r.placeBuilding('grand_temple', 0, 2, { god: 'neptune' }).ok).toBe(true);
    const b = r.getState().buildings.find((x) => x.type === 'grand_temple');
    expect(b?.god).toBe('neptune');
  });
});

describe('festivals (RELI-01)', () => {
  function drainTreasury(r: SimRunner, to: number): void {
    (r as unknown as { treasuryAccount: { balance: number } }).treasuryAccount.balance = to;
  }

  it('rejects an unknown tier', () => {
    const r = tinyRunner();
    expect(r.holdFestival('mega').error).toBe('unknown-tier');
    expect(r.getFestival().prepTier).toBeNull();
  });

  it('rejects a festival the treasury cannot afford', () => {
    const r = tinyRunner();
    drainTreasury(r, 50);
    expect(r.holdFestival('small').error).toBe('not-enough-money');
  });

  it('spends the tier cost immediately as a festival expense', () => {
    const r = tinyRunner();
    const before = r.getTreasury();
    expect(r.holdFestival('small').ok).toBe(true);
    expect(r.getTreasury()).toBe(before - 100);
    expect(r.getFestival().prepTier).toBe('small');
  });

  it('allows only one festival at a time (plan or active boost)', () => {
    const r = tinyRunner();
    expect(r.holdFestival('small').ok).toBe(true);
    expect(r.holdFestival('small').error).toBe('festival-in-progress');
    for (let i = 0; i < 40; i++) r.tick(); // prep done → boost window active
    expect(r.getFestival().boostTier).toBe('small');
    expect(r.holdFestival('small').error).toBe('festival-in-progress');
  });

  it('prep advances one month per 40-tick month, then the boost window runs down', () => {
    const r = tinyRunner();
    r.holdFestival('small');
    expect(r.getFestival().prepTier).toBe('small');
    expect(r.getFestival().boostTier).toBeNull();
    for (let i = 0; i < 40; i++) r.tick();
    expect(r.getFestival().prepTier).toBeNull();
    expect(r.getFestival().boostTier).toBe('small');
    expect(r.getFestival().boostRemaining).toBe(480);
    // 12 months of decrement: the boost expires at tick 520.
    for (let i = 0; i < 480; i++) r.tick();
    expect(r.getFestival().boostTier).toBeNull();
    expect(r.getFestival().boostRemaining).toBe(0);
  });

  it('provincial prep takes 3 months and gives the biggest boost', () => {
    const r = tinyRunner();
    drainTreasury(r, 2000);
    expect(r.holdFestival('provincial').ok).toBe(true);
    for (let i = 0; i < 120; i++) r.tick();
    expect(r.getFestival().boostTier).toBe('provincial');
  });
});
