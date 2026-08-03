---
phase: 01-time-deterministic-core
reviewed: 2026-08-03T10:05:00Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - src/sim/runner.ts
  - src/sim/time.ts
  - src/sim/types.ts
  - src/sim/tile.ts
  - src/sim/map.ts
  - tests/unit/paused-queue.test.ts
  - tests/unit/time.test.ts
  - tests/unit/tile.test.ts
  - tests/runner-accessors.test.ts
  - tests/determinism/determinism.test.ts
  - tests/golden/golden.test.ts
  - tests/golden/fixtures/paused-commands-golden.json
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-08-03T10:05:00Z
**Depth:** deep
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the Phase 1 "Time & Deterministic Core" changes: the `TimeSystem` docstring/contract update (src/sim/time.ts), the new `SimRunner.demolish()` + `PendingCommand`/`SaveCommand` demolish variants (src/sim/runner.ts, src/sim/types.ts), the new `getTileState()` read-only accessor (src/sim/runner.ts), and the accompanying unit/determinism/golden tests plus the paused-commands golden fixture. `npm run typecheck` is clean and `npm run test` passes (271 tests / 44 files) — the phase is green.

No crashes, security issues, or BLOCKER-grade defects were found. The main concerns are contract/quality gaps that the new public API and this phase's documentation surface but do not fully deliver: (1) the `TileState` side-channel fields the new `getTileState` accessor exposes are never populated by any sim system, so `road` returns `false` on an actual road tile; (2) the newly-documented frame-rate-independence formula does not hold at speed 8x with the default `maxCatchupSteps` cap; (3) the new "chunked-stepping" determinism test is a tautology and cannot detect that gap; and (4) saving while paused silently drops queued commands.

## Warnings

### WR-01: `getTileState().road` (and other side-channel fields) are never populated — false for real road tiles

**File:** `src/sim/runner.ts:482-486` (accessor), `src/sim/tile.ts:35` (default)
**Issue:** `getTileState(x, y)` returns `{ ...this.map.tileState(x, y) }`, but nothing in `src/sim/` ever writes to the expanded per-tile state — `mutateTileState` has zero call sites in `src/`. Every side-channel field therefore returns its neutral default forever. Empirically verified: after `placeBuilding('road', 2, 2)` on an all-earth map, the terrain grid shows `'road'` while `getTileState(2, 2).road === false`. The CORE-03 audit (SUMMARY 01-03) only checked that the 15 fields exist in the `TileState` interface, not that they reflect actual sim state. A UI/overlay consumer reading `getTileState().road`, `.desirability`, `.fireRisk`, etc. will get misleading all-default values through this new public API.
**Fix:** In `getTileState`, derive the grid-derived fields from the terrain (e.g. `const s = this.map.tileState(x, y); return { ...s, road: this.map.get(x, y) === 'road' }`), or populate `TileState.road` in `placeBuilding`/`demolish` and the other fields in their respective systems. Alternatively, mark the side-channel as not-yet-wired in the type docs so consumers don't trust it.

### WR-02: Frame-rate-independence claim is false at 8x with the default `maxCatchupSteps` cap

**File:** `src/sim/time.ts:14-22`
**Issue:** The docstring added this phase asserts that for a wall-clock window of T ms at speed S the tick count is `floor((T*S)/stepMs)` and that "any partition of T ... produces ... the identical tick count ... so identical sim state results at any frame rate," framing the `maxCatchupSteps` drop as firing "only after severe hitches." This is not true at supported high-speed presets. Empirically verified with the default cap (5), speed 8x, stepMs 250: a single 1000 ms frame yields **5** ticks while 62×16 ms frames over the same total yield **31** ticks (a 26-tick divergence). At 8x the cap is breached by a 1-second frame — a fork that is not a "severe hitch." Because this docstring is treated as the phase-1 frame-rate-independence contract (CORE-01), the discrepancy is a real determinism trade-off that is under-disclosed.
**Fix:** Qualify the contract text — the identity holds only while no single frame produces more than `maxCatchupSteps` cumulative ticks — or scale the catch-up budget by speed (e.g. `maxCatchupSteps * max(1, speed)`), or drop the backlog proportionally instead of zeroing `acc`.

### WR-03: "Chunked stepping (frame-rate independence)" determinism test is a tautology and cannot detect the WR-02 gap

**File:** `tests/determinism/determinism.test.ts:54-77`
**Issue:** The test batches identical `runner.tick()` calls in chunk sizes 1/7/50. `SimRunner.tick()` is an atomic fixed step and `TimeSystem` is never used, so the chunk boundary cannot influence any state — the three runs are the same sequence of 600 `tick()` calls by construction and the assertion can never fail. It is a valid idempotency check, but its name and the SUMMARY claim ("sim-level observable form of the floor((T*S)/stepMs) frame-rate-independence argument") overstate what is tested, and it provides no protection against the slicing-dependent behavior WR-02 demonstrates.
**Fix:** Drive the comparison through real time slicing — feed `TimeSystem.advance(d)` with different partitions of a fixed total and call `runner.tick()` the returned number of times per frame — then assert identical `getStateJson()`. Short of that, rename the test to something like "tick batching is order-independent" so it does not imply frame-rate-independence coverage.

### WR-04: Saving while paused silently drops queued commands

**File:** `src/sim/runner.ts:565-574` (`getSaveData`), `src/sim/runner.ts:581-596` (`fromSaveData`)
**Issue:** `getSaveData` serializes only `saveCommands`; `pendingCommands` are excluded (and are only recorded once drained, i.e. applied). If a save is taken while paused with queued commands (e.g. autosave on pause, or a user quit-during-pause), reloading loses the queued place/demolish/policy — verified: 1 pending command → 0 pending after load and the building never appears. The behavior predates this phase for place/policy, but the new paused-command pipeline (CORE-02) extends the surface to demolish and this is the phase that formalizes "commands issued while paused are deferred" as a contract.
**Fix:** In `getSaveData`, flush pending commands first (drain-and-apply or fold them into the command list before snapshotting), or serialize `pendingCommands` and replay them at the head of `fromSaveData` with the runner paused, then resume to the saved tick.

## Info

### IN-01: Catch-all `else` dispatch for command kinds

**File:** `src/sim/runner.ts:156` (`drainPendingCommands`), `src/sim/runner.ts:590` (`fromSaveData`)
**Issue:** `else this.demolish(...)` (and `else runner.demolish(...)` in replay) treat any non-place, non-policy command as demolish. Correct today only because the unions have exactly three members; adding a fourth `PendingCommand`/`SaveCommand` kind later will silently route it to `demolish` instead of failing typecheck.
**Fix:** Use explicit `else if (cmd.kind === 'demolish')` branches so the compiler flags new kinds as unreachable/exhaustiveness errors.

### IN-02: `demolish` returns `true` while paused even when the tile has no building

**File:** `src/sim/runner.ts:399-401`
**Issue:** When paused, `demolish(x, y)` enqueues and returns `true` without checking `buildingAt`; the drain later finds no building, returns `false`, and writes no `commandLog` entry. The caller (UI) gets a success signal for a command that will silently no-op. This mirrors the pre-existing `placeBuilding`/`setPolicy` paused behavior, so it is consistent, but the `boolean` return is a misleading contract for the paused branch.
**Fix:** Either validate existence before enqueuing, or document that the paused return means "queued", not "applied".

### IN-03: Duplicated paused-queue tests across two files

**File:** `tests/runner-accessors.test.ts:107-126`
**Issue:** The `paused command queue (CORE-02)` describe block in `tests/runner-accessors.test.ts` overlaps tests that now live in `tests/unit/paused-queue.test.ts` (defer policy/place while paused, immediate apply when unpaused). Duplicated coverage can drift independently.
**Fix:** Remove the older describe block from `runner-accessors.test.ts` (CORE-02's dedicated suite covers it) or point it at shared helpers.

### IN-04: `TimeSystem.setSpeed` accepts unvalidated values

**File:** `src/sim/time.ts:56-58`
**Issue:** `setSpeed` accepts any number, including negatives or `NaN`; a negative speed makes `acc` decrease and `pendingMs()` go negative with no ticks, silently corrupting the accumulator. Callers use the fixed presets so it is not currently exercised, but the method is public.
**Fix:** Clamp/validate in `setSpeed` (e.g. reject `speed <= 0 || !Number.isFinite(speed)`), or narrow the setter to `SpeedMultiplier`.

---

_Reviewed: 2026-08-03T10:05:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
