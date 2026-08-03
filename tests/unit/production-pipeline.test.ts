import { describe, it, expect } from 'vitest';
import {
  WORKSHOPS, emptyProduction, tickWorkshop, workshopStatus,
  porterDestination, porterDeliversTo, workshopBottleneck,
} from '../../src/sim/production';
import type { LoadDestination } from '../../src/sim/production';

function dest(id: string, opts: Partial<LoadDestination> = {}): LoadDestination {
  return {
    id, kind: 'workshop', accepts: () => true, capacity: 10, distance: 5, need: 0, ...opts,
  };
}

describe('destination validity (PROD-02 §16.4)', () => {
  it('a needy workshop that accepts and has capacity wins over a full workshop', () => {
    const needy = dest('needy_ws', { need: 9, capacity: 5 });
    const full = dest('full_ws', { need: 0, capacity: 0 });
    const picked = porterDestination('pottery', [full, needy], []);
    expect(picked?.id).toBe('needy_ws');
  });

  it('a valid workshop beats a nearer-but-not-valid warehouse', () => {
    const workshop = dest('ws1', { kind: 'workshop', need: 1, distance: 20, accepts: (c) => c === 'pottery' });
    const nearInvalid = dest('wh_near', { kind: 'warehouse', distance: 1, accepts: () => false });
    const nearEmpty = dest('wh_empty', { kind: 'warehouse', distance: 1, capacity: 0 });
    expect(porterDestination('pottery', [workshop], [nearInvalid, nearEmpty])?.id).toBe('ws1');
  });

  it('workshop priority over warehouse — with both valid, returns the workshop', () => {
    const workshop = dest('ws1', { kind: 'workshop', need: 1, distance: 50 });
    const warehouse = dest('wh1', { kind: 'warehouse', distance: 1 });
    expect(porterDestination('pottery', [workshop], [warehouse])?.kind).toBe('workshop');
  });

  it('warehouse fallback — when every workshop is full or refuses, the nearest valid warehouse is returned', () => {
    const fullWs = dest('ws_full', { capacity: 0 });
    const refuseWs = dest('ws_refuse', { accepts: () => false });
    const far = dest('wh_far', { kind: 'warehouse', distance: 30 });
    const near = dest('wh_near', { kind: 'warehouse', distance: 4 });
    const picked = porterDestination('pottery', [fullWs, refuseWs], [far, near]);
    expect(picked?.id).toBe('wh_near');
  });

  it('blocked — no valid destination means null and the load is kept (nothing destroyed)', () => {
    const refuseWs = dest('ws_refuse', { accepts: () => false });
    const emptyWh = dest('wh_empty', { capacity: 0, kind: 'warehouse' });
    expect(porterDestination('pottery', [refuseWs], [emptyWh])).toBeNull();

    // a tickWorkshop-equivalent state keeps its full stock when blocked
    // (output at capacity → output_full is non-destructive and sets blocked)
    const w = WORKSHOPS.pottery;
    const s = emptyProduction(w);
    s.inputs.clay = 10;
    s.output.pottery = w.stockCapacity;
    s.active = true;
    const beforeOut = s.output.pottery;
    const beforeIn = s.inputs.clay;
    const r = tickWorkshop(w, s);
    expect(r.produced).toBe(0);
    expect(s.blocked).toBe(true);
    expect(s.output.pottery).toBe(beforeOut);
    expect(s.inputs.clay).toBe(beforeIn);
  });
});

describe('pipeline (decision 2)', () => {
  it('repeated tickWorkshop consumes inputs and fills output up to capacity', () => {
    const w = WORKSHOPS.pottery;
    const s = emptyProduction(w);
    s.inputs.clay = 30; // enough to drive output to capacity (0.3/tick)
    s.output.pottery = 0;
    let produced = 0;
    for (let i = 0; i < 200; i++) {
      const r = tickWorkshop(w, s);
      produced += r.produced;
      if (r.produced === 0) break; // stopped: capacity reached or input exhausted
    }
    // both happened: input consumed → output produced, up to capacity
    expect(s.inputs.clay).toBeLessThan(30);
    expect(produced).toBeGreaterThan(0);
    expect(s.output.pottery).toBeGreaterThanOrEqual(w.stockCapacity - 0.01);
    expect(s.inputs.clay).toBeGreaterThanOrEqual(0);
  });

  it('dispatch to a WORKSHOP destination — output falls by 1 and destination stock rises by 1 (conservation)', () => {
    const w = WORKSHOPS.pottery;
    const s = emptyProduction(w);
    s.inputs.clay = 10;
    s.output.pottery = 3;

    const needy = dest('consumer_ws', { kind: 'workshop', need: 5, capacity: 8 });
    const workshopStock: Record<string, number> = {};
    const moved = porterDeliversTo(w, s, { stock: workshopStock, capacity: 8 });
    expect(moved).toBe(1);
    expect(s.output.pottery).toBe(2); // fell by exactly 1
    expect(workshopStock.pottery).toBe(1); // rose by exactly 1
    expect(porterDestination('pottery', [needy], [])?.id).toBe('consumer_ws');
  });

  it('dispatch to a WAREHOUSE destination — stock rises by 1 within capacity; a full warehouse receives 0', () => {
    const w = WORKSHOPS.pottery;
    const s = emptyProduction(w);
    s.inputs.clay = 10;
    s.output.pottery = 5;

    const wh: { stock: Record<string, number>; capacity: number } = { stock: { pottery: 2 }, capacity: 4 };
    const moved = porterDeliversTo(w, s, wh);
    expect(moved).toBe(1);
    expect(wh.stock.pottery).toBe(3);
    expect(s.output.pottery).toBe(4);

    // full warehouse → 0 moved, output stays
    const fullWh: { stock: Record<string, number>; capacity: number } = { stock: { pottery: 4 }, capacity: 4 };
    const movedFull = porterDeliversTo(w, s, fullWh);
    expect(movedFull).toBe(0);
    expect(fullWh.stock.pottery).toBe(4);
    expect(s.output.pottery).toBe(4);

    // partial room moves exactly the remaining room (capacity caps the move)
    const partialWh: { stock: Record<string, number>; capacity: number } = { stock: { pottery: 0 }, capacity: 1 };
    const movedPartial = porterDeliversTo(w, s, partialWh);
    expect(movedPartial).toBe(1);
    expect(partialWh.stock.pottery).toBe(1);
    expect(s.output.pottery).toBe(3);
  });

  it('workshopBottleneck labels match workshopStatus and report no_destination when working with no valid destination', () => {
    const w = WORKSHOPS.pottery;
    const s = emptyProduction(w);

    s.inputs.clay = 0;
    s.output.pottery = 0;
    s.active = true;
    expect(workshopStatus(w, s)).toBe('missing_input');
    expect(workshopBottleneck(w, s, true)).toBe('missing_input');

    s.inputs.clay = 10;
    s.output.pottery = w.stockCapacity;
    expect(workshopStatus(w, s)).toBe('output_full');
    expect(workshopBottleneck(w, s, true)).toBe('output_full');

    s.inputs.clay = 10;
    s.output.pottery = 0;
    s.active = false;
    expect(workshopStatus(w, s)).toBe('blocked');
    expect(workshopBottleneck(w, s, true)).toBe('blocked');

    s.active = true;
    expect(workshopStatus(w, s)).toBe('working');
    expect(workshopBottleneck(w, s, true)).toBe('working');
    expect(workshopBottleneck(w, s, false)).toBe('no_destination');
  });
});
