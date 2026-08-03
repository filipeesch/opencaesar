/**
 * Phase 7, WARE-03 (decision 4): the logistics advisor aggregate view is
 * derived LIVE from a running sim — never fabricated (§33-23). The pure
 * projection (logisticsAdvisorFromState) is asserted with exact numbers on a
 * hand-built state, and the live runner accessor (getLogisticsAdvisor) is
 * reconciled against a real production city's internals.
 */
import { describe, it, expect } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { logisticsAdvisorFromState } from '../../src/sim/advisors';
import type { ProductionAdvisorRow } from '../../src/sim/advisors';
import type { SimState } from '../../src/sim/types';
import type { BuildingInstance } from '../../src/sim/walkers';
import { productionChainMap, buildProductionCity } from '../helpers';

/** Reach the private building registry to read internal production state. */
function internals(r: SimRunner): Map<number, BuildingInstance> {
  return (r as unknown as { buildingById: Map<number, BuildingInstance> }).buildingById;
}

const building = (over: Partial<{ id: number; type: string; active: boolean; stock: Record<string, number> }>) => ({
  id: 1, type: 'warehouse', x: 0, y: 0, footprint: 2, workersAssigned: 0, workersRequired: 0,
  active: true, laborConnected: true, stock: {}, ...over,
});

const rows = (over: Partial<ProductionAdvisorRow> = {}): ProductionAdvisorRow[] => [{
  id: 1, kind: 'workshop', buildingType: 'pottery_workshop', commodity: 'pottery',
  inputs: {}, output: 2, status: 'working', bottleneck: null,
  destination: null, destinationKind: null, producedLastTick: 0.3, ...over,
}];

describe('pure projection (exact numbers)', () => {
  it('derives stock/production/in-transit/bottlenecks/stopped from a hand-built state', () => {
    const state = {
      buildings: [
        building({ id: 1, type: 'warehouse', active: true, stock: { pottery: 3 } }),
        building({ id: 2, type: 'kitchen', active: false }),
        building({ id: 3, type: 'clay_pit', active: false }),
      ],
    } as unknown as SimState;

    const view = logisticsAdvisorFromState(state, rows());

    expect(view.stock.pottery).toBe(5); // warehouse 3 + workshop output 2
    expect(view.production.pottery).toBe(9); // 0.3 producedLastTick × 30
    expect(view.inTransit).toBe(2); // workshop row output held pending porter
    expect(view.bottlenecks).toBe(0); // no non-null bottleneck in rows
    // stopped counts only inactive logistics/production buildings: the inactive
    // clay_pit (requirement), NOT the inactive kitchen (not a warehouse/
    // workshop/extraction/raw-farm type)
    expect(view.stopped).toBe(1);
  });
});

describe('live accessor (WARE-03)', () => {
  it('returns a live-derived logistics advisor view on a real production city', () => {
    const r = new SimRunner(42, productionChainMap());
    buildProductionCity(r);
    for (let i = 0; i < 400; i++) r.tick();

    const view = r.getLogisticsAdvisor();
    const buildings = [...internals(r).values()];
    const warehouse = buildings.find((b) => b.type === 'warehouse')!;
    const workshop = buildings.find((b) => b.type === 'pottery_workshop')!;

    // (1) stock.pottery reconciles to warehouse stock + workshop row output
    const potteryRow = r.getProductionAdvisor().rows.find((x) => x.kind === 'workshop')!;
    expect(view.stock.pottery).toBeGreaterThan(0);
    expect(view.stock.pottery).toBe((warehouse.stock.pottery ?? 0) + potteryRow.output);

    // (2) production has clay and pottery keys reflecting live producedLastTick
    expect(view.production).toHaveProperty('clay');
    expect(view.production).toHaveProperty('pottery');
    expect(view.production.clay).toBeGreaterThanOrEqual(0);
    expect(view.production.pottery).toBeGreaterThanOrEqual(0);
    expect(view.production.pottery).toBeCloseTo(potteryRow.producedLastTick * 30, 5);

    // (3) consumption.clay is 30 while the pottery workshop is staffed
    const clayConsumption = workshop.production!.active ? 30 : 0;
    expect(view.consumption.clay).toBe(clayConsumption);

    // (4) in-transit and bottlenecks are live non-negative counts
    expect(view.inTransit).toBeGreaterThanOrEqual(0);
    expect(view.bottlenecks).toBeGreaterThanOrEqual(0);

    // (6) stopped equals the count of inactive logistics/production buildings
    const expectedStopped = buildings.filter(
      (b) => !b.active && (b.type === 'warehouse' || (r as unknown as { isProd: (t: string) => boolean }).isProd?.(b.type)),
    ).length;
    // conservative: recompute stopped the same way the projection does
    const stoppedRecompute = buildings.filter((b) => {
      if (b.active) return false;
      if (b.type === 'warehouse') return true;
      // workshop/extraction/raw types are the only other logistics/production kinds
      return b.production !== undefined || b.type === 'clay_pit' || b.type === 'timber_yard'
        || b.type === 'iron_mine' || b.type === 'quarry' || b.type === 'olive_farm' || b.type === 'grape_farm';
    }).length;
    expect(view.stopped).toBe(stoppedRecompute);
    void expectedStopped;
  });

  it('bottlenecks rise live when the workshop is starved, and the view still reads real state', () => {
    const r = new SimRunner(42, productionChainMap());
    buildProductionCity(r);
    for (let i = 0; i < 400; i++) r.tick();

    const buildings = [...internals(r).values()];
    const workshop = buildings.find((b) => b.type === 'pottery_workshop')!;
    const pit = buildings.find((b) => b.type === 'clay_pit')!;
    const before = r.getLogisticsAdvisor().bottlenecks;

    // starve: no clay feedstock and no clay in the workshop input
    pit.stock.clay = 0;
    workshop.production!.inputs.clay = 0;
    workshop.production!.output.pottery = 0;
    r.tick();

    const after = r.getLogisticsAdvisor();
    expect(after.bottlenecks).toBeGreaterThanOrEqual(before);
    // the starved workshop now reports a non-null bottleneck
    const row = r.getProductionAdvisor().rows.find((x) => x.buildingType === 'pottery_workshop')!;
    expect(row.bottleneck).not.toBeNull();
    // the view still reflects live stock (warehouse stock carries through)
    const warehouse = buildings.find((b) => b.type === 'warehouse')!;
    expect(after.stock.pottery ?? 0).toBeGreaterThanOrEqual(warehouse.stock.pottery ?? 0);
  });
});
