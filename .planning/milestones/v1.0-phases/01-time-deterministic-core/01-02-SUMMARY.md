---
phase: 01-time-deterministic-core
plan: 01-02
subsystem: sim
tags: [paused-queue, demolish, save-load, determinism, commands, core-02]

# Dependency graph
requires:
  - phase: 01-time-deterministic-core
    provides: "Frame-rate-independence contract + determinism baseline from plan 01-01"
provides:
  - "SimRunner.demolish(x, y): boolean — immediate application when unpaused, queued while paused"
  - "PendingCommand and SaveCommand 'demolish' variants with FIFO drain and deterministic replay in fromSaveData"
  - "Paused-command pipeline coverage: place/demolish/policy unit tests, paused-script determinism, and save/load round-trip"
affects: [UI build/destroy tooling, save/load consumers, later phases touching the command pipeline]

actuals:
  tokens: 2250
  tasks: 2
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Demolish follows the existing placement pattern: direct apply when unpaused, enqueue { kind: 'demolish' } while paused, replay from save data."

key-files:
  created:
    - tests/unit/paused-queue.test.ts
  modified:
    - src/sim/runner.ts
    - src/sim/types.ts
    - tests/determinism/determinism.test.ts

key-decisions:
  - "demolish pushes the input (x, y) to saveCommands/commandLog (matching the CLI click point); buildingAt resolves the owning building, so replay through fromSaveData is deterministic for any logged tile."
  - "Road demolish resets footprint terrain to 'earth'; non-road demolish leaves terrain untouched (e.g. a farm's fertile patch stays fertile)."
  - "Walker cleanup is intentionally out of scope: demolishing a building does not despawn its walkers (the plan did not require it, and walkers already handle missing targets)."

patterns-established:
  - "Paused-command drain (drainPendingCommands) applies place/policy/demolish in FIFO order at the top of the first tick after resume, before tickCount increments."

requirements-completed: [CORE-02]

coverage:
  - id: D1
    description: "SimRunner.demolish(x, y): boolean removes the building whose footprint covers (x, y), clears occupiedTiles, resets roads to earth, records commandLog + saveCommands, and enqueues when paused (CORE-02)"
    requirement: CORE-02
    verification:
      - kind: unit
        ref: "tests/unit/paused-queue.test.ts#defers a demolish order while paused and applies it on the next tick"
        status: pass
      - kind: unit
        ref: "tests/unit/paused-queue.test.ts#demolishing a road resets its footprint terrain to earth"
        status: pass
      - kind: unit
        ref: "tests/unit/paused-queue.test.ts#returns false when demolishing a tile with no building"
        status: pass
    human_judgment: false
  - id: D2
    description: "PendingCommand and SaveCommand carry a demolish variant; drainPendingCommands and fromSaveData replay it deterministically"
    requirement: CORE-02
    verification:
      - kind: unit
        ref: "tests/determinism/determinism.test.ts#save/load round-trips the paused command pipeline (incl. demolish)"
        status: pass
      - kind: unit
        ref: "tests/unit/paused-queue.test.ts#drains place/policy/demolish in FIFO order on the first resume tick"
        status: pass
    human_judgment: false
  - id: D3
    description: "Build/demolish/policy issued while paused are deferred and drained in FIFO order on the next fixed step (pendingCommands, getPendingCommandCount)"
    requirement: CORE-02
    verification:
      - kind: unit
        ref: "tests/unit/paused-queue.test.ts (6 cases: defer place, defer demolish, FIFO drain, immediate apply, empty-tile, road-reset)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Same seed + same paused-command script reproduces identical state; save/load round-trips the paused pipeline"
    requirement: CORE-02
    verification:
      - kind: unit
        ref: "tests/determinism/determinism.test.ts#a paused place/demolish/policy script is deterministic across runs"
        status: pass
      - kind: unit
        ref: "tests/determinism/determinism.test.ts#save/load round-trips the paused command pipeline (incl. demolish)"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-03
status: complete
---

# Phase 1 Plan 2: Time & Deterministic Core — Demolish + Paused Pipeline Summary

**Adds SimRunner.demolish(x, y) threaded through PendingCommand/SaveCommand with deterministic fromSaveData replay, plus a paused-command pipeline test suite (unit + determinism + save/load round-trip) that locks the CORE-02 contract that build/demolish/policy issued while paused are consumed on the next fixed step.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-08-03T09:41:30Z
- **Completed:** 2026-08-03T09:46:04Z
- **Tasks:** 2
- **Files modified:** 4 (1 new)

## Accomplishments
- Added `SimRunner.demolish(x, y): boolean` (src/sim/runner.ts, near placeBuilding): when unpaused it resolves the owning building via `buildingAt` (occupiedTiles + buildingById), removes it from `buildings`/`buildingById`, clears every footprint tile from `occupiedTiles`, resets road footprints to 'earth' via `map.setRect`, pushes a `saveCommands` entry and a `commandLog` entry, and returns `false` when no building occupies the tile. When paused it enqueues `{ kind: 'demolish', x, y }` and returns true.
- Extended the `PendingCommand` union with the demolish variant and routed it through `drainPendingCommands`, preserving FIFO drain at the top of the first tick after resume and before the tick count increments.
- Extended the `SaveCommand` union (src/sim/types.ts) with `{ kind: 'demolish'; x; y }` and added the demolish branch to the replay loop in `fromSaveData`.
- Created tests/unit/paused-queue.test.ts (6 cases): place-while-paused defers/resume-applies, demolish-while-paused defers/resume-removes, FIFO place→policy→demolish drain on a single resume tick (tickCount delta == 1), immediate apply when unpaused with an empty queue, demolish of an empty tile returns false, and road demolish resets terrain to earth.
- Added determinism cases: a paused place/demolish/policy script (foodChainMap + buildFoodCity) is byte-identical across two runs, and a save/load round-trip over the paused pipeline (seed-generated map) reproduces identical `getStateJson()` — exercising the new demolish SaveCommand branch.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the demolish command (functional CORE-02 gap)** — `orchestrator-owned` (feat)
2. **Task 2: Paused-command pipeline unit + determinism + save/load tests** — `orchestrator-owned` (test)

**Plan metadata:** `orchestrator-owned` (docs: complete plan)

_Note: commits are owned by the orchestrator per this executor's instructions; no commits were made by the executor._

## Files Created/Modified
- `src/sim/runner.ts` - Added `demolish(x, y): boolean`, `PendingCommand` demolish variant, FIFO branch in `drainPendingCommands`, demolish replay branch in `fromSaveData`, and documented `demolish` in the class API docstring.
- `src/sim/types.ts` - Added `{ kind: 'demolish'; x: number; y: number }` to the `SaveCommand` union.
- `tests/unit/paused-queue.test.ts` - New: 6 CORE-02 pipeline tests.
- `tests/determinism/determinism.test.ts` - Added paused-script determinism and save/load round-trip (incl. demolish) cases (now 8 tests).

## Decisions Made
- Demolish records the input click point (x, y) in both `saveCommands` and `commandLog` (matching the CLI presentation `demolish x,y`), consistent with how placement records the anchor. `buildingAt` resolves the owning building, so replay of a non-anchor tile is still deterministic.
- Road demolish resets the footprint to 'earth' only for roads; other types keep their terrain so farms on fertile patches remain buildable land.
- Walker cleanup was kept out of scope — the plan did not require despawning walkers on demolish, and walker logic already tolerates missing target buildings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical / test environment] Save/load round-trip test must use the seed-generated map path**
- **Found during:** Task 2 (Paused-command pipeline unit + determinism + save/load tests)
- **Issue:** The initial round-trip test built the runner over `foodChainMap()`, but `fromSaveData` reconstructs through the no-map path (seed-generated map) to share one RNG stream — so the replay generated a different (all-water) map and every placement failed, producing a divergent state.
- **Fix:** Rewrote the round-trip to mirror the existing seed-based determinism tests: `new SimRunner(777)` with the known-buildable coordinates (roads 3,3 / 3,4, house 3,5), then pause → enqueue road/policy/demolish → resume → tick 60.
- **Files modified:** tests/determinism/determinism.test.ts
- **Verification:** determinism suite green (8/8), full `npm run test` green (269 tests).
- **Committed in:** orchestrator-owned

---

**Total deviations:** 1 auto-fixed (1 test-environment mismatch)
**Impact on plan:** No scope creep; the round-trip still exercises the new demolish SaveCommand replay branch deterministically.

## Issues Encountered
None besides the seed-map replay mismatch recorded above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CORE-02 fully closed: demolish exists end-to-end (immediate, paused-queue, save-replay), and the paused-command pipeline has unit + determinism + round-trip coverage.
- Full suite green (269 tests / 44 files).
- Ready for plan 01-03 (CORE-03 per-tile read-only accessor + paused-command golden).

---
*Phase: 01-time-deterministic-core*
*Completed: 2026-08-03*
