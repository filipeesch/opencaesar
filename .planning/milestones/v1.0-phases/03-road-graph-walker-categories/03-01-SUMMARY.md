---
phase: 03-road-graph-walker-categories
plan: 03-01
subsystem: simulation
tags: [road-graph, connectivity, roadnet, dirty-region, graph]

requires: []
provides:
  - "RoadNetwork isolated-add component assignment (connected(tile, tile) true)"
  - "affectedTiles() reports the true recomputed dirty region"
  - "Multi-region disconnect/reconnect + third-region isolation tests"
affects: [03-02, 03-03, road-graph-walker-categories]

actuals:
  tokens: 2047
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "recolorRegion returns the re-colored region instead of a single tile"

key-files:
  created: []
  modified:
    - src/sim/roadNet.ts
    - tests/unit/roadnet.test.ts

key-decisions:
  - "Isolated adds seed the recolor with the new tile's own key so the fallback flood branch is never dead."
  - "floodComponent returns the set of tiles it colored so recolorRegion can expose the true dirty region."

patterns-established:
  - "The dirty/affected set is the union of tiles whose component ids were cleared and re-flooded, plus any newly added tile."

requirements-completed: [ROAD-01]

coverage:
  - id: D1
    description: "Isolated addRoad assigns a component so connected(tile, tile) is true (ROAD-01)"
    requirement: ROAD-01
    verification:
      - kind: unit
        ref: "tests/unit/roadnet.test.ts#an isolated addRoad assigns a component (ROAD-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "affectedTiles() reports the recomputed dirty region, not just the single changed tile (ROAD-01)"
    requirement: ROAD-01
    verification:
      - kind: unit
        ref: "tests/unit/roadnet.test.ts#a cut widens the dirty region to the old component tiles"
        status: pass
      - kind: unit
        ref: "tests/unit/roadnet.test.ts#merging two components widens the dirty region beyond the single tile"
        status: pass
    human_judgment: false
  - id: D3
    description: "Multi-region disconnect/reconnect cycle with third-region isolation (ROAD-01)"
    requirement: ROAD-01
    verification:
      - kind: unit
        ref: "tests/unit/roadnet.test.ts#disconnected → bridged → cut → re-bridged with third-region isolation"
        status: pass
      - kind: unit
        ref: "tests/unit/roadnet.test.ts#a change confined to one cluster leaves the far region and the other cluster clean"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-03
status: complete
---

# Phase 3 Plan 1: RoadGraph baseline + RoadNetwork connectivity & dirty-region fixes

**RoadNetwork now assigns a component to isolated road adds (connected(tile, tile) true) and affectedTiles() reports the genuinely recomputed dirty region, with multi-region disconnect/reconnect and third-region isolation tests.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-03T11:56:00Z
- **Completed:** 2026-08-03T11:58:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Baseline re-confirmed before any change: `npm run typecheck` clean, `npm run test` green at 289 tests / 46 files.
- Fixed the isolated-add connectivity bug: `addRoad` on a tile with no road neighbors now seeds the recolor with the new tile's own key, so `floodComponent` runs and assigns a fresh component — `connected(tile, tile)` is true immediately after an isolated add.
- Widenend dirty-region observability: `recolorRegion` now returns the set of tiles it actually re-flooded (old component tiles plus any newly added tile), and `addRoad`/`removeRoad` store that whole region into `lastAffected` instead of only `[{x,y}]`. `affectedTiles()` still returns a defensive copy.
- Added the multi-region test block: disconnected → bridged → cut → re-bridged over a unique articulation tile, with both halves staying internally connected after the cut, plus a far-away third region that is never colored into either cluster and never appears in any dirty region.
- Full suite: 294 tests / 46 files green; typecheck clean.

## Task Commits

1. **Task 1: Baseline + fix isolated-add connectivity and dirty-region observability** - (commits handled by orchestrator)
2. **Task 2: Multi-region disconnect/reconnect + region-isolation tests** - (commits handled by orchestrator)

## Files Created/Modified
- `src/sim/roadNet.ts` - Isolated-add flood seed; `recolorRegion` returns the re-colored region; `floodComponent` returns colored tile keys; `unkey` helper.
- `tests/unit/roadnet.test.ts` - Isolated-add connectivity test, dirty-region widening tests, multi-region disconnect/reconnect + third-region isolation describe block (10 tests total).

## Decisions Made
- `recolorRegion(seeds)` now returns `Vec2[]` (the re-colored region). The old `seen`-guarded re-flood loop was simplified: since every tile of a touched component is cleared before re-flooding, a single flood per resulting region colors the whole region; the guard was effectively dead code.
- For an isolated add, `seeds` becomes `[newTileKey]` so the fallback branch (seeds with no prior component) is exercised instead of iterating an empty array.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- RoadNetwork correctness is baseline-verified for 03-02/03-03: per-tile roadType (03-02) and per-walker traversability (03-03) build on this graph.
- `RoadNetwork` remains class-level; wiring it into `SimRunner` build/demolish is deferred (per CONTEXT decision 1).

---
*Phase: 03-road-graph-walker-categories*
*Completed: 2026-08-03*
