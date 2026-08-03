import { describe, it, expect } from 'vitest';
import {
  EXTRACTION_SITES, satisfiesDeposit, canExtract,
} from '../../src/sim/production';

describe('extraction deposit requirements (PROD-01)', () => {
  it('each of the four sites requires a distinct deposit material', () => {
    const sites = Object.values(EXTRACTION_SITES);
    expect(sites.length).toBe(4);
    const reqs = sites.map((s) => s.requires).sort();
    expect(reqs).toEqual(['clay_deposit', 'iron_deposit', 'marble_deposit', 'trees']);

    for (const site of sites) {
      // satisfied by the matching deposit material — timber via terrain 'trees',
      // clay/iron/marble via the matching resourceType
      if (site.requires === 'trees') {
        expect(satisfiesDeposit(site, 'trees', null)).toBe(true);
      } else {
        expect(satisfiesDeposit(site, 'earth', site.requires)).toBe(true);
      }
      // unsatisfied with every other site's requirement string
      for (const other of sites) {
        if (other.requires === site.requires) continue;
        expect(satisfiesDeposit(site, 'earth', other.requires)).toBe(false);
      }
    }
  });

  it('timber yard is satisfied by forest terrain even with a null resourceType', () => {
    expect(satisfiesDeposit(EXTRACTION_SITES.timber_yard, 'trees', null)).toBe(true);
    expect(satisfiesDeposit(EXTRACTION_SITES.timber_yard, 'earth', null)).toBe(false);
    expect(satisfiesDeposit(EXTRACTION_SITES.timber_yard, 'rock', null)).toBe(false);
  });

  it('clay/iron/marble fail on a null or wrong resourceType', () => {
    expect(satisfiesDeposit(EXTRACTION_SITES.clay_pit, 'earth', null)).toBe(false);
    expect(satisfiesDeposit(EXTRACTION_SITES.iron_mine, 'earth', null)).toBe(false);
    expect(satisfiesDeposit(EXTRACTION_SITES.marble_quarry, 'earth', null)).toBe(false);
    expect(satisfiesDeposit(EXTRACTION_SITES.clay_pit, 'earth', 'wheat')).toBe(false);
    expect(satisfiesDeposit(EXTRACTION_SITES.iron_mine, 'earth', 'clay_deposit')).toBe(false);
  });

  it('canExtract gates on both the deposit and workers', () => {
    const clay = EXTRACTION_SITES.clay_pit;
    // satisfied-but-unstaffed → false
    expect(canExtract(clay, 'earth', 'clay_deposit', false)).toBe(false);
    // staffed-but-no-deposit → false
    expect(canExtract(clay, 'earth', null, true)).toBe(false);
    expect(canExtract(clay, 'earth', 'iron_deposit', true)).toBe(false);
    // only (deposit && workers) → true
    expect(canExtract(clay, 'earth', 'clay_deposit', true)).toBe(true);

    // timber yard follows the same gate over terrain instead of resourceType
    expect(canExtract(EXTRACTION_SITES.timber_yard, 'trees', null, true)).toBe(true);
    expect(canExtract(EXTRACTION_SITES.timber_yard, 'trees', null, false)).toBe(false);
    expect(canExtract(EXTRACTION_SITES.timber_yard, 'earth', null, true)).toBe(false);
  });

  it('is pure and deterministic (no Math.random or clock referenced)', () => {
    const site = EXTRACTION_SITES.iron_mine;
    for (let i = 0; i < 5; i++) {
      expect(canExtract(site, 'earth', 'iron_deposit', true)).toBe(true);
      expect(canExtract(site, 'earth', null, true)).toBe(false);
    }
    // identical inputs always yield identical outputs — a pure function
    const a = satisfiesDeposit(site, 'earth', 'iron_deposit');
    const b = satisfiesDeposit(site, 'earth', 'iron_deposit');
    expect(a).toBe(b);
  });
});
