/**
 * HUDScene: top-level UI overlay (Phase 20 UI-RED redesign).
 *
 * Wave 1 layout: a minimal TOP STATUS BAR (Population / date / Treasury /
 * ratings) plus the RIGHT SIDEBAR interaction hub (build panel, tools/policy,
 * speed, advisor drawer, overlay group, action group, message log, toast).
 * The Phase-18 top-edge HUD column and its template-string-era DOM are gone —
 * every surface is composed via createElement/textContent builders
 * (UI-RED-08). The building/walker inspector renders as a CARD inside the
 * sidebar inspector host (Wave 4, UI-RED-05) — fed read-only from
 * getInspector/getWalkerInternals, with close × + Next/Prev cycling.
 *
 * DOM is still driven by a Phaser scene reading sim state every frame, but
 * the tree structure now comes from the pure builders in src/game/ui/.
 */

import Phaser from 'phaser';
import { BUILDINGS } from '../../sim/buildings';
import { HOUSE_TIERS } from '../../sim/config';
import { housingLevelName } from '../../../data/housing';
import {
  residenceInspection, productionInspection,
  storageInspection, marketInspection, walkerInspection,
} from '../../sim/advisors';
import { WORKSHOP_BUILDING_TYPES, EXTRACTION_BUILDING_TYPES } from '../../sim/production';
import { advisorPanels } from '../advisors';
import type { AdvisorAction, OverlayId } from '../advisors';
import { overlayHue, RISK_SERVICES } from '../ui/overlays';
import type { SimRunner } from '../../sim/runner';
import type { BuildingCategory, BuildingState, BuildingType, SimState, Vec2, WalkerState } from '../../sim/types';
import type { BuildingInstance, WalkerInstance } from '../../sim/walkers';
import { writeSave } from '../save';
import { applyOptions, loadOptions, saveOptions } from '../options';
import type { OptionsSchema } from '../../sim/ui';
import type { MainScene } from './MainScene';
import { buildSidebarDom, type SidebarDom } from '../ui/sidebar';
import { buildTopBarDom, type TopBarDom } from '../ui/topbar';
import { buildAdvisorDrawer, type AdvisorDrawerDom } from '../ui/advisorDrawer';
import { buildInspectorCard, navState, type InspectorRow } from '../ui/inspector';
import type { UiNode } from '../ui/dom';

type InspectorKind = 'house' | 'production' | 'storage' | 'market' | 'other';
type CategoryFilter = BuildingCategory | 'all';

/** Read a UiNode tree as the browser HTMLElement it actually is at runtime. */
function asEl(node: UiNode): HTMLElement {
  return node as unknown as HTMLElement;
}

export class HUDScene extends Phaser.Scene {
  private main: MainScene | null = null;
  private els: Record<string, HTMLElement> = {};
  /** The mounted inspector card root, or null while the card is closed
   *  (Wave 4: the card mounts into the sidebar inspector host on demand). */
  private popupEl: HTMLElement | null = null;
  private lastTick = -1;
  private lastMsgCount = -1;
  private activeCategory: CategoryFilter = 'all';
  /** Building id currently shown in the detail popup, or null when closed. */
  private inspectId: number | null = null;
  /** Same-kind entity ids for the inspector Next/Prev cycling (stable id order). */
  private inspectList: number[] = [];
  /** Index into inspectList of the currently shown entity (-1 for 'other'). */
  private inspectIndex = -1;
  /** Which id space inspectList holds — building ids or walker ids. Walker and
   *  building ids overlap (both counters start at 1), so Next/Prev must know the
   *  kind to disambiguate getInspector resolves (CR-01). */
  private inspectKind: 'building' | 'walker' = 'building';
  /** Build-palette buttons, tracked for the live unaffordable-disabled state. */
  private buildBtns: HTMLButtonElement[] = [];
  /** Whether the advisors drawer is open (nav button / A key). */
  private drawerOpen = false;
  /** Whether the overlay bar is open (nav button). */
  private overlayBarOpen = false;
  /** Whether the settings drawer is open (nav button). */
  private settingsOpen = false;
  /** Currently active advisor tab id (defaults to 'ratings'). */
  private activeAdvisor: string | null = null;
  /** Whether the sidebar build panel is shown (B key toggles it). */
  private buildPanelOpen = true;

  /** Wave-1 pure-builder trees (mounted in buildDom, refreshed each tick). */
  private topBar: TopBarDom | null = null;
  private sidebar: SidebarDom | null = null;
  private advisorDrawer: AdvisorDrawerDom | null = null;
  /** The wrapper div holding sidebar + topbar + pause overlay + popup host. */
  private hudRoot: HTMLElement | null = null;

  // WR-04: `game.events` is Phaser's GLOBAL emitter and outlives scene restarts.
  // Handlers registered there are stored as bound fields so the scene can
  // off() exactly them on shutdown — otherwise every restart doubles popup
  // renders / legend calls and leaks memory. These prefixes stay `readonly`
  // arrow fields so `this` is captured (off() needs the exact fn reference).
  private readonly onHudToast = (text: string): void => {
    this.showToast(text);
  };
  private readonly onOverlayLegend = (id: OverlayId | null): void => {
    this.renderOverlayLegend(id);
  };
  private readonly onGamePause = (): void => {
    this.closePopup();
    this.els.overlay.style.display = 'flex';
  };
  private readonly onGameResume = (): void => {
    this.els.overlay.style.display = 'none';
  };
  private readonly onHudInspect = (id: number | null): void => {
    if (id === null) {
      this.closePopup();
    } else {
      this.inspectId = id;
      const state = this.main?.runner.getState();
      const building = state?.buildings.find((b) => b.id === id);
      if (building) this.renderPopup(building);
    }
  };
  private readonly onHudWalkerInspect = (id: number | null): void => {
    if (id === null) {
      this.closePopup();
    } else {
      this.inspectId = null;
      // CR-01: walker ids share the building id space — the kind must be explicit
      // or a colliding walker would resolve to the building and never open.
      const inspector = this.main?.runner.getInspector(id, 'walker');
      if (inspector?.kind === 'walker' && inspector.walker) {
        this.inspectKind = 'walker';
        const state = this.main!.runner.getState();
        // Same-kind cycling (UI-04): walkers of the same type, stable id order.
        this.inspectList = state.walkers
          .filter((w) => w.type === inspector.walker!.type)
          .map((w) => w.id)
          .sort((a, b) => a - b);
        this.inspectIndex = this.inspectList.indexOf(id);
        this.renderWalkerInspector(inspector.walker);
      }
    }
  };
  private readonly onHudBuildMode = (): void => {
    this.closePopup();
    const grid = this.els.build;
    grid.querySelectorAll('.hud-build-btn').forEach((btn) => {
      const active = this.main?.getBuildMode() === (btn as HTMLElement).dataset.build;
      btn.classList.toggle('active', active === true);
    });
  };

  constructor() {
    super('HUD');
  }

  create(): void {
    this.main = this.scene.get('Main') as MainScene;
    this.buildDom();
    this.wireEvents();
    this.registerShutdownCleanup();
  }

  override update(): void {
    const state = this.main?.runner.getState();
    if (!state || !this.topBar) return;
    if (state.tick === this.lastTick) return;
    this.lastTick = state.tick;

    // Top status bar: refresh the value nodes in place (no re-render).
    const vn = this.topBar.valueNodes;
    vn.population.textContent = String(state.ratings.population);
    vn.treasury.textContent = String(Math.floor(state.treasury));
    vn.date.textContent = dateLabel(state.tick);
    vn.prosperity.textContent = String(state.ratings.prosperity);
    vn.happiness.textContent = String(state.ratings.happiness);

    // Policy value labels (legacy placement.spec): sync from the sim state so
    // load/save or programmatic setPolicy always reflects the live policy.
    if (this.els.taxValue) {
      this.els.taxValue.textContent = `${Math.round(state.policy.taxRate * 100)}%`;
      this.els.wageValue.textContent = `${Math.round(state.policy.wageRate * 100)}%`;
    }

    const derived = this.main?.runner.getDerived();
    if (derived) {
      vn.culture.textContent = String(derived.culture);
      vn.stability.textContent = String(derived.stability);
      vn.favor.textContent = String(derived.favor);
    }

    if (state.messages.length !== this.lastMsgCount) {
      this.lastMsgCount = state.messages.length;
      this.renderLog(state.messages);
    }

    // UI-01: build buttons show a LIVE unaffordable-disabled state — disabled
    // exactly when state.treasury < BUILDINGS[type].cost, re-evaluated every
    // tick (only when changed avoids layout thrash).
    this.updateBuildAffordability(state.treasury);

    // UI-02: the advisors drawer renders one live panel under the tick-change
    // guard (identical-tick frames skip re-render — no spinner).
    if (this.drawerOpen && this.activeAdvisor && this.main) {
      this.renderAdvisor(this.main.runner);
    }

    if (this.inspectId !== null) this.renderPopup(state.buildings.find((b) => b.id === this.inspectId) ?? null);
  }

  // ---- Public surface consumed by the MainScene key-router (Wave 1) ----

  isDrawerOpen(): boolean {
    return this.drawerOpen;
  }

  activeAdvisorId(): string | null {
    return this.activeAdvisor;
  }

  isInspectorOpen(): boolean {
    // The card is "open" exactly while a card root is mounted in the host.
    return this.popupEl !== null;
  }

  toggleAdvisors(force?: boolean): void {
    this.toggleAdvisorsDrawer(force);
  }

  selectAdvisorTab(id: string): void {
    this.selectAdvisor(id);
  }

  closeInspector(): void {
    this.closePopup();
  }

  cycleInspector(dir: number): void {
    this.navInspector(dir);
  }

  setBuildPanelOpen(open: boolean): void {
    this.buildPanelOpen = open;
    if (this.sidebar?.buildPanel) {
      asEl(this.sidebar.buildPanel).style.display = open ? '' : 'none';
    }
  }

  isBuildPanelOpen(): boolean {
    return this.buildPanelOpen;
  }

  /** Disable each build button when the player cannot afford it. */
  private updateBuildAffordability(treasury: number): void {
    for (const btn of this.buildBtns) {
      const type = btn.dataset.build as BuildingType;
      const unaffordable = BUILDINGS[type].cost > treasury;
      if (btn.disabled !== unaffordable) btn.disabled = unaffordable;
    }
  }

  private buildDom(): void {
    // Remove any previous HUD DOM (a fresh HUD is built each time it launches,
    // e.g. after a restart).
    document.querySelector('#hud .hud')?.remove();
    const root = document.createElement('div');
    root.className = 'hud';

    const state = this.main!.runner.getState();
    const derived = this.main!.runner.getDerived();

    // Top status bar (Wave 1): population / date / treasury / 5 ratings.
    this.topBar = buildTopBarDom(state, derived);
    root.appendChild(asEl(this.topBar.root));

    // Right sidebar (Wave 1): build panel, tools/policy, speed, advisor
    // button, overlay group, action group, settings, log, legend, toast.
    this.sidebar = buildSidebarDom(state, derived);
    root.appendChild(asEl(this.sidebar.root));

    // Advisor drawer frame — 13 tabs + panel hosts from the single composer.
    this.advisorDrawer = buildAdvisorDrawer(advisorPanels(this.main!.runner));
    asEl(this.sidebar.drawerHost).appendChild(asEl(this.advisorDrawer.root));

    // Pause overlay (Wave 1 keeps the full-screen pause card; its Resume /
    // Save / Restart buttons carry the legacy testids the specs drive).
    const overlay = document.createElement('div');
    overlay.className = 'hud-overlay';
    overlay.dataset.testid = 'pause-overlay';
    overlay.style.display = 'none';
    const card = document.createElement('div');
    card.className = 'hud-overlay-card';
    const pauseTitle = document.createElement('div');
    pauseTitle.className = 'hud-overlay-title';
    pauseTitle.textContent = 'Paused';
    const resumeBtn = document.createElement('button');
    resumeBtn.className = 'home-btn primary';
    resumeBtn.dataset.testid = 'resume-button';
    resumeBtn.textContent = 'Resume';
    resumeBtn.addEventListener('click', () => this.main?.setPaused(false));
    const saveBtn = document.createElement('button');
    saveBtn.className = 'home-btn';
    saveBtn.dataset.testid = 'save-button';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => this.saveGame());
    const restartBtn = document.createElement('button');
    restartBtn.className = 'home-btn';
    restartBtn.dataset.testid = 'restart-button';
    restartBtn.textContent = 'Restart';
    restartBtn.addEventListener('click', () => this.main?.restartToHome());
    card.append(pauseTitle, resumeBtn, saveBtn, restartBtn);
    overlay.appendChild(card);
    root.appendChild(overlay);

    document.getElementById('hud')?.appendChild(root);
    this.hudRoot = root;

    this.collectEls();
    this.wireSidebar();
    // Default active tab is ratings (fallback when no critical alert directs one).
    this.selectAdvisor('ratings');
  }

  /** Resolve the element refs the per-tick refresh + handlers need. */
  private collectEls(): void {
    const sb = this.sidebar!;
    const root = asEl(sb.root);
    this.els.pop = asEl(this.topBar!.valueNodes.population);
    this.els.treasury = asEl(this.topBar!.valueNodes.treasury);
    this.els.log = root.querySelector('[data-testid="message-log"]') as HTMLElement;
    this.els.logPanel = root.querySelector('[data-testid="log-panel"]') as HTMLElement;
    this.els.toast = root.querySelector('[data-testid="toast"]') as HTMLElement;
    // The pause overlay lives on the HUD wrapper (full-screen surface), not
    // inside the sidebar — query the wrapper, not the sidebar. The inspector
    // card has no element at build time: renderInspectorShell mounts it into
    // the sidebar inspector host and records it in els.popup on open.
    this.els.overlay = this.hudRoot?.querySelector('[data-testid="pause-overlay"]') as HTMLElement;
    this.els.cats = root.querySelector('[data-testid="sidebar-category-tabs"]') as HTMLElement;
    this.els.build = root.querySelector('[data-testid="sidebar-build-grid"]') as HTMLElement;
    this.els.taxInput = root.querySelector('[data-testid="policy-tax"]') as HTMLInputElement;
    this.els.wageInput = root.querySelector('[data-testid="policy-wage"]') as HTMLInputElement;
    this.els.taxValue = root.querySelector('[data-testid="policy-tax-value"]') as HTMLElement;
    this.els.wageValue = root.querySelector('[data-testid="policy-wage-value"]') as HTMLElement;
    this.els.optGraphics = root.querySelector('[data-testid="opt-graphics"]') as HTMLSelectElement;
    this.els.optMusic = root.querySelector('[data-testid="opt-music"]') as HTMLInputElement;
    this.els.optSfx = root.querySelector('[data-testid="opt-sfx"]') as HTMLInputElement;
    this.els.optSpeed = root.querySelector('[data-testid="opt-speed"]') as HTMLSelectElement;
    this.els.optTextSize = root.querySelector('[data-testid="opt-text-size"]') as HTMLSelectElement;
    this.els.optReducedMotion = root.querySelector('[data-testid="opt-reduced-motion"]') as HTMLInputElement;
    this.els.overlayToggles = root.querySelector('[data-testid="overlay-bar"]') as HTMLElement;
    this.els.overlayLegend = root.querySelector('[data-testid="overlay-legend"]') as HTMLElement;
    this.els.advisorTabs = asEl(this.advisorDrawer!.tabHost);
    this.els.advisorPanels = asEl(this.advisorDrawer!.panelHost);
    this.buildBtns = [...root.querySelectorAll('.hud-build-btn')] as HTMLButtonElement[];
  }

  /** Wire every sidebar control to its real runner/scene seam (Wave 0 map). */
  private wireSidebar(): void {
    const root = asEl(this.sidebar!.root);
    const on = (sel: string, fn: () => void): void => {
      root.querySelector(sel)?.addEventListener('click', fn);
    };

    // Nav (control bar): each button dispatches a real surface handler.
    on('[data-testid="controls-advisors"]', () => this.toggleAdvisorsDrawer());
    on('[data-testid="controls-overlays"]', () => this.toggleOverlayBar());
    on('[data-testid="controls-messages"]', () => this.toggleMessagesFocus());
    on('[data-testid="controls-settings"]', () => this.toggleSettingsDrawer());
    on('[data-testid="sidebar-advisor-button"]', () => this.toggleAdvisorsDrawer());

    // Category tabs → active filter + grid visibility. WR-02: re-clicking the
    // active category resets to 'all' (toggle behavior) so the full catalog is
    // always one click away; the 'all' tab is the default active filter.
    root.querySelectorAll('.hud-cat-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = (btn as HTMLElement).dataset.cat as CategoryFilter;
        const next = this.activeCategory === cat ? 'all' : cat;
        this.activeCategory = next;
        root.querySelectorAll('.hud-cat-btn').forEach((b) => {
          b.classList.toggle('active', (b as HTMLElement).dataset.cat === next);
        });
        this.filterGrid();
      });
    });
    // Boot state: the 'all' tab is active and the grid unfiltered (default).
    root.querySelectorAll('.hud-cat-btn').forEach((b) => {
      b.classList.toggle('active', (b as HTMLElement).dataset.cat === this.activeCategory);
    });

    // Build grid → toggle build mode (seam: MainScene.setBuildMode).
    root.querySelectorAll('.hud-build-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = (btn as HTMLElement).dataset.build as BuildingType;
        this.main?.setBuildMode(this.main.getBuildMode() === type ? null : type);
      });
    });

    // Policy sliders → setPolicy (seam: SimRunner.setPolicy + getPolicy).
    // 'change' fires too so automated fills (acceptance.spec) land.
    const tax = this.els.taxInput as HTMLInputElement;
    const wage = this.els.wageInput as HTMLInputElement;
    const applyTax = (): void => {
      this.main?.runner.setPolicy(tax.valueAsNumber / 100, this.main.runner.getPolicy().wageRate);
      if (this.els.taxValue) this.els.taxValue.textContent = `${tax.valueAsNumber}%`;
    };
    const applyWage = (): void => {
      this.main?.runner.setPolicy(this.main.runner.getPolicy().taxRate, wage.valueAsNumber / 100);
      if (this.els.wageValue) this.els.wageValue.textContent = `${wage.valueAsNumber}%`;
    };
    tax.addEventListener('input', applyTax);
    tax.addEventListener('change', applyTax);
    wage.addEventListener('input', applyWage);
    wage.addEventListener('change', applyWage);

    // Speed row → setSpeed.
    root.querySelectorAll('[data-testid^="speed-"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const testid = (btn as HTMLElement).dataset.testid ?? '';
        const s = Number(testid.replace('speed-', ''));
        if (Number.isFinite(s)) this.main?.setSpeed(s);
      });
    });

    // Action group (sidebar) — pause/resume/save/restart.
    on('[data-testid="pause-button"]', () => this.main?.setPaused(true));
    root.querySelector('[data-testid="sidebar-resume-button"] button')
      ?.addEventListener('click', () => this.main?.setPaused(false));
    root.querySelector('[data-testid="sidebar-save-button"] button')
      ?.addEventListener('click', () => this.saveGame());
    root.querySelector('[data-testid="sidebar-restart-button"] button')
      ?.addEventListener('click', () => this.main?.restartToHome());

    // Overlay toggles → overlay-toggle bus (MainScene.setOverlay radio).
    root.querySelectorAll('.overlay-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.overlay as OverlayId | 'none';
        this.game.events.emit('overlay-toggle', id);
      });
    });

    // Settings drawer → saveOptions/applyOptions (Phase 19 seam).
    root.querySelector('[data-testid="settings-save"]')
      ?.addEventListener('click', () => this.saveSettings());
  }

  private wireEvents(): void {
    this.game.events.on('hud-toast', this.onHudToast);
    this.game.events.on('overlay-legend', this.onOverlayLegend);
    this.game.events.on('game-pause', this.onGamePause);
    this.game.events.on('game-resume', this.onGameResume);
    this.game.events.on('hud-inspect', this.onHudInspect);
    this.game.events.on('hud-walker-inspect', this.onHudWalkerInspect);
    this.game.events.on('hud-build-mode', this.onHudBuildMode);
  }

  /** WR-04: game.events listeners leak across scene restarts because the emitter
   *  is global and outlives the scene. Register a one-shot scene shutdown hook
   *  that off()s exactly the bound handlers this instance registered. */
  private registerShutdownCleanup(): void {
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('hud-toast', this.onHudToast);
      this.game.events.off('overlay-legend', this.onOverlayLegend);
      this.game.events.off('game-pause', this.onGamePause);
      this.game.events.off('game-resume', this.onGameResume);
      this.game.events.off('hud-inspect', this.onHudInspect);
      this.game.events.off('hud-walker-inspect', this.onHudWalkerInspect);
      this.game.events.off('hud-build-mode', this.onHudBuildMode);
    });
  }

  /** Show only the buildings in the active category ('all' shows everything). */
  private filterGrid(): void {
    this.els.build.querySelectorAll('.hud-build-btn').forEach((btn) => {
      const type = (btn as HTMLElement).dataset.build as BuildingType;
      const show = this.activeCategory === 'all' || BUILDINGS[type].category === this.activeCategory;
      (btn as HTMLElement).style.display = show ? '' : 'none';
    });
  }

  /** Toggle the advisors drawer (nav button / A key → real handler). */
  private toggleAdvisorsDrawer(force?: boolean): void {
    this.drawerOpen = force ?? !this.drawerOpen;
    if (this.advisorDrawer) {
      if (this.drawerOpen) this.advisorDrawer.open();
      else this.advisorDrawer.close();
    }
    if (this.drawerOpen && this.main) {
      // Initial content on open (per-tick refresh still runs under the guard).
      this.renderAdvisor(this.main.runner);
    }
    this.game.events.emit('advisor-open', this.drawerOpen);
  }

  /** Toggle the overlay bar (nav button → real handler). */
  private toggleOverlayBar(force?: boolean): void {
    this.overlayBarOpen = force ?? !this.overlayBarOpen;
    if (this.sidebar?.overlayBar) {
      asEl(this.sidebar.overlayBar).style.display = this.overlayBarOpen ? 'block' : 'none';
    }
    this.game.events.emit('overlay-bar', this.overlayBarOpen);
  }

  /** Toggle the settings drawer (nav button → real handler). Values are
   *  pre-filled from loadOptions() each time it opens, so the panel always
   *  reflects the persistent shell state (T-19-02: no data sinks). */
  private toggleSettingsDrawer(force?: boolean): void {
    this.settingsOpen = force ?? !this.settingsOpen;
    if (this.sidebar?.settingsDrawer) {
      asEl(this.sidebar.settingsDrawer).style.display = this.settingsOpen ? 'block' : 'none';
    }
    if (this.settingsOpen) this.fillSettingsControls();
  }

  /** Pre-fill the six opt-* controls from the persisted options. */
  private fillSettingsControls(): void {
    const o = loadOptions();
    (this.els.optGraphics as HTMLSelectElement).value = o.graphicsQuality;
    (this.els.optMusic as HTMLInputElement).value = String(o.audioMusic);
    (this.els.optSfx as HTMLInputElement).value = String(o.audioSfx);
    (this.els.optSpeed as HTMLSelectElement).value = String(o.gameSpeedDefault);
    (this.els.optTextSize as HTMLSelectElement).value = o.textSize;
    (this.els.optReducedMotion as HTMLInputElement).checked = o.reducedMotion;
  }

  /** Persist + apply the drawer's options (mirrors saveGame's save+toast). */
  private saveSettings(): void {
    const o: OptionsSchema = {
      graphicsQuality: (this.els.optGraphics as HTMLSelectElement).value as OptionsSchema['graphicsQuality'],
      audioMusic: toUnit((this.els.optMusic as HTMLInputElement).value),
      audioSfx: toUnit((this.els.optSfx as HTMLInputElement).value),
      gameSpeedDefault: Number((this.els.optSpeed as HTMLSelectElement).value) || 1,
      textSize: (this.els.optTextSize as HTMLSelectElement).value as OptionsSchema['textSize'],
      reducedMotion: (this.els.optReducedMotion as HTMLInputElement).checked,
    };
    const result = saveOptions(o);
    if (!result.ok) {
      this.showToast('Save failed');
      return;
    }
    applyOptions(o);
    this.showToast('Options saved');
  }

  /** Focus the message log (nav Messages button → real scene effect). */
  private toggleMessagesFocus(): void {
    const panel = this.els.logPanel;
    if (!panel) return;
    const on = panel.classList.toggle('active');
    if (on && this.els.log) {
      this.els.log.scrollTop = this.els.log.scrollHeight;
    }
  }

  /** Activate one advisor tab (real scene effect: active class + panel swap). */
  private selectAdvisor(id: string): void {
    this.activeAdvisor = id;
    this.advisorDrawer?.selectAdvisor(id);
  }

  /** Rebuild every advisor panel from the live composer (called under the
   *  tick-change guard + on drawer open). Sim-derived strings are rendered via
   *  textContent — DOM safety per UI-RED-08. */
  private renderAdvisor(runner: SimRunner): void {
    const panels = advisorPanels(runner);
    const hostRoot = this.els.advisorPanels;
    for (const panel of panels) {
      const host = hostRoot.querySelector(
        `[data-advisor-panel="${panel.id}"]`,
      ) as HTMLElement | null;
      if (!host) continue;
      host.textContent = '';
      if (panel.noData) {
        const empty = document.createElement('div');
        empty.className = 'advisor-empty';
        const head = document.createElement('div');
        head.className = 'hud-subtitle';
        head.textContent = 'No data yet';
        const body = document.createElement('p');
        body.textContent = 'The city is still growing. Advance the simulation, then open this advisor again.';
        empty.append(head, body);
        host.appendChild(empty);
        continue;
      }
      for (const r of panel.rows) {
        const rowEl = document.createElement('div');
        rowEl.className = 'row';
        const lab = document.createElement('span');
        lab.textContent = r.label;
        const val = document.createElement('b');
        val.textContent = r.value;
        if (r.tone) val.classList.add(r.tone);
        rowEl.append(lab, val);
        host.appendChild(rowEl);
      }
      if (panel.alerts && panel.alerts.length > 0) {
        const ul = document.createElement('ul');
        ul.className = 'advisor-alerts';
        for (const a of panel.alerts) {
          const li = document.createElement('li');
          li.textContent = a;
          ul.appendChild(li);
        }
        host.appendChild(ul);
      }
      if (panel.action) host.appendChild(this.buildAdvisorAction(panel.action));
    }
  }

  /** The per-panel "more detail" action — a real, wired button (UI-02). */
  private buildAdvisorAction(action: AdvisorAction): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'advisor-action';
    btn.dataset.testid = `action-open-${action.kind}`;
    switch (action.kind) {
      case 'open-inspector':
        btn.textContent = 'Open Inspector';
        btn.addEventListener('click', () => this.game.events.emit('hud-inspect', action.id));
        break;
      case 'locate':
        btn.textContent = 'Locate';
        btn.addEventListener('click', () => this.game.events.emit('hud-inspect', action.id));
        break;
      case 'open-overlay':
        btn.textContent = 'Open Overlay';
        btn.addEventListener('click', () => {
          this.toggleOverlayBar(true);
          this.game.events.emit('overlay-toggle', action.overlay);
        });
        break;
      case 'open-codex':
        btn.textContent = 'Open Codex';
        btn.addEventListener('click', () => {
          this.game.events.emit('hud-toast', `Codex: ${action.entryId}`);
        });
        break;
    }
    return btn;
  }

  /** Sync the overlay bar's active classes and render/clear the legend. */
  private renderOverlayLegend(id: OverlayId | null): void {
    this.els.overlayToggles.querySelectorAll('.overlay-toggle').forEach((btn) => {
      const oid = (btn as HTMLElement).dataset.overlay;
      btn.classList.toggle('active', oid === id || (oid === 'none' && id === null));
    });
    const legend = this.els.overlayLegend;
    if (!legend) return;
    legend.textContent = '';
    if (!id) {
      legend.style.display = 'none';
      return;
    }
    const head = document.createElement('div');
    head.className = 'hud-subtitle';
    head.textContent = overlayName(id);
    legend.appendChild(head);
    if (id === 'risks') {
      // The risks heatmap paints each tile with its DOMINANT service's ramp
      // (fire/danger/collapse/crime) — the legend mirrors that per-service
      // identity with one 5-swatch row per service (UI-FIX-02).
      for (const s of RISK_SERVICES) {
        const rowEl = document.createElement('div');
        rowEl.className = 'legend-row legend-service-row';
        rowEl.dataset.testid = `legend-service-${s.id}`;
        const name = document.createElement('span');
        name.className = 'legend-service-name uppercase';
        name.textContent = s.label;
        const rampHost = document.createElement('span');
        rampHost.className = 'legend-ramp';
        for (let b = 0; b < 5; b++) {
          const swatch = document.createElement('span');
          swatch.className = 'legend-swatch';
          swatch.style.background = overlayHue(s.id, b);
          rampHost.appendChild(swatch);
        }
        rowEl.append(name, rampHost);
        legend.appendChild(rowEl);
      }
    } else {
      // Single-service overlays: one row per band, swatches from the
      // service's own 5-step ramp (SPEC §4), labels from the static table.
      const labels = OVERLAY_LABELS[id];
      for (let b = 0; b < 5; b++) {
        const rowEl = document.createElement('div');
        rowEl.className = 'legend-row';
        const swatch = document.createElement('span');
        swatch.className = 'legend-swatch';
        swatch.style.background = overlayHue(id, b);
        const lab = document.createElement('span');
        lab.className = 'uppercase';
        lab.textContent = labels[b];
        rowEl.append(swatch, lab);
        legend.appendChild(rowEl);
      }
    }
    legend.style.display = 'block';
  }

  private renderLog(messages: { tick: number; type: string; text: string }[]): void {
    this.els.log.replaceChildren();
    const recent = messages.slice(-8).reverse();
    for (const m of recent) {
      const li = document.createElement('li');
      li.dataset.testid = 'message-entry';
      li.textContent = `[${m.tick}] ${m.text}`;
      li.classList.add(`msg-${m.type}`);
      this.els.log.appendChild(li);
    }
  }

  private showToast(text: string): void {
    this.els.toast.textContent = text;
    this.els.toast.style.display = 'block';
    window.setTimeout(() => {
      this.els.toast.style.display = 'none';
    }, 3000);
  }

  private closePopup(): void {
    this.inspectId = null;
    this.inspectList = [];
    this.inspectIndex = -1;
    this.popupEl = null;
    const host = this.sidebar?.inspectorHost;
    if (host) asEl(host).replaceChildren();
  }

  private saveGame(): void {
    if (!this.main) return;
    const result = writeSave(this.main.getSaveData());
    this.showToast(result.ok ? 'Game saved' : 'Save failed');
  }

  /** Render the popup for a building snapshot, or close it if the building is gone. */
  private renderPopup(building: BuildingState | null | undefined): void {
    if (!building) {
      this.closePopup();
      return;
    }
    // Building popups always cycle the building id space (CR-01 disambiguation).
    this.inspectKind = 'building';
    const kind = this.inspectorKindOf(building);
    const state = this.main!.runner.getState();
    // Same-kind cycling (UI-04): stable entity-id order.
    this.inspectList = this.kindEntityIds(state, kind);
    this.inspectIndex = kind === 'other' ? -1 : this.inspectList.indexOf(building.id);
    this.renderInspectorShell(this.inspectorTitle(building), this.buildingRows(building));
  }

  /** Render the walker inspector card (opened via hud-walker-inspect). */
  private renderWalkerInspector(walker: WalkerState): void {
    // CR-01: the walker id may collide with a live building id — resolve by kind.
    const inspector = this.main?.runner.getInspector(walker.id, 'walker');
    const internals = inspector?.kind === 'walker' ? (inspector.internals as WalkerInstance | undefined) : undefined;
    const stepsUsed = internals?.stepsTaken ?? 0;
    const maxSteps = Math.max(1, walker.lifetime);
    const insp = walkerInspection(
      walker.id, walker.x, walker.y, walker.state, stepsUsed, maxSteps, internals,
    ) as Record<string, unknown>;
    const rows: InspectorRow[] = [
      { label: 'State', value: String(insp.status ?? walker.state) },
      { label: 'Type', value: String(insp.type ?? walker.type) },
      { label: 'Origin', value: insp.origin ? `${(insp.origin as Vec2).x},${(insp.origin as Vec2).y}` : '—' },
      { label: 'Path Length', value: insp.path ? String((insp.path as unknown[]).length) : '0' },
      { label: 'Carried', value: String(insp.carriedAmount ?? 0) },
      { label: 'Target', value: String(insp.targetBuildingId ?? '—') },
    ];
    this.renderInspectorShell(`Walker ${walker.type}`, rows);
  }

  /** Build the shared card shell (header + body rows + close × + inspector
   *  nav) and mount it into the sidebar inspector host. The header title and
   *  every body row are created via createElement/textContent (UI-RED-08). */
  private renderInspectorShell(
    title: string,
    rows: InspectorRow[],
  ): void {
    const host = this.sidebar?.inspectorHost;
    if (!host) return;
    const nav = navState(this.inspectList.length, this.inspectIndex);
    const card = buildInspectorCard({
      title,
      rows,
      position: nav.position,
      canPrev: nav.canPrev,
      canNext: nav.canNext,
    });
    const hostEl = asEl(host);
    hostEl.replaceChildren();
    hostEl.appendChild(asEl(card.root));
    this.popupEl = asEl(card.root);
    card.close.addEventListener('click', () => this.closePopup());
    card.prev.addEventListener('click', () => this.navInspector(-1));
    card.next.addEventListener('click', () => this.navInspector(1));
  }

  /** Enriched rows per inspector kind, fed from getInspector internals. */
  private buildingRows(building: BuildingState): InspectorRow[] {
    const rows: InspectorRow[] = [];
    const push = (label: string, value: string): void => { rows.push({ label, value }); };
    const inspector = this.main?.runner.getInspector(building.id, 'building');
    const internals = inspector?.internals as BuildingInstance | undefined;
    const ok = (b: boolean): string => (b ? 'Yes' : 'No');
    const cap = (v: number): string => String(Math.round(v * 100)) + '%';

    if (building.house) {
      const h = building.house;
      const houseInternals = internals?.house;
      const safety = internals?.safety;
      // UI-04/POP-01: feed the residence projection the LIVE internals — the
      // real dominant resident class and occupancy, never the fabricated
      // ('plebeian', full-capacity) from before. residency class/occupancy only
      // appear once the cohort is initialized.
      const cohort = houseInternals?.residents;
      const realClass = cohort && cohort.length > 0
        ? (cohort.filter((r) => r.class === 'patrician').length > cohort.length / 2 ? 'patrician' : 'plebeian')
        : 'plebeian';
      const insp = residenceInspection(
        h.populationCapacity, h.populationCapacity, realClass, [],
        {},
        { house: houseInternals, safety, happiness: h.happiness, desirability: h.desirability },
      );
      const lvl = insp.level != null ? Number(insp.level) : h.level;
      push('Level', `${lvl} — ${housingLevelName(lvl)}`);
      push('Tier', `${HOUSE_TIERS[h.tier].name} (${h.tier + 1}/5)`);
      if (typeof insp.satisfiedTicks === 'number') push('Satisfied Ticks', String(insp.satisfiedTicks));
      const liveCount = insp.residents && typeof insp.residents === 'object'
        ? String((insp.residents as { count: number }).count)
        : String(h.populationCapacity);
      push('Population', liveCount);
      push('Food', ok(h.foodCooldown > 0));
      push('Water', ok(h.waterCooldown > 0));
      push('Labor', ok(h.laborCooldown > 0));
      if (houseInternals?.civic) {
        push('Health', String(Math.round(houseInternals.civic.health)));
        push('Literacy', String(Math.round(houseInternals.civic.literacy)));
        push('Entertainment', String(Math.round(houseInternals.civic.entertainment)));
      }
      if (insp.foodInventory && typeof insp.foodInventory === 'object') {
        const fi = insp.foodInventory as Record<string, number>;
        for (const [g, v] of Object.entries(fi)) push(`${g} stock`, String(Math.floor(v)));
      }
      // POP-01: real per-residence class/age/employment rows (guard mirrors the
      // foodInventory guard — appended only when the live cohort is present).
      if (typeof insp.residents === 'object') {
        const rs = insp.residents as { count: number; classBreakdown: Record<string, number>; ageBands: Record<string, number>; employed: number };
        push('Class', `${rs.classBreakdown.plebeian} plebeian / ${rs.classBreakdown.patrician} patrician`);
        push('Age Bands', `${rs.ageBands.children} children / ${rs.ageBands.workforce} working age / ${rs.ageBands.elderly} elderly`);
        push('Employed', `${rs.employed}/${rs.count}`);
      }
      if (safety) {
        push('Fire', safety.fire);
        push('Danger', ok(safety.danger));
        push('Collapse Risk', cap(safety.collapseRisk));
        push('Crime', cap(safety.crime));
      }
      push('Desirability', String(h.desirability));
      if (typeof insp.happiness === 'number') push('Happiness', String(insp.happiness));
      return rows;
    }

    if (WORKSHOP_BUILDING_TYPES[building.type] || EXTRACTION_BUILDING_TYPES[building.type]) {
      // WR-02: feed the projection the LIVE production internals (real inputs/
      // output) instead of fabricated empties, and never relabel stock as output.
      const p = internals?.production;
      const liveStatus = p
        ? (p.active ? (p.blocked ? 'blocked' : 'working') : 'blocked')
        : (building.active ? 'working' : 'blocked');
      const insp = productionInspection(
        { ...(p?.inputs ?? {}) },
        { ...(p?.output ?? building.stock) },
        liveStatus,
        {
          production: p, active: building.active,
          workersAssigned: building.workersAssigned, workersRequired: building.workersRequired,
          laborConnected: building.laborConnected,
        },
      );
      push('Workers', `${building.workersAssigned}/${building.workersRequired}`);
      push('Active', ok(building.active));
      push('Labor Connected', ok(building.laborConnected));
      push('Status', String(insp.status ?? liveStatus));
      push('Blocked', String(insp.blocked ?? false));
      for (const [g, v] of Object.entries(insp.inputs ?? {})) push(`In ${g}`, String(Math.floor(Number(v))));
      for (const [g, v] of Object.entries(insp.output ?? {})) push(`Out ${g}`, String(Math.floor(Number(v))));
      return rows;
    }

    if (building.type === 'market') {
      const insp = marketInspection(
        { ...building.stock }, 2,
        { workersAssigned: building.workersAssigned, housesServed: 0, enabled: [] },
      );
      push('Workers', `${building.workersAssigned}/${building.workersRequired}`);
      push('Active', ok(building.active));
      for (const [g, v] of Object.entries(insp.inventory ?? {})) push(g, String(Math.floor(Number(v))));
      return rows;
    }

    if (building.type === 'granary' || building.type === 'warehouse') {
      const slotCap = BUILDINGS[building.type]?.storageCapacity ?? 0;
      const used = Object.values(building.stock).reduce((a, v) => a + (v ?? 0), 0);
      // WR-06: use the projection's output instead of discarding it — the
      // enriched reserved/inTransit fields render only when real internals
      // supply them (never fabricated zeros).
      const insp = storageInspection({ ...building.stock }, Math.min(slotCap, Math.floor(used)), slotCap);
      push('Workers', `${building.workersAssigned}/${building.workersRequired}`);
      push('Active', ok(building.active));
      push('Used', String(typeof insp.usedSlots === 'number' ? insp.usedSlots : Math.floor(used)));
      push('Capacity', String(typeof insp.capacity === 'number' ? insp.capacity : slotCap));
      const totalOf = (rec: Record<string, number> | undefined): number =>
        rec ? Object.values(rec).reduce((a, b) => a + (Number(b) || 0), 0) : 0;
      const reserved = totalOf(insp.reserved as Record<string, number> | undefined);
      const inTransit = totalOf(insp.inTransit as Record<string, number> | undefined);
      if (reserved > 0) push('Reserved', String(reserved));
      if (inTransit > 0) push('In Transit', String(inTransit));
      for (const [g, v] of Object.entries(insp.stock ?? building.stock)) push(g, String(Math.floor(v)));
      return rows;
    }

    // Generic fallback (farm, garden, well, service buildings…).
    push('Workers', `${building.workersAssigned}/${building.workersRequired}`);
    push('Active', ok(building.active));
    const stock = building.stock;
    if (building.type === 'farm') {
      push('Wheat', `${Math.floor(stock.wheat ?? 0)}/${BUILDINGS.farm.production?.localCapacity ?? 0}`);
    }
    for (const [g, v] of Object.entries(stock)) if (g !== 'wheat') push(g, String(Math.floor(v)));
    return rows;
  }

  /** The inspector Next ◀/▶ controller row is built by the pure card builder
   *  (ui/inspector.ts) with navState(); the nav label/disabled rules are
   *  unit-tested there (inspector.test.ts). */

  /** Cycle to the previous/next same-kind entity and re-render. */
  private navInspector(dir: number): void {
    if (this.inspectList.length === 0) return;
    const nextIndex = this.inspectIndex + dir;
    if (nextIndex < 0 || nextIndex >= this.inspectList.length) return;
    const id = this.inspectList[nextIndex];
    // CR-01: the current kind tells us whether this id space is walkers or
    // buildings — disambiguate the resolve so Next/Prev never opens a wrong-kind
    // popup for a colliding walker id.
    const inspector = this.inspectKind === 'walker'
      ? this.main?.runner.getInspector(id, 'walker')
      : this.main?.runner.getInspector(id);
    if (!inspector) return;
    if (inspector.kind === 'walker' && inspector.walker) {
      this.inspectKind = 'walker';
      this.inspectId = null;
      this.inspectIndex = nextIndex;
      this.renderWalkerInspector(inspector.walker);
    } else if (inspector.kind === 'building' && inspector.building) {
      this.inspectKind = 'building';
      this.inspectId = id;
      this.inspectIndex = nextIndex;
      this.renderPopup(inspector.building);
    }
  }

  /** Same-kind entity ids in stable id order for Next/Prev cycling. */
  private kindEntityIds(state: SimState, kind: InspectorKind): number[] {
    switch (kind) {
      case 'house':
        return state.buildings.filter((b) => b.house).map((b) => b.id).sort((a, b) => a - b);
      case 'production':
        return state.buildings
          .filter((b) => WORKSHOP_BUILDING_TYPES[b.type] || EXTRACTION_BUILDING_TYPES[b.type])
          .map((b) => b.id)
          .sort((a, b) => a - b);
      case 'storage':
        return state.buildings
          .filter((b) => b.type === 'granary' || b.type === 'warehouse')
          .map((b) => b.id)
          .sort((a, b) => a - b);
      case 'market':
        return state.buildings.filter((b) => b.type === 'market').map((b) => b.id).sort((a, b) => a - b);
      default:
        return [];
    }
  }

  private inspectorKindOf(building: BuildingState): InspectorKind {
    if (building.house) return 'house';
    if (building.type === 'market') return 'market';
    if (building.type === 'granary' || building.type === 'warehouse') return 'storage';
    if (WORKSHOP_BUILDING_TYPES[building.type] || EXTRACTION_BUILDING_TYPES[building.type]) return 'production';
    return 'other';
  }

  private inspectorTitle(building: BuildingState): string {
    return BUILDINGS[building.type].name;
  }
}

/** Parse a 0..1 audio slider value defensively (finite + clamped to the unit
 *  interval so a hand-edited drawer value cannot produce NaN in the options). */
function toUnit(v: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Top-bar date label from SimState.tick (SPEC §2, same rule as 18-UI-SPEC). */
function dateLabel(tick: number): string {
  const year = Math.floor(tick / 360);
  const month = Math.floor((tick % 360) / 40) + 1;
  return `YEAR ${year} · MONTH ${month}`;
}

/** Static legend band labels per overlay (safe — no sim-derived strings). */
const OVERLAY_LABELS: Record<OverlayId, readonly string[]> = {
  water: ['None', 'Basic', 'Clean', 'Grand', 'Source'],
  food: ['0 days', 'Low', 'Med', 'High', 'Plenty'],
  risks: ['None', 'Low', 'Moderate', 'High', 'Critical'],
  coverage: ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'],
  desirability: ['Low', 'Modest', 'Neutral', 'Good', 'High'],
};

/** Legend heading for an overlay id (static display text). */
function overlayName(id: OverlayId): string {
  const names: Record<OverlayId, string> = {
    water: 'Water', food: 'Food Supply', risks: 'Risks',
    coverage: 'Service Coverage', desirability: 'Desirability',
  };
  return names[id] ?? id;
}
