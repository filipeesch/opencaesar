/**
 * Deterministic housing merge pure transform (Phase 16, HOUS-02).
 *
 * NOTE: Wave-1 placeholder delivered with the 16-01-01 tracer so the Wave-0
 * merge scaffold (tests/unit/housing-merge.test.ts) compiles and stays RED.
 * The full implementation — targetFootprint (the merge ladder),
 * findMergePartner (fixed placement-order same-level scan), blockFits (the
 * injected-predicate n x n square check, placement.ts style), and mergeProposal
 * (survivor/absorbed/footprint) — lands in task 16-02-01. It is replaced in
 * that commit, never shipped.
 *
 * Pure, side-effect-free, deterministic: no RNG, no wall-clock.
 */
import type { BuildingInstance } from './walkers';

/** Placeholder: the true footprint ladder is added with data/housing.ts in 16-02-01. */
export function targetFootprint(level: number): number {
  void level;
  return 1;
}

/** Placeholder: real fixed-scan same-level adjacency search lands in 16-02-01. */
export function findMergePartner(_a: BuildingInstance, _buildings: readonly BuildingInstance[]): BuildingInstance | null {
  return null;
}

/** Placeholder: real injected-predicate square check lands in 16-02-01. */
export function blockFits(..._args: unknown[]): boolean {
  return false;
}

/** Placeholder: real survivor/absorbed proposal lands in 16-02-01. */
export function mergeProposal(..._args: unknown[]): { survivor: BuildingInstance; absorbed: BuildingInstance; footprint: number } | null {
  return null;
}
