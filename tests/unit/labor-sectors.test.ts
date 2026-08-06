/**
 * Labor-sector allocation (POP-03, Wave 0 scaffold / 19.1-03-01/02):
 * sector-priority allocateWorkers over the runner worker pool, pinned reserve
 * semantics, pause → needed=0, restore-auto, surplus fill-all, and the
 * replayable setLaborSectorState SaveCommand (round-trip + security).
 *
 * Written against the Phase-19.1 TARGET API (labor.ts exports, getLaborSectors,
 * setLaborSectorState) — RED until 19.1-03-01/02 implement them.
 */
import { describe, expect, it } from 'vitest';
import { Map as SimMap } from '../../src/sim/map';
import { SimRunner } from '../../src/sim/runner';
import { workerPool } from '../../src/sim/economy';
import {
  LABOR_SECTOR_PRIORITY, SECTOR_IDS, buildLaborSectors, applySectorAssignments,
} from '../../src/sim/labor';
import { allocateWorkers, type LaborSector } from '../../src/sim/population';
import { migrateSave, validateSave } from '../../src/sim/saveCodec';
import type { SaveData, BuildingType } from '../../src/sim/types';
import type { BuildingInstance } from '../../src/sim/walkers';

/** 22x16 town: farm (food), granary + market (utility), warehouse (commerce),
 *  theatre (culture), well (water) along the top row with N houses along the
 *  south row. Reuses the labor.test.ts buildTown geometry/placement style. */
function sectorTown(houseCount: number): SimRunner {
  const m = SimMap.fromLayout(22, 16, (x, y) => {
    if ((x === 3 || x === 4) && (y === 2 || y === 3)) return 'fertile';
    return 'earth';
  });
  const r = new SimRunner(7, m);
  const place = (t: BuildingType, x: number, y: number) => {
    const res = r.placeBuilding(t, x, y);
    if (!res.ok) throw new Error(`place ${t}@${x},${y}: ${res.error}`);
  };
  for (let x = 2; x <= 18; x++) {
    place('road', x, 1);
    place('road', x, 8);
  }
  for (let y = 2; y <= 7; y++) {
    place('road', 2, y);
    place('road', 18, y);
  }
  place('farm', 3, 2); // food, workers 1
  place('granary', 6, 2); // infrastructure → utility, workers 1
  place('market', 9, 2); // infrastructure → utility, workers 1
  place('warehouse', 12, 2); // storage → commerce, workers 3
  place('theatre', 15, 2); // entertainment → culture, workers 2
  place('well', 17, 2); // water, workers 1
  for (let i = 0; i < houseCount; i++) place('house', 4 + i, 7);
  return r;
}

/** Private building-registry access (same style as labor.test.ts). */
function buildingsOf(r: SimRunner): BuildingInstance[] {
  return (r as unknown as { buildings: BuildingInstance[] }).buildings;
}

/** Connect every job building and give every house an active labor walker. */
function staffTown(r: SimRunner): void {
  const buildings = buildingsOf(r);
  for (const b of buildings) {
    if (b.workersRequired > 0) b.laborConnected = true;
    if (b.house) b.house.laborCooldown = 1;
  }
}

describe('labor sector priority map (19.1-03-01)', () => {
  it('defines the five known sectors with the [ASSUMED A3] priority order', () => {
    expect(LABOR_SECTOR_PRIORITY).toEqual({ food: 1, water: 2, utility: 3, commerce: 4, culture: 5 });
    expect(SECTOR_IDS).toEqual(['food', 'water', 'utility', 'commerce', 'culture']);
  });

  it('allocates scarce workers high-priority-first (pure function)', () => {
    const sectors: LaborSector[] = [
      { id: 'a', priority: 3 as const, needed: 5, assigned: 0, pinned: false },
      { id: 'b', priority: 1 as const, needed: 5, assigned: 0, pinned: false },
    ];
    allocateWorkers(sectors, 6);
    expect(sectors[1].assigned).toBe(5); // b (priority 1)
    expect(sectors[0].assigned).toBe(1); // a (priority 3)
  });
});

describe('getLaborSectors() (19.1-03-01)', () => {
  it('reports priority/needed rows and never assigns more than the pool', () => {
    const r = sectorTown(4);
    staffTown(r);
    (r as unknown as { tickLabor: () => void }).tickLabor();
    const sectors = r.getLaborSectors();
    expect(sectors.map((s) => s.id)).toEqual(expect.arrayContaining(SECTOR_IDS));
    const food = sectors.find((s) => s.id === 'food')!;
    expect(food.priority).toBe(1);
    expect(food.needed).toBeGreaterThan(0); // the farm is a food-sector job
    for (const s of sectors) expect(s.assigned).toBeLessThanOrEqual(s.needed);
    const assignedSum = sectors.reduce((sum, s) => sum + s.assigned, 0);
    expect(assignedSum).toBeLessThanOrEqual(workerPool(buildingsOf(r)));
  });

  it('with a shrunken pool the food sector (priority 1) stays fully staffed before commerce/culture', () => {
    const r = sectorTown(4);
    const buildings = buildingsOf(r);
    for (const b of buildings) if (b.workersRequired > 0) b.laborConnected = true;
    // Shrink the pool to a single house's contribution.
    for (const b of buildings) if (b.house) b.house.laborCooldown = 0;
    const h = buildings.find((b) => b.house)!;
    h.house!.laborCooldown = 1;
    (r as unknown as { tickLabor: () => void }).tickLabor();
    const sectors = r.getLaborSectors();
    const food = sectors.find((s) => s.id === 'food')!;
    const water = sectors.find((s) => s.id === 'water')!;
    const commerce = sectors.find((s) => s.id === 'commerce')!;
    const culture = sectors.find((s) => s.id === 'culture')!;
    expect(food.assigned).toBe(food.needed); // priority 1 fully staffed first
    expect(water.assigned).toBeGreaterThan(0); // priority 2 next
    expect(commerce.assigned).toBe(0);
    expect(culture.assigned).toBe(0);
  });
});

describe('pinned reserve semantics (19.1-03-01, Pitfall 2 runner-level)', () => {
  it('a pinned sector keeps its prior assigned under a shrunken pool while others starve', () => {
    const r = sectorTown(4);
    const buildings = buildingsOf(r);
    staffTown(r);
    (r as unknown as { tickLabor: () => void }).tickLabor();
    const before = r.getLaborSectors().find((s) => s.id === 'commerce')!.assigned;
    expect(before).toBeGreaterThan(0); // commerce staffed under a surplus pool

    expect(r.setLaborSectorState('commerce', { pinned: true }).ok).toBe(true);
    // Shrink the pool to a single house's contribution (4 workers).
    for (const b of buildings) if (b.house) b.house.laborCooldown = 0;
    const h = buildings.find((b) => b.house)!;
    h.house!.laborCooldown = 1;
    (r as unknown as { tickLabor: () => void }).tickLabor();
    const sectors = r.getLaborSectors();
    const commerce = sectors.find((s) => s.id === 'commerce')!;
    const culture = sectors.find((s) => s.id === 'culture')!;
    expect(commerce.pinned).toBe(true);
    // Pinned commerce reserved its staffing; unpinned culture starved.
    expect(commerce.assigned).toBeGreaterThan(0);
    expect(culture.assigned).toBe(0);
    expect(commerce.assigned).toBeLessThanOrEqual(before);
  });
});

describe('pause / restore-auto (19.1-03-01)', () => {
  it('pausing a sector reports needed=0 and its buildings release their workers', () => {
    const r = sectorTown(4);
    const buildings = buildingsOf(r);
    staffTown(r);
    (r as unknown as { tickLabor: () => void }).tickLabor();
    expect(r.setLaborSectorState('commerce', { paused: true }).ok).toBe(true);

    for (const b of buildings) if (b.house) b.house.laborCooldown = 0;
    const h = buildings.find((b) => b.house)!;
    h.house!.laborCooldown = 1;
    (r as unknown as { tickLabor: () => void }).tickLabor();
    const sectors = r.getLaborSectors();
    const commerce = sectors.find((s) => s.id === 'commerce')!;
    expect(commerce.needed).toBe(0);
    expect(commerce.assigned).toBe(0);
    const warehouse = buildings.find((b) => b.type === 'warehouse')!;
    expect(warehouse.workersAssigned).toBe(0);
  });

  it('restore-auto unpauses and reverts to default priority allocation', () => {
    const r = sectorTown(4);
    staffTown(r);
    expect(r.setLaborSectorState('commerce', { pinned: true }).ok).toBe(true);
    expect(r.setLaborSectorState('commerce', { paused: true }).ok).toBe(true);
    expect(r.getLaborSectors().find((s) => s.id === 'commerce')).toMatchObject({ pinned: true, paused: true });

    expect(r.setLaborSectorState('commerce', { pinned: false, paused: false }).ok).toBe(true);
    const s = r.getLaborSectors().find((x) => x.id === 'commerce')!;
    expect(s.pinned).toBe(false);
    expect(s.paused).toBe(false);
    (r as unknown as { tickLabor: () => void }).tickLabor();
    expect(r.getLaborSectors().find((x) => x.id === 'commerce')!.assigned).toBeGreaterThan(0);
  });
});

describe('surplus pool fill-all (labor.test.ts invariant preserved)', () => {
  it('with a healthy surplus pool every job is filled (assignedWorkers === jobDemand)', () => {
    const r = sectorTown(6);
    staffTown(r);
    (r as unknown as { tickLabor: () => void }).tickLabor();
    const state = r.getState();
    expect(state.assignedWorkers).toBe(state.totalJobs);
    expect(state.assignedWorkers).toBeLessThanOrEqual(state.totalWorkers);
  });
});

describe('setLaborSectorState SaveCommand (19.1-03-02)', () => {
  it('round-trips pin/pause through getSaveData → migrate+validate → fromSaveData', () => {
    const map = SimMap.fromLayout(22, 16, (x, y) => {
      if ((x === 3 || x === 4) && (y === 2 || y === 3)) return 'fertile';
      return 'earth';
    });
    const r = new SimRunner(7, map);
    const place = (t: BuildingType, x: number, y: number) => {
      const res = r.placeBuilding(t, x, y);
      if (!res.ok) throw new Error(`place ${t}@${x},${y}: ${res.error}`);
    };
    for (let x = 2; x <= 18; x++) {
      place('road', x, 1);
      place('road', x, 8);
    }
    for (let y = 2; y <= 7; y++) {
      place('road', 2, y);
      place('road', 18, y);
    }
    place('farm', 3, 2);
    place('granary', 6, 2);
    place('market', 9, 2);
    place('warehouse', 12, 2);
    place('theatre', 15, 2);
    place('well', 17, 2);
    place('house', 4, 7);
    place('house', 5, 7);
    // Issue the commands up front so the original run and the replay share the
    // SAME command timeline (the replay model replays all commands at tick 0 —
    // a mid-run command would legitimately diverge, like the demolish case in
    // population-determinism.test.ts). The tick window then derives labor
    // connectivity + staffing identically on both sides.
    expect(r.setLaborSectorState('food', { pinned: true }).ok).toBe(true);
    expect(r.setLaborSectorState('commerce', { paused: true }).ok).toBe(true);
    for (let i = 0; i < 340; i++) r.tick();

    const migrated = migrateSave(r.getSaveData());
    const validated = validateSave(migrated);
    expect(validated.ok).toBe(true);
    const loaded = SimRunner.fromSaveData(migrated as SaveData, map);
    expect(loaded.getLaborSectors()).toEqual(r.getLaborSectors());
  });

  it('rejects unknown sectors and invalid config with {ok:false} (never a throw)', () => {
    const r = sectorTown(2);
    const unknown = r.setLaborSectorState('bogus-sector', {});
    expect(unknown.ok).toBe(false);
    expect(unknown.error ?? '').toMatch(/unknown/);
    const badConfig = r.setLaborSectorState('food', { pinned: 'yes' as unknown as boolean });
    expect(badConfig.ok).toBe(false);
    expect(badConfig.error ?? '').toMatch(/invalid/);
  });

  it('validateSave rejects a malformed setLaborSectorState as malformed-command', () => {
    const r = sectorTown(1);
    for (let i = 0; i < 10; i++) r.tick();
    const good = r.getSaveData();
    const badSector = { ...good, commands: [...good.commands, { kind: 'setLaborSectorState', sector: 42 }] };
    const badPinned = { ...good, commands: [...good.commands, { kind: 'setLaborSectorState', sector: 'food', pinned: 'yes' }] };
    const badPaused = { ...good, commands: [...good.commands, { kind: 'setLaborSectorState', sector: 'food', paused: 1 }] };
    for (const save of [badSector, badPinned, badPaused]) {
      const result = validateSave(save);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('malformed-command');
    }
  });
});

describe('labor.ts pure helpers (19.1-03-01)', () => {
  /** Minimal labor-connected BuildingInstance of a known type @ workers. */
  function fake(type: BuildingType, workers: number): BuildingInstance {
    return {
      id: 0, type, x: 0, y: 0, footprint: 1, workersAssigned: 0, workersRequired: workers,
      active: true, laborConnected: true, laborCooldown: 0, spawnCooldown: 0, stock: {},
    } as unknown as BuildingInstance;
  }

  it('buildLaborSectors groups by BUILDINGS category and folds paused → needed=0', () => {
    const buildings = [fake('farm', 2), fake('well', 1), fake('granary', 3), fake('warehouse', 5), fake('theatre', 4)];
    const sectors = buildLaborSectors(buildings, { commerce: { paused: true } });
    const food = sectors.find((s) => s.id === 'food')!;
    const water = sectors.find((s) => s.id === 'water')!;
    const utility = sectors.find((s) => s.id === 'utility')!;
    const commerce = sectors.find((s) => s.id === 'commerce')!;
    const culture = sectors.find((s) => s.id === 'culture')!;
    expect(food.needed).toBe(2);
    expect(water.needed).toBe(1);
    expect(utility.needed).toBe(3); // granary
    expect(commerce.needed).toBe(0); // paused
    expect(culture.needed).toBe(4);
  });

  it('applySectorAssignments distributes within per-building caps only', () => {
    // Two food buildings with caps 2 and 8; the sector has only 5 to give.
    const buildings = [fake('farm', 2), fake('orchard', 8)];
    const sectors = buildLaborSectors(buildings);
    const food = sectors.find((s) => s.id === 'food')!;
    food.assigned = 5;
    applySectorAssignments(buildings, sectors);
    const [a, b] = buildings;
    // Greedy within caps: 5 workers, cap 2 fills first, then 3 of the 8-cap.
    expect(a.workersAssigned).toBeLessThanOrEqual(a.workersRequired);
    expect(b.workersAssigned).toBeLessThanOrEqual(b.workersRequired);
    expect(a.workersAssigned + b.workersAssigned).toBe(5);
  });
});
