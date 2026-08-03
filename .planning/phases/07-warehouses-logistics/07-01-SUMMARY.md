---
phase: 07-warehouses-logistics
plan: 07-01
subsystem: api
tags: [warehouses, logistics, warehouse-orders, reservation-pool, determinism, vitest]

# Dependency graph
requires:
  - phase: 06-production-manufacturing
    provides: tickProduction warehouseCandidates porters and the production chain
provides:
  - Per-mode warehouse order matrix (accept/refuse/request/maintain/empty/reserve + default + slot-capacity boundaries) locked in tests/unit/warehouse-orders.test.ts
  - Additive WarehousePolicy fields (maintainTargets/reserveAmounts) + warehouseOrder/warehouseReserves/warehouseNeedsStock/warehousePriority helpers
  - Deterministic tick-based ReservationPool reserveWithExpiry/expireReservations with expiry determinism tests
affects: [07-02, 07-03, 08-markets-distribution]

# Actuals (#2632)
actuals:
  tokens: 7600
  tasks: 3
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive model extension: optional policy fields + pure helpers; no existing export renamed or resemantized"
    - "Deterministic tick-based expiry mirroring GranaryModel (injected now, never wall clock)"

key-files:
  created:
    - tests/unit/warehouse-orders.test.ts
    - tests/unit/warehouse-reservation.test.ts
  modified:
    - src/sim/logistics.ts

key-decisions:
  - "WarehousePolicy extended additively with optional maintainTargets/reserveAmounts; defaultWarehousePolicy unchanged (both undefined by default)"
  - "ReservationPool expiry is tick-based (now + expiresIn), matching the granary pattern — no Date/clock anywhere in logistics.ts"
  - "warehousePriority/warehouseNeedsStock expose the §17.3 need score for the Phase-8 runner wiring (need:0 at runner.ts:1036 today)"

patterns-established:
  - "Semantic surface represented as pure deterministic functions of (policy, commodity, stock) — unit-tested, runner-independent"

requirements-completed: [WARE-01]

coverage:
  - id: D1
    description: "Per-mode per-commodity order matrix for warehouseAccepts: all six modes + absent-order default-to-accept + independent per-commodity gating + slot-capacity boundaries (15 accepts, 16 refuses for every non-refusing mode)"
    requirement: WARE-01
    verification:
      - kind: unit
        ref: "tests/unit/warehouse-orders.test.ts#per-mode order matrix (WARE-01 §17.3)"
        status: pass
    human_judgment: false
  - id: D2
    description: "§17.3 order semantic surface: warehouseOrder (default accept), warehouseReserves (true only for reserve), warehouseNeedsStock (request/maintain-below-target), warehousePriority need score, maintain target + reserve amount"
    requirement: WARE-01
    verification:
      - kind: unit
        ref: "tests/unit/warehouse-orders.test.ts#order semantics: request/maintain/reserve (WARE-01 §17.3)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ReservationPool deterministic tick-based expiry: reserveWithExpiry backs availability immediately, expireReservations releases exactly the reserved units at the deadline, identical (now, expiresIn) outcomes across pools, plain reserve untouched"
    requirement: WARE-01
    verification:
      - kind: unit
        ref: "tests/unit/warehouse-reservation.test.ts#reservation pool expiry is deterministic (decision 5)"
        status: pass
    human_judgment: false

# Metrics
duration: 8 min
completed: 2026-08-03
status: complete
---

# Phase 7 Plan 1: Warehouses & Logistics — Order Matrix Summary

**Per-commodity warehouse order semantics (all six §17.3 modes + default + slot boundaries) and a deterministic tick-based ReservationPool expiry, all additive to src/sim/logistics.ts and locked with 15 new unit tests.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-03T18:05:39Z
- **Completed:** 2026-08-03T18:07:50Z
- **Tasks:** 3
- **Files modified:** 3 (1 source, 2 test files created)

## Accomplishments
- Locked the previously-untested `maintain`/`reserve` modes into a full six-mode per-commodity matrix test for `warehouseAccepts` (accept/refuse/request/maintain/empty/reserve + absent-order-default-to-accept + independent per-commodity gating + slot-capacity boundaries at 15/16).
- Added the additive §17.3 semantic surface: `WarehousePolicy.maintainTargets`/`reserveAmounts` (optional, default unchanged) plus pure helpers `warehouseOrder`, `warehouseReserves`, `warehouseNeedsStock`, `warehousePriority` — the need score a Phase-8 runner feeds the warehouse destination `need` field.
- Added deterministic tick-based `ReservationPool.reserveWithExpiry`/`expireReservations` (decision 5) mirroring the granary's injected-`now` pattern — no wall clock, proven byte-identical across pools.

## Task Commits

No commits created — this session runs in no-commit mode (orchestrator instruction: "Do NOT commit; write SUMMARY/VERIFICATION files only"). Task work is described below.

1. **Task 1: Baseline + per-mode warehouse order matrix test (WARE-01, decision 1)** — created tests/unit/warehouse-orders.test.ts (5 tests). Baseline re-confirmed before work: 467 tests / 63 files, typecheck clean.
2. **Task 2: Additive warehouse order semantics** — extended src/sim/logistics.ts (optional policy fields + 4 pure helpers) and warehouse-orders.test.ts (+5 tests).
3. **Task 3: Deterministic ReservationPool expiry** — added reserveWithExpiry/expireReservations to src/sim/logistics.ts and created tests/unit/warehouse-reservation.test.ts (5 tests).

**Plan metadata:** no metadata commit (no-commit session).

## Files Created/Modified
- `src/sim/logistics.ts` - Added optional `maintainTargets`/`reserveAmounts` to WarehousePolicy; exported `warehouseOrder`, `warehouseReserves`, `warehouseNeedsStock`, `warehousePriority`; added `ReservationPool.reserveWithExpiry`/`expireReservations` + private expiry ledger.
- `tests/unit/warehouse-orders.test.ts` - Six-mode per-commodity matrix + slot boundaries + order-semantics (maintain target / reserve gate / need score) assertions.
- `tests/unit/warehouse-reservation.test.ts` - Deterministic pool-expiry assertions (immediate backing, exact release at deadline, cross-pool identity, plain-reserve untouched).

## Decisions Made
- Followed the plan exactly: additive-only extension; `defaultWarehousePolicy` unchanged (both new fields stay undefined); `reserveWithExpiry` delegates to the existing `reserve` so plain-reserve semantics are untouched.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 07-01 complete; per-mode order matrix + slot gating + maintain/reserve surface + deterministic pool expiry proven.
- Ready for 07-02 (road-reachable warehouse candidates + CommercialCenter fallback-on-full) and 07-03 (live logistics advisor + chunked determinism).

---
*Phase: 07-warehouses-logistics*
*Completed: 2026-08-03*
