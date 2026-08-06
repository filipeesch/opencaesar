---
phase: 08-markets-home-distribution
plan: 08-03
subsystem: simulation
tags: [market, logistics, distribution, determinism, config-driven-load, vitest]

# Dependency graph
requires:
  - phase: 08-01
    provides: "policyOrder 5-policy matrix, sellerLoadComposition priority/cap matrix (green)"
  - phase: 08-02
    provides: "SimRunner setMarketConfig per-market registry, getWalkerInternals(), walker runtime honoring + chain test (green)"
provides:
  - "marketLoadComposition(cfg, marketStock, perFoodCap, capacity, opts) additive config-driven seller-load ordering (essential → evolution-blocking → rest, skipping refused products)"
  - "Composed distribution-priority integration tests (essential-first, refused exclusion, caps/capacity, policyOrder over a realistic house set)"
  - "Market-chain chunked determinism: same-seed runner ticks at chunk sizes 1/7/50 with a configured per-market config yield identical getStateJson(); fixed-seed buyer/seller micro-sequence repeat identity"
affects: [09-trade-goods, management-UI phase]

# Actuals (#2632) — no commits made (executor instructed to write SUMMARY only).
actuals:
  tokens: 6200
  tasks: 2
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "marketLoadComposition delegates the fill to sellerLoadComposition over a config-filtered acceptable-stock view, so refused products can never enter the load (neither via priority nor tail-fill)"
    - "Determinism tests use the established chunked-tick runChunked pattern plus a repeat-run micro-sequence against a fresh identical stub"

key-files:
  created:
    - tests/integration/market-distribution-priority.test.ts
    - tests/determinism/market-chain-determinism.test.ts
  modified:
    - src/sim/logistics.ts

key-decisions:
  - "marketLoadComposition drops refused products from the stock argument before delegating to sellerLoadComposition, guaranteeing refusal is honored even when sellerLoadComposition tail-fills remaining stocked products (the delegation-only approach could not exclude a refused product)."
  - "Determinism is proven both by chunk identity (1/7/50) with setMarketConfig on the market and by a fixed-seed buyer/seller repeat-run; logistics.ts/walkers.ts carry no Math.random()/Date.now()/new Date() invocation."

patterns-established:
  - "Pattern 1: config-driven composition filters at the source (stock view) rather than post-filtering the composed result, so the delegated fill can never resurrect a refused product."
  - "Pattern 2: chunked determinism reuses warehouse-logistics-determinism's runChunked loop; the micro-sequence first steps the buyer once (its idle state already satisfies the completion predicate) before looping to deposit."

requirements-completed: [MARK-01, MARK-02, MARK-03]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "marketLoadComposition derives the seller's load order from the market config — basic/essential food first, then the evolution-blocking good, then remaining stocked products — skipping refused products, bounded by per-food caps and the 100-unit capacity"
    requirement: MARK-03
    verification:
      - kind: integration
        ref: "tests/integration/market-distribution-priority.test.ts#fills essential food before the evolution-blocking good"
        status: pass
      - kind: integration
        ref: "tests/integration/market-distribution-priority.test.ts#never loads a product refused by the market config"
        status: pass
      - kind: integration
        ref: "tests/integration/market-distribution-priority.test.ts#bounds each food by its per-food cap"
        status: pass
    human_judgment: false
  - id: D2
    description: "policyOrder composed over a realistic market-serving house set for promote-evolution (higher missingVariety first) and patrician-reserve (higher tier first), matching the 08-01 matrix contract"
    requirement: MARK-03
    verification:
      - kind: integration
        ref: "tests/integration/market-distribution-priority.test.ts#policyOrder composed over a realistic market-serving house set"
        status: pass
    human_judgment: false
  - id: D3
    description: "Market-chain determinism: same-seed runner ticks at chunk sizes 1/7/50 with a configured per-market config (refused product + non-default target stock) yield identical getStateJson() for seeds 1/7/1337; identical fixed-seed buyer/seller updateWalker sequences yield identical market/granary stock and house marketCoverage; no Math.random()/Date.now()/new Date() invocation in logistics.ts or walkers.ts"
    requirement: MARK-01
    verification:
      - kind: determinism
        ref: "tests/determinism/market-chain-determinism.test.ts#market-chain chunked determinism with a configured per-market config"
        status: pass
      - kind: determinism
        ref: "tests/determinism/market-chain-determinism.test.ts#fixed-seed buyer/seller micro-sequence repeat identity"
        status: pass
      - kind: determinism
        ref: "tests/determinism/market-chain-determinism.test.ts#no Math.random / wall-clock in the market chain"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-08-03
status: complete
---

# Phase 8 Plan 3: Markets & Home Distribution — Composed Distribution + Determinism Summary

**marketLoadComposition config-driven successor load ordering (essential → evolution-blocking → rest, skipping refused products) plus market-chain chunked determinism proven at 1/7/50 chunk sizes with a configured per-market config and a fixed-seed buyer/seller repeat-run — 10 new tests, additive export only.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-03T21:34:30 local
- **Completed:** 2026-08-03T21:39:00 local
- **Tasks:** 2
- **Files modified:** 2 created (tests), 1 modified (src/sim/logistics.ts — additive `marketLoadComposition`)

## Accomplishments

- Added additive `marketLoadComposition(cfg, marketStock, perFoodCap, capacity, opts)` to `src/sim/logistics.ts` — derives the seller's load order from the market config ([basicFood, evolutionBlocking, ...priorities] then remaining stocked products), filtering out refused products (via `marketAccepts`) and zero-stock/zero-cap foods, delegating the fill to `sellerLoadComposition` (MARK-03, decision 5; §18.4/§12.11).
- Composed distribution-priority tests (`tests/integration/market-distribution-priority.test.ts`, 6 tests): essential food (wheat) filled before the evolution-blocking good (vegetables), refused products excluded even when stocked and prioritized, per-food caps and the 100-unit capacity respected across scenarios, and `policyOrder` composed over a realistic market-serving house set (promote-evolution / patrician-reserve).
- Market-chain chunked determinism (`tests/determinism/market-chain-determinism.test.ts`, 4 tests): same-seed runner ticks at chunk sizes 1/7/50 with `setMarketConfig` on the market (refused product + non-default target stock) produce byte-identical `getStateJson()` for seeds 1/7/1337; identical fixed-seed buyer/seller `updateWalker` sequences produce identical market/granary stock and house marketCoverage; a source check asserts logistics.ts/walkers.ts introduce no `Math.random()`/`Date.now()`/`new Date()` invocation.
- Existing determinism tests (determinism.test.ts, production-chain-determinism.test.ts, warehouse-logistics-determinism.test.ts) and the 08-01/08-02 matrices stay green unchanged.

## Task Commits

No commits were made — the executing agent was instructed to write SUMMARY/VERIFICATION files only (no git operations).

1. **Task 1: Composed distribution priority: marketLoadComposition + policy ordering** — `marketLoadComposition` (logistics.ts), `tests/integration/market-distribution-priority.test.ts` (6 tests)
2. **Task 2: Market-chain chunked determinism: config + buyer/seller sequence** — `tests/determinism/market-chain-determinism.test.ts` (4 tests)

## Files Created/Modified

- `src/sim/logistics.ts` — added `marketLoadComposition` (additive; `sellerLoadComposition`, `policyOrder`, `marketAccepts` unchanged)
- `tests/integration/market-distribution-priority.test.ts` — 6 tests (composed priority + policy ordering)
- `tests/determinism/market-chain-determinism.test.ts` — 4 tests (chunked 1/7/50 identity + repeat-run identity + clock/RNG-absence)

## Decisions Made

- `marketLoadComposition` builds a config-filtered acceptable-stock view before delegating, so a refused product can never enter the load through `sellerLoadComposition`'s tail-fill (a priorities-list-only approach could not guarantee exclusion).
- Determinism assertions rely on the identity holding by construction (pure/seeded decide paths), with a direct source scan backing the RNG/clock-free claim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in test loop] The buyer micro-sequence loop must step once before looping to completion**
- **Found during:** Task 2 (Fixed-seed micro-sequence repeat identity)
- **Issue:** A freshly-created buyer already has `carryingGood: null, carriedAmount: 0`, which satisfies the completion predicate, so the `while (!complete)` loop never advanced it — the granary stayed at 100 and the deposit never happened.
- **Fix:** Added an explicit `updateWalker` call after creation to reserve at departure, then loop to deposit (mirrors the 08-02 chain test).
- **Files modified:** tests/determinism/market-chain-determinism.test.ts
- **Verification:** determinism tests 4/4 pass.
- **Committed in:** not committed (executor withheld from git)

**2. [Rule 1 - Bug in test expectation] End-of-sequence sanity assertions must reflect seller consumption of the market load**
- **Found during:** Task 2 (Fixed-seed micro-sequence repeat identity)
- **Issue:** The sanity check asserted marketWheat 40, but by the end of the sequence the seller had composed its load from the market (market wheat back to 0) and delivered one unit to the house — the check described the mid-sequence state.
- **Fix:** Asserted the end-state (granary 60, market 0, house foodInventory wheat 1, seller load wheat 39).
- **Files modified:** tests/determinism/market-chain-determinism.test.ts
- **Verification:** determinism tests 4/4 pass.
- **Committed in:** not committed (executor withheld from git)

---

**Total deviations:** 2 auto-fixed (2 test bugs)
**Impact on plan:** Both fixes necessary for the determinism test to actually drive the sequence; no scope creep, no source change beyond the planned additive export.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 8 complete: composed distribution priority and market-chain determinism proven. Ready for Phase 9 (external trade / upstream goods routing), which builds on the per-market config registry and buyer/seller chain.
- Full suite at 563 tests / 77 files; typecheck clean; no goldens regenerated (no mechanics changed by this plan — only additive composition + tests).

---
*Phase: 08-markets-home-distribution*
*Completed: 2026-08-03*
