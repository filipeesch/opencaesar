import { describe, it, expect } from 'vitest';
// Phase 20 Wave 0 RED scaffold: top status bar layout contract.
// Imports the target module Wave 1 implements. Fails today: module absent.
import { buildTopBarDom } from '../../src/game/ui/topbar';
import { SimRunner } from '../../src/sim/runner';
import { foodChainMap, buildFoodCity } from '../helpers';

/**
 * Date derivation locked from src/sim/runner.ts (SimState.tick):
 *   year  = floor(tick / 360)
 *   month = floor((tick % 360) / 40) + 1   (9 months/yr; month cadence tick%40)
 */
function dateOf(tick: number): { year: number; month: number } {
  const year = Math.floor(tick / 360);
  const month = Math.floor((tick % 360) / 40) + 1;
  return { year, month };
}

function runner() {
  const r = new SimRunner(42, foodChainMap());
  buildFoodCity(r);
  return r;
}

describe('top status bar (UI-RED-01/02)', () => {
  it('builds a topbar with population/date/treasury/ratings fields', () => {
    const r = runner();
    const dom = buildTopBarDom(r.getState(), r.getDerived());
    expect(dom).toBeDefined();
    expect(dom.population).toBeDefined();
    expect(dom.date).toBeDefined();
    expect(dom.treasury).toBeDefined();
    expect(dom.ratings).toBeDefined();
    expect(dom.labels().POPULATION).toBe('POPULATION');
    expect(dom.labels().DATE).toBe('DATE');
    expect(dom.labels().TREASURY).toBe('TREASURY');
  });

  it('population/treasury read getState().ratings', () => {
    const r = runner();
    const state = r.getState();
    const dom = buildTopBarDom(state, r.getDerived());
    expect(dom.population.value).toBe(state.ratings.population);
    expect(dom.treasury.value).toBe(state.treasury);
    expect(dom.population.seam).toBe('getState().ratings.population');
    expect(dom.treasury.seam).toBe('getState().treasury');
  });

  it('date derives from SimState.tick via year=floor(tick/360), month=floor((tick%360)/40)+1', () => {
    const r = runner();
    const state = r.getState();
    const dom = buildTopBarDom(state, r.getDerived());
    const expected = dateOf(state.tick);
    expect(dom.date.year).toBe(expected.year);
    expect(dom.date.month).toBe(expected.month);
    expect(dom.date.seam).toBe('getState().tick');
  });

  it('ratings row shows the 5 locked ratings from getState + getDerived', () => {
    const r = runner();
    const state = r.getState();
    const derived = r.getDerived();
    const dom = buildTopBarDom(state, derived);
    const ratings = dom.ratings;
    expect(ratings.prosperity.seam).toBe('getState().ratings.prosperity');
    expect(ratings.happiness.seam).toBe('getState().ratings.happiness');
    expect(ratings.culture.seam).toBe('getDerived().culture');
    expect(ratings.stability.seam).toBe('getDerived().stability');
    expect(ratings.favor.seam).toBe('getDerived().favor');
  });

  it('no orphan stats — every relocated stat cell keeps its seam', () => {
    const r = runner();
    const dom = buildTopBarDom(r.getState(), r.getDerived());
    const seams = dom.seams();
    // Every topbar cell maps to a runner seam (read-only, display-only is fine).
    for (const [id, seam] of Object.entries(seams)) {
      expect(seam, `topbar cell ${id} is orphaned (no seam)`).toBeTruthy();
    }
  });

  it('labels are UPPERCASE verbatim from 18-UI-SPEC', () => {
    const r = runner();
    const dom = buildTopBarDom(r.getState(), r.getDerived());
    for (const [id, label] of Object.entries(dom.labels())) {
      expect(label, `${id} label must be UPPERCASE`).toBe(label.toUpperCase());
    }
  });
});
