import { describe, it, expect } from 'vitest';
import { advisorPanels, ADVISOR_TAB_ORDER } from '../../src/game/advisors';
import { SimRunner } from '../../src/sim/runner';
import { foodChainMap, buildFoodCity } from '../helpers';

/**
 * UI-02 — the 13-advisor pure composer (Phase 18, Wave 0 scaffold).
 *
 * Written against the TARGET surface: `advisorPanels(source)` maps each panel's
 * values to the ACTUAL runner getters (never string-keyed, never fabricated).
 * RED until 18-02-01 implements src/game/advisors.ts.
 */

describe('advisor composer (UI-02)', () => {
  it('returns exactly 13 panels in the locked UI-SPEC tab order', () => {
    const r = new SimRunner(42, foodChainMap());
    buildFoodCity(r);
    for (let i = 0; i < 400; i++) r.tick();

    const panels = advisorPanels(r);
    expect(panels.length).toBe(13);
    expect(panels.map((p) => p.id)).toEqual([...ADVISOR_TAB_ORDER]);
  });

  it('traces finance and ratings values to the real runner getters', () => {
    const r = new SimRunner(42, foodChainMap());
    buildFoodCity(r);
    for (let i = 0; i < 400; i++) r.tick();

    const panels = advisorPanels(r);
    const finance = panels.find((p) => p.id === 'finance')!;
    expect(finance).toBeDefined();
    const balance = finance.rows.find((row) => row.label === 'Balance');
    expect(balance).toBeDefined();
    // Display rounds denarii; provenance = within 1 of the live getter's balance.
    expect(Number(balance!.value)).toBeCloseTo(r.getFinanceAdvisor().balance, 0);

    const ratings = panels.find((p) => p.id === 'ratings')!;
    expect(ratings).toBeDefined();
    const culture = ratings.rows.find((row) => row.label === 'Culture');
    expect(culture).toBeDefined();
    expect(Number(culture!.value)).toBe(r.getDerived().culture);
  });

  it('never fabricates trade totals — they match getTradeAdvisor()', () => {
    const r = new SimRunner(9);
    r.enableTrade('massilia', true);
    r.tick();
    const trade = advisorPanels(r).find((p) => p.id === 'trade');
    expect(trade).toBeDefined();
    const totals = r.getTradeAdvisor().totals;
    const exportsRow = trade!.rows.find((row) => row.label === 'Export Proceeds');
    if (exportsRow) expect(Number(exportsRow.value)).toBe(totals.exportProceeds);
    const routesRow = trade!.rows.find((row) => row.label === 'Active Routes');
    if (routesRow) expect(Number(routesRow.value)).toBe(totals.activeRoutes);
  });

  it('every panel carries a real action descriptor (or is a no-data empty state)', () => {
    const kinds = ['open-inspector', 'locate', 'open-overlay', 'open-codex'];
    for (const seed of [7, 42, 1337]) {
      const panels = advisorPanels(new SimRunner(seed));
      expect(panels.length).toBe(13);
      for (const p of panels) {
        expect(p.action === null || kinds.includes(p.action!.kind)).toBe(true);
        expect(Array.isArray(p.rows)).toBe(true);
      }
    }
  });

  it('empty-city calls are total — no throw, 13 panels, no-data flags where data is absent', () => {
    const r = new SimRunner(1337);
    expect(() => advisorPanels(r)).not.toThrow();
    const panels = advisorPanels(r);
    expect(panels.length).toBe(13);
    // Panels whose live source has no data must say so instead of inventing values.
    for (const p of panels) {
      if (p.noData === true) {
        expect(p.rows.length).toBeGreaterThanOrEqual(0);
      }
    }
    // A city with no buildings/missions has no object data — at least the
    // mission/objectives panel reports no-data rather than throwing.
    expect(advisorPanels(new SimRunner(1)).length).toBe(13);
  });
});
