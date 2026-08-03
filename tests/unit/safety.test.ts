import { describe, it, expect } from 'vitest';
import { computeRisks, tickFire, guardPatrol } from '../../src/sim/safety';

describe('civil safety (Phase 11)', () => {
  it('fire risk rises with density and falls with coverage', () => {
    const high = computeRisks({ density: 1, ageMonths: 0, fireCoverage: 0, engineerCoverage: 0, securityCoverage: 0 });
    const protected_ = computeRisks({ density: 1, ageMonths: 0, fireCoverage: 1, engineerCoverage: 0, securityCoverage: 0 });
    expect(high.fireRisk).toBeGreaterThan(protected_.fireRisk);
  });

  it('collapse risk rises with age and drops with engineer coverage', () => {
    const old = computeRisks({ density: 0, ageMonths: 200, fireCoverage: 0, engineerCoverage: 0, securityCoverage: 0 });
    const inspected = computeRisks({ density: 0, ageMonths: 200, fireCoverage: 0, engineerCoverage: 1, securityCoverage: 0 });
    expect(old.collapseRisk).toBeGreaterThan(inspected.collapseRisk);
  });

  it('crime drops with security coverage', () => {
    const noSecurity = computeRisks({ density: 1, ageMonths: 0, fireCoverage: 0, engineerCoverage: 0, securityCoverage: 0 });
    const secured = computeRisks({ density: 1, ageMonths: 0, fireCoverage: 0, engineerCoverage: 0, securityCoverage: 1 });
    expect(noSecurity.crime).toBeGreaterThan(secured.crime);
  });

  it('fire lifecycle advances to destruction without response, extinguishes with response', () => {
    expect(tickFire('burning', 0.9, 0)).toBe('evacuating');
    expect(tickFire('evacuating', 0.9, 0)).toBe('destroyed');
    expect(tickFire('burning', 0.9, 0.8)).toBe('none');
  });

  it('guards calm protests and never attack (reduce level only)', () => {
    const r = guardPatrol(5, 3);
    expect(r.calmed).toBe(true);
    expect(r.protestLevel).toBe(2);
  });
});
