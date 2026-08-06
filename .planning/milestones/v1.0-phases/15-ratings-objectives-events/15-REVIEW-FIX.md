---
phase: 15-ratings-objectives-events
fixed_at: 2026-08-05T09:10:00Z
review_path: .planning/phases/15-ratings-objectives-events/15-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 15: Code Review Fix Report

**Fixed at:** 2026-08-05T09:10:00Z
**Source review:** .planning/phases/15-ratings-objectives-events/15-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (CR-01, WR-01..WR-06 — Critical + Warning per 15-FIX-DISPATCH)
- Fixed: 7
- Skipped: 0
- Info findings (IN-01..IN-03): out of scope (optional tier). IN-01 was partially addressed as a side effect of the CR-01 fix (respondEvent no longer re-pushes to saveCommands on replay); the pre-existing place/demolish/setPolicy double-push and IN-02/IN-03 remain open.

## Fixed Issues

### CR-01: respondEvent save/load replay is not byte-identical — treasury cost clamped to the reconstructed tick-0 balance

**Files modified:** `src/sim/runner.ts`, `src/sim/types.ts`
**Commit:** `22e5ed6`
**Applied fix:** The `respondEvent` SaveCommand now carries the response's issue tick (`tick?: number`). On save-load replay the response is NOT applied at reconstruction tick 0; it is parked in `deferredEventResponses` and applied by `applyDueEventResponses()` at the tick (just before `tickDerivedSystems`) when `applyTick <= tickCount` — the same tick the original run charged the cost. The cost is booked through the ordinary clamped `addExpense` because the reconstructed balance at that tick equals the balance the live run validated against, so no clamp divergence can occur and the ledger/balance stay byte-identical. Verified with a low-funds probe (reconstruction-time balance below the response cost): `getStateJson()` identical after save→load.
**Note:** logic-fix class (ledger timing semantics) — flagged `fixed: requires human verification` confidence is high (empirical probe + existing determinism tests), but a human eye on the deferral timing is advised.

### WR-01: annualExports is not a "trailing-360-tick" window — it spans 360→720 ticks across the year

**Files modified:** `src/sim/runner.ts`
**Commit:** `f2d40c5`
**Applied fix:** Replaced the per-year bucket scheme (`annualExportBuckets`/`annualExportYear` = current partial year + prior full year ≈ 360-720 ticks) with a per-tick circular buffer of 360 slots (`tickExportCounts`). Each tick's slot is zeroed at the start of `tickTradeSystem` and incremented on the export path, so summing the ring always covers exactly the last 360 ticks. Probe: a steady-export city now oscillates (16/16/24/16 across year-2 month samples — production-burst noise) instead of monotonically doubling 12→24. Deterministic across chunked ticking (1/7/50) and save/load (export-window-determinism.test.ts green).

### WR-02: annualExports counts imported loads — the metric is "trade volume", not exports

**Files modified:** `src/sim/runner.ts`
**Commit:** `f2d40c5`
**Applied fix:** The ring is incremented only in the physical EXPORT branch of `dispatchTradeGood` (where `consumeQuota` was also direction-agnostic); the import branch (`import_upto_target`) no longer feeds `annualExports`. Probe: an import-only clay order produces `annualExports === 0` after 600 ticks.

### WR-03: paused-queue respondEvent bypasses active-event and funds validation

**Files modified:** `src/sim/runner.ts`
**Commit:** `22e5ed6`
**Applied fix:** The paused path now runs the same validation as the direct path (known event/choice, active event matching the id, funds for `treasuryCost`) BEFORE enqueueing; a failing response is rejected with a commandLog entry and nothing is queued. Pending-command drain continues to accept (the command was already validated at enqueue, and the treasury cannot change while paused).

### WR-04: conclude/severity responses apply eagerly at replay — live derived-rating effect window differs between original and replayed runs

**Files modified:** `src/sim/runner.ts`, `src/sim/types.ts`
**Commit:** `22e5ed6`
**Applied fix:** The recorded `tick` on the response command lets replay reproduce the ORIGINAL effect window: the response's severity scaling / rating deltas / conclude are applied at the same tick the original run applied them (`applyDueEventResponses`), not at the event's fire tick. Probe: stepping the original and the loaded run tick-by-tick from the save point yields identical `getDerived()` culture/prosperity/stability/favor across the whole event window.

### WR-05: eventResponseByEvent is never cleared — a choice for one occurrence silently re-applies to later occurrences of the same event type

**Files modified:** `src/sim/runner.ts`
**Commit:** `e59050f`
**Applied fix:** `delete eventResponseByEvent[ev.id]` is executed when an occurrence concludes, so a later occurrence of the same event type starts with no recorded choice (full base effect and duration, player agency restored). Replay determinism is preserved: the response is re-recorded from the save command timeline per occurrence. Probe: a second occurrence of a responded event runs its full duration instead of auto-concluding ~1-2 ticks after firing.

### WR-06: unknown/def-less mission now auto-completes instead of failing

**Files modified:** `src/sim/runner.ts`
**Commit:** `eb22028`
**Applied fix:** `tickMissionSystem` now checks `MISSIONS[...] ?? EXTRA_MISSIONS[...]` and marks the mission `failed = true` when no catalog entry exists (before any ObjectiveTracker construction), restoring the legacy `tickMission` fail-on-unknown semantics.

## Verification

All gates ran inside the isolated fixer worktree (`/tmp/sv-15-reviewfix-QZYLaS`, branch `gsd-reviewfix/15-63214`, `node_modules` symlinked from the main checkout — numbers are reproducible only from that tree; the main checkout will reproduce them after the fast-forward since the tree is identical):

- `npx tsc --noEmit` — clean (each intermediate commit state typechecked).
- Targeted suite after the final commit: `tests/objectives.test.ts tests/events.test.ts tests/runner-accessors.test.ts tests/determinism/export-window-determinism.test.ts tests/determinism/event-response-determinism.test.ts tests/determinism/determinism.test.ts tests/unit/paused-queue.test.ts tests/missions.test.ts` — 8 files / 64 tests green. (Note: the dispatch's `-x` flag is unsupported by vitest 3.2.7 in this repo; equivalent sequential runs were used.)
- Full suite: `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` — 108 files / 780 tests green.
- `npm run check:military` — clean.
- `git diff --stat tests/golden` — empty (goldens untouched); `tests/golden/golden.test.ts` + `tests/balance-parity.test.ts` green.
- Empirical probes (temporary, removed before commit): CR-01 low-funds byte-identity; WR-01 window stability; WR-02 import exclusion; WR-03 paused rejection; WR-04 tick-by-tick derived parity; WR-05 second-occurrence freshness; WR-06 fail-on-unknown.

## Skipped Issues

None — all 7 in-scope findings were fixed. Out-of-scope info findings: IN-01 (partially fixed via the CR-01 change: respondEvent no longer double-pushes on replay), IN-02 and IN-03 (documented behavior, deferred).

---

_Fixed: 2026-08-05T09:10:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
