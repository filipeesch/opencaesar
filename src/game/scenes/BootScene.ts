/**
 * BootScene: prepares all art textures before the game starts.
 *
 * Art pipeline (design D10): the game must boot and be fully playable with
 * zero art assets. BootScene consults the art manifest (src/game/art.ts):
 * each sheet that exists under public/assets is loaded as a sprite sheet and
 * marked as loaded; any missing sheet falls back to a procedurally generated
 * placeholder texture registered under the same key, so renderers always read
 * a texture by its manifest key.
 *
 * With `?artexport` in the URL the scene only regenerates the procedural art
 * and exposes it as PNG data URLs on `window.__artExport` (used by
 * scripts/export-art.mjs to bake the first art set into public/assets).
 */

import Phaser from 'phaser';
import type { TileType } from '../../sim/types';
import { HOUSE_COLORS, TILE_H, TILE_W } from '../palette';
import { HOUSE_FRAME_H, SHEETS, sheetLoaded } from '../art';

const TILE_TYPES: readonly TileType[] = ['earth', 'water', 'fertile', 'trees', 'rock', 'road'];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  async create(): Promise<void> {
    if (new URLSearchParams(window.location.search).has('artexport')) {
      this.generateTerrainTexture();
      this.generateHouseTexture();
      this.exposeArtExport();
      return;
    }

    await this.loadManifestSheets();
    if (!this.textures.exists('terrain')) this.generateTerrainTexture();
    if (!this.textures.exists('house')) this.generateHouseTexture();
    this.scene.start('Main');
  }

  /**
   * Try to load each manifest sheet that exists on disk. Sheets that fail to
   * load (missing file) are left to the procedural placeholder generator, and
   * only sheets that loaded are marked as loaded in the manifest registry.
   */
  private async loadManifestSheets(): Promise<void> {
    const available = await Promise.all(
      SHEETS.map(async (s) => {
        try {
          const res = await fetch(s.url, { method: 'HEAD' });
          return res.ok;
        } catch {
          return false;
        }
      }),
    );

    const queue = SHEETS.map((s, i) => ({ s, exists: available[i] })).filter((e) => e.exists);
    if (queue.length === 0) return;

    for (const { s } of queue) {
      this.load.spritesheet(s.key, s.url, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
    }

    await new Promise<void>((resolve) => {
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.start();
    });

    for (const { s } of queue) {
      if (this.textures.exists(s.key)) sheetLoaded.add(s.key);
    }
  }

  /** Procedural placeholder: six 60x30 isometric terrain tiles in one strip. */
  private generateTerrainTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = TILE_W * TILE_TYPES.length;
    canvas.height = TILE_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas context unavailable');
    TILE_TYPES.forEach((type, i) => drawTile(ctx, i * TILE_W, type));
    this.textures.addCanvas('terrain', canvas);
  }

  /** Procedural placeholder: five 60x48 house frames, one per tier. */
  private generateHouseTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = TILE_W * 5;
    canvas.height = HOUSE_FRAME_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas context unavailable');
    for (let tier = 0; tier < 5; tier++) {
      drawHouseFrame(ctx, tier * TILE_W, tier);
    }
    this.textures.addCanvas('house', canvas);
  }

  private exposeArtExport(): void {
    const exportSheets: Record<string, string> = {};
    for (const s of SHEETS) {
      const tex = this.textures.get(s.key);
      if (!tex) continue;
      const img = tex.getSourceImage();
      if (img instanceof HTMLCanvasElement) exportSheets[s.key] = img.toDataURL('image/png');
    }
    (window as unknown as Record<string, unknown>).__artExport = exportSheets;
  }
}

// ---------------------------------------------------------------------------
// Procedural terrain tiles (deterministic, hash-based noise)
// ---------------------------------------------------------------------------

/** Deterministic 2D hash -> [0, 1). */
function hash2d(x: number, y: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + salt * 1274126177) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295;
}

function drawTile(ctx: CanvasRenderingContext2D, ox: number, type: TileType): void {
  const cx = ox + TILE_W / 2;
  const cy = TILE_H / 2;
  const salt = TILE_TYPES.indexOf(type);

  // Canvas2D clip() *intersects* with the previous clip region instead of
  // replacing it, so each tile must be wrapped in save/restore to isolate
  // its diamond clip from the neighbouring tiles' clips.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx + TILE_W / 2, cy);
  ctx.lineTo(cx, TILE_H);
  ctx.lineTo(cx - TILE_W / 2, cy);
  ctx.closePath();
  ctx.clip();

  switch (type) {
    case 'water':
      drawWater(ctx, cx, cy, salt);
      break;
    case 'fertile':
      drawFertile(ctx, cx, cy, salt);
      break;
    case 'trees':
      drawTrees(ctx, cx, cy, salt);
      break;
    case 'rock':
      drawRock(ctx, cx, cy, salt);
      break;
    case 'road':
      drawRoad(ctx, cx, cy);
      break;
    default:
      drawEarth(ctx, cx, cy, salt);
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** Patchy brown earth with scattered pebbles and darker cracks. */
function drawEarth(ctx: CanvasRenderingContext2D, cx: number, cy: number, salt: number): void {
  ctx.fillStyle = '#8a744c';
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (let i = 0; i < 5; i++) {
    const x = cx - 22 + hash2d(i, salt, 1) * 44;
    const y = cy - 8 + hash2d(i, salt, 2) * 16;
    speckle(ctx, x, y, 2 + hash2d(i, salt, 3) * 2);
  }
  ctx.fillStyle = 'rgba(255, 230, 180, 0.25)';
  for (let i = 0; i < 4; i++) {
    const x = cx - 22 + hash2d(i, salt, 4) * 44;
    const y = cy - 8 + hash2d(i, salt, 5) * 16;
    speckle(ctx, x, y, 1 + hash2d(i, salt, 6) * 2);
  }
}

/** Deep water with a gradient, wave lines and a lighter shore edge. */
function drawWater(ctx: CanvasRenderingContext2D, cx: number, cy: number, salt: number): void {
  const grad = ctx.createLinearGradient(cx, 0, cx, TILE_H);
  grad.addColorStop(0, '#4d84c8');
  grad.addColorStop(1, '#2c5a94');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const wy = cy - 4 + i * 6 + hash2d(i, salt, 1) * 2;
    const wlen = 10 + hash2d(i, salt, 2) * 14;
    const wx = cx - wlen / 2;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.quadraticCurveTo(wx + wlen / 2, wy - 3, wx + wlen, wy);
    ctx.stroke();
  }
  // Lighter surface along the bottom edge (shore-facing).
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.beginPath();
  ctx.moveTo(cx - TILE_W / 2, cy);
  ctx.lineTo(cx, TILE_H);
  ctx.lineTo(cx + TILE_W / 2, cy);
  ctx.stroke();
}

/** Rich soil with grass tufts and small sprouts. */
function drawFertile(ctx: CanvasRenderingContext2D, cx: number, cy: number, salt: number): void {
  ctx.fillStyle = '#6f9042';
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  for (let i = 0; i < 4; i++) {
    const x = cx - 22 + hash2d(i, salt, 1) * 44;
    const y = cy - 8 + hash2d(i, salt, 2) * 16;
    speckle(ctx, x, y, 2 + hash2d(i, salt, 3) * 2);
  }
  ctx.strokeStyle = 'rgba(40, 90, 30, 0.9)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const x = cx - 18 + hash2d(i, salt, 4) * 36;
    const y = cy - 4 + hash2d(i, salt, 5) * 10;
    const dx = (hash2d(i, salt, 6) - 0.5) * 8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y - 4);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(180, 220, 120, 0.5)';
  for (let i = 0; i < 3; i++) {
    const x = cx - 20 + hash2d(i, salt, 7) * 40;
    const y = cy - 6 + hash2d(i, salt, 8) * 12;
    speckle(ctx, x, y, 1.5);
  }
}

/** Trunk with a layered canopy. */
function drawTrees(ctx: CanvasRenderingContext2D, cx: number, cy: number, salt: number): void {
  ctx.fillStyle = '#7d6b47';
  ctx.fill();
  const trunk = cx - 6 + hash2d(0, salt, 1) * 12;
  ctx.fillStyle = '#5a4630';
  ctx.fillRect(trunk - 2, cy + 4, 4, 8);
  const blobs: Array<[number, number, number]> = [
    [trunk - 4, cy - 2, 7],
    [trunk + 6, cy - 1, 8],
    [trunk + 1, cy - 8, 6],
    [trunk - 1, cy + 3, 7],
  ];
  ctx.fillStyle = '#2f5d1e';
  for (const [bx, by, r] of blobs) {
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#3d7a28';
  for (const [bx, by, r] of blobs) {
    ctx.beginPath();
    ctx.arc(bx - 1.5, by - 2, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Boulders with a highlight and cast shadow. */
function drawRock(ctx: CanvasRenderingContext2D, cx: number, cy: number, salt: number): void {
  ctx.fillStyle = '#8d8d88';
  ctx.fill();
  for (let i = 0; i < 2; i++) {
    const bx = cx - 10 + i * 14 + hash2d(i, salt, 1) * 6;
    const by = cy - 2 + hash2d(i, salt, 2) * 4;
    const r = 6 + hash2d(i, salt, 3) * 3;
    ctx.fillStyle = i === 0 ? '#74746f' : '#9a9a94';
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(bx - r * 0.35, by - r * 0.4, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(bx + r * 0.3, by + r * 0.6, r * 0.5, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Dusty road with wheel ruts along the axes. */
function drawRoad(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.fillStyle = '#c2b088';
  ctx.fill();
  // Wheel ruts along both iso axes.
  ctx.strokeStyle = 'rgba(90, 70, 40, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy - 3);
  ctx.lineTo(cx - 4, cy + 8);
  ctx.moveTo(cx + 18, cy - 3);
  ctx.lineTo(cx + 4, cy + 8);
  ctx.moveTo(cx + 2, cy - 5);
  ctx.lineTo(cx + 14, cy + 3);
  ctx.moveTo(cx - 2, cy - 5);
  ctx.lineTo(cx - 14, cy + 3);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 240, 210, 0.35)';
  speckle(ctx, cx, cy - 6, 3);
}

function speckle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Procedural house frames (one isometric house box per tier)
// ---------------------------------------------------------------------------

/** Draw one 60x48 house frame; the footprint diamond spans y 18..48 (TILE_H). */
function drawHouseFrame(ctx: CanvasRenderingContext2D, ox: number, tier: number): void {
  const cx = ox + TILE_W / 2;
  const rise = 10 + tier * 2;
  const color = HOUSE_COLORS[tier];

  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  const top = { x: cx, y: 18 };
  const right = { x: cx + hw, y: top.y + hh };
  const bottom = { x: cx, y: top.y + hh * 2 };
  const left = { x: cx - hw, y: top.y + hh };
  const roofTop = { x: cx, y: top.y - rise };
  const roofRight = { x: cx + hw, y: top.y + hh - rise };
  const roofBottom = { x: cx, y: top.y + hh * 2 - rise };
  const roofLeft = { x: cx - hw, y: top.y + hh - rise };

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
  ctx.beginPath();
  ctx.moveTo(top.x + 3, top.y + 4);
  ctx.lineTo(right.x + 3, right.y + 4);
  ctx.lineTo(bottom.x + 3, bottom.y + 4);
  ctx.lineTo(left.x + 3, left.y + 4);
  ctx.closePath();
  ctx.fill();

  poly(ctx, [left, bottom, roofBottom, roofLeft], shade(color, 40));
  poly(ctx, [right, bottom, roofBottom, roofRight], shade(color, 15));
  poly(ctx, [roofTop, roofRight, roofBottom, roofLeft], toCss(color));
}

function poly(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

/** Darken a packed RGB color by `amount` percent, returning a CSS color. */
function shade(color: number, amount: number): string {
  return toCss(
    Math.round(((color >> 16) & 0xff) * (1 - amount / 100)),
    Math.round(((color >> 8) & 0xff) * (1 - amount / 100)),
    Math.round((color & 0xff) * (1 - amount / 100)),
  );
}

/** Convert a packed RGB number (or three channels) to a CSS color. */
function toCss(r: number, g?: number, b?: number): string {
  if (g === undefined || b === undefined) {
    return toCss((r >> 16) & 0xff, (r >> 8) & 0xff, r & 0xff);
  }
  return `rgb(${r}, ${g}, ${b})`;
}
