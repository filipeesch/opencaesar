import { describe, it, expect } from 'vitest';
import { Map as SimMap } from '../../src/sim/map';
import { mulberry32 } from '../../src/sim/rng';
import { SimRunner } from '../../src/sim/runner';
import type { BuildingInstance, SimInternals } from '../../src/sim/walkers';
import { createWalker, updateWalker } from '../../src/sim/walkers';

function makeStub(map: SimMap, buildings: BuildingInstance[], rngSeed = 7): SimInternals {
  const byId = new Map(buildings.map((b) => [b.id, b]));
  return {
    map,
    rng: mulberry32(rngSeed),
    buildings,
    buildingById: (id) => byId.get(id) ?? null,
    buildingAt: () => null,
    adjacentRoadTile: () => null,
    despawn: () => {},
  };
}

describe('walkers vs service_roadblocks: no 0-speed freeze (WR-02)', () => {
  it('a stop-walker standing on a service_roadblock advances and leaves (no 0-speed freeze)', () => {
    // WR-02 repro: a 'stop' walker spawned on a block it cannot traverse used to
    // get a 0 speed multiplier forever, freezing it with progress stuck at 0.
    // The 0 multiplier must block *entry*, not *exit*: it must be able to leave.
    const m = new SimMap(4, 2, 'earth');
    m.set(0, 0, 'road');
    m.set(1, 0, 'road');
    m.setRoadType(0, 0, 'service_roadblock'); // walker starts ON the block
    const sim = makeStub(m, []);
    const w = createWalker('well', 0, 0, 1);

    let sawProgress = false;
    let left = false;
    for (let i = 0; i < 20; i++) {
      updateWalker(sim, w);
      if (w.progress > 0) sawProgress = true;
      if (w.x === 1 && w.y === 0) {
        left = true;
        break;
      }
    }
    expect(sawProgress).toBe(true); // progress advanced — not stuck at 0 forever
    expect(left).toBe(true); // and it walked off the block onto traversable road
  });

  it('stop-walkers never spawn onto (or occupy) a service_roadblock they cannot cross', () => {
    // A house flush against a roadblock-typed road plus a traversable road. The
    // spawn path must skip the non-traversable block and put the labor walker
    // on the traversable road instead (never on the block, never frozen).
    const m = SimMap.fromLayout(6, 6, (x, y) => {
      if (x === 1 && y === 0) return 'road'; // top road — service_roadblock
      if (x === 0 && (y === 1 || y === 2)) return 'road'; // left road — traversable
      return 'earth';
    });
    m.setRoadType(1, 0, 'service_roadblock');
    const r = new SimRunner(7, m);
    r.placeBuilding('house', 1, 1); // footprint 1; adjacent tiles (1,0) and (0,1)

    let sawLabor = false;
    let sawProgress = false;
    for (let i = 0; i < 30; i++) {
      r.tick();
      for (const w of r.getState().walkers) {
        expect(`${w.x},${w.y}`).not.toBe('1,0'); // never occupies the block it can't cross
        if (w.type === 'labor') sawLabor = true; // the spawn path was exercised
        if (w.progress > 0) sawProgress = true; // and the walker actually moves
      }
    }
    expect(sawLabor).toBe(true); // house spawned at least one labor walker
    expect(sawProgress).toBe(true); // none was frozen at progress 0
  });
});
