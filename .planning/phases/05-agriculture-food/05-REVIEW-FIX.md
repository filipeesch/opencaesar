---
phase: 05-agriculture-food
status: all_fixed
findings_in_scope: 5
fixed: 5
skipped: 0
iteration: 1
reviewed: 2026-08-03T15:30:00Z
fixed_at: 2026-08-03T16:31:00Z
info_fixed: 5
info_evaluated: 1
tests_after: 424
goldens_regenerated: false
---

# Phase 5: Code Review Fix Report

**Scope:** critical (1) + warnings (4) — all fixed. INFO items fixed where cheap and clearly correct (5), one evaluated without a mechanic change (IN-05).

## Summary

All **1 critical** and **4 warning** findings from `05-REVIEW.md` are fixed, each proven by new unit/integration tests and committed atomically. Every gate passes: `npm run typecheck` (0 errors), `npm run lint` (0 warnings), `npm run check:military` (clean), and the full test suite is **424 tests green** (baseline 411 + 13 new). Golden snapshots are **unchanged** — no golden regeneration was needed (the repairs are additive state-machine/data-surface corrections that reproduce the same runner state; the two advisor fixes and the buyer/seller walkers do not alter any golden-trajectory runner state).

## Finding → Fix → Verification

| Finding | Status | Fix (commit) | Verification (test) |
|---|---|---|---|
| **CR-01** Fishing boat zeroes `catch` on a blocked wharf (silent product loss) | ✅ fixed | `boatStep` now only transfers the catch to the wharf when `wharfFree`; it hand-feeds a `wharfStock` target and clears `catch`/reaches `idle` only after a real handoff. A blocked wharf keeps the boat unloading with its catch fully intact (`d4ea335`) | `tests/unit/agriculture.test.ts` — "blocked wharf keeps the catch and stays unloading; handoff happens only when free (CR-01)" and "never drops catch without a handoff even when the wharf stock is nearly full (CR-01)" |
| **WR-01** Granary transfer/receive exceed shared 3,200 capacity; `receive` silently clamps away units | ✅ fixed | `granaryTransfer` now gates on `usedCapacity() + amount ≤ capacity` (and honors per-food `max`); `receive` returns the applied amount and refuses (applies 0) anything that would push total occupancy past capacity — no silent loss (`1b7c644`) | `tests/unit/logistics.test.ts` — "rejects a transfer that would push TOTAL occupancy past 3,200", "receive() never silently loses units when the granary is at total capacity (WR-01)" |
| **WR-02** Buyer/seller walkers never wired into `walkers.ts` (plan scope gap) | ✅ fixed | Added `buyer`/`seller` walker types and behaviors in `updateWalker`: buyers pick a food via `nextFoodToFetch`, reserve units at the granary (no double-pick), travel, return, and deposit at the market (restoring the reservation if a trip fails); wandering sellers compose a multi-food load via `sellerLoadComposition` at the market, deliver units to adjacent hungry houses, and record per-house market coverage (`recordMarketVisit`). `marketAgents` gates buyer/seller dispatch by worker efficiency; `pickGranary` selects the source. House instances gain live `foodInventory` + `marketCoverage`. (`cd13419`) | `tests/integration/food-slice.test.ts` — "buyer fetches from the granary: granary falls at reservation, market stock rises on deposit", "a buyer that never completes restores its reservation to the granary (no loss)", "seller composes a multi-food load, delivers to a house and records lastMarketVisit" |
| **WR-03** `foodAdvisorFromState` fabricates production/imports/exports = 0 and assigns all consumption to wheat (false bottlenecks) | ✅ fixed | Advisor derives per-food production from live staffed farm/orchard output specs, imports/exports from a caller-supplied live `flows` ledger, and splits consumption across foods houses actually received from sellers; `foodBottlenecks` now emits a deficit only when true supply (production + imports − exports) < true consumption, and never blames a food nobody consumes (`6003040`) | `tests/unit/advisors.test.ts` — "WR-03: per-food advisor table reflects real simulated flows — no hardcoded zeros" (vegetable-production scenario) and "WR-03: default (no flows) derives production from live staffed farms, not zero" |
| **WR-04** `foodOverlayGrids` paints constant 10/1 values from the `foodCooldown` proxy | ✅ fixed | Supply-days and variety grids now derive from each house's real `foodInventory` through `houseFoodDays`/`foodVariety` (per-house population consumed daily); the `foodCooldown` proxy is used only when no inventory is tracked (`3f5f0ec`) | `tests/unit/advisors.test.ts` — "WR-04: supply/variety overlays derive from real house food levels, not constants" |
| IN-01 dead `farmStopReason` vocabulary | ✅ fixed — wired `no-labor-access`/`harvest-ready`/`awaiting-carrier`/`fire-risk`/`collapse-risk` to real (optional, default-ok) conditions (`b7dc9a0`) | `tests/unit/agriculture.test.ts` — full vocabulary incl. the previously dead reasons |
| IN-02 `importDestinationPriority` labels refuse/empty as `accepts` | ✅ fixed — new `refuses` reason + priority 99 (`4c9a65f`) | `tests/trade.test.ts` — refuses/empty → `{ reason: 'refuses', priority: 99 }` |
| IN-03 `dangerousExport` offers `sell-anyway` on safe sales | ✅ fixed — safe sales return `options: []` (no approval gate) (`28085b3`) | `tests/trade.test.ts` — `safe.options` is `[]`; risky still lists cancel/sell-anyway/reduce/raise-reserve |
| IN-04 `nextFoodToFetch` zero-demand pick | ✅ fixed — foods with no demand and nothing held/in-transit are never picked; basic-food fetch requires real demand (`283d3ef`) | `tests/unit/logistics.test.ts` — "never fetches a food nobody consumes when nothing is held or in transit (IN-04)" |
| IN-05 30/100 boat capacity | ✅ evaluated (no mechanic change) — `BOAT_CAPACITY` is already the spec's 100; the 30-unit-per-voyage fill is a deliberate rate (a 100-unit boat that fills over a 30-day cycle), so it does **not** contradict §10.4. Pinned the invariant with a hardening test (`8a56a99`) | `tests/unit/agriculture.test.ts` — "catch growth is bounded by BOTH the remaining cycle ticks and the 100-unit capacity (IN-05)" |
| IN-06 unbounded granary reservation map | ✅ fixed — `expireReservations`/`fulfill` prune the ledger so it stays bounded (`3ba7ee3`) | `tests/unit/logistics.test.ts` — "prunes expired/fulfilled reservations so the reservation map does not grow (IN-06)" |

## Acceptance Criteria

- [x] CRITICAL (1) fixed with tests, no product ever dropped without a handoff
- [x] WARNINGS (4) fixed with tests (blocked-transfer rejection, buyer/seller walker integration, live advisor flows, non-constant overlays)
- [x] Determinsim preserved: seeded RNG only; final identical-seed tests reproduce identical state
- [x] `npm run typecheck` — pass (0 errors)
- [x] `npm run lint` — pass (0 warnings)
- [x] `npm run check:military` — pass (clean)
- [x] `npm run test` — **424 passed** (baseline 411 + 13 new)
- [x] Golden snapshots **unchanged** (no `GOLDEN_UPDATE=1` regeneration required; runner state identical)
- [x] Each fix committed atomically as `fix(05): …`; `05-REVIEW.md` not committed

## Commit Hashes

- `d4ea335` fix(05): fishing boat only hands catch to a free wharf — never drops product (CR-01)
- `1b7c644` fix(05): granary shared-capacity gate before transfers; receive never clamps away units (WR-01)
- `cd13419` fix(05): wire buyer/seller walkers (granary reserve+return, multi-food house delivery + market coverage) (WR-02)
- `6003040` fix(05): advisor per-food table derives real production/imports/exports/consumption; bottlenecks need true supply < consumption (WR-03)
- `3f5f0ec` fix(05): food overlay grids derive supply-days/variety from real house food inventory (WR-04)
- `4c9a65f` fix(05): import destination labels refuse/empty as 'refuses', not 'accepts' (IN-02)
- `28085b3` fix(05): safe exports offer no sell-anyway approval gate (IN-03)
- `283d3ef` fix(05): nextFoodToFetch never picks a zero-demand food (IN-04)
- `8a56a99` fix(05): pin fishing catch bound by remaining-cycle ticks and 100-unit capacity (IN-05 hardening)
- `3ba7ee3` fix(05): prune expired/fulfilled reservations so the granary ledger stays bounded (IN-06)
- `b7dc9a0` fix(05): make the full farmStopReason vocabulary reachable from real conditions (IN-01)

---
*Fixed: 2026-08-03 by the agent (gsd-code-fixer)*
