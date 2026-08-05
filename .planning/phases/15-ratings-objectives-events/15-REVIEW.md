---
phase: 15-ratings-objectives-events
reviewed: 2026-08-05T08:30:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - src/sim/ratings.ts
  - src/sim/objectives.ts
  - src/sim/events.ts
  - src/sim/runner.ts
  - src/sim/types.ts
  - src/sim/advisors.ts
  - data/events.ts
  - data/missions.ts
  - data/validate.ts
  - tests/ratings.test.ts
  - tests/objectives.test.ts
  - tests/events.test.ts
  - tests/missions.test.ts
  - tests/runner-accessors.test.ts
  - tests/data-catalog.test.ts
  - tests/determinism/event-response-determinism.test.ts
  - tests/determinism/export-window-determinism.test.ts
  - tests/unit/collapse.test.ts
  - tests/integration/civilization-overlay.test.ts
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: resolved
resolved:
  - CR-01
  - WR-01
  - WR-02
  - WR-03
  - WR-04
  - WR-05
  - WR-06
---

# Phase 15: Code Review Report

**Reviewed:** 2026-08-05T08:30:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** resolved (CR-01, WR-01..WR-06 fixed by the code-fixer; IN-01..IN-03 info items remain open)

## Summary

Reviewed the Phase 15 implementation (RATE-01/02/03) at `standard` depth: weighted decomposed ratings, the sustained ObjectiveTracker, the rolling annualExports window, and the event response surface with live derived-rating effects and a replayable `respondEvent` SaveCommand. All 66 phase tests plus full typecheck pass; no `Math.random()`/wall-clock was introduced in the sim chain (verified by source audit); `getState()` keeps its separate economy `computeRatings` path so golden fixtures and the military gate are untouched.

However, adversarial tracing found **one CRITICAL determinism breaker** in the `respondEvent` save/load replay path (verified empirically with a throwaway probe — diverging `getStateJson()` when the reconstructed tick-0 balance cannot cover the response treasury cost), plus several Warnings around the `annualExports` metric semantics, paused-command validation, and replay fidelity of the live event effects. The most defensible headline is that the phase's own core guarantee — "run → respond → save → load yields byte-identical getStateJson()" — does not hold in a realistic low-funds scenario.

**Verified against live code:** probe runs confirmed (a) `getStateJson()` divergence after save/load when the replay-time balance is below the response cost (loaded treasury 483.2 vs original 420.0), and (b) the `annualExports` window roughly doubles across the year (12 at tick 370 → 24 at tick 719) for a steady export rate, so it is not the "trailing-360-tick" window it claims.

## Critical Issues

### CR-01: respondEvent save/load replay is not byte-identical — treasury cost clamped to the reconstructed tick-0 balance

**Status: fixed** — respondEvent replay now defers the response's treasury cost + effect to its original application tick (`applyDueEventResponses`), so the cost is booked with the reconstructed balance at the same tick the original run paid it — no tick-0 clamp divergence. Verified byte-identical `getStateJson()` in a low-funds probe. Commit `22e5ed6`.

**File:** `src/sim/runner.ts:1049-1059` (validation skip at `:1032`), `src/sim/finance.ts:37-43`

**Issue:** `respondEvent` records the response and applies its `treasuryCost` through `Treasury.addExpense('other', cost)` on both live accept and replay. On replay, `fromSaveData` (runner.ts:2043-2058) applies **all** saved commands at tick 0 — including `respondEvent` — before ticking. `Treasury.addExpense` **clamps** payment to the current balance (`paid = Math.min(amount, this.balance)`) and books only `paid` into the `expenses` ledger. In the original run the response cost was fully paid mid-run when the balance (after accrued income) could cover it; in the reconstruction the cost is paid at tick 0 when the balance is the post-command, pre-income starting balance, and the `!this.replaying` guard at `:1032` also skips the `not-enough-money` check. When the reconstruction's tick-0 balance is below the response cost, the replay pays less than the original, the ledger and balance diverge, and `getStateJson()` is **not** byte-identical to the original run. This breaks the phase's own RATE-03 acceptance criterion and the "ledger-commutative early replay" assumption in 15-PLAN (the expense is not commutative once clamping applies).

**Verified:** a probe that drained the treasury at tick 0 (placement costs < response cost at the reconstruction point) then responded to an active event produced `loaded treasury 483.2` vs `original treasury 420.0` → `getStateJson()` differs; the existing determinism test passes only because it funds the run with `takeLoan(1500)`.

**Fix:** make the response expense truly ledger-commutative on replay. Simplest: apply the response treasury cost with a non-clamping ledger write that books the full cost regardless of the (reconstruction-only) balance, since the live path already guarantees funds at acceptance time — e.g. add `Treasury.forceExpense(cat, amount)` that does `balance -= amount; expenses[cat] += amount` without the `min(amount, balance)` clamp, and use it in `respondEvent` when `this.replaying`. Alternatively, defer the expense to the same tick the original paid it (storing it on the response record applied during ticking), which preserves exact balance semantics at all times.

## Warnings

### WR-01: annualExports is not a "trailing-360-tick" window — it spans 360→720 ticks across the year

**Status: fixed** — annualExports is now a per-tick ring buffer (360 slots, exports-only), so the window always covers exactly the last 360 ticks; the value no longer doubles across the year (probe: year-2 samples oscillate 16/16/24/16 around a steady rate instead of monotonic 12→24). Commit `f2d40c5`.

**File:** `src/sim/runner.ts:489-494` (snapshot on year change), `:962-965` (`annualExportsTotal`)

**Issue:** The window is defined as `sumUsedPerGood() + annualExportBuckets[year - 1]` — the **current partial year plus the previous full year**. Right after a year boundary the window ≈ 360 ticks; mid/end of year it ≈ 720 ticks, i.e. it covers two calendar years of exports. For a steady export rate the reported value roughly doubles from the start to the end of a year (verified: 12 at tick 370 → 24 at tick 719). The plan/SUMMARY label this a "trailing-360-tick window", but it is a two-year slide, so any mission/objective `targetAnnualExports` threshold is ~2× easier to hit late in a year. Publishing a metric that drifts 2× within a year is a real balance/behavioral defect, not just a naming nit.

**Fix:** make the window a true trailing 360 ticks, e.g. keep per-tick (or per-month) export tallies in a ring buffer of the last 360 ticks and sum the ring each call (`annualExports` recomputed from tickCount + accumulated ring), instead of "current partial + prior full year". If the two-year slide is intended, rename the field/document the semantics and re-derive the objective thresholds accordingly.

### WR-02: annualExports counts imported loads — the metric is "trade volume", not exports

**Status: fixed** — the ring is incremented only on the physical EXPORT path (`dispatchTradeGood` export branch); imports no longer feed `annualExports`. Probe: an import-only clay order yields `annualExports === 0` after 600 ticks. Commit `f2d40c5`.

**File:** `src/sim/runner.ts:945-956` (`sumUsedPerGood`), `src/sim/runner.ts:745` and `:777` (`consumeQuota` on both export and import paths), `src/sim/trade.ts:167-171`

**Issue:** `usedPerGood[good]` is a **direction-agnostic** quota counter: `consumeQuota` is invoked for both `export_*` (runner.ts:745) and `import_upto_target` (runner.ts:777). Summing `Object.values(route.usedPerGood)` therefore adds import loads into the value exposed as `getDerived().annualExports` and fed to `taxAnnualExports` targets. A city that imports can hit its "exports" objective on imports alone. The probe's wheat import order did not trigger a transaction in the test map, so the tests never surface this, but the code path is unambiguous.

**Fix:** track export and import tallies separately (e.g. `usedExportsPerGood`/`usedImportsPerGood` on the route, or add an `isExport` column to the tally), and sum only the export ledger for `annualExports`.

### WR-03: paused-queue respondEvent bypasses active-event and funds validation

**Status: fixed** — the paused path now runs the same validation (active event matching the id, funds for `treasuryCost`) at enqueue time and rejects with no state change / no queue entry when it fails; drained commands were already validated at enqueue. Commit `22e5ed6`.

**File:** `src/sim/runner.ts:1022-1024` (enqueue on pause), `:1032` (`if (!this.replaying)` guard), `:268-275` (`drainPendingCommands` sets `replaying = true` while draining)

**Issue:** When the sim is paused, `respondEvent` enqueues a `PendingCommand` without any validation (no active-event check, no `not-enough-money` check). The queue is drained at the top of the next `tick()` with `this.replaying = true`, which makes `drainPendingCommands` **skip** the entire `if (!this.replaying)` validation block — so a queued response for an already-concluded/different event, or one whose cost exceeds the balance at drain time, is silently accepted and its treasury cost applied (clamped by the ledger). This contradicts the phase's stated guarantee that "unknown/inactive event or unknown choice is rejected with no state change".

**Fix:** guard the paused path — either validate at enqueue time (event active + funds), or drop the `!this.replaying` sweep for the active-event/funds checks in `respondEvent` and instead gate truly-replayed commands on an explicit `isSaveLoadReplay` flag rather than reusing the paused-drain `replaying` flag.

### WR-04: conclude/severity responses apply eagerly at replay — live derived-rating effect window differs between original and replayed runs

**Status: fixed** — the `respondEvent` SaveCommand now records the response's application tick (`tick`), and save-load replay defers the effect (severity scaling / conclude / deltas) until that tick via `applyDueEventResponses`, so the live derived ratings reproduce the original run's effect window exactly (verified tick-by-tick across the event window in a probe). Commit `22e5ed6`.

**File:** `src/sim/runner.ts:329-331` (replay: `conclude` applied at the fire tick), `:1053-1055` (live: `conclude` applied mid-event), `:1049` (`eventResponseByEvent` recorded at tick 0 during replay)

**Issue:** On replay the response is recorded at tick 0; when the event later fires, the `conclude`/severity shaping is applied **immediately at the fire tick**, so the event is active for ~1 tick on the replay side, whereas on the original run it was active from its fire tick until the response tick (possibly many ticks), with the response-scaled delta only applied from the respond tick onward. `getStateJson()` stays identical (effects are derived-only), which is why the determinism test passes — but the **live derived ratings** the phase advertises (culture/prosperity/stability/favor read from `getDerived()`, and the advisor decomposition) differ between a run continued from the original and the same run continued after save→load. For a determinism-critical project this is a fidelity gap in the flagship RATE-03 feature.

**Fix:** record the response against the specific event *occurrence* (fire tick) rather than the bare event id, and store the response's application tick so replay shapes the effect window identically to the live run.

### WR-05: eventResponseByEvent is never cleared — a choice for one occurrence silently re-applies to later occurrences of the same event type

**Status: fixed** — the recorded response is deleted when its occurrence concludes, so a later occurrence of the same event type starts fresh (verified: second occurrence runs its full duration instead of auto-concluding ~1-2 ticks after firing). Commit `e59050f`.

**File:** `src/sim/runner.ts:1049` (write, never reset), `:329-331` / `:996-1000` (reused on every fire of that event id)

**Issue:** `eventResponseByEvent` is a `readonly` per-event-id map initialized at construction and only ever written on `respondEvent`. If the same event type fires again in the same run (e.g. a second `drought` months later), the recorded choice — including `conclude: true` or a severity scale — is silently applied to the new occurrence without the player ever choosing, and a `conclude` response auto-ends the repeat occurrence. The design intends replay determinism, but live *repeat* occurrences inherit stale choices too, which is surprising and removes the player's agency for that event.

**Fix:** scope the recorded response to a single occurrence — attach it to the active event instance (e.g. a counter/occurrence id) and clear `eventResponseByEvent[id]` on event conclusion, while preserving replay determinism by recording the response in the save command timeline instead of an unbounded per-id map.

### WR-06: unknown/def-less mission now auto-completes instead of failing

**Status: fixed** — `tickMissionSystem` marks a mission with no catalog entry as `failed` before building the ObjectiveTracker, restoring the legacy fail-on-unknown semantics. Commit `eb22028`.

**File:** `src/sim/runner.ts:1344-1376`

**Issue:** In the old path, `tickMission` marked a mission with no catalog entry as `failed = true` (missions.ts:42-46). The new `tickMissionSystem` builds an `ObjectiveTracker` from `def?.targetX` where an unknown id yields **all undefined targets**; the tracker's ok-chain is vacuously true, so the mission completes after `sustainChecks` (default 3) monthly checks — a silent behavior flip from "unknown mission fails" to "unknown mission wins". Only reachable through direct API misuse, but it masks config errors.

**Fix:** when `def` is undefined, mark the mission failed (preserve legacy semantics) rather than constructing an all-undefined tracker.

## Info

### IN-01: saveCommands grow on every replay (respondEvent + new trade commands inherit a pre-existing double-push pattern)

**File:** `src/sim/runner.ts:1059`, `:837`, `:862`; `:2043-2058`

**Issue:** `fromSaveData` replays commands via `applyCommand`, and the command methods push the same command into the fresh runner's `saveCommands` again — so a load doubles the command list (including the new `respondEvent`/`openTradeRoute`/`setTradeOrder`). One save→load cycle still yields identical `getStateJson()` (the list is not serialized there), but a second save→load cycle replays the duplicated `respondEvent` and charges its treasury cost **twice**, diverging state. This is a pre-existing systemic pattern (place/demolish/setPolicy already double-push), so it is not a Phase-15 regression, but the new commands inherit it and enlarge the blast radius.

**Fix:** suppress `saveCommands.push` when `this.replaying` (or rebuild the command list from the save on load instead of re-pushing).

### IN-02: "decomposition and rating are ONE computation" holds only for culture/prosperity/stability

**File:** `src/sim/ratings.ts:285-346`

**Issue:** `decomposeRatings` reports weighted Favor buckets (requests/gifts/objectives/tribute/salary/performance/debt/taxes/worship) that do not sum to the `computeTargets` favor rating, which keeps the legacy additive formula (`10 + max(0, 20 - floor(taxRate*100))`, `:291-292`). The comment documents this, but the advisor's flattened `ratings-decomposition` dataset will show favor buckets that bear no relationship to the favor number the player sees. Either compute favor's buckets from the same formula or surface the discrepancy.

### IN-03: module-local rating weights are magic constants rather than balance data

**File:** `src/sim/ratings.ts:89-94`

**Issue:** Weights are hardcoded consts in `ratings.ts` to dodge the balance-parity `CONFIG.<key>` gate. This is a deliberate, documented decision (15-SUMMARY key-decisions) and is acceptable, but it means the rating balance tuning lives outside `data/balance.ts` and is not covered by the parity validator; a future refactor to `data/balance.ts` must remember to add the CONFIG consumers.

---

_Reviewed: 2026-08-05T08:30:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
