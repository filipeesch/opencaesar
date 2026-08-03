import { describe, it, expect } from 'vitest';
import { walkerCategory, walkerProfile, allWalkerProfiles } from '../../src/sim/walkerProfiles';

describe('walker categories & profiles (ROAD-03)', () => {
  it('classifies walkers as wandering/destination/recruiter', () => {
    expect(walkerCategory('market')).toBe('destination');
    expect(walkerCategory('well')).toBe('wandering');
    expect(walkerCategory('official')).toBe('recruiter');
  });

  it('returns a complete profile with movement/road data defaults', () => {
    const p = walkerProfile('doctor');
    expect(p.category).toBe('wandering');
    expect(p.maxRoadSteps).toBeGreaterThan(0);
    expect(p.serviceTTL).toBeGreaterThan(0);
    expect(p.movementSpeed).toBe(0.5);
    expect(p.allowedRoadTypes).toContain('dirt');
    expect(p.roadblockPolicy).toBeTruthy();
    expect(p.returnPolicy).toBe(true);
  });

  it('covers every catalog walker', () => {
    const ids = allWalkerProfiles().map((p) => p.id);
    expect(ids).toContain('well');
    expect(ids).toContain('senator');
    expect(ids.length).toBeGreaterThan(5);
  });
});
