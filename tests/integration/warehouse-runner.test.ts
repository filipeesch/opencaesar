/**
 * Phase 7, WARE-01 (decision 2): warehouse deliveries move by road — never
 * teleported. warehouseCandidates requires a findRoadPath between the
 * producer's adjacent road tile and the warehouse's adjacent road tile, so a
 * warehouse with no road path receives nothing while the goods stay at the
 * producer, and stock rises once the road is connected.
 *
 * Coordinates: buildProductionCity occupies x=0..15 (roads y=0/3/5, houses on
 * y=4/6, warehouse at (12,1), workshop at (2,1), clay pit at (8,8)). The pocket
 * is placed at the south-east — an isolated road at (16,16) and a warehouse at
 * (16,17) whose footprint (16..17,17..18) touches only that road. The plan's
 * original pocket coordinates (warehouse (16,14) / road (16,16)) were shifted
 * down by 3 rows so the Scenario-B connecting column x=16 never crosses the
 * warehouse footprint (non-overlapping pocket, no teleport — same rules).
 */
import { describe, it, expect } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { productionChainMap, buildProductionCity, place } from '../helpers';
import type { BuildingInstance } from '../../src/sim/walkers';

/** Reach the private building registry to read internal production state. */
function internals(r: SimRunner): Map<number, BuildingInstance> {
  return (r as unknown as { buildingById: Map<number, BuildingInstance> }).buildingById;
}

describe('warehouse road-reachable transfer (WARE-01, decision 2)', () => {
  it('a warehouse with no road path receives nothing while the connected warehouse and pit keep their stock', () => {
    const r = new SimRunner(42, productionChainMap());
    buildProductionCity(r);
    // disconnected pocket: isolated road + warehouse touching only that road
    place(r, 'road', 16, 16);
    place(r, 'warehouse', 16, 17); // footprint (16..17,17..18), road-adjacent at (16,16)

    for (let i = 0; i < 200; i++) r.tick();

    const warehouses = [...internals(r).values()].filter((b) => b.type === 'warehouse');
    const pocket = warehouses.find((b) => b.x === 16 && b.y === 17)!;
    const connected = warehouses.find((b) => b.x === 12 && b.y === 1)!;
    const pit = [...internals(r).values()].find((b) => b.type === 'clay_pit')!;

    // goods never teleport to the disconnected pocket
    expect(pocket.stock.clay ?? 0).toBe(0);
    expect(pocket.stock.pottery ?? 0).toBe(0);
    // the road-connected warehouse receives (stock rises)
    expect(connected.stock.pottery ?? 0).toBeGreaterThan(0);
    // the producer keeps its stock (nothing silently evacuated to the pocket)
    expect(pit.stock.clay ?? 0).toBeGreaterThan(0);
  });

  it('connecting the road lets the same warehouse receive', () => {
    const r = new SimRunner(42, productionChainMap());
    buildProductionCity(r);
    place(r, 'road', 16, 16);
    place(r, 'warehouse', 16, 17);
    for (let i = 0; i < 200; i++) r.tick();

    const warehouses = [...internals(r).values()].filter((b) => b.type === 'warehouse');
    const pocket = warehouses.find((b) => b.x === 16 && b.y === 17)!;
    const connected = warehouses.find((b) => b.x === 12 && b.y === 1)!;
    expect(pocket.stock.clay ?? 0).toBe(0);
    expect(pocket.stock.pottery ?? 0).toBe(0);

    // connect (16,16) to the main grid via column x=16 down from row y=5
    // (rolls onto the buildProductionCity road row y=5 which spans x=0..15).
    // The natural chain fills the primary warehouse only around tick ~700, so
    // the primary is pre-filled to near its 40-unit capacity (the same
    // internals-set pattern production-runner.test.ts:119 uses) so the pocket
    // is the nearest remaining warehouse and the 60-tick window can show real
    // delivery from this same runner.
    connected.stock = { pottery: 39 };
    for (let y = 5; y <= 15; y++) place(r, 'road', 16, y);
    for (let i = 0; i < 60; i++) r.tick();

    const clay = pocket.stock.clay ?? 0;
    const pottery = pocket.stock.pottery ?? 0;
    expect(clay > 0 || pottery > 0).toBe(true);
  });

  it('regression: the connected production city still delivers to its base warehouse', () => {
    const r = new SimRunner(42, productionChainMap());
    buildProductionCity(r);
    for (let i = 0; i < 300; i++) r.tick();
    const warehouse = [...internals(r).values()].find((b) => b.type === 'warehouse')!;
    expect(warehouse.stock.pottery ?? 0).toBeGreaterThan(0);
  });
});
