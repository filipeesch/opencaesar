/**
 * HomeScene: the main menu. Offers New Game (seed + map size), Load Game
 * (from a saved game in localStorage), and a brief how-to-play note. DOM
 * backed, like the HUD.
 */

import Phaser from 'phaser';
import { CONFIG } from '../../sim/config';
import { listSaves, loadSavedGame } from '../save';

export class HomeScene extends Phaser.Scene {
  private root: HTMLElement | null = null;
  /** The load button, kept so a rejected save can disable it + surface the reason. */
  private loadBtn: HTMLButtonElement | null = null;

  constructor() {
    super('Home');
  }

  create(): void {
    this.buildDom();
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => this.root?.remove());
  }

  private buildDom(): void {
    this.root?.remove();
    const root = document.createElement('div');
    root.className = 'home';
    root.dataset.testid = 'home-screen';

    const title = document.createElement('h1');
    title.className = 'home-title';
    title.textContent = 'Roman City Builder';

    const card = document.createElement('div');
    card.className = 'home-card';

    // New Game
    const newGame = document.createElement('div');
    newGame.className = 'home-section';
    const newLabel = document.createElement('div');
    newLabel.className = 'home-section-title';
    newLabel.textContent = 'New Game';

    const seedRow = document.createElement('div');
    seedRow.className = 'home-row';
    seedRow.innerHTML = '<label>Seed</label>';
    const seedInput = document.createElement('input');
    seedInput.type = 'number';
    seedInput.dataset.testid = 'seed-input';
    seedInput.value = String(defaultSeed());
    const dice = document.createElement('button');
    dice.dataset.testid = 'random-seed';
    dice.textContent = '🎲';
    dice.addEventListener('click', () => {
      seedInput.value = String(Math.floor(Math.random() * 100000));
    });
    seedRow.append(seedInput, dice);

    const sizeRow = document.createElement('div');
    sizeRow.className = 'home-row';
    sizeRow.innerHTML = '<label>Map size</label>';
    const sizeInput = document.createElement('select');
    sizeInput.dataset.testid = 'size-input';
    for (const n of [30, 40, 50]) {
      const opt = document.createElement('option');
      opt.value = String(n);
      opt.textContent = `${n}×${n}`;
      if (n === CONFIG.defaultMapSize) opt.selected = true;
      sizeInput.appendChild(opt);
    }
    sizeRow.appendChild(sizeInput);

    const startBtn = document.createElement('button');
    startBtn.className = 'home-btn primary';
    startBtn.dataset.testid = 'new-game';
    startBtn.textContent = 'Start';
    startBtn.addEventListener('click', () => {
      const seed = Number.parseInt(seedInput.value || '1', 10);
      const size = Number.parseInt(sizeInput.value, 10);
      this.startNewGame(seed, size);
    });

    newGame.append(newLabel, seedRow, sizeRow, startBtn);

    // Load Game
    const load = document.createElement('div');
    load.className = 'home-section';
    const loadLabel = document.createElement('div');
    loadLabel.className = 'home-section-title';
    loadLabel.textContent = 'Load Game';
    const save = listSaves();
    const loadBtn = document.createElement('button');
    loadBtn.className = 'home-btn';
    loadBtn.dataset.testid = 'load-game';
    if (save) {
      loadBtn.textContent = `Resume city (seed ${save.meta.seed}, tick ${save.meta.tick})`;
      loadBtn.addEventListener('click', () => this.loadSavedGame());
    } else {
      loadBtn.textContent = 'No saved game';
      loadBtn.disabled = true;
    }
    this.loadBtn = loadBtn;
    load.append(loadLabel, loadBtn);

    // How to play
    const howto = document.createElement('div');
    howto.className = 'home-section';
    const howtoLabel = document.createElement('div');
    howtoLabel.className = 'home-section-title';
    howtoLabel.textContent = 'How to play';
    howto.dataset.testid = 'how-to-play';
    const p = document.createElement('p');
    p.innerHTML =
      'Build roads, then place houses and support them with farms, granaries, markets, and wells. ' +
      'Houses grow when fed, watered, and employed. Set tax and wages, and watch Population, Prosperity, and Happiness. <br/>' +
      '<b>ESC</b> pauses. <b>Right-click</b> cancels build mode.';
    howto.append(howtoLabel, p);

    card.append(newGame, load, howto);
    root.append(title, card);
    document.getElementById('hud')?.appendChild(root);
    this.root = root;
  }

  private startNewGame(seed: number, mapSize: number): void {
    this.scene.start('Main', { seed, mapSize });
  }

  /**
   * PERS-01: the validated load click-through. Only an {ok:true} save reaches
   * scene.start('Main', { save }); a rejected save disables the button and
   * surfaces the typed reason via textContent (never innerHTML — storage/sim
   * derived strings). The migrate/validate gate runs HERE, before any replay.
   */
  private loadSavedGame(): void {
    const res = loadSavedGame();
    if (res.ok) {
      this.scene.start('Main', { save: res.data });
      return;
    }
    this.showLoadError(res);
  }

  private showLoadError(res: { error: string; reason?: string }): void {
    if (this.loadBtn) {
      this.loadBtn.disabled = true;
      this.loadBtn.textContent = `Save rejected: ${res.reason ?? res.error}`;
    }
  }
}

function defaultSeed(): number {
  const raw = new URLSearchParams(window.location.search).get('seed');
  if (raw === null) return Math.floor(Math.random() * 100000);
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? 1337 : n;
}
