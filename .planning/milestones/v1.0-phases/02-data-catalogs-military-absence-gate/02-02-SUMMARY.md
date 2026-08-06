---
phase: 02-data-catalogs-military-absence-gate
plan: 02-02
subsystem: testing
tags: [balance, config, parity, externlization, regression]

# Dependency graph
requires:
  - phase: 02-data-catalogs-military-absence-gate
    provides: validated BALANCE catalog baseline (02-01) the parity test asserts against
provides:
  - tests/balance-parity.test.ts proving CONFIG is a value-identical re-export of BALANCE, per-key consumer mapping, and no-redeclaration regression (DATA-02)
affects: [03-road-graph-walker-categories, 02-03]

# Actuals
actuals:
  tokens: 210
  tasks: 2
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source-scan parity tests: recursive readdirSync over src/ + inline content asserts, no fixtures"
    - "No-redeclaration guard via word-boundary regex on keys under src/"

key-files:
  created:
    - tests/balance-parity.test.ts
  modified: []

key-decisions:
  - "Parity scanner covers src/ (sim + game) so tickPerSecond's consumer in src/game resolves"
  - "Spread assertion regex matches the { ...BALANCE } formatting actually present in config.ts"

patterns-established:
  - "Deterministic source-scan regression tests in tests/ (fs-based), mirroring the military-absence.test.ts technique"

requirements-completed: [DATA-02]

# Coverage metadata
coverage:
  - id: D1
    description: "CONFIG (src/sim/config.ts) is an exact value-identical re-export of data/balance.ts"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: tests/balance-parity.test.ts#CONFIG key set matches the BALANCE catalog
        status: pass
      - kind: unit
        ref: tests/balance-parity.test.ts#CONFIG values are identical to the BALANCE catalog
        status: pass
      - kind: unit
        ref: tests/balance-parity.test.ts#config.ts re-exports the catalog via the { ...BALANCE } spread
        status: pass
    human_judgment: false
  - id: D2
    description: "Every BALANCE key is consumed in src/ via CONFIG.<key>, mapping each externalized constant to its consuming code"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: tests/balance-parity.test.ts#every BALANCE key is consumed as CONFIG.<key> outside the re-export
        status: pass
    human_judgment: false
  - id: D3
    description: "No balance key is re-declared or hard-coded as a numeric literal in src/ outside data/ and the config re-export"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: tests/balance-parity.test.ts#no src/ file outside the re-export re-declares or re-assigns a balance key
        status: pass
    human_judgment: false
  - id: D4
    description: "Golden determinism tests stay green (behavioral equivalence of externalized constants remains observable)"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: tests/golden/golden.test.ts
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-08-03
status: complete
---

# Phase 02 Plan 02-02: Balance Catalog-to-Behavior Parity Test Summary

**A 5-test parity suite (tests/balance-parity.test.ts) proves CONFIG is a value-identical re-export of the 29-key BALANCE catalog, maps each key to a CONFIG consumer under src/, and blocks any re-declaration of a balance key in code (DATA-02).**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-03T10:42:10Z
- **Completed:** 2026-08-03T10:45:10Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Key identity + value identity between CONFIG and BALANCE asserted (mirrors the existing data-catalog.test.ts identity block, now inside the parity suite).
- Per-key consumer mapping: every BALANCE key must appear as `CONFIG.<key>` in at least one src/ file outside `src/sim/config.ts` — the scan covers src/ (sim + game) so `ticksPerSecond` (consumed in `src/game/scenes/MainScene.ts`) resolves.
- No-redeclaration regression: no src/ file outside the re-export may contain `\b<key>\s*=` for any balance key.
- Golden suite (tests/golden/golden.test.ts) confirmed green — end-to-end behavioral equivalence proof for the re-exported constants.

## Task Commits

Each task was committed atomically (commits handled by orchestrator):

1. **Task 1: Catalog-to-consumer parity test: every BALANCE key is consumed via CONFIG in src/** - tests/balance-parity.test.ts
2. **Task 2: No-redeclaration regression + golden equivalence confirmation** - tests/balance-parity.test.ts

**Plan metadata:** docs(02-02) — SUMMARY handled by orchestrator.

## Files Created/Modified

- `tests/balance-parity.test.ts` - 5-test parity suite: key identity, value identity, per-key consumer mapping (src/ fs scan), no-redeclaration regex regression, `{ ...BALANCE }` spread assertion.

## Decisions Made

- Parity scan uses `src/` (sim + game) not `src/sim` alone to capture the game-shell consumer of `ticksPerSecond` (per CONTEXT decision 2).
- Spread assertion regex written to match the actual `export const CONFIG = { ...BALANCE };` formatting (spaces inside braces).
- No fixture regeneration run (`npm run test:golden:update` deliberately not invoked) — goldens stay as-is.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial spread assertion regex `/CONFIG\s*=\s*\{\.\.\.BALANCE\}/` failed against the actual formatting `CONFIG = { ...BALANCE }` (spaces inside the braces). Corrected to `/CONFIG\s*=\s*\{\s*\.\.\.BALANCE\s*\}/`. This was an implementation detail, not a plan deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 02-03 — balance externalization now has a deterministic regression guard, freeing the military-gate refactor to focus on the standalone script + CI step.

---
*Phase: 02-data-catalogs-military-absence-gate*
*Completed: 2026-08-03*
