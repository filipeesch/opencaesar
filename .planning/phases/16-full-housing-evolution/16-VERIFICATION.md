---
phase: 16-full-housing-evolution
verified: 2026-08-05T17:45:00Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 16: Full Housing Evolution — Verification Report

**Phase Goal:** 21-level progression with cumulative requirements, hysteresis, and merging.
**Verified:** 2026-08-05T17:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **HOUS-01 evolution criterion:** `house.level` (0-20) is the live source of truth driven exclusively by `decideEvolution` (housing.ts:185-209 wires `decideEvolution` + `DEFAULT_HYSTERESIS` from housingEvolution.ts; legacy 5-tier decision block retired). Evolves only when ALL cumulative `requires+requiresGoods` (per-house `deriveSatisfied`, housingLive.ts:163-206) are met AND normalized desirability (`levelDesirability`, clamp(0,30,round(x/6))) clears the padded threshold (level+5; level 20 needs 25 ≤ 30) AND `satisfiedTicks >= minSatisfiedTicks` (60). `house.tier` is always the derived `tierOfLevel` bucket (housing.ts:213). | ✓ VERIFIED | Behavioral tests pass (my run): decideEvolution unit tests (tests/unit/housing-evolution.test.ts — evolve gating at minSatisfiedTicks, no-evolve below padded desirability), integration 'progression' (target reaches ≥16, control caps ≤1, one level per eligibility period), housing-level-bridge unit tests (levelDesirability boundaries 0/30/75/101/200 → 0/5/13/17/30; 200→30 reachability; tierOfLevel buckets). |
| 2 | **HOUS-01 21-level economy real:** workerPool/tickEconomy/populationOf/advisor food-days/happiness read HOUSING_LIVE_STATS through the clamped `liveStats` accessor (never a bare index / no NaN): economy.ts:23-84 (effectiveWorkers/effectiveTaxPerTick/effectivePopulation), runner.ts:1708/1722/2758 (happiness weighting, totalWorkers, populationCapacity), advisors.ts:584 (food-days). The ONLY `HOUSING_LIVE_STATS[level]` index is inside `liveStats()` itself (housingLive.ts:92). Ratings keep the `HOUSE_TIERS.length` denominator with the derived tier (economy.ts:107, runner.ts:1030-1039 patrician bar tier≥3). | ✓ VERIFIED | Behavioral tests pass: housing-level-bridge unit (HOUSING_LIVE_STATS length 21, monotonic, liveStats clamp never undefined), economy unit (13), integration 'merge' asserts population/workers/serialized capacity = 2× liveStats(11) (480 not 240), progression asserts ratings.population finite > 0. |
| 3 | **HOUS-01/2 hysteresis:** satisfiedTicks/unsatisfiedTicks accumulate from tick history only (housing.ts:163-183, deterministic counters); a house devolves only after toleranceTicks (90, DEFAULT_HYSTERESIS) of lost requirements or desirability below tolerance; any level change zeroes BOTH counters (no oscillation). WR-01 fixed: top-of-ladder fallback to current-level requirements so level-20 can devolve (housing.ts:172 `reqTarget = nextDef ? next : level`). | ✓ VERIFIED | Behavioral tests pass (my run): integration 'devolve' (losing only water source devolves past tolerance, no rebound over 100 ticks; WR-01 level-20 house devolves after grand_temple lapsing), decideEvolution unit (devolve at toleranceTicks, none at toleranceTicks-1). |
| 4 | **HOUS-02 merge:** deterministic %40 cadence (`tickCount % 40 === 0` runner.ts:305/510), fixed placement-order scan (findMergePartner, same-level orthogonal, mergeable), block-fit over the union min-corner CONTAINING both footprints (CR-01: mergeProposal housingMerge.ts:129-149 anchored at min(a,b), rejects footprint the square can't cover), occupancy re-keyed (runner.ts:549-553), evicted tiles freed (557-559), survivor keeps id + gains footprint + combined population (545-546, effectiveHousePopulation → effectivePopulation), never >20, NO new SaveCommand (SaveCommand union unchanged; merge only emits a `house-merged` message), walker/trade repoint (repointWalkersTowards has target/dest/sourceBuildingId, WR-03). | ✓ VERIFIED | Behavioral tests pass (my run): integration 'merge' 2×2 (survivor footprint 2, combinedPopulation 2×liveStats, occupiedTiles re-keyed, absorbed gone, house-merged msg; consumer-level population/workers/capacity = 480), 4×4 top-of-ladder (levels 19-20), WR-03 walker repoint regression; housing-merge unit incl. CR-01 right-anchor/below-anchor/1×1-vs-2×2-mismatch regressions (15 tests). |
| 5 | **Determinism:** a city that evolves AND merges is byte-identical across chunked ticks (1/7/50) and a getSaveData()→fromSaveData() round-trip with counters + combined population (incl. the merged city, WR-02); no RNG/clock in housing.ts / housingLive.ts / housingMerge.ts / data/housing.ts (audit in test + verified by grep). | ✓ VERIFIED | Behavioral tests pass (my run): determinism test — chunked 1/7/50 byte-identity for seeds 1/7/1337, natural-economy save→load, MERGED-city save→load byte-identity (footprint 2, combinedPopulation, house-merged history), no-Math.random/Date.now/new Date file-scope audit. Confirmatory grep: no RNG/clock tokens in the 4 files; runner.ts:2201 `savedAt: Date.now()` is the documented pre-existing non-violation. |
| 6 | **Golden compatibility:** fixtures regenerated as an INTENTIONAL mechanic change; golden + full suite + check:military + balance-parity green. | ✓ VERIFIED | My runs: tests/golden/golden.test.ts passes (2 tests) WITHOUT GOLDEN_UPDATE (committed-stable fixtures); full suite 112 files / 823 tests pass (2 benign vitest worker RPC timeouts, zero test failures — matches the documented pattern); `check:military` clean; balance-parity 7 tests pass. Fixtures inspected: food-chain lands at Crude Hut (level 1, no Insulae/Villa), paused-commands devolves to Vacant Lot. |
| 7 | **Catalog integrity:** footprint monotonic ladder (1×1:0-10, 2×2:11-14, 3×3:15-18, 4×4:19-20) in data/housing.ts; requiresGoods ⊆ FOOD_TYPES ∪ houseGood enforced by data/validate.ts:94-98; 'tools' removed from levels 15-20 (no requiresGoods entry contains 'tools'); validateCatalogs() === []. | ✓ VERIFIED | tests/data-catalog.test.ts passes (12 tests) incl. `expect(validateCatalogs()).toEqual([])`; footprint ladder + requiresGoods subset confirmed by direct read of data/housing.ts; confirmatory node check found no violates-requiresGoods-good. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Required Artifacts

All 14 artifacts from PLAN frontmatter verified by `gsd-tools query verify.artifacts`:

| Artifact | Expected | Status | Details |
| -------- | --------- | ------ | ------- |
| `src/sim/housingLive.ts` | additive pure bridge (LiveHouseStats, HOUSING_LIVE_STATS×21, levelDesirability, tierOfLevel, liveStats, deriveSatisfied, requirementsMet; + effectivePopulation/Workers/TaxPerTick CR-02) | ✓ VERIFIED | 206 lines; all exports present and substantive |
| `src/sim/housingMerge.ts` | pure occupancy transform (targetFootprint, findMergePartner, blockFits, mergeProposal with union-corner + footprint-containment) | ✓ VERIFIED | 149 lines; CR-01 fix implemented |
| `src/sim/housing.ts` | tickHousing rewired to decideEvolution + DEFAULT_HYSTERESIS + derived tier | ✓ VERIFIED | legacy 5-tier block retired |
| `src/sim/runner.ts` | house init (occupied baseline level 1), tickHousingMerge %40, effectiveHousePopulation, walker repoint, level/levelName surfaced | ✓ VERIFIED | merged + save round-trip byte-identity |
| `src/sim/economy.ts` | workerPool/tickEconomy/populationOf via clamped effective accessors | ✓ VERIFIED | 118 lines, CR-02 routed |
| `src/sim/advisors.ts` | food-days via effectivePopulation | ✓ VERIFIED | line 584 |
| `src/sim/walkers.ts` | HouseInstance additive fields (level/satisfiedTicks/unsatisfiedTicks/mergeable/combinedPopulation) | ✓ VERIFIED | lines 88-102 |
| `src/sim/types.ts` | MessageType 'house-merged'; BuildingState.house level/levelName | ✓ VERIFIED | lines 60, 123-125 |
| `data/housing.ts` | footprint ladder; tools removed from 15-20 | ✓ VERIFIED | 21 entries, footprint field, no 'tools' in requiresGoods |
| `data/validate.ts` | footprint positive/monotonic + requiresGoods subset gate | ✓ VERIFIED | lines 85-98 |
| `tests/unit/housing-level-bridge.test.ts` | desirability/tier/stats/clamp coverage | ✓ VERIFIED | 9 tests, pass |
| `tests/unit/housing-merge.test.ts` | ladder/blockFits/fixed-scan/CR-01 | ✓ VERIFIED | 15 tests, pass |
| `tests/integration/housing-evolution-live.test.ts` | progression/devolve/merge live | ✓ VERIFIED | 8 tests, pass |
| `tests/determinism/housing-evolution-determinism.test.ts` | chunked 1/7/50 + save→load + no-RNG audit | ✓ VERIFIED | 5 tests, pass |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| tickHousing (housing.ts) | decideEvolution (housingEvolution.ts) | import + call with satisfied/desirability/counters | ✓ WIRED | housing.ts:16 imports decideEvolution + DEFAULT_HYSTERESIS; :185 feeds EvolutionInput each tick; counters zeroed on level change |
| economy.ts/runner.ts/advisors.ts | housingLive.ts liveStats | effectivePopulation/Workers/TaxPerTick (clamped) | ✓ WIRED | no bare HOUSING_LIVE_STATS index outside liveStats(); all consumers verified |
| runner.tick() | tickHousingMerge() | `tickCount % 40 === 0` step after tickHousing | ✓ WIRED | runner.ts:305; fixed placement-order scan; no new SaveCommand |
| data/housing.ts footprint/requiresGoods | data/validate.ts gate | validateCatalogs housing block | ✓ WIRED | validate.ts:85-98; enforced; validateCatalogs() === [] |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| tickHousing | satisfied = deriveSatisfied(house, buildings) | real per-house foodInventory + wellness/godAccess cooldowns + city building registry | ✓ real per-house service/water/food state; goods via cityGoodsAccess deterministic proxy | ✓ FLOWING |
| economy.populationOf / workerPool / tickEconomy | effectivePopulation/Workers/TaxPerTick | liveStats(level) + combinedPopulation | ✓ real 21-level table; merged blocks double population/workers/tax | ✓ FLOWING |
| runner.getState → buildingState.populationCapacity | effectivePopulation(b) | same accessor | ✓ merged figure serialized to SimState (480 not 240) | ✓ FLOWING |
| runner merge combinedPopulation | effectivePopulation(a)+effectivePopulation(b) | liveStats(level) per block | ✓ real, durable across save→load replay (WR-02) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Evolution gating + progression (SC1) | `vitest run tests/integration/housing-evolution-live.test.ts` | 8 tests pass (progression ≥16, control ≤1, one-level-per-period; devolve + WR-01; merge 2×2/4×4 + WR-03) | ✓ PASS |
| Determinism chunked + save→load (SC3/merge) | `vitest run tests/determinism/housing-evolution-determinism.test.ts` | 5 tests pass (chunked 1/7/50 byte-identity ×3 seeds, natural save→load, merged-city save→load) | ✓ PASS |
| Merge geometry unit (CR-01) | `vitest run tests/unit/housing-merge.test.ts` | 15 tests pass incl. right/below-anchor and 1×1-vs-2×2 regressions | ✓ PASS |
| 21-level bridge unit | `tests/unit/housing-level-bridge.test.ts` | 9 tests pass (clamp, desirability boundaries, tier buckets) | ✓ PASS |
| Economic consumers | `tests/unit/economy.test.ts tests/unit/advisors.test.ts tests/unit/labor.test.ts tests/unit/happiness.test.ts tests/unit/civic-services.test.ts tests/unit/housing.test.ts` | 72 tests pass | ✓ PASS |
| Catalog validation | `tests/data-catalog.test.ts` | 12 tests pass (validateCatalogs() === []) | ✓ PASS |
| Balance parity | `tests/balance-parity.test.ts` | 7 tests pass | ✓ PASS |
| Full suite (once) | `NODE_OPTIONS=--max-old-space-size=4096 vitest run --maxWorkers=4` | 112 files / 823 tests pass (2 benign worker RPC timeouts, 0 test failures) | ✓ PASS |
| Typecheck | `tsc --noEmit` | exit 0 | ✓ PASS |
| Military gate | `npm run check:military` | clean: no forbidden tokens in src/ or data/ | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED (no probe-*.sh scripts exist in this repo; phase verification is via the deterministic vitest suites, which were run above).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| HOUS-01 | 16-PLAN | Full data-driven 21-level progression (0 vacant lot → 20 luxurious palace) with cumulative requirements | ✓ SATISFIED | decideEvolution-driven house.level, derived tier, 21-level live-stats economy bridge; progression/devolve/catalog tests green |
| HOUS-02 | 16-PLAN | Evolution/de-evolution uses hysteresis (evolve limit, devolve limit, grace) and house merging into larger lots | ✓ SATISFIED | toleranceTicks(90)/minSatisfiedTicks(60) + dual-counter reset; %40 merge with footprint ladder, combined population, byte-identical determinism |

No orphaned requirements: `grep -E "Phase 16" .planning/REQUIREMENTS.md` maps only HOUS-01/HOUS-02 to Phase 16.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | none | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers in any Phase-16 source; no `.skip(`/`.only(` in the new test files; no console.log-only implementations; no hardcoded-empty/stub returns in the deliverable artifacts |

### Human Verification Required

None. All three roadmap success criteria and all seven derived truths are behavior-dependent and are exercised by passing behavioral tests executed in this verification:

- SC1 (evolve only when all cumulative requirements met for the minimum period) — exercised by decideEvolution unit tests + integration 'progression' (control house with a missing cumulative good caps at the floor).
- SC2 (devolve after tolerance loss; hysteresis prevents oscillation) — exercised by integration 'devolve' (tolerance window, no rebound) + WR-01 top-of-ladder regression.
- SC3 (adjacent houses merge when blocks allow) — exercised by integration 'merge' (2×2 and 4×4 top-of-ladder) + unit CR-01 geometry regressions.

Informational notes for the developer's awareness (NOT required by the phase success criteria, not blockers):
- Tuning "feel" judgments — the LEVEL_TAX_PER_WORKER=5 solvency floor and the 40-tick merge cadence — are deterministic calibration decisions; a human playtest of overall economy balance is deferred to future balance tuning (out of scope for this sim-core phase).
- IN-02/IN-03 from 16-REVIEW.md (fountain satisfied by any water source; baseOk/decideEvolution desirability gap) were consciously skipped/waved as documented design notes matching the plan's key map and hysteresis intent.

### Gaps Summary

No gaps found. All 7 must-haves verified, all 14 artifacts pass existence + substantive + wiring checks, all key links wired, data flows real values, behavioral tests exercise every success criterion, and all gates (full suite 823, typecheck, military, balance-parity, golden-stable) are green.

---

_Verified: 2026-08-05T17:45:00Z_
_Verifier: the agent (gsd-verifier)_
