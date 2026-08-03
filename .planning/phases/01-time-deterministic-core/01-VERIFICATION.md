---
phase: 01-time-deterministic-core
verified: 2026-08-03T08:56:04Z
status: passed
score: 12/12 must-haves verified
behavior_unverified: 0
---

# Phase 1: Time & Deterministic Core Verification Report

**Phase Goal (ROADMAP):** Fixed-timestep scheduling decoupled from frame rate, pause/speed controls (0.5×/1×/2×/4×/8×), a paused-command queue (build/demolish/policy consumed on the next step), an expanded per-tile state surface, and locked-in golden determinism. Requirements CORE-01, CORE-02, CORE-03.
**Verified:** 2026-08-03T08:56:04Z
**Status:** passed

## Goal Achievement

### Observable Truths

All 12 truths across the three plans were verified against the actual code and passing tests. Every behavior-dependent truth is exercised by a named passing test; supporting wiring is confirmed statically.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Player can pause and select 0.5x/1x/2x/4x/8x speeds; the sim advances on a fixed timestep independent of frame rate (CORE-01) | ✓ VERIFIED | `SPEED_PRESETS=[0.5,1,2,4,8]` (src/sim/time.ts); fixed-step integer division in `TimeSystem.advance`; `MainScene.update` ticks runner exactly `n` times (MainScene.ts:135-142); HUD binds all 5 presets + pause (HUDScene.ts:157-170). Per-preset scaling proven by tests/unit/time.test.ts (0.5x/2x/4x/8x, preset acceptance); frame-rate independence by time.test.ts#frame-rate independence + determinism#chunked stepping; pause interaction E2E (e2e/acceptance.spec.ts:16-26, e2e/sessions.spec.ts:30-46). |
| 2 | TimeSystem produces tick counts by integer division of accumulated simulated ms, so total ticks over a wall-clock window is independent of frame slicing (CORE-01) | ✓ VERIFIED | Docstring documents floor((T*S)/stepMs) (src/sim/time.ts); tests/unit/time.test.ts#produces the same tick count regardless of how time is sliced (100/400/40/1000ms layouts → always 40 ticks). |
| 3 | Pausing returns zero ticks and does not accumulate simulated time (CORE-01) | ✓ VERIFIED | `advance` returns 0 when paused and skips accumulation (time.ts:29); tests/unit/time.test.ts#paused returns zero and does not accumulate + #pausing at 8x still returns zero ticks (pendingMs stays 0). |
| 4 | Stepping the same seed/map/commands in different tick chunk sizes yields an identical final state (CORE-01) | ✓ VERIFIED | tests/determinism/determinism.test.ts#chunked stepping (frame-rate independence) yields identical state — chunk sizes [1,7,50] over 600 ticks produce byte-identical `getStateJson()`. |
| 5 | Build, demolish, and policy orders issued while paused are consumed on the next fixed step (CORE-02) | ✓ VERIFIED | `drainPendingCommands` runs at the top of `tick()` (runner.ts); tests/unit/paused-queue.test.ts#defers a place order… + #defers a demolish order… + #drains place/policy/demolish in FIFO order on the first resume tick. |
| 6 | A demolish command exists on the public sim interface and removes a building's footprint and any road tiles it occupied (CORE-02) | ✓ VERIFIED | `SimRunner.demolish(x,y)` removes from buildings/buildingById, clears occupiedTiles, resets road footprints to 'earth' via `map.setRect` (type==='road'); tests/unit/paused-queue.test.ts#demolishing a road resets its footprint terrain to earth + #returns false when demolishing a tile with no building. |
| 7 | Commands issued while paused are deferred (not applied, not persisted) and drained in FIFO order on the first tick after resume (CORE-02) | ✓ VERIFIED | While paused, place/demolish/setPolicy early-return into `pendingCommands` before any state/saveCommands mutation; drain dispatches by kind in order before tickCount increments. tests/unit/paused-queue.test.ts#defers a place order…, #drains … FIFO (tickCount delta exactly 1, commandLog order place→demolish). |
| 8 | Same seed + same paused-command script produces an identical final state, and save/load round-trips the paused pipeline (CORE-02) | ✓ VERIFIED | tests/determinism/determinism.test.ts#a paused place/demolish/policy script is deterministic across runs (byte-identical); #save/load round-trips the paused command pipeline (incl. demolish) — exercises the new demolish SaveCommand branch in `fromSaveData`. |
| 9 | Per-tile state exposes all 15 CORE-03 fields: elevation, fertility, resourceType/Amount, waterDepth, aqueduct, road, desirability, fireRisk, collapseRisk, pollution, traffic, serviceCoverage, ownership, blocked | ✓ VERIFIED | `TileState` (src/sim/tile.ts:9-25) carries all 15 with neutral defaults; tests/runner-accessors.test.ts#getTileState returns a read-only copy of all 15 per-tile fields (toEqual across all 15); tests/unit/tile.test.ts#exposes neutral defaults (incl. resourceAmount=0, desirability=0). |
| 10 | Tile state stays read-only outside src/sim/: the public accessor returns a copy, never a live reference (CORE-03) | ✓ VERIFIED | `getTileState` returns `{ ...this.map.tileState(x,y) }` (shallow copy; all fields primitive); test mutates the returned object then asserts subsequent reads are unaffected. `map` is private to SimRunner. |
| 11 | Commands issued while paused are applied identically at the same seed, producing the same final state in a golden snapshot (CORE-03) | ✓ VERIFIED | tests/golden/golden.test.ts#paused-command pipeline golden + recorded fixture tests/golden/fixtures/paused-commands-golden.json; seed 24680 + foodChainMap + buildFoodCity; golden matches by strict `toEqual`. |
| 12 | The existing determinism suite and food-chain golden fixture remain green (CORE-03) | ✓ VERIFIED | Full suite green at verification: **271 tests / 44 files**; determinism suite (8 tests) green; food-chain golden regenerated byte-identical under GOLDEN_UPDATE (git diff empty) and matching in normal run. |

**Score:** 12/12 truths verified (behavior_unverified: 0)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/sim/time.ts` | TimeSystem + SPEED_PRESETS + documented floor((T*S)/stepMs) argument | ✓ EXISTS + SUBSTANTIVE | Fixed-step accumulator, pause, speed, maxCatchupSteps cap; docstring expanded in plan 01-01. |
| `src/sim/runner.ts` | SimRunner + `demolish(x,y)` + `getTileState(x,y)` + FIFO paused drain + repo in `fromSaveData` | ✓ EXISTS + SUBSTANTIVE | demolish (immediate + enqueue), getTileState copy accessor, drainPendingCommands dispatch, save replay branch all present and used. |
| `src/sim/types.ts` | SaveCommand union incl. `{ kind: 'demolish' }` | ✓ EXISTS + SUBSTANTIVE | Union extended; broken-out discriminants typecheck. |
| `src/sim/tile.ts` | TileState interface + defaultTileState (all 15 fields) | ✓ EXISTS + SUBSTANTIVE | All 15 CORE-03 fields present with neutral defaults; no edit required by plan 01-03. |
| `src/sim/map.ts` | tileState / mutateTileState primitives | ✓ EXISTS + SUBSTANTIVE | Live-reference semantics kept for sim internals; unchanged. |
| `tests/unit/time.test.ts` | 12 CORE-01 cases | ✓ EXISTS + SUBSTANTIVE | frame-rate independence, pause, speed scaling, presets, cap, 0.5x/4x/8x, pause-at-8x, boundary, carry-over, preset acceptance. |
| `tests/unit/paused-queue.test.ts` | New CORE-02 pipeline suite | ✓ EXISTS + SUBSTANTIVE | 6 cases: defer place/demolish, FIFO drain, immediate apply, empty-tile false, road terrain reset. |
| `tests/unit/tile.test.ts` | CORE-03 defaults (all 15 fields) | ✓ EXISTS + SUBSTANTIVE | Defaults now assert resourceAmount and desirability; 3 cases. |
| `tests/runner-accessors.test.ts` | Accessors incl. getTileState read-only test | ✓ EXISTS + SUBSTANTIVE | 15 tests incl. 15-field copy/mutation contract. |
| `tests/determinism/determinism.test.ts` | chunked-stepping + paused-script + save/load round-trip | ✓ EXISTS + SUBSTANTIVE | 8 tests; all byte-identical-state assertions (value/behavioral level). |
| `tests/golden/golden.test.ts` | food-chain + paused-command goldens | ✓ EXISTS + SUBSTANTIVE | 2 tests; GOLDEN_UPDATE pattern; strict `toEqual`. |
| `tests/golden/fixtures/paused-commands-golden.json` | Paused-command golden snapshot | ✓ EXISTS + SUBSTANTIVE | 16129-byte fixture seeded via `npm run test:golden:update`. |

**Artifacts:** 12/12 verified

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `TimeSystem.advance(n)` | `SimRunner.tick()` | `MainScene.update` loop (MainScene.ts:136-137) | ✓ WIRED | `for (let i=0;i<n;i++) this.runner.tick()` — exact tick-count consumption. |
| HUD speed buttons (0.5/1/2/4/8) | `TimeSystem.setSpeed` | `MainScene.setSpeed` (HUDScene.ts:163-169 → MainScene.ts:172-174) | ✓ WIRED | All five presets bound to setSpeed; setSpeed threads to timeSystem. |
| Pause overlay / pause button | `TimeSystem.setPaused` | `MainScene.setPaused` (HUDScene.ts:157, sessions/acceptance E2E) | ✓ WIRED | Pause/resume verified by E2E (acceptance.spec.ts:16-26). |
| `pendingCommands` queue | `placeBuilding` / `demolish` / `setPolicy` | `drainPendingCommands` kind-dispatch (runner.ts) | ✓ WIRED | FIFO dispatch at top of `tick()`; exercised by FIFO test. |
| `SaveCommand demolish` | `fromSaveData` replay | `else runner.demolish(c.x, c.y)` | ✓ WIRED | Replay branch present; round-trip test byte-identical. |
| `Map.tileState` | `SimRunner.getTileState` | `{ ...this.map.tileState(x,y) }` copy | ✓ WIRED | Copy returned; `map` stays private; mutation test proves isolation. |

**Wiring:** 6/6 connections verified

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| CORE-01: Pause + 0.5/1/2/4/8× speeds + fixed timestep independent of frame rate | ✓ SATISFIED | - |
| CORE-02: Build, demolish, and policy orders issued while paused are consumed on the next fixed step | ✓ SATISFIED | - |
| CORE-03: Per-tile state exposes the 15-field surface, read-only outside src/sim/ | ✓ SATISFIED | - |

**Coverage:** 3/3 requirements satisfied

## Decision Coverage

CONTEXT.md (01-CONTEXT.md) `<decisions>` block is authored in a prose/custom format not recognized as trackable by `check.decision-coverage-verify` (skipped, non-blocking). Manual mapping of the four decisions to shipped artifacts:

| Decision | Honored | Evidence |
|----------|---------|----------|
| Verify-as-built + gap-fill (audit existing behavior, add tests, fix only genuine gaps) | ✓ | All three plans audited as-built implementation; only genuine functional gap fixed (demolish, 01-02); test/doc gaps filled (01-01, 01-03). |
| Golden determinism depth: paused-command pipeline golden + keep existing determinism suite + document frame-rate-independence argument | ✓ | paused-commands-golden.json added; determinism suite unchanged-and-green; floor((T*S)/stepMs) documented in time.ts docstring + sim-level chunked test. |
| Per-tile state surface: audit against CORE-03 field list (all present), add missing if any; read-only outside src/sim | ✓ | Audit found all 15 present; `getTileState` copy accessor added preserving read-only contract. |
| Claude's discretion on approach | ✓ | Approach left to planner; executed per plans. |

**Decision coverage:** 4/4 honored (manual mapping; tool skipped as no trackable decisions)

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| - | - | - | - | None found in all changed files (grep for TBD/FIXME/XXX/TODO/HACK/placeholder/empty-returns returned nothing). |

**Anti-patterns:** 0 found (0 blockers, 0 warnings)

## Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|----------------|---------|
| tests/unit/time.test.ts | CORE-01 | 12 | 0 | No | Value/Behavioral (toBe exact tick counts, set-value equality) | PASS |
| tests/determinism/determinism.test.ts | CORE-01/02 | 8 | 0 | No | Behavioral (byte-identical getStateJson across runs/chunks/saves) | PASS |
| tests/unit/paused-queue.test.ts | CORE-02 | 6 | 0 | No | Behavioral/FIFO (defer→resume transitions, ordering, tick delta) | PASS |
| tests/unit/tile.test.ts | CORE-03 | 3 | 0 | No | Value (per-field defaults) | PASS |
| tests/runner-accessors.test.ts | CORE-03 | 15 | 0 | No | Value (all-15 toEqual) + Behavioral (mutation isolation) | PASS |
| tests/golden/golden.test.ts | CORE-03 | 2 | 0 | No | Value/Behavioral (strict toEqual vs recorded fixture) | PASS |

- **Disabled tests on requirements:** 0
- **Circular patterns:** 0 — the golden fixture is a recorded *state snapshot* (not an oracle derived from the system-under-test at assert time), written only under the intentional `GOLDEN_UPDATE=1` regen path, per the project's established golden mechanism. The determinism assertions compare independent runs, not self-referenced expected values.
- **Expected-value provenance:** VALID — exact tick counts derive from the floor((T*S)/stepMs) formula about the system under test; golden fixtures are byte-snapshots recorded then frozen.
- **Insufficient assertions:** 0 — all requirement-linked claims use value/behavioral strength.

## Behavioral Verification

| Check | Result | Detail |
|-------|--------|--------|
| Full suite `npm run test` | ✓ 271 passed (44 files), 0 failed | Includes determinism (8), goldens (2), paused-queue (6), tile/accessors — cold run at verification time |
| Targeted spot-checks | ✓ 46 passed (6 files) | time, paused-queue, tile, runner-accessors, determinism, golden |
| Typecheck `npm run typecheck` | ✓ clean (exit 0) | `tsc --noEmit` no errors |
| E2E pause/resume | ✓ (existing Playwright) | acceptance.spec.ts:16-26, sessions.spec.ts:30-46 — not part of `npm run test`; unchanged by this phase |

## Human Verification

N/A — Infrastructure/foundation phase (time & deterministic core) with no user-facing elements to test manually beyond what automated tests cover. All acceptance criteria are verifiable programmatically. Note: the HUD speed-button click itself is not separately E2E'd, but the underlying per-preset speed behavior is exercised by unit tests for all presets and the wiring is static; pause interaction is E2E-covered.

## Gaps Summary

**No gaps found.** Phase goal achieved. All 12 must-have truths verified with passing behavioral tests and static wiring evidence; full suite green (271 tests / 44 files); typecheck clean.

## Verification Metadata

**Verification approach:** Goal-backward (derived from phase goal)
**Must-haves source:** PLAN.md frontmatter (all three plans carry `must_haves.truths`; no separate artifacts/key_links/prohibitions blocks declared)
**Automated checks:** 12 passed, 0 failed (truths); artifacts 12/12; wiring 6/6; full suite 271/271
**Human checks required:** 0
**Total verification time:** ~5 min

---
*Verified: 2026-08-03T08:56:04Z*
*Verifier: gsd-executor (inline)*
