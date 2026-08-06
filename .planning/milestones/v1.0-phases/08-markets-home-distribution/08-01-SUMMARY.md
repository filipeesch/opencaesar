---
phase: 08-markets-home-distribution
plan: 08-01
subsystem: simulation
tags: [market, logistics, reservation, distribution, vitest, marker-matrix]

# Dependency graph
requires:
  - phase: 07-warehouses-logistics
    provides: "MarketConfig/defaultMarketConfig, MarketSupplier/findSupplier, ReservationPool, GranaryModel, sellerLoadComposition, MarketServicePolicy/policyOrder, nextPickPriority in src/sim/logistics.ts; buyer/seller walkers (decideBuyer/decideSeller/releaseWalkerLoad) in src/sim/walkers.ts"
provides:
  - "Per-market configuration behavior matrix (MARK-02, decision 3)"
  - "Reservation no-double-pick contention tests at model + walker level (MARK-01, decision 1)"
  - "Full 5-policy distribution-priority matrix (MARK-03, decision 5)"
affects: [08-02, 08-03, 09-trade-goods]

# Actuals (#2632) — no commits were made (executor instructed to write SUMMARY only).
actuals:
  tokens: 3800
  tasks: 3
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Test-only behavior matrices over the pre-drafted additive model (no source change in this plan)"
    - "Walker-level contention tests reuse the food-slice walker-stub pattern (createWalker/updateWalker against a SimInternals stub)"

key-files:
  created:
    - tests/unit/market-config.test.ts
    - tests/unit/market-reservation.test.ts
    - tests/unit/market-distribution.test.ts
  modified: []

key-decisions:
  - "Model-level no-double-pick assertions follow the real ReservationPool/GranaryModel semantics: the guarantee is 'total reserved never exceeds the seed; a reserve beyond remaining availability is refused' and 'a second reserve of the same amount fails once the load is exhausted' — the plan's literal arithmetic (buyer2 reserve(40) false after buyer1 reserved 40 of 100) does not match the implementation's available-based gate, so the tests prove the documented contract accurately instead (deviation D1)."

patterns-established:
  - "Pattern 1: behavior-matrix test files per market model dimension (config / reservation / distribution), each importing only existing logistics exports."
  - "Pattern 2: two-buyer walker contention driven via updateWalker against a stub, asserting sum-held never exceeds the granary's original stock and the granary never goes negative."

requirements-completed: [MARK-01, MARK-02, MARK-03]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Per-market configuration behavior matrix: defaultMarketConfig defaults, marketAccepts per-product accept/refuse with residential-class interplay (wine-for-plebeians blocked by default, unblocked by toggle), per-product independence, findSupplier nearest-within-radius selection and radius boundary (no supplier beyond radius, no non-holding supplier)"
    requirement: MARK-02
    verification:
      - kind: unit
        ref: "tests/unit/market-config.test.ts#defaultMarketConfig"
        status: pass
      - kind: unit
        ref: "tests/unit/market-config.test.ts#marketAccepts per-product accept/refuse with resident-class interplay"
        status: pass
      - kind: unit
        ref: "tests/unit/market-config.test.ts#findSupplier nearest-within-radius selection"
        status: pass
    human_judgment: false
  - id: D2
    description: "Reservation no-double-pick contention: ReservationPool never over-allocates (total reserved <= seed, exhausted-load second reserve refused, exact tick-based expiry release idempotent), GranaryModel transactional hold + second-buyer refusal + expiry restore, walker decideBuyer two-buyer sum-held never exceeds stock, restore-on-failure returns the reservation (releaseWalkerLoad)"
    requirement: MARK-01
    verification:
      - kind: unit
        ref: "tests/unit/market-reservation.test.ts#ReservationPool"
        status: pass
      - kind: unit
        ref: "tests/unit/market-reservation.test.ts#GranaryModel"
        status: pass
      - kind: unit
        ref: "tests/unit/market-reservation.test.ts#walker decideBuyer semantics"
        status: pass
      - kind: unit
        ref: "tests/unit/market-reservation.test.ts#walker restore-on-failure"
        status: pass
    human_judgment: false
  - id: D3
    description: "Distribution-priority matrix: policyOrder orders houses by all five MarketServicePolicy options (balanced/avoid-hunger/promote-evolution/local-district/patrician-reserve) with daysSinceVisit tiebreak; nextPickPriority essential-food-first then evolution-blocking-good then null; sellerLoadComposition fills 100-unit capacity within per-food caps, excludes zero-cap foods, never exceeds SELLER_CAPACITY"
    requirement: MARK-03
    verification:
      - kind: unit
        ref: "tests/unit/market-distribution.test.ts#full service-policy ordering matrix"
        status: pass
      - kind: unit
        ref: "tests/unit/market-distribution.test.ts#priority order"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-03
status: complete
---

# Phase 8 Plan 1: Markets & Home Distribution — Model Audit Matrices Summary

**Per-market configuration behavior matrix, reservation no-double-pick contention (model + walker), and the full 5-policy distribution-priority matrix locked against the pre-drafted market model with 29 new assertions — test-only, zero source changes.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-03T21:19:09 local
- **Completed:** 2026-08-03T21:24:00 local
- **Tasks:** 3
- **Files modified:** 3 created (all tests), 0 source files touched

## Accomplishments

- Baseline re-confirmed at 506 tests / 69 files green (typecheck clean) before any new test; measured delta after this plan: **535 tests / 72 files** (+29 tests / +3 files).
- Per-market configuration behavior matrix locked (`tests/unit/market-config.test.ts`, 11 tests): `defaultMarketConfig` defaults, per-product accept/refuse with resident-class interplay (wine-for-plebeians blocked by default, unblocked by toggle), per-product independence, `findSupplier` nearest-within-radius + radius boundary (nothing beyond radius, no non-holding supplier), MARK-02 decision 3.
- Reservation no-double-pick proven (`tests/unit/market-reservation.test.ts`, 6 tests): ReservationPool never over-allocates and releases exactly the held amount on tick-based expiry (idempotent); GranaryModel transactional hold + second-buyer refusal + expiry restore; walker `decideBuyer` two-buyer contention (sum carried never exceeds the granary's original 100, granary never negative, market receipt equals the sum of both reserves); restore-on-failure via `releaseWalkerLoad` returns the reservation, MARK-01 decision 1.
- Full distribution-priority matrix locked (`tests/unit/market-distribution.test.ts`, 12 tests): all five `MarketServicePolicy` orderings distinct and correct via `policyOrder` with daysSinceVisit tiebreak; `nextPickPriority` essential-food-first → evolution-blocking-good → null; `sellerLoadComposition` fills 100-unit capacity within per-food caps, excludes zero-cap foods, never exceeds SELLER_CAPACITY, MARK-03 decision 5.

## Task Commits

No commits were made — the executing agent was instructed to write SUMMARY/VERIFICATION files only (no git operations).

1. **Task 1: Baseline + per-market configuration behavior matrix** — wrote `tests/unit/market-config.test.ts`
2. **Task 2: Reservation no-double-pick: two buyers contending for one load** — wrote `tests/unit/market-reservation.test.ts`
3. **Task 3: Distribution priority matrix: five service policies + seller load + evolution-blocking** — wrote `tests/unit/market-distribution.test.ts`

## Files Created/Modified

- `tests/unit/market-config.test.ts` — 11 tests: defaultMarketConfig / marketAccepts / findSupplier matrix (MARK-02, decision 3)
- `tests/unit/market-reservation.test.ts` — 6 tests: ReservationPool + GranaryModel + walker decideBuyer no-double-pick contention + restore-on-failure (MARK-01, decision 1)
- `tests/unit/market-distribution.test.ts` — 12 tests: policyOrder 5-policy matrix + nextPickPriority + sellerLoadComposition (MARK-03, decision 5)

## Decisions Made

- None required beyond the deviation below — followed the accepted decisions 1, 3, 5 as specified; test-only, no source decision.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan arithmetic] Model-level no-double-pick assertions adjusted to match real ReservationPool/GranaryModel semantics**
- **Found during:** Task 2 (Reservation no-double-pick contention)
- **Issue:** The plan asserted "seed wheat 100, buyer1 reserve('wheat', 40) → available 60, buyer2 reserve('wheat', 40) returns false". The real `ReservationPool.reserve` returns true while `available >= amount` (60 >= 40), and `GranaryModel.reserve` returns null only when `amount > available` — so buyer2's identical 40-unit reserve literally succeeds. The plan's arithmetic does not match the implementation and cannot be asserted without a source change (which the tracer forbids).
- **Fix:** Rewrote the model-level assertions to prove the documented contract accurately: (a) the pool never over-allocates — total reserved across buyers never exceeds the seed, and a reserve beyond remaining availability is refused; (b) a second reserve of the same amount fails once the load is exhausted (seed 40, buyer1 takes all 40, buyer2 refused); (c) GranaryModel follows the existing logistics.test.ts pattern (buyer1 reserves 60 of 100 → available 40 → buyer2's 60 refused). Walker-level and expiry assertions unchanged.
- **Files modified:** tests/unit/market-reservation.test.ts
- **Verification:** `npm run typecheck && npx vitest run tests/unit/market-reservation.test.ts && npm run test` — 6/6 pass, full suite green.
- **Committed in:** not committed (executor withheld from git)

**2. [Rule 1 - Bug in plan arithmetic] Minor assertion-target fix (total-load test)**
- **Found during:** Task 3 (Distribution-priority matrix)
- **Issue:** The final assertion read `load.vegetables` which is `undefined` when capacity is exhausted before vegetables are reached; `toBeLessThanOrEqual` requires a number.
- **Fix:** Guarded with `(load.vegetables ?? 0)`.
- **Files modified:** tests/unit/market-distribution.test.ts
- **Verification:** task command green; 12/12 pass.
- **Committed in:** not committed (executor withheld from git)

---

**Total deviations:** 2 auto-fixed (2 plan-arithmetic/assertion bugs)
**Impact on plan:** All fixes necessary to assert the real, documented contract against the pre-drafted model without a forbidden source change. No scope creep; the lock-in intent is preserved.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The three matrices (config / reservation / distribution) are green and ready for 08-02 (runner per-market config registry + SimInternals.marketConfig wiring + runner-integrated chain test) and 08-03 (composed `marketLoadComposition` + chunked determinism).
- Full suite at 535 tests / 72 files; typecheck clean; `tests/unit/logistics.test.ts` (31 tests) and `tests/integration/food-slice.test.ts` unchanged and green.

---
*Phase: 08-markets-home-distribution*
*Completed: 2026-08-03*
