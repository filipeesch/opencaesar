# Phase 1: Time & Deterministic Core — Research

**Date:** 2026-08-03
**Researcher:** gsd-phase-researcher (inline, combined session)
**Baseline verified:** `npm run typecheck` clean; `npm run test` → **253 tests pass** across 43 files (the "126 tests" figure in CONTEXT.md/ROADMAP.md is stale). Suite runs in ~2s, so per-task verification is cheap and the full suite can run after every task.

---

## 1. Existing Implementation Summary

### CORE-01 — pause + 0.5/1/2/4/8× speeds + fixed timestep (implemented as-built)

- `TimeSystem` (`src/sim/time.ts:11-55`): accumulator scheduler. `advance(realDtMs)` (time.ts:28-41) does `acc += realDtMs * speed`, then integer-divides by `stepMs` into discrete ticks, capped by `maxCatchupSteps` to drop backlog on hitches (time.ts:32-39). Pause → returns 0 (time.ts:29). `setSpeed` (time.ts:43-45). `SPEED_PRESETS = [0.5,1,2,4,8]` (time.ts:58).
- Wiring: `MainScene.update` (`src/game/scenes/MainScene.ts:135-142`) feeds Phaser `delta` into `timeSystem.advance(delta)` and calls `runner.tick()` exactly `n` times. Pause/speed surface on the scene (`MainScene.ts:158-174`); HUD binds all 5 speed buttons + pause/resume (`src/game/scenes/HUDScene.ts:157-170`).
- Tests: `tests/unit/time.test.ts` (5 tests) — frame-rate independence across slice layouts, pause, speed scaling, presets, catch-up cap.
- E2E: pause halts/resumes simulated tick (`e2e/acceptance.spec.ts:16-26`, `e2e/sessions.spec.ts:30-47`).

### CORE-02 — paused commands consumed on next step (implemented for build/policy, MISSING demolish)

- `SimRunner.setPaused` (`src/sim/runner.ts:135-137`); `pendingCommands` queue (runner.ts:107); `enqueue` (runner.ts:157-159); `drainPendingCommands` runs at the top of `tick()` before the tick count increments (runner.ts:147-155, 162).
- `placeBuilding` when paused enqueues and returns `{ ok: true }` (runner.ts:330-333); `setPolicy` when paused enqueues (runner.ts:402-405).
- `PendingCommand` union (runner.ts:56-58) has only `place` and `policy`. `SaveCommand` (`src/sim/types.ts:63-65`) likewise has only `place`/`setPolicy`; replay in `fromSaveData` (runner.ts:543-556).
- Test: `tests/runner-accessors.test.ts:75-94` (policy queued while paused, consumed on next tick).

### CORE-03 — expanded per-tile state (interface complete, minor test + reachability gaps)

- `TileState` (`src/sim/tile.ts:9-25`) already contains all 15 CORE-03 fields: elevation, fertility, resourceType, resourceAmount, waterDepth, aqueduct, road, desirability, fireRisk, collapseRisk, pollution, traffic, serviceCoverage, ownership, blocked. `defaultTileState()` (tile.ts:27-45) supplies neutral defaults.
- Accessors on `Map`: `tileState(x,y)` (src/sim/map.ts:128-131) and `mutateTileState` (map.ts:134-137).
- Test: `tests/unit/tile.test.ts` (3 tests). Only `src/sim/*` files reference `TileState` — read-only-outside-src/sim holds today by construction.

---

## 2. Gaps vs Requirements

### CORE-01
- **Gap (test/doc, minor):** the integer-division frame-rate-independence argument is implied by a test but never documented. CONTEXT decision requires documenting it. Fix: extend the `TimeSystem` docstring (`src/sim/time.ts:1-10`) and add a chunked-stepping determinism test (same seed ticked in chunk sizes 1/7/50 → identical `getStateJson()`).
- **Gap (test, minor):** no unit test asserts the 0.5×/4×/8× rates individually (only 2× is exercised), and no exact-boundary/accumulator-carryover assertions.
- Speed-button → `setSpeed` wiring exists in HUD; no per-preset test at the game layer (HUD is DOM-based; not unit-testable without a browser — acceptable, covered by E2E/acceptance).

### CORE-02
- **Gap (functional, GENUINE):** no `demolish` command exists anywhere in the codebase (`grep` for demolish/demolition/removeBuilding/destroyBuilding → 0 matches). CORE-02 explicitly requires demolish orders issued while paused to be consumed on the next step. Must add `SimRunner.demolish(x,y)`, a `{kind:'demolish'}` in both `PendingCommand` and `SaveCommand`, and replay support in `fromSaveData`.
- **Gap (test):** only `setPolicy`-while-paused is tested; `place`-while-paused and (new) `demolish`-while-paused are untested; no FIFO-order/next-tick-consumption test; no save/load round-trip over the paused pipeline.
- **Gap (test, per CONTEXT decision):** no golden test for the paused-command pipeline (commands issued while paused applied identically at same seed → identical final state).

### CORE-03
- **Gap (test, minor):** `tests/unit/tile.test.ts` default assertion omits `resourceAmount` (field exists but unasserted) and only asserts `desirability` in the mutation test.
- **Gap (reachability, minor-genuine):** the per-tile state is not reachable through the public sim interface — `SimRunner.getState()` exposes only the terrain grid (`tiles: this.map.toGrid()`, runner.ts:435), and `map` is private. Add `SimRunner.getTileState(x, y)` returning a shallow copy (`{ ...this.map.tileState(x,y) }`) so CORE-03 exposure holds end-to-end while the read-only contract is preserved (no live reference escapes `src/sim/`).

---

## 3. Open Questions (all RESOLVED)

| # | Question | Resolution |
|---|----------|------------|
| Q1 | Does a demolish command already exist anywhere? | **RESOLVED:** No — genuine CORE-02 gap; add it this phase. |
| Q2 | Are any CORE-03 TileState fields missing? | **RESOLVED:** No — all 15 present in `src/sim/tile.ts:9-25`. Only test coverage is incomplete. |
| Q3 | Is TileState read-only outside src/sim today? | **RESOLVED:** Yes by construction (only src/sim references it). New `SimRunner.getTileState` must return a copy, not the live ref, to keep it so. |
| Q4 | Should SimRunner expose per-tile state? | **RESOLVED:** Yes — minimal `getTileState(x,y)` copy accessor (CORE-03 "exposes"; also the future overlays consumer in Phase 18). Claude's discretion per CONTEXT. |
| Q5 | Where does the paused-command pipeline golden live? | **RESOLVED:** New fixture `tests/golden/fixtures/paused-commands-golden.json` + case in `tests/golden/golden.test.ts`; regen via `npm run test:golden:update`. |
| Q6 | Is a Validation Architecture section warranted? | **RESOLVED:** Yes — minimal; tests are the phase's primary deliverable and the 2s suite permits after-every-task sampling. See `01-VALIDATION.md`. |
| Q7 | Test-count discrepancy (126 vs 253)? | **RESOLVED:** Actual baseline is 253 tests passing (verified). Plans reference `npm run test`/`npx vitest run <path>` which are count-agnostic. |
| Q8 | Is `npm run test:golden:update` the correct regen path? | **RESOLVED:** Yes — `package.json:16` (`GOLDEN_UPDATE=1 vitest run tests/golden`). |

---

## 4. Validation Architecture

Applies — see `01-VALIDATION.md` (created). Plans 01-01/02/03 reference it; every task has a runnable `<automated>` verify against the fast Vitest suite.
