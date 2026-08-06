---
phase: 16-full-housing-evolution
fixed_at: 2026-08-05T16:24:43Z
review_path: .planning/phases/16-full-housing-evolution/16-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
verification:
  typecheck: pass
  targeted_tests: "housing-merge, housing-level-bridge, housing, economy, advisors, housing-evolution-live, housing-evolution-determinism, data-catalog, balance-parity, golden: 101 tests" pass
  full_suite: "112 files / 823 tests" pass
  golden_update: not_required (golden cities never merge; non-merged effectivePopulation == liveStats, so fixtures unchanged)
  check_military: clean
  catalog_validation: "validateCatalogs() === []" pass
  ran_in: isolated git worktree /tmp/sv-16-reviewfix-SpJFpi (node_modules symlinked from main checkout; results reproducible from the worktree tree)
---

# Phase 16: Code Review Fix Report

**Fixed at:** 2026-08-05T16:24:43Z
**Source review:** `.planning/phases/16-full-housing-evolution/16-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning per 16-FIX-DISPATCH.md): 6
- Fixed: 6
- Skipped: 0
- Info findings (optional): IN-01 fixed as trivial; IN-02 / IN-03 skipped as documented design notes (out of scope).

## Fixed Issues

### CR-01: Merge block-fit validates the wrong square — displaced/detached blocks and mismatched-footprint absorption

**Files modified:** `src/sim/housingMerge.ts`, `src/sim/runner.ts`, `tests/unit/housing-merge.test.ts`
**Commit:** `1667319`
**Applied fix:** `mergeProposal` now anchors the target block at the **union min-corner** (`originX = min(a.x,b.x)`, `originY = min(a.y,b.y)`) and requires the target square to fully CONTAIN both houses' current footprint. The absorbed house must fit inside the square (`absorbed.x >= originX && absorbed.x + absorbed.footprint <= originX + footprint`, same for y), so a 1×1 level-11 house can no longer absorb an already-2×2 same-level structure, and a right/below-anchor pair merges into a block that still contains the absorbed origin (no detached block / freed hole). `MergeProposal` carries `originX/originY`; the runner relocates the survivor to that corner (so its footprint geometry matches the placed square for later merges) and re-keys the whole square. Regression fixtures added for the right-anchor pair (`a=(6,5),b=(5,5)`), below/above-anchor pairs, and the 1×1-vs-2×2 footprint mismatch (all rejected/anchored correctly).

### CR-02: Merged "combined population" is write-only state — no consumer

**Files modified:** `src/sim/housingLive.ts`, `src/sim/economy.ts`, `src/sim/advisors.ts`, `src/sim/runner.ts`, `tests/unit/economy.test.ts`, `tests/integration/housing-evolution-live.test.ts`
**Commit:** `5824c26`
**Applied fix:** Added shared consumer-facing accessors in `housingLive.ts` — `effectivePopulation(b)` (returns `combinedPopulation` when set, else `liveStats(level).population`) and effective `workers`/`taxPerTick` that scale the level value by the merged-population ratio. Routed **every** observable consumer through them: `economy.populationOf`, `economy.workerPool`, `economy.tickEconomy` tax, `runner.getState` happiness weighting, `runner.toBuildingState.populationCapacity` (so the merged figure is serialized to `SimState`/golden-visible surface), and `advisors.foodOverlayGrids` food-days projection. `runner.effectiveHousePopulation` now delegates to the shared helper. A merged 2×2 of two level-11 houses now counts 480 (population/workers/tax/capacity) instead of 240. Tests assert the doubling at the consumer level: `ratings.population`, `totalWorkers`, serialized `populationCapacity` in the live merge scenario, plus pure unit tests for `populationOf`/`workerPool`/`tickEconomy`. Determinism holds (chunked + round-trip byte-identity still green). Goldens were **not** regenerated: the golden cities never merge, so non-merged `effectivePopulation` equals `liveStats` and no fixture value changed.

### WR-01: Level-20 houses can never devolve from lost requirements

**Files modified:** `src/sim/housing.ts`, `tests/unit/housing.test.ts`, `tests/integration/housing-evolution-live.test.ts`
**Commits:** `4f28f92` (source) + `220f097` (unit cap-test adaptation)
**Applied fix:** `baseOk` now resolves the requirement target as `reqTarget = nextDef ? next : level` — at the top of the ladder (level 20, next level 21 undefined), it checks the **current** level's requirements instead of the vacuous `requirementsMet(21)`. A Luxury Villa that loses a current-level requirement (e.g. grand_temple reach) now accumulates `unsatisfiedTicks` and the `decideEvolution` devolve branch (tolerance 90) is reachable at level 20. Added a live integration regression test that holds a level-20 house then lapses god access and asserts `house-devolved` + level < 20 (verified red on the pre-fix code). The existing "never evolves above level 20" unit test was updated to actually satisfy level-20's requirement set (its old premise — a requirement-less level-20 house stays forever — was precisely the vacuous behavior being fixed).

### WR-02: Save→load determinism only asserted on the non-merge city

**Files modified:** `tests/determinism/housing-evolution-determinism.test.ts`
**Commit:** `4fd7050`
**Applied fix:** Added a **merged-city save→load round-trip** describe that constructs a level-11 merge city, runs past the %40 merge, saves, reconstructs a fresh runner from the save's command stream, re-applies the deterministic test drive (level plant + warehouse stock + pump — per-house evolution state is not serialized and HOUS-02 forbids new SaveCommand kinds), and asserts `getStateJson()` **byte-identity**, `building.footprint === 2`, `combinedPopulation === 2 * liveStats(11).population`, and identical `house-merged` message history. The replay re-derives the merge, so the combined population is proven durable across the save/load boundary.

### WR-03: Walker-target safety on merge implemented but never tested

**Files modified:** `src/sim/runner.ts`, `tests/integration/housing-evolution-live.test.ts`
**Commit:** `88eb77c`
**Applied fix:** `repointWalkersTowards` also repoints `trade.sourceBuildingId` (defensive — houses are not storage sources, but a carrier's source/storage objective must never dangle at an absorbed id). Added an integration regression test: bring the merge pair to tick 39, inject a walker whose `targetBuildingId` points at the absorbed house `b`, tick across the %40 boundary (merge runs), and assert the walker is repointed to the survivor `a`, the survivor carries the 2×2 footprint, and `b` is gone from the registry.

### WR-04: `LEVEL_TAX_PER_WORKER` comment contradicts the code

**Files modified:** `src/sim/housingLive.ts`
**Commit:** `7f36f26`
**Applied fix:** Doc comment aligned to the code: the tax-per-tick floor is `LEVEL_TAX_PER_WORKER = 5` × workers (was incorrectly described as "3 ×"). No behavior change; the balance-parity rationale (break-even ≈ 2.7×workers) is documented with the 5× margin.

## Skipped Issues

None — all 6 in-scope (Critical + Warning) findings were fixed.

Out-of-scope Info treatment (not counted above):
- **IN-01 (dead branch in `levelDesirability`)** — fixed trivially in `7f36f26`.
- **IN-02 (`fountain` satisfied by any water source)** — skipped: documented design note matching the plan's key map; well→fountain distinction deferred to balance tuning.
- **IN-03 (`baseOk`/`decideEvolution` desirability gap)** — skipped: recorded planned hysteresis intent, not a defect.

## Verification

All checks ran inside the isolated worktree `/tmp/sv-16-reviewfix-SpJFpi` (node_modules symlinked from the main checkout; results reproducible from that tree).

| Gate | Result |
|------|--------|
| `tsc --noEmit` (typecheck) | pass |
| Targeted suites (housing-merge, housing-level-bridge, housing, economy, advisors, housing-evolution-live, housing-evolution-determinism, data-catalog, balance-parity, golden) | 101 tests pass |
| Full suite `NODE_OPTIONS=--max-old-space-size=4096 vitest run --maxWorkers=4` | 112 files / 823 tests pass (2 consecutive runs; only a benign vitest worker "onTaskUpdate" RPC timeout reported — zero test failures) |
| Golden fixtures | pass WITHOUT `test:golden:update` — no regeneration needed (golden cities never merge; merged-population change does not touch any fixture value) |
| `npm run check:military` | clean |
| `validateCatalogs()` | `=== []` |
| Determinism | chunked 1/7/50 + save→load (natural + merged city) byte-identical |

## Commits

| Commit | Finding | Scope |
|--------|---------|-------|
| `1667319` | CR-01 | merge geometry |
| `5824c26` | CR-02 | combined-population consumers |
| `4f28f92` | WR-01 | level-20 baseOk fallback |
| `220f097` | WR-01 (test) | level-20 cap unit test adaptation |
| `4fd7050` | WR-02 | merged save→load determinism |
| `88eb77c` | WR-03 | walker-repoint + test |
| `7f36f26` | WR-04 + IN-01 | comment + dead branch |

---

_Fixed: 2026-08-05T16:24:43Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
