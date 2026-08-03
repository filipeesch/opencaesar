import { describe, it, expect } from 'vitest';
import {
  advisorsFrom, overlaysFrom, waterOverlayData, residenceInspection, productionInspection, storageInspection, marketInspection, walkerInspection,
} from '../../src/sim/advisors';
import {
  WaterSystem, FOUNTAIN_DESIRABILITY_BONUS, WELL_DESIRABILITY_PENALTY, RESERVOIR_STORAGE_CAPACITY,
} from '../../src/sim/water';
import type { ReservoirState } from '../../src/sim/water';

const snap = {
  population: 500, treasury: 3000, taxRate: 0.1, wageRate: 0.1,
  hasReligion: true, hasEntertainment: true, hasEducation: true, hasHealth: true, hasWater: true, hasFood: true,
  jobs: 40, employed: 30, welfare: {}, godWorship: { jupiter: 1, neptune: 1, ceres: 1, bacchus: 1, mercury: 1 },
  doctorCoverage: 0.8, educationCoverage: 0.6, entertainmentCoverage: 0.9,
};

describe('advisors (tasks 9.6, 11.3)', () => {
  it('produces market/health/education/religion/finance advisor datasets', () => {
    const data = advisorsFrom(snap);
    expect(data.map((d) => d.name)).toEqual(expect.arrayContaining(['finance', 'religion', 'health', 'education', 'labor', 'ratings']));
    const health = data.find((d) => d.name === 'health');
    expect(health!.data.wellness).toBe(80);
    const ratings = data.find((d) => d.name === 'ratings');
    expect(ratings!.data.culture).toBeGreaterThan(0);
  });
});

describe('overlays (task 11.4)', () => {
  it('assembles per-tile overlay grids by name', () => {
    const o = overlaysFrom(2, 2, (x, y) => ({ water: y * 2 + x, risk: x }));
    expect(o.water[1][1]).toBe(3);
    expect(o.risk[1][1]).toBe(1);
  });
});

describe('water overlay data (WATR-06)', () => {
  it('projects sources, coverage, water classes, aqueduct flow, reservoir state, and desirability grids', () => {
    const ws = new WaterSystem();
    ws.setSources([
      { x: 1, y: 1, kind: 'well', active: true, radius: 2 },
      { x: 2, y: 2, kind: 'fountain', active: true, radius: 2 },
    ]);
    const grid = ws.compute(5, 5, () => 0);
    const reservoirStates: ReservoirState[] = [{
      x: 0, y: 0, size: 3, capacity: RESERVOIR_STORAGE_CAPACITY,
      level: RESERVOIR_STORAGE_CAPACITY, filled: true, inletConnected: true, outletToAqueduct: false,
    }];
    const data = waterOverlayData({
      width: 5, height: 5, grid,
      aqueductTiles: new Set([2 * 100000 + 2, 2 * 100000 + 3]),
      flowing: new Set([2 * 100000 + 2]),
      reservoirStates,
    });

    expect(data.wellCoverage[1][1]).toBe(1);
    expect(data.fountainCoverage[2][2]).toBe(1);
    // clean — the fountain at (2,2) radius 2 also covers (1,1) at distance 2, and fountain outranks well
    expect(data.houseWaterClass[1][1]).toBe(2);
    expect(data.houseWaterClass[2][2]).toBe(2);
    expect(data.sources[1][1]).toBe(1);
    // tile (3,2) is present (its key is in aqueductTiles) but not in the flowing set;
    // grids use the established [y][x] convention, so (3,2) reads data.*[2][3]
    expect(data.aqueductPresent[2][3]).toBe(1);
    expect(data.aqueductFlow[2][3]).toBe(0); // present, not flowing
    expect(data.aqueductFlow[2][2]).toBe(1);
    expect(data.reservoirFilled[1][1]).toBe(1);
    expect(data.reservoirLevel[1][1]).toBe(RESERVOIR_STORAGE_CAPACITY);
    expect(data.desirability[2][2]).toBe(FOUNTAIN_DESIRABILITY_BONUS - WELL_DESIRABILITY_PENALTY);
  });

  it('clamps an edge-overhanging reservoir footprint to the map bounds without crashing (WR-01)', () => {
    const ws = new WaterSystem();
    ws.setSources([]);
    const grid = ws.compute(5, 5, () => 0);
    // footprint spans x 4..6 (exclusive) and y 4..6 on a 5x5 map — overhangs
    // both edges. Before the clamp this threw TypeError (y row out of range).
    const reservoirStates: ReservoirState[] = [{
      x: 4, y: 4, size: 3, capacity: RESERVOIR_STORAGE_CAPACITY,
      level: RESERVOIR_STORAGE_CAPACITY, filled: true, inletConnected: true, outletToAqueduct: false,
    }];
    const data = waterOverlayData({
      width: 5, height: 5, grid,
      aqueductTiles: new Set(), flowing: new Set(), reservoirStates,
    });
    expect(data.reservoirFilled[4][4]).toBe(1);
    expect(data.reservoirLevel[4][4]).toBe(RESERVOIR_STORAGE_CAPACITY);
    for (let y = 0; y < 5; y++) {
      // every row keeps its full dense width — no sparse/hole-ridden row from an x-overhang
      expect(data.reservoirFilled[y]).toHaveLength(5);
      expect(data.reservoirLevel[y]).toHaveLength(5);
      for (let x = 0; x < 5; x++) {
        if (x === 4 && y === 4) continue;
        expect(data.reservoirFilled[y][x]).toBe(0);
        expect(data.reservoirLevel[y][x]).toBe(0);
      }
    }
  });
});

describe('inspectors (task 11.2)', () => {
  it('builds residence/production/storage/market/walker datasets', () => {
    expect(residenceInspection(10, 20, 'plebeian', ['well'], { wheat: 2 })).toMatchObject({ population: 10, residentClass: 'plebeian' });
    expect(productionInspection({ clay: 3 }, { pottery: 1 }, 'working')).toMatchObject({ status: 'working' });
    expect(storageInspection({ wheat: 5 }, 3, 16)).toMatchObject({ usedSlots: 3 });
    expect(marketInspection({ wheat: 4 }, 2)).toMatchObject({ buyerRadius: 2 });
    expect(walkerInspection(1, 2, 3, 'travelling', 4, 8)).toMatchObject({ id: 1, status: 'travelling' });
  });
});
