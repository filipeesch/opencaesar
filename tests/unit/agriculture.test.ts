import { describe, it, expect } from 'vitest';
import { FARMS, farmProductionPerTick, defaultGranaryPolicy, granaryAccepts } from '../../src/sim/agriculture';
import {
  UNITS_PER_LOAD, MIN_DISPATCH_UNITS, SOIL_FERTILITY, effectiveFarmProduction,
  farmStopReason, produceFarmOutput, shouldDispatchOutput, FARM_OUTPUT_CAPACITY,
  createFishingBoat, boatStep, BOAT_CAPACITY, fishingWharfState,
} from '../../src/sim/agriculture';

describe('farm types & fertility production (task 3.2)', () => {
  it('covers six land farms plus fishing wharf', () => {
    expect(Object.keys(FARMS).sort()).toEqual(
      ['animals', 'fishing', 'olives', 'orchard', 'vegetables', 'vines', 'wheat'].sort(),
    );
    expect(FARMS.fishing.produces).toBe('fish');
    expect(FARMS.wheat.requiresFertile).toBe(true);
    expect(FARMS.fishing.requiresFertile).toBe(false);
  });

  it('produces only when staffed, with road access, not paused, on fertile', () => {
    expect(farmProductionPerTick({ kind: 'wheat', fertility: 1, staffed: true, roadAccess: true, paused: false })).toBeGreaterThan(0);
    expect(farmProductionPerTick({ kind: 'wheat', fertility: 1, staffed: false, roadAccess: true, paused: false })).toBe(0);
    expect(farmProductionPerTick({ kind: 'wheat', fertility: 0, staffed: true, roadAccess: true, paused: false })).toBe(0);
    expect(farmProductionPerTick({ kind: 'wheat', fertility: 1, staffed: true, roadAccess: true, paused: true })).toBe(0);
  });

  it('scales output with fertility', () => {
    const full = farmProductionPerTick({ kind: 'wheat', fertility: 1, staffed: true, roadAccess: true, paused: false });
    const half = farmProductionPerTick({ kind: 'wheat', fertility: 0.5, staffed: true, roadAccess: true, paused: false });
    expect(full).toBeCloseTo(half * 2, 5);
  });
});

describe('physical-load production (AGRI-02, spec §3.1, §6.6–6.8)', () => {
  it('defines 1 load = 100 units and a 25-unit minimum dispatch threshold', () => {
    expect(UNITS_PER_LOAD).toBe(100);
    expect(MIN_DISPATCH_UNITS).toBe(25);
    expect(MIN_DISPATCH_UNITS).toBeLessThan(UNITS_PER_LOAD);
  });

  it('rolls up soil fertility grades into the spec §6.6 formula with worker ratio only', () => {
    const def = FARMS.wheat;
    const full = effectiveFarmProduction(def, SOIL_FERTILITY.normal, 1);
    expect(full).toBeCloseTo(def.baseOutputPerTick * UNITS_PER_LOAD, 5);
    const halfWorkers = effectiveFarmProduction(def, SOIL_FERTILITY.normal, 0.5);
    expect(halfWorkers).toBeCloseTo(full / 2, 5);
    const noWorkers = effectiveFarmProduction(def, SOIL_FERTILITY.normal, 0);
    expect(noWorkers).toBe(0);
  });

  it('compounds event, religion and condition bonuses deterministically', () => {
    const def = FARMS.wheat;
    const base = effectiveFarmProduction(def, SOIL_FERTILITY.normal, 1);
    const boosted = effectiveFarmProduction(def, SOIL_FERTILITY.normal, 0.8, { eventBonus: 1.1, religionBonus: 1.05, condition: 0.9 });
    expect(boosted).toBeCloseTo(base * 0.8 * 1.1 * 1.05 * 0.9, 5);
  });

  it('farms create a load in their output stock and stop at capacity (never destroy product)', () => {
    const stock = { units: 0, capacity: FARM_OUTPUT_CAPACITY.wheat };
    const per = effectiveFarmProduction(FARMS.wheat, SOIL_FERTILITY.normal, 1);
    for (let i = 0; i < 1000; i++) produceFarmOutput(stock, per);
    expect(stock.units).toBe(stock.capacity); // exactly capacity, never above
    // and further production is rejected without losing anything
    const before = stock.units;
    const r = produceFarmOutput(stock, per);
    expect(r.produced).toBe(0);
    expect(r.full).toBe(true);
    expect(stock.units).toBe(before);
  });

  it('gates shipping on the 25-unit minimum dispatch threshold', () => {
    expect(shouldDispatchOutput({ units: 24 })).toBe(false);
    expect(shouldDispatchOutput({ units: 25 })).toBe(true);
    expect(shouldDispatchOutput({ units: 0 })).toBe(false);
  });

  it('reports each stop reason from the full §6.7 vocabulary', () => {
    const base = (over: Partial<Parameters<typeof farmStopReason>[0]> = {}) =>
      farmStopReason({
        def: FARMS.wheat, fertility: 1, workerRatio: 1, paused: false,
        currentOutput: 0, roadAccess: true, staffed: true,
        ...over,
      } as Parameters<typeof farmStopReason>[0]);
    expect(base()).toBe('working');
    expect(base({ paused: true })).toBe('paused');
    expect(base({ staffed: false })).toBe('seeking-workers');
    expect(base({ roadAccess: false })).toBe('no-road-access');
    expect(base({ def: FARMS.wheat, fertility: 0 })).toBe('low-fertility');
    expect(base({ currentOutput: 999 })).toBe('output-full');
    expect(base({ workerRatio: 0.4 })).toBe('working-partial');
    expect(base({ modifiers: { condition: 0 } })).toBe('damaged');
  });
});

describe('fishing wharf with boat voyage (AGRI-02, spec §10)', () => {
  it('runs the boat lifecycle: idle → sailing → fishing → returning → unloading → idle', () => {
    const boat = createFishingBoat();
    expect(boat.state).toBe('idle');
    boatStep(boat, { hasZone: true, wharfFree: true });
    expect(boat.state).toBe('sailing');
    // outbound leg (3 days)
    boat.remaining = 1;
    boatStep(boat, { hasZone: true, wharfFree: true });
    expect(boat.state).toBe('fishing');
    expect(boat.remaining).toBe(30); // a full 30-day fishing cycle
    // fishing accumulates fish over the cycle (30 days)
    for (let i = 0; i < 30; i++) boatStep(boat, { hasZone: true, wharfFree: true });
    expect(boat.state).toBe('returning'); // cycle completed
    expect(boat.catch).toBeGreaterThan(0);
    // inbound leg → unload → idle
    boat.remaining = 1;
    boatStep(boat, { hasZone: true, wharfFree: true });
    expect(boat.state).toBe('unloading');
    boatStep(boat, { hasZone: true, wharfFree: true });
    expect(boat.state).toBe('idle');
    expect(boat.catch).toBe(0);
  });

  it('never exceeds the 100-unit boat capacity', () => {
    const boat = createFishingBoat();
    boatStep(boat, { hasZone: true, wharfFree: true });
    boat.remaining = 0;
    boat.state = 'fishing';
    for (let i = 0; i < 1000; i++) boatStep(boat, { hasZone: true, wharfFree: true });
    expect(boat.catch).toBeLessThanOrEqual(BOAT_CAPACITY);
  });

  it('stays seeking-zone (not destroying product) when no fishing zone exists', () => {
    const boat = createFishingBoat();
    boatStep(boat, { hasZone: false, wharfFree: true });
    expect(boat.state).toBe('seeking-zone');
    boatStep(boat, { hasZone: false, wharfFree: true });
    expect(boat.state).toBe('seeking-zone');
  });

  it('a blocked wharf keeps the catch and stays unloading; handoff happens only when free (CR-01)', () => {
    const boat = createFishingBoat();
    boat.state = 'unloading';
    boat.catch = 30;
    const wharf = { units: 0, capacity: 200 };
    // Blocked wharf: the boat stays unloading and keeps its full catch.
    const blocked = boatStep(boat, { hasZone: true, wharfFree: false, wharfStock: wharf });
    expect(blocked.blocked).toBe(true);
    expect(boat.state).toBe('unloading');
    expect(boat.catch).toBe(30);
    expect(wharf.units).toBe(0); // no handoff while blocked
    // Wharf frees up: the full catch transfers to the wharf stock and the boat resets.
    const ok = boatStep(boat, { hasZone: true, wharfFree: true, wharfStock: wharf });
    expect(ok.unloaded).toBe(30);
    expect(wharf.units).toBe(30); // every unit handed off — none dropped
    expect(boat.state).toBe('idle');
    expect(boat.catch).toBe(0);
  });

  it('never drops catch without a handoff even when the wharf stock is nearly full (CR-01)', () => {
    const boat = createFishingBoat();
    boat.state = 'unloading';
    boat.catch = 30;
    const wharf = { units: 195, capacity: 200 }; // only 5 units of room
    const r = boatStep(boat, { hasZone: true, wharfFree: true, wharfStock: wharf });
    expect(wharf.units).toBe(200);
    expect(boat.catch).toBe(25); // remainder kept on the boat — not destroyed
    expect(boat.state).toBe('unloading'); // stays unloading until fully handed off
    const wharf2 = { units: 0, capacity: 200 };
    const r2 = boatStep(boat, { hasZone: true, wharfFree: true, wharfStock: wharf2 });
    expect(wharf2.units).toBe(25);
    expect(boat.catch).toBe(0);
    expect(boat.state).toBe('idle');
  });

  it('reports wharf stop reasons from the §10.5 vocabulary', () => {
    const boat = createFishingBoat();
    expect(fishingWharfState(boat, { staffed: false, paused: false, hasZone: true, granaryAvailable: true })).toBe('no-workers');
    expect(fishingWharfState(boat, { staffed: true, paused: true, hasZone: true, granaryAvailable: true })).toBe('paused');
    expect(fishingWharfState(boat, { staffed: true, paused: false, hasZone: false, granaryAvailable: true })).toBe('river-blocked');
    expect(fishingWharfState(boat, { staffed: true, paused: false, hasZone: true, granaryAvailable: false })).toBe('no-granary');
  });
});

describe('granary per-food commands (task 3.3)', () => {
  it('accepts within capacity by default', () => {
    const p = defaultGranaryPolicy(100);
    expect(granaryAccepts(p, 'wheat', 0)).toBe(true);
    expect(granaryAccepts(p, 'wheat', 100)).toBe(false); // full
  });

  it('refuse and empty commands block receipt', () => {
    const p = defaultGranaryPolicy(100);
    p.perFood.wheat = 'refuse';
    expect(granaryAccepts(p, 'wheat', 0)).toBe(false);
    p.perFood.wheat = 'empty';
    expect(granaryAccepts(p, 'wheat', 0)).toBe(false);
  });

  it('accept command allows receipt explicitly', () => {
    const p = defaultGranaryPolicy(100);
    p.perFood.fish = 'accept';
    expect(granaryAccepts(p, 'fish', 0)).toBe(true);
  });
});
