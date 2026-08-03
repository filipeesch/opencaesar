---
phase: 04-water-system
plan: 04-01
subsystem: water
tags: [water, reservoir, well, desirability, WATR-01, WATR-02]

requires: []
provides:
  - "RESERVOIR_STORAGE_CAPACITY const, ReservoirState interface, reservoirTouchesMapWater() and computeReservoirStates() helpers"
  - "WELL_DESIRABILITY_PENALTY const and TileWater.desirability field with a well-penalty pass in WaterSystem.compute()"
affects: [04-02, 04-03, Phase 18 Management UI]

actuals:
  tokens: 1900
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Pure helper derivation of observable water state from injected inputs (no hidden state)"

key-files:
  created:
    - tests/unit/reservoir.test.ts
  modified:
    - src/sim/water.ts
    - tests/unit/water.test.ts

key-decisions:
  - "ReservoirStorageState is derived by a pure helper over ReservoirDef + flow set; ReservoirDef itself unchanged (existing tests depend on {x,y,size,active})."
  - "Well desirability penalty lives in a new TileWater.desirability field (module const WELL_DESIRABILITY_PENALTY = 4), keeping wellness/sanitaryRisk/water-class semantics untouched."

patterns-established:
  - "Water-model state surfaces are pure projections of caller-injected inputs (grid, flow set, map-water predicate) — no process/clock state leaks."

requirements-completed: [WATR-01, WATR-02]

coverage:
  - id: D1
    description: "Reservoir 3x3 storage state — capacity/level, filled gating on active + (map water OR flowing aqueduct), inlet (map water or flowing aqueduct) and outlet-to-aqueduct connectivity"
    requirement: WATR-02
    verification:
      - kind: unit
        ref: "tests/unit/reservoir.test.ts#filled 3x3 reservoir touching map water reports capacity level with inlet connected, no outlet"
        status: pass
      - kind: unit
        ref: "tests/unit/reservoir.test.ts#flowing aqueduct adjacent to the footprint gives the reservoir an outlet to the aqueduct"
        status: pass
      - kind: unit
        ref: "tests/unit/reservoir.test.ts#isolated active reservoir is not filled"
        status: pass
      - kind: unit
        ref: "tests/unit/reservoir.test.ts#inactive reservoir stays empty even when touching map water"
        status: pass
      - kind: unit
        ref: "tests/unit/reservoir.test.ts#capacity is constant at RESERVOIR_STORAGE_CAPACITY regardless of input"
        status: pass
      - kind: unit
        ref: "tests/unit/reservoir.test.ts#reservoirTouchesMapWater is false for an out-of-bounds-adjacent-only corner reservoir"
        status: pass
    human_judgment: false
  - id: D2
    description: "Well desirability penalty — active wells subtract WELL_DESIRABILITY_PENALTY per tile within radius (accumulating on overlap, zero off-radius/inactive) while water class and sanitary risk stay unchanged"
    requirement: WATR-01
    verification:
      - kind: unit
        ref: "tests/unit/water.test.ts#wells desirability penalty (WATR-01): an active well subtracts the penalty within radius and zero off-radius"
        status: pass
      - kind: unit
        ref: "tests/unit/water.test.ts#wells desirability penalty (WATR-01): overlapping wells accumulate the penalty"
        status: pass
      - kind: unit
        ref: "tests/unit/water.test.ts#wells desirability penalty (WATR-01): an inactive well leaves desirability zero everywhere"
        status: pass
      - kind: unit
        ref: "tests/unit/water.test.ts#wells desirability penalty (WATR-01): keeps water class basic and sanitary risk reflecting pollution"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-03T12:24:19Z
status: complete
---

# Phase 04 Plan 01: Reservoir Storage State + Well Desirability Penalty Summary

**WATR-02 reservoir 3x3 storage/level/inlet/outlet derivations and a WATR-01 well desirability penalty in `TileWater`, both unit-tested, on top of a re-confirmed 316-test baseline.**

## Performance

- **Duration:** 5 min
- **Started:** ~2026-08-03T12:19:47Z
- **Completed:** 2026-08-03T12:24:19Z
- **Tasks:** 2 (1 tracer, 1 auto)
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments

- Exported `RESERVOIR_STORAGE_CAPACITY = 256`, the `ReservoirState` interface (capacity/level/filled/inletConnected/outletToAqueduct) and the pure helpers `reservoirTouchesMapWater()` + `computeReservoirStates()`; `AqueductSystem.reservoirTouchesWater` now delegates to the shared perimeter scan.
- Added `WELL_DESIRABILITY_PENALTY = 4` and a `TileWater.desirability` field initialized to 0, with a `WaterSystem.compute()` second pass that subtracts the penalty per well-covered tile (accumulating on overlap).
- New `tests/unit/reservoir.test.ts` (6 tests) covering filled/inlet/outlet, isolation, inactive, capacity-constant and corner-adjacency cases; `tests/unit/water.test.ts` extended with a 4-test well-desirability block.
- Baseline re-confirmed: `npm run typecheck` clean and `npm run test` 316/52 green before any source change; after the plan the full suite is 326/53 green.

## Task Commits

Each task was executed and verified inline. Per the phase-execution instruction, no commits were made (SUMMARY/VERIFICATION files only).

1. **Task 1 (tracer): Baseline + reservoir storage/inlet/outlet/level state (WATR-02)** — verify: `npm run typecheck && npx vitest run tests/unit/reservoir.test.ts` → PASS (6 tests). Tracer feedback gate (re-run verify before expansion): PASS — no deviation surfaced, proceeded to well penalty.
2. **Task 2 (auto): Well desirability penalty + tests (WATR-01)** — verify: `npm run typecheck && npx vitest run tests/unit/water.test.ts` → PASS (11 tests).

**Plan metadata:** no `docs` commit (intentional — no commits in this run).

## Files Created/Modified

- `src/sim/water.ts` — `WELL_DESIRABILITY_PENALTY` const, `TileWater.desirability` field + well-penalty pass in `WaterSystem.compute()`, `RESERVOIR_STORAGE_CAPACITY` const, `ReservoirState` interface, `reservoirTouchesMapWater()` and `computeReservoirStates()` helpers; `AqueductSystem.reservoirTouchesWater` now delegates to the exported helper.
- `tests/unit/reservoir.test.ts` — new: 6 tests for the WATR-02 reservoir state surface.
- `tests/unit/water.test.ts` — extended: 4-test 'wells desirability penalty (WATR-01)' block; all 7 existing tests unchanged.

## Decisions Made

- Reservoir state is a pure derivation over `ReservoirDef` + flow set; `ReservoirDef` signature unchanged (existing tests depend on `{x,y,size,active}`).
- Well penalty constant lives as a module const in water.ts per CONTEXT decision 1; `desirability` field added next to `wellness` in the grid-fill loop.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 04-02: `TileWater.desirability` exists (fountain bonus will extend the same pass), reservoir helpers are in place, aqueduct branch untouched.
- 326 tests / 53 files green, typecheck clean.

---
*Phase: 04-water-system*
*Completed: 2026-08-03*
