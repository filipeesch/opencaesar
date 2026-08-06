---
phase: 08-markets-home-distribution
reviewed: 2026-08-03T21:24:46Z
depth: deep
files_reviewed: 11
files_reviewed_list:
  - src/sim/logistics.ts
  - src/sim/runner.ts
  - src/sim/walkers.ts
  - tests/unit/market-config.test.ts
  - tests/unit/market-reservation.test.ts
  - tests/unit/market-distribution.test.ts
  - tests/unit/market-config-surface.test.ts
  - tests/unit/market-buyer-config.test.ts
  - tests/integration/market-chain.test.ts
  - tests/integration/market-distribution-priority.test.ts
  - tests/determinism/market-chain-determinism.test.ts
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-08-03T21:24:46Z
**Depth:** deep
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the Phase 8 (Markets & Home Distribution) implementation: the per-market `MarketConfig` registry in `runner.ts` (`setMarketConfig` / `marketConfig` / `hasMarketConfig`), the buyer-side wiring in `walkers.ts` (`marketFoodState` with in-transit accounting, refused-product gate, `buyerRadius` granary filter, fixed-fetch restock), the new `marketLoadComposition` / `findSupplier(preferredSupplier)` utilities in `logistics.ts`, and the seven new test files. `npm run typecheck` is clean, `vitest` passes all 563 tests (60 new Phase 8 test declarations included), and the diff introduces no military content.

The tests are substantive — every new test asserts real behavior (market/granary stock deltas, walker carrying state, radius exclusion, refused-product exclusion, target restock threshold, reservation restoration on failed trips, and same-seed chunked-run determinism). No vacuous stubs found.

One warning-level logic gap and several info-level notes are documented below. The warning (configured-market over-order when in-transit already covers the restock target) is recommended for a small fix; the info items are design/robustness notes with no immediate action required.

## Findings

### WR-01: Configured-market buyers can over-order when in-transit already covers the restock target (recommend fix)

**File:** `src/sim/walkers.ts` (`marketFoodState`, `decideBuyer`) + `src/sim/logistics.ts` (`nextFoodToFetch`)

For a configured market, `marketFoodState` sets `expectedConsumption[f] = stock + inTransit < target ? 1 : 0`, but `nextFoodToFetch` computes coverage from `current` (= market stock) only: `cons > 0 ? current/cons : current > 0 ? Infinity : 0`. When a food sits at stock 0 with in-transit units already covering the target (cons=0, current=0), coverage becomes 0 — the food is still selected as the "most depleted" (the IN-04 skip only excludes when `inTransit <= 0`, which is false here) — and `decideBuyer` fetches a fixed `BUYER_FETCH_AMOUNT` with no `want = target - stock - inTransit` clamp. Result: the market can temporarily hold ~2× the configured target (e.g., target 60, one 40-unit fetch in transit, another 40 dispatched), pulling more granary stock than the restock semantics intend. Self-correcting (buyers skip once stock is above target) and never causes data loss, but the configured "restock target" is not a hard ceiling.

**Recommendation:** subtract in-transit from the dispatch decision — either skip dispatch when `stock + inTransit >= target`, or clamp `take` to `max(0, target - stock - inTransit)`. Add a unit test asserting the market never exceeds `target + BUYER_FETCH_AMOUNT` while a fetch is in transit.

### IN-01: Per-market configs are not serialized in save/load

**File:** `src/sim/runner.ts`

`marketConfigs` is runtime-only: `getSaveData`/`fromSaveData` do not carry it, so after a save→load round-trip a configured market silently reverts to legacy cap behavior unless the host re-applies `setMarketConfig`. This is consistent with how host-owned policy is treated (configs are API state, not sim state), but the determinism test only covers same-seed runs, not config + save/load. Note it in the API docs; no code change required.

### IN-02: Public `marketConfig(id)` returns a default config while the sim treats undefined as legacy

**File:** `src/sim/runner.ts` + `src/sim/walkers.ts`

The runner's public accessor returns `defaultMarketConfig()` for unconfigured markets, but the walkers' internal hook is `(id) => this.marketConfigs.get(id)` (undefined → legacy path). A host reading `runner.marketConfig(id)` sees a default (`targetStock`, `buyerRadius=2`, `productRules`) that the sim does not actually apply (unconfigured markets still use legacy caps and unrestricted radius). Surface inconsistency — worth a doc comment; no code change required.

### IN-03: `marketLoadComposition` head-duplicate under-fill + hardcoded resident class

**File:** `src/sim/logistics.ts`

If `basicFood`/`evolutionBlocking`/`priorities` overlap, `ordered` carries duplicates; `sellerLoadComposition`'s fill loop uses assignment (`load[f] = canTake`) so duplicates consume `remaining` twice and the computed load is under-filled (wasted seller capacity). Test-facing utility (not wired into `decideSeller`), so low risk, but dedupe the head before building `ordered`. Also, `marketAccepts(cfg, f, 'plebeian')` hardcodes the resident class — extract a constant.

### IN-04: Applying a default config changes buyer radius behavior

**File:** `src/sim/walkers.ts` (`pickBuyerGranary`)

Configured markets filter granaries to Manhattan distance ≤ `buyerRadius` (default 2); unconfigured markets are unrestricted. Intended and tested ("buyerRadius narrows the supplier search"), but worth documenting that `setMarketConfig(id, defaultMarketConfig())` changes behavior vs. leaving the market unconfigured.

### IN-05: `hasMarketConfig` is surface API only

**File:** `src/sim/runner.ts`

`hasMarketConfig(buildingId)` is exposed but not used internally. Fine as public surface; no action.

## Verification

- `npm run typecheck` — clean (exit 0).
- `npx vitest run` — 77 files, 563 tests, all pass (exit 0), including the 60 new Phase 8 test declarations.
- Diff scan (`git diff 254fe10^..254fe10 -- src/ tests/`) — no military content (`soldier|army|military|legion|war|weapon|sword|shield|spear|archer|fort|barracks|battalion|combat` → no matches).

## Recommendation

Fix WR-01 (small change in `decideBuyer`/`marketFoodState` plus one regression test). The IN items are documentation/robustness notes; no urgent action.
