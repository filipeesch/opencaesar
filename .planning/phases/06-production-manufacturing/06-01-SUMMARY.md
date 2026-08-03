---
phase: 06-production-manufacturing
plan: 06-01
subsystem: sim-production
tags: [sim, production, extraction, workshops, porter, deposit, destination, vitest]

requires: []
provides:
  - "Deposit-requirement gates satisfiesDeposit/canExtract over TileState.resourceType + terrain (PROD-01)"
  - "Destination policy porterDestination (§16.4: needy workshop > warehouse > blocked) and porterDeliversTo into destination stock (PROD-02)"
  - "workshopBottleneck label incl. the no_destination case (PROD-02)"
  - "No-loss + pipeline unit tests (extraction / production-pipeline / workshop-blocked)"
affects: [06-02 (runner tickProduction uses these model gates), 06-03 (acceptance + determinism)]

actuals:
  tokens: 4600
  tasks: 3
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Executable deposit gate backed by TileState.resourceType/terrain instead of a cosmetic `requires` string"
    - "Policy-first destination selection factory (porterDestination) validated by accepts + capacity"

key-files:
  created:
    - tests/unit/extraction.test.ts
    - tests/unit/production-pipeline.test.ts
    - tests/unit/workshop-blocked.test.ts
  modified:
    - src/sim/production.ts

key-decisions:
  - "satisfiesDeposit resolves 'trees' via terrain (timber yard) and clay/iron/marble via TileState.resourceType matching the requirement string"
  - "porterDeliversTo models a total-capacity store: remaining room = capacity − used stock, so a full destination receives 0 with the load kept"
  - "porterDestination is additive and dispatches neediest workshop (ties by distance) then nearest warehouse, then null (blocked, keep load)"

patterns-established:
  - "Extraction gate: satisfiesDeposit(site, terrain, resourceType) && hasWorkers = canExtract"

requirements-completed: [PROD-01, PROD-02]

coverage:
  - id: D1
    description: "Every extraction site requires its deposit — clay pit→clay_deposit, timber yard→trees terrain, iron mine→iron_deposit, marble quarry→marble_deposit; mismatched/absent deposits produce nothing and the gate is pure/deterministic"
    requirement: PROD-01
    verification:
      - kind: unit
        ref: "tests/unit/extraction.test.ts#extraction deposit requirements"
        status: pass
    human_judgment: false
  - id: D2
    description: "Destination validity §16.4 — needy workshop that accepts+has capacity beats full workshop; workshop priority over warehouse; nearest valid warehouse fallback; null over all-invalid (load kept)"
    requirement: PROD-02
    verification:
      - kind: unit
        ref: "tests/unit/production-pipeline.test.ts#destination validity"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full multi-step pipeline for workshop and warehouse destinations: input consumed → output produced → porter dispatch → destination stock rises by exactly the ported load (conservation) and never exceeds capacity"
    requirement: PROD-02
    verification:
      - kind: unit
        ref: "tests/unit/production-pipeline.test.ts#pipeline"
        status: pass
    human_judgment: false
  - id: D4
    description: "Blocked-state no-loss — missing_input / output_full / inactive-blocked / idle-porter / no-valid-destination preserve every held unit byte-identically across single and repeated ticks"
    requirement: PROD-02
    verification:
      - kind: unit
        ref: "tests/unit/workshop-blocked.test.ts#blocked states preserve goods"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-08-03
status: complete
---

# Phase 06 Plan 06-01: Production Model Gates Summary

**Deposit-requirement gates (satisfiesDeposit/canExtract), §16.4 destination policy (porterDestination) with load transfer into destination stock (porterDeliversTo), and no-loss/pipeline unit coverage locking the production model contract**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-03T17:11Z
- **Completed:** 2026-08-03T17:16Z
- **Tasks:** 3
- **Files modified:** 1 created test dir; 3 test files created; 1 source file extended

## Accomplishments

- **Deposit enforcement (PROD-01):** `EXTRACTION_SITES[].requires` is now executable — `satisfiesDeposit`/`canExtract` gate extraction on `TileState.resourceType` (clay/iron/marble) or `'trees'` terrain (timber), pure and RNG/clock-free.
- **Destination policy (PROD-02 §16.4):** `porterDestination` enforces needy-workshop → warehouse → blocked with accepts+capacity validity; `porterDeliversTo` moves up to one load into destination stock with exact conservation; `workshopBottleneck` reports the no-destination case.
- **Blocked-state no-loss locked by tests:** missing_input / output_full / inactive / idle-porter / no-valid-destination all preserve units byte-identically (decision 3); verified without touching the already-correct model.
- **Baseline preserved:** baseline re-confirmed at 424 tests/57 files; extraction (+5), pipeline (+9), no-loss (+6) → 444 tests all green; typecheck clean.

## Task Commits

Each task was executed without git commits per executor instruction (write SUMMARY/VERIFICATION files only).

1. **Task 1: Baseline + deposit-requirement gate (PROD-01)** - src/sim/production.ts (satisfiesDeposit/canExtract, DepositTerrain), tests/unit/extraction.test.ts
2. **Task 2: Destination validity + porter dispatch into destination stock (PROD-02 §16.4)** - src/sim/production.ts (LoadDestination, porterDestination, porterDeliversTo, workshopBottleneck), tests/unit/production-pipeline.test.ts
3. **Task 3: Blocked-state no-loss verification and tests (PROD-02, decision 3)** - tests/unit/workshop-blocked.test.ts

## Files Created/Modified

- `src/sim/production.ts` - Added satisfiesDeposit/canExtract/DepositTerrain, LoadDestination/porterDestination/porterDeliversTo/workshopBottleneck (all additive; existing exports unchanged)
- `tests/unit/extraction.test.ts` - Deposit-requirement enforcement for the four sites
- `tests/unit/production-pipeline.test.ts` - Destination validity (incl. warehouse fallback) + full multi-step pipeline with conservation
- `tests/unit/workshop-blocked.test.ts` - Blocked-state no-loss across all four states + repeated ticks

## Decisions Made

- "trees" requirement resolves via terrain; clay/iron/marble via resourceType match — one code path each.
- `porterDeliversTo` treats capacity as total capacity (room = capacity − used), so a full store refuses with 0 moved and output stays — no silent over-capacity writes.
- No existing export renamed/removed; `selectDestination`/`porterDelivers` stay as-is for the existing suites.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. (Two test-authoring mis-reads during development — timber satisfied by terrain not resourceType, and capacity-as-total vs remaining — were corrected in the test assertions and are reflected above.)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Model gates ready for runner wiring in 06-02 (EXTRACTION_SITES/WORKSHOPS type maps, canExtract, tickWorkshop, porterDestination, porterDeliversTo, workshopBottleneck).
- 06-02 now builds tickProduction + runtime building types and the production advisor on top of this surface.

---
*Phase: 06-production-manufacturing*
*Completed: 2026-08-03*
