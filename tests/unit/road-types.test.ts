import { describe, it, expect } from 'vitest';
import { ROAD_TYPES, roadTypeName, roadSpeedMultiplier, roadDesirability, isRoadPassable } from '../../src/sim/roadTypes';

describe('road types (ROAD-02)', () => {
  it('covers all seven road types', () => {
    expect(Object.keys(ROAD_TYPES).sort()).toEqual(
      ['bridge', 'dirt', 'paved', 'plaza', 'service_roadblock', 'stairs', 'wharf_access'].sort(),
    );
  });

  it('paved roads are faster than dirt; plazas add desirability', () => {
    expect(roadSpeedMultiplier('paved')).toBeGreaterThan(roadSpeedMultiplier('dirt'));
    expect(roadDesirability('plaza')).toBeGreaterThan(roadDesirability('dirt'));
  });

  it('service roadblocks block walkers', () => {
    expect(isRoadPassable('service_roadblock')).toBe(false);
    expect(isRoadPassable('dirt')).toBe(true);
  });

  it('resolves unknown types to neutral defaults', () => {
    expect(roadTypeName('nope')).toBe('Road');
    expect(roadSpeedMultiplier('nope')).toBe(1);
  });
});
