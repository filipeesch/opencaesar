/**
 * Right sidebar (Phase 20 Wave 1).
 *
 * Pure builder: takes the live SimState + DerivedSnapshot and returns a
 * UiNode tree plus seam metadata for the unit tests. HUDScene mounts the
 * root, wires each control to the real handlers, and keeps the build grid /
 * policy / speed / action controls live.
 *
 * The tree carries BOTH the Phase-20 testids ([data-testid="sidebar-*"])
 * locked by e2e/sidebar.spec.ts and the Phase-18/19 legacy testids
 * (controls-*, build-*, policy-*, overlay-*, settings-*, pause-button …)
 * that management-ui/acceptance/settings/boots specs still drive — one DOM,
 * two testid generations.
 */
import type { SimState } from '../../sim/types';
import type { BuildingType } from '../../sim/types';
import type { DerivedSnapshot } from '../../sim/runner';
import { BUILDINGS } from '../../sim/buildings';
import { el, type UiNode } from './dom';

export const SPEEDS: readonly number[] = [0.5, 1, 2, 4, 8];

export const BUILD_CATEGORIES: readonly string[] = [
  'roads', 'housing', 'food', 'water', 'infrastructure', 'engineering', 'safety',
  'health', 'education', 'entertainment', 'religion', 'government', 'ornament',
];

export const BUILD_TYPES: readonly BuildingType[] = [
  'road', 'house', 'garden', 'well', 'fountain', 'farm', 'orchard', 'granary',
  'market', 'engineer_post', 'fire_station', 'clinic', 'school', 'library',
  'temple', 'theatre', 'forum',
];

/** Overlay toggles (legacy ids + locked shortcut keys, SPEC §3). */
export const OVERLAY_KEYS: readonly { id: string; label: string; key: string }[] = [
  { id: 'water', label: 'Water', key: 'W' },
  { id: 'food', label: 'Food', key: 'F' },
  { id: 'risks', label: 'Risks', key: 'R' },
  { id: 'coverage', label: 'Coverage', key: 'C' },
  { id: 'desirability', label: 'Desirability', key: 'D' },
];

export interface SidebarDom {
  root: UiNode; // [data-testid="sidebar"]
  nav: UiNode; // legacy .hud-control-bar (controls-* buttons)
  buildPanel: UiNode; // [data-testid="sidebar-build-panel"]
  categoryTabs: UiNode; // [data-testid="sidebar-category-tabs"]
  buildGrid: UiNode; // [data-testid="sidebar-build-grid"]
  toolsPanel: UiNode; // [data-testid="sidebar-tools-panel"]
  policyTax: UiNode; // <input data-testid="policy-tax">
  policyWage: UiNode; // <input data-testid="policy-wage">
  policyTaxValue: UiNode; // <span data-testid="policy-tax-value"> (legacy label, placement.spec)
  policyWageValue: UiNode; // <span data-testid="policy-wage-value">
  speedRow: UiNode; // [data-testid="sidebar-speed-row"]
  advisorButton: UiNode; // [data-testid="sidebar-advisor-button"]
  overlayGroup: UiNode; // [data-testid="sidebar-overlay-group"]
  overlayBar: UiNode; // [data-testid="overlay-bar"] (legacy toggle bar)
  actionGroup: UiNode; // pause/resume/save/restart (sidebar-* wrappers)
  settingsDrawer: UiNode; // [data-testid="settings-drawer"]
  drawerHost: UiNode; // where HUDScene mounts the advisor drawer root
  inspectorHost: UiNode;
  logHost: UiNode; // [data-testid="log-panel"] > ul#message-log
  legendHost: UiNode; // [data-testid="overlay-legend"]
  toastHost: UiNode; // [data-testid="toast"]
  controls(): Record<string, { seam: string }>;
  buildings(): { cost: number; category: string; seam: string }[];
  policy(): { tax: { seam: string }; wage: { seam: string } };
  speeds(): { value: number; seam: string }[];
  labels(): Record<string, string>;
  seams(): Record<string, string>;
}

const CONTROL_SEAMS: Record<string, string> = {
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

export function buildSidebarDom(state: SimState, _derived: DerivedSnapshot): SidebarDom {
  // --- Nav (legacy .hud-control-bar with controls-* buttons) ---
  const nav = el('nav', { className: 'hud-control-bar sidebar-nav' },
    el('button', { className: 'hud-control-btn', testid: 'controls-advisors', text: 'Advisors' }),
    el('button', { className: 'hud-control-btn', testid: 'controls-overlays', text: 'Overlays' }),
    el('button', { className: 'hud-control-btn', testid: 'controls-messages', text: 'Messages' }),
    el('button', { className: 'hud-control-btn', testid: 'controls-settings', text: 'Settings' }),
  );

  // --- Build panel: 13 category tabs + 17-building grid (seam: setBuildMode) ---
  const categoryTabs = el('div', { className: 'sidebar-category-tabs', testid: 'sidebar-category-tabs' },
    ...BUILD_CATEGORIES.map((cat) =>
      el('button', {
        className: 'hud-cat-btn sidebar-category-btn', testid: `category-${cat}`,
        dataset: { cat }, text: cat,
      })),
  );

  const buildGrid = el('div', { className: 'hud-build-grid sidebar-build-grid', testid: 'sidebar-build-grid' },
    ...BUILD_TYPES.map((type) => {
      const def = BUILDINGS[type];
      // Legacy testid lives on the real button (build-{type}); the Phase-20
      // testid on a wrapper so both selector generations resolve.
      return el('div', { className: 'sidebar-build-cell', testid: `building-${type}` },
        el('button', {
          className: 'hud-build-btn',
          testid: `build-${type}`,
          dataset: { build: type, category: def.category },
          text: `${def.name} (${def.cost})`,
          title: `${def.name} — ${def.cost} denarii`,
        }),
      );
    }),
  );

  const buildPanel = el('div', { className: 'hud-panel sidebar-build-panel', testid: 'sidebar-build-panel' },
    el('div', { className: 'hud-subtitle', text: 'BUILD' }),
    categoryTabs,
    buildGrid,
  );

  // --- Tools panel: policy sliders (seam: setPolicy + getPolicy) ---
  const policyTax = el('input', {
    className: 'sidebar-policy', testid: 'policy-tax', type: 'range', min: '0', max: '100',
    value: String(Math.round(state.policy.taxRate * 100)),
  });
  const policyWage = el('input', {
    className: 'sidebar-policy', testid: 'policy-wage', type: 'range', min: '0', max: '100',
    value: String(Math.round(state.policy.wageRate * 100)),
  });
  // Legacy value labels (placement.spec): show the slider's percent next to it.
  const policyTaxValue = el('span', { className: 'sidebar-policy-value', testid: 'policy-tax-value', text: `${Math.round(state.policy.taxRate * 100)}%` });
  const policyWageValue = el('span', { className: 'sidebar-policy-value', testid: 'policy-wage-value', text: `${Math.round(state.policy.wageRate * 100)}%` });
  const toolsPanel = el('div', { className: 'hud-panel sidebar-tools-panel', testid: 'sidebar-tools-panel' },
    el('div', { className: 'hud-subtitle', text: 'TOOLS' }),
    el('label', { className: 'sidebar-tool', testid: 'sidebar-policy-tax', text: 'TAX' }, policyTax, policyTaxValue),
    el('label', { className: 'sidebar-tool', testid: 'sidebar-policy-wage', text: 'WAGE' }, policyWage, policyWageValue),
  );

  // --- Speed row (seam: setSpeed) ---
  const speedRow = el('div', { className: 'sidebar-speed-row', testid: 'sidebar-speed-row' },
    el('div', { className: 'hud-subtitle', text: 'SPEED' }),
    el('div', { className: 'sidebar-speed-btns' },
      ...SPEEDS.map((s) =>
        el('button', { className: 'hud-speed-btn sidebar-speed-btn', testid: `speed-${s}`, text: `${s}×` })),
    ),
  );

  const advisorButton = el('button', { className: 'sidebar-advisor-button hud-control-btn', testid: 'sidebar-advisor-button', text: 'ADVISORS' });

  // --- Overlay group (legacy overlay-bar with overlay-* toggles + None) ---
  const overlayToggles = el('div', { className: 'overlay-toggles' },
    ...OVERLAY_KEYS.map((o) =>
      el('button', { className: 'overlay-toggle', testid: `overlay-${o.id}`, dataset: { overlay: o.id } },
        el('span', { text: o.label }),
        el('span', { className: 'shortcut', text: o.key }),
      )),
    el('button', { className: 'overlay-toggle', testid: 'overlay-none', dataset: { overlay: 'none' } },
      el('span', { text: 'None' }),
      el('span', { className: 'shortcut', text: 'X' }),
    ),
  );
  const overlayBar = el('div', { className: 'overlay-bar sidebar-overlay-bar', testid: 'overlay-bar' },
    overlayToggles,
  );
  overlayBar.style.display = 'none';
  // The group keeps the OVERLAYS title always visible; only the toggle row
  // (legacy overlay-bar) is hidden until the nav button opens it.
  const overlayGroup = el('div', { className: 'sidebar-overlay-group', testid: 'sidebar-overlay-group' },
    el('div', { className: 'hud-subtitle', text: 'OVERLAYS' }),
    overlayBar,
  );

  // --- Action group: pause / resume / save / restart (sidebar-* wrappers
  //     around legacy pause-button; the pause overlay reuses resume/save/
  //     restart testids, so the sidebar duplicates are wrapper-only). ---
  const actionGroup = el('div', { className: 'sidebar-action-group' },
    el('div', { className: 'sidebar-action-cell', testid: 'sidebar-pause-button' },
      el('button', { className: 'hud-pause-btn sidebar-action-btn', testid: 'pause-button', text: '❚❚', title: 'Pause' })),
    el('div', { className: 'sidebar-action-cell', testid: 'sidebar-resume-button' },
      el('button', { className: 'home-btn sidebar-action-btn', text: 'Resume' })),
    el('div', { className: 'sidebar-action-cell', testid: 'sidebar-save-button' },
      el('button', { className: 'home-btn sidebar-action-btn', text: 'Save' })),
    el('div', { className: 'sidebar-action-cell', testid: 'sidebar-restart-button' },
      el('button', { className: 'home-btn sidebar-action-btn', text: 'Restart' })),
  );

  // --- Settings drawer (legacy opt-* controls; values pre-filled on open) ---
  const settingsDrawer = buildSettingsDrawer();
  // Hidden until the nav button toggles it (wave-0 behavior): the drawer is a
  // fixed-position overlay with pointer-events: auto, so leaving it visible at
  // startup would swallow mid-screen clicks/drags (alignment pan e2e).
  settingsDrawer.style.display = 'none';

  // --- Hosts: advisor drawer (module root mounts here), inspector, log,
  //     overlay legend, toast. ---
  const drawerHost = el('div', { className: 'sidebar-drawer-host' });
  const inspectorHost = el('div', { className: 'sidebar-inspector-host' });
  const logHost = el('div', { className: 'hud-panel hud-log sidebar-log', testid: 'log-panel' },
    el('div', { className: 'hud-subtitle', text: 'MESSAGES' }),
    el('ul', { testid: 'message-log' }),
  );
  const legendHost = el('div', { className: 'overlay-legend sidebar-legend', testid: 'overlay-legend' });
  legendHost.style.display = 'none';
  const toastHost = el('div', { className: 'hud-toast sidebar-toast', testid: 'toast' });
  toastHost.style.display = 'none';

  const root = el('div', { className: 'hud-sidebar', testid: 'sidebar' },
    nav,
    buildPanel,
    toolsPanel,
    speedRow,
    advisorButton,
    overlayGroup,
    actionGroup,
    settingsDrawer,
    drawerHost,
    inspectorHost,
    logHost,
    legendHost,
    toastHost,
  );

  const seams = () => ({
    ...CONTROL_SEAMS,
    build: 'MainScene.setBuildMode',
    policy: 'SimRunner.setPolicy + getPolicy',
    speed: 'MainScene.setSpeed',
    pause: 'MainScene.setPaused',
    resume: 'MainScene.setPaused(false)',
    save: 'writeSave(getSaveData())',
    restart: 'MainScene.restartToHome',
  });

  return {
    root,
    nav,
    buildPanel,
    categoryTabs,
    buildGrid,
    toolsPanel,
    policyTax,
    policyWage,
    policyTaxValue,
    policyWageValue,
    speedRow,
    advisorButton,
    overlayGroup,
    overlayBar,
    actionGroup,
    settingsDrawer,
    drawerHost,
    inspectorHost,
    logHost,
    legendHost,
    toastHost,
    controls: () =>
      Object.fromEntries(
        Object.entries(CONTROL_SEAMS).map(([id, seam]) => [id, { seam }]),
      ) as Record<string, { seam: string }>,
    buildings: () =>
      BUILD_TYPES.map((type) => {
        const def = BUILDINGS[type];
        return { cost: def.cost, category: def.category, seam: 'MainScene.setBuildMode' };
      }),
    policy: () => ({
      tax: { seam: 'SimRunner.setPolicy + getPolicy' },
      wage: { seam: 'SimRunner.setPolicy + getPolicy' },
    }),
    speeds: () =>
      SPEEDS.map((value) => ({ value, seam: 'MainScene.setSpeed' })),
    labels: () => ({ BUILD: 'BUILD', TOOLS: 'TOOLS', SPEED: 'SPEED', MESSAGES: 'MESSAGES' }),
    seams,
  };
}

/** Settings drawer frame (Phase 19 PERS-02) — controls pre-filled on open. */
function buildSettingsDrawer(): UiNode {
  const makeSelect = (testid: string, values: string[]): UiNode =>
    el('select', { dataset: { testid }, className: 'settings-select' },
      ...values.map((v) => el('option', { value: v, text: v })),
    );
  const settingRow = (label: string, control: UiNode): UiNode =>
    el('div', { className: 'hud-settings-row' },
      el('label', { text: label }),
      control,
    );

  const graphicsSel = makeSelect('opt-graphics', ['low', 'medium', 'high']);
  const musicRange = el('input', { type: 'range', min: '0', max: '1', step: '0.1', dataset: { testid: 'opt-music' } });
  const sfxRange = el('input', { type: 'range', min: '0', max: '1', step: '0.1', dataset: { testid: 'opt-sfx' } });
  const speedSel = makeSelect('opt-speed', ['0.5', '1', '2', '4', '8']);
  const textSizeSel = makeSelect('opt-text-size', ['small', 'normal', 'large']);
  const reducedMotionBox = el('input', { type: 'checkbox', dataset: { testid: 'opt-reduced-motion' } });

  const settingsRows = el('div', { className: 'settings-rows' },
    settingRow('Graphics quality', graphicsSel),
    settingRow('Music', musicRange),
    settingRow('Sound effects', sfxRange),
    settingRow('Default speed', speedSel),
    settingRow('Text size', textSizeSel),
    settingRow('Reduced motion', reducedMotionBox),
  );

  return el('div', { className: 'settings-drawer sidebar-settings', testid: 'settings-drawer' },
    el('div', { className: 'hud-subtitle', text: 'SETTINGS' }),
    settingsRows,
    el('div', { className: 'settings-note', text: 'Graphics quality applies on next launch.' }),
    el('button', { className: 'settings-save-btn', testid: 'settings-save', text: 'Save' }),
  );
}
