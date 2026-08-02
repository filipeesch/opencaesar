/**
 * HUDScene: top-level UI overlay. DOM-backed (sliders, buttons, message log)
 * but still driven by a Phaser scene reading sim state every frame.
 */

import Phaser from 'phaser';
import { BUILDINGS } from '../../sim/buildings';
import type { BuildingCategory, BuildingType } from '../../sim/types';
import type { MainScene } from './MainScene';

const BUILD_ORDER: readonly BuildingType[] = ['road', 'house', 'farm', 'granary', 'market', 'well'];
const CATEGORIES: readonly BuildingCategory[] = ['roads', 'housing', 'food', 'water', 'infrastructure'];
type CategoryFilter = BuildingCategory | 'all';

export class HUDScene extends Phaser.Scene {
  private main: MainScene | null = null;
  private els: Record<string, HTMLElement> = {};
  private lastTick = -1;
  private lastMsgCount = -1;
  private activeCategory: CategoryFilter = 'all';

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
    this.els.treasury.textContent = String(Math.floor(state.treasury));
    this.els.workers.textContent = `${state.assignedWorkers}/${state.totalWorkers}`;
    this.els.tax.textContent = `${Math.round(state.policy.taxRate * 100)}%`;
    this.els.wage.textContent = `${Math.round(state.policy.wageRate * 100)}%`;

    if (state.messages.length !== this.lastMsgCount) {
      this.lastMsgCount = state.messages.length;
      this.renderLog(state.messages);
    }
  }

  private buildDom(): void {
    const root = document.createElement('div');
    root.className = 'hud';

    const stats = document.createElement('div');
    stats.className = 'hud-panel hud-stats';
    stats.innerHTML = `
      <div class="hud-title">Roman City Builder</div>
      <div class="hud-stat"><span>Population</span><b data-testid="stat-population"></b></div>
      <div class="hud-stat"><span>Prosperity</span><b data-testid="stat-prosperity"></b></div>
      <div class="hud-stat"><span>Treasury</span><b data-testid="stat-treasury"></b></div>
      <div class="hud-stat"><span>Workers</span><b data-testid="stat-workers"></b></div>
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
    log.innerHTML = '<div class="hud-subtitle">Messages</div><ul data-testid="message-log"></ul>';

    const toast = document.createElement('div');
    toast.className = 'hud-toast';
    toast.dataset.testid = 'toast';
    toast.style.display = 'none';

    root.append(stats, build, policy, log, toast);
    document.getElementById('hud')?.appendChild(root);

    this.els.pop = root.querySelector('[data-testid="stat-population"]') as HTMLElement;
    this.els.prosperity = root.querySelector('[data-testid="stat-prosperity"]') as HTMLElement;
    this.els.treasury = root.querySelector('[data-testid="stat-treasury"]') as HTMLElement;
    this.els.workers = root.querySelector('[data-testid="stat-workers"]') as HTMLElement;
    this.els.tax = root.querySelector('[data-testid="policy-tax-value"]') as HTMLElement;
    this.els.wage = root.querySelector('[data-testid="policy-wage-value"]') as HTMLElement;
    this.els.log = root.querySelector('[data-testid="message-log"]') as HTMLElement;
    this.els.toast = root.querySelector('[data-testid="toast"]') as HTMLElement;
    this.els.cats = cats;
    this.els.build = grid;
    this.els.taxInput = root.querySelector('[data-testid="policy-tax"]') as HTMLInputElement;
    this.els.wageInput = root.querySelector('[data-testid="policy-wage"]') as HTMLInputElement;
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
    this.game.events.on('hud-build-mode', () => {
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
}
