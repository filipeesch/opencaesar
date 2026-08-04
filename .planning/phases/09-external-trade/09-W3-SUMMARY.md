---
phase: 09-external-trade
plan: 09-w3
wave: 3
subsystem: sim-core
tags: [trade, walkers, transport, caravan, ship]
requires:
  - phase: 09-w2
    provides: MERCHANT_WAIT_TICKS / CONFIG.merchantWaitTicks, quota/price model
  - phase: 09-w1
    provides: order modes, catalog
provides:
  - 'caravan' | 'ship' WalkerType union members (additive, no exhaustive switch)
  - caravan/ship destination profiles (returnPolicy false, roadblock pass)
  - WalkerInstance.trade payload + decideTrade/handleArrival/releaseWalkerLoad branches: load/unload with capacity, no-loss restore, no-road §19.3 wait-then-leave
  - physical transport proof (SC2): road-graph carry with capacity, berth queue + entrepot cap, expiry restoration
affects: [09-w4]
actuals:
  tokens: 7600
  tasks: 2
  commits: 0
tech-stack:
  added: []
  patterns:
    - "Trade transports are destination walkers (profile category 'destination') but are NOT in data/walkers.ts (dispatch-only, never building-spawned) so the catalog-count contract stays intact"
    - "Loaded-export-with-null-dest despawns on next decide (goods leave the region); exports with an explicit dest deposit there (tests)"
key-files:
  created:
    - tests/unit/trade-walkers.test.ts
    - tests/integration/trade-transport.test.ts
  modified:
    - src/sim/types.ts
    - src/sim/walkerProfiles.ts
    - src/sim/walkers.ts
    - src/game/scenes/MainScene.ts
key-decisions:
  - "Caravan/ship walkers are added to CATEGORY_BY_ID only (NOT data/walkers.ts) — allWalkerProfiles() count contract (walker-profile-contract.test.ts) stays locked"
  - "Runner exports will spawn empty, physically collect at the source storage, then leave (dest building null); imports spawn already carrying and deposit at the dest storage"
  - "MainScene walker renderer guards WALKER_COLORS with a fallback color for caravan/ship (additive, no palette change)"
requirements-completed: [TRAD-03]
coverage:
  - id: D1
    description: "caravan/ship WalkerType members + destination profiles + walker load/unload with capacity and no-loss (TRAD-03)"
    requirement: TRAD-03
    verification:
      - kind: unit
        ref: "tests/unit/trade-walkers.test.ts#TRAD-03 caravan walker (capacity 8)"
        status: pass
      - kind: unit
        ref: "tests/unit/trade-walkers.test.ts#TRAD-03 ship walker (capacity 16)"
        status: pass
      - kind: unit
        ref: "tests/unit/trade-walkers.test.ts#legacy buyer/seller regression"
        status: pass
    human_judgment: false
  - id: D2
    description: "physical transport proof: road-graph carry with capacity/no-duplication, no-road wait-then-leave, berth queue + entrepot cap, expiry restore (SC2)"
    requirement: TRAD-03
    verification:
      - kind: integration
        ref: "tests/integration/trade-transport.test.ts#TRAD-03 Scenario A"
        status: pass
      - kind: integration
        ref: "tests/integration/trade-transport.test.ts#TRAD-03 Scenario B"
        status: pass
      - kind: integration
        ref: "tests/integration/trade-transport.test.ts#TRAD-03 Scenario C"
        status: pass
      - kind: integration
        ref: "tests/integration/trade-transport.test.ts#TRAD-03 Scenario D"
        status: pass
    human_judgment: false
duration: 20min
completed: 2026-08-03
status: complete
---

# Phase 9 Wave 3: Trade Transport Walkers — Caravans & Merchant Ships Summary

**caravan/ship walker types with capacity-bounded physical load/unload (8/16), no-loss restore on failure, §19.3 no-road wait-then-leave, and berth-queue/entrepot rules — proven against runner state; 605 tests green, goldens untouched.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-03T23:51:00Z
- **Completed:** 2026-08-03T23:59:45Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- `src/sim/types.ts`: `WalkerType` union gains `'caravan' | 'ship'` (additive — no exhaustive switch exists).
- `src/sim/walkerProfiles.ts`: both mapped to `destination` category (road-follow, roadblock pass, `returnPolicy false`), **not** added to `data/walkers.ts` so the catalog-count contract stays locked.
- `src/sim/walkers.ts`: `TradeCarrierPayload` on `WalkerInstance`; `decideTrade` (empty exports seek source; loaded transports seek dest / leave region), `waitThenLeave` (§19.3 window), `handleArrival` caravan/ship load (source deduction, capacity-bounded) and deposit (dest stock rise), `releaseWalkerLoad` restore-to-source on failed/expired exports. Legacy buyer/seller/market/labor branches byte-identical.
- `src/game/scenes/MainScene.ts`: `WALKER_COLORS` index guarded with a fallback color for the new types (additive).
- Tests: `tests/unit/trade-walkers.test.ts` (6) + `tests/integration/trade-transport.test.ts` (4, SC2 scenarios A–D).

## Task Commits
Not committed (per execution instructions — SUMMARY/VERIFICATION files only).

## Files Created/Modified
- `src/sim/types.ts` - WalkerType union append.
- `src/sim/walkerProfiles.ts` - caravan/ship destination profiles + returnPolicy false.
- `src/sim/walkers.ts` - trade transport payload and decide/arrive/release branches.
- `src/game/scenes/MainScene.ts` - walker color fallback for the new types.
- `tests/unit/trade-walkers.test.ts`, `tests/integration/trade-transport.test.ts`.

## Decisions Made
- Caravans/ships live in `CATEGORY_BY_ID` only (dispatch-only walkers, never building-spawned), preserving the `walker-profile-contract` catalog-count assertion.
- Runner export caravans spawn empty and physically collect from the source storage; imports spawn already carrying and deposit at the destination storage (the walker's own pickup/delivery mechanics are fully exercised by the unit + SC2 integration tests).
- MainScene blends new walker types to a neutral fallback color (no new tokens, no palette changes).

## Deviations from Plan
- The plan sketched "destination" returning `returnPolicy false` globally; to keep existing destination walkers (market/buyer) byte-identical, `returnPolicy` is overridden to false only for `caravan`/`ship`.
- `merchantWaitTicks` gating is consumed through `CONFIG.merchantWaitTicks` in `walkers.ts` (already satisfied balance-parity via `MERCHANT_WAIT_TICKS` in `src/sim/trade.ts`).

**Total deviations:** 2 (both additive/clarifying; no scope creep).
**Impact on plan:** Physical transport layer complete; all regression suites green.

## Issues Encountered
- Adding `caravan`/`ship` to `WalkerType` broke `MainScene.ts`'s `WALKER_COLORS[w.type]` index — fixed with a guarded fallback color (additive).
- A `data/trade.ts` comment containing the forbidden word was already reworded in W1; no new `check:military` hits.

## Next Phase Readiness
09-W4 can now dispatch caravan/ship walkers against real warehouse/granary stock, apply quotas/prices, and expose the live trade advisor. Full suite: 605 tests green, typecheck clean, check:military clean.
