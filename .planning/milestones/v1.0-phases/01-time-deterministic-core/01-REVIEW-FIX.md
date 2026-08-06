---
phase: 01-time-deterministic-core
status: all_fixed
findings_in_scope: 4
fixed: 4
skipped: 0
info_total: 4
info_fixed: 3
info_deferred: 1
iteration: 1
ref: 01-REVIEW.md
fixed_at: 2026-08-03T10:18:00Z
---

# Phase 01: Code Review Fix Report

**Reviewed:** 2026-08-03T10:05:00Z
**Fixed:** 2026-08-03T10:18:00Z
**Ref:** 01-REVIEW.md (status: issues_found)

## Summary

All 4 WARNING-level findings were fixed. 3 of 4 INFO findings were fixed; 1 (IN-02)
was deferred with justification (see below). All fixes are atomic commits; the
REVIEW.md itself was **not** committed.

Verification: `npm run test` → **273 passed** (was 271; +4 new, −2 removed as
duplicates), `npm run typecheck` → clean, `npm run lint` → clean.

## Fixes

| Finding | Fix | Verification |
| --- | --- | --- |
| WR-01 `getTileState().road` never populated | `getTileState` now derives grid-derived fields from the authoritative terrain grid: `{ ...tileState(x,y), road: this.map.get(x,y) === 'road' }`. Road placement sets terrain to `'road'` and demolish resets it to `'earth'`, so `.road` now reflects actual road presence. Other side-channel fields remain neutral (documented as not-yet-wired). | New unit test `getTileState reflects road placement on the terrain grid (WR-01)` in `tests/runner-accessors.test.ts`: `false` → place road → `true` → demolish → `false`. Passes. |
| WR-02 frame-rate-independence claim false at 8x | `TimeSystem` default is now unbounded catch-up (`maxCatchupSteps = Infinity`), so exact slicing invariance holds by default (floor((T*S)/stepMs) for any partition). A finite `maxCatchupSteps` throttles a single `advance` but **carries the overflow forward as backlog instead of zeroing `acc`** — simulated time is never dropped; the cap is now an explicit opt-in trade-off, and the docstring contract is rewritten to be honest. | Confirmed old logic yields 5 ticks for a single 5000ms frame at 8x vs the true 160; new logic yields 160 for every partition (scratch reproduction). Existing `caps catch-up after a hitch` test still passes. |
| WR-03 chunked-stepping test is a tautology | Replaced with a TimeSystem-driven determinism test that feeds the same 5000ms window in 5 different frame partitions (single-frame, 5/50/100/16ms-ish) at speed 8 and asserts every partition reaches exactly 160 ticks with byte-identical `getStateJson()`. Added a separate, correctly-named `tick batching is order-independent` idempotency test. | `frame-rate independence: identical tick count and state across slicings at 8x` passes; would have failed against the old zeroing `advance` (verified: old gives 5 vs 160). |
| WR-04 save-while-paused drops queued commands | `SaveData` gained optional `pendingCommands: SaveCommand[]` and `paused?: boolean`. `getSaveData` serializes the paused queue (via the newly-unified `PendingCommand = SaveCommand` shape); `fromSaveData` replays applied commands, ticks to the saved count, then **re-enqueues the pending queue** and restores the paused state, so a reload drains the same queue on the next resume tick exactly as the original run. | New unit test `saving while paused persists queued commands and re-enqueues them on load (WR-04)` in `tests/unit/paused-queue.test.ts`: 3 queued commands survive `save → load` (count + paused flag + tick), nothing applies at load, and unpause+tick produces byte-identical state. Passes. |
| IN-01 catch-all `else` dispatch for command kinds | Unified `PendingCommand` with `SaveCommand` and routed both drain and save-replay through a single exhaustive `applyCommand(runner, cmd)` helper with an explicit `else … const exhaustive: never = cmd` branch — adding a 4th kind now fails typecheck instead of silently routing to `demolish`. | Typecheck clean; paused FIFO and save/load suites still green. |
| IN-03 duplicated paused-queue tests | Removed the `paused command queue (CORE-02)` describe block from `tests/runner-accessors.test.ts`; the dedicated suite `tests/unit/paused-queue.test.ts` covers defer/apply. | Full suite green (−2 dup, +4 new = 273). |
| IN-04 `setSpeed` accepts unvalidated values | `setSpeed` now throws `RangeError` for `speed <= 0` or non-finite values (a negative speed would corrupt the accumulator silently). Runtime callers only pass preset values ([0.5,1,2,4,8]). | New test `rejects non-positive or non-finite speeds (IN-04)` passes; existing preset-acceptance test still green. |
| IN-02 `demolish` returns `true` while paused even when tile has no building | **Deferred** — behavior is intentional and consistent with the pre-existing `placeBuilding`/`setPolicy` paused path ("queued", not "applied"), the `demolish` docstring already documents the paused queueing, and a `boolean` semantic change could ripple into UI callers. A future pass may return a distinct "queued" signal if the UI needs it. | N/A |

## Commits

| Commit | Message | Scope |
| --- | --- | --- |
| `79ed80e` | `fix(01): derive road flag in getTileState from terrain grid (WR-01)` | WR-01 |
| `d82403d` | `fix(01): make TimeSystem frame-rate independent by default, carry backlog instead of dropping (WR-02)` | WR-02 |
| `95f4191` | `fix(01): strengthen determinism test to assert state invariance across real time slicings at 8x (WR-03)` | WR-03 |
| `3301b66` | `fix(01): persist pending commands and paused state in saves, re-enqueue on load (WR-04)` | WR-04 (+IN-01 unification) |
| `ed8e1e4` | `fix(01): harden setSpeed and drop duplicate paused-queue tests (IN-04, IN-03)` | IN-03, IN-04 |

Note: the phase-1 implementation was uncommitted in the working tree when this fix
pass began; it is now captured within the fix commits above. `tests/unit/tile.test.ts`,
`tests/golden/golden.test.ts`, and `tests/golden/fixtures/paused-commands-golden.json`
are unrelated to these findings and remain untouched in the working tree.

## Result

- **4 / 4 WARNING findings fixed**
- **0 findings skipped**
- 3 / 4 INFO findings fixed; 1 deferred (IN-02, justified above)
- Final: `npm run test` = **273 passed (44 files)**, `npm run typecheck` = clean, `npm run lint` = clean
