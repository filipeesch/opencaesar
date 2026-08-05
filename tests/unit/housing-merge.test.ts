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
