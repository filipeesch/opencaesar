import { describe, it, expect } from 'vitest';
// Phase 20 Wave 5 (UI-RED-06 / UI-FIX-03): UPPERCASE is a CSS-only
// presentation. Every label surface carries the `.uppercase` utility class
// (text-transform: uppercase; letter-spacing: 1px — the single place the
// case transform lives), while the DOM text stays the canonical 18-UI-SPEC
// wording so accessibility trees and golden cases see as-authored strings
// (T-20-06: accept).
import { buildSidebarDom } from '../../src/game/ui/sidebar';
import { buildTopBarDom } from '../../src/game/ui/topbar';
import { buildAdvisorDrawer } from '../../src/game/ui/advisorDrawer';
import { ADVISOR_TAB_ORDER, advisorPanels } from '../../src/game/advisors';
import { SimRunner } from '../../src/sim/runner';
import { foodChainMap, buildFoodCity } from '../helpers';

function runner() {
  const r = new SimRunner(42, foodChainMap());
  buildFoodCity(r);
  return r;
}

/** All descendant nodes whose className includes the given token. */
function byClass(node: { querySelectorAll(sel: string): { className: string; textContent: string }[] }, cls: string) {
  return node.querySelectorAll(`.${cls}`);
}

describe('UPPERCASE labels (UI-RED-06 / UI-FIX-03)', () => {
  it('sidebar nav buttons carry the .uppercase class (Advisors/Overlays/Messages/Settings)', () => {
    const r = runner();
    const dom = buildSidebarDom(r.getState(), r.getDerived());
    for (const testid of ['controls-advisors', 'controls-overlays', 'controls-messages', 'controls-settings']) {
      const btn = dom.root.querySelector(`[data-testid="${testid}"]`);
      expect(btn, `${testid} must exist`).not.toBeNull();
      expect(btn!.className, `${testid} must render UPPERCASE via .uppercase`).toContain('uppercase');
    }
  });

  it('overlay toggle label spans carry the .uppercase class (Water/Food/Risks/…/None)', () => {
    const r = runner();
    const dom = buildSidebarDom(r.getState(), r.getDerived());
    const toggles = dom.root.querySelectorAll('.overlay-toggle');
    expect(toggles.length).toBeGreaterThan(0);
    for (const toggle of toggles) {
      const label = toggle.querySelector('.uppercase');
      expect(label, `overlay toggle ${toggle.dataset.overlay} must carry an .uppercase label`).not.toBeNull();
    }
  });

  it('overlay toggle labels keep canonical wording in the DOM (case-only transform)', () => {
    const r = runner();
    const dom = buildSidebarDom(r.getState(), r.getDerived());
    // The authored strings byte-match the 18-UI-SPEC overlay names — the CSS
    // transform is what presents them UPPERCASE, the DOM never rewrites them.
    const water = dom.root.querySelector('[data-testid="overlay-water"]')!.querySelector('.uppercase');
    expect(water!.textContent).toBe('Water');
    const none = dom.root.querySelector('[data-testid="overlay-none"]')!.querySelector('.uppercase');
    expect(none!.textContent).toBe('None');
  });

  it('advisor tab DOM text stays canonical while carrying .uppercase (CSS is the single case place)', () => {
    const r = runner();
    const panels = advisorPanels(r);
    const dom = buildAdvisorDrawer(panels);
    const titles = new Map(panels.map((p) => [p.id, p.title]));
    for (const tab of dom.tabs()) {
      const node = dom.tabHost.querySelector(`[data-testid="advisor-tab-${tab.id}"]`);
      expect(node, `tab ${tab.id} must exist`).not.toBeNull();
      expect(node!.className, `tab ${tab.id} must render UPPERCASE via .uppercase`).toContain('uppercase');
      // DOM text is as-authored (canonical 18-UI-SPEC wording) — the CSS
      // utility is the single place the case transform lives.
      expect(node!.textContent, `tab ${tab.id} DOM text must stay canonical`).toBe(titles.get(tab.id));
      // The meta label keeps the UPPERCASE contract for the unit seam.
      expect(tab.label).toBe(tab.label.toUpperCase());
    }
  });

  it('advisor tabs cover the full 13-title catalog in ADVISOR_TAB_ORDER (no reworded labels)', () => {
    const r = runner();
    const panels = advisorPanels(r);
    const dom = buildAdvisorDrawer(panels);
    expect(dom.tabs().map((t) => t.id)).toEqual([...ADVISOR_TAB_ORDER]);
    const titles = new Map(panels.map((p) => [p.id, p.title]));
    for (const tab of dom.tabs()) {
      const node = dom.tabHost.querySelector(`[data-testid="advisor-tab-${tab.id}"]`);
      expect(node!.textContent).toBe(titles.get(tab.id));
    }
  });

  it('topbar label spans carry the .uppercase class', () => {
    const r = runner();
    const dom = buildTopBarDom(r.getState(), r.getDerived());
    const labels = byClass(dom.root, 'uppercase');
    expect(labels.length).toBeGreaterThanOrEqual(8); // 3 stat labels + 5 ratings
    const labelTexts = labels.map((l) => l.textContent);
    for (const expected of ['POPULATION', 'DATE', 'TREASURY', 'PROSPERITY', 'HAPPINESS', 'CULTURE', 'STABILITY', 'FAVOR']) {
      expect(labelTexts).toContain(expected);
    }
  });
});
