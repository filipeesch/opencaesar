import { describe, it, expect } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { desirabilityOf } from '../../src/sim/housing';
import { Map as SimMap } from '../../src/sim/map';
import { mulberry32 } from '../../src/sim/rng';
import { roadDesirability, roadSpeedMultiplier } from '../../src/sim/roadTypes';
import type { SimInternals } from '../../src/sim/walkers';
import { createWalker, updateWalker } from '../../src/sim/walkers';

function roadStrip(paved: boolean): SimMap {
  const m = new SimMap(8, 8, 'earth');
  m.set(0, 0, 'road');
  m.set(1, 0, 'road');
  if (paved) m.setRoadType(0, 0, 'paved');
  return m;
}

function makeStub(map: SimMap): SimInternals {
  const sim: SimInternals = {
    map,
    rng: mulberry32(7),
    buildings: [],
    buildingById: () => null,
    buildingAt: () => null,
    adjacentRoadTile: () => null,
    despawn: () => {},
  };
  return sim;
}

describe('road-type effects (ROAD-02)', () => {
  it('walkers on a paved road tile move faster than on dirt/bare road', () => {
    // Bare 'road' terrain reads as dirt (1x) — no speed delta.
    const plain = createWalker('well', 0, 0, 1);
    const simPlain = makeStub(roadStrip(false));
    updateWalker(simPlain, plain);
    expect(plain.progress).toBeCloseTo(CONFIG.walkerSpeedPerTick * roadSpeedMultiplier('dirt'), 10);
    expect(plain.progress).toBeCloseTo(CONFIG.walkerSpeedPerTick, 10);

    // Paved tile: 0.5 * 1.25 per tick, strictly faster than the dirt case.
    const paved = createWalker('well', 0, 0, 2);
    const simPaved = makeStub(roadStrip(true));
    updateWalker(simPaved, paved);
    expect(paved.progress).toBeCloseTo(CONFIG.walkerSpeedPerTick * roadSpeedMultiplier('paved'), 10);
    expect(paved.progress).toBeGreaterThan(plain.progress);
  });

  it('house desirability gains adjacent road-type desirability (plaza +4, roadblock +0)', () => {
    const policy = { taxRate: 0, wageRate: 0 };
    const map = new SimMap(8, 8, 'earth');
    // House tile at (3,3) with no road neighbors: plain earth baseline.
    expect(desirabilityOf(map, 3, 3, policy, false)).toBe(30);

    // Non-orthogonal neighbor contributes nothing.
    map.set(4, 4, 'road');
    map.setRoadType(4, 4, 'plaza');
    expect(desirabilityOf(map, 3, 3, policy, false)).toBe(30);

    // Orthogonal plaza road adds roadDesirability('plaza') = +4.
    map.set(2, 3, 'road');
    map.setRoadType(2, 3, 'plaza');
    expect(desirabilityOf(map, 3, 3, policy, false)).toBe(30 + roadDesirability('plaza'));
    expect(roadDesirability('plaza')).toBe(4);

    // A bare orthogonal road adds nothing (dirt = 0).
    map.set(3, 4, 'road');
    map.setRoadType(3, 4, null);
    expect(desirabilityOf(map, 3, 3, policy, false)).toBe(30 + roadDesirability('plaza'));

    // A service_roadblock neighbor contributes its (0) desirability.
    map.set(3, 2, 'road');
    map.setRoadType(3, 2, 'service_roadblock');
    expect(desirabilityOf(map, 3, 3, policy, false)).toBe(30 + roadDesirability('plaza'));
    expect(roadDesirability('service_roadblock')).toBe(0);
  });
});
