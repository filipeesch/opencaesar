---
phase: 06-production-manufacturing
plan: 06-02
subsystem: sim-runner
tags: [sim, runner, buildings, production, extraction, workshops, warehouse, advisor, vitest]

requires:
  - phase: 06-production-manufacturing
    provides: "Model gates from 06-01 (satisfiesDeposit/canExtract, tickWorkshop, porterDestination, porterDeliversTo, workshopBottleneck, EXTRACTION_SITES/WORKSHOPS)"
provides:
  - "Runtime production building types + BUILDINGS catalog entries (clay_pit..warehouse) with data-catalog costs/workers (PROD-01/02)"
  - "SimRunner.tickProduction() wired after tickFood: deposit-gated extraction, olive/grape farm output, workshop stepping, feedstock+output porters with exact conservation"
  - "Production advisor rows/summary derived from live sim state via getProductionAdvisor()/getProductionAdvisorRows() (PROD-02)"
  - "tests/helpers.ts productionChainMap + buildProductionCity reused by 06-03 acceptance/determinism"
affects: [06-03 (acceptance + chunked determinism over this tick step and helpers)]

actuals:
  tokens: 4800
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Mirror tickFood to add a deterministic sub-tick step (tickProduction) with stable building-order iteration and no Math.random/Date"
    - "Advisor data as a pure SimState projection + an internal-notes overlay (ProductionInternalNote) so nothing is fabricated"

key-files:
  created:
    - tests/integration/production-chain.test.ts
  modified:
    - src/sim/types.ts
    - src/sim/buildings.ts
    - src/sim/walkers.ts
    - src/sim/production.ts
    - src/sim/runner.ts
    - src/sim/advisors.ts
    - src/game/buildingArt.ts
    - src/game/palette.ts
    - tests/helpers.ts
    - tests/unit/advisors.test.ts

key-decisions:
  - "Production state stays internal to BuildingInstance (not serialized to BuildingState) → SimState/goldens unchanged"
  - "Feedstock porter loads are whole units (move only when source has ≥ 1) so tickWorkshop's integer consumption can never drive workshop inputs negative"
  - "Advisor rows derive from a runner-recorded ProductionInternalNote map (authoritative) falling back to SimState-only 'idle' when production state is absent — never fabricating"
  - "Summary per-commodity output stock counts workshop output + warehouse stock (the books)"

patterns-established:
  - "Additive BuildingType/BuildingCategory members force entries in exhaustive game art/palette maps"

requirements-completed: [PROD-01, PROD-02]

coverage:
  - id: D1
    description: "Extraction sites and workshops are real placeable buildings — runtime BUILDINGS entries + BuildingType identities with data-catalog cost/workers, staffed via the standard labor system, no spawnEveryTicks"
    requirement: PROD-01
    verification:
      - kind: integration
        ref: "tests/integration/production-chain.test.ts#defines every raw/workshop/warehouse type"
        status: pass
    human_judgment: false
  - id: D2
    description: "SimRunner.tick() steps extraction (deposit-gated) and workshops each tick; porters move loads to valid workshop/warehouse destinations so destination stock rises and nothing is destroyed"
    requirement: PROD-02
    verification:
      - kind: integration
        ref: "tests/integration/production-chain.test.ts#runs the full chain"
        status: pass
    human_judgment: false
  - id: D3
    description: "Deposit enforcement at runner level — an off-deposit staffed iron mine produces zero iron and reads blocked"
    requirement: PROD-01
    verification:
      - kind: integration
        ref: "tests/integration/production-chain.test.ts#deposit enforcement"
        status: pass
    human_judgment: false
  - id: D4
    description: "No-loss through the runner — no stock goes negative, all held units finite (whole-unit feedstock porter loads prevent negative workshop inputs)"
    requirement: PROD-02
    verification:
      - kind: integration
        ref: "tests/integration/production-chain.test.ts#no-loss"
        status: pass
    human_judgment: false
  - id: D5
    description: "Production advisor data derived from live sim state — rows for extraction/workshop, real input/output values, off-deposit mine blocked with zero output, summary aggregates, no hardcoded values"
    requirement: PROD-02
    verification:
      - kind: unit
        ref: "tests/unit/advisors.test.ts#production advisor"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-08-03
status: complete
---

# Phase 06 Plan 06-02: Production in the Live Sim Summary

**Runtime raw/workshop/warehouse building types, deposit-gated SimRunner.tickProduction() (extraction → workshop → porter → warehouse, no-loss), and a SimState-derived production advisor accessor**

## Performance

- **Duration:** 40 min
- **Started:** 2026-08-03T17:16Z
- **Completed:** 2026-08-03T17:41Z
- **Tasks:** 2
- **Files modified:** 10 (2 new test files, 7 source files extended, 1 helper file extended)

## Accomplishments

- **Runtime buildings (PROD-01/02):** types.ts gained the 12 raw/workshop/warehouse `BuildingType`s + `raw`/`workshop`/`storage` categories; the runtime BUILDINGS catalog gained all 12 defs mirroring the data catalog (clay_pit 120/8 … warehouse 150/3, quarry footprint 3), no spawnEveryTicks.
- **tickProduction (decision 4):** wired into `tick()` right after tickFood — deposit-gated extraction into site stock (capped at 8), olive/grape farm output, workshop input consumption/output production gated by labor, feedstock porters (whole-unit moves into workshop inputs or warehouses) and output porters (workshop output → nearest valid warehouse). Exact conservation, stable building order, RNG/clock-free.
- **Production advisor (PROD-02):** `productionAdvisorRows(SimState, notes?)` + `productionAdvisorSummary` in advisors.ts and `getProductionAdvisor()/getProductionAdvisorRows()` on the runner — status/bottleneck/destination/output from live internal state, never fabricated; summary counts workshops/blocked/outputFull/missingInput/noDestination and per-commodity output stock.
- **Helpers reused by 06-03:** `productionChainMap()` (trees patch + clay_deposit TileState stamp) and `buildProductionCity()` with a connected road grid.
- **Additive only:** existing 444 tests green; goldens/SimState shape untouched (production field internal, excluded from toBuildingState); data-catalog and buildings-catalog closed arrays unaffected.

## Task Commits

Each task was executed without git commits per executor instruction (write SUMMARY/VERIFICATION files only).

1. **Task 1: Runtime production buildings + SimRunner.tickProduction() chain (PROD-01/02, decision 4)** - types.ts, buildings.ts, walkers.ts, production.ts, runner.ts, game/buildingArt.ts, game/palette.ts, tests/helpers.ts, tests/integration/production-chain.test.ts
2. **Task 2: Production advisor data from live sim state (PROD-02, decision 4)** - advisors.ts, runner.ts, tests/unit/advisors.test.ts

## Files Created/Modified

- `src/sim/types.ts` - Additive BuildingType (12) + BuildingCategory (raw/workshop/storage)
- `src/sim/buildings.ts` - 12 runtime building defs (data-catalog cost/workers, requiresRoad, no spawn)
- `src/sim/walkers.ts` - optional `production?: ProductionState` + lastProduced/lastDestination fields (internal, non-serialized)
- `src/sim/production.ts` - EXTRACTION/WORKSHOP_BUILDING_TYPES maps, RAW_OLIVE_GRAPE, EXTRACTION_OUTPUT_CAPACITY
- `src/sim/runner.ts` - tickProduction + moveStock helper + getProductionAdvisor(s)
- `src/sim/advisors.ts` - ProductionAdvisorRow, productionAdvisorRows, productionAdvisorSummary
- `src/game/buildingArt.ts`, `src/game/palette.ts` - entries for the new types (exhaustive maps)
- `tests/helpers.ts` - productionChainMap + buildProductionCity
- `tests/integration/production-chain.test.ts` - chain + deposit + no-loss tests
- `tests/unit/advisors.test.ts` - production advisor describe block

## Decisions Made

- Production state stays internal to BuildingInstance so getStateJson/goldens are unaffected (T-06-08).
- Feedstock porters move whole units only, preventing negative workshop inputs from tickWorkshop's integer consumption (T-06-10).
- Advisor rows use a runner-recorded ProductionInternalNote overlay; SimState-only fallback reports 'idle' rather than inventing values (T-06-06).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Whole-unit feedstock porter loads**
- **Found during:** Task 1 (tickProduction + chain test)
- **Issue:** moveStock moved fractional clay (0.3/tick) into workshop inputs, then tickWorkshop consumed a whole unit → negative workshop input stock (conservation violated).
- **Fix:** moveStock now moves only whole units (returns 0 unless source ≥ 1 and room ≥ 1), matching the one-load semantics and keeping inputs non-negative.
- **Files modified:** src/sim/runner.ts
- **Verification:** production-chain no-loss test asserts no negative stock; full suite green.
- **Committed in:** n/a (no commits per executor instruction)

**2. [Rule 2 - Missing Critical] Road network fragmentation stranded labor**
- **Found during:** Task 1 (chain test)
- **Issue:** fragmentary road rows meant labor walkers never reached the clay pit (all labor walkers with null targets), so nothing produced.
- **Fix:** connected the road grid in buildProductionCity with a vertical spine (incl. (7,10)) so every staffable building is road-reachable.
- **Files modified:** tests/helpers.ts
- **Verification:** chain test green; pit staffed and producing.
- **Committed in:** n/a

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both fixes necessary for the runner integration to actually move goods with conservation. No scope creep.

## Issues Encountered

- Quarry placement test collided with its approach road (footprint 3 south edge) — moved the approach road below the footprint on row 0.
- The advisor summary's per-commodity output stock initially omitted warehouse stock, so a fully-ported workshop read 0 — extended getProductionAdvisor to merge warehouse stock into outputStock (the books).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- tickProduction + helpers ready for 06-03: chunked-tick determinism (over buildProductionCity) and end-to-end runner acceptance (deposit enforcement, pipeline + warehouse fallback, blocked no-loss, advisor rows).

---
*Phase: 06-production-manufacturing*
*Completed: 2026-08-03*
