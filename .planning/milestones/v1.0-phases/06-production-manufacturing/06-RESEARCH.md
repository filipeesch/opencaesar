# Phase 6: Production & Manufacturing — Research

**Date:** 2026-08-03
**Researcher:** gsd-phase-researcher + gsd-planner (combined session)
**Baseline verified:** `npm run typecheck` clean; `npm run test` → **424 tests pass**
across 57 files (~3s). `tests/unit/production.test.ts` holds 6 tests in 3 describe
blocks. Suite is fast enough for per-task sampling: targeted <1s, full ~3s.

---

## 1. Existing Implementation Summary

`src/sim/production.ts` is a **pre-drafted, standalone model layer** (header:
"Phase 6 — tasks 5.1, 5.2, 5.3"). It is self-contained (no Phaser, no RNG, no wall
clock) and — critically for decision 4 — **is not referenced by any `src/sim/*`
module** (grep across `src/` finds only `tests/unit/production.test.ts`,
`tests/unit/logistics.test.ts:5`, and `tests/integration/supply-chains.test.ts:8`
importing it).

### PROD-01 — Extraction sites with deposit requirements
- `EXTRACTION_SITES` (production.ts:38-43): clay_pit→clay (0.3/tick),
  timber_yard→timber (0.3), iron_mine→iron (0.25), marble_quarry→marble (0.2).
  Each carries a `requires` string: `clay_deposit`, `trees`, `iron_deposit`,
  `marble_deposit` (production.ts:17-23, 39-42).
- `ExtractionSite` (production.ts:14-23) also carries `outputPerTick`.
- **Gap (GENUINE):** `requires` is **unenforced everywhere** — no placement gate,
  no read of `TileState.resourceType` (tile.ts:14-15, which CORE-03 exposes but
  map generation never populates — map.ts:63-132 `generate` calls `set` for
  terrain only), no runtime halting of a site built off-deposit, no deposit
  field on the runtime `BuildingDef` (src/sim/buildings.ts:4-28). The only
  "test" is `production.test.ts:8-13` asserting the string value exists.
- The `data/buildings.ts` catalog lists raw producers (data/buildings.ts:121-144,
  incl. `quarry` → marble at 141-144) with `produces` but **no deposit
  requirement**; `data/validate.ts` (49-112) checks footprints/costs/workers only.

### PROD-02 — Workshops: input/output stock, progress, porter, destination, bottlenecks
- `WORKSHOPS` (production.ts:45-51): pottery(clay→pottery), carpentry
  (timber→furniture), oil_press(olives→oil), winery(grapes→wine),
  metallurgy(iron→tools); each `stockCapacity: 8`.
- `ProductionState` (53-60): `inputs`/`output` records, `active`, `blocked`.
- `workshopStatus` (66-76): `working | missing_input | output_full | blocked`
  (blocked when `!s.active`); `emptyProduction` (62-64).
- `tickWorkshop` (78-90): consumes 1 unit per input, produces up to
  `outputPerTick` (capped by capacity), and sets `s.blocked` for every
  non-working state. **Non-destructive audit:** every branch returns `produced:0`
  without touching `s.inputs`/`s.output` — goods ARE preserved
  (missing_input/output_full/blocked all safe by inspection).
- `porterDelivers` (92-98): decrements workshop output by 1 and returns 1 when
  output ≥ 1 — **but never adds to any destination stock**.
- `selectDestination` (100-118): generic max-need-score picker; returns null when
  all scores ≤ 0 ("blocked, nothing destroyed").
- **Gap (GENUINE):** the §16.4 selection policy
  **workshop (nearest + neediest) → warehouse → blocked/keep-load** is *not*
  encoded anywhere — `selectDestination` is policy-free (only a comparator),
  there is no factory pairing a finished load with a validated destination
  (accepts + capacity), and no function moves output into a destination's stock.
- **Gap (test, decision 2):** existing tests call `tickWorkshop` then
  `porterDelivers` as separate hand-waves (production.test.ts:17-49,
  supply-chains.test.ts:43-58) — never asserting the full chain
  input-consumed → output-produced → porter-dispatched → **destination stock
  rises** (workshop AND warehouse destinations).
- **Gap (test, decision 3):** only `output_full` "produces nothing" is tested
  (production.test.ts:34-41); there is no test locking that missing_input /
  blocked / no-valid-destination preserve existing stock (no-loss).

### PROD-02 — Bottleneck states reported (advisor surface)
- `productionInspection` (advisors.ts:163-167) is a generic stub `(inputs,
  output, status) → dataset`; there is **no production advisor builder that
  derives rows from a live `SimState`** (contrast the food advisor:
  `foodAdvisorFromState`, advisors.ts:379-427). `LogisticsAdvisorView` /
  `logisticsAdvisor` (logistics.ts:144-163) cover stock/production/consumption/
  in-transit/bottlenecks/stopped but have no workshop/extraction wiring in the
  runner.
- **Gap (GENUINE, decision 4):** `SimRunner.tick()` (runner.ts:173-216) steps
  food (`tickFood` 689-728) but has **no extraction/workshop stepping and no
  porter dispatch**; `BuildingInstance` (walkers.ts:82-98) has no production
  state; the runtime building catalog (src/sim/buildings.ts:30-164) and
  `BuildingType` (types.ts:17-20) lack the raw/workshop/warehouse types, so none
  of it is placeable or steppable in the live sim.

### Determinism (decision 5)
- **Audit:** `src/sim/production.ts` contains only pure arithmetic and reads of
  injected state — **no `Math.random`, `Date`, `Date.now`, or
  `performance.now`** anywhere in the module (reviewed line-by-line). The model
  is deterministic for identical inputs.
- **Gap (test):** no chunked-tick determinism test covers the production chain —
  the existing chunked test (determinism.test.ts:55-76) scripts only the food
  city (`buildFoodCity`, helpers.ts:37-55). Runner stepping (decision 4) must
  exist before this test can run.

---

## 2. Gaps vs Requirements

| Requirement | Status | Gap |
|-------------|--------|-----|
| PROD-01 four extraction sites with output | ✅ as-built | `EXTRACTION_SITES` + keys asserted (production.ts:38-43, production.test.ts:8-13) |
| PROD-01 deposit requirement (placement/runtime) | ❌ genuine | `requires` unenforced; no deposit gate; TileState.resourceType never read; no deposit field on runtime BuildingDef; data catalog raw producers lack deposit field |
| PROD-02 workshop input consumption + output stock | ✅ as-built | `tickWorkshop` + status (production.ts:78-90), unit tests |
| PROD-02 progress / porter / destination | ❌ partial | `porterDelivers` decrements only; no `porterDestination` (§16.4) validity; no destination-stock move |
| PROD-02 bottleneck states (working/missing_input/output_full/blocked) | ✅ as-built | `workshopStatus` (66-76); no-loss behavior verified by inspection, untested |
| PROD-02 destination selection (needy workshop > warehouse > blocked) | ❌ genuine | generic `selectDestination` only; no policy fn; no warehouse-fallback test |
| Multi-step pipeline test (D2) | ❌ genuine | no input→output→porter→destination-stock-rise test (workshop + warehouse) |
| Blocked-state no-loss tests (D3) | ❌ gap | output_full tested; missing_input/blocked/no-destination no-loss untested |
| SimRunner tick integration (D4) | ❌ genuine | production.ts unreferenced by src/sim/*; no tickProduction; no runnable extraction/workshop in live sim |
| Production advisor data (D4) | ❌ genuine | generic productionInspection stub only; no SimState-derived production advisor |
| Determinism (D5) | ✅ model / ❌ test | model RNG/clock-free; no chunked-tick determinism test for the chain |

---

## 3. Open Questions (all RESOLVED)

| # | Question | Resolution |
|---|----------|------------|
| Q1 | Is `requires` on EXTRACTION_SITES enforced anywhere? | **RESOLVED:** No — it is a cosmetic string. Genuine PROD-01 gap. Add `satisfiesDeposit`/`canExtract` in src/sim/production.ts, wire into the runner (plan 02). |
| Q2 | How should a "deposit" be detected in the sim? | **RESOLVED:** timber_yard → terrain `trees` (map.get); clay/iron/marble → `TileState.resourceType` equal to the requirement (tile.ts:14). Mutate a test map via `Map.fromLayout` + `mutateTileState` (map.ts:39/135). |
| Q3 | Is `tickWorkshop` non-destructive in every blocked state? | **RESOLVED:** Yes by inspection (production.ts:80-89) — every non-working branch returns 0 produced without touching stocks. Only tests missing (decision 3). |
| Q4 | Is the §16.4 destination policy implemented? | **RESOLVED:** No — `selectDestination` (production.ts:100-118) is a policy-free comparator. Add `porterDestination(commodity, workshops, warehouses)` enforcing needy-workshop → warehouse → null/blocked with accepts+capacity validity, plus `porterDeliversTo` moving a load into destination stock (decisions 1/2). |
| Q5 | Does the last plan's verify need runner stepping to exist? | **RESOLVED:** Yes — the chunked-tick determinism test (decision 5) scripts a production city through SimRunner, so plan 06-02 (tick integration) ships before plan 06-03 (determinism). |
| Q6 | Are new runtime building types safe against existing tests? | **RESOLVED:** Yes — additive `BuildingType` members; exhaustive fixed lists in tests (buildings-catalog.test.ts:7-11, property/invariants.test.ts:9) are closed arrays and unaffected. `Good` (types.ts:15) already lists all production commodities. |
| Q7 | Where does production advisor data belong? | **RESOLVED:** `src/sim/advisors.ts` (mirrors `foodAdvisorFromState`), derived from `SimState` with per-building stock/production state; exposed via a runner accessor `getProductionAdvisor()`. No `SimState` shape change → no golden churn. |
| Q8 | Does data/buildings.ts need modification? | **RESOLVED:** No code change this phase for the catalog beyond the runtime catalog; the data catalog's missing deposit field is noted as a validation/UI follow-up — reachability is via the runtime BUILDINGS catalog (runner.ts:14). |
| Q9 | Actual baseline test count? | **RESOLVED:** 424 tests / 57 files, typecheck clean (older "126/253/316" references are prior phases). |
| Q10 | Will the new constructions change goldens/determinism? | **RESOLVED:** No — additive model + additive runner step + additive advisor; existing golden/determinism files unchanged; new determinism assertion added in plan 06-03. |

---

## 4. Validation Architecture

Applies — see `06-VALIDATION.md` (created). The Vitest suite is fast (~3s full,
<1s targeted), so per-task sampling at `npm run typecheck` + the task's
`<automated>` vitest command is fine; the full suite runs after each plan wave.
No Wave-0 infrastructure is needed beyond the test files each task creates itself
(tests/unit/extraction.test.ts, tests/unit/production-pipeline.test.ts,
tests/unit/workshop-blocked.test.ts in plan 06-01; tests/integration/
production-chain.test.ts in 06-02; tests/determinism/production-chain-
determinism.test.ts and tests/integration/production-runner.test.ts in 06-03),
plus in-place extension of tests/helpers.ts (builders), tests/unit/advisors.test.ts
(production advisor), src/sim/buildings.ts / types.ts (runtime catalog and types),
src/sim/walkers.ts (production state field), src/sim/runner.ts (tickProduction +
accessor), and src/sim/advisors.ts (advisor builder).
