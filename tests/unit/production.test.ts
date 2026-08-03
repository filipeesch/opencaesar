import { describe, it, expect } from 'vitest';
import {
  EXTRACTION_SITES, WORKSHOPS, emptyProduction, tickWorkshop, workshopStatus,
  porterDelivers, selectDestination,
} from '../../src/sim/production';

describe('extraction sites (task 5.1)', () => {
  it('covers the four deposit sites', () => {
    expect(Object.keys(EXTRACTION_SITES).sort()).toEqual(
      ['clay_pit', 'iron_mine', 'marble_quarry', 'timber_yard'].sort(),
    );
    expect(EXTRACTION_SITES.iron_mine.requires).toBe('iron_deposit');
  });
});

describe('workshops (task 5.2)', () => {
  it('consumes input and produces output when working', () => {
    const w = WORKSHOPS.pottery;
    const s = emptyProduction(w);
    s.inputs.clay = 10;
    s.output.pottery = 0;
    const r = tickWorkshop(w, s);
    expect(r.produced).toBeGreaterThan(0);
    expect(s.inputs.clay).toBeLessThan(10);
    expect(s.output.pottery).toBeGreaterThan(0);
  });

  it('reports missing_input when an input is absent', () => {
    const w = WORKSHOPS.pottery;
    const s = emptyProduction(w);
    expect(workshopStatus(w, s)).toBe('missing_input');
  });

  it('reports output_full at capacity and produces nothing', () => {
    const w = WORKSHOPS.pottery;
    const s = emptyProduction(w);
    s.inputs.clay = 10;
    s.output.pottery = w.stockCapacity;
    expect(workshopStatus(w, s)).toBe('output_full');
    expect(tickWorkshop(w, s).produced).toBe(0);
  });

  it('porter delivers one load of output', () => {
    const w = WORKSHOPS.pottery;
    const s = emptyProduction(w);
    s.output.pottery = 3;
    expect(porterDelivers(w, s)).toBe(1);
    expect(s.output.pottery).toBe(2);
  });
});

describe('destination selection (task 5.3)', () => {
  it('picks the most needy destination and returns null when all are full', () => {
    const dests = [{ name: 'A', need: 1 }, { name: 'B', need: 5 }];
    const picked = selectDestination(dests, (d) => d.need);
    expect(picked?.name).toBe('B');
    const none = selectDestination([{ name: 'A', need: 0 }], (d) => d.need);
    expect(none).toBeNull();
  });
});
