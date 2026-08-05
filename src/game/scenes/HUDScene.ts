/**
 * HUDScene: top-level UI overlay. DOM-backed (sliders, buttons, message log)
 * but still driven by a Phaser scene reading sim state every frame.
 */

import Phaser from 'phaser';
import { BUILDINGS } from '../../sim/buildings';
import { HOUSE_TIERS } from '../../sim/config';
import { foodHudFromState } from '../../sim/advisors';
import type { BuildingCategory, BuildingState, BuildingType } from '../../sim/types';
import { writeSave } from '../save';
import type { MainScene } from './MainScene';

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
  /** Build-palette buttons, tracked for the live unaffordable-disabled state. */
  private buildBtns: HTMLButtonElement[] = [];
  /** Whether the advisors drawer is open (control bar → drawer). */
  private drawerOpen = false;
  /** Whether the overlay bar is open (control bar → overlay bar). */
  private overlayBarOpen = false;

  constructor() {
    super('HUD');
  }

  create(): void {
    this.main = this.scene.get('Main') as MainScene;
    this.buildDom();
    this.wireEvents();
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
    overlayBar.append(overlayHead, overlayToggles);

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
    this.buildBtns = [...grid.querySelectorAll('.hud-build-btn')] as HTMLButtonElement[];
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

    this.game.events.on('hud-toast', (text: string) => this.showToast(text));
    this.game.events.on('game-pause', () => {
      this.closePopup();
      this.els.overlay.style.display = 'flex';
    });
    this.game.events.on('game-resume', () => {
      this.els.overlay.style.display = 'none';
    });
    this.game.events.on('hud-inspect', (id: number | null) => {
      if (id === null) {
        this.closePopup();
      } else {
        this.inspectId = id;
        const state = this.main?.runner.getState();
        const building = state?.buildings.find((b) => b.id === id);
        if (building) this.renderPopup(building);
      }
    });
    this.game.events.on('hud-build-mode', () => {
      this.closePopup();
      this.els.build.querySelectorAll('.hud-build-btn').forEach((btn) => {
        const active = this.main?.getBuildMode() === (btn as HTMLElement).dataset.build;
        btn.classList.toggle('active', active === true);
      });
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
    this.game.events.emit('advisor-open', this.drawerOpen);
  }

  /** Toggle the overlay bar (control-bar Overlays button → real handler). */
  private toggleOverlayBar(force?: boolean): void {
    this.overlayBarOpen = force ?? !this.overlayBarOpen;
    if (this.els.overlayBar) {
      this.els.overlayBar.style.display = this.overlayBarOpen ? 'block' : 'none';
    }
    this.game.events.emit('overlay-toggle', this.overlayBarOpen ? 'bar-open' : 'bar-close');
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
    this.els.popup.style.display = 'none';
    this.els.popup.innerHTML = '';
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
    const popup = this.els.popup;
    const rows: string[] = [];
    const status = (ok: boolean) => (ok ? '<span class="ok">Yes</span>' : '<span class="bad">No</span>');

    if (building.house) {
      const h = building.house;
      rows.push(row('Tier', `${HOUSE_TIERS[h.tier].name} (${h.tier + 1}/5)`));
      rows.push(row('Population', `${h.populationCapacity}`));
      rows.push(row('Food', status(h.foodCooldown > 0)));
      rows.push(row('Water', status(h.waterCooldown > 0)));
      rows.push(row('Labor', status(h.laborCooldown > 0)));
      rows.push(row('Desirability', `${h.desirability}`));
      const happiness = (h as { happiness?: number }).happiness;
      if (typeof happiness === 'number') {
        rows.push(row('Happiness', `${happiness}`));
      }
    } else {
      rows.push(row('Workers', `${building.workersAssigned}/${building.workersRequired}`));
      rows.push(row('Active', status(building.active)));
      const stock = building.stock.wheat;
      if (building.type === 'granary') {
        rows.push(row('Wheat', `${stock ?? 0}/${BUILDINGS.granary.storageCapacity ?? 0}`));
      } else if (building.type === 'farm') {
        rows.push(row('Wheat', `${Math.floor(stock ?? 0)}/${BUILDINGS.farm.production?.localCapacity ?? 0}`));
      }
    }

    popup.innerHTML = `
      <div class="hud-popup-header">
        <span class="hud-popup-title">${BUILDINGS[building.type].name}</span>
        <button class="hud-popup-close" data-testid="popup-close" aria-label="Close">×</button>
      </div>
      ${rows.join('')}
    `;
    popup.style.display = 'block';
    popup.querySelector('.hud-popup-close')?.addEventListener('click', () => this.closePopup());
  }
}

function row(label: string, value: string): string {
  return `<div class="row"><span>${label}</span><b>${value}</b></div>`;
}
