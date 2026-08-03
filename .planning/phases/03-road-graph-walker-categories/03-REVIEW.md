---
phase: 03-road-graph-walker-categories
reviewed: 2026-08-03T12:30:00Z
depth: deep
files_reviewed: 18
files_reviewed_list:
  - src/sim/roadNet.ts
  - src/sim/roadTypes.ts
  - src/sim/map.ts
  - src/sim/tile.ts
  - src/sim/types.ts
  - src/sim/housing.ts
  - src/sim/walkers.ts
  - src/sim/walkerProfiles.ts
  - src/sim/pathfind.ts
  - src/sim/runner.ts
  - src/sim/rng.ts
  - src/sim/config.ts
  - data/walkers.ts
  - tests/unit/roadnet.test.ts
  - tests/unit/road-type-wiring.test.ts
  - tests/unit/road-type-effects.test.ts
  - tests/unit/walker-profile-contract.test.ts
  - tests/unit/walker-category-behavior.test.ts
  - tests/unit/walker-roadblock-permissions.test.ts
  - tests/unit/walkers.test.ts
  - tests/property/invariants.test.ts
  - tests/runner-accessors.test.ts
  - tests/golden/fixtures/food-chain-golden.json
  - tests/golden/fixtures/paused-commands-golden.json
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-08-03T12:30:00Z
**Depth:** deep
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Reviewed the Phase 3 (Road Graph & Walker Categories) implementation: `RoadNetwork` connectivity/dirty-region fixes (03-01), per-tile `roadType` side-channel wired into walker speed and house desirability (03-02), and `WalkerProfile` wiring incl. `mayTraverse`/roadblock policies and wander-return-at-`maxRoadSteps` (03-03), plus the five new/updated unit suites.

Positive verification: determinism is preserved — no `Math.random` in `src/sim/` (only `src/game/scenes/HomeScene.ts` UI), all randomness flows through the seeded RNG (rng.ts:6); the wandering return-at-maxRoadSteps logic is provably radius-bounded (Manhattan distance from origin can never exceed the step count, and forced-homeward starts exactly at `maxRoadSteps`, so `maxDist <= maxRoadSteps` holds even on branches); the property invariants ("walkers never leave the road graph") pass; graph-path-only travel (no Euclidean fallback) is confirmed; typecheck, lint, and the full 313-test suite are green.

Findings: no critical issues. Two warnings — both real, behavior-observable state inconsistencies in the new side-channel/movement code (confirmed empirically): (1) the `roadType` side-channel is never cleared when terrain stops being a road, so a demolished paved road leaves `roadType:'paved'` on an earth tile in the public `getTileState`; (2) a `stop`-category walker standing on a `service_roadblock` tile is frozen forever (0-speed trap), reachable because the spawn path (`adjacentRoadTile`) does not filter spawn tiles by traversability. Three info items (dead/misleading pathfind comment + unreachable shift, inaccurate golden-diff summary claim, plumbed-but-unconsumed profile fields).

## Warnings

### WR-01: Stale `roadType` side-channel survives road demolition

**File:** `src/sim/map.ts:149` (and `src/sim/runner.ts:421-423`)
**Issue:** `Map.setRoadType` applies to any tile regardless of terrain, and `Map.roadTypeAt` returns the raw side-channel value. `SimRunner.demolish` resets a road's terrain to `'earth'` (runner.ts:422) but never clears the tile's `roadType`. Consequence: pave a road via `map.setRoadType(x,y,'paved')`, then demolish it — `runner.getTileState(x,y)` reports `{ road: false, roadType: 'paved' }`, i.e. public sim state contradicts terrain. Verified empirically (`ROADTYPE_AFTER_DEMOLISH= paved`). Current call sites are guarded (housing.ts:56 checks terrain; walkers.ts only step to road tiles), so this does not corrupt behavior today, but any future consumer of `roadTypeAt` that trusts it without a terrain check (UI paving preview, rendering, save/load of road type) will read phantom road types on non-road tiles indefinitely.
**Fix:** Clear the side-channel when terrain leaves the road type — e.g. in `runner.demolish` call `map.setRoadType(x, y, null)` over the reset footprint — and/or make `setRoadType` a no-op unless `map.get(x,y) === 'road'`. Guarding `setRoadType` by terrain alone also prevents a tile's road type from outliving its road in every code path.

### WR-02: `stop`-category walker soft-locked forever on a `service_roadblock`

**File:** `src/sim/walkers.ts:302` (with `src/sim/runner.ts:633-641`, `760-769`)
**Issue:** `move()` computes speed as `rt === 'service_roadblock' && mayTraverse(profile, rt) ? 1 : roadSpeedMultiplier(rt)`. For any walker whose `roadblockPolicy !== 'pass'`, `mayTraverse` is false, so crossing a `service_roadblock` yields `speed = 0` and `progress += movementSpeed * 0 = 0` forever. A `stop` walker that ever ends up standing on a roadblock tile can neither advance along its chosen `next` nor ever cross 1, and it remains stuck until lifetime expiry. This is reachable: `SimRunner.tickSpawns` → `adjacentRoadTile` (runner.ts:760-769) picks the first road-adjacent tile without checking road type, so a building flush against a `service_roadblock`-typed road spawns a `well` (or any wanderer) directly onto the block. Verified empirically: a well spawned on a roadblock shows `moved-states=0, progress=0` across 60 ticks. The pass-walker crossing is fine (tested), but the non-pass freeze trap is unhandled.
**Fix:** The `0` multiplier should block *entry*, not *exit*. Options: (a) in `move()`, if `mayTraverse` is false but the walker is already standing on the roadblock, allow leaving it at base speed (only disallow *choosing* it as a next tile, which `traversableFor`/`findRoadPath` already prevent for stop walkers); or (b) make `adjacentRoadTile`/`tickSpawns` skip non-traversable spawn tiles (pick the first adjacent road the spawned walker's profile `mayTraverse`s). (b) alone leaves the "roadblock typed under a walker at runtime" case, so (a) is the more robust fix.

## Info

### IN-01: Misleading pathfind docstring + unreachable start-tile shift

**File:** `src/sim/pathfind.ts:31-32`, `src/sim/walkers.ts:207`
**Issue:** `findRoadPath`'s comment claims the return is "inclusive of start, exclusive of goal", but the reconstruction (pathfind.ts:74-78) unshifts only nodes whose parent is neither null nor start — the path actually excludes *both* endpoints. Consequently the defensive `if (path[0] === walker current tile) path.shift()` in `startSeeking` (walkers.ts:207) can never fire (path[0] is always adjacent to, never equal to, the walker's tile) and is dead code. Behavior is correct either way; the comment and the dead guard mislead future readers.
**Fix:** Correct the docstring to "returns the intermediate tile path between start and goal (both excluded)" and drop the unreachable `path.shift()` guard (or, if defensive against future path-shape changes is desired, keep it but fix the comment above it in `startSeeking`).

### IN-02: Golden fixture diff is not strictly walker-position-only

**File:** `tests/golden/fixtures/food-chain-golden.json`
**Issue:** `03-03-SUMMARY.md` states the regenerated goldens "verified the diff is walker-position-only", but the actual diff also changes a house field — `waterCooldown: 120 → 116` (food-chain fixture). This is a legitimate consequence of the wander-return mechanic changing how often a well reaches nearby houses, not a bug — but the summary's claim is inaccurate, which matters because downstream "golden changed only X" checks can mask unintended behavior drift.
**Fix:** Update the summary wording (e.g. "walker-trajectory-driven changes to house service cooldowns") and, if a baseline of only-positional change is wanted, document which fields may legitimately vary.

### IN-03: `WalkerProfile` fields plumbed but not consumed; no per-walker variety

**File:** `src/sim/walkerProfiles.ts:25,32-33`, `src/sim/runner.ts:624-626`
**Issue:** The contract test pins `spawnInterval`, `serviceRadiusFromCurrentTile`, and `preferredDirection` on every profile, but none is wired into behavior: `SimRunner.tickSpawns` still uses `BUILDINGS[type].spawnEveryTicks` / `CONFIG.laborSpawnEveryTicks` rather than `profile.spawnInterval`, and radius/preferredDirection have no consumers. Additionally every walker shares the identical default `allowedRoadTypes`/`maxRoadSteps`/`movementSpeed`, so `allWalkerProfiles()` returns nine distinct categories but functionally one behavior profile. This is acceptable for ROAD-03 (which only required wiring `movementSpeed`/`serviceTTL`/`maxRoadSteps`), but the schema-as-promise now overstates per-type differentiation.
**Fix:** Either wire `spawnInterval` into `tickSpawns` (behavior-neutral: recruiter 60 / default 40 already matches for `well`/`market` if configured) or note in the plan/summary that `spawnInterval`, `serviceRadiusFromCurrentTile`, `preferredDirection` are contract-placeholder fields deferred to a later phase, so dead-config is intentional and documented.

---

_Reviewed: 2026-08-03T12:30:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
