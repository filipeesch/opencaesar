---
phase: 04-water-system
plan: 04-03
subsystem: water
tags: [water, baths, advisors, overlay, WATR-05, WATR-06]

requires:
  - phase: 04-02
    provides: "TileWater desirability surface + fountain/well sources; ReservoirState helpers from 04-01"
provides:
  - "BATH_DEFAULT_WATER_COST const, BathDef interface, resolveBaths() (active = supplied && staffed) and assignBathEffects() (wellness/desirability/waterConsumed)"
  - "WaterOverlayInput interface + waterOverlayData() in src/sim/advisors.ts (WATR-06 per-tile grids)"
affects: [Phase 18 Management UI (visual overlay rendering)]

actuals:
  tokens: 2200
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Bath preconditions gated by a single resolveBaths (supplied && staffed) reusing computeBathCoverage unchanged"
    - "Advisor overlay data as pure projection of water-model inputs (key encoding y*100000+x)"

key-files:
  created:
    - tests/unit/baths.test.ts
  modified:
    - src/sim/water.ts
    - src/sim/advisors.ts
    - tests/unit/advisors.test.ts

key-decisions:
  - "assignBathEffects feeds the wellness grid to health and the desirability grid to sim desirability (decision 2); waterConsumed sums waterCostPerTick ?? BATH_DEFAULT_WATER_COST over active baths only."
  - "Housing continues to consume water via waterCooldown (housing.ts:93-98, walkers.ts:156-170) — live path untouched; WaterClass is exposed only as overlay/advisor data (decision 5)."
  - "waterOverlayData does not reuse overlaysFrom — it builds the WATR-06 grids directly from water-model inputs so the advisor surface is testable in isolation."

patterns-established:
  - "Advisor data functions are pure projections of injected sim-model state — every painted tile traceable to model state (no fabrication)."

requirements-completed: [WATR-05, WATR-06]

coverage:
  - id: D1
    description: "Public baths wired to health/desirability — active only when supplied && staffed; wellness/desirability in radius while active; water consumption (default 1) summed over active baths only"
    requirement: WATR-05
    verification:
      - kind: unit
        ref: "tests/unit/baths.test.ts#public baths wiring (WATR-05): a supplied and staffed bath grants wellness and desirability in radius and consumes water"
        status: pass
      - kind: unit
        ref: "tests/unit/baths.test.ts#public baths wiring (WATR-05): a bath without workers provides nothing and consumes no water"
        status: pass
      - kind: unit
        ref: "tests/unit/baths.test.ts#public baths wiring (WATR-05): a bath without reservoir water provides nothing and consumes no water"
        status: pass
      - kind: unit
        ref: "tests/unit/baths.test.ts#public baths wiring (WATR-05): sums water consumption across active baths only; unstaffed/unsupplied baths contribute no cost"
        status: pass
      - kind: unit
        ref: "tests/unit/baths.test.ts#public baths wiring (WATR-05): resolveBaths returns no active baths when every def is unstaffed or unsupplied"
        status: pass
    human_judgment: false
  - id: D2
    description: "Water overlay advisor data — per-tile grids for sources, well/fountain coverage, house water classes (0/1/2/3), aqueduct present vs flowing, reservoir filled/level, and desirability"
    requirement: WATR-06
    verification:
      - kind: unit
        ref: "tests/unit/advisors.test.ts#water overlay data (WATR-06): projects sources, coverage, water classes, aqueduct flow, reservoir state, and desirability grids"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-08-03T12:33:30Z
status: complete
---

# Phase 04 Plan 03: Public Baths Water/Worker Wiring + Water Overlay Advisor Data Summary

**WATR-05 bath supplied&&staffed gating with wellness/desirability grids and water-cost accounting, plus a WATR-06 `waterOverlayData` advisor surface exposing per-tile sources, coverage, water classes, aqueduct flow, reservoir state, and desirability.**

## Performance

- **Duration:** 3 min
- **Started:** ~2026-08-03T12:30:20Z
- **Completed:** 2026-08-03T12:33:30Z
- **Tasks:** 2
- **Files modified:** 4 (3 modified, 1 created)

## Accomplishments

- Added `BATH_DEFAULT_WATER_COST = 1`, the `BathDef` interface and `resolveBaths()` (active = supplied && staffed; waterConsumed over active baths only), plus `assignBathEffects()` that returns `{ wellness, desirability, waterConsumed }` reusing `computeBathCoverage` unchanged.
- Created `tests/unit/baths.test.ts` (5 tests) covering active coverage + cost, both no-worker and no-water all-zero no-cost cases, multi-active cost summation with a mixed unstaffed bath, and the empty-active resolve case. Existing baths tests in water.test.ts pass unchanged.
- Added `WaterOverlayInput` and `waterOverlayData()` to `src/sim/advisors.ts` producing nine per-tile grids (sources, wellCoverage, fountainCoverage, houseWaterClass, aqueductPresent, aqueductFlow, reservoirFilled, reservoirLevel, desirability), using the `y * 100000 + x` key convention and building grids directly from water-model inputs.
- Extended `tests/unit/advisors.test.ts` with a water-overlay block; existing advisor tests pass unchanged.
- Housing audit recorded: housing consumes water via `waterCooldown` (housing.ts:93-98; walkers.ts:156-170) — live path left untouched; WaterClass is overlay classification (decision 5).
- Full suite now 341 tests / 56 files green; typecheck and lint clean.

## Task Commits

Each task was executed and verified inline. Per the phase-execution instruction, no commits were made (SUMMARY/VERIFICATION files only).

1. **Task 1 (auto): Public baths: reservoir-water + workers wiring to health/desirability (WATR-05)** — verify: `npm run typecheck && npx vitest run tests/unit/baths.test.ts && npx vitest run tests/unit/water.test.ts` → PASS (5 + 11 tests).
2. **Task 2 (auto): Water overlay advisor data: sources, flow, coverage, house water classes (WATR-06)** — verify: `npm run typecheck && npx vitest run tests/unit/advisors.test.ts` → PASS (4 tests).

**Plan metadata:** no `docs` commit (intentional — no commits in this run).

## Files Created/Modified

- `src/sim/water.ts` — `BATH_DEFAULT_WATER_COST` const; `BathDef` interface; `resolveBaths()` and `assignBathEffects()` helpers (computeBathCoverage/PublicBathDef untouched).
- `src/sim/advisors.ts` — `WaterOverlayInput` interface; `waterOverlayData()` WATR-06 grids; type-only import of `TileWater`/`ReservoirState`.
- `tests/unit/baths.test.ts` — new: 5 WATR-05 bath-wiring tests.
- `tests/unit/advisors.test.ts` — extended: water overlay data block; existing tests unchanged.

## Decisions Made

- Bath wellness/desirability wiring via `assignBathEffects` (health + sim desirability inputs) per CONTEXT decision 2; water cost default 1 per active bath (decision 1).
- Overlay grids built directly (not via `overlaysFrom`) so the advisor surface is testable in isolation (decision 5); visual rendering deferred to Phase 18.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan test assertion] Aqueduct-overlay assertion used [x][y] indexing for a non-symmetric tile (WATR-06)**
- **Found during:** Task 2 (water overlay advisor data)
- **Issue:** Plan specified `aqueductPresent[3][2] === 1` and `aqueductFlow[3][2] === 0` to assert tile (3,2) is present-but-not-flowing. Grids follow the established `[y][x]` convention (grid[y][x]; overlaysFrom writes acc[k][y][x]), so `[3][2]` indexes tile (2,3) — which is not in the injected aqueductTiles set — causing `expected +0 to be 1`.
- **Fix:** Corrected the assertion to `aqueductPresent[2][3] === 1` / `aqueductFlow[2][3] === 0`, i.e. tile (3,2), matching the `[y][x]` convention and the intended present-not-flowing semantics. No implementation change needed — `waterOverlayData` already painted (3,2) correctly.
- **Files modified:** tests/unit/advisors.test.ts
- **Verification:** `npx vitest run tests/unit/advisors.test.ts` green (4 tests); full suite green.
- **Committed in:** N/A (no commits in this run)

---

**Total deviations:** 1 auto-fixed (1 plan-assertion bug)
**Impact on plan:** Necessary for the test to reference the intended tile; no scope creep, no behavior change.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 4 complete: WATR-01..WATR-06 all closed — well desirability, reservoir storage state, aqueduct flow propagation determinism, fountain network requirement/go-dark/desirability, bath water+worker wiring, and the water overlay advisor data.
- 341 tests / 56 files green, typecheck and lint clean; ready for verification and the next phase.

---
*Phase: 04-water-system*
*Completed: 2026-08-03*
