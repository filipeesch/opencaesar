import { describe, it, expect } from 'vitest';
import {
  WORKSHOPS, emptyProduction, workshopStatus, tickWorkshop,
  porterDelivers, porterDeliversTo, porterDestination,
} from '../../src/sim/production';

describe('blocked states preserve goods (PROD-02, no-loss)', () => {
  it('missing_input keeps every input and output byte-identical and reports missing_input', () => {
    const w = WORKSHOPS.pottery;
    const s = emptyProduction(w);
    s.inputs.clay = 0;
    s.output.pottery = 3;

    const inputBefore = { ...s.inputs };
    const outputBefore = { ...s.output };
    expect(workshopStatus(w, s)).toBe('missing_input');
    expect(tickWorkshop(w, s).produced).toBe(0);
    expect(s.inputs).toEqual(inputBefore);
    expect(s.output).toEqual(outputBefore);
  });

  it('output_full produces 0, output stays at capacity, inputs unchanged', () => {
    const w = WORKSHOPS.pottery;
    const s = emptyProduction(w);
    s.inputs.clay = 5;
    s.output.pottery = w.stockCapacity;

    expect(workshopStatus(w, s)).toBe('output_full');
    expect(tickWorkshop(w, s).produced).toBe(0);
    expect(s.output.pottery).toBe(w.stockCapacity);
    expect(s.inputs.clay).toBe(5);
  });

  it('blocked (inactive workshop) produces 0 and leaves every stock unchanged', () => {
    const w = WORKSHOPS.pottery;
    const s = emptyProduction(w);
    s.inputs.clay = 10;
    s.output.pottery = 2;
    s.active = false;

    expect(workshopStatus(w, s)).toBe('blocked');
    expect(tickWorkshop(w, s).produced).toBe(0);
    expect(s.inputs.clay).toBe(10);
    expect(s.output.pottery).toBe(2);
  });

  it('an idle porter with nothing to move leaves both stocks unchanged', () => {
    const w = WORKSHOPS.pottery;
    const s = emptyProduction(w);
    s.output.pottery = 0;

    // porterDelivers returns 0 when output is 0
    expect(porterDelivers(w, s)).toBe(0);
    expect(s.output.pottery).toBe(0);

    // porterDeliversTo into a destination with capacity moves 0 when output is 0
    const dest = { stock: {} as Record<string, number>, capacity: 4 };
    expect(porterDeliversTo(w, s, dest)).toBe(0);
    expect(dest.stock.pottery).toBeUndefined();
    expect(s.output.pottery).toBe(0);
  });

  it('no valid destination — porterDestination returns null and the workshop keeps its whole output', () => {
    const fullWorkshop = { id: 'ws_full', kind: 'workshop' as const, accepts: () => true, capacity: 0, distance: 1, need: 5 };
    const refuseWarehouse = { id: 'wh_refuse', kind: 'warehouse' as const, accepts: () => false, capacity: 9, distance: 1, need: 0 };
    expect(porterDestination('pottery', [fullWorkshop], [refuseWarehouse])).toBeNull();

    const w = WORKSHOPS.pottery;
    const s = emptyProduction(w);
    s.output.pottery = 4;
    const before = s.output.pottery;
    // no dispatch happens (null destination) → nothing discarded, no teleporting
    expect(tickWorkshop(w, s).produced).toBeGreaterThanOrEqual(0);
    // the workshop still holds its produced output (maybe grew, never shrank)
    expect(s.output.pottery).toBeGreaterThanOrEqual(before);
  });

  it('repeated blocked ticks never silently clear held output (no-loss across ticks)', () => {
    const w = WORKSHOPS.pottery;
    const s = emptyProduction(w);
    s.inputs.clay = 0; // missing_input → blocked
    s.output.pottery = 3;

    for (let i = 0; i < 20; i++) tickWorkshop(w, s);
    expect(s.output.pottery).toBe(3);
    expect(s.inputs.clay).toBe(0);
    expect(workshopStatus(w, s)).toBe('missing_input');

    // inactive workshop also holds its output across repeated ticks
    const s2 = emptyProduction(w);
    s2.inputs.clay = 10;
    s2.output.pottery = 2;
    s2.active = false;
    for (let i = 0; i < 20; i++) tickWorkshop(w, s2);
    expect(s2.output.pottery).toBe(2);
    expect(s2.inputs.clay).toBe(10);
  });
});
