import { describe, it, expect } from 'vitest';
import { Map } from '../../src/sim/map';
import { RoadNetwork } from '../../src/sim/roadNet';

function roadMap(): Map {
  const m = new Map(8, 8, 'earth');
  // Two L-shaped road segments connected by a bridge only at (4,3)
  m.set(1, 1, 'road'); m.set(2, 1, 'road'); m.set(2, 2, 'road');
  m.set(5, 5, 'road'); m.set(6, 5, 'road'); m.set(6, 6, 'road');
  return m;
}

describe('RoadNetwork (ROAD-01)', () => {
  it('builds components from road tiles', () => {
    const n = new RoadNetwork(roadMap());
    expect(n.nodeCount()).toBe(6);
    expect(n.connected({ x: 1, y: 1 }, { x: 2, y: 2 })).toBe(true);
    expect(n.connected({ x: 1, y: 1 }, { x: 5, y: 5 })).toBe(false); // disjoint components
  });

  it('an isolated addRoad assigns a component (ROAD-01)', () => {
    const m = new Map(8, 8, 'earth');
    const n = new RoadNetwork(m);
    n.addRoad(0, 0);
    expect(n.nodeCount()).toBe(1);
    expect(n.connected({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(true);
    // The recomputed (dirty) region for a truly isolated add is the tile itself.
    expect(n.affectedTiles()).toContainEqual({ x: 0, y: 0 });
  });

  it('exposes the affected/dirty set for the localized region', () => {
    const n = new RoadNetwork(roadMap());
    n.addRoad(0, 0);
    // The dirty region contains the added tile (and at least the local region).
    expect(n.affectedTiles()).toContainEqual({ x: 0, y: 0 });
    expect(n.affectedTiles().length).toBeGreaterThanOrEqual(1);
  });

  it('merging two components widens the dirty region beyond the single tile', () => {
    const n = new RoadNetwork(roadMap());
    n.addRoad(0, 2); // isolated tile
    const beforeLen = n.affectedTiles().length;

    // Bridge that isolated tile into the (1,1),(2,1),(2,2) component.
    n.addRoad(1, 2);
    expect(n.connected({ x: 0, y: 2 }, { x: 2, y: 2 })).toBe(true);
    // The recompute touched both old components plus the new tile.
    expect(n.affectedTiles().length).toBeGreaterThan(beforeLen);
    expect(n.affectedTiles().length).toBeGreaterThanOrEqual(2);
  });

  it('a cut widens the dirty region to the old component tiles', () => {
    const n = new RoadNetwork(roadMap());
    // Chain the two components together so (4,3) is an articulation tile.
    n.addRoad(3, 2); n.addRoad(4, 2);
    n.addRoad(3, 3); n.addRoad(4, 3);
    n.addRoad(5, 3); n.addRoad(5, 4);
    expect(n.connected({ x: 2, y: 2 }, { x: 5, y: 5 })).toBe(true);

    n.removeRoad(4, 3);
    expect(n.connected({ x: 2, y: 2 }, { x: 5, y: 5 })).toBe(false);
    const dirty = n.affectedTiles();
    // The re-colored region spans the old component tiles (not just the removed
    // tile), so it must be larger than a single tile.
    expect(dirty.length).toBeGreaterThanOrEqual(2);
    // The removed tile itself is no longer part of the graph — it is not dirty.
    expect(dirty).not.toContainEqual({ x: 4, y: 3 });
  });

  it('adding a road bridges two components (localized recompute)', () => {
    const n = new RoadNetwork(roadMap());
    expect(n.connected({ x: 2, y: 2 }, { x: 5, y: 5 })).toBe(false);
    // Bridge the two segments: (2,2)--(3,2)--(4,2)--(5,3)?? No: use a genuine chain
    // of adjacent tiles from (2,2) down/right to (5,5).
    n.addRoad(3, 2); n.addRoad(4, 2); n.addRoad(4, 3); n.addRoad(5, 3); n.addRoad(5, 4);
    expect(n.connected({ x: 2, y: 2 }, { x: 5, y: 5 })).toBe(true);
  });

  it('removing a road disconnects a component (localized recompute)', () => {
    const n = new RoadNetwork(roadMap());
    // Bridge the two segments so they are one component
    n.addRoad(3, 2); n.addRoad(4, 2); n.addRoad(4, 3); n.addRoad(5, 3); n.addRoad(5, 4);
    expect(n.connected({ x: 1, y: 1 }, { x: 5, y: 5 })).toBe(true);
    // Remove the only bridge tile between them
    n.removeRoad(4, 2);
    expect(n.connected({ x: 1, y: 1 }, { x: 5, y: 5 })).toBe(false);
  });

  it('nodeCount tracks additions and removals', () => {
    const n = new RoadNetwork(roadMap());
    const before = n.nodeCount();
    n.addRoad(0, 0);
    expect(n.nodeCount()).toBe(before + 1);
    n.removeRoad(0, 0);
    expect(n.nodeCount()).toBe(before);
  });
});

describe('RoadNetwork multi-region disconnect/reconnect (ROAD-01)', () => {
  // 8x8 earth map with a left cluster near the origin, a right cluster far
  // right, and a far-away third region (single isolated tile) that must never
  // be absorbed into either cluster.
  function multiRegionMap(): Map {
    const m = new Map(8, 8, 'earth');
    // left cluster (3 connected tiles)
    m.set(1, 3, 'road'); m.set(2, 3, 'road'); m.set(1, 2, 'road');
    // right cluster (3 connected tiles)
    m.set(5, 3, 'road'); m.set(6, 3, 'road'); m.set(5, 4, 'road');
    return m;
  }

  const leftIn = { x: 1, y: 2 };
  const leftOut = { x: 2, y: 3 };
  const rightIn = { x: 6, y: 3 };
  const rightOut = { x: 5, y: 4 };
  const third = { x: 7, y: 0 };

  it('disconnected → bridged → cut → re-bridged with third-region isolation', () => {
    const n = new RoadNetwork(multiRegionMap());

    // (1) Before any bridge the clusters are disconnected.
    expect(n.connected(leftIn, rightOut)).toBe(false);
    expect(n.nodeCount()).toBe(6);

    // Place the far-away third region (isolated tile) — it stays its own island.
    n.addRoad(third.x, third.y);
    expect(n.connected(third, leftIn)).toBe(false);
    expect(n.connected(third, rightOut)).toBe(false);

    // (2) Add a single bridge row; (3,3) is the unique articulation tile that
    //     separates the clusters when removed.
    n.addRoad(3, 3);
    n.addRoad(4, 3);
    expect(n.connected(leftIn, rightOut)).toBe(true);

    // The dirty region after the bridge spans both clusters + new tiles, and
    // never colors the far-away third region.
    const bridgeDirty = n.affectedTiles();
    expect(bridgeDirty.length).toBeGreaterThanOrEqual(6);
    expect(bridgeDirty).not.toContainEqual(third);
    expect(n.connected(third, leftIn)).toBe(false);
    expect(n.connected(third, rightOut)).toBe(false);

    // (3) Cut the articulation tile.
    n.removeRoad(3, 3);
    expect(n.connected(leftIn, rightOut)).toBe(false);
    // Both halves stay internally connected.
    expect(n.connected(leftIn, leftOut)).toBe(true);
    expect(n.connected(rightIn, rightOut)).toBe(true);
    // The cut's dirty region is confined to the split component — the third
    // region is untouched.
    expect(n.affectedTiles()).not.toContainEqual(third);

    // (4) Reconnect by re-adding the articulation tile.
    n.addRoad(3, 3);
    expect(n.connected(leftIn, rightOut)).toBe(true);
    expect(n.connected(leftIn, leftOut)).toBe(true);
    expect(n.connected(rightIn, rightOut)).toBe(true);
    expect(n.affectedTiles()).not.toContainEqual(third);
  });

  it('a change confined to one cluster leaves the far region and the other cluster clean', () => {
    const n = new RoadNetwork(multiRegionMap());
    n.addRoad(third.x, third.y);
    n.addRoad(3, 3);
    n.addRoad(4, 3);

    // A change confined to the left cluster must not dirty the far third region.
    n.addRoad(0, 2); // adjacent to left cluster tile (1,2)
    expect(n.affectedTiles()).not.toContainEqual(third);
    // Left and right clusters are still separate components from the third.
    expect(n.connected(third, leftIn)).toBe(false);
    expect(n.connected(third, rightOut)).toBe(false);
  });
});
