import { describe, it, expect } from 'vitest';
// Phase 20 Wave 0 RED scaffold: sidebar controls contract (UI-RED-01/03).
// Imports the target module Wave 1 implements. Fails today: module absent.
import { buildSidebarDom, BUILD_CATEGORIES } from '../../src/game/ui/sidebar';
import { SimRunner } from '../../src/sim/runner';
import { foodChainMap, buildFoodCity } from '../helpers';

/**
 * Every sidebar control must map to a REAL runner seam. No decorative/orphan
 * buttons. This locks UI-RED-03 (no orphan controls after relocation).
 */
const SEAM_MAP: Record<string, string> = {
  'nav-advisors': 'advisorPanels + ADVISOR_TAB_ORDER (open drawer)',
  'nav-overlays': 'overlay-toggle bus → MainScene.setOverlay',
  'nav-messages': 'getState().messages',
  'nav-settings': 'loadOptions/saveOptions/applyOptions',
  'build-panel': 'MainScene.setBuildMode',
  'tools-policy': 'SimRunner.setPolicy + getPolicy',
  'speed-row': 'MainScene.setSpeed',
  'advisor-drawer': 'advisorPanels + ADVISOR_TAB_ORDER + selectAdvisor',
  'overlay-group': 'overlay-toggle bus → MainScene.setOverlay',
  'inspector-host': 'getInspector + getWalkerInternals',
  'pause-button': 'MainScene.setPaused',
  'resume-button': 'MainScene.setPaused(false)',
  'save-button': 'writeSave(getSaveData())',
  'restart-button': 'MainScene.restartToHome',
};

function runner() {
  const r = new SimRunner(42, foodChainMap());
  buildFoodCity(r);
  return r;
}

describe('sidebar controls (UI-RED-01/03)', () => {
  it('builds a sidebar with every control wired to a runner seam', () => {
    const r = runner();
    const dom = buildSidebarDom(r.getState(), r.getDerived());
    expect(dom).toBeDefined();
    expect(dom.root).toBeDefined();
    expect(dom.nav).toBeDefined();
    expect(dom.buildPanel).toBeDefined();
    expect(dom.toolsPanel).toBeDefined();
    expect(dom.speedRow).toBeDefined();
    expect(dom.advisorButton).toBeDefined();
    expect(dom.overlayGroup).toBeDefined();
    expect(dom.inspectorHost).toBeDefined();
    expect(dom.logHost).toBeDefined();
    expect(dom.toastHost).toBeDefined();
  });

  it('no orphan controls — every sidebar control has a runner seam', () => {
    const r = runner();
    const dom = buildSidebarDom(r.getState(), r.getDerived());
    const controls = dom.controls();
    for (const id of Object.keys(SEAM_MAP)) {
      expect(controls[id], `${id} must exist in the sidebar`).toBeDefined();
    }
    // Every control exposes a seam name; an orphan is a control with no seam.
    for (const id of Object.keys(controls)) {
      expect(SEAM_MAP[id], `control ${id} is decorative/orphan (no runner seam)`).toBeDefined();
    }
  });

  it('labels are UPPERCASE verbatim from 18-UI-SPEC', () => {
    const r = runner();
    const dom = buildSidebarDom(r.getState(), r.getDerived());
    const labels = dom.labels();
    for (const [id, label] of Object.entries(labels)) {
      expect(label, `${id} label must be UPPERCASE`).toBe(label.toUpperCase());
    }
  });

  it('build panel exposes the 17-building grid with cost + category seams', () => {
    const r = runner();
    const dom = buildSidebarDom(r.getState(), r.getDerived());
    const buildings = dom.buildings();
    expect(buildings.length).toBe(17);
    for (const b of buildings) {
      // Roads are the free building by sim definition (BUILDINGS.road.cost = 0),
      // so costs are non-negative — every entry still exposes its real cost
      // seam and its category.
      expect(b.cost).toBeGreaterThanOrEqual(0);
      expect(b.category).toBeTruthy();
      expect(b.seam).toBe('MainScene.setBuildMode');
    }
  });

  it('policy sliders read getPolicy and write setPolicy', () => {
    const r = runner();
    const dom = buildSidebarDom(r.getState(), r.getDerived());
    const policy = dom.policy();
    expect(policy.tax.seam).toBe('SimRunner.setPolicy + getPolicy');
    expect(policy.wage.seam).toBe('SimRunner.setPolicy + getPolicy');
    expect(r.getPolicy()).toBeDefined();
  });

  it('speed row has the 5 locked speeds wired to setSpeed', () => {
    const r = runner();
    const dom = buildSidebarDom(r.getState(), r.getDerived());
    const speeds = dom.speeds();
    expect(speeds.map((s) => s.value)).toEqual([0.5, 1, 2, 4, 8]);
    for (const s of speeds) {
      expect(s.seam).toBe('MainScene.setSpeed');
    }
  });

  it('WR-02: the category filter leads with the "all" reset tab (Phase-18 regression)', () => {
    // Once a category tab is clicked the 17-building grid would be filtered
    // forever without a reset — the 'all' tab restores the full catalog.
    expect(BUILD_CATEGORIES[0]).toBe('all');
    expect(BUILD_CATEGORIES).toContain('all');
    expect(BUILD_CATEGORIES.length).toBe(14); // all + 13 categories
    const r = runner();
    const dom = buildSidebarDom(r.getState(), r.getDerived());
    const allTab = dom.categoryTabs.children.find(
      (c) => (c as unknown as { dataset: Record<string, string> }).dataset.cat === 'all',
    );
    expect(allTab).toBeDefined();
    expect(allTab!.dataset.testid).toBe('category-all');
  });
});
