/**
 * MainScene: the game view. A Phaser isometric tilemap renders the terrain;
 * buildings and walkers are redrawn every frame from the sim state snapshot.
 * The renderer is a dumb view — it never holds authoritative game data.
 *
 * Interactions: drag to pan, wheel to zoom, click to place in build mode,
 * right-click or ESC to cancel build mode.
 */

import Phaser from 'phaser';
import { BUILDINGS } from '../../sim/buildings';
import { CONFIG } from '../../sim/config';
import { foodOverlayGrids } from '../../sim/advisors';
import type { BuildingState, BuildingType, PlacementError, PlacementResult, SaveData, SimState, TileType, Vec2 } from '../../sim/types';
import { SimRunner } from '../../sim/runner';
import { migrateSave, SaveCodecError, validateSave } from '../../sim/saveCodec';
import { TimeSystem } from '../../sim/time';
import { loadOptions } from '../options';
import { HOUSE_FOOT_TOP_Y, HOUSE_FRAME_H, houseFrame, isSheetLoaded, SHEET_BUILDINGS, getSpriteMeta, BUILDING_RESOLUTIONS } from '../art';
import { drawBuilding } from '../buildingArt';
import { BUILDING_COLORS, HOUSE_COLORS, TILE_H, TILE_W, WALKER_COLORS, OVERLAY_RAMPS, hexToPhaser } from '../palette';
import type { OverlayId } from '../advisors';
import { KeyRouter, type RouterCtx } from '../ui/keyboard';
import type { HUDScene } from './HUDScene';

const TILE_INDEX: Record<TileType, number> = { earth: 0, water: 1, fertile: 2, trees: 3, rock: 4, road: 5 };
const BUILDABLE_TYPES: readonly BuildingType[] = ['road', 'house', 'garden', 'well', 'fountain', 'farm', 'orchard', 'granary', 'market', 'engineer_post', 'fire_station', 'clinic', 'school', 'library', 'temple', 'theatre', 'forum'];
/** First advisor tab shown when the drawer opens without a prior selection. */
const ADVISOR_DEFAULT_TAB = 'ratings';

type RenderObj = Phaser.GameObjects.GameObject & {
  setDepth(depth: number): unknown;
  destroy(): void;
};

export class MainScene extends Phaser.Scene {
  runner: SimRunner;

  /** Scene data used to start a run: { seed, mapSize } or { save }. */
  private runtimeConfig: { seed: number; mapSize: number } | { save: SaveData } | null = null;

  private map: Phaser.Tilemaps.Tilemap | null = null;
  private layer: Phaser.Tilemaps.TilemapLayer | null = null;
  private cam: Phaser.Cameras.Scene2D.Camera | null = null;
  /** Entity render objects (a Graphics per procedural entity, or a sprite Image), sorted by depth. */
  private entityObjs: RenderObj[] = [];
  private ghost: Phaser.GameObjects.Graphics | null = null;
  private lastTiles: number[] = [];
  /** Fixed-timestep scheduler (pause + speed), decoupled from frame rate. */
  private readonly timeSystem = new TimeSystem(1000 / CONFIG.ticksPerSecond);
  /** Walker continuous positions at the previous tick (for smooth motion). */
  private walkerPrev = new Map<number, { x: number; y: number }>();
  private buildType: BuildingType | null = null;
  /** B/ESC-toggled "build panel engaged" state (SPEC §3): persists across key
   *  presses independently of the build cursor, so B then Escape closes the
   *  panel instead of falling through to pause. */
  private buildModeEngaged = false;
  private dragging = false;
  private dragRight = false;
  private camStart = { x: 0, y: 0, scrollX: 0, scrollY: 0 };
  private lastPaint: Vec2 | null = null;
  /** Whether the pointer-down attempt already placed at the tile (prevents a duplicate up-attempt). */
  private downPlaced = false;
  /** True while the pause overlay is open — the sim clock halts. */
  private paused = false;
  /** Active map overlay (UI-03): exactly one at a time, or null for none. */
  private overlay: OverlayId | null = null;
  /** Heatmap Graphics drawn below the building depths (never intercepts input). */
  private overlayGfx: Phaser.GameObjects.Graphics | null = null;
  /** WR-04: game.events is global — holding the bound handler lets the scene
   *  off() it on shutdown so restarts don't stack duplicate setOverlay renders. */
  private readonly onOverlayToggle = (id: OverlayId | 'none' | null): void => this.setOverlay(id);

  init(data: { seed?: number; mapSize?: number; save?: SaveData }): void {
    if (data?.save) {
      this.runtimeConfig = { save: data.save };
    } else if (data?.seed !== undefined) {
      this.runtimeConfig = { seed: data.seed, mapSize: data.mapSize ?? CONFIG.defaultMapSize };
    } else {
      this.runtimeConfig = null;
    }
  }

  constructor() {
    super('Main');
    this.runner = new SimRunner(seedFromUrl());
  }

  create(): void {
    if (this.runtimeConfig) {
      this.runner =
        'save' in this.runtimeConfig
          ? this.validatedRunnerFromSave(this.runtimeConfig.save)
          : new SimRunner(this.runtimeConfig.seed, undefined, this.runtimeConfig.mapSize);
      this.runtimeConfig = null;
    }
    // PERS-02 (gameSpeedDefault): apply the persisted default speed EXACTLY
    // once at boot for BOTH fresh-seed and loaded cities (create() is the
    // shared entry). Defensive positive-finite guard (T-19-06) so a corrupted
    // options value cannot trigger the time.ts setSpeed RangeError. The HUD
    // [0.5,1,2,4,8] buttons own the LIVE speed afterward (Pitfall 6) — the
    // default is never re-applied per tick, on pause/resume, or on any event.
    const bootSpeed = loadOptions().gameSpeedDefault;
    if (typeof bootSpeed === 'number' && Number.isFinite(bootSpeed) && bootSpeed > 0) {
      this.setSpeed(bootSpeed);
    }
    const state = this.runner.getState();
    this.lastTiles = new Array<number>(state.width * state.height).fill(-1);

    const layerData = new Phaser.Tilemaps.LayerData({
      tileWidth: TILE_W,
      tileHeight: TILE_H,
    });
    layerData.orientation = Phaser.Tilemaps.Orientation.ISOMETRIC;
    const mapData = new Phaser.Tilemaps.MapData({
      tileWidth: TILE_W,
      tileHeight: TILE_H,
      format: Phaser.Tilemaps.Formats.ARRAY_2D,
      orientation: Phaser.Tilemaps.Orientation.ISOMETRIC,
      layers: [layerData],
    });
    mapData.width = layerData.width = state.width;
    mapData.height = layerData.height = state.height;
    mapData.widthInPixels = layerData.widthInPixels = state.width * TILE_W;
    mapData.heightInPixels = layerData.heightInPixels = state.height * TILE_H;
    layerData.data = state.tiles.map((row, y) =>
      row.map((t, x) => new Phaser.Tilemaps.Tile(layerData, TILE_INDEX[t], x, y, TILE_W, TILE_H, TILE_W, TILE_H)),
    );
    this.map = new Phaser.Tilemaps.Tilemap(this, mapData);
    const tileset = this.map.addTilesetImage('terrain', 'terrain', TILE_W, TILE_H, 0, 0);
    if (!tileset) throw new Error('terrain tileset missing — BootScene must run first');
    this.layer = this.map.createLayer(0, tileset, 0, 0);

    const cam = this.cameras.main;
    this.cam = cam;
    // The isometric map is centered on world x = 0 (tile (0,0) tops at (0,0),
    // the map spans x in [-W/2, W/2]); center the initial view on the middle.
    cam.centerOn(0, mapData.heightInPixels / 2);

    this.ghost = this.add.graphics();
    this.ghost.setDepth(100000);

    // Overlay heatmap layer (UI-03): depth 1 sits above terrain (0) but below
    // every building depth (~30+), keeping buildings legible, and never takes
    // pointer input — camera pan/zoom and the click-inspect path stay intact.
    this.overlayGfx = this.add.graphics();
    this.overlayGfx.setDepth(1);
    this.overlayGfx.setVisible(true);

    this.wireInput(cam);

    // Phase-20 single key router (UI-RED-07, SPEC §3): A/←/→/Escape/B/1-5 and
    // the existing W/F/R/C/D/X all flow through KeyRouter so the precedence
    // guard (drawer > inspector > build panel > pause) applies uniformly.
    // handleKey is pure; this handler applies the returned diff to the scenes.
    const router = new KeyRouter();
    const kb = this.input.keyboard;
    kb?.on('keydown', (ev: KeyboardEvent) => {
      const hud = this.scene.get('HUD') as HUDScene | null;
      if (!hud) return; // key presses land only after create() finished
      // Single-char keys normalize to uppercase so Playwright's 'A'/'a' and
      // Shift-key presses all route identically; ArrowLeft/etc. pass through.
      const key = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
      const ctx: RouterCtx = {
        drawer: { open: hud.isDrawerOpen(), activeTab: hud.activeAdvisorId() ?? ADVISOR_DEFAULT_TAB },
        inspector: { open: hud.isInspectorOpen(), card: null },
        // 'build mode' = the build PANEL engagement (the surface B toggles).
        // Seeded from the persisted flag OR the live cursor so a clicked
        // build-* button also engages build mode (legacy ESC cancels it).
        buildMode: { active: this.buildModeEngaged || this.buildType !== null },
        pause: { paused: this.isPaused() },
        overlay: this.overlay ? { [this.overlay]: true } : {},
      };
      const result = router.handleKey(key, ctx);

      // Drawer: force open/close; a changed tab means A/←/→ cycled it.
      if (result.drawer.open !== ctx.drawer.open) hud.toggleAdvisors(result.drawer.open);
      if (result.drawer.activeTab !== ctx.drawer.activeTab) hud.selectAdvisorTab(result.drawer.activeTab);

      // Inspector: Escape closes it; ←/→ walk the popup list (card flips).
      if (!result.inspector.open && ctx.inspector.open) hud.closeInspector();
      if (result.inspector.card !== ctx.inspector.card && ctx.inspector.open) {
        hud.cycleInspector(result.inspector.card === 'walker' ? -1 : 1);
      }

      // Build panel: B toggles it via the router's buildMode; an Escape-driven
      // close also cancels a live build cursor (the pre-Phase-20 behavior).
      if (result.buildMode.active !== ctx.buildMode.active) {
        this.buildModeEngaged = result.buildMode.active;
        hud.setBuildPanelOpen(result.buildMode.active);
        if (key === 'Escape' && !result.buildMode.active && this.buildType) {
          this.setBuildMode(null);
        }
      }

      // Pause: the router's last-resort ESC fall-through (existing behavior).
      if (result.pause.paused !== ctx.pause.paused) this.setPaused(result.pause.paused);

      // Overlay: the router toggles ONE key; the radio only sees the diff —
      // a key flipped on emits its id, flipped off emits 'none' (clears).
      for (const [id, on] of Object.entries(result.overlay)) {
        if ((ctx.overlay?.[id] ?? false) === on) continue;
        this.game.events.emit('overlay-toggle', on ? (id as OverlayId) : 'none');
      }
    });
    // WR-04: register the bound handler and off() it on shutdown — game.events
    // is a global emitter that outlives scene restarts (restartToHome stops and
    // re-launches Main/HUD), so without cleanup every restart would call
    // setOverlay N times for one overlay-toggle emit.
    this.game.events.on('overlay-toggle', this.onOverlayToggle);
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('overlay-toggle', this.onOverlayToggle);
    });

    this.scene.launch('HUD');

    if (new URLSearchParams(window.location.search).has('test')) {
      this.exposeTestApi();
    }
  }

  override update(_time: number, delta: number): void {
    const n = this.timeSystem.advance(delta);
    for (let i = 0; i < n; i++) this.runner.tick();
    const state = this.runner.getState();
    this.syncTerrain(state);
    this.syncEntities(state);
    this.updateGhost();
    if (this.overlay) this.renderOverlay(state, this.overlay);
  }

  /**
   * Set the active overlay (UI-03): exactly one at a time (radio), 'none'/null
   * clears it. Single source of truth for the bar, the keyboard, and adviser
   * open-overlay actions. Read-only view state — never touches sim state.
   */
  private setOverlay(id: OverlayId | 'none' | null): void {
    const next = id && id !== 'none' ? (id as OverlayId) : null;
    this.overlay = next;
    this.overlayGfx?.clear();
    this.game.events.emit('overlay-legend', next);
    // A fresh overlay closes any open popup (click-through reopens one).
    this.game.events.emit('hud-inspect', null);
  }

  /** Draw the active overlay's heatmap from its pure per-tile grid, below the
   *  building depths. Zero-value cells are not painted (the map stays legible). */
  private renderOverlay(state: SimState, overlayId: OverlayId): void {
    const gfx = this.overlayGfx;
    if (!gfx) return;
    const width = state.width;
    const height = state.height;

    let cells: number[][] | null = null;
    let bandOf: (v: number) => number;
    const clampBand = (b: number): number => Math.min(4, Math.max(0, b));

    switch (overlayId) {
      case 'water': {
        const o = this.runner.getWaterOverlay();
        const src = o.sources;
        const cls = o.houseWaterClass;
        const well = o.wellCoverage;
        const fount = o.fountainCoverage;
        // WR-01: paint the well/fountain COVERAGE region (not just the source
        // tile + house classes) so the player sees where water actually reaches.
        cells = Array.from({ length: height }, (_, y) =>
          Array.from({ length: width }, (_, x) =>
            src[y][x] > 0 ? 4 : well[y][x] > 0 || fount[y][x] > 0 ? 1 : cls[y][x]),
        );
        bandOf = (v) => v;
        break;
      }
      case 'food': {
        const o = foodOverlayGrids(state);
        cells = o.supplyDays;
        bandOf = (v) => (v <= 0 ? 0 : v < 3 ? 1 : v < 6 ? 2 : v < 10 ? 3 : 4);
        break;
      }
      case 'risks': {
        const o = this.runner.getCivilizationOverlay();
        const fire = o.fire;
        const danger = o.danger;
        const collapse = o.collapse;
        const crime = o.crime;
        cells = Array.from({ length: height }, (_, y) =>
          Array.from({ length: width }, (_, x) =>
            Math.max(fire[y][x], danger[y][x], collapse[y][x], crime[y][x]),
          ),
        );
        bandOf = (v) => clampBand(Math.floor(v / 0.25));
        break;
      }
      case 'coverage': {
        const civ = this.runner.getCivicStats();
        cells = Array.from({ length: height }, () => new Array<number>(width).fill(0));
        const byId = new Map<number, BuildingState>();
        for (const b of state.buildings) byId.set(b.id, b);
        for (const h of civ.houses) {
          const b = byId.get(h.id);
          if (!b) continue;
          const v = Math.max(h.health, h.literacy, h.entertainment) / 100;
          for (let dy = 0; dy < b.footprint; dy++) {
            for (let dx = 0; dx < b.footprint; dx++) {
              const yy = b.y + dy;
              const xx = b.x + dx;
              if (yy >= 0 && yy < height && xx >= 0 && xx < width) cells[yy][xx] = v;
            }
          }
        }
        bandOf = (v) => clampBand(Math.round(v * 4));
        break;
      }
      case 'desirability': {
        // WR-05: feed the overlay from the sim's actual per-tile desirability
        // surface (the same desirabilityOf() the house ladder applies), not the
        // water-only additive delta grid (blank except near wells/fountains).
        cells = this.runner.getDesirabilityOverlay();
        bandOf = (v) => clampBand(Math.round(v / 50)); // desirability 0..200 → band 0..4
        break;
      }
      default:
        return;
    }
    if (!cells) return;

    const ramp = OVERLAY_RAMPS[overlayId];
    gfx.clear();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = cells[y][x];
        if (!v || v === 0) continue;
        const band = clampBand(bandOf(v));
        const color = hexToPhaser(ramp[band]);
        const top = tileTop(x, y);
        drawDiamond(gfx, top.x, top.y, TILE_W / 2, TILE_H / 2, color, 0.55);
      }
    }
  }

  /** Enter or leave build mode (called from the HUD). */
  setBuildMode(type: BuildingType | null): void {
    this.buildType = type;
    this.input.setDefaultCursor(type ? 'crosshair' : 'default');
    this.lastPaint = null;
    if (!type) this.ghost?.clear();
    this.game.events.emit('hud-build-mode', type);
  }

  getBuildMode(): BuildingType | null {
    return this.buildType;
  }

  /** Pause or resume the sim clock (used by the pause overlay). */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.timeSystem.setPaused(paused);
    if (paused) {
      this.setBuildMode(null);
      this.game.events.emit('hud-inspect', null);
      this.game.events.emit('game-pause');
    } else {
      this.game.events.emit('game-resume');
    }
  }

  /** Select a simulation speed multiplier (0.5, 1, 2, 4, 8). */
  setSpeed(speed: number): void {
    this.timeSystem.setSpeed(speed);
  }

  /**
   * PERS-01 defense-in-depth: migrate + validate a `save` runtimeConfig BEFORE
   * any SimRunner.fromSaveData replay. A save can reach MainScene from any
   * future path (?save= URL, dev e2e, slot quickload), so create() re-checks it
   * even after the HomeScene gate. A rejected save NEVER reaches fromSaveData/
   * applyCommand — it emits a hud-toast with the typed reason and falls back to
   * a fresh seed city (never a raw throw, never a silent misload on a NaN seed).
   */
  private validatedRunnerFromSave(save: SaveData): SimRunner {
    try {
      const migrated = migrateSave(save);
      const checked = validateSave(migrated);
      if (checked.ok) return SimRunner.fromSaveData(checked.data);
      this.game.events.emit('hud-toast', `Save rejected: ${checked.reason}`);
    } catch (e) {
      const reason = e instanceof SaveCodecError ? e.message : e instanceof Error ? e.message : String(e);
      this.game.events.emit('hud-toast', `Save rejected: ${reason}`);
    }
    // Same seam the no-save path uses — a fresh seed-generated city.
    return new SimRunner(seedFromUrl(), undefined, CONFIG.defaultMapSize);
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Capture the current sim as a save payload for persistence. */
  getSaveData(): SaveData {
    return this.runner.getSaveData();
  }

  /** Discard the current run and return to the home screen. */
  restartToHome(): void {
    this.paused = false;
    this.scene.stop('Main');
    this.scene.stop('HUD');
    this.scene.start('Home');
  }

  private wireInput(cam: Phaser.Cameras.Scene2D.Camera): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.downPlaced = false;
      if (p.middleButtonDown()) {
        // Middle-drag always pans (so the map stays movable in build mode).
        this.dragging = true;
        this.dragRight = true;
        this.camStart = { x: p.x, y: p.y, scrollX: cam.scrollX, scrollY: cam.scrollY };
        this.lastPaint = null;
        return;
      }
      this.dragging = true;
      this.dragRight = p.rightButtonDown();
      this.camStart = { x: p.x, y: p.y, scrollX: cam.scrollX, scrollY: cam.scrollY };
      this.lastPaint = null;
      if (!this.dragRight && this.buildType) this.paintAt(p);
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragging) {
        if (this.dragRight || !this.buildType) {
          cam.scrollX = this.camStart.scrollX - (p.x - this.camStart.x);
          cam.scrollY = this.camStart.scrollY - (p.y - this.camStart.y);
          this.clampCamera(cam);
        } else {
          this.paintAt(p);
        }
      }
      this.updateGhost();
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      const dragged = Math.abs(p.x - this.camStart.x) + Math.abs(p.y - this.camStart.y) > 6;
      this.dragging = false;
      if (this.dragRight) {
        // A right-click without movement cancels build mode; a right-drag pans.
        if (!dragged && p.rightButtonDown()) this.setBuildMode(null);
        return;
      }
      if (dragged) return;
      const tile = this.tileAtPointer(p);
      if (!tile) return;
      if (this.buildType) {
        // The pointer-down attempt already placed at this tile (single click):
        // the up-attempt would only fail with a spurious "occupied" toast.
        if (this.downPlaced) return;
        this.tryPlace(tile.x, tile.y);
      } else {
        // Click without build mode inspects the building under the pointer.
        this.emitInspect(tile.x, tile.y);
      }
    });

    this.input.on('wheel', (p: Phaser.Input.Pointer, _g: unknown, _dx: number, dy: number) => {
      const oldZoom = cam.zoom;
      const zoom = Phaser.Math.Clamp(cam.zoom * (dy < 0 ? 1.12 : 0.9), 0.5, 2.5);
      if (zoom === oldZoom) return;
      // Keep the world point under the cursor fixed while zooming:
      // screen = (world - scroll) * zoom, so scroll' = world - (world - scroll) * (oldZoom / zoom).
      const worldX = cam.scrollX + (p.x - cam.x) / cam.zoom;
      const worldY = cam.scrollY + (p.y - cam.y) / cam.zoom;
      const factor = oldZoom / zoom;
      cam.scrollX = worldX - (worldX - cam.scrollX) * factor;
      cam.scrollY = worldY - (worldY - cam.scrollY) * factor;
      cam.zoom = zoom;
      this.clampCamera(cam);
    });
  }

  /**
   * Keep the camera over the map. Unlike Phaser's setBounds clamping (which
   * pins the scroll when the bounds fit inside the viewport, making parts of
   * the map unreachable), this allows the whole map to be visible when zoomed
   * out and full panning at every zoom. The isometric map's world AABB is
   * centered on x = 0, so the x bounds start at -width/2.
   */
  private clampCamera(cam: Phaser.Cameras.Scene2D.Camera): void {
    const map = this.map;
    if (!map) return;
    const boundsX = -map.widthInPixels / 2;
    const boundsY = 0;
    const boundsW = map.widthInPixels;
    const boundsH = map.heightInPixels;
    const visibleW = cam.width / cam.zoom;
    const visibleH = cam.height / cam.zoom;
    if (visibleW >= boundsW) {
      cam.scrollX = boundsX + (boundsW - visibleW) / 2;
    } else {
      cam.scrollX = Phaser.Math.Clamp(cam.scrollX, boundsX, boundsX + boundsW - visibleW);
    }
    if (visibleH >= boundsH) {
      cam.scrollY = boundsY + (boundsH - visibleH) / 2;
    } else {
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY, boundsY, boundsY + boundsH - visibleH);
    }
  }

  private tileAtPointer(p: Phaser.Input.Pointer): Vec2 | null {
    const map = this.map;
    const cam = this.cam;
    // Pointer.worldX/worldY rely on the camera matrix, which drifts when
    // scroll/zoom are assigned directly; compute the world point ourselves.
    if (!map || !cam) return null;
    const wx = cam.scrollX + (p.x - cam.x) / cam.zoom;
    const wy = cam.scrollY + (p.y - cam.y) / cam.zoom;
    // Inverse of tileTop: a tile's diamond top vertex sits at
    // ((tx-ty)*W/2 + W/2, (tx+ty)*H/2), and its center at + (30, 15). The
    // tilemap renders the diamond with that offset (Phaser's
    // IsometricWorldToTileXY subtracts half the tile width before converting),
    // so tileAtPointer must reproduce it or the pick drifts by half a tile.
    const tx = Math.floor((wx + 2 * wy - TILE_W / 2) / TILE_W);
    const ty = Math.floor((2 * wy - wx + TILE_W / 2) / TILE_W);
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return null;
    return { x: tx, y: ty };
  }

  private tryPlace(x: number, y: number, silent = false): PlacementResult | null {
    if (!this.buildType) return null;
    const result = this.runner.placeBuilding(this.buildType, x, y);
    if (!result.ok && !silent) {
      this.game.events.emit('hud-toast', `Cannot place ${BUILDINGS[this.buildType].name}: ${describeError(result.error)}`);
    }
    return result;
  }

  /** Place at the tile under the pointer; ignores repeats while dragging. */
  private paintAt(p: Phaser.Input.Pointer): void {
    if (!this.buildType) return;
    const tile = this.tileAtPointer(p);
    if (!tile) return;
    if (this.lastPaint && this.lastPaint.x === tile.x && this.lastPaint.y === tile.y) return;
    this.lastPaint = tile;
    this.downPlaced = this.tryPlace(tile.x, tile.y, true)?.ok === true;
  }

  private syncTerrain(state: SimState): void {
    if (!this.layer) return;
    const width = state.width;
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const tile = TILE_INDEX[state.tiles[y][x]];
        if (tile !== this.lastTiles[idx]) {
          this.layer.putTileAt(tile, x, y);
          this.lastTiles[idx] = tile;
        }
      }
    }
  }

  private syncEntities(state: SimState): void {
    // Rebuild per-entity render objects each frame: depth = the tile's bottom
    // y, so the display list interleaves sprites and procedural shapes in the
    // same painter's order the old single-Graphics pass used.
    for (const obj of this.entityObjs) obj.destroy();
    this.entityObjs = [];

    const houseOn = isSheetLoaded('house');
    const items: { depth: number; make: () => RenderObj }[] = [];

    for (const b of state.buildings) {
      const base = b.type === 'house' ? HOUSE_COLORS[b.house?.tier ?? 0] : BUILDING_COLORS[b.type];
      const n = b.footprint;
      const top = tileTop(b.x, b.y);
      const depth = top.y + n * TILE_H;
      const tier = b.house?.tier ?? 0;
      if (b.type === 'house' && houseOn) {
        items.push({
          depth,
          make: () => {
            // The house frame's footprint diamond top vertex sits at
            // (HOUSE_FRAME_H/2, HOUSE_FOOT_TOP_Y) within the frame; anchor the
            // image there so the diamond aligns with the tile, with the roof
            // rising above it.
            const img = this.add.image(top.x, top.y, 'house', houseFrame(tier));
            img.setOrigin(0.5, HOUSE_FOOT_TOP_Y / HOUSE_FRAME_H);
            return img;
          },
        });
        continue;
      }
      const alpha = b.active || b.type === 'house' ? 0.95 : 0.55;
       // Check if this building has a sprite sheet (granary, farm, etc.)
       if (SHEET_BUILDINGS.has(b.type) && b.type !== 'house') {
         // Use the highest resolution sprite for crisp rendering at all zoom levels.
         // Scale is calculated from zoom and original sprite dimensions to maintain alignment.
         const sheetKey = `building_${b.type}_${BUILDING_RESOLUTIONS[BUILDING_RESOLUTIONS.length - 1]}`;
         if (this.textures.exists(sheetKey)) {
           const spriteMeta = getSpriteMeta(sheetKey);
           if (spriteMeta) {
             items.push({
               depth,
               make: () => {
                 const zoom = this.cameras.main.zoom;
                 // Scale so the sprite covers the footprint exactly at this zoom level.
                 // footprint width in world space: n * TILE_W * zoom
                 // sprite width at scale 1: spriteMeta.origWidth
                 // scale = (n * TILE_W * zoom) / spriteMeta.origWidth
                 const scale = (n * TILE_W * zoom) / spriteMeta.origWidth;
                 const img = this.add.image(top.x, top.y + n * TILE_H, sheetKey, 0);
                 img.setScale(scale);
                 img.setOrigin(0.5, 1.0);
                 img.setAlpha(alpha);
                 return img;
               },
             });
             continue;
           }
         }
       }
      items.push({
        depth,
        make: () => {
          const g = this.add.graphics();
          if (b.type === 'road') {
            drawDiamond(g, top.x, top.y, (n * TILE_W) / 2, (n * TILE_H) / 2, base, alpha);
          } else {
            drawBuilding(g, top.x, top.y, n, b.type, { color: base, alpha, tier });
          }
          return g;
        },
      });
    }

    // Walkers move sub-tile per sim tick; interpolate the rendered position
    // between the previous tick's position and this tick's over the current
    // tick's elapsed fraction so movement is smooth at any frame rate.
    const stepMs = 1000 / CONFIG.ticksPerSecond;
    const t = Phaser.Math.Clamp(this.timeSystem.pendingMs() / stepMs, 0, 1);
    const seen = new Set<number>();
    for (const w of state.walkers) {
      seen.add(w.id);
      const cur = {
        x: w.next ? w.x + (w.next.x - w.x) * w.progress : w.x,
        y: w.next ? w.y + (w.next.y - w.y) * w.progress : w.y,
      };
      const prev = this.walkerPrev.get(w.id);
      const px = prev ? prev.x + (cur.x - prev.x) * t : cur.x;
      const py = prev ? prev.y + (cur.y - prev.y) * t : cur.y;
      this.walkerPrev.set(w.id, cur);
      const top = tileTop(px, py);
      const depth = top.y + TILE_H;
      items.push({
        depth,
        make: () => {
          const g = this.add.graphics();
          const c = WALKER_COLORS[w.type as keyof typeof WALKER_COLORS] ?? 0x888888;
          g.fillStyle(c, 0.95);
          g.fillCircle(top.x, top.y + TILE_H / 2, 6);
          g.lineStyle(1, 0x000000, 0.4);
          g.strokeCircle(top.x, top.y + TILE_H / 2, 6);
          return g;
        },
      });
    }
    for (const id of this.walkerPrev.keys()) {
      if (!seen.has(id)) this.walkerPrev.delete(id);
    }

    items.sort((a, b) => a.depth - b.depth);
    for (const item of items) {
      const obj = item.make();
      obj.setDepth(item.depth);
      this.entityObjs.push(obj);
    }
  }

  /** Emit the building at (tx, ty) for the HUD popup, a walker on that tile, or
   *  null for empty terrain. The single click-through path — never broken by the
   *  overlay layer (T-18-04). */
  private emitInspect(tx: number, ty: number): void {
    const state = this.runner.getState();
    const building = state.buildings.find((b) => {
      const inX = tx >= b.x && tx < b.x + b.footprint;
      const inY = ty >= b.y && ty < b.y + b.footprint;
      return inX && inY;
    });
    // Roads have no detail popup (design D4) — treat them like empty terrain.
    if (building && building.type !== 'road') {
      this.game.events.emit('hud-inspect', building.id);
      return;
    }
    // A walker on the clicked tile (or its target tile) opens the walker inspector.
    const walker = state.walkers.find(
      (w) => (w.x === tx && w.y === ty) || (w.next != null && w.next.x === tx && w.next.y === ty),
    );
    if (walker) {
      this.game.events.emit('hud-walker-inspect', walker.id);
      return;
    }
    this.game.events.emit('hud-inspect', null);
  }

  private updateGhost(): void {
    const ghost = this.ghost;
    if (!ghost) return;
    if (!this.buildType) {
      ghost.clear();
      return;
    }
    const tile = this.tileAtPointer(this.input.activePointer);
    if (!tile) {
      ghost.clear();
      return;
    }
    const def = BUILDINGS[this.buildType];
    const top = tileTop(tile.x, tile.y);
    const valid = this.runner.canPlace(this.buildType, tile.x, tile.y).ok;
    const n = def.footprint;
    ghost.clear();
    ghost.fillStyle(valid ? 0x7dff7d : 0xff5c5c, 0.35);
    ghost.lineStyle(2, valid ? 0x2f9e2f : 0xc0392b, 0.9);
    ghost.beginPath();
    ghost.moveTo(top.x, top.y);
    ghost.lineTo(top.x + (n * TILE_W) / 2, top.y + (n * TILE_H) / 2);
    ghost.lineTo(top.x, top.y + n * TILE_H);
    ghost.lineTo(top.x - (n * TILE_W) / 2, top.y + (n * TILE_H) / 2);
    ghost.closePath();
    ghost.fillPath();
    ghost.strokePath();
  }

  private exposeTestApi(): void {
    const api = {
      place: (type: BuildingType, x: number, y: number) => this.runner.placeBuilding(type, x, y),
      runTicks: (n: number) => {
        for (let i = 0; i < n; i++) this.runner.tick();
      },
      state: () => this.runner.getState(),
      setBuildMode: (type: BuildingType | null) => this.setBuildMode(type),
      setObjective: (t: { population?: number; culture?: number; prosperity?: number; stability?: number; sustainChecks: number }) =>
        this.runner.setObjective(t),
      objectiveProgress: () => this.runner.getObjectiveProgress(),
      derived: () => this.runner.getDerived(),
      buildTypes: BUILDABLE_TYPES,
       camera: () => {
         const c = this.cam;
         return c ? { zoom: c.zoom, scrollX: c.scrollX, scrollY: c.scrollY } : null;
       },
       setZoom: (z: number) => {
         if (this.cam) {
           this.cam.setZoom(Phaser.Math.Clamp(z, 0.5, 2.5));
         }
       },
    };
    (window as unknown as Record<string, unknown>).__cityApi = api;
  }
}

/**
 * World-space top vertex of the rendered isometric diamond for a tile:
 * tile (tx,ty) renders with its diamond top vertex at
 * ((tx-ty)*W/2 + W/2, (tx+ty)*H/2). Phaser's tilemap draws each tile's
 * texture diamond centered on ((tx-ty)*W/2 + W/2, (tx+ty)*H/2 + H/2); the
 * tileAtPointer inverse reproduces this same mapping.
 */
export function tileTop(tx: number, ty: number): { x: number; y: number } {
  return { x: (tx - ty) * (TILE_W / 2) + TILE_W / 2, y: (tx + ty) * (TILE_H / 2) };
}

/**
 * Draw a flat isometric diamond (used for roads).
 */
function drawDiamond(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  halfW: number,
  halfH: number,
  color: number,
  alpha: number,
): void {
  g.fillStyle(color, alpha);
  g.lineStyle(1, 0x000000, 0.2);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + halfW, y + halfH);
  g.lineTo(x, y + halfH * 2);
  g.lineTo(x - halfW, y + halfH);
  g.closePath();
  g.fillPath();
  g.strokePath();
}

function describeError(error: PlacementError): string {
  switch (error) {
    case 'invalid-type':
      return 'Unknown building type';
    case 'out-of-bounds':
      return 'Outside the map';
    case 'occupied':
      return 'Tile already occupied';
    case 'terrain':
      return 'Invalid terrain for this building';
    case 'road-access':
      return 'Needs a road beside it';
    case 'not-enough-money':
      return 'Not enough money';
    default:
      return 'Placement failed';
  }
}

function seedFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get('seed');
  if (raw === null) return 1337;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? 1337 : n;
}
