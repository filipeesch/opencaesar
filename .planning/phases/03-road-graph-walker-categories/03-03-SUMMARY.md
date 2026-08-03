---
phase: 03-road-graph-walker-categories
plan: 03-03
subsystem: simulation
tags: [walker-profiles, walker-categories, roadblock, pathfinding, graph-path, golden]

requires:
  - phase: 03-02
    provides: "Per-tile roadType (Map.roadTypeAt/setRoadType) and roadSpeedMultiplier wiring in move()"
provides:
  - "WalkerProfile schema pinned by contract test for every catalog walker"
  - "movementSpeed / serviceTTL / wandering return-at-maxRoadSteps wired into walker behavior"
  - "ROADBLOCK_POLICY_BY_CATEGORY + mayTraverse + isTraversable-aware findRoadPath (no Euclidean fallback)"
affects: [road-graph-walker-categories]

actuals:
  tokens: 5636
  tasks: 3
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Per-walker traversability predicate threaded through pathfinding and wandering movement"

key-files:
  created:
    - tests/unit/walker-profile-contract.test.ts
    - tests/unit/walker-category-behavior.test.ts
    - tests/unit/walker-roadblock-permissions.test.ts
  modified:
    - src/sim/walkerProfiles.ts
    - src/sim/walkers.ts
    - src/sim/pathfind.ts
    - tests/golden/fixtures/food-chain-golden.json
    - tests/golden/fixtures/paused-commands-golden.json

key-decisions:
  - "Profile defaults (movementSpeed 0.5, serviceTTL 120) are derived from CONFIG constants so wiring them in is behavior-neutral and keeps the DATA-02 balance-parity invariant green."
  - "A service_roadblock tile is granted to a walker solely by roadblockPolicy === 'pass' (independent of isRoadPassable); permitted walkers cross it at base speed (its 0 multiplier only blocks non-permitted walkers)."
  - "Travel distance stays graph-path only: destination pathfinding has no Euclidean fallback."

patterns-established:
  - "mayTraverse(profile, type) centralizes per-walker road-type access; findRoadPath takes an optional isTraversable predicate whose default equals the old terrain-only check."

requirements-completed: [ROAD-03]

coverage:
  - id: D1
    description: "WalkerProfile schema contract covering all nine ROAD-03 per-type fields for every catalog walker (ROAD-03)"
    requirement: ROAD-03
    verification:
      - kind: unit
        ref: "tests/unit/walker-profile-contract.test.ts#WalkerProfile schema contract (ROAD-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "movementSpeed / serviceTTL / wandering return-at-maxRoadSteps wired into behavior (ROAD-03)"
    requirement: ROAD-03
    verification:
      - kind: unit
        ref: "tests/unit/walker-category-behavior.test.ts#walker category behavior (ROAD-03)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Per-category roadblock permissions enforced in pathfinding and wandering; graph-path distance with no Euclidean fallback (ROAD-03)"
    requirement: ROAD-03
    verification:
      - kind: unit
        ref: "tests/unit/walker-roadblock-permissions.test.ts#per-category roadblock permissions (ROAD-03)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-03
status: complete
---

# Phase 3 Plan 3: Walker categories behave per their profiles

**WalkerProfile schema pinned by contract test; movementSpeed/serviceTTL/wandering-return-at-maxRoadSteps wired into walker behavior; per-category roadblock permissions enforced via mayTraverse + isTraversable-aware pathfinding with graph-path-only travel.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-03T12:04:00Z
- **Completed:** 2026-08-03T12:15:30Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Added `tests/unit/walker-profile-contract.test.ts` asserting every catalog walker's profile exposes all nine ROAD-03 fields (maxRoadSteps, serviceTTL, spawnInterval, movementSpeed, allowedRoadTypes, roadblockPolicy, serviceRadiusFromCurrentTile, preferredDirection, returnPolicy) with typed, finite, in-range values; profile count matches the WALKERS catalog; all three categories covered; recruiter spawnInterval == 60.
- Wired profiles into `walkers.ts`: `WalkerInstance.origin` + `stepsTaken`; `updateWalker` resolves `walkerProfile(w.type)` once and threads it through coverage/arrival/decide/move; movement uses `profile.movementSpeed * roadSpeedMultiplier(tile)`; service cooldowns use `profile.serviceTTL`; wandering walkers with `returnPolicy` turn back at `maxRoadSteps` (choosing homeward neighbors tie-broken by the seeded RNG) and reset `stepsTaken` at their origin.
- Added `ROADBLOCK_POLICY_BY_CATEGORY` (wandering/recruiter 'stop', destination 'pass'), `mayTraverse(profile, type)`, and per-category `roadblockPolicy` resolution in `walkerProfile`. `findRoadPath` gained an optional `isTraversable` predicate (default = terrain-only, unchanged); `walkers.ts` threads a per-walker predicate into `startSeeking` and wandering neighbor selection.
- Confirmed graph-path-only travel: a Manhattan-near but road-unreachable granary is never served (A* returns null, path stays empty, stock untouched).
- Regenerated both goldens intentionally for the wandering-trajectory change (well walkers now return at maxRoadSteps); verified the diff is walker-position-only. Full suite: 313 tests / 51 files green; typecheck and lint clean.

## Task Commits

1. **Task 1: WalkerProfile schema contract test across the catalog** - (commits handled by orchestrator)
2. **Task 2: Wire profile data into walker behavior** - (commits handled by orchestrator)
3. **Task 3: Per-category roadblock permissions + graph-path confirmation** - (commits handled by orchestrator)

## Files Created/Modified
- `src/sim/walkerProfiles.ts` - `ROADBLOCK_POLICY_BY_CATEGORY`; `mayTraverse(profile, type)`; per-category `roadblockPolicy` in `walkerProfile`; DEFAULT_PROFILE derives movementSpeed/serviceTTL from CONFIG.
- `src/sim/walkers.ts` - `origin` + `stepsTaken` on WalkerInstance; profile consumption in updateWalker/applyCoverage/serviceHousesAround/handleArrival/decide/move; wandering return-at-maxRoadSteps; per-walker `traversableFor` predicate; permitted roadblock crossing at base speed.
- `src/sim/pathfind.ts` - optional `isTraversable` parameter on `findRoadPath` (default terrain-only).
- `tests/unit/walker-profile-contract.test.ts` - New: schema contract (3 tests).
- `tests/unit/walker-category-behavior.test.ts` - New: speed pipeline, serviceTTL, wandering return (4 tests).
- `tests/unit/walker-roadblock-permissions.test.ts` - New: policy config, path-bypass, pass traversal, stop enforcement, graph-path no-fallback (5 tests).
- `tests/golden/fixtures/*.json` - Regenerated for the wandering-trajectory mechanic change.

## Decisions Made
- Profile defaults are derived from `CONFIG.walkerSpeedPerTick` / `CONFIG.serviceCooldownTicks` (structural equality, not incidental) so wiring them in preserves baseline behavior and keeps the DATA-02 balance-parity invariant (every BALANCE key consumed as `CONFIG.<key>` in src/) green.
- A permitted (pass) walker crosses a service_roadblock at base speed because its 0 speedMultiplier would otherwise freeze it on the tile, contradicting the "pass walker traverses it" must-have. Non-permitted walkers never enter such tiles (predicate filters them).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Profile defaults derived from CONFIG to keep balance-parity invariant green**
- **Found during:** Task 2 (wire profile data) — full-suite run
- **Issue:** `move()` and `serviceHousesAround`/`handleArrival` stopped referencing `CONFIG.walkerSpeedPerTick` and `CONFIG.serviceCooldownTicks`, so the DATA-02 test "every BALANCE key is consumed as CONFIG.<key> outside the re-export" failed (IN-01).
- **Fix:** `DEFAULT_PROFILE.movementSpeed = CONFIG.walkerSpeedPerTick` and `DEFAULT_PROFILE.serviceTTL = CONFIG.serviceCooldownTicks` (values identical, 0.5 / 120). This makes the "defaults equal CONFIG" contract structural and re-wires the CONFIG consumers.
- **Files modified:** src/sim/walkerProfiles.ts
- **Verification:** Full suite green (308 tests at that point).
- **Committed in:** (commits handled by orchestrator)

**2. [Rule 1 - Bug] Permitted pass walkers cross a service_roadblock at base speed**
- **Found during:** Task 3 (roadblock permissions) — new market roadblock test
- **Issue:** A market ('pass') that entered a service_roadblock tile could never leave it: `roadSpeedMultiplier('service_roadblock')` is 0, so progress never reached 1 and the walker froze on the tile, contradicting "a 'pass' walker traverses it" (ROAD-03 must-have #5).
- **Fix:** In `move()`, a `service_roadblock` tile a walker may traverse (`mayTraverse` true) uses a 1x crossing speed; the 0 multiplier remains the block for non-permitted walkers.
- **Files modified:** src/sim/walkers.ts
- **Verification:** New market roadblock test asserts the market steps on and crosses the roadblock and reaches the granary (stock 10 → 5); full suite green (313 tests).
- **Committed in:** (commits handled by orchestrator)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug).
**Impact on plan:** Both fixes were necessary to satisfy plan must-haves (DATA-02 parity invariant; ROAD-03 'pass traverses' truth). No scope creep.

## Issues Encountered
- None beyond the two auto-fixed issues above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ROAD-03 complete: profiles consumed, wandering return proven, roadblock policies enforced, graph-path distance confirmed.
- Deferred as planned: official/senator (recruiter) spawning (WalkerType lacks them, Phase 14); per-walker profile overrides; paving UI.

---
*Phase: 03-road-graph-walker-categories*
*Completed: 2026-08-03*
