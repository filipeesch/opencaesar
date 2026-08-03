---
phase: 02-data-catalogs-military-absence-gate
plan: 02-01
subsystem: data
tags: [catalog, validation, balance, sim-runner, guard]

# Dependency graph
requires:
  - phase: 01-time-deterministic-core
    provides: deterministic SimRunner + golden/determinism suites this guard must not break
provides:
  - validateBalance() covering the BALANCE catalog inside validateCatalogs()
  - throwCatalogIssues() + one-time load-time hard-fail guard at SimRunner construction (DATA-01)
affects: [03-road-graph-walker-categories, 02-02]

# Actuals
actuals:
  tokens: 280
  tasks: 2
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-time module-level validation memo (catalogsValidated) in a hot constructor path"
    - "Shared exported validate helper + throw helper pair in data/validate.ts"

key-files:
  created:
    - tests/catalog-load-guard.test.ts
  modified:
    - data/validate.ts
    - src/sim/runner.ts

key-decisions:
  - "BALANCE added to validateCatalogs() via a dedicated validateBalance() helper, not by inlining the loop"
  - "SimRunner guard runs once per process (module-level catalogsValidated flag) so the 273-test baseline pays no per-construction cost"

patterns-established:
  - "Validation helpers live in data/validate.ts and are exported for direct unit testing; throwCatalogIssues centralizes the hard-fail error format"

requirements-completed: [DATA-01]

# Coverage metadata
coverage:
  - id: D1
    description: "validateCatalogs() covers every catalog including BALANCE and returns an empty issue list on the current data"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: tests/data-catalog.test.ts#all catalogs pass load-time validation
        status: pass
      - kind: unit
        ref: tests/catalog-load-guard.test.ts#validateCatalogs stays clean on the real catalogs
        status: pass
      - kind: unit
        ref: tests/catalog-load-guard.test.ts#flags negative, NaN, and Infinity values as balance catalog issues
        status: pass
    human_judgment: false
  - id: D2
    description: "SimRunner refuses to construct when validateCatalogs() reports issues (load-time hard-fail guard)"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: tests/catalog-load-guard.test.ts#throwCatalogIssues does not throw on an empty issue list
        status: pass
      - kind: unit
        ref: tests/catalog-load-guard.test.ts#throwCatalogIssues throws a Data catalog validation failed error with the catalog tag
        status: pass
      - kind: unit
        ref: tests/catalog-load-guard.test.ts#SimRunner constructs while the catalogs are valid
        status: pass
      - kind: unit
        ref: tests/determinism/determinism.test.ts
        status: pass
      - kind: unit
        ref: tests/runner-accessors.test.ts
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-08-03
status: complete
---

# Phase 02 Plan 02-01: Data Catalog Load-Time Validation Summary

**validateCatalogs() now validates the BALANCE catalog via a new validateBalance() helper, and the SimRunner constructor hard-fails on corrupt catalog data through a one-time throwCatalogIssues() guard (DATA-01).**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-03T10:38:50Z
- **Completed:** 2026-08-03T10:42:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Established the Phase-2 baseline: typecheck clean, 273 tests / 44 files green before any change.
- Added `validateBalance()` to `data/validate.ts` — flags undefined/NaN/Infinity/negative values as `{ catalog: 'balance' }` issues — and wired it into `validateCatalogs()` so the BALANCE catalog is covered (DATA-01 coverage gap closed).
- Added `throwCatalogIssues()` and a one-time module-level guard (`catalogsValidated`) at the top of the `SimRunner` constructor so the sim refuses to run on corrupt catalog data, with zero per-construction cost for the test suite.
- Created `tests/catalog-load-guard.test.ts` (7 tests) covering both `validateBalance()` and the load-time guard.

## Task Commits

Each task was committed atomically (commits handled by orchestrator):

1. **Task 1: Baseline + extend validateCatalogs to cover the BALANCE catalog** - data/validate.ts, tests/catalog-load-guard.test.ts
2. **Task 2: Load-time hard-fail guard: SimRunner throws on invalid catalogs** - data/validate.ts, src/sim/runner.ts, tests/catalog-load-guard.test.ts

**Plan metadata:** docs(02-01) — SUMMARY handled by orchestrator.

## Files Created/Modified

- `data/validate.ts` - Added `validateBalance()` helper and `throwCatalogIssues()` helper; `validateCatalogs()` now includes balance issues.
- `src/sim/runner.ts` - Module-level `catalogsValidated` memo + one-time guard call at the top of the constructor.
- `tests/catalog-load-guard.test.ts` - New 7-test suite: balance validation (4) + load-time guard (3).

## Decisions Made

- Added balance coverage via a dedicated exported `validateBalance()` rather than inlining the loop (keeps `validateCatalogs()` readable and the helper directly unit-testable).
- The guard uses a module-level boolean so validation runs exactly once per process — all 273 existing `new SimRunner(...)` call sites keep working unchanged because the real catalogs are valid.
- Error format: `Data catalog validation failed: [catalog] message; ...` — deterministic and greppable.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 02-02 — balance catalog validation baseline in place; `validateCatalogs()` returns `[]` on the real data so parity tests can assert against a validated catalog.

---
*Phase: 02-data-catalogs-military-absence-gate*
*Completed: 2026-08-03*
