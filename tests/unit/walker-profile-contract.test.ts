import { describe, it, expect } from 'vitest';
import { WALKERS } from '../../data/walkers';
import { ROAD_TYPES } from '../../src/sim/roadTypes';
import { allWalkerProfiles, walkerCategory } from '../../src/sim/walkerProfiles';

const PROFILE_KEYS = [
  'maxRoadSteps',
  'serviceTTL',
  'spawnInterval',
  'movementSpeed',
  'allowedRoadTypes',
  'roadblockPolicy',
  'serviceRadiusFromCurrentTile',
  'preferredDirection',
  'returnPolicy',
];

describe('WalkerProfile schema contract (ROAD-03)', () => {
  it('every catalog walker has a profile exposing all nine ROAD-03 fields', () => {
    const profiles = allWalkerProfiles();
    expect(profiles.length).toBe(Object.keys(WALKERS).length);
    for (const p of profiles) {
      for (const key of PROFILE_KEYS) {
        expect(Object.prototype.hasOwnProperty.call(p, key), `${p.id} missing profile field ${key}`).toBe(true);
      }
    }
  });

  it('per-type field values are typed, finite, and in range', () => {
    for (const p of allWalkerProfiles()) {
      expect(Number.isInteger(p.maxRoadSteps), `${p.id} maxRoadSteps`).toBe(true);
      expect(p.maxRoadSteps).toBeGreaterThan(0);
      expect(Number.isInteger(p.serviceTTL), `${p.id} serviceTTL`).toBe(true);
      expect(p.serviceTTL).toBeGreaterThan(0);
      expect(Number.isInteger(p.spawnInterval), `${p.id} spawnInterval`).toBe(true);
      expect(p.spawnInterval).toBeGreaterThan(0);
      expect(Number.isFinite(p.movementSpeed), `${p.id} movementSpeed`).toBe(true);
      expect(p.movementSpeed).toBeGreaterThan(0);
      expect(p.allowedRoadTypes.length).toBeGreaterThan(0);
      for (const t of p.allowedRoadTypes) {
        expect(Object.keys(ROAD_TYPES), `${p.id} allowedRoadTypes entry ${t}`).toContain(t);
      }
      expect(p.roadblockPolicy === 'stop' || p.roadblockPolicy === 'pass', `${p.id} roadblockPolicy`).toBe(true);
      expect(Number.isFinite(p.serviceRadiusFromCurrentTile), `${p.id} serviceRadiusFromCurrentTile`).toBe(true);
      expect(p.serviceRadiusFromCurrentTile).toBeGreaterThanOrEqual(0);
      expect(['left', 'right', 'straight']).toContain(p.preferredDirection);
      expect(typeof p.returnPolicy).toBe('boolean');
    }
  });

  it('covers all three categories with recruiter spawn interval 60', () => {
    const profiles = allWalkerProfiles();
    expect(profiles.some((p) => p.category === 'wandering')).toBe(true);
    expect(profiles.some((p) => p.category === 'destination')).toBe(true);
    expect(profiles.some((p) => p.category === 'recruiter')).toBe(true);
    for (const p of profiles.filter((p) => p.category === 'recruiter')) {
      expect(p.spawnInterval).toBe(60);
    }
    expect(walkerCategory('market')).toBe('destination');
    expect(walkerCategory('official')).toBe('recruiter');
  });
});
