---
phase: 03-road-graph-walker-categories
plan: 03-02
subsystem: simulation
tags: [road-types, roadType, side-channel, walker-speed, desirability, golden]

requires:
  - phase: 03-01
    provides: "RoadNetwork connectivity fixes + dirty-region observability"
provides:
  - "Per-tile roadType side-channel (TileState.roadType, Map.roadTypeAt/setRoadType, SimRunner.getTileState.roadType)"
  - "Walker per-tick speed scaled by roadSpeedMultiplier of the current tile"
  - "House desirability includes orthogonally adjacent road tiles' desirability"
affects: [03-03, road-graph-walker-categories]

actuals:
  tokens: 3204
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "CORE-03 TileState side-channel extended with a road-type refinement (null == dirt)"

key-files:
  created:
    - tests/unit/road-type-wiring.test.ts
    - tests/unit/road-type-effects.test.ts
  modified:
    - src/sim/tile.ts
    - src/sim/map.ts
    - src/sim/runner.ts
    - src/sim/walkers.ts
    - src/sim/housing.ts
    - tests/runner-accessors.test.ts

key-decisions:
  - "roadType is a side-channel refinement, not terrain authority: setting it never changes Map.get terrain ('road' stays 'road')."
  - "Default null roadType reads as dirt (multiplier 1, desirability 0) so existing behavior is unchanged."

patterns-established:
  - "Per-tile typed road data lives on TileState and is read via Map.roadTypeAt; terrain grid stays authoritative."

requirements-completed: [ROAD-02]

coverage:
  - id: D1
    description: "Per-tile roadType side-channel on TileState + Map + SimRunner snapshot (ROAD-02)"
    requirement: ROAD-02
    verification:
      - kind: unit
        ref: "tests/unit/road-type-wiring.test.ts#per-tile roadType side-channel (ROAD-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Walker per-tick speed scales by the current road tile's speed multiplier (ROAD-02)"
    requirement: ROAD-02
    verification:
      - kind: unit
        ref: "tests/unit/road-type-effects.test.ts#walkers on a paved road tile move faster than on dirt/bare road"
        status: pass
    human_judgment: false
  - id: D3
    description: "House desirability adds adjacent road tiles' desirability, clamped to [0, 200] (ROAD-02)"
    requirement: ROAD-02
    verification:
      - kind: unit
        ref: "tests/unit/road-type-effects.test.ts#house desirability gains adjacent road-type desirability (plaza +4, roadblock +0)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-03
status: complete
---

# Phase 3 Plan 2: Road types wired into sim behavior

**Per-tile roadType side-channel (TileState/Map/SimRunner) now drives walker movement speed via roadSpeedMultiplier and house desirability via roadDesirability of orthogonally adjacent road tiles, with golden fixtures regenerated intentionally.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-03T11:58:20Z
- **Completed:** 2026-08-03T12:01:30Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added `TileState.roadType: RoadType | null` (default `null` in `defaultTileState()`), `Map.roadTypeAt/setRoadType` (out-of-bounds safe, never mutates terrain), and exposed `roadType` in `SimRunner.getTileState` alongside the existing `road` flag.
- Wired walker speed: `move()` multiplies per-tick progress by `roadSpeedMultiplier(effectiveType)`; bare roads read as dirt (1x) so there is no default-speed regression, paved tiles move walkers 1.25x.
- Wired house desirability: `desirabilityOf` iterates the 4 orthogonal neighbors and adds `roadDesirability(map.roadTypeAt(nx, ny) ?? 'dirt')` per road neighbor, keeping the [0, 200] clamp and rounding. service_roadblock contributes its (0) desirability.
- New tests: `road-type-wiring.test.ts` (5) and `road-type-effects.test.ts` (2), covering round-trip, out-of-bounds, terrain coexistence, runner snapshot, paved-vs-dirt speed delta, and plaza +4 / roadblock +0 desirability.
- Regenerated both golden fixtures with `GOLDEN_UPDATE=1 npm run test:golden:update`. Content is byte-identical to the committed fixtures (verified by hash) because every road in the food-city scenario is placed without a roadType — it reads as dirt and contributes 0 desirability. This is the intended ROAD-02 behavior (no churn on the untyped happy path), not a test weakening.
- Full suite: 301 tests / 48 files green; typecheck clean.

## Task Commits

1. **Task 1: Per-tile road-type side-channel on TileState + Map + SimRunner snapshot** - (commits handled by orchestrator)
2. **Task 2: Wire road types into walker speed and house desirability; regenerate goldens** - (commits handled by orchestrator)

## Files Created/Modified
- `src/sim/tile.ts` - `TileState.roadType: RoadType | null`, default null in `defaultTileState()`.
- `src/sim/map.ts` - `roadTypeAt(x, y)` / `setRoadType(x, y, type)` methods.
- `src/sim/runner.ts` - `getTileState` returns `roadType` from `map.roadTypeAt`.
- `src/sim/walkers.ts` - `move()` speed multiplied by `roadSpeedMultiplier` of the current tile.
- `src/sim/housing.ts` - `desirabilityOf` adds adjacent-road desirability via `roadDesirability`.
- `tests/unit/road-type-wiring.test.ts` - New: side-channel wiring tests (5).
- `tests/unit/road-type-effects.test.ts` - New: speed + desirability effect tests (2).
- `tests/runner-accessors.test.ts` - getTileState field-count expectation updated 15 → 16 (see deviations).

## Decisions Made
- `roadType` follows the CORE-03 TileState side-channel pattern: terrain grid remains the authority for placement/pathfinding; the road type is a refinement only.
- `null` road type is the "plain dirt road" default so all existing untyped roads keep multiplier 1 / desirability 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated existing getTileState field-count assertion to 16 fields**
- **Found during:** Task 1 (side-channel) — full-suite run
- **Issue:** `tests/runner-accessors.test.ts` asserted `getTileState` equals exactly the 15 CORE-03 fields; adding `roadType` (required by task 1 acceptance) made it 16 and the test failed.
- **Fix:** Added `roadType: null` to the expected object and updated the title to "all 16 per-tile fields". This file was not in the plan's `files_modified` list.
- **Files modified:** tests/runner-accessors.test.ts
- **Verification:** Full suite green (301 tests).
- **Committed in:** (commits handled by orchestrator)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** The fix was a necessary test-shape update caused by the plan's own deliverable. No scope creep.

## Issues Encountered
- The golden fixtures were expected to change (adjacent-road desirability) but regenerated byte-identical: the food-city roads are placed without a roadType, so they read as dirt (desirability 0). This confirms the ROAD-02 change does not perturb the untyped happy path; the desirability mechanic itself is covered by `road-type-effects.test.ts`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 03-03 consumes `Map.roadTypeAt/setRoadType` for per-walker traversability and composes `profile.movementSpeed * roadSpeedMultiplier(tile)` in `move()`.
- The getTileState snapshot now carries `roadType` for the public sim state (no UI change).

---
*Phase: 03-road-graph-walker-categories*
*Completed: 2026-08-03*
