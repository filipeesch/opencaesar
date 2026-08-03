---
phase: 01-time-deterministic-core
plan: 01-01
subsystem: sim
tags: [time, determinism, timestep, fixed-step, pause, speed, core-01]

# Dependency graph
requires: []
provides:
  - "Documented floor((T*S)/stepMs) integer-division frame-rate-independence argument in the TimeSystem contract"
  - "Sim-level chunked-stepping determinism test making frame-rate independence observable"
  - "CORE-01 test gap fill: per-preset (0.5x/4x/8x) speeds, pause-at-8x, exact boundary, accumulator carry-over, all-preset acceptance"
affects: [phases relying on the fixed-timestep contract and determinism suite]

actuals:
  tokens: 1309
  tasks: 2
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sim-level chunked-stepping test as the observable form of the frame-rate-independence argument"

key-files:
  created: []
  modified:
    - src/sim/time.ts
    - tests/unit/time.test.ts
    - tests/determinism/determinism.test.ts

key-decisions:
  - "Documented the frame-rate-independence argument (floor((T*S)/stepMs)) in the TimeSystem docstring; the maxCatchupSteps backlog drop is explicitly noted as the one deliberate exception."
  - "8x-speed single-advance test constructs TimeSystem(250, 8) — the default maxCatchupSteps of 5 caps a single 8-tick burst, so the cap was lifted to observe the multiplier itself (the cap is separately covered by the existing catch-up test)."

patterns-established:
  - "Determinism tests reuse buildFoodCity + setPolicy from tests/helpers.ts to make the frame-rate-independence contract observable at the sim level."

requirements-completed: [CORE-01]

coverage:
  - id: D1
    description: "TimeSystem header docstring documents the explicit floor((T*S)/stepMs) integer-division frame-rate-independence argument (CORE-01)"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "tests/unit/time.test.ts#produces the same tick count regardless of how time is sliced (frame-rate independence)"
        status: pass
      - kind: unit
        ref: "tests/determinism/determinism.test.ts#chunked stepping (frame-rate independence) yields identical state"
        status: pass
    human_judgment: false
  - id: D2
    description: "CORE-01 test gap fill — per-preset 0.5x/4x/8x speeds, paused-at-8x, exact-boundary, accumulator carry-over, and all-preset acceptance in tests/unit/time.test.ts"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "tests/unit/time.test.ts (12 cases, incl. 0.5x/4x/8x, pause-at-8x, exact boundary, carry-over, preset acceptance)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Chunked-stepping determinism test — same seed/map/command script ticked in chunk sizes [1,7,50] produces an identical getStateJson() (frame-rate independence observable at sim level)"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "tests/determinism/determinism.test.ts#chunked stepping (frame-rate independence) yields identical state"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-08-03
status: complete
---

# Phase 1 Plan 1: Time & Deterministic Core — Time System Summary

**Baseline recorded (typecheck clean, 253 tests / 43 files), TimeSystem docstring extended with the floor((T*S)/stepMs) integer-division frame-rate-independence argument, and CORE-01 test gaps filled (per-preset speeds, pause-at-8x, exact boundary, accumulator carry-over) plus a sim-level chunked-stepping determinism test.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-08-03T09:38:00Z
- **Completed:** 2026-08-03T09:41:23Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Audited CORE-01 against the as-built implementation: `TimeSystem.advance` accumulates `realDtMs * speed` and divides by `stepMs` with integer division (pause → 0 at time.ts:29, speed scaling at line 30, `maxCatchupSteps` cap at lines 32-39); `MainScene.update` (MainScene.ts:135-142) ticks the runner exactly the returned count; `HUDScene` (HUDScene.ts:157-170) binds all five presets (0.5/1/2/4/8) plus pause/resume. All present and correct as-built.
- Extended the `TimeSystem` docstring (src/sim/time.ts) with the explicit argument: total ticks over a wall-clock window of T ms at speed S = floor((T*S)/stepMs), a function of total simulated ms only — hence identical state at any frame rate, with `maxCatchupSteps` noted as the sole deliberate exception.
- Added a chunked-stepping determinism test (tests/determinism/determinism.test.ts) ticking the same seed/map/command script in chunk sizes [1, 7, 50] and asserting byte-identical `getStateJson()`.
- Filled CORE-01 test gaps in tests/unit/time.test.ts: 0.5x (2 ticks / 1000ms), 4x (4 ticks / 250ms), 8x (8 ticks / 250ms), paused-at-8x (0 ticks), exact boundary (1 tick), accumulator carry-over (125+125 → 1 tick with `pendingMs()` reflecting the leftover), and all-preset `setSpeed` acceptance.

## Task Commits

Each task was committed atomically:

1. **Task 1: Baseline audit + document the integer-division frame-rate-independence argument** — `orchestrator-owned` (feat/docs)
2. **Task 2: Fill CORE-01 test gaps: per-preset speeds, pause at 8x, exact boundary, accumulator carry** — `orchestrator-owned` (test)

**Plan metadata:** `orchestrator-owned` (docs: complete plan)

_Note: commits are owned by the orchestrator per this executor's instructions; no commits were made by the executor._

## Files Created/Modified
- `src/sim/time.ts` - Extended TimeSystem docstring with explicit floor((T*S)/stepMs) frame-rate-independence argument (documentation-only, no runtime symbol changes).
- `tests/unit/time.test.ts` - Added 0.5x/4x/8x speed, pause-at-8x, exact-boundary, accumulator carry-over, and all-preset cases (5 → 12 tests).
- `tests/determinism/determinism.test.ts` - Added chunked-stepping determinism case (5 → 6 tests).

## Decisions Made
- Documented the frame-rate-independence argument in the `TimeSystem` docstring, explicitly naming `maxCatchupSteps` as the one deliberate exception so future readers don't misread the formula as unconditional.
- For the 8x test: constructed `new TimeSystem(250, 8)` so a single 250ms advance can emit all 8 ticks. The default `maxCatchupSteps=5` caps single-advance bursts (spiral-of-death protection), which made the plan's literal `new TimeSystem(250)` + 8-ticks expectation unachievable; the cap itself remains covered by the existing catch-up test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan expectation bug] 8x speed test was unachievable at the default maxCatchupSteps**
- **Found during:** Task 2 (Fill CORE-01 test gaps)
- **Issue:** The plan expected `new TimeSystem(250)` with `advance(250)` at speed 8 to return 8 ticks, but `TimeSystem`'s default `maxCatchupSteps = 5` caps any single-advance burst at 5 (src/sim/time.ts:32-39), so the test returned 5 instead of 8.
- **Fix:** Constructed `new TimeSystem(250, 8)` for the 8x case (higher cap) so the multiplier itself is under test; the catch-up cap remains covered by the pre-existing `caps catch-up after a hitch` test.
- **Files modified:** tests/unit/time.test.ts
- **Verification:** tests/unit/time.test.ts passes (12/12), determinism green, typecheck clean.
- **Committed in:** orchestrator-owned

---

**Total deviations:** 1 auto-fixed (1 plan-expectation mismatch)
**Impact on plan:** No scope creep; the 8x multiplier is still verified. The cap behavior is intentional and separately covered.

## Issues Encountered
None — only the 8x/cap mismatch above, resolved as a documented deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CORE-01 time core locked: frame-rate-independence argument documented and observable via the chunked-stepping determinism test.
- Full suite green (261 tests / 43 files — 253 baseline + 8 new).
- Ready for plan 01-02 (CORE-02 paused-command demolish gap-fill).

---
*Phase: 01-time-deterministic-core*
*Completed: 2026-08-03*
