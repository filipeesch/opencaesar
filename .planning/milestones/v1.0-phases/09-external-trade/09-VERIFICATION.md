---
phase: 09-external-trade
status: passed
method: automated
completed: "2026-08-04"
---

# Phase 9 Verification Report: External Trade

## Success Criteria → Must-Haves

Extracted from `.planning/phases/09-external-trade/09-VALIDATION.md`:

| # | Must-have | How verified | Result |
|---|-----------|--------------|--------|
| 1 | Opening a route and setting per-good orders affects actual goods movement (SC1) | `tests/integration/trade-runner.test.ts`: openTradeRoute debits 500 & defaults no_trade; export_above_reserve drains warehouse to reserve while no_trade goods never move; import_upto_target fills toward target and stops (treasury falls by imported value) | ✅ passed |
| 2 | Caravans/ships transport loads physically with capacity and berth/road rules (SC2) | `tests/unit/trade-walkers.test.ts` + `tests/integration/trade-transport.test.ts`: capacity 8/16 never exceeded, road reachability, berth queue, entrepot staging, no teleport/no loss | ✅ passed |
| 3 | Quotas cap and reset annually; import/export prices differ, track history, gate transactions (SC3) | `tests/unit/trade-quotas.test.ts` (per-good suspension + year reset via Math.floor(tick/360)), `tests/unit/trade-prices.test.ts` (import > export, history/trend), `trade-runner.test.ts` year-rollover quota reset resumes exports | ✅ passed |
| 4 | Trade advisor data is live-derived (never fabricated) | `tests/unit/trade-advisor.test.ts`: pure projection exact values + live `getTradeAdvisor()` reconciles against real runner state; suspended flag only for capped good | ✅ passed |
| 5 | Determinism preserved: no RNG/clock, chunked identity incl. year rollover | `tests/determinism/trade-determinism.test.ts`: chunks 1/7/50 byte-identical across year boundary for seeds {1,7,1337}; source audit (trade/transport/walkers: no Math.random/Date.now/new Date) | ✅ passed |
| 6 | Goldens stay byte-identical; baseline green | `tests/golden/golden.test.ts` + `tests/integration/food-slice.test.ts` green without regeneration; full suite 622 tests / 86 files | ✅ passed |
| 7 | No military tokens | `npm run check:military` — clean | ✅ passed |
| 8 | Typecheck clean | `npm run typecheck` — clean | ✅ passed |

## Status

**PASSED** — all must-haves verified with automated evidence.

- Tests: 622 passed / 86 files (baseline 564 / 77 → +58 / +9)
- Typecheck: clean; Lint: clean; `check:military`: clean
- Goldens: unchanged, no regeneration required (`SimState` frozen)

## Notes

- The `tradeAdvisorFromState`/`getTradeAdvisor` accessors are additive; the
  runner's only `Date.now` is the pre-existing save-serialization `savedAt`
  timestamp in `getSaveData()`, which is not part of `getStateJson()` — the
  determinism source audit is scoped to the trade simulation files matching the
  market-chain precedent.
- No gaps found. Trade config serialization in save/load deferred to Phase 19.
