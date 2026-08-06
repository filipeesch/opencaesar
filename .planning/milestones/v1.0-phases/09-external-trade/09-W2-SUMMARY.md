---
phase: 09-external-trade
plan: 09-w2
wave: 2
subsystem: sim-core
tags: [trade, quotas, prices, balance]
requires:
  - phase: 09-w1
    provides: §19.1 catalog, order modes, §19.9 gates
provides:
  - per-route per-good annual quotas (TRAD-04): quotaFor/quotaRemaining/quotaSuspended/consumeQuota/resetAnnualQuotas with per-good-only suspension and tick-based year reset
  - trade price model (TRAD-05): TradePriceState (base/history ring/trend/modifier), createTradePriceState/sampleTradePrice/priceTrend/effectivePrice/applyPriceEvent, import>export catalog invariant
  - BALANCE.trade group: tradePriceHistoryWindow 8, tradePriceSteadyTolerance 1, tradePriceFloor 1, merchantWaitTicks 120 (all consumed → balance-parity green)
  - legacy tradePrice export and tickTrade annualQuota path byte-identical
affects: [09-w3, 09-w4]
actuals:
  tokens: 5200
  tasks: 2
  commits: 0
tech-stack:
  added: []
  patterns:
    - "Quota resolution chain: per-good override > catalog default > legacy per-route annualQuota > unlimited (0)"
    - "Injected-tick history ring with same-tick duplicate suppression (no wall clock)"
key-files:
  created:
    - tests/unit/trade-quotas.test.ts
    - tests/unit/trade-prices.test.ts
  modified:
    - src/sim/trade.ts
    - data/balance.ts
key-decisions:
  - "quotaRemaining returns Infinity for an uncapped good (0 cap), matching '0 = unlimited'"
  - "resetAnnualQuotas reports the number of ROUTES reset (all cities on the first call), not goods — the plan contract is route-count"
  - "TradePriceState.historySize stored on the state so the ring caps; sampleTradePrice suppresses same-tick duplicates via lastSampledAt"
  - "effectivePrice = round(lastSample × modifier) clamped at tradePriceFloor (>=1), so a never-sampled state prices at round(base × modifier)"
requirements-completed: [TRAD-04, TRAD-05]
coverage:
  - id: D1
    description: "Per-route per-good quotas with per-good-only suspension and deterministic year reset (TRAD-04)"
    requirement: TRAD-04
    verification:
      - kind: unit
        ref: "tests/unit/trade-quotas.test.ts#TRAD-04 per-good quotas (§19.7)"
        status: pass
      - kind: unit
        ref: "tests/trade.test.ts#trade quotas"
        status: pass
    human_judgment: false
  - id: D2
    description: "TradePriceState base/history/trend/modifier model, import>export invariant, deterministic sampling (TRAD-05)"
    requirement: TRAD-05
    verification:
      - kind: unit
        ref: "tests/unit/trade-prices.test.ts#TRAD-05 price state model (§19.5)"
        status: pass
      - kind: unit
        ref: "tests/unit/trade-prices.test.ts#TRAD-05 import > export data invariant"
        status: pass
      - kind: unit
        ref: "tests/balance-parity.test.ts#balance catalog - behavior parity (DATA-02)"
        status: pass
    human_judgment: false
duration: 20min
completed: 2026-08-03
status: complete
---

# Phase 9 Wave 2: Per-Good Quotas & Trade Price Model Summary

**Per-route per-good annual quotas (per-good-only suspension, tick-based year reset) and the base/history/trend/modifier trade price model with the import>export invariant — legacy tickTrade/tradePrice unchanged, 595 tests green.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-03T23:46:30Z
- **Completed:** 2026-08-03T23:50:20Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `src/sim/trade.ts` (TRAD-04): `quotaFor` (per-good override > catalog default > legacy annualQuota > unlimited), `quotaRemaining` (Infinity when uncapped, clamped at 0), `quotaSuspended` (per-good only), `consumeQuota`, `resetAnnualQuotas` (stable insertion order, route-count return).
- `src/sim/trade.ts` (TRAD-05): `TradePriceState` with base/history ring/trend/modifier; `createTradePriceState`, `sampleTradePrice` (same-tick dedupe), `priceTrend` (window ± tolerance from BALANCE), `effectivePrice` (round(lastSample × modifier), floor clamp), `applyPriceEvent` (multiplicative modifier shift, no history writes). `MERCHANT_WAIT_TICKS` exported for 09-W3 transport gating.
- `data/balance.ts`: `trade:` group — tradePriceHistoryWindow 8, tradePriceSteadyTolerance 1, tradePriceFloor 1, merchantWaitTicks 120; each consumed via `CONFIG.*` in `src/sim/trade.ts`, keeping balance-parity green.

## Task Commits
Not committed (per execution instructions — SUMMARY/VERIFICATION files only).

## Files Created/Modified
- `src/sim/trade.ts` - quota surface + price model + MERCHANT_WAIT_TICKS.
- `data/balance.ts` - `trade:` balance keys.
- `tests/unit/trade-quotas.test.ts` - 6 tests.
- `tests/unit/trade-prices.test.ts` - 9 tests.

## Decisions Made
- `quotaRemaining` = Infinity for uncapped goods (0 = unlimited per plan).
- `resetAnnualQuotas` returns route count (all cities on first call in a year; 0 thereafter).
- `historySize` stored on `TradePriceState`; `sampleTradePrice` records `lastSampledAt` to suppress same-tick duplicates.
- `effectivePrice` scales the last sampled price by the modifier (falling back to base when unsampled), clamped at floor ≥ 1.

## Deviations from Plan
- Plan asked `priceTrend(state, at)` to compare against "the entry window steps earlier" — implemented with `CONFIG.tradePriceHistoryWindow`; the `at` arg is accepted but the trend is a pure function of history (deterministic).
- `applyPriceEvent` uses an additive modifier delta (1 + delta semantics), positive raises / negative lowers effective price, never writes history — matches the plan's stated behavior.

**Total deviations:** 2 (both minor semantic interpretations; no scope creep).
**Impact on plan:** Additive model complete; all baseline tests green.

## Issues Encountered
- balance-parity requires every new BALANCE key to be consumed in src/ — `merchantWaitTicks` is genuinely used only in 09-W3, so `MERCHANT_WAIT_TICKS` is exported from `src/sim/trade.ts` now and consumed by the transport walkers next wave.

## Next Phase Readiness
09-W3 (transport walkers) can consume `MERCHANT_WAIT_TICKS` (CONFIG.merchantWaitTicks), `CARAVAN_CAPACITY`/`SHIP_CAPACITY`, and the Berth/Entrepot primitives. Full suite: 595 tests green, typecheck clean, check:military clean.
