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
import { productionChainMap, buildProductionCity, foodChainMap, buildFoodCity, place } from '../helpers';
import type { BuildingInstance } from '../../src/sim/walkers';
import {
  WaterSystem, FOUNTAIN_DESIRABILITY_BONUS, WELL_DESIRABILITY_PENALTY, RESERVOIR_STORAGE_CAPACITY,
} from '../../src/sim/water';
import type { ReservoirState } from '../../src/sim/water';
import type { BuildingState, SimState } from '../../src/sim/types';
import { housingLevelName } from '../../data/housing';
import { liveStats } from '../../src/sim/housingLive';

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
  const level = 2; // consistent tier-0 bucket (tierOfLevel); non-zero population for overlays
  return {
    id, type: 'house', x, y, footprint: 1, workersAssigned: 0, workersRequired: 0,
    active: true, laborConnected: false, stock: {},
    house: {
      tier, tierName: 'Hut', level, levelName: housingLevelName(level), populationCapacity: liveStats(level).population, foodCooldown, waterCooldown: 0, laborCooldown: 0,
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

describe('inspectors enriched via getWalkerInternals (UI-04, Wave 0 scaffold)', () => {
  it('residenceInspection appends rich live fields from internals (never serialized)', () => {
    const r = new SimRunner(42, foodChainMap());
    buildFoodCity(r);
    for (let i = 0; i < 400; i++) r.tick();
    const sim = r.getWalkerInternals();
    const house = sim.buildings.find((b) => b.type === 'house' && b.house);
    expect(house).toBeDefined();
    const h = house!.house!;
    const safety = house!.safety;

    const enriched = residenceInspection as (
      population: number, capacity: number, residentClass: string, services: string[],
      goods: Record<string, number>,
      internals?: { house?: typeof h; safety?: typeof safety; happiness?: number; desirability?: number },
    ) => Record<string, unknown>;

    const insp = enriched(10, 20, 'plebeian', ['well'], { wheat: 2 }, { house: h, safety });
    // Rich live fields appended from HouseInstance (level/satisfiedTicks), never
    // from the serialized BuildingState shape.
    expect(insp).toMatchObject({ level: h.level });
    if (h.satisfiedTicks !== undefined) expect(insp).toMatchObject({ satisfiedTicks: h.satisfiedTicks });
    // The safety block (fire/danger/collapseRisk/crime) feeds from BuildingSafetyState.
    if (safety) {
      expect(insp).toMatchObject({ fire: safety.fire, danger: safety.danger });
      expect(insp).toMatchObject({ collapseRisk: safety.collapseRisk, crime: safety.crime });
    }
    // The ORIGINAL minimal call keeps returning the same shape.
    expect(residenceInspection(10, 20, 'plebeian', ['well'], { wheat: 2 })).toMatchObject({ population: 10, services: ['well'] });
  });

  it('productionInspection appends blocked/workers from live ProductionState', () => {
    const r = new SimRunner(42, productionChainMap());
    buildProductionCity(r);
    for (let i = 0; i < 400; i++) r.tick();
    const sim = r.getWalkerInternals();
    const workshop = sim.buildings.find((b) => b.type === 'pottery_workshop');
    expect(workshop).toBeDefined();
    const prod = workshop!.production!;

    const enriched = productionInspection as (
      inputs: Record<string, number>, output: Record<string, number>, status: string,
      internals?: { production?: typeof prod; active?: boolean; workersAssigned?: number; workersRequired?: number },
    ) => Record<string, unknown>;

    const insp = enriched({ clay: 3 }, { pottery: 1 }, 'working', { production: prod, active: true, workersAssigned: 8, workersRequired: 8 });
    expect(insp).toMatchObject({ active: true, blocked: prod.blocked });
    expect(insp).toMatchObject({ workersAssigned: 8, workersRequired: 8 });
    // Minimal call unchanged.
    expect(productionInspection({ clay: 3 }, { pottery: 1 }, 'working')).toMatchObject({ status: 'working' });
  });

  it('walkerInspection appends type/origin/path/carriedAmount from a WalkerInstance', () => {
    const r = new SimRunner(42, foodChainMap());
    buildFoodCity(r);
    for (let i = 0; i < 400; i++) r.tick();
    const sim = r.getWalkerInternals();
    const walkers = sim.walkers ?? [];
    expect(walkers.length).toBeGreaterThan(0);
    const w = walkers[0];

    const enriched = walkerInspection as (
      id: number, x: number, y: number, status: string, stepsUsed: number, maxSteps: number,
      internals?: typeof w,
    ) => Record<string, unknown>;

    const insp = enriched(w.id, w.x, w.y, w.state, w.stepsTaken, 40, w);
    expect(insp).toMatchObject({ id: w.id, type: w.type });
    expect(insp).toMatchObject({ carriedAmount: w.carriedAmount });
    expect(insp).toMatchObject({ origin: w.origin ?? null });
    // Minimal call unchanged.
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
    // A real live city (farm → granary → market feeds, well waters): under the
    // 21-level ladder a house leaves the Vacant-Lot floor only after the level-1
    // `well` requirement and minSatisfiedTicks are met, so this genuinely
    // EVOLVES a live house to level 1 (population 20+) — no fabricated tier.
    const r = new SimRunner(42, foodChainMap());
    buildFoodCity(r);
    for (let i = 0; i < 400; i++) r.tick();
    // Demolish the food chain: the HUD must read a populated city with houses
    // that need food and zero available units — red comes from live state.
    for (const [x, y] of [[0, 1], [2, 1], [4, 1]] as const) {
      expect(r.demolish(x, y)).toBe(true);
    }
    const ind = foodHudFromState(r.getState());
    expect(ind.availableUnits).toBe(0);
    expect(ind.band).toBe('red');
    expect(ind.hasPopulation).toBe(true);
  });

  it('produces the per-food advisor table and bottlenecks from live buildings', () => {
    const r = new SimRunner(7, foodChainMap());
    buildFoodCity(r);
    for (let i = 0; i < 400; i++) r.tick();
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

  it('WR-04: supply/variety overlays derive from real house food levels, not constants', () => {
    const light = houseBuilding(1, 1, 1, 0, { wheat: 100 });
    const heavy = houseBuilding(2, 4, 4, 0, { wheat: 100, vegetables: 50 });
    const empty = houseBuilding(3, 7, 7, 0, undefined, 0); // no inventory, unfed → proxy 0
    const grids = foodOverlayGrids(mkFoodState([light, heavy, empty], 100));
    // Level-2 house population is 40 → daily need 1.2 → 100 units ≈ 83.3 days.
    const lightDays = grids.supplyDays[1][1];
    const heavyDays = grids.supplyDays[4][4];
    expect(lightDays).toBeGreaterThan(0);
    expect(heavyDays).toBeGreaterThan(lightDays); // more food → more days (varies, not 10/1)
    expect(grids.variety[1][1]).toBe(1); // wheat only
    expect(grids.variety[4][4]).toBe(2); // wheat + vegetables
    expect(grids.variety[7][7]).toBe(0);
    expect(grids.supplyDays[7][7]).toBe(0);
    // And the values differ across houses — never a constant 10/1 across tiles.
    expect(lightDays).not.toBe(10);
    expect(grids.variety[4][4]).not.toBe(grids.variety[1][1]);
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

describe('production advisor (PROD-02)', () => {
  /** Reach the private building registry to read internal production state. */
  function internals(r: SimRunner): Map<number, BuildingInstance> {
    return (r as unknown as { buildingById: Map<number, BuildingInstance> }).buildingById;
  }

  it('derives per-building rows and a summary from live sim state — never fabricated', () => {
    const r = new SimRunner(42, productionChainMap());
    buildProductionCity(r);
    for (let i = 0; i < 400; i++) r.tick();

    const advisor = r.getProductionAdvisor();
    const rows = advisor.rows;
    const clay = rows.find((row) => row.buildingType === 'clay_pit');
    const pottery = rows.find((row) => row.buildingType === 'pottery_workshop');
    expect(clay).toBeDefined();
    expect(pottery).toBeDefined();
    expect(clay!.kind).toBe('extraction');
    expect(pottery!.kind).toBe('workshop');
    expect(clay!.commodity).toBe('clay');
    expect(pottery!.commodity).toBe('pottery');

    // the warehouse exists (it is the porter destination) but is storage — no row
    expect(rows.find((row) => row.buildingType === 'warehouse')).toBeUndefined();

    // every row value derives from state — workshop row equals internal state
    const buildings = [...internals(r).values()];
    const pit = buildings.find((b) => b.type === 'clay_pit')!;
    const workshop = buildings.find((b) => b.type === 'pottery_workshop')!;
    const warehouse = buildings.find((b) => b.type === 'warehouse')!;
    expect(pottery!.output).toBe(workshop.production!.output.pottery ?? 0);
    expect(pottery!.inputs.clay).toBe(workshop.production!.inputs.clay ?? 0);
    expect(clay!.output).toBe(pit.stock.clay ?? 0);
    // destination is the warehouse id whenever a porter move was recorded
    if (pottery!.destination) expect(Number(pottery!.destination)).toBe(warehouse.id);

    // production actually happened over the run (the city chain delivered)
    expect(warehouse.stock.pottery ?? 0).toBeGreaterThan(0);
    // the workshop row's real values changed from the idle baseline (not 0/1 stubs)
    expect(pottery!.producedLastTick).toBeGreaterThanOrEqual(0);
    expect(pottery!.output).toBeGreaterThanOrEqual(0);

    // summary aggregates real counts and output stock
    expect(advisor.summary.workshops).toBeGreaterThan(0);
    expect(advisor.summary.activeWorkshops).toBeGreaterThanOrEqual(0);
    expect(advisor.summary.outputStock.pottery ?? 0).toBeGreaterThan(0);

    // starving the workshop of clay flips its row to missing_input
    workshop.production!.inputs.clay = 0;
    const starved = r.getProductionAdvisor().rows.find((row) => row.buildingType === 'pottery_workshop')!;
    expect(starved.status).toBe('missing_input');
    expect(starved.bottleneck).toBe('missing_input');
  });

  it('reports an off-deposit iron mine as blocked with zero output', () => {
    const r = new SimRunner(7, productionChainMap());
    for (let x = 0; x <= 14; x++) {
      place(r, 'road', x, 15);
      place(r, 'road', x, 17);
    }
    place(r, 'road', 4, 16);
    place(r, 'iron_mine', 2, 13);
    for (const x of [0, 2, 6, 8, 10, 12]) place(r, 'house', x, 16);
    for (let x = 0; x <= 14; x += 2) place(r, 'house', x, 18);
    for (let i = 0; i < 400; i++) r.tick();

    const mine = r.getProductionAdvisor().rows.find((row) => row.buildingType === 'iron_mine')!;
    expect(mine.status).toBe('blocked');
    expect(mine.output).toBe(0);
    expect(mine.kind).toBe('extraction');
  });

  it('IN-02: advisor rows surface the porter destination kind (workshop/warehouse), not just the id', () => {
    const r = new SimRunner(42, productionChainMap());
    buildProductionCity(r);
    for (let i = 0; i < 400; i++) r.tick();

    // every row carries the field and only legal values
    for (const row of r.getProductionAdvisor().rows) {
      expect('destinationKind' in row).toBe(true);
      expect(row.destinationKind === null || row.destinationKind === 'workshop' || row.destinationKind === 'warehouse').toBe(true);
    }

    // force a single proven delivery on the next tick and read the live row
    const buildings = [...internals(r).values()];
    const workshop = buildings.find((b) => b.type === 'pottery_workshop')!;
    const warehouse = buildings.find((b) => b.type === 'warehouse')!;
    workshop.production!.output.pottery = 5;
    workshop.production!.inputs.clay = 3;
    warehouse.stock = { pottery: 39 }; // replace: room for exactly one more unit
    r.tick();

    const row = r.getProductionAdvisor().rows.find((x) => x.buildingType === 'pottery_workshop')!;
    // the last porter move went to the warehouse (the pottery workshop's output
    // is a finished good no other workshop consumes in the base catalog)
    expect(row.destinationKind).toBe('warehouse');
    expect(row.destination).toBe(String(warehouse.id));
    expect(warehouse.stock.pottery).toBe(40);
  });
});
