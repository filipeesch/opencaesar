---
phase: 02-data-catalogs-military-absence-gate
plan: 02-03
subsystem: infra
tags: [ci, military-gate, node-script, quality]

# Dependency graph
requires:
  - phase: 02-data-catalogs-military-absence-gate
    provides: balance/catalog validation parity baseline (02-02) unaffected by this gate
provides:
  - scripts/check-military.mjs (standalone scanner) + npm run check:military + explicit CI quality-job step + vitest gate refactored to the shared token/scan source of truth (DATA-03)
affects: [future phases where src/ or data/ content is authored]

# Actuals
actuals:
  tokens: 330
  tasks: 2
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone exit-code gate scripts in scripts/*.mjs with direct-entry guard (import.meta.url === pathToFileURL(process.argv[1]))"
    - "Shared single source of truth: exported FORBIDDEN_TOKENS + scanMilitarySources imported by both CLI and vitest gate"

key-files:
  created:
    - scripts/check-military.mjs
    - scripts/check-military.d.mts
  modified:
    - package.json
    - .github/workflows/ci.yml
    - tests/military-absence.test.ts

key-decisions:
  - "Token list + scan logic live only in scripts/check-military.mjs; the vitest gate imports them (no duplicated local constant)"
  - "A .d.mts declaration sits beside the .mjs so strict TS (no allowJs) typechecks the shared import"
  - "CI step placed between typecheck and test so the gate fails loudly independent of the unit-test suite"

patterns-established:
  - "Direct-entry guard pattern for standalone scripts so importing them under vitest never triggers the CLI main()"

requirements-completed: [DATA-03]

# Coverage metadata
coverage:
  - id: D1
    description: "npm run check:military runs a standalone scanner over src/ and data/ only and exits non-zero when a forbidden military token appears on any line not carrying the --NO-MILITARY-- label"
    requirement: DATA-03
    verification:
      - kind: other
        ref: "command: node scripts/check-military.mjs (probe src/__military_probe__.ts → exit 1; clean → exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "npm run check:military exits 0 on the current clean tree"
    requirement: DATA-03
    verification:
      - kind: other
        ref: "command: npm run check:military (exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "CI (.github/workflows/ci.yml quality job) includes an explicit npm run check:military step independent of the unit-test suite"
    requirement: DATA-03
    verification:
      - kind: other
        ref: ".github/workflows/ci.yml quality job step npm run check:military (between typecheck and npm test)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The military gate scans only src/ and data/ and honors the --NO-MILITARY-- labeled-doc allowance"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: tests/military-absence.test.ts#contains no forbidden military tokens outside labeled docs
        status: pass
      - kind: unit
        ref: tests/military-absence.test.ts#allow --NO-MILITARY-- labeled lines and flag unlabeled token lines
        status: pass
    human_judgment: false
  - id: D5
    description: "The FORBIDDEN_TOKENS list has a single source of truth shared by the script and the vitest gate"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: tests/military-absence.test.ts (imports FORBIDDEN_TOKENS + scanMilitarySources from ../scripts/check-military.mjs)
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-08-03
status: complete
---

# Phase 02 Plan 02-03: Independent Military-Absence Gate Summary

**The military-absence gate is now a standalone exit-code scanner (scripts/check-military.mjs) wired as `npm run check:military` with an explicit CI quality-job step, and the vitest gate imports the same token list + scan (single source of truth, DATA-03).**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-03T10:45:40Z
- **Completed:** 2026-08-03T10:51:40Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Extracted `scripts/check-military.mjs` — exports the 11-token `FORBIDDEN_TOKENS` list and `scanMilitarySources()` (recursive src/+data/ scan, ext set ts/tsx/js/cjs/mjs, skips node_modules + test-results, honors the `--NO-MILITARY--` line allowance), with a direct-entry-guarded `main()` CLI (exit 0 clean / exit 1 + offender lines).
- Wired `"check:military": "node scripts/check-military.mjs"` into package.json and added `- run: npm run check:military` to the CI quality job between typecheck and npm test — the gate fails loudly independent of the unit-test suite.
- Refactored `tests/military-absence.test.ts` to import `FORBIDDEN_TOKENS` + `scanMilitarySources` from the shared script, eliminating the duplicated local constant.
- Added `scripts/check-military.d.mts` so strict TS (no allowJs) typechecks the shared import.
- Verified the negative path: a temporary probe file with an unlabeled token makes the CLI exit 1; the clean tree exits 0.

## Task Commits

Each task was committed atomically (commits handled by orchestrator):

1. **Task 1: Extract the standalone military scanner script** - scripts/check-military.mjs
2. **Task 2: Wire npm run check:military + CI step; dedupe the token list into the script** - package.json, .github/workflows/ci.yml, tests/military-absence.test.ts, scripts/check-military.mjs, scripts/check-military.d.mts

**Plan metadata:** docs(02-03) — SUMMARY handled by orchestrator.

## Files Created/Modified

- `scripts/check-military.mjs` - Exports FORBIDDEN_TOKENS + scanMilitarySources; direct-entry-guarded main() CLI with exit codes 0/1.
- `scripts/check-military.d.mts` - Ambient type surface for the .mjs so the TS test import typechecks.
- `package.json` - New `check:military` npm script after the test entries.
- `.github/workflows/ci.yml` - `npm run check:military` step in the quality job between typecheck and npm test.
- `tests/military-absence.test.ts` - Refactored to import tokens + scan from the shared script; keeps src/+data/ scan coverage, non-empty file assertion, labeled-line allowance.

## Decisions Made

- Single source of truth for the token list is the script; the vitest gate reuses it (decision 3 in CONTEXT).
- Added `scripts/check-military.d.mts` (not in the plan explicitly) because the repo's strict tsconfig (`noImplicitAny` + include scripts) would otherwise fail `tsc --noEmit` with TS7016 on the `.mjs` import. Minimal, targeted fix; no config toggles.
- The allowance is preserved: the scan skips any line containing `--NO-MILITARY--`, asserted via the imported tokens + clean-tree pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added scripts/check-military.d.mts declaration**
- **Found during:** Task 2 (refactoring the vitest gate import)
- **Issue:** `npm run typecheck` failed TS7016 (`Could not find a declaration file for module '../scripts/check-military.mjs'`) — the repo's strict tsconfig compiles `scripts/` with `noImplicitAny` and `allowJs` off.
- **Fix:** Added `scripts/check-military.d.mts` declaring the exported surface; typecheck clean.
- **Files modified:** scripts/check-military.d.mts (new)
- **Verification:** `npm run typecheck` clean; `npm test` 286 green.
- **Committed in:** part of task 2 (commits handled by orchestrator)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for the strict-TS typecheck to accept the shared .mjs import; no scope creep.

## Issues Encountered

None beyond the TS7016 resolution above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DATA-03 delivered: both gate layers (CLI exit-code + vitest) share one token list and both pass on the clean tree.
- Phase 2 complete — all three plans (02-01, 02-02, 02-03) delivered and the full suite (286 tests) + typecheck + check:military are green, ready for phase verification and then Phase 3 (road graph & walker categories).

---
*Phase: 02-data-catalogs-military-absence-gate*
*Completed: 2026-08-03*
