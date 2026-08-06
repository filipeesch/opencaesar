---
phase: 07-warehouses-logistics
reviewed: 2026-08-03T18:26:04Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - src/sim/logistics.ts
  - src/sim/runner.ts
  - src/sim/advisors.ts
  - tests/unit/warehouse-orders.test.ts
  - tests/unit/warehouse-reservation.test.ts
  - tests/unit/commercial-center.test.ts
  - tests/unit/logistics-advisor.test.ts
  - tests/integration/warehouse-runner.test.ts
  - tests/determinism/warehouse-logistics-determinism.test.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-08-03T18:26:04Z
**Depth:** deep
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the Phase 7 (Warehouses & Logistics) model layer, runner wiring, advisor projection, and the five new test suites. The four required focus areas verify clean on the core contracts:

- **Determinism** — the new code contains no `Math.random`/`Date`/wall-clock reads (only pre-existing `getSaveData` uses `Date.now`, and it is not in the `getState()`/`getStateJson()` path). `ReservationPool` expiry is tick-injected (`now + expiresIn`), `findRoadPath` A* is FIFO-deterministic, and the chunked-tick test (1/7/50 → byte-identical `getStateJson()`) passes.
- **Road-reachability** — `warehouseCandidates` (runner.ts:1033) requires an adjacent road tile on both the producer and the warehouse and a non-null `findRoadPath` before pushing a candidate; `distance` is the road-path length, no Manhattan/Euclidean fallback. The disconnected-pocket integration test proves zero delivery with no teleport.
- **Fallback-on-full** — `CommercialCenter.resolveFull` never discards; it returns an accepting alternative + warning or a hold/not-discarded warning, and is a pure read.
- **Advisor** — `logisticsAdvisorFromState` derives every field from live `SimState` + production rows; the `×30` monthly scaling is an honest conversion of `producedLastTick`, reconciled exactly in tests.

`npm run check:military` is clean. `typecheck`, `lint`, and all 499 tests pass.

Findings below are latent correctness gaps in the new `ReservationPool` expiry API (not yet wired into the runner) and one contract gap in `resolveFull`. No blocker-level issues found.

## Warnings

### WR-01: expireReservations releases plain (non-expiry) reservations of the same commodity

**File:** `src/sim/logistics.ts:135-145` (release at line 139)
**Issue:** `reserve()` and `reserveWithExpiry()` share one `reservations` ledger, but `expiry` stores a single tick per commodity. `expireReservations` releases `this.reserved(commodity)` — the *entire* reserved amount — so a commodity holding both a plain `reserve()` and an expiry reservation has its plain (never-expiring) units silently released at the expiry deadline. The doc comment claims "plain reserve untouched" (line 123-126) and the test (warehouse-reservation.test.ts:63-71) only covers the isolated case where no expiry entry exists. This contradicts the "releases exactly the reserved units at the deadline" contract.
**Fix:** Track expiry per reservation entry rather than per commodity, e.g. maintain `expiry: Map<string, Array<{ amount: number; expiresAt: number }>>` and release only the amount belonging to entries whose `expiresAt <= now`. Add a test mixing `reserve` + `reserveWithExpiry` on one commodity.

### WR-02: Multiple reserveWithExpiry calls on one commodity coalesce the expiry deadline

**File:** `src/sim/logistics.ts:127-131` (`this.expiry.set(commodity, now + expiresIn)`)
**Issue:** A second `reserveWithExpiry` on the same commodity overwrites the first reservation's expiry tick, extending its deadline. Example: `reserveWithExpiry('wheat', 2, 10, 30)` (expires 40) then `reserveWithExpiry('wheat', 1, 15, 30)` (expires 45) leaves all 3 units reserved until 45 — the first 2 are not released at their own tick 40. The "exact release at the deadline" property is only exercised for a single reservation per commodity in the tests.
**Fix:** Store per-reservation expiry entries (see WR-01). At minimum, document the coalescing limitation on the method if per-commodity expiry is intentional.

### WR-03: reserve/reserveWithExpiry over-reserve when amount exceeds availability

**File:** `src/sim/logistics.ts:115-120` (`reserve`, pre-existing) inherited by `src/sim/logistics.ts:127-131` (`reserveWithExpiry`, new)
**Issue:** `reserve` guards `if (have < 1) return false` but then adds `amount`. `reserveWithExpiry('wheat', 5, now)` with only 3 available returns `true` and records 5 reserved; `available()` clamps to 0, over-blocking legitimate picks. No double-pick risk (it errs toward blocking), but the return value promises a reservation the pool cannot back. Since `reserveWithExpiry` is new and delegates straight to this, the new API inherits the behavior.
**Fix:** `if (have < amount) return false;` in `reserve`.

### WR-04: resolveFull can "fall back" to the designated (full) center itself

**File:** `src/sim/logistics.ts:91-105`
**Issue:** `resolveFull` returns the first candidate whose `accepts(commodity)` is true but never excludes `this.designation`. If the caller passes the designated center among the candidates and its `accepts` returns true (the runner warehouse destination uses `accepts: () => true`, runner.ts:1052), the "fallback" resolves to the same full warehouse with a misleading `falling back to ${alt.id}` warning and the load stays blocked — the §17.4 "alternative warehouse" intent is silently unmet. The current unit tests only pass candidates that are distinct from the designation.
**Fix:** Skip the designated center in the loop: `if (alt.id === this.designation) continue;`. Add a test where the designated center is first in the candidate list.

## Info

### IN-01: warehousePriority/warehouseNeedsStock are exported but unwired

**File:** `src/sim/logistics.ts:48-59`, consumed as `need: 0` hardcoded at `src/sim/runner.ts:1055`
**Issue:** The §17.3 need-score helpers added in 07-01 are not yet used by `warehouseCandidates`; the destination `need` field remains hardcoded `0`. Acknowledged in the 07-01 SUMMARY as Phase-8 runner wiring — not a defect, but dead surface until then.
**Fix:** Wire `need: warehousePriority(...)` once per-warehouse policies reach the runner (Phase 8).

### IN-02: distance uses path.length, which excludes both road endpoints

**File:** `src/sim/runner.ts:1054` with `src/sim/pathfind.ts:43-45, 71-81`
**Issue:** `findRoadPath` returns only intermediate tiles (both endpoints excluded), so `distance: path.length` undercounts true road distance by up to 1 segment (0 for adjacent). Identical to the established `findReachableGranary` pattern (runner.ts:1122), and monotonic for ranking — no behavior impact, noted for consistency.
**Fix:** None required; document if absolute road distance ever needs to be reported as UI.

---

## Tool Results

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean — exit 0 |
| `npm run test` | 69 files passed (499/499 tests) — exit 0 |
| `npm run lint` | clean — exit 0 |
| `npm run check:military` | clean — "no forbidden military tokens in src/ or data/" — exit 0 |

_Reviewed: 2026-08-03T18:26:04Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
