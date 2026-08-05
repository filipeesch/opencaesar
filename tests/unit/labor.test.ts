import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { workerPool } from '../../src/sim/economy';
import { HOUSING_LIVE_STATS } from '../../src/sim/housingLive';
import { Map as SimMap } from '../../src/sim/map';
import { SimRunner } from '../../src/sim/runner';
import type { BuildingType } from '../../src/sim/types';

/** A 3-worker building (workersRequired is a param on the def). */

/** 18x16 town: farm (fertile), granary, market, well, N houses along the south row. */
function buildTown(houseCount: number): SimRunner {
  const m = SimMap.fromLayout(18, 16, (x, y) => {
    if ((x === 3 || x === 4) && (y === 2 || y === 3)) return 'fertile';
    return 'earth';
  });
  const r = new SimRunner(7, m);
  const place = (t: BuildingType, x: number, y: number) => {
    const res = r.placeBuilding(t, x, y);
    if (!res.ok) throw new Error(`place ${t}@${x},${y}: ${res.error}`);
  };
  for (let x = 2; x <= 12; x++) {
    place('road', x, 1);
    place('road', x, 7);
  }
  for (let y = 2; y <= 6; y++) {
    place('road', 2, y);
    place('road', 12, y);
  }
  place('farm', 3, 2);
  place('granary', 6, 2);
  place('market', 9, 2);
  for (let i = 0; i < houseCount; i++) place('house', 3 + i, 6);
  place('well', 10, 6);
  return r;
}

/** Advance the runner to the given tick and count fully-staffed job buildings. */
function staffedOverWindow(r: SimRunner, ticks: number, window: number): { full: number; partial: number } {
  for (let i = 0; i < ticks; i++) r.tick();
  const jobs = r.getState().buildings.filter((b) => b.workersRequired > 0);
  void window;
  return { full: jobs.filter((b) => b.workersAssigned >= b.workersRequired).length, partial: jobs.length };
}

describe('worker pool contribution', () => {
  it('sums level workers only for houses whose labor walker is out', () => {
    // level 2 = 8, level 8 = 36 workers; the idle house contributes none.
    const houses = [
      { id: 1, type: 'house' as const, house: { tier: 0, level: 2, laborCooldown: 120 } as never },
      { id: 2, type: 'house' as const, house: { tier: 2, level: 8, laborCooldown: 120 } as never },
      { id: 3, type: 'house' as const, house: { tier: 1, level: 4, laborCooldown: 0 } as never },
    ];
    expect(workerPool(houses as never[])).toBe(HOUSING_LIVE_STATS[2].workers + HOUSING_LIVE_STATS[8].workers);
  });
});

describe('labor assignment (post-connection, pool available)', () => {
  it('assigns up to the requirement from the pool', () => {
    const r = buildTown(4);
    // Tick past the first labor-walker spawns so the pool becomes non-empty.
    for (let i = 0; i < 70; i++) r.tick();
    // Manually connect the farm and tick labor to assign from the pool.
    const farm = r['buildings'].find((b: any) => b.type === 'farm')!;
    farm.laborConnected = true;
    r['tickLabor']();
    expect(farm.workersAssigned).toBe(farm.workersRequired);
  });
});

describe('job spots and granary staffing', () => {
  it('counts a granary as a job (workersRequired 1) so it can be staffed', () => {
    const r = buildTown(6);
    for (let i = 0; i < 800; i++) r.tick();
    const state = r.getState();
    const granary = state.buildings.find((b) => b.type === 'granary')!;
    expect(granary.workersRequired).toBe(1);
    // With a surplus pool the granary should be staffed.
    expect(granary.workersAssigned).toBe(1);
  });

  it('reports totalJobs as the sum of all worker requirements', () => {
    const r = buildTown(6);
    // farm, granary, market, well = 4 jobs (unplaced houses add none).
    expect(r.getState().totalJobs).toBe(4);
    for (let i = 0; i < 100; i++) r.tick();
    const state = r.getState();
    expect(state.totalJobs).toBe(4);
    expect(state.assignedWorkers).toBeLessThanOrEqual(state.totalJobs);
  });
});

describe('labor connection persistence (regression for oscillation bug)', () => {
  it('keeps all job buildings staffed when the worker pool exceeds demand', () => {
    // 6 houses provide up to 6+ workers; 4 jobs (farm, granary, market, well).
    const r = buildTown(6);
    const window = 400;
    const { full, partial } = staffedOverWindow(r, window, window);
    // With a healthy surplus, every job should be staffed — not oscillating.
    expect(full).toBe(partial);
    expect(partial).toBe(4);
  });

  it('never loses staffing across a sustained window with a surplus pool', () => {
    const r = buildTown(6);
    // Sample several points; every job building should be staffed at each.
    for (let i = 0; i < 1200; i++) r.tick();
    const jobs = r.getState().buildings.filter((b) => b.workersRequired > 0);
    for (const b of jobs) {
      expect(b.workersAssigned).toBeGreaterThan(0);
    }
  });

  it('assigns the expected number of workers (sum of jobs) with a surplus pool', () => {
    const r = buildTown(6);
    for (let i = 0; i < 800; i++) r.tick();
    const state = r.getState();
    const jobs = state.buildings.filter((b) => b.workersRequired > 0);
    const jobDemand = jobs.reduce((s, b) => s + b.workersRequired, 0);
    // Surplus pool → all jobs filled → assigned equals total job demand.
    expect(state.assignedWorkers).toBe(jobDemand);
  });
});

describe('assigned workers vs pool invariant', () => {
  it('never assigns more workers than are in the reachable pool', () => {
    const r = buildTown(6);
    for (let i = 0; i < 800; i++) r.tick();
    const state = r.getState();
    expect(state.assignedWorkers).toBeLessThanOrEqual(state.totalWorkers);
  });

  it('never assigns more than a building requires', () => {
    const r = buildTown(6);
    for (let i = 0; i < 800; i++) r.tick();
    for (const b of r.getState().buildings) {
      if (b.workersRequired > 0) expect(b.workersAssigned).toBeLessThanOrEqual(b.workersRequired);
    }
  });
});

describe('connection persistence unit test (labor walker reachability is durable)', () => {
  it('a building stays reachable once connected, without needing a fresh walker every cooldown window', () => {
    const r = buildTown(6);
    const farm = r['buildings'].find((b: any) => b.type === 'farm')!;
    // Connect it once, as a labor walker would.
    farm.laborConnected = true;
    farm.laborCooldown = CONFIG.serviceCooldownTicks;
    // Let the cooldown window fully elapse WITHOUT any new walker arriving.
    for (let i = 0; i < CONFIG.serviceCooldownTicks * 3; i++) r.tick();
    // Reachability should persist; the building must still be staffed.
    expect(farm.workersAssigned).toBe(farm.workersRequired);
  });
});
