import { describe, it, expect } from 'vitest';
// Phase 20 Wave 0 RED scaffold: advisor drawer contract.
// Imports the target module Wave 2 implements. Fails today: module absent.
import { buildAdvisorDrawer } from '../../src/game/ui/advisorDrawer';
import { ADVISOR_TAB_ORDER, advisorPanels } from '../../src/game/advisors';
import { SimRunner } from '../../src/sim/runner';
import { foodChainMap, buildFoodCity } from '../helpers';

// advisorPanels(source) needs a live runner (the locked advisors.ts seam);
// feed it the same happy-path city the other Phase-20 scaffolds use.
function runnerPanels() {
  const r = new SimRunner(42, foodChainMap());
  buildFoodCity(r);
  return advisorPanels(r);
}

describe('advisor drawer (13 tabs, UI-RED-01/02)', () => {
  it('builds a drawer with 13 tabs in ADVISOR_TAB_ORDER', () => {
    const panels = runnerPanels();
    const dom = buildAdvisorDrawer(panels);
    expect(dom).toBeDefined();
    expect(dom.tabHost).toBeDefined();
    expect(dom.panelHost).toBeDefined();
    expect(dom.tabs().length).toBe(13);
    expect(dom.tabs().map((t) => t.id)).toEqual([...ADVISOR_TAB_ORDER]);
  });

  it('every advisor panel has a real runner feed (no orphan tab)', () => {
    const panels = runnerPanels();
    const dom = buildAdvisorDrawer(panels);
    for (const tab of dom.tabs()) {
      expect(tab.feed, `advisor tab ${tab.id} has no runner feed`).toBeTruthy();
      expect(tab.panel, `advisor tab ${tab.id} has no panel content`).toBeDefined();
    }
  });

  it('tab labels are UPPERCASE verbatim from 18-UI-SPEC', () => {
    const panels = runnerPanels();
    const dom = buildAdvisorDrawer(panels);
    for (const tab of dom.tabs()) {
      expect(tab.label, `advisor tab ${tab.id} label must be UPPERCASE`).toBe(tab.label.toUpperCase());
    }
  });

  it('selectAdvisor(id) reveals exactly one panel and marks the tab active', () => {
    const panels = runnerPanels();
    const dom = buildAdvisorDrawer(panels);
    dom.selectAdvisor('finance');
    expect(dom.activeTab()).toBe('finance');
    expect(dom.panelHost.visiblePanel()).toBe('finance');
    dom.selectAdvisor('objectives');
    expect(dom.activeTab()).toBe('objectives');
    expect(dom.panelHost.visiblePanel()).toBe('objectives');
  });

  it('the drawer is closed by default and opens on request (keyboard contract)', () => {
    const panels = runnerPanels();
    const dom = buildAdvisorDrawer(panels);
    expect(dom.isOpen()).toBe(false);
    dom.open();
    expect(dom.isOpen()).toBe(true);
    dom.close();
    expect(dom.isOpen()).toBe(false);
  });
});
