---
phase: 08-markets-home-distribution
review: 08-REVIEW.md
status: resolved
findings_fixed: 1 (WR-01)
findings_accepted: 5 (IN-01..IN-05, info-only)
commit: 7e3ba1f
---

# Phase 8: Code Review Fix Report

## Summary

Reviewed `src/sim/walkers.ts` / `src/sim/logistics.ts` market-buyer config
handling against `08-REVIEW.md`. One warning-level finding (**WR-01**) is
fixed with a guard in `decideBuyer` plus a unit regression test. The five
info-level findings (**IN-01..IN-05**) are evaluated and **accepted as
documentation notes** — none of them has a clearly-safe, additive fix, and
per the review contract behavior that baseline tests depend on must not
change.

## Findings

### WR-01: Buyers can overshoot a configured market's restock target (fixed)

**Commit:** `7e3ba1f` (src/sim/walkers.ts + tests/unit/market-buyer-config.test.ts)

For an explicitly-configured market, `marketFoodState` sets
`expectedConsumption[f] = 0` when `stock + inTransit >= targetStock`. But
`nextFoodToFetch` still selects that food as the "most depleted" candidate:
with `current == 0` and `expectedConsumption == 0`, coverage computes to 0
(the minimum), and the in-transit units keep the food out of the IN-04
"no demand" skip path (`cons <= 0 && current <= 0 && inTransit <= 0`).
`decideBuyer` then dispatched a full `BUYER_FETCH_AMOUNT`, pushing the
market to `stock + inTransit + fetch` — overshooting the configured target.

**Fix:** in `decideBuyer`, after `nextFoodToFetch` returns the chosen food,
skip dispatch when a config is present and
`marketStock[food] + inTransit[food] >= cfg.targetStock`. The fetch would
otherwise add demand that the configured target already satisfies.

**Why skip (not clamp `take`):** clamping `take` to `target - stock - inTransit`
would change the carried amount in the existing "widening radius" baseline
test (which asserts `BUYER_FETCH` while the market is below target), so it
would violate the "do not change behavior baseline tests depend on" rule.
Skipping only the already-covered case leaves all baseline tests untouched.

**Regression test added:** market at 0 wheat with a live buyer carrying 40
wheat toward it, config `targetStock = 20` → the deciding buyer dispatches
nothing (`carryingGood` null, granary stock unchanged at 100).

## Accepted Info Findings (no code change)

- **IN-01** — per-market configs are host-owned, not serialized in
  `getSaveData`/`fromSaveData`. A fix changes the save format (not additive);
  accepted as an API-doc note.
- **IN-02** — the public `marketConfig` hook returns a default config in the
  real sim when no host config is stored. Surface inconsistency; wiring a
  host-owned config store is a larger integration item; accepted as a note.
- **IN-03** — `marketLoadComposition` has a head-duplicate food and a
  hardcoded `'plebeian'` resident class in its computed load shape. It is a
  test-facing utility; changing its shape would alter consumer expectations;
  accepted as a note.
- **IN-04** — presence of a config changes buyer behavior (covered-by-
  in-transit dispatch is exactly WR-01; the intended demand semantics are
  documented); accepted as intended behavior.
- **IN-05** — `hasMarketConfig` / `marketConfig` are surface API only;
  accepted as intended.

## Verification

- Typecheck: `npx tsc --noEmit` — clean (0 errors).
- Tests: `npx vitest run` — **77 files, 564 tests, all pass** (6 existing
  market-buyer-config tests + the new WR-01 regression; full suite green).
- Targeted rerun: `tests/unit/market-buyer-config.test.ts` (7 tests),
  `tests/integration/market-chain.test.ts` + `tests/determinism/market-chain-determinism.test.ts` — pass.
- No golden/snapshot regressions observed.

## Commit

- `7e3ba1f` — fix(08): WR-01 skip buyer dispatch when configured target already covered by stock + in-transit
