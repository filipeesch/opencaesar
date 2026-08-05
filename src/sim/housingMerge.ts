/**
 * Deterministic housing merge pure transform (Phase 16, HOUS-02).
 *
 * Same-level orthogonally-adjacent mergeable houses grow into larger blocks
 * when their contiguous union fits the target level's footprint (the merge
 * ladder from HOUSING_LEVELS.footprint: 1x1 levels 0-10, 2x2 11-14, 3x3
 * 15-18, 4x4 19-20). Purely functional — measured over injected predicates,
 * no mutation, no RNG/wall-clock — so the runner can apply it on a fixed
 * placement-order scan and replay re-derives it byte-identically.
 *
 * Tile keys use the runner's (x << 20) | y scheme (runner.ts tileKey).
 */
import { HOUSING_LEVELS } from '../../data/housing';
import type { BuildingInstance } from './walkers';

const tileKey = (x: number, y: number): number => (x << 20) | y;

/** Merge footprint a house of `level` can grow into (fallback 1 when undefined). */
export function targetFootprint(level: number): number {
  const def = HOUSING_LEVELS.find((l) => l.level === level);
  return def?.footprint ?? 1;
}

/** Whether b is one tile beyond a's right edge (edge-sharing, gap === 1) with
 *  overlapping row span (a row overlap means strictly-edge contact). */
function isRightOf(a: BuildingInstance, b: BuildingInstance): boolean {
  return b.x === a.x + a.footprint;
}

function isLeftOf(a: BuildingInstance, b: BuildingInstance): boolean {
  return a.x === b.x + b.footprint;
}

function isBelowOf(a: BuildingInstance, b: BuildingInstance): boolean {
  return b.y === a.y + a.footprint;
}

function isAboveOf(a: BuildingInstance, b: BuildingInstance): boolean {
  return a.y === b.y + b.footprint;
}

function rowsOverlap(a: BuildingInstance, b: BuildingInstance): boolean {
  const ay2 = a.y + a.footprint - 1;
  const by2 = b.y + b.footprint - 1;
  return !(ay2 < b.y || by2 < a.y);
}

function colsOverlap(a: BuildingInstance, b: BuildingInstance): boolean {
  const ax2 = a.x + a.footprint - 1;
  const bx2 = b.x + b.footprint - 1;
  return !(ax2 < b.x || bx2 < a.x);
}

/** Orthogonal edge adjacency (strict edge contact, gap === 1), DIRS-anchored:
 *  rows-overlapping left/right neighbours or cols-overlapping above/below. */
function orthogonallyAdjacent(a: BuildingInstance, b: BuildingInstance): boolean {
  const horizontal = (isRightOf(a, b) || isLeftOf(a, b)) && rowsOverlap(a, b);
  const vertical = (isBelowOf(a, b) || isAboveOf(a, b)) && colsOverlap(a, b);
  return horizontal || vertical;
}

/**
 * First mergeable same-level orthogonally-adjacent house in placement order
 * (fixed scan — deterministic, stable). Returns null when none.
 */
export function findMergePartner(a: BuildingInstance, buildings: readonly BuildingInstance[]): BuildingInstance | null {
  if (!a.house) return null;
  for (const b of buildings) {
    if (b.id === a.id) continue;
    if (!b.house) continue;
    if (b.house.level !== a.house.level) continue;
    if (b.house.mergeable !== true) continue;
    if (orthogonallyAdjacent(a, b)) return b;
  }
  return null;
}

/**
 * Whether the n x n square anchored at (originX, originY) is clear: every tile
 * satisfies `!isOccupied(...)` OR is in the exempt set (the merging houses'
 * own tiles). Placement.ts-style injected-predicate check — pure.
 */
export function blockFits(
  originX: number,
  originY: number,
  n: number,
  isOccupied: (x: number, y: number) => boolean,
  exemptTileKeys?: Set<number>,
): boolean {
  for (let dy = 0; dy < n; dy++) {
    for (let dx = 0; dx < n; dx++) {
      const x = originX + dx;
      const y = originY + dy;
      if (exemptTileKeys?.has(tileKey(x, y))) continue;
      if (isOccupied(x, y)) return false;
    }
  }
  return true;
}

export interface MergeProposal {
  survivor: BuildingInstance;
  absorbed: BuildingInstance;
  footprint: number;
  /** Union-corner the merged block is actually placed at (originX = min(a.x,
   *  b.x), originY = min(a.y, b.y)). CR-01: anchoring the square at the
   *  survivor's origin was wrong for right/below-anchor scans — the block
   *  detached from the absorbed house and freed a hole. */
  originX: number;
  originY: number;
}

/**
 * Build a merge proposal when two houses are same-level AND the target
 * footprint square anchored at the UNION min-corner contains BOTH houses'
 * full current footprints. `isOccupied` is the occupancy predicate (placement.ts
 * style); `exemptTileKeys` are the two houses' own tiles, which the block-fit
 * check must treat as free (the runner passes a's + neighbour's tile keys).
 * Deterministic given fixed inputs.
 *
 * CR-01: two requirements the old implementation missed —
 *   1. the square must be anchored so it CONTAINS the absorbed house (a
 *      right/below-anchor pair merged into a block that excluded the absorbed
 *      origin, leaving a detached block + freed hole);
 *   2. a house with a footprint the target square cannot cover (e.g. a 1x1
 *      at level 11 absorbing an already-2x2 same-level house) is rejected —
 *      a 1x1 must never absorb a larger structure.
 */
export function mergeProposal(
  a: BuildingInstance,
  b: BuildingInstance,
  footprint: number,
  isOccupied: (x: number, y: number) => boolean,
  exemptTileKeys?: Set<number>,
): MergeProposal | null {
  if (!a.house || !b.house) return null;
  if (a.house.level !== b.house.level) return null;
  if (b.house.mergeable !== true) return null;
  const originX = Math.min(a.x, b.x);
  const originY = Math.min(a.y, b.y);
  const contains = (h: BuildingInstance): boolean =>
    h.x >= originX && h.x + h.footprint <= originX + footprint &&
    h.y >= originY && h.y + h.footprint <= originY + footprint;
  // The target square must contain BOTH houses entirely — never absorb a
  // footprint the square cannot cover.
  if (!contains(a) || !contains(b)) return null;
  if (!blockFits(originX, originY, footprint, isOccupied, exemptTileKeys)) return null;
  return { survivor: a, absorbed: b, footprint, originX, originY };
}
