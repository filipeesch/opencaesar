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

  it('adding a road bridges two components (localized recompute)', () => {
    const n = new RoadNetwork(roadMap());
    expect(n.connected({ x: 2, y: 2 }, { x: 5, y: 5 })).toBe(false);
    n.addRoad(4, 3); // connects via (2,2)-(4,3)? no: not adjacent. Use a genuine bridge:
    // Actually bridge must be adjacent to both segments; let's bridge at (2,5) chain.
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

  it('exposes the affected/dirty set for the localized region', () => {
    const n = new RoadNetwork(roadMap());
    n.addRoad(0, 0);
    expect(n.affectedTiles()).toEqual([{ x: 0, y: 0 }]);
  });
