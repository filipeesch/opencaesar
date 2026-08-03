---
phase: 04-water-system
plan: 04-02
subsystem: water
tags: [water, aqueduct, fountain, determinism, WATR-03, WATR-04]

requires:
  - phase: 04-01
    provides: "TileWater.desirability field + well-penalty pass in WaterSystem.compute()"
provides:
  - "tests/unit/aqueduct-flow.test.ts: 5 deterministic flow-propagation tests (source→chain→fountain, block, repair, road-arch crossing, repeat-call equality)"
  - "FOUNTAIN_DESIRABILITY_BONUS const, FountainDef interface, resolveFountainActivity() helper, fountain bonus extended into the desirability pass"
affects: [04-03, Phase 18 Management UI]

actuals:
  tokens: 1600
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Fountain activity gated by a single resolveFountainActivity(active = supplied && staffed) before feeding the coverage model"
    - "Determinism locked by deep-equal repeat-call tests over the flow result sets"

key-files:
  created:
    - tests/unit/aqueduct-flow.test.ts
    - tests/unit/fountain.test.ts
  modified:
    - src/sim/water.ts

key-decisions:
  - "resolveFountainActivity is the single gate between network/workers and clean-water coverage: active = supplied && staffed; go-dark enforced by removal of either."
  - "FOUNTAIN_DESIRABILITY_BONUS shares the TileWater.desirability field (per-tile additive with the well penalty from 04-01)."

patterns-established:
  - "Determinism is asserted by calling computeFlow twice on the same instance and deep-comparing the derived sets, converting Sets to sorted key arrays."

requirements-completed: [WATR-03, WATR-04]

coverage:
  - id: D1
    description: "Aqueduct flow propagation — deterministic source→chain→fountain supply, blocked segment stops downstream flow + fountain supply, repair restores it, and a road under the chain never breaks flow"
    requirement: WATR-03
    verification:
      - kind: unit
        ref: "tests/unit/aqueduct-flow.test.ts#aqueduct flow propagation (WATR-03): is deterministic: identical inputs produce identical flowing/supplied sets across repeated calls"
        status: pass
      - kind: unit
        ref: "tests/unit/aqueduct-flow.test.ts#aqueduct flow propagation (WATR-03): propagates flow from the source through the chain to a fountain tile"
        status: pass
      - kind: unit
        ref: "tests/unit/aqueduct-flow.test.ts#aqueduct flow propagation (WATR-03): a broken (missing) segment stops downstream flow and fountain supply"
        status: pass
      - kind: unit
        ref: "tests/unit/aqueduct-flow.test.ts#aqueduct flow propagation (WATR-03): repair restores downstream flow and fountain supply after the missing segment is re-added"
        status: pass
      - kind: unit
        ref: "tests/unit/aqueduct-flow.test.ts#aqueduct flow propagation (WATR-03): a road under the chain does not break flow (road-arch crossing)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fountain network requirement + go-dark + desirability — active only when supplied && staffed, clean water within radius, desirability bonus additive with the well penalty, go-dark on water loss AND on worker loss"
    requirement: WATR-04
    verification:
      - kind: unit
        ref: "tests/unit/fountain.test.ts#fountains (WATR-04): enforces the network requirement: supplied && staffed yields an active clean-water source with a desirability bonus"
        status: pass
      - kind: unit
        ref: "tests/unit/fountain.test.ts#fountains (WATR-04): covers clean water only within its radius"
        status: pass
      - kind: unit
        ref: "tests/unit/fountain.test.ts#fountains (WATR-04): goes dark without water or workers: clean class drops to none with zero desirability"
        status: pass
      - kind: unit
        ref: "tests/unit/fountain.test.ts#fountains (WATR-04): combines the fountain bonus and well penalty where they overlap, fountain still outranks well"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-08-03T12:28:00Z
status: complete
---

# Phase 04 Plan 02: Aqueduct Flow Propagation + Fountain Network Requirement Summary

**Deterministic aqueduct flow-propagation tests (source→chain→fountain, block, repair, road-arch crossing, repeat-call equality) and a WATR-04 fountain `supplied && staffed` network gate with go-dark and a desirability bonus.**

## Performance

- **Duration:** 4 min
- **Started:** ~2026-08-03T12:26:30Z
- **Completed:** 2026-08-03T12:28:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments

- Created `tests/unit/aqueduct-flow.test.ts` (5 tests) covering deterministic repeats (deep-equal flowing/suppliedFountains), source→chain→fountain supply with an isolated-tile negative case, blocked-segment desupply, repair restoring supply, and road-arch crossing (flowing.size === 5).
- Reconfirmed the determinism audit: `src/sim/water.ts` has no `Math.random`/`Date`/`Date.now`/`performance.now` (grep = no match); no implementation change was needed — all five flow cases pass against the existing model.
- Added `FOUNTAIN_DESIRABILITY_BONUS = 4`, the `FountainDef` interface and `resolveFountainActivity()` (active = supplied && staffed), and extended the 04-01 desirability pass so active fountains add the bonus per tile within radius.
- Created `tests/unit/fountain.test.ts` (4 tests): network requirement, clean-water radius, both go-dark vectors (loss of supply and loss of workers drop clean→none with zero desirability), and well/fountain desirability overlap with fountain outranking well.
- Full suite now 335 tests / 55 files green; typecheck clean.

## Task Commits

Each task was executed and verified inline. Per the phase-execution instruction, no commits were made (SUMMARY/VERIFICATION files only).

1. **Task 1 (auto): Aqueduct flow propagation, block/repair, road-crossing, and determinism tests (WATR-03)** — verify: `npm run typecheck && npx vitest run tests/unit/aqueduct-flow.test.ts && npx vitest run tests/unit/water.test.ts` → PASS (5 + 11 tests).
2. **Task 2 (auto): Fountain network requirement, go-dark, and desirability (WATR-04)** — verify: `npm run typecheck && npx vitest run tests/unit/fountain.test.ts && npx vitest run tests/unit/water.test.ts` → PASS (4 + 11 tests).

**Plan metadata:** no `docs` commit (intentional — no commits in this run).

## Files Created/Modified

- `src/sim/water.ts` — `FOUNTAIN_DESIRABILITY_BONUS` const; `FountainDef` interface; `resolveFountainActivity()` helper; desirability pass extended to add the fountain bonus (well penalty + fountain bonus additive).
- `tests/unit/aqueduct-flow.test.ts` — new: 5 WATR-03 flow-propagation tests.
- `tests/unit/fountain.test.ts` — new: 4 WATR-04 fountain tests.

## Decisions Made

- `resolveFountainActivity` is the single gate between fountain network/workers and clean-water coverage; WaterSystem receives only resolved active sources.
- Determinism evidenced by repeat-call deep-equality over the returned sets, not by code inspection alone.

## Deviations from Plan

None - plan executed exactly as written. (The aqueduct implementation needed no fix — the existing BFS model satisfied all five cases.)

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 04-03: bath wiring will reuse the `desirability` grid path; advisors extension will consume ReservoirState (from 04-01) and the TileWater surface.
- 335 tests / 55 files green, typecheck clean.

---
*Phase: 04-water-system*
*Completed: 2026-08-03*
