/**
 * HUDScene: top-level UI overlay. DOM-backed (sliders, buttons, message log)
 * but still driven by a Phaser scene reading sim state every frame.
 */

import Phaser from 'phaser';
import { BUILDINGS } from '../../sim/buildings';
import { HOUSE_TIERS } from '../../sim/config';
import { housingLevelName } from '../../../data/housing';
import {
  foodHudFromState, residenceInspection, productionInspection,
  storageInspection, marketInspection, walkerInspection,
} from '../../sim/advisors';
import { WORKSHOP_BUILDING_TYPES, EXTRACTION_BUILDING_TYPES } from '../../sim/production';
import { advisorPanels, ADVISOR_TAB_ORDER } from '../advisors';
import type { AdvisorAction, OverlayId } from '../advisors';
import { OVERLAY_RAMPS } from '../palette';
import type { SimRunner } from '../../sim/runner';
import type { BuildingCategory, BuildingState, BuildingType, SimState, Vec2, WalkerState } from '../../sim/types';
import type { BuildingInstance, WalkerInstance } from '../../sim/walkers';
import { writeSave } from '../save';
import type { MainScene } from './MainScene';

type InspectorKind = 'house' | 'production' | 'storage' | 'market' | 'other';

const BUILD_ORDER: readonly BuildingType[] = ['road', 'house', 'garden', 'well', 'fountain', 'farm', 'orchard', 'granary', 'market', 'engineer_post', 'fire_station', 'clinic', 'school', 'library', 'temple', 'theatre', 'forum'];
const CATEGORIES: readonly BuildingCategory[] = ['roads', 'housing', 'food', 'water', 'infrastructure', 'engineering', 'safety', 'health', 'education', 'entertainment', 'religion', 'government', 'ornament'];
type CategoryFilter = BuildingCategory | 'all';

export class HUDScene extends Phaser.Scene {
  private main: MainScene | null = null;
  private els: Record<string, HTMLElement> = {};
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
  /** Whether the advisors drawer is open (control bar → drawer). */
  private drawerOpen = false;
  /** Whether the overlay bar is open (control bar → overlay bar). */
  private overlayBarOpen = false;
  /** Currently active advisor tab id (defaults to 'ratings'). */
  private activeAdvisor: string | null = null;

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
    this.els.build.querySelectorAll('.hud-build-btn').forEach((btn) => {
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
    if (!state || !this.els.pop) return;
    if (state.tick === this.lastTick) return;
    this.lastTick = state.tick;

    this.els.pop.textContent = String(state.ratings.population);
    this.els.prosperity.textContent = String(state.ratings.prosperity);
    this.els.happiness.textContent = String(state.ratings.happiness);
    this.els.treasury.textContent = String(Math.floor(state.treasury));
    this.els.workers.textContent = `${state.assignedWorkers}/${state.totalJobs}`;
    this.els.tax.textContent = `${Math.round(state.policy.taxRate * 100)}%`;
    this.els.wage.textContent = `${Math.round(state.policy.wageRate * 100)}%`;

    // Months-of-food indicator (spec §15): every value derived from the live sim
    // snapshot — available food stock over projected monthly consumption.
    const food = foodHudFromState(state);
    this.els.food.textContent = `${food.icon} ${food.text}`;
    this.els.food.className = `hud-food hud-food-${food.band}`;
    this.els.food.title = `Food supply: ${food.text} (band ${food.band})`;

    const derived = this.main?.runner.getDerived();
    if (derived) {
      this.els.culture.textContent = String(derived.culture);
      this.els.stability.textContent = String(derived.stability);
      this.els.favor.textContent = String(derived.favor);
      const wp = derived.water.totalTiles ? derived.water.coveredTiles / derived.water.totalTiles : 0;
      this.els.water.textContent = `${Math.round(wp * 100)}%`;
      this.els.risk.textContent = `${Math.round(Math.max(derived.crime, derived.collapseRisk, derived.fireRisk) * 100)}%`;
      this.els.gov.textContent = derived.government.join(',') || 'none';
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

    const stats = document.createElement('div');
    stats.className = 'hud-panel hud-stats';
    stats.innerHTML = `
      <div class="hud-title">Roman City Builder</div>
      <div class="hud-stat"><span>Population</span><b data-testid="stat-population"></b></div>
      <div class="hud-stat"><span>Prosperity</span><b data-testid="stat-prosperity"></b></div>
      <div class="hud-stat"><span>Happiness</span><b data-testid="stat-happiness"></b></div>
      <div class="hud-stat"><span>Treasury</span><b data-testid="stat-treasury"></b></div>
      <div class="hud-stat"><span>Employed</span><b data-testid="stat-workers"></b></div>
      <div class="hud-stat"><span>Food</span><b data-testid="stat-food"></b></div>
      <div class="hud-stat"><span>Culture</span><b data-testid="stat-culture"></b></div>
      <div class="hud-stat"><span>Stability</span><b data-testid="stat-stability"></b></div>
      <div class="hud-stat"><span>Favor</span><b data-testid="stat-favor"></b></div>
      <div class="hud-stat"><span>Water</span><b data-testid="stat-water"></b></div>
      <div class="hud-stat"><span>Risk</span><b data-testid="stat-risk"></b></div>
      <div class="hud-stat"><span>Gov</span><b data-testid="stat-gov"></b></div>
    `;

    const build = document.createElement('div');
    build.className = 'hud-panel hud-build';
    const title = document.createElement('div');
    title.className = 'hud-subtitle';
    title.textContent = 'Build';
    build.appendChild(title);

    const cats = document.createElement('div');
    cats.className = 'hud-cat-bar';
    const allBtn = document.createElement('button');
    allBtn.className = 'hud-cat-btn active';
    allBtn.dataset.cat = 'all';
    allBtn.textContent = 'All';
    cats.appendChild(allBtn);
    for (const cat of CATEGORIES) {
      const btn = document.createElement('button');
      btn.className = 'hud-cat-btn';
      btn.dataset.cat = cat;
      btn.dataset.testid = `category-${cat}`;
      btn.textContent = cat[0].toUpperCase() + cat.slice(1);
      cats.appendChild(btn);
    }
    build.appendChild(cats);

    const grid = document.createElement('div');
    grid.className = 'hud-build-grid';
    for (const type of BUILD_ORDER) {
      const def = BUILDINGS[type];
      const btn = document.createElement('button');
      btn.className = 'hud-build-btn';
      btn.dataset.testid = `build-${type}`;
      btn.dataset.build = type;
      btn.dataset.category = def.category;
      btn.textContent = `${def.name} (${def.cost})`;
      grid.appendChild(btn);
    }
    build.appendChild(grid);

    const policy = document.createElement('div');
    policy.className = 'hud-panel hud-policy';
    policy.innerHTML = `
      <div class="hud-subtitle">Policy</div>
      <label>Tax <input type="range" min="0" max="100" value="10" data-testid="policy-tax" /> <span data-testid="policy-tax-value"></span></label>
      <label>Wage <input type="range" min="0" max="100" value="10" data-testid="policy-wage" /> <span data-testid="policy-wage-value"></span></label>
    `;

    const log = document.createElement('div');
    log.className = 'hud-panel hud-log';
    log.dataset.testid = 'log-panel';
    log.innerHTML = '<div class="hud-subtitle">Messages</div><ul data-testid="message-log"></ul>';

    // Control bar (UI-01): every central control dispatches a real handler that
    // visibly toggles its surface. Labels are static — textContent, never
    // innerHTML interpolation.
    const controlBar = document.createElement('div');
    controlBar.className = 'hud-control-bar';
    controlBar.dataset.testid = 'control-bar';
    const advisorsBtn = document.createElement('button');
    advisorsBtn.className = 'hud-control-btn';
    advisorsBtn.dataset.testid = 'controls-advisors';
    advisorsBtn.textContent = 'Advisors';
    advisorsBtn.addEventListener('click', () => this.toggleAdvisorsDrawer());
    const overlaysBtn = document.createElement('button');
    overlaysBtn.className = 'hud-control-btn';
    overlaysBtn.dataset.testid = 'controls-overlays';
    overlaysBtn.textContent = 'Overlays';
    overlaysBtn.addEventListener('click', () => this.toggleOverlayBar());
    const messagesBtn = document.createElement('button');
    messagesBtn.className = 'hud-control-btn';
    messagesBtn.dataset.testid = 'controls-messages';
    messagesBtn.textContent = 'Messages';
    messagesBtn.addEventListener('click', () => this.toggleMessagesFocus());
    controlBar.append(advisorsBtn, overlaysBtn, messagesBtn);

    // Advisors drawer frame (filled with tabs + a live panel in 18-02-02).
    const advisorsDrawer = document.createElement('div');
    advisorsDrawer.className = 'advisor-drawer';
    advisorsDrawer.dataset.testid = 'advisor-drawer';
    advisorsDrawer.style.display = 'none';
    const drawerHead = document.createElement('div');
    drawerHead.className = 'hud-subtitle';
    drawerHead.textContent = 'Advisors';
    const tabHost = document.createElement('div');
    tabHost.className = 'advisor-tabs';
    tabHost.dataset.testid = 'advisor-tabs';
    const panelHost = document.createElement('div');
    panelHost.className = 'advisor-panels';
    panelHost.dataset.testid = 'advisor-panels';
    // 13 tabs in UI-SPEC order + one hidden panel host per advisor (UI-02).
    for (const id of ADVISOR_TAB_ORDER) {
      const tab = document.createElement('button');
      tab.className = 'advisor-tab';
      tab.dataset.testid = `advisor-tab-${id}`;
      tab.dataset.advisor = id;
      tab.textContent = advisorTitle(id);
      tab.addEventListener('click', () => this.selectAdvisor(id));
      tabHost.appendChild(tab);
      const panel = document.createElement('div');
      panel.className = 'advisor-panel';
      panel.dataset.testid = `advisor-panel-${id}`;
      panel.dataset.advisorPanel = id;
      panel.hidden = true;
      panelHost.appendChild(panel);
    }
    advisorsDrawer.append(drawerHead, tabHost, panelHost);

    // Overlay bar frame (filled with the 5 toggles + None in 18-03-02).
    const overlayBar = document.createElement('div');
    overlayBar.className = 'overlay-bar';
    overlayBar.dataset.testid = 'overlay-bar';
    overlayBar.style.display = 'none';
    const overlayHead = document.createElement('div');
    overlayHead.className = 'hud-subtitle';
    overlayHead.textContent = 'Overlays';
    const overlayToggles = document.createElement('div');
    overlayToggles.className = 'overlay-toggles';
    overlayToggles.dataset.testid = 'overlay-toggles';
    // 5 overlay toggles + None (UI-03): each click emits 'overlay-toggle' — the
    // single source of truth is MainScene.setOverlay (radio: exactly one active).
    for (const o of OVERLAY_KEYS) {
      const btn = document.createElement('button');
      btn.className = 'overlay-toggle';
      btn.dataset.testid = `overlay-${o.id}`;
      btn.dataset.overlay = o.id;
      const label = document.createElement('span');
      label.textContent = o.label;
      const shortcut = document.createElement('span');
      shortcut.className = 'shortcut';
      shortcut.textContent = o.key;
      btn.append(label, shortcut);
      btn.addEventListener('click', () => this.game.events.emit('overlay-toggle', o.id));
      overlayToggles.appendChild(btn);
    }
    const noneBtn = document.createElement('button');
    noneBtn.className = 'overlay-toggle';
    noneBtn.dataset.testid = 'overlay-none';
    noneBtn.dataset.overlay = 'none';
    const noneLabel = document.createElement('span');
    noneLabel.textContent = 'None';
    const noneShortcut = document.createElement('span');
    noneShortcut.className = 'shortcut';
    noneShortcut.textContent = 'X';
    noneBtn.append(noneLabel, noneShortcut);
    noneBtn.addEventListener('click', () => this.game.events.emit('overlay-toggle', 'none'));
    overlayToggles.appendChild(noneBtn);
    overlayBar.append(overlayHead, overlayToggles);

    // Legend host (filled/cleared by the overlay system — 18-03-02).
    const overlayLegend = document.createElement('div');
    overlayLegend.className = 'overlay-legend';
    overlayLegend.dataset.testid = 'overlay-legend';
    overlayLegend.style.display = 'none';

    const toast = document.createElement('div');
    toast.className = 'hud-toast';
    toast.dataset.testid = 'toast';
    toast.style.display = 'none';

    const popup = document.createElement('div');
    popup.className = 'hud-popup';
    popup.dataset.testid = 'building-popup';
    popup.style.display = 'none';

    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'hud-pause-btn';
    pauseBtn.dataset.testid = 'pause-button';
    pauseBtn.textContent = '❚❚';
    pauseBtn.addEventListener('click', () => this.main?.setPaused(true));

    const speeds = [0.5, 1, 2, 4, 8];
    const speedRow = document.createElement('div');
    speedRow.className = 'hud-speed-row';
    speedRow.dataset.testid = 'speed-control';
    for (const s of speeds) {
      const b = document.createElement('button');
      b.className = 'hud-speed-btn';
      b.dataset.testid = `speed-${s}`;
      b.textContent = `${s}×`;
      b.addEventListener('click', () => this.main?.setSpeed(s));
      speedRow.appendChild(b);
    }

    const overlay = document.createElement('div');
    overlay.className = 'hud-overlay';
    overlay.dataset.testid = 'pause-overlay';
    overlay.innerHTML = `
      <div class="hud-overlay-card">
        <div class="hud-overlay-title">Paused</div>
        <button class="home-btn primary" data-testid="resume-button">Resume</button>
        <button class="home-btn" data-testid="save-button">Save</button>
        <button class="home-btn" data-testid="restart-button">Restart</button>
      </div>
    `;
    overlay.style.display = 'none';
    overlay.querySelector('[data-testid="resume-button"]')?.addEventListener('click', () => this.main?.setPaused(false));
    overlay.querySelector('[data-testid="save-button"]')?.addEventListener('click', () => this.saveGame());
    overlay.querySelector('[data-testid="restart-button"]')?.addEventListener('click', () => this.main?.restartToHome());

    root.append(stats, build, policy, log, controlBar, toast, popup, speedRow, pauseBtn, overlay);
    document.getElementById('hud')?.appendChild(root);
    // Bottom-center overlay surfaces live outside the scrolling right-edge HUD
    // column so they never clip (fixed-position, same as the toast).
    document.body.appendChild(advisorsDrawer);
    document.body.appendChild(overlayBar);
    document.body.appendChild(overlayLegend);

    this.els.pop = root.querySelector('[data-testid="stat-population"]') as HTMLElement;
    this.els.prosperity = root.querySelector('[data-testid="stat-prosperity"]') as HTMLElement;
    this.els.happiness = root.querySelector('[data-testid="stat-happiness"]') as HTMLElement;
    this.els.treasury = root.querySelector('[data-testid="stat-treasury"]') as HTMLElement;
    this.els.workers = root.querySelector('[data-testid="stat-workers"]') as HTMLElement;
    this.els.food = root.querySelector('[data-testid="stat-food"]') as HTMLElement;
    this.els.culture = root.querySelector('[data-testid="stat-culture"]') as HTMLElement;
    this.els.stability = root.querySelector('[data-testid="stat-stability"]') as HTMLElement;
    this.els.favor = root.querySelector('[data-testid="stat-favor"]') as HTMLElement;
    this.els.water = root.querySelector('[data-testid="stat-water"]') as HTMLElement;
    this.els.risk = root.querySelector('[data-testid="stat-risk"]') as HTMLElement;
    this.els.gov = root.querySelector('[data-testid="stat-gov"]') as HTMLElement;
    this.els.tax = root.querySelector('[data-testid="policy-tax-value"]') as HTMLElement;
    this.els.wage = root.querySelector('[data-testid="policy-wage-value"]') as HTMLElement;
    this.els.log = root.querySelector('[data-testid="message-log"]') as HTMLElement;
    this.els.logPanel = root.querySelector('[data-testid="log-panel"]') as HTMLElement;
    this.els.toast = root.querySelector('[data-testid="toast"]') as HTMLElement;
    this.els.popup = popup;
    this.els.overlay = overlay;
    this.els.cats = cats;
    this.els.build = grid;
    this.els.taxInput = root.querySelector('[data-testid="policy-tax"]') as HTMLInputElement;
    this.els.wageInput = root.querySelector('[data-testid="policy-wage"]') as HTMLInputElement;
    this.els.controlBar = controlBar;
    this.els.advisorsDrawer = advisorsDrawer;
    this.els.overlayBar = overlayBar;
    this.els.advisorTabs = tabHost;
    this.els.advisorPanels = panelHost;
    this.els.overlayToggles = overlayToggles;
    this.els.overlayLegend = overlayLegend;
    this.buildBtns = [...grid.querySelectorAll('.hud-build-btn')] as HTMLButtonElement[];
    // Default active tab is ratings (fallback when no critical alert directs one).
    this.selectAdvisor('ratings');
  }

  private wireEvents(): void {
    this.els.cats.querySelectorAll('.hud-cat-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = (btn as HTMLElement).dataset.cat as CategoryFilter;
        this.activeCategory = cat;
        this.els.cats.querySelectorAll('.hud-cat-btn').forEach((b) => b.classList.toggle('active', b === btn));
        this.filterGrid();
      });
    });

    this.els.build.querySelectorAll('.hud-build-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = (btn as HTMLElement).dataset.build as BuildingType;
        this.main?.setBuildMode(this.main.getBuildMode() === type ? null : type);
      });
    });

    this.els.taxInput.addEventListener('input', () => {
      const input = this.els.taxInput as HTMLInputElement;
      this.main?.runner.setPolicy(input.valueAsNumber / 100, this.main.runner.getPolicy().wageRate);
    });
    this.els.wageInput.addEventListener('input', () => {
      const input = this.els.wageInput as HTMLInputElement;
      this.main?.runner.setPolicy(this.main.runner.getPolicy().taxRate, input.valueAsNumber / 100);
    });

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

  /** Toggle the advisors drawer (control-bar Advisors button → real handler). */
  private toggleAdvisorsDrawer(force?: boolean): void {
    this.drawerOpen = force ?? !this.drawerOpen;
    if (this.els.advisorsDrawer) {
      this.els.advisorsDrawer.style.display = this.drawerOpen ? 'block' : 'none';
    }
    if (this.drawerOpen && this.main) {
      // Initial content on open (per-tick refresh still runs under the guard).
      this.renderAdvisor(this.main.runner);
    }
    this.game.events.emit('advisor-open', this.drawerOpen);
  }

  /** Toggle the overlay bar (control-bar Overlays button → real handler). */
  private toggleOverlayBar(force?: boolean): void {
    this.overlayBarOpen = force ?? !this.overlayBarOpen;
    if (this.els.overlayBar) {
      this.els.overlayBar.style.display = this.overlayBarOpen ? 'block' : 'none';
    }
    this.game.events.emit('overlay-bar', this.overlayBarOpen);
  }

  /** Focus the message log (control-bar Messages button → real scene effect). */
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
    this.els.advisorTabs.querySelectorAll('.advisor-tab').forEach((t) => {
      t.classList.toggle('active', (t as HTMLElement).dataset.advisor === id);
    });
    this.els.advisorPanels.querySelectorAll('.advisor-panel').forEach((p) => {
      (p as HTMLElement).hidden = (p as HTMLElement).dataset.advisorPanel !== id;
    });
  }

  /** Rebuild every advisor panel from the live composer (called under the
   *  tick-change guard + on drawer open). Sim-derived strings are rendered via
   *  textContent — never innerHTML — per T-18-01. */
  private renderAdvisor(runner: SimRunner): void {
    const panels = advisorPanels(runner);
    for (const panel of panels) {
      const host = this.els.advisorPanels.querySelector(
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
    const ramp = OVERLAY_RAMPS[id];
    const labels = OVERLAY_LABELS[id];
    for (let i = 0; i < ramp.length; i++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'legend-row';
      const swatch = document.createElement('span');
      swatch.className = 'legend-swatch';
      swatch.style.background = ramp[i];
      const lab = document.createElement('span');
      lab.textContent = labels[i];
      rowEl.append(swatch, lab);
      legend.appendChild(rowEl);
    }
    legend.style.display = 'block';
  }

  private renderLog(messages: { tick: number; type: string; text: string }[]): void {
    this.els.log.innerHTML = '';
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
    this.els.popup.style.display = 'none';
    this.els.popup.textContent = '';
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
    this.renderInspectorShell(this.inspectorTitle(building), (body) => this.renderBuildingRows(building, body));
  }

  /** Render the walker inspector popup (opened via hud-walker-inspect). */
  private renderWalkerInspector(walker: WalkerState): void {
    // CR-01: the walker id may collide with a live building id — resolve by kind.
    const inspector = this.main?.runner.getInspector(walker.id, 'walker');
    const internals = inspector?.kind === 'walker' ? (inspector.internals as WalkerInstance | undefined) : undefined;
    const stepsUsed = internals?.stepsTaken ?? 0;
    const maxSteps = Math.max(1, walker.lifetime);
    const insp = walkerInspection(
      walker.id, walker.x, walker.y, walker.state, stepsUsed, maxSteps, internals,
    ) as Record<string, unknown>;
    this.renderInspectorShell(`Walker ${walker.type}`, (body) => {
      const rows: [string, unknown][] = [
        ['State', insp.status ?? walker.state],
        ['Type', insp.type ?? walker.type],
        ['Origin', insp.origin ? `${(insp.origin as Vec2).x},${(insp.origin as Vec2).y}` : '—'],
        ['Path Length', insp.path ? String((insp.path as unknown[]).length) : '0'],
        ['Carried', String(insp.carriedAmount ?? 0)],
        ['Target', String(insp.targetBuildingId ?? '—')],
      ];
      for (const [label, value] of rows) appendRow(body, label, String(value));
    });
  }

  /** Build the shared popup shell (header + body + inspector nav). The header
   *  title/close and every body row are created via createElement/textContent —
   *  sim-derived strings never hit innerHTML (T-18-01). */
  private renderInspectorShell(
    title: string,
    bodyFn: (body: HTMLElement) => void,
  ): void {
    const popup = this.els.popup;
    popup.textContent = '';

    const header = document.createElement('div');
    header.className = 'hud-popup-header';
    const titleEl = document.createElement('span');
    titleEl.className = 'hud-popup-title';
    titleEl.textContent = title;
    const close = document.createElement('button');
    close.className = 'hud-popup-close';
    close.dataset.testid = 'popup-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', () => this.closePopup());
    header.append(titleEl, close);
    popup.appendChild(header);

    const body = document.createElement('div');
    body.className = 'hud-popup-body';
    bodyFn(body);
    popup.appendChild(body);

    popup.appendChild(this.buildInspectorNav());
    popup.style.display = 'block';
  }

  /** Enriched rows per inspector kind, fed from getInspector internals. */
  private renderBuildingRows(building: BuildingState, body: HTMLElement): void {
    const inspector = this.main?.runner.getInspector(building.id, 'building');
    const internals = inspector?.internals as BuildingInstance | undefined;
    const ok = (b: boolean): string => (b ? 'Yes' : 'No');
    const cap = (v: number): string => String(Math.round(v * 100)) + '%';

    if (building.house) {
      const h = building.house;
      const houseInternals = internals?.house;
      const safety = internals?.safety;
      const insp = residenceInspection(
        h.populationCapacity, h.populationCapacity, 'plebeian', [],
        {},
        { house: houseInternals, safety, happiness: h.happiness, desirability: h.desirability },
      );
      const lvl = insp.level != null ? Number(insp.level) : h.level;
      appendRow(body, 'Level', `${lvl} — ${housingLevelName(lvl)}`);
      appendRow(body, 'Tier', `${HOUSE_TIERS[h.tier].name} (${h.tier + 1}/5)`);
      if (typeof insp.satisfiedTicks === 'number') appendRow(body, 'Satisfied Ticks', String(insp.satisfiedTicks));
      appendRow(body, 'Population', String(h.populationCapacity));
      appendRow(body, 'Food', ok(h.foodCooldown > 0));
      appendRow(body, 'Water', ok(h.waterCooldown > 0));
      appendRow(body, 'Labor', ok(h.laborCooldown > 0));
      if (houseInternals?.civic) {
        appendRow(body, 'Health', String(Math.round(houseInternals.civic.health)));
        appendRow(body, 'Literacy', String(Math.round(houseInternals.civic.literacy)));
        appendRow(body, 'Entertainment', String(Math.round(houseInternals.civic.entertainment)));
      }
      if (insp.foodInventory && typeof insp.foodInventory === 'object') {
        const fi = insp.foodInventory as Record<string, number>;
        for (const [g, v] of Object.entries(fi)) appendRow(body, `${g} stock`, String(Math.floor(v)));
      }
      if (safety) {
        appendRow(body, 'Fire', safety.fire);
        appendRow(body, 'Danger', ok(safety.danger));
        appendRow(body, 'Collapse Risk', cap(safety.collapseRisk));
        appendRow(body, 'Crime', cap(safety.crime));
      }
      appendRow(body, 'Desirability', String(h.desirability));
      if (typeof insp.happiness === 'number') appendRow(body, 'Happiness', String(insp.happiness));
      return;
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
      appendRow(body, 'Workers', `${building.workersAssigned}/${building.workersRequired}`);
      appendRow(body, 'Active', ok(building.active));
      appendRow(body, 'Labor Connected', ok(building.laborConnected));
      appendRow(body, 'Status', String(insp.status ?? liveStatus));
      appendRow(body, 'Blocked', String(insp.blocked ?? false));
      for (const [g, v] of Object.entries(insp.inputs ?? {})) appendRow(body, `In ${g}`, String(Math.floor(Number(v))));
      for (const [g, v] of Object.entries(insp.output ?? {})) appendRow(body, `Out ${g}`, String(Math.floor(Number(v))));
      return;
    }

    if (building.type === 'market') {
      const insp = marketInspection(
        { ...building.stock }, 2,
        { workersAssigned: building.workersAssigned, housesServed: 0, enabled: [] },
      );
      appendRow(body, 'Workers', `${building.workersAssigned}/${building.workersRequired}`);
      appendRow(body, 'Active', ok(building.active));
      for (const [g, v] of Object.entries(insp.inventory ?? {})) appendRow(body, g, String(Math.floor(Number(v))));
      return;
    }

    if (building.type === 'granary' || building.type === 'warehouse') {
      const slotCap = BUILDINGS[building.type]?.storageCapacity ?? 0;
      const used = Object.values(building.stock).reduce((a, v) => a + (v ?? 0), 0);
      storageInspection({ ...building.stock }, Math.min(slotCap, Math.floor(used)), slotCap);
      appendRow(body, 'Workers', `${building.workersAssigned}/${building.workersRequired}`);
      appendRow(body, 'Active', ok(building.active));
      appendRow(body, 'Used', String(Math.floor(used)));
      appendRow(body, 'Capacity', String(slotCap));
      for (const [g, v] of Object.entries(building.stock)) appendRow(body, g, String(Math.floor(v)));
      return;
    }

    // Generic fallback (farm, garden, well, service buildings…).
    appendRow(body, 'Workers', `${building.workersAssigned}/${building.workersRequired}`);
    appendRow(body, 'Active', ok(building.active));
    const stock = building.stock;
    if (building.type === 'farm') {
      appendRow(body, 'Wheat', `${Math.floor(stock.wheat ?? 0)}/${BUILDINGS.farm.production?.localCapacity ?? 0}`);
    }
    for (const [g, v] of Object.entries(stock)) if (g !== 'wheat') appendRow(body, g, String(Math.floor(v)));
  }

  /** The inspector Next ◀/▶ controller row (wired cycling, UI-04). */
  private buildInspectorNav(): HTMLElement {
    const nav = document.createElement('div');
    nav.className = 'inspector-nav';
    const prev = document.createElement('button');
    prev.dataset.testid = 'inspector-prev';
    prev.textContent = '◀';
    prev.setAttribute('aria-label', 'Previous');
    prev.addEventListener('click', () => this.navInspector(-1));
    const label = document.createElement('span');
    label.className = 'inspector-nav-label';
    label.dataset.testid = 'inspector-nav-label';
    label.textContent = this.inspectorNavLabel();
    const next = document.createElement('button');
    next.dataset.testid = 'inspector-next';
    next.textContent = '▶';
    next.setAttribute('aria-label', 'Next');
    next.addEventListener('click', () => this.navInspector(1));
    nav.append(prev, label, next);
    prev.disabled = this.inspectList.length < 2 || this.inspectIndex <= 0;
    next.disabled = this.inspectList.length < 2 || this.inspectIndex < 0 || this.inspectIndex >= this.inspectList.length - 1;
    return nav;
  }

  /** The same-kind position shown between the inspector nav buttons. */
  private inspectorNavLabel(): string {
    if (this.inspectList.length === 0 || this.inspectIndex < 0) return '—';
    return `${this.inspectIndex + 1}/${this.inspectList.length}`;
  }

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

/** Append a label/value row to the popup body via createElement + textContent
 *  (sim-derived strings never hit innerHTML — T-18-01). */
function appendRow(parent: HTMLElement, label: string, value: string): void {
  const rowEl = document.createElement('div');
  rowEl.className = 'row';
  const lab = document.createElement('span');
  lab.textContent = label;
  const val = document.createElement('b');
  val.textContent = value;
  rowEl.append(lab, val);
  parent.appendChild(rowEl);
}

/** Overlay bar toggle definitions (UI-03, locked shortcuts W/F/R/C/D + X). */
const OVERLAY_KEYS: { id: OverlayId; label: string; key: string }[] = [
  { id: 'water', label: 'Water', key: 'W' },
  { id: 'food', label: 'Food', key: 'F' },
  { id: 'risks', label: 'Risks', key: 'R' },
  { id: 'coverage', label: 'Coverage', key: 'C' },
  { id: 'desirability', label: 'Desirability', key: 'D' },
];

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

/** Human panel title for an advisor tab id (static display text). */
function advisorTitle(id: string): string {
  const titles: Record<string, string> = {
    ratings: 'Ratings', finance: 'Finance', food: 'Food',
    'production-logistics': 'Production', labor: 'Labor', trade: 'Trade',
    housing: 'Housing', demography: 'Demography', 'safety-risks': 'Safety',
    religion: 'Religion', governance: 'Governance', diplomacy: 'Diplomacy',
    objectives: 'Objectives',
  };
  return titles[id] ?? id;
}
