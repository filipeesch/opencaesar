---
phase: 07-warehouses-logistics
plan: 07-02
subsystem: api
tags: [warehouses, logistics, road-path, commercial-center, integration, vitest]

# Dependency graph
requires:
  - phase: 07-warehouses-logistics
    provides: 07-01 warehouse order matrix + slot gating (warehouseAccepts default-policy gate reused here)
provides:
  - Road-pathed warehouse candidates in SimRunner (findRoadPath instead of Manhattan-only), ranking by road distance, mirroring findReachableGranary
  - Disconnected-warehouse integration proof: no road path → zero deliveries over 200 ticks; delivery resumes after connecting the road
  - CommercialCenter.resolveFull §17.4 fallback-on-full: alternative accepting warehouse + warning, or hold-with-warning (never discard), pure/read-only
affects: [07-03, 08-markets-distribution]

# Actuals (#2632)
actuals:
  tokens: 9800
  tasks: 2
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Road-reachability gate added to candidate selection: skip when either endpoint lacks an adjacent road tile or findRoadPath returns null; distance becomes path length"
    - "Pure read-only resolution methods on model classes (resolveFull) — no state mutation"

key-files:
  created:
    - tests/integration/warehouse-runner.test.ts
    - tests/unit/commercial-center.test.ts
  modified:
    - src/sim/runner.ts
    - src/sim/logistics.ts

key-decisions:
  - "warehouseCandidates now requires findRoadPath between producer and warehouse adjacent road tiles (decision 2) — a disconnected warehouse is no longer a candidate"
  - "Pocket coordinates shifted from plan's (warehouse 16,14 / road 16,16) to (warehouse 16,17 / road 16,16) so the Scenario-B connecting column x=16 never crosses the warehouse footprint (non-overlapping pocket, no teleport)"
  - "Scenario B pre-fills the connected warehouse to near-capacity via internals (the established pattern at production-runner.test.ts:119) because the natural chain fills it only around tick ~700 — keeps the plan's 60-tick window meaningful"

patterns-established:
  - "Physical-transfer candidate selection validates road reachability before pushing, mirroring the granary pattern"

requirements-completed: [WARE-01, WARE-02]

coverage:
  - id: D1
    description: "SimRunner.warehouseCandidates requires a road path (findRoadPath) from the producer's adjacent road tile to the warehouse's adjacent road tile and ranks by road distance — a warehouse with no road path receives nothing (no teleport)"
    requirement: WARE-01
    verification:
      - kind: integration
        ref: "tests/integration/warehouse-runner.test.ts#a warehouse with no road path receives nothing while the connected warehouse and pit keep their stock"
        status: pass
    human_judgment: false
  - id: D2
    description: "Connecting the road enables delivery to the same warehouse (no-teleport both directions), and the connected buildProductionCity regression still shows warehouse stock rising"
    requirement: WARE-01
    verification:
      - kind: integration
        ref: "tests/integration/warehouse-runner.test.ts#connecting the road lets the same warehouse receive"
        status: pass
    human_judgment: false
  - id: D3
    description: "CommercialCenter.resolveFull §17.4 fallback-on-full: first accepting alternative + warning naming both warehouses, or id null + hold/not-discarded warning when none accepts, or No-Commercial-Center before designation; exclusivity of a single designation preserved"
    requirement: WARE-02
    verification:
      - kind: unit
        ref: "tests/unit/commercial-center.test.ts#fallback on full (WARE-02 §17.4)"
        status: pass
    human_judgment: false

# Metrics
duration: 10 min
completed: 2026-08-03
status: complete
---

# Phase 7 Plan 2: Road-Reachable Warehouses & Commercial Center Fallback Summary

**Warehouse deliveries now move only by road (warehouseCandidates requires a findRoadPath and ranks by road distance, mirroring findReachableGranary), and the Commercial Center gains §17.4 fallback-on-full with warnings and no-discard.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-03T18:12:21Z
- **Completed:** 2026-08-03T18:15:07Z
- **Tasks:** 2
- **Files modified:** 4 (2 source, 2 test files created)

## Accomplishments
- Added the road-reachability gate to `SimRunner.warehouseCandidates`: a warehouse is a candidate only when `findRoadPath` connects the producer's adjacent road tile to the warehouse's adjacent road tile; `distance` is now the road path length instead of Manhattan. All existing gates (capacity, per-commodity slots, warehouseAccepts) preserved.
- Proved with a new integration test that a disconnected warehouse (pocket at the south-east, isolated road + warehouse) receives zero clay/pottery over 200 ticks while the connected buildProductionCity warehouse and the clay pit keep their stock (no teleport), and that the same warehouse fills once its road joins the grid.
- Added `CommercialCenter.resolveFull(commodity, candidates)` §17.4: with a designation, returns the first accepting alternative with a warning naming both warehouses; with none accepting, returns id null + a hold/not-discarded warning; before any designation, a No-Commercial-Center warning. Pure read — outcome-stable and non-mutating.

## Task Commits

No commits created — this session runs in no-commit mode (orchestrator instruction: "Do NOT commit; write SUMMARY/VERIFICATION files only").

1. **Task 1: Road-reachable warehouse candidates + disconnected-warehouse test (WARE-01, decision 2)** — modified src/sim/runner.ts warehouseCandidates; created tests/integration/warehouse-runner.test.ts (3 tests).
2. **Task 2: CommercialCenter fallback-on-full + warnings (WARE-02, decision 3)** — added resolveFull to src/sim/logistics.ts; created tests/unit/commercial-center.test.ts (6 tests).

**Plan metadata:** no metadata commit (no-commit session).

## Files Created/Modified
- `src/sim/runner.ts` - `warehouseCandidates` now requires a road path to each warehouse and ranks by road distance (path length); producer/warehouse adjacent road tiles resolved via `adjacentRoadTile`.
- `src/sim/logistics.ts` - Added `CommercialCenter.resolveFull` (§17.4 fallback-on-full: alternative + warning, hold/not-discard path, no-designation case).
- `tests/integration/warehouse-runner.test.ts` - Disconnected warehouse receives nothing (200 ticks), connected warehouse fills after road connection, connected-city regression.
- `tests/unit/commercial-center.test.ts` - Exclusivity (second designation falls back) + fallback-on-full (alternative id + warning, first-accepting wins, no-accepting hold warning, no-designation, stability).

## Decisions Made
- Pocket coordinates shifted within the plan's stated rules (non-overlapping, no teleport) so the connecting column never touches the warehouse footprint; documented in the test header.
- Scenario B pre-fills the primary warehouse to near capacity via the internals registry (established pattern in production-runner.test.ts:119) to make the 60-tick window prove real delivery deterministically.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scenario B took no delivery within the plan's 60-tick window**
- **Found during:** Task 1 (disconnected-warehouse integration test)
- **Issue:** With the road-connected warehouse (12,1) only ~21 units deep after 200 ticks (capacity 40) and production throttled by the clay feedstock, the nearest warehouse never fills, so the farther pocket is never chosen and stays empty through 60 post-connection ticks. Natural fill needs ~700+ ticks.
- **Fix:** Pre-filled the connected warehouse to `{ pottery: 39 }` via the internals registry right before connecting (the same internals-set pattern production-runner.test.ts:119 uses to force a destination fallback), so the pocket becomes the nearest remaining warehouse and receives pottery within the 60-tick window. Verified: pocket holds ~4.4 pottery after 60 ticks while the primary sits at 40.
- **Files modified:** tests/integration/warehouse-runner.test.ts
- **Verification:** `npx vitest run tests/integration/warehouse-runner.test.ts` (3 tests pass); full suite 491 green.
- **Committed in:** no-commit session (part of Task 1 work)

**2. [Rule 3 - Blocking] Scenario A/B pocket coordinates overlapped the (12,1)-grid column**
- **Found during:** Task 1 (test construction)
- **Issue:** The plan's Scenario-B connecting road list included (16,15), which lies inside the plan's warehouse footprint (16..17,14..15), so the grid could never connect south of it.
- **Fix:** Shifted the pocket warehouse down to (16,17) (footprint 16..17,17..18) with the isolated road still at (16,16) north of it; the Scenario-B column x=16 (y=5..15) now joins the grid without crossing the footprint.
- **Files modified:** tests/integration/warehouse-runner.test.ts
- **Verification:** `npx vitest run tests/integration/warehouse-runner.test.ts` passes.
- **Committed in:** no-commit session (part of Task 1 work)

**3. [Rule 1 - Bug] Test regex `/not.?discard/i` did not match "nothing discarded"**
- **Found during:** Task 2 (commercial-center test)
- **Issue:** The plan's wording "never discard" is emitted as "nothing discarded" — the regex was too strict.
- **Fix:** Corrected the assertion to `/nothing discarded/i` (source text was correct).
- **Files modified:** tests/unit/commercial-center.test.ts
- **Verification:** `npx vitest run tests/unit/commercial-center.test.ts` (6 tests pass).
- **Committed in:** no-commit session (part of Task 2 work)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking).
**Impact on plan:** Two were test-fixture adjustments (coordinates + pre-fill) required to keep the plan's stated rules and timing meaningful; one corrected a test assertion. No source-behavior scope change — the road-reachability logic and resolveFull semantics match the plan.

## Issues Encountered
- Natural production-chain fill rate (~0.08 pottery/tick into the warehouse) means the plan's Scenario-B 60-tick window only works with the internals pre-fill; documented and covered.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 07-02 complete; road-reachable warehouse transfer and Commercial Center fallback locked.
- Ready for 07-03 (live logistics advisor `getLogisticsAdvisor()`/`logisticsAdvisorFromState` + warehouse/logistics chunked determinism + ReservationPool expiry identity).

---
*Phase: 07-warehouses-logistics*
*Completed: 2026-08-03*
