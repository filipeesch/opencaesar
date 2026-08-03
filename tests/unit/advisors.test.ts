import { describe, it, expect } from 'vitest';
import {
  advisorsFrom, overlaysFrom, waterOverlayData, residenceInspection, productionInspection, storageInspection, marketInspection, walkerInspection,
} from '../../src/sim/advisors';
import {
  monthsOfFood, foodBand, foodHudIndicator, foodHudFromState, foodAdvisorFromState,
  foodTooltip, foodOverlayGrids, groupedAlerts,
} from '../../src/sim/advisors';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';
import {
  WaterSystem, FOUNTAIN_DESIRABILITY_BONUS, WELL_DESIRABILITY_PENALTY, RESERVOIR_STORAGE_CAPACITY,
} from '../../src/sim/water';
import type { ReservoirState } from '../../src/sim/water';
import type { BuildingState, SimState } from '../../src/sim/types';

/** Compact, hand-built SimState for advisor tests (deterministic, no runner). */
function mkFoodState(buildings: BuildingState[], population: number): SimState {
  return {
    tick: 0, width: 10, height: 10, tiles: [], buildings, walkers: [],
    treasury: 0, policy: { taxRate: 0.1, wageRate: 0.1 },
    ratings: { population, prosperity: 50, happiness: 50 },
    totalWorkers: 0, assignedWorkers: 0, totalJobs: 0, messages: [], lastTickWagesUnpaid: false,
  };
}

function farmBuilding(id: number, x: number, y: number, opts: Partial<BuildingState> = {}): BuildingState {
  return {
    id, type: 'farm', x, y, footprint: 2, workersAssigned: 1, workersRequired: 1,
    active: true, laborConnected: true, stock: {}, ...opts,
  };
}

function granaryBuilding(id: number, x: number, y: number, stock: Record<string, number>): BuildingState {
  return { id, type: 'granary', x, y, footprint: 2, workersAssigned: 1, workersRequired: 1, active: true, laborConnected: true, stock };
}

function houseBuilding(id: number, x: number, y: number, tier: number, foodInventory: Record<string, number> | undefined, foodCooldown = 0): BuildingState {
  return {
    id, type: 'house', x, y, footprint: 1, workersAssigned: 0, workersRequired: 0,
    active: true, laborConnected: false, stock: {},
    house: {
      tier, tierName: 'Hut', populationCapacity: 5, foodCooldown, waterCooldown: 0, laborCooldown: 0,
      desirability: 50, happiness: 50, foodInventory,
    },
  };
}

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

describe('food HUD months-of-food & advisor data (AGRI-03, spec §15/§21)', () => {
  it('computes months of food = available / projected monthly consumption', () => {
    expect(monthsOfFood(1160, 200)).toBeCloseTo(5.8, 5);
    expect(monthsOfFood(0, 200)).toBe(0);
    expect(monthsOfFood(100, 0)).toBe(Infinity);
  });

  it('maps months to color bands (never color-only: icon + text always present)', () => {
    expect(foodBand(8, true)).toBe('green');
    expect(foodBand(4, true)).toBe('yellow');
    expect(foodBand(2, true)).toBe('orange');
    expect(foodBand(0.5, true)).toBe('red');
    expect(foodBand(4, false)).toBe('gray');
    const ind = foodHudIndicator({ availableUnits: 2320, projectedMonthlyConsumption: 400, hasPopulation: true });
    expect(ind.months).toBeCloseTo(5.8, 5);
    expect(ind.band).toBe('yellow');
    expect(ind.icon.length).toBeGreaterThan(0);
    expect(ind.text).toMatch(/months/);
  });

  it('derives the HUD indicator from a live sim state — never fabricated', () => {
    const map = SimMap.fromLayout(12, 12, (x, y) => ((x === 0 || x === 1) && (y === 1 || y === 2) ? 'fertile' : 'earth'));
    map.set(5, 6, 'road');
    const r = new SimRunner(42, map);
    // a populated city with houses that need food but zero granary stock → red
    r.placeBuilding('house', 5, 5);
    for (let i = 0; i < 30; i++) r.tick();
    const ind = foodHudFromState(r.getState());
    expect(ind.availableUnits).toBe(0);
    expect(ind.band).toBe('red');
    expect(ind.hasPopulation).toBe(true);
  });

  it('produces the per-food advisor table and bottlenecks from live buildings', () => {
    const map = SimMap.fromLayout(12, 12, () => 'earth');
    map.set(5, 6, 'road');
    const r = new SimRunner(7, map);
    r.placeBuilding('granary', 2, 2);
    r.placeBuilding('house', 5, 5);
    for (let i = 0; i < 20; i++) r.tick();
    const a = foodAdvisorFromState(r.getState());
    expect(a.rows.length).toBe(5);
    expect(a.rows.map((row) => row.food)).toEqual(['wheat', 'vegetables', 'fruit', 'meat', 'fish']);
    expect(Array.isArray(a.bottlenecks)).toBe(true);
    expect(a.consumptionMonthly).toBeGreaterThan(0);
  });

  it('builds the tooltip breakdown from live-derived values', () => {
    const tip = foodTooltip({
      availableByFood: { wheat: 3200, fruit: 800 },
      productionMonthlyByFood: { wheat: 900 },
      consumptionMonthlyByFood: { wheat: 600, fruit: 160 },
      varietyStats: { '1': 0.96, '2': 0.68 },
      mainProblems: ['South district lacks vegetables'],
    });
    expect(tip.balanceMonthly).toBe(140);
    expect(tip.stockByFood.fruit).toBe(800);
    expect(tip.mainProblems).toContain('South district lacks vegetables');
  });

  it('projects per-tile supply and variety overlays inside map bounds', () => {
    const map = SimMap.fromLayout(8, 8, () => 'earth');
    map.set(4, 5, 'road');
    const r = new SimRunner(3, map);
    r.placeBuilding('house', 5, 5);
    r.tick();
    const grids = foodOverlayGrids(r.getState());
    expect(grids.supplyDays.length).toBe(8);
    expect(grids.variety.length).toBe(8);
    for (let y = 0; y < 8; y++) expect(grids.supplyDays[y].length).toBe(8);
  });

  it('WR-03: per-food advisor table reflects real simulated flows — no hardcoded zeros', () => {
    // A veg-only city: an active vegetable farm (real flow), houses that have
    // actually received vegetables, and granary vegetables stock.
    const state = mkFoodState(
      [
        farmBuilding(1, 0, 0, { active: true }),
        granaryBuilding(2, 0, 4, { vegetables: 30 }),
        houseBuilding(3, 4, 4, 0, { vegetables: 20 }),
      ],
      50,
    );
    const a = foodAdvisorFromState(state, { productionMonthlyByFood: { vegetables: 24 } });

    // Consumption follows what was actually delivered — not all assigned to wheat.
    const wheat = a.rows.find((r) => r.food === 'wheat')!;
    const veg = a.rows.find((r) => r.food === 'vegetables')!;
    expect(wheat.consumption).toBe(0); // nobody receives wheat here
    expect(veg.consumption).toBeCloseTo(50 * 0.9, 5);
    // Production is real (the veg farm's 24 units/month), not hardcoded 0.
    expect(veg.production).toBe(24);
    expect(a.productionMonthly).toBe(24);
    // Imports/exports come through rather than being forced to 0.
    const withFlows = foodAdvisorFromState(state, {
      productionMonthlyByFood: { vegetables: 24 },
      importsMonthlyByFood: { vegetables: 10 },
      exportsMonthlyByFood: { vegetables: 2 },
    });
    const vegFlows = withFlows.rows.find((r) => r.food === 'vegetables')!;
    expect(vegFlows.imports).toBe(10);
    expect(vegFlows.exports).toBe(2);
    expect(vegFlows.balance).toBeCloseTo(24 + 10 - 2 - 45, 5);
    // A deficit bottleneck fires only for the food whose true supply < true
    // consumption — wheat is NOT falsely blamed in a vegetable-only city.
    expect(a.bottlenecks.some((b) => b.startsWith('wheat:'))).toBe(false);
    expect(a.bottlenecks).toContain('vegetables: supply below consumption');
  });

  it('WR-03: default (no flows) derives production from live staffed farms, not zero', () => {
    // One active farm → 0.5 units/tick × 30 days = 15 wheat/month.
    const state = mkFoodState(
      [farmBuilding(1, 0, 0, { active: true }), farmBuilding(2, 0, 6, { active: false })],
      10,
    );
    const a = foodAdvisorFromState(state);
    expect(a.productionMonthly).toBeCloseTo(15, 5); // only the staffed farm counts
    expect(a.rows.find((r) => r.food === 'wheat')!.production).toBeCloseTo(15, 5);
  });

});

describe('grouped food notifications (AGRI-03, spec §23.4)', () => {
  it('aggregates identical issues into one high-signal alert', () => {
    const alerts = groupedAlerts([
      { key: 'no-workers', label: 'Farm without workers', building: 'Farm 1' },
      { key: 'no-workers', label: 'Farm without workers', building: 'Farm 2' },
      { key: 'no-workers', label: 'Farm without workers', building: 'Farm 3' },
      { key: 'full', label: 'Granary full', building: 'Granary B' },
    ]);
    const agg = alerts.find((a) => a.label === 'Farm without workers');
    expect(agg?.count).toBe(3);
    expect(agg?.buildings).toEqual(['Farm 1', 'Farm 2', 'Farm 3']);
    expect(alerts.find((a) => a.label === 'Granary full')?.count).toBe(1);
  });
});
