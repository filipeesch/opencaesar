/**
 * Procedural building art — buildings are drawn as plain isometric boxes: two
 * shaded wall faces dropping from a raised flat roof down to the footprint
 * diamond, so every building stands visibly above the ground.
 *
 * Geometry: the footprint diamond for an n x n building has its top vertex at
 * (x, y) and its bottom vertex at (x, y + n*TILE_H). The roof is the same
 * diamond translated up by `rise` screen pixels; the two visible walls are the
 * front-left and front-right faces between the ground diamond and the roof.
 */

import Phaser from 'phaser';
import type { BuildingType } from '../sim/types';
import { TILE_H, TILE_W } from './palette';

interface Pt {
  x: number;
  y: number;
}

/** Wall height (screen px) each building type rises above its footprint. */
const RISE: Record<Exclude<BuildingType, 'road'>, number> = {
  house: 10, farm: 9, granary: 20, market: 16, well: 7,
  fountain: 9, orchard: 9, engineer_post: 12, fire_station: 16,
  clinic: 12, hospital: 18, school: 16, library: 14, temple: 18, theatre: 18,
  amphitheatre: 22, colosseum: 30,
  forum: 20, garden: 6,
  clay_pit: 12, timber_yard: 12, iron_mine: 14, quarry: 16,
  olive_farm: 12, grape_farm: 12,
  pottery_workshop: 14, furniture_workshop: 14, oil_press: 14, winery: 14, tool_workshop: 14,
  warehouse: 18, prefecture: 16,
};

export interface BuildingArtOptions {
  /** Base wall/roof color. */
  color: number;
  /** Opacity (inactive buildings are dimmed). */
  alpha: number;
  /** House tier (0..4); adds height for richer houses. */
  tier?: number;
}

/**
 * Draw a building at footprint top vertex (x, y). `type === 'road'` should be
 * handled by the caller (it is a flat tile, not a box).
 */
export function drawBuilding(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  n: number,
  type: Exclude<BuildingType, 'road'>,
  opts: BuildingArtOptions,
): void {
  const hw = (n * TILE_W) / 2;
  const hh = (n * TILE_H) / 2;
  const h = n * TILE_H;
  const rise = RISE[type] + (type === 'house' ? (opts.tier ?? 0) * 2 : 0);
  const alpha = opts.alpha;

  // Ground diamond and the roof diamond raised by `rise`.
  const T: Pt = { x, y };
  const R: Pt = { x: x + hw, y: y + hh };
  const B: Pt = { x, y: y + h };
  const L: Pt = { x: x - hw, y: y + hh };
  const TR: Pt = { x, y: y - rise };
  const RR: Pt = { x: x + hw, y: y + hh - rise };
  const BR: Pt = { x, y: y + h - rise };
  const LR: Pt = { x: x - hw, y: y + hh - rise };

  // Soft shadow cast down-screen grounds the building on its footprint.
  poly(
    g,
    [T, R, B, L].map((p) => ({ x: p.x + 3, y: p.y + 4 })),
    0x000000,
    0.16,
  );

  // The two visible walls: left face (shaded) and right face (lit).
  // Note: Color.darken() mutates the object, so each shade needs a fresh copy.
  poly(g, [L, B, BR, LR], shade(opts.color, 40), alpha);
  poly(g, [R, B, BR, RR], shade(opts.color, 15), alpha);

  // Flat roof on top.
  poly(g, [TR, RR, BR, LR], opts.color, alpha);
  g.lineStyle(1, shade(opts.color, 28), 0.5);
  g.beginPath();
  g.moveTo(TR.x, TR.y);
  g.lineTo(BR.x, BR.y);
  g.strokePath();
}

/** Darken a packed RGB color by `amount` percent without mutating anything. */
function shade(color: number, amount: number): number {
  return Phaser.Display.Color.IntegerToColor(color).darken(amount).color;
}

/** Closed-polygon fill helper (Graphics path API). */
function poly(g: Phaser.GameObjects.Graphics, pts: Pt[], color: number, alpha: number): void {
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
  g.fillPath();
}
