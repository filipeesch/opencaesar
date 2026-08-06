---
phase: 03-road-graph-walker-categories
fixed: 3
skipped: 2
findings_in_scope: 3
iteration: 1
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed:** 3 (2 warnings + 1 info) | **Skipped/deferred:** 2 (1 info observation, 1 info out of scope)
**Date:** 2026-08-03
**Scope:** auto fix of WR-01, WR-02 (warnings) and IN-01 (info, cheap + clearly correct).

## Fixed Findings

| ID | Severity | Finding | Fix | Verification |
|----|----------|---------|-----|--------------|
| WR-01 | warning | Stale `roadType` side-channel survives road demolition: paving then demolishing a road left `getTileState` reporting `road:false, roadType:'paved'` (`src/sim/map.ts:149`, `src/sim/runner.ts:421-423`). | `SimRunner.demolish` now clears `roadType` to `null` over the full demolished footprint when the building is a road, so terrain and the side-channel never disagree. | New unit test `demolishing a road clears the roadType side-channel too (WR-01)` in `tests/runner-accessors.test.ts`: places a road, paves it (`map.setRoadType(2,2,'paved')`), asserts `{road:true, roadType:'paved'}`, demolishes, asserts `road:false, roadType:null`. Confirmed to FAIL before the fix (repro: `roadType:'paved'` survived). |
| WR-02 | warning | `stop`-category walker frozen forever on a `service_roadblock` (0-speed trap, `src/sim/walkers.ts:302`): spawn path (`adjacentRoadTile`/`tickSpawns`, `src/sim/runner.ts:633-641,760-769`) never filtered spawn tiles by traversability, so a `stop` walker could be created on a block it can't cross and then advance `speed 0` forever. | Two-part fix — (a) entry-blocking, not exit: `walkers.move()` now gives a walker *already standing* on a roadblock base speed (1x) so it can leave instead of freezing; non-pass walkers still never *choose* a block as `next` (filtered by `traversableFor`/`findRoadPath`). (b) spawn filter: `tickSpawns()` picks the first adjacent road the spawned walker's profile `mayTraverse`s (`adjacentRoadTile` gained an optional suitability predicate); `stop` walkers never spawn onto a block they can't cross, `pass` walkers still may. | New suite `tests/unit/walker-roadblock-freeze.test.ts` (2 tests): (1) a `stop` well spawned directly ON a roadblock advances progress and walks off within 20 ticks (no indefinite `progress===0`); (2) a house flush against a roadblock-typed road plus a traversable road spawns the `labor` `stop` walker onto the traversable road and no walker ever occupies the block `(1,0)` across 30 ticks. Both confirmed to FAIL before the fix (walker spawned/stood on the block, `progress` frozen at 0). |
| IN-01 | info | Misleading `findRoadPath` docstring ("inclusive of start, exclusive of goal") + unreachable `path.shift()` guard in `startSeeking` (`src/sim/pathfind.ts:31-32`, `src/sim/walkers.ts:207`); path actually excludes both endpoints. | Corrected the docstring + reconstruction comment to "intermediate tiles strictly between start and goal (both excluded), reached by adjacency", and dropped the dead `path.shift()` guard. Behavior unchanged (verified: full suite green). | No behavior delta; full suite (316) + typecheck + lint pass. |

## Skipped / Deferred

| ID | Severity | Why |
|----|----------|-----|
| IN-02 | info | Observation only (golden diff's `waterCooldown 120→116` is a legitimate consequence of wander-return timing, not a bug). No action needed per instructions; would require updating the `03-03-SUMMARY.md` wording, out of fixer scope. |
| IN-03 | info | Out of scope for this pass: `spawnInterval`/`serviceRadiusFromCurrentTile`/`preferredDirection` are documented contract-placeholder fields deferred to a later phase; wiring them (or documenting the deferral in the plan) is a planning/summary decision, not a code fix. |

## Verification Results

- `npm run test`: **316 passed** (up from 313 baseline; +1 WR-01 test, +2 WR-02 tests). No golden regenerated — the golden scenarios contain no roadblocks/road-types, and `mayTraverse` matches terrain-only selection for normal roads, so the golden fixtures are unchanged and still green.
- `npm run typecheck`: clean.
- `npm run lint`: clean (`--max-warnings 0`).
- Pre-fix regression proof: reverting the two source fixes via `git stash` made exactly the 3 new tests fail (WR-01, WR-02a, WR-02b) — the tests genuinely guard the fixes.

## Commits

- `939df24` — `fix(03): clear roadType side-channel on road demolish (WR-01)`
- `a2e0daa` — `fix(03): stop-walkers never freeze on or spawn onto a service_roadblock (WR-02)`
- `bd14096` — `fix(03): correct findRoadPath return-shape docstring, fix dead startSeeking shift (IN-01)`

Note on commit scope: the Phase 3 implementation for `src/sim/walkers.ts` / `src/sim/pathfind.ts` had not been committed yet (working tree carried the whole phase), and my fixes are interleaved with that wiring in the same diff regions vs HEAD. To keep each commit's snapshot self-consistent and compiling, the WR-02 commit carries the walker-category wiring it builds on, and the IN-01 commit carries the `isTraversable` predicate its corrected docstring documents. Both commit bodies call this out.

`03-REVIEW.md` is intentionally **not** committed (per code-review-fix workflow); this report is committed by the orchestrator.
