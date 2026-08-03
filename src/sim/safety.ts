/**
 * Civil Safety (Phase 11 — tasks 8.1, 8.2, 8.3, 8.4).
 *
 * Fire, structural-collapse, and civil-order (crime) models. Factors raise
 * risk; services (fire station / prefecture / engineer post) reduce it. Every
 * civic service is peaceful: guards patrol and calm protests but never attack.
 * Self-contained, additive to the live sim.
 */

export interface BuildingRiskInput {
  /** Density / age factor 0..1. */
  density: number;
  /** Building age in months (older = higher collapse risk). */
  ageMonths: number;
  /** Fire coverage from stations (0..1). */
  fireCoverage: number;
  /** Engineer/inspection coverage (0..1). */
  engineerCoverage: number;
  /** Security/patrol coverage (0..1). */
  securityCoverage: number;
}

export interface RiskModel {
  fireRisk: number;
  collapseRisk: number;
  crime: number;
  damaged: boolean;
}

/** Combine factors into fire / collapse / crime risk scores in 0..1. */
export function computeRisks(i: BuildingRiskInput): RiskModel {
  const densityClamped = Math.max(0, Math.min(1, i.density));
  const ageFactor = Math.min(1, i.ageMonths / 120);
  // Fire risk rises with density, falls with fire coverage.
  const fireRisk = Math.max(0, Math.min(1, densityClamped * 0.7 + 0.1 - i.fireCoverage * 0.6));
  // Collapse rises with age, reduced by engineer inspections.
  const collapseRisk = Math.max(0, Math.min(1, ageFactor * 0.8 + densityClamped * 0.2 - i.engineerCoverage * 0.7));
  // Crime rises with unemployment/density proxy, reduced by security.
  const crime = Math.max(0, Math.min(1, densityClamped * 0.5 + 0.05 - i.securityCoverage * 0.8));
  return {
    fireRisk,
    collapseRisk,
    crime,
    damaged: collapseRisk > 0.8 || fireRisk > 0.9,
  };
}

export type FirePhase = 'none' | 'burning' | 'evacuating' | 'destroyed';

/** Advance the fire lifecycle one tick. */
export function tickFire(phase: FirePhase, hazard: number, brigadeResponse: number): FirePhase {
  if (phase === 'none') {
    return hazard > 0.85 ? 'burning' : 'none';
  }
  if (phase === 'burning') {
    return brigadeResponse >= 0.5 ? 'none' : 'evacuating';
  }
  if (phase === 'evacuating') {
    return 'destroyed';
  }
  return 'destroyed';
}

/**
 * Urban guard patrol (task 8.3): guards calm protests and protect citizens —
 * they never attack anyone. Returns whether calm was restored.
 */
export function guardPatrol(protestLevel: number, guardStrength: number): { calmed: boolean; protestLevel: number } {
  const level = Math.max(0, protestLevel - guardStrength);
  return { calmed: level < protestLevel, protestLevel: level };
}
