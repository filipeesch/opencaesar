---
phase: 04-water-system
reviewed: 2026-08-03T13:46:00Z
fixed: 2026-08-03T14:05:00Z
status: all_fixed
findings_in_scope: 6
fixed: 6
skipped: 0
iteration: 1
---

# Phase 04: Code Review Fix Report

**Fixing findings from:** 04-REVIEW.md (3 warnings + 3 info)
**Status:** all_fixed

## Findings

| ID | Severity | Finding | Fix | Verification |
|----|----------|---------|-----|--------------|
| WR-01 | warning | `waterOverlayData` reservoir paint (src/sim/advisors.ts) writes `[y][x]` for `y in [r.y, r.y+size)`, `x in [r.x, r.x+size)` with no bounds clamp — an edge-overhanging footprint extends a row into a sparse array (x) or throws `TypeError` (y) | Clamp loops to `Math.min(r.y + r.size, height)` / `Math.min(r.x + r.size, width)` so painted reservoir grids stay in-bounds | Commit `a7a6551`; new unit test `advisors.test.ts` "clamps an edge-overhanging reservoir footprint to the map bounds without crashing (WR-01)" paints a 3×3 footprint at (4,4) on a 5×5 map (overhangs both edges): no crash, only in-bounds tile (4,4) painted, every row keeps full dense width |
| WR-02 | warning | Three `desirability` surfaces (well/fountain accumulative ±4, baths `Math.max(...,4)`, house 0..200) and two `wellness` surfaces with incompatible accumulation semantics and no defined merge — latent double-count at Phase 18 | Define and document ONE merge contract in src/sim/water.ts: exported `mergeWaterDesirability(base, apply)` — additive-with-natural-cap, clamped to the documented `[WATER_DESIRABILITY_MIN, WATER_DESIRABILITY_MAX]` band; `WaterSystem.compute` now feeds every well/fountain delta through it so surfaces compose deterministically; bath wellness/desirability documented as non-accumulative `Math.max` coverage | Commit `330fb2a`; new tests `water.test.ts` "composes an overlapping well + fountain + bath tile additively, with no double-count" (asserts merged[2][2] = 4, well penalty −4 preserved off-bath) and "clamps accumulated deltas to the documented additive-with-natural-cap band" |
| WR-03 | warning | Pre-existing flake: `military-absence.test.ts` writes `src/__military_probe__.ts` while `balance-parity.test.ts` snapshots `src/**/*.ts`, so the transient probe path can be read after deletion (ENOENT) under vitest parallelism | Move the probe to an OS temp dir (`mkdtempSync` + `tmpdir()`, not `src/`); `scanMilitarySources(extraPaths?)` in scripts/check-military.mjs accepts extra roots (`.d.mts` updated) | Commit `0042f28`; the two files run together 3× — 11/11 passed each run; full suite stable across repeated runs |
| IN-01 | info | Magic numbers 1/4 in `computeBathCoverage`, colliding with well/fountain constants | Export `BATH_WELLNESS_BONUS = 1` and `BATH_DESIRABILITY_BONUS = 4`; reference them in `computeBathCoverage` | Commit `330fb2a`; existing baths tests still assert 4/1 (unchanged semantics) |
| IN-02 | info | Unreachable `grand` water class mapping (advisors.ts `WATER_CLASS_VALUE.grand = 3`, never produced) | Document as the reserved forward contract for an aqueduct-served "grand water" upgrade — commented at the `WaterClass` type and the overlay mapping; kept in the union | Commit `330fb2a`; no behavioral change, overlay still reads at most 2 |
| IN-03 | info | No validation of negative `radius` / negative `waterCostPerTick` on resolvers | `resolveFountainActivity` and `resolveBaths` clamp radius to `Math.max(0, radius)`; `resolveBaths` clamps cost via `Math.max(0, waterCostPerTick ?? BATH_DEFAULT_WATER_COST)` | Commit `330fb2a`; new tests `baths.test.ts` "clamps a negative radius to 0 and never lets a negative water cost add water (IN-03)" and `fountain.test.ts` "treats a negative fountain radius as 0" |

## Accepted / Deferred

None — all 6 findings fixed in this pass. No findings accepted or deferred.

## Verification (actual counts)

- `npm run test` → **56 files, 346 passed (346)** (baseline 341 + 5 new tests across WR-01/02/03 and IN-03). Stable across 3 full runs; no flake after the WR-03 probe move.
- `npm run typecheck` → **clean** (exit 0).
- `npm run lint` → **clean** (exit 0, `eslint src --max-warnings 0`).
- `npm run check:military` → **clean** ×3 (no forbidden military tokens). Note: the probe now lives in an OS temp dir and is passed to the scanner via `extraPaths`, so the standalone gate over `src/`/`data/` is unchanged.

## Fix Commits

- `a7a6551` fix(04): clamp reservoir footprint overlay paint to map bounds (WR-01)
- `330fb2a` fix(04): single additive-with-cap water desirability merge + resolver input hygiene (WR-02, IN-01..03)
- `0042f28` fix(04): move military probe to an OS temp dir to remove parallel-test race (WR-03)

REVIEW.md itself is intentionally not committed, and REVIEW-FIX.md is left for the orchestrator to commit.

---
_Fixed: 2026-08-03T14:05:00Z_
_Fixer: gsd-code-fixer (auto mode)_
