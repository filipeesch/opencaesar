---
phase: 16-full-housing-evolution
reviewed: 2026-08-05T16:30:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/sim/housingLive.ts
  - src/sim/housingMerge.ts
  - src/sim/housing.ts
  - src/sim/runner.ts
  - src/sim/economy.ts
  - src/sim/advisors.ts
  - src/sim/walkers.ts
  - src/sim/types.ts
  - src/sim/housingEvolution.ts
  - data/housing.ts
  - data/validate.ts
  - data/balance.ts
  - tests/unit/housing-merge.test.ts
  - tests/integration/housing-evolution-live.test.ts
  - tests/determinism/housing-evolution-determinism.test.ts
  - tests/unit/housing-level-bridge.test.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: fixed
fixes:
  critical: 2
  warning: 4
  info: 1
  skipped: 2
  commits: [1667319, 5824c26, 4f28f92, 220f097, 4fd7050, 88eb77c, 7f36f26]
---

# Phase 16: Code Review Report

**Reviewed:** 2026-08-05T16:30:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found → fixed (CR-01, CR-02, WR-01..WR-04, IN-01 resolved; IN-02/IN-03 documented design notes) — see 16-REVIEW-FIX.md

## Summary

Adversarial review of the Phase 16 (21-level housing evolution + deterministic merging) implementation across the commits `b89bea9..96e0dce`. I read all changed source files, traced the economy/advisor/runner consumers, and empirically reproduced the merge-geometry defect against the shipped pure module with a temporary vitest repro (since removed).

**What is sound:** The 21-level `decideEvolution` wiring, counter hysteresis (both-counters-reset grace), derived `house.tier`, `liveStats` clamping/NaN-guard, no-RNG/clock in the new paths (audit clean), catalog validation gates, balance-parity cleanup, and golden regeneration intent are all correct. The shipped unit/integration/determinism/golden suites pass and `tsc --noEmit` is clean.

**What is broken:** The merge transform — the centerpiece of HOUS-02 — contains a real geometric defect (the block-fit check anchors at the survivor origin and never proves the target square contains the absorbed house, and footprint mismatches are not rejected), and the "combined population" produced by a merge is write-only state with no consumer and no serialization, so the documented HOUS-02 deliverable has no observable gameplay effect. Two findings are **Critical**.

## Critical Issues

### CR-01: Merge block-fit validates the wrong square — displaced/detached blocks and mismatched-footprint absorption

**Status:** ✅ fixed
**Fixed in:** `1667319` (src/sim/housingMerge.ts, src/sim/runner.ts, tests/unit/housing-merge.test.ts)

**File:** `src/sim/housingMerge.ts:114-126` (+ `src/sim/runner.ts:520-545`)
**Issue:** `mergeProposal` calls `blockFits(a.x, a.y, footprint, ...)` — the n×n square is anchored at the **survivor's** origin `a`, never at the union's minimum corner, and nothing verifies the target square actually contains the absorbed house's tiles nor that the two houses have compatible footprints. Two concrete failures, both reproduced empirically against the shipped module:

1. **Right/bottom-anchor detach:** when the scan anchor `a` is the right-hand member of an adjacent pair (e.g. `a=(6,5)`, `b=(5,5)`), the 2×2 square anchored at `(6,5)` covers `(6,5)-(7,6)` — it does **not** contain the absorbed house's origin tile `(5,5)`. The merge proceeds, the block jumps right/down and the absorbed tile is freed, leaving a detached hole. My repro asserted `blockCoversAbsorbedOrigin=false` while `mergeProposal` returned a non-null proposal. The shipped unit test `survivor keeps the anchor` only exercises the left-anchor orientation (`5,5`+`6,5`), so this path is untested.
2. **Footprint mismatch absorption:** a 1×1 house at level 11 (evolved but never merged) can merge with and **absorb an already-2×2 same-level house** — nothing checks the neighbour's footprint. `mergeProposal` returned a valid proposal for `a=(6,5,1x1)`, `b=(7,5,2x2)`. The 1×1 survivor becomes a 2×2 block at its origin and up to 3 tiles of the larger absorbed structure are freed, destroying a larger structure and potentially severing the merged footprint from adjacent buildings.

Because the merge runs on the deterministic %40 cadence and replay re-derives it, this produces incorrect but *deterministic* state — it will not show up as a flaky test and may silently ship.

**Fix:**
- Anchor the target square at the union min-corner: `originX = min(a.x, b.x)`, `originY = min(a.y, b.y)`.
- Require that the union of both houses' tile sets is a subset of the target square (the square must cover the absorbed house fully), i.e. `b.x >= originX && b.x + b.footprint <= originX + footprint` (and same for y).
- Reject footprint mismatches that the square cannot contain — either require equal footprints, or require `absorbed.footprint <= footprint` with the containment check above.

```ts
export function mergeProposal(a, b, footprint, isOccupied, exemptTileKeys) {
  if (!a.house || !b.house) return null;
  if (a.house.level !== b.house.level) return null;
  if (b.house.mergeable !== true) return null;
  const originX = Math.min(a.x, b.x);
  const originY = Math.min(a.y, b.y);
  // The target square must contain BOTH houses entirely.
  const contains = (h) =>
    h.x >= originX && h.x + h.footprint <= originX + footprint &&
    h.y >= originY && h.y + h.footprint <= originY + footprint;
  if (!contains(a) || !contains(b)) return null;
  if (!blockFits(originX, originY, footprint, isOccupied, exemptTileKeys)) return null;
  // Survivor keeps id/origin, but the block is placed at the union corner.
  return { survivor: a, absorbed: b, footprint, originX, originY };
}
```
Add unit fixtures for the right-anchor (`a=(6,5), b=(5,5)`) and the above-anchor orientations, and for the 1×1-vs-2×2 mismatch.

### CR-02: Merged "combined population" is write-only state — no consumer, so merged houses contribute no combined population anywhere

**Status:** ✅ fixed
**Fixed in:** `5824c26` (src/sim/housingLive.ts, src/sim/economy.ts, src/sim/advisors.ts, src/sim/runner.ts, tests/unit/economy.test.ts, tests/integration/housing-evolution-live.test.ts)

**File:** `src/sim/runner.ts:482-543` (write), `src/sim/economy.ts:24,55,76`, `src/sim/runner.ts:2746,1593`, `src/sim/advisors.ts:582`
**Issue:** On a successful merge the survivor stores `combinedPopulation = effectivePop(a) + effectivePop(b)` (runner.ts:540-541), and automatic merge ladder growth (2×2→4×4, integration test line 255 expects `2 * liveStats(20).population`) depends on it. But every consumer reads only `liveStats(level).population`:
- `economy.ts:76` `populationOf` → level capacity only
- `economy.ts:24` `workerPool`, `economy.ts:55` `tickEconomy` tax → level values only
- `runner.ts:1593` happiness weighting, `runner.ts:2746` `toBuildingState.populationCapacity`, `advisors.ts:582` food-days projection → level values only

So a 2×2 block formed by merging two level-11 houses (combined 480) counts as **240** in the city population/prosperity/tax/happiness and is displayed with capacity 240. The HOUS-02 truth "the survivor … produces the combined population" is never realized in any observable number, and because `getSaveData()` serializes only commands+tickCount, `combinedPopulation` is also not durable across save→load (replay regenerates a value that nothing reads). The field is consumed solely by `effectiveHousePopulation` for *subsequent* merges, making double-counting accumulation internally consistent but functionally inert.

**Fix:** route every population consumer through the effective-population helper (shared module function, e.g. export from `housingLive.ts`):

```ts
export function effectivePopulation(h: { house?: { combinedPopulation?: number; level?: number } }): number {
  if (h.house?.combinedPopulation !== undefined) return h.house.combinedPopulation;
  return liveStats(h.house?.level ?? 0).population;
}
```
Then `populationOf`, `workerPool`, `tickEconomy` tax, the getState happiness weighting, the advisor food-days projection, and `toBuildingState.populationCapacity` should read `effectivePopulation(b)` instead of `liveStats(level).population`. The derived population numbers and goldens will shift — regenerate goldens as an intentional change and extend the determinism save→load test to the merged city (see WR-02).

## Warnings

### WR-01: Level-20 houses can never devolve from lost requirements (baseOk is vacuous at the top of the ladder)

**Status:** ✅ fixed
**Fixed in:** `4f28f92` (src/sim/housing.ts) + `220f097` (tests/unit/housing.test.ts cap-test adaptation) + regression test in tests/integration/housing-evolution-live.test.ts

**File:** `src/sim/housing.ts:163-175`
**Issue:** `baseOk` gates on `requirementsMet(next, satisfied)` where `next = level + 1`. At `level === 20`, `next = 21` has no catalog entry, and `housingLive.requirementsMet` returns `true` when the level def is missing (`housingLive.ts:101-102`). Combined with `normalized >= (nextDef?.desirability ?? 0)` (= `>= 0`), a level-20 house that keeps food/water/labor and any desirability will keep incrementing `satisfiedTicks` and resetting `unsatisfiedTicks = 0` **even if it loses a current-level requirement** (e.g. the `grand_temple` reach requirement for level 20). `decideEvolution`'s devolve branch checks `requirementsSatisfied(currentLevel /* 20 */, …)` and then requires `unsatisfiedTicks >= toleranceTicks (90)` — which never accumulates. Result: a level-20 Luxury Villa that loses its grand_temple/forum/senate service access never devolves (it can only devolve via the desirability-tolerance path if desirability drops below 15). Fix: make `baseOk` fail-safe at the max level — when `nextDef` is undefined, evaluate the *current* level's requirements instead:

```ts
const nextDef = HOUSING_LEVELS.find((l) => l.level === next);
const reqTarget = nextDef ? next : level; // at level 20, fall back to current-level reqs
const baseOk =
  hasFood && hasWater && hasLabor &&
  requirementsMet(reqTarget, satisfied) &&
  normalized >= (nextDef?.desirability ?? 0);
```

### WR-02: Save→load determinism is only asserted on the non-merge city, not the merged one

**Status:** ✅ fixed
**Fixed in:** `4fd7050` (tests/determinism/housing-evolution-determinism.test.ts — merged-city save→load byte-identity leg)

**File:** `tests/determinism/housing-evolution-determinism.test.ts:132-142`
**Issue:** The HOUS-02 truth requires "a `getSaveData() → fromSaveData()` round-trip … with counters and combined population included". The chunked (1/7/50) test covers the *merging* city, but the save→load round-trip test uses the **natural-economy food-chain city** (no merge, no combined population). No test proves a city that actually merged replays byte-identically (merged footprint, re-keyed occupancy, `house-merged` message history, combined population). Fix: change the save→load test to round-trip the merging city (houses planted at level 11, run past the %40 merge), and assert `building.footprint === 2`, `combinedPopulation`, and `getStateJson()` byte-identity.

### WR-03: Walker-target safety on merge is implemented but never tested

**Status:** ✅ fixed
**Fixed in:** `88eb77c` (src/sim/runner.ts repoints trade.sourceBuildingId too + regression test in tests/integration/housing-evolution-live.test.ts)

**File:** `src/sim/runner.ts:551-560` (`repointWalkersTowards`), tests
**Issue:** The plan explicitly required "Add a test that a walker targeting the absorbed house does not break the replayed state." No such test exists — `repointWalkersTowards` (which also does not handle `trade.sourceBuildingId`, though houses are not storage sources) runs only inside the live merged scenario, and no fixture forces a walker whose `targetBuildingId` points at the absorbed id. Fix: in the merge integration scenario, plant a walker targeting the absorbed house before the %40 tick and assert it is repointed to the survivor id and the resulting state is valid.

### WR-04: `LEVEL_TAX_PER_WORKER` comment contradicts the code (says 3× workers, applies 5× workers)

**Status:** ✅ fixed
**Fixed in:** `7f36f26` (src/sim/housingLive.ts — doc comment aligned to LEVEL_TAX_PER_WORKER = 5)

**File:** `src/sim/housingLive.ts:42-56` (comment), `:60` (code)
**Issue:** The doc comment twice states the floor is "3 × the level's workers" / "the floor of 3×workers", but `levelTaxPerTick` computes `Math.max(LEVEL_TAX_PER_WORKER * levelWorkers(def), derived)` with `LEVEL_TAX_PER_WORKER = 5` — a 5× floor. The balance-parity rationale (break-even ≈ 2.7×workers) is satisfied either way, so this is not a behavior bug, but the stale 3×/5× text will mislead future tuning of a solvency-critical knob. Fix: update the comment to "floored at 5 × the level's workers (LEVEL_TAX_PER_WORKER)" or rename the constant to `LEVEL_TAX_WORKER_MULTIPLIER`.

## Info

### IN-01: Dead branch in `levelDesirability`

**Status:** ✅ fixed
**Fixed in:** `7f36f26` (src/sim/housingLive.ts — redundant `v < 0` guard removed)

**File:** `src/sim/housingLive.ts:72-78`
**Issue:** `if (raw <= 0) return 0;` already handles all negatives, making the later `if (v < 0) return 0;` after `Math.round(raw / 6)` unreachable. Remove the redundant guard.

### IN-02: `deriveSatisfied` treats `fountain` as satisfied by any water source

**Status:** ⏭️ skipped (documented design note, not a defect — the well→fountain distinction is deferred to balance tuning / future gate)

**File:** `src/sim/housingLive.ts:134`
**Issue:** Any water access pushes both `'well'` and `'fountain'` into `satisfied`, so the fountain-only requirements on levels 5+ are met by a plain well — the fountain building never gates progression and is devalued. This matches the plan's documented key map, so it is a design note, not a code defect; consider distinguishing `well` from `fountain` (service already distinguishes them via `SERVICE_BY_WALKER`/cooldowns) if the ladder's well→fountain progression is meant to be real.

### IN-03: `baseOk`/`decideEvolution` desirability gap creates a "stuck" band at every level

**Status:** ⏭️ skipped (documented planned hysteresis intent — eligibility precondition vs padded threshold; not a defect)

**File:** `src/sim/housing.ts:165-175`
**Issue:** `baseOk` requires only the un-padded base desirability (`>= nextDef.desirability`) while `decideEvolution` requires `>= desirability + 5`. A house hovering in the `[base, base+5)` band accumulates `satisfiedTicks` (and resets `unsatisfiedTicks`), so it neither evolves nor starts its devolution clock. This matches the planned hysteresis intent (eligibility precondition vs padded threshold) and is not a defect, but it means desirability-only losses in that band never count toward devolution tolerance. Noted for future balance tuning.

---

_Reviewed: 2026-08-05T16:30:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
