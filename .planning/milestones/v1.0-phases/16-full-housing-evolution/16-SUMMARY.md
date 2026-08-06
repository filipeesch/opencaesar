---
phase: 16-full-housing-evolution
plan: 16-plan
subsystem: sim-core
tags: [housing, 21-level, hysteresis, merge, determinism, golden, catalog-validation]

# Dependency graph
requires:
  - phase: 15-plan
    provides: derived-only SaveCommand decisions, objectives/events/ratings validated live, fromSaveData replay contract
provides:
  - "HOUS-01: 21-level house progression wired live (house.level 0-20 source of truth via decideEvolution, derived house.tier, HOUSING_LIVE_STATS economy bridge through the clamped liveStats accessor)"
  - "HOUS-02: hysteresis devolution (toleranceTicks 90, grace dual-counter reset) + deterministic month-cadence house merging (fixed placement-order scan, footprint ladder, combined population, re-keyed occupancy, house-merged message, walker-target safety)"
  - "deterministic housing chain (no RNG/clock), byte-identical chunked 1/7/50 + save->load replay incl. merge/combined population"
  - "intentionally regenerated golden fixtures (food-chain below Insula, level-named messages; paused-commands devolves to Vacant Lot)"
  - "data/validate.ts housing block: footprint monotonic + requiresGoods ⊆ FOOD_TYPES ∪ houseGood gate; tools resolution (removed levels 15-20)"
affects: [verify-work, ship, distribution phases (per-house goods delivery), future balance tuning]

# Actuals (#2632) — chars/4 over the realized diff of THIS plan's remaining-work commits
# (16-02-01..16-03-02), the scale the estimate's estimateTokens used.
actuals:
  tokens: 16062
  tasks: 7
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "module-local LEVEL_/HOUSING_-prefixed tuning constants (never data/balance.ts — balance-parity gate)"
    - "pure injected-predicate occupancy transforms (placement.ts style) for the merge block-fit"
    - "test-only gate bypasses (pump + placeGov replay path + funded-treasury isolation) keeping live evolution tests deterministic"
    - "custom-map save->load round-trip passes the SAME map to fromSaveData (repo convention)"

key-files:
  created:
    - src/sim/housingLive.ts
    - src/sim/housingMerge.ts
  modified:
    - src/sim/housing.ts
    - src/sim/runner.ts
    - src/sim/economy.ts
    - src/sim/advisors.ts
    - src/sim/walkers.ts
    - src/sim/types.ts
    - data/housing.ts
    - data/validate.ts
    - data/balance.ts
    - tests/unit/housing-level-bridge.test.ts
    - tests/unit/housing-merge.test.ts
    - tests/unit/housing.test.ts
    - tests/unit/civic-services.test.ts
    - tests/unit/economy.test.ts
    - tests/unit/labor.test.ts
    - tests/unit/happiness.test.ts
    - tests/unit/advisors.test.ts
    - tests/integration/housing-evolution-live.test.ts
    - tests/integration/bankruptcy.test.ts
    - tests/integration/health-education-entertainment.test.ts
    - tests/determinism/housing-evolution-determinism.test.ts
    - tests/golden/fixtures/food-chain-golden.json
    - tests/golden/fixtures/paused-commands-golden.json

key-decisions:
  - "Fresh houses place at the OCCUPIED baseline (level 1 Crude Hut), not level 0 Vacant Lot — a placed house is inhabited per game.md 11.3; level-0 init left the natural economy with zero population (see deviations)"
  - "levelTaxPerTick gets a LEVEL_TAX_PER_WORKER=5 solvency floor so every ladder rung covers its own workers' wages at stock policy (legacy HOUSE_TIERS floor parity); without it wages go unpaid → desirability 0 → no house evolves"
  - "Merge runs on tickCount % 40 with a fixed placement-order scan; survivor keeps id/origin, gains footprint + combined population; occupiedTiles re-keyed; walkers repointed; NO new SaveCommand (replay re-derives)"
  - "Golden regeneration is an intentional mechanic change; the food-chain city (no fountain/pottery) can no longer hold an Insula"

patterns-established:
  - "21-level house progression is driven exclusively by decideEvolution against cumulative HOUSING_LEVELS requirements + normalized levelDesirability + counter hysteresis"
  - "All HOUSING_LIVE_STATS reads go through the clamped liveStats() accessor (NaN guard), never a bare index"
  - "house.tier is always the derived tierOfLevel bucket; ratings keep their HOUSE_TIERS.length denominator"

requirements-completed: [HOUS-01, HOUS-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "21-level house progression wired live: decideEvolution drives house.level, derived tier, level/levelName surfaced, economy/advisor/happiness read HOUSING_LIVE_STATS via clamped liveStats"
    requirement: HOUS-01
    verification:
      - kind: unit
        ref: "tests/unit/housing-level-bridge.test.ts"
        status: pass
      - kind: integration
        ref: "tests/integration/housing-evolution-live.test.ts#progression"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hysteresis devolution with toleranceTicks + grace (dual-counter reset) and deterministic month-cadence house merging (footprint ladder, combined population, re-keyed occupancy, house-merged message)"
    requirement: HOUS-02
    verification:
      - kind: integration
        ref: "tests/integration/housing-evolution-live.test.ts#devolve"
        status: pass
      - kind: integration
        ref: "tests/integration/housing-evolution-live.test.ts#merge"
        status: pass
      - kind: unit
        ref: "tests/unit/housing-merge.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Byte-identical determinism for a city that evolves AND merges (chunked 1/7/50 + save->load with merged combined population + counters); no RNG/clock source audit"
    requirement: HOUS-02
    verification:
      - kind: integration
        ref: "tests/determinism/housing-evolution-determinism.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Golden fixtures intentionally regenerated for the 21-level mechanic (food-chain below Insula); golden suite stable without GOLDEN_UPDATE; determinism suites hold behavioral equivalence"
    requirement: HOUS-01
    verification:
      - kind: unit
        ref: "tests/golden/golden.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Catalog integrity: footprint monotonic ladder + requiresGoods ⊆ FOOD_TYPES ∪ houseGood enforced at load; tools resolved (removed from levels 15-20)"
    requirement: HOUS-01
    verification:
      - kind: unit
        ref: "tests/data-catalog.test.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 95min
completed: 2026-08-05
status: complete
---

# Phase 16 Plan 16-plan: Full Housing Evolution Summary

**21-level housing progression driven by decideEvolution, hysteresis devolution with anti-oscillation grace, deterministic month-cadence house merging (footprint ladder + combined population), a clamped 21-level live-stats economy bridge, intentional golden regeneration, and catalog validation complete — with the full suite, typecheck, military and balance-parity gates green (813 tests).**

## Performance

- **Duration:** 95 min (this remaining-work execution)
- **Started:** 2026-08-05
- **Completed:** 2026-08-05
- **Tasks:** 7 (plan total; 16-00-01/16-01-01/16-01-02 by the prior executor, 16-02-01/16-02-02/16-03-01/16-03-02 here)
- **Files modified:** 27

## Accomplishments
- **HOUS-01:** houses evolve only via decideEvolution against every cumulative requires+requiresGoods of the target level with normalized desirability clearing the padded threshold and satisfiedTicks reaching minSatisfiedTicks (60); house.level (0-20) is the source of truth, house.tier the derived 0-4 bucket; all economy/tax/population/workers/advisor/happiness consumers read HOUSING_LIVE_STATS via the clamped liveStats accessor (no bare index / NaN).
- **HOUS-02:** a house devolves after toleranceTicks (90) of lost requirements or desirability tolerance, with both counters reset on any level change (grace, no oscillation); compatible same-level orthogonally-adjacent mergeable houses merge on the % 40 cadence with a fixed placement-order scan when the block fits the target footprint (1/2/3/4 ladder), survivor gains the footprint + combined population, occupiedTiles re-keyed, absorbed instance removed (tiles freed), walkers repointed, and a house-merged message emitted — never above level 20, no new SaveCommand.
- **Determinism:** a city that evolves AND merges is byte-identical across chunked ticks (1/7/50) and a save->load round-trip (counters + combined population included); the no-RNG/clock source audit over housing.ts/housingLive.ts/housingMerge.ts/data/housing.ts passes.
- **Goldens:** both fixtures regenerated as an INTENTIONAL mechanic change (the food-chain city lands below Insula at Crude Hut, level-named messages; paused-commands devolves to Vacant Lot) and stable under the golden test.
- **Catalog/validation:** validateCatalogs enforces a finite-positive monotonic footprint ladder and the requiresGoods ⊆ FOOD_TYPES ∪ houseGood gate; the known tools (houseGood:false) mismatch is resolved on levels 15-20.
- **Regression repair:** the committed Wave-1 economy routing left the natural economy un-bootstrappable (level-0 fresh houses = 0 population + structurally loss-making low levels → unpaid wages → desirability 0 → no evolution); fixed with an occupied baseline + tax-floor (see deviations) restoring governance/religion/requests/buildings-catalog/food-slice/event-response to green.

## Task Commits

Each task was committed atomically:

1. **Task 16-00-01: Wave-0 validation scaffolds** - `f683926` (test, prior executor)
2. **Task 16-01-01: 21-level decideEvolution bridge (tracer)** - `b89bea9` (feat, prior executor)
3. **Task 16-01-02: economy/advisor/happiness through clamped stats** - `d0fe534` (feat, prior executor)
4. **Task 16-02-01: housingMerge pure transform + footprint ladder** - `d00a210` (feat)
5. **Task 16-02-02: runner merge step + live/determinism flip + bootstrap fix** - `e414d25` (feat)
6. **Task 16-03-01: golden regeneration (intentional mechanic change)** - `b4b9af2` (test)
7. **Task 16-03-02: timing/tier asserts, validate gate, tools resolution** - `96e0dce` (test)

Plan metadata commit follows in the state update.

## Files Created/Modified
- `src/sim/housingLive.ts` - 21-entry HOUSING_LIVE_STATS + levelDesirability (0-200→1-30) + tierOfLevel + clamped liveStats + deriveSatisfied + requirementsMet; tax floor ensures ladder solvency.
- `src/sim/housingMerge.ts` - pure targetFootprint/findMergePartner/blockFits/mergeProposal transform.
- `src/sim/housing.ts` - tickHousing rewired to decideEvolution + DEFAULT_HYSTERESIS counters + derived tier; legacy 5-tier decision block retired.
- `src/sim/runner.ts` - house init (occupied baseline), tickHousingMerge %40 step, effectiveHousePopulation, walker repoint, level/levelName surfaced.
- `src/sim/economy.ts` / `advisors.ts` / `walkers.ts` / `types.ts` - liveStats routed consumers, HouseInstance additive fields, MessageType 'house-merged'.
- `data/housing.ts` - footprint ladder (monotonic 1/2/3/4); tools removed from levels 15-20.
- `data/validate.ts` - housing block footprint + requiresGoods-consistency gate.
- `data/balance.ts` - retired orphaned legacy evolve/devolveWindowTicks (balance-parity gate).
- Test files listed in frontmatter + the two regenerated golden fixtures.

## Decisions Made
- Fresh houses place at the occupied baseline (level 1) per game.md 11.3 (a placed house is inhabited); the alternative (level 0 Vacant Lot) gave zero startup population.
- levelTaxPerTick = max(LEVEL_TAX_PER_WORKER × workers, round(capacity×taxPerCapita/20)) — module-local solvency floor (never a BALANCE key) so low rungs aren't structurally loss-making.
- Merge cadence % 40, fixed placement-order scan, survivor keeps id/origin, combined population via effectiveHousePopulation, re-key occupancy to the whole new square, repoint walkers, no new SaveCommand.
- Golden regeneration only via `npm run test:golden:update` as the explicit mechanic-change task; inspected for plausible values (level 0-20, non-negative desirability, finite population).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/2 - Bug] Level-0 fresh house init collapsed the natural economy (26 tests regression)**
- **Found during:** Task 16-02-02 verification (full non-golden suite scan)
- **Issue:** committed 16-01-02 routed population/worker/tax through liveStats but house init stayed `level: 0` (Vacant Lot, pop 0); freshly-placed houses contributed zero population, so the entire natural-economy bootstrap (governance/religion/requests/buildings-catalog/food-slice/event-response thresholds) never started — these were not in the plan's declared-RED set.
- **Fix:** fresh houses place at the occupied baseline (level 1 Crude Hut), matching game.md §11.3 and the legacy tier-0 Shack behavior.
- **Files modified:** src/sim/runner.ts (house init)
- **Verification:** governance/religion/requests/buildings-catalog/food-slice/event-response critical suites green.
- **Committed in:** e414d25 (Task 16-02-02)

**2. [Rule 1/2 - Bug] Bottom of the ladder was structurally loss-making → unpaid wages → no evolution**
- **Found during:** Task 16-02-02 (gov city trace: 157/214 houses had water yet ZERO evolved, desirability 0)
- **Issue:** the derived `taxPerTick = max(1, round(capacity×taxPerCapita/20))` made a level-1 house pay ~1 tax/tick vs ~1.08 in wages; wages went unpaid → the -100 desirability penalty → normalized desirability 0 → houses could never evolve. The plan explicitly grants the executor calibration discretion over these stats.
- **Fix:** `LEVEL_TAX_PER_WORKER = 5` solvency floor (module-local, never a BALANCE key) so every rung covers its own workers' wage bill at the stock policy — parity with the legacy HOUSE_TIERS floor (Shack: tax 5 vs 0.27 wages).
- **Files modified:** src/sim/housingLive.ts
- **Verification:** unit kits index HOUSING_LIVE_STATS so they adapt; full suite green incl. balance-parity.
- **Committed in:** e414d25 (Task 16-02-02)

**3. [Rule 1 - Bug] save->load determinism round-tripped onto the wrong map**
- **Found during:** Task 16-02-02 (housing-evolution-determinism save->load)
- **Issue:** the scaffold called `fromSaveData(save)` on a custom food-chain map; the repo convention is to pass the SAME map for custom-map saves (else fromSaveData regenerates a seed map → byte mismatch). Pre-existing in the committed scaffold.
- **Fix:** `SimRunner.fromSaveData(r.getSaveData(), foodChainMap())` + merged-house find narrowed to `type === 'house'` (the first 2x2 was a market/granary otherwise).
- **Files modified:** tests/determinism/housing-evolution-determinism.test.ts
- **Committed in:** e414d25 (Task 16-02-02)

**4. [Rule 2 - Missing critical functionality] Orphaned legacy BALANCE keys tripped the balance-parity gate**
- **Found during:** Task 16-03-02 full-suite run
- **Issue:** `evolveWindowTicks`/`devolveWindowTicks` remained in data/balance.ts after the 21-level engine retired their consumers → balance-parity (every BALANCE key consumed as CONFIG.*) failed. Pre-existing since committed 16-01-01.
- **Fix:** removed the dead keys with an explanatory comment (no new keys added).
- **Files modified:** data/balance.ts
- **Verification:** tests/balance-parity.test.ts green.
- **Committed in:** 96e0dce (Task 16-03-02)

---

**Total deviations:** 4 (Rule 1/2 auto-fixes for regressions in committed prior work + one calibration)
**Impact on plan:** All fixes were necessary for correctness and the plan's own "full suite green except declared-RED" gate. No scope creep — no net-new BALANCE keys, decideEvolution untouched, additive API only.

## Issues Encountered
- The progression live test's tiny 2-house city cannot sustain high-level wages at tax-0 policy; the evolution-mechanic pump therefore keeps the treasury funded (test-only wage-mechanic isolation, mirroring the pump/placeGov gate bypasses) so the 21-level ladder under test isn't distorted by the wage economy.
- `-x` (bail) CLI flag unsupported by the repo's vitest version; verification used `--bail=1` instead.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full suite (112 files / 813 tests), typecheck, check:military and balance-parity are green; goldens stable; determinism holds for evolution + merge.
- Ready for /gsd-verify-work (UAT) and the ship gate.
- **Open context for future distribution phases:** per-house non-food goods delivery is still a city-stock proxy (cityGoodsAccess); a real per-house delivery path is deferred to the distribution phases.

---
*Phase: 16-full-housing-evolution*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: src/sim/housingLive.ts, src/sim/housingMerge.ts, data/validate.ts, .planning/phases/16-full-housing-evolution/16-SUMMARY.md
- FOUND: commits d00a210, e414d25, b4b9af2, 96e0dce
- Full suite: 112 test files / 813 tests passed; typecheck green; check:military clean; balance-parity green.

## Known Stubs

None — every deliverable is wired to real data sources. The single documented
future-work area (non-food house goods resolve via the deterministic
`cityGoodsAccess` city-stock proxy until the distribution phases bring real
per-house delivery) is an intentional design decision, not a placeholder; it is
noted under Next Phase Readiness.

