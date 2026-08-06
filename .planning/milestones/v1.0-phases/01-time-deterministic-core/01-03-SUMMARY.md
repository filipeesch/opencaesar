---
phase: 01-time-deterministic-core
plan: 01-03
subsystem: sim
tags: [tile-state, accessor, read-only, golden, determinism, core-03]

# Dependency graph
requires:
  - phase: 01-time-deterministic-core
    provides: "demolish + paused-command pipeline (plan 01-02), used by the paused-commands golden script"
provides:
  - "SimRunner.getTileState(x, y): TileState — read-only copy accessor exposing all 15 CORE-03 per-tile fields through the public sim interface"
  - "Tile defaults test extended to assert resourceAmount and desirability"
  - "Paused-command pipeline golden snapshot (fixture + case); existing food-chain golden and determinism suites remain green"
affects: [UI overlays/rendering consumers in later phases (e.g. Phase 18 overlays), anyone reading per-tile sim state]

actuals:
  tokens: 5050
  tasks: 2
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Copy-returning accessor pattern for cross-boundary read-only state: { ...this.map.tileState(x, y) } keeps live references inside src/sim/."

key-files:
  created:
    - tests/golden/fixtures/paused-commands-golden.json
  modified:
    - src/sim/runner.ts
    - tests/unit/tile.test.ts
    - tests/runner-accessors.test.ts
    - tests/golden/golden.test.ts

key-decisions:
  - "getTileState returns a shallow object spread copy ({ ...this.map.tileState(x, y) }) — all TileState fields are primitives, so the copy is complete and no live reference escapes src/sim/."
  - "Map.tileState's internal live-reference semantics were left untouched; sim systems still mutate via map.mutateTileState."
  - "The CORE-03 field audit found all 15 fields already present in the TileState interface and defaultTileState — no field or default change was needed; only the test gap (resourceAmount/desirability assertions) and the reachability gap (public accessor) were closed."

patterns-established:
  - "Golden tests follow the existing GOLDEN_UPDATE pattern (write on update, strict toEqual against the recorded fixture otherwise); per-fixed-seed paused-command script → identical state."

requirements-completed: [CORE-03]

coverage:
  - id: D1
    description: "SimRunner.getTileState(x, y) exposes all 15 CORE-03 per-tile fields (elevation, fertility, resourceType/Amount, waterDepth, aqueduct, road, desirability, fireRisk, collapseRisk, pollution, traffic, serviceCoverage, ownership, blocked) in bounds"
    requirement: CORE-03
    verification:
      - kind: unit
        ref: "tests/runner-accessors.test.ts#getTileState returns a read-only copy of all 15 per-tile fields (CORE-03)"
        status: pass
      - kind: unit
        ref: "tests/unit/tile.test.ts#exposes neutral defaults for every tile"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tile state stays read-only outside src/sim/ — the public accessor returns a copy; mutating it cannot corrupt subsequent reads or sim state"
    requirement: CORE-03
    verification:
      - kind: unit
        ref: "tests/runner-accessors.test.ts#getTileState returns a read-only copy of all 15 per-tile fields (CORE-03) (mutation-after-read assertions)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Paused-command pipeline golden — build/demolish/policy issued while paused (at fixed seed) applied identically on resume produce the recorded final state snapshot"
    requirement: CORE-03
    verification:
      - kind: unit
        ref: "tests/golden/golden.test.ts#paused-command pipeline golden matches the recorded paused-command snapshot"
        status: pass
    human_judgment: false
  - id: D4
    description: "Existing determinism suite and food-chain golden remain green alongside the new golden and accessor coverage"
    verification:
      - kind: unit
        ref: "npm run test (271 tests / 44 files, incl. determinism + both goldens)"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-08-03
status: complete
---

# Phase 1 Plan 3: Time & Deterministic Core — Tile State + Golden Summary

**Exposes read-only per-tile state through SimRunner.getTileState(x, y) (copy accessor, all 15 CORE-03 fields), extends the TileState defaults test to assert resourceAmount and desirability, and adds a paused-command pipeline golden snapshot while keeping the determinism suite and food-chain golden green.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-08-03T09:47:00Z
- **Completed:** 2026-08-03T09:53:27Z
- **Tasks:** 2
- **Files modified:** 5 (1 fixture created)

## Accomplishments
- Audited the `TileState` interface (src/sim/tile.ts:9-25) against the full CORE-03 field list: elevation, fertility, resourceType, resourceAmount, waterDepth, aqueduct, road, desirability, fireRisk, collapseRisk, pollution, traffic, serviceCoverage, ownership, blocked — **all 15 already present** with neutral defaults in `defaultTileState`. No field was missing; `src/sim/tile.ts` and `src/sim/map.ts` required no edits.
- Added `SimRunner.getTileState(x: number, y: number): TileState` (src/sim/runner.ts, near getState) returning `{ ...this.map.tileState(x, y) }` — a shallow copy, so no live reference escapes `src/sim/`. `Map.tileState`'s internal live-reference semantics were left intact for sim systems using `mutateTileState`.
- Extended the neutral-defaults test in tests/unit/tile.test.ts to assert `resourceAmount === 0` and `desirability === 0` (previously omitted).
- Added a CORE-03 accessor test in tests/runner-accessors.test.ts asserting `getTileState` returns all 15 fields for an in-bounds tile on a seeded runner and that mutating the returned object does not affect subsequent reads (read-only contract).
- Added a paused-command pipeline golden to tests/golden/golden.test.ts (fixed seed 24680 + foodChainMap + buildFoodCity; pause → enqueue road place / policy / road demolish → resume → 1200 ticks), seeded `tests/golden/fixtures/paused-commands-golden.json` via `npm run test:golden:update`. The existing food-chain golden regenerated byte-identical (git diff empty), and the determinism suite stayed green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Expose read-only per-tile state through the public sim interface** — `orchestrator-owned` (feat)
2. **Task 2: Add the paused-command pipeline golden + keep determinism suites green** — `orchestrator-owned` (test)

**Plan metadata:** `orchestrator-owned` (docs: complete plan)

_Note: commits are owned by the orchestrator per this executor's instructions; no commits were made by the executor._

## Files Created/Modified
- `src/sim/runner.ts` - Added `import type { TileState } from './tile'` and the `getTileState(x, y)` copy-returning accessor (CORE-03).
- `tests/unit/tile.test.ts` - Extended neutral-defaults assertions with `resourceAmount === 0` and `desirability === 0`.
- `tests/runner-accessors.test.ts` - Added the 15-field / read-only-copy accessor test.
- `tests/golden/golden.test.ts` - Added the `paused-command pipeline golden` describe block (fix 1 new).
- `tests/golden/fixtures/paused-commands-golden.json` - New golden fixture (recorded from the fixed-seed paused-command script).

## Decisions Made
- `getTileState` returns a shallow copy (`{ ... }`); all TileState fields are primitives so no nested references can escape.
- `Map.tileState`/`mutateTileState` semantics unchanged — the read-only guarantee is enforced at the public boundary, not by restructuring the sim internals.
- No CORE-03 field additions were required (audit found all 15 present); the deliverables were the accessor, the test gap fill, and the golden.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None.

## Issues Encountered
None — a single run of `npm run test:golden:update` seeded the new fixture and regenerated the food-chain golden with byte-identical output (verified via `git diff` empty).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CORE-03 fully closed: per-tile state reachable read-only through the public sim interface; all 15 fields asserted; paused-command pipeline locked by a golden snapshot.
- Full suite green (271 tests / 44 files; typecheck clean).
- Phase complete — ready for phase verification.

---
*Phase: 01-time-deterministic-core*
*Completed: 2026-08-03*
