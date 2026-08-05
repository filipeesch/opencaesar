/**
 * Deterministic housing merge pure helpers (Phase 16, HOUS-02).
 *
 * src/sim/housingMerge.ts provides the side-effect-free occupancy transform the
 * runner applies on the month cadence: targetFootprint (the merge ladder),
 * findMergePartner (fixed placement-order same-level scan), blockFits (the
 * injected-predicate n x n square check, placement.ts style), and mergeProposal.
 *
 * Tile keys use the runner's (x << 20) | y scheme (runner.ts:2686).
 */
import { describe, expect, it } from 'vitest';
import { targetFootprint, findMergePartner, blockFits, mergeProposal } from '../../src/sim/housingMerge';
import type { BuildingInstance } from '../../src/sim/walkers';

const tileKey = (x: number, y: number): number => (x << 20) | y;

function mkHouse(id: number, x: number, y: number, level: number, footprint = 1, mergeable = true): BuildingInstance {
  return {
    id,
    type: 'house',
    x,
    y,
    footprint,
    workersAssigned: 0,
    workersRequired: 0,
    active: false,
    laborConnected: false,
    laborCooldown: 0,
    spawnCooldown: 0,
    stock: {},
    house: {
      tier: 2,
      level,
      foodCooldown: 100,
      waterCooldown: 100,
      laborCooldown: 100,
      evolveCounter: 0,
      devolveCounter: 0,
      mergeable,
      satisfiedTicks: 0,
      unsatisfiedTicks: 0,
    },
  };
}

describe('targetFootprint merge ladder (game.md §11.3)', () => {
  it('maps the footprint ladder boundaries', () => {
    expect(targetFootprint(5)).toBe(1);
    expect(targetFootprint(10)).toBe(1);
    expect(targetFootprint(11)).toBe(2);
    expect(targetFootprint(14)).toBe(2);
    expect(targetFootprint(15)).toBe(3);
    expect(targetFootprint(18)).toBe(3);
    expect(targetFootprint(19)).toBe(4);
    expect(targetFootprint(20)).toBe(4);
  });

  it('is monotonic non-decreasing over the full 0-20 ladder', () => {
    let prev = 0;
    for (let level = 0; level <= 20; level++) {
      const f = targetFootprint(level);
      expect(f).toBeGreaterThanOrEqual(1);
      expect(f).toBeLessThanOrEqual(4);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });
});

describe('blockFits (injected occupancy predicate)', () => {
  it('returns true for an empty target square', () => {
    const isOcc = (_x: number, _y: number) => false;
    expect(blockFits(0, 0, 2, isOcc)).toBe(true);
    expect(blockFits(3, 3, 4, isOcc)).toBe(true);
  });

  it('returns false when a foreign building occupies any tile inside the square', () => {
    const occ = new Map<number, number>();
    occ.set(tileKey(2, 2), 99);
    const isOcc = (x: number, y: number) => occ.has(tileKey(x, y));
    expect(blockFits(0, 0, 2, isOcc)).toBe(true); // (2,2) outside the 2x2 at (0,0)
    expect(blockFits(1, 1, 2, isOcc)).toBe(false); // (2,2) inside the 2x2 at (1,1)
  });

  it('honours the exempt set (the two merging houses own tiles)', () => {
    const occ = new Map<number, number>();
    occ.set(tileKey(1, 1), 1);
    occ.set(tileKey(2, 2), 2);
    const isOcc = (x: number, y: number) => occ.has(tileKey(x, y));
    const exempt = new Set([tileKey(1, 1), tileKey(2, 2)]);
    expect(blockFits(1, 1, 2, isOcc, exempt)).toBe(true);
  });
});

describe('findMergePartner (fixed-scan same-level adjacency)', () => {
  it('returns the same-level orthogonally-adjacent partner in scan order', () => {
    const a = mkHouse(1, 5, 5, 11);
    const b = mkHouse(2, 6, 5, 11);
    const buildings = [a, b, mkHouse(3, 20, 20, 11)];
    const partner = findMergePartner(a, buildings);
    expect(partner?.id).toBe(b.id);
  });

  it('returns null when the adjacent house is a different level', () => {
    const a = mkHouse(1, 5, 5, 11);
    const b = mkHouse(2, 6, 5, 2);
    expect(findMergePartner(a, [a, b])).toBeNull();
  });

  it('returns null for non-adjacent houses', () => {
    const a = mkHouse(1, 5, 5, 11);
    const far = mkHouse(2, 20, 20, 11);
    expect(findMergePartner(a, [a, far])).toBeNull();
  });

  it('returns null when a same-level adjacent house is not mergeable', () => {
    const a = mkHouse(1, 5, 5, 11);
    const b = mkHouse(2, 6, 5, 11, 1, false);
    expect(findMergePartner(a, [a, b])).toBeNull();
  });

  it('is deterministic: identical input order yields an identical result', () => {
    const buildings = [mkHouse(1, 5, 5, 11), mkHouse(2, 6, 5, 11), mkHouse(3, 20, 20, 11)];
    const p1 = findMergePartner(buildings[0], buildings);
    const p2 = findMergePartner(buildings[0], buildings);
    expect(p1?.id).toBe(p2?.id);
    const r1 = mergeProposal(buildings[0], buildings[1], targetFootprint(11), () => false);
    const r2 = mergeProposal(buildings[0], buildings[1], targetFootprint(11), () => false);
    expect(r1).toEqual(r2);
  });

  it('survivor keeps the anchor: mergeProposal anchors the block at a origin', () => {
    const a = mkHouse(1, 5, 5, 11);
    const b = mkHouse(2, 6, 5, 11);
    const occ = new Map<number, number>();
    const isOcc = (x: number, y: number) => occ.has(tileKey(x, y));
    const proposal = mergeProposal(a, b, targetFootprint(11), isOcc);
    expect(proposal).not.toBeNull();
    expect(proposal!.survivor.id).toBe(a.id);
    expect(proposal!.absorbed.id).toBe(b.id);
    expect(proposal!.footprint).toBe(2);
    // Union-corner anchoring: a is already the min-corner, so origin == a.
    expect(proposal!.originX).toBe(5);
    expect(proposal!.originY).toBe(5);
  });

  it('CR-01 regression: right-anchor pair anchors at the union corner and still contains the absorbed origin', () => {
    // The reviewer repro: scan anchor a is the RIGHT-hand member of the pair —
    // the old block anchored at a=(6,5) covered (6,5)-(7,6), which EXCLUDED the
    // absorbed origin (5,5) and freed a detached hole.
    const a = mkHouse(1, 6, 5, 11);
    const b = mkHouse(2, 5, 5, 11);
    const occ = new Map<number, number>();
    const isOcc = (x: number, y: number) => occ.has(tileKey(x, y));
    const proposal = mergeProposal(a, b, targetFootprint(11), isOcc);
    expect(proposal).not.toBeNull();
    // The block is placed at the union min-corner, which contains BOTH origins.
    expect(proposal!.originX).toBe(5);
    expect(proposal!.originY).toBe(5);
  });

  it('CR-01 regression: below/above-anchor pairs anchor at the union corner', () => {
    // a below b on the y axis: a=(5,6), b=(5,5). Union corner is (5,5).
    const a = mkHouse(1, 5, 6, 11);
    const b = mkHouse(2, 5, 5, 11);
    const isOcc = (_x: number, _y: number) => false;
    const proposal = mergeProposal(a, b, targetFootprint(11), isOcc);
    expect(proposal).not.toBeNull();
    expect(proposal!.originX).toBe(5);
    expect(proposal!.originY).toBe(5);
    // a above b on the y axis: a=(5,5), b=(5,6). Union corner is still (5,5).
    const c = mkHouse(1, 5, 5, 11);
    const d = mkHouse(2, 5, 6, 11);
    const proposal2 = mergeProposal(c, d, targetFootprint(11), (_x: number, _y: number) => false);
    expect(proposal2).not.toBeNull();
    expect(proposal2!.originX).toBe(5);
    expect(proposal2!.originY).toBe(5);
  });

  it('CR-01 regression: a 1x1 never absorbs an already-2x2 same-level house (footprint the target square cannot cover)', () => {
    // Reviewer repro: a=(6,5) 1x1 level 11 merges with b=(7,5) 2x2 level 11.
    // A 2x2 target square cannot contain a 2x2 neighbour next to a 1x1 anchor.
    const a = mkHouse(1, 6, 5, 11, 1);
    const b = mkHouse(2, 7, 5, 11, 2);
    const occ = new Map<number, number>();
    occ.set(tileKey(7, 5), b.id);
    occ.set(tileKey(8, 5), b.id);
    occ.set(tileKey(7, 6), b.id);
    occ.set(tileKey(8, 6), b.id);
    const isOcc = (x: number, y: number) => occ.has(tileKey(x, y));
    const exempt = new Set([...occ.keys()]);
    expect(mergeProposal(a, b, targetFootprint(11), isOcc, exempt)).toBeNull();
  });

  it('mergeProposal rejects when the block square is occupied', () => {
    const a = mkHouse(1, 5, 5, 11);
    const b = mkHouse(2, 6, 5, 11);
    const occ = new Map<number, number>();
    occ.set(tileKey(5, 6), 99); // a tile inside the surviving 2x2 square, foreign
    const isOcc = (x: number, y: number) => occ.has(tileKey(x, y));
    expect(mergeProposal(a, b, targetFootprint(11), isOcc)).toBeNull();
  });
});
