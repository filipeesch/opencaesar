---
phase: 11-civil-safety
status: passed
method: automated
completed: "2026-08-04"
---

# Phase 11 Verification Report: Civil Safety

## Success Criteria → Must-Haves

Extracted from `.planning/phases/11-civil-safety/11-VALIDATION.md`:

| # | Must-have | How verified | Result |
|---|-----------|--------------|--------|
| SC1 | Buildings catch fire | fire-service.test.ts: unprotected dense block → destroyed tiles (fire 1.0) during seeded fire events | ✅ passed |
| SC1 | Firemen extinguish fires | fire-service.test.ts: with a nearby station, 0.9→0 transitions (fireman douse) and fewer destroyed buildings than unprotected | ✅ passed |
| SC1 | Fire risk rises with density | fire-service.test.ts + safety.test.ts: computeRisks density ↑ → fireRisk ↑ | ✅ passed |
| SC1 | Fire coverage lowers risk | fire-service.test.ts: covering station → maxFire 0 over 1000 ticks (no ignition) | ✅ passed |
| SC2 | Aging/event buildings risk collapse | collapse.test.ts: computeRisks age ↑ → collapseRisk ↑; earthquake@799 → danger appears | ✅ passed |
| SC2 | Danger states shown | collapse.test.ts + civilization-overlay.test.ts: danger grid 1 on dangerous footprints, persists until repaired | ✅ passed |
| SC2 | Engineers repair | collapse.test.ts: engineer_post → cleared ≥ 1, final danger count < control | ✅ passed |
| SC3 | Prefecture/marshal reduce crime | security.test.ts: prefecture covering → crime ≤ 0.01; marshal patrol → bottom-row calm < 0.1 vs 0.196 baseline | ✅ passed |
| SC3 | Civilization overlay reflects it | civilization-overlay.test.ts: 4 grids sized to map, footprints painted, destroyed → fire 1 + danger 1, crime reflects coverage | ✅ passed |
| — | Determinism | safety-determinism.test.ts: chunks 1/7/50 byte-identical (state + overlay); no-RNG/clock audit | ✅ passed |
| — | No military tokens | npm run check:military clean (marshal patrols are peaceful) | ✅ passed |
| — | Goldens stay byte-identical | golden.test.ts + food-slice.test.ts green, no regeneration | ✅ passed |

## Status

**PASSED** — all must-haves verified with automated evidence.

- Tests: 663 passed / 95 files (baseline 642 / 90 → +21 / +5)
- Typecheck: clean; Lint: clean; `check:military`: clean
- Goldens: unchanged, no regeneration required (`SimState` frozen)
