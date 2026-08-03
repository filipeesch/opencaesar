# Phase 7: Warehouses & Logistics — Research

**Date:** 2026-08-03
**Researcher:** gsd-phase-researcher + gsd-planner (combined session)
**Baseline verified:** `npm run typecheck` clean; `npm run test` → **467 tests
pass** across 63 files (~3.7s). `tests/unit/logistics.test.ts` holds 31 tests.
Suite is fast enough for per-task sampling: targeted <1s, full ~3.7s.

---

## 1. Existing Implementation Summary

`src/sim/logistics.ts` is a **pre-drafted, additive model layer** (header "Phases
7 & 8; tasks 5.4, 5.5, 5.6"). It is self-contained (no Phaser, no RNG, no wall
clock). It is imported by `src/sim/runner.ts:30`, `tests/unit/logistics.test.ts`,
and `tests/integration/supply-chains.test.ts`.

### WARE-01 — Warehouses: per-commodity orders, one load per slot
- `WarehouseReorder` (logistics.ts:13): `accept | refuse | request | maintain |
  empty | reserve` — the six §17.3 modes.
- `WarehousePolicy` (logistics.ts:15-18): `perCommodity: Partial<Record<...>>` +
  `slotCapacity`. `defaultWarehousePolicy(slotCapacity = 16)` (20-22).
- `warehouseAccepts(policy, commodity, usedSlots)` (25-29): returns false when
  `usedSlots >= policy.slotCapacity` (slot gating) OR the order is `refuse` or
  `empty`; every other mode (accept/request/maintain/reserve) and the absent
  order (default `accept`) return true.
- **Gap (test, decision 1):** only accept/capacity/refuse/empty/request are
  asserted (logistics.test.ts:16-32). `maintain` and `reserve` are **untested**
  and have **no behavioral surface** — `WarehousePolicy` holds no maintain
  target or reserve amount (logistics.ts:15-18), so §17.3's "below target →
  destino prioritário" (request/maintain) and "reserve blocks export/
  distribution" semantics are unrepresentable.
- **Note (scope):** the live runner's warehouse candidates hardcode
  `defaultWarehousePolicy()` (runner.ts:1028), so per-warehouse orders are not
  honored in the runner yet; that state wiring is Phase-8 scope (documented
  here and in CONTEXT <deferred>).

### WARE-01 — Runner wiring: production → transfer → warehouse stock rises
- `SimRunner.tickProduction()` (runner.ts:837-982) steps extraction/farms and
  workshops, then output porters (933-981) move finished loads to warehouse
  destinations via `warehouseCandidates` (1019-1039) + `porterDeliversTo`.
- **Covered:** "warehouse stock rises" already has runner-level tests
  (tests/integration/production-runner.test.ts:82-96; production-chain.test.ts:
  59-79; advisors.test.ts:344).
- **Gap (GENUINE, decision 2):** `warehouseCandidates` (runner.ts:1019-1039)
  ranks by **Manhattan distance** (`distance: manhattan(...)`, runner.ts:1027)
  and never checks road reachability. By contrast `findReachableGranary`
  (runner.ts:1090-1109) requires a `findRoadPath` over the road network
  (pathfind.ts). A warehouse with **no road path still receives goods** —
  violating the physical/road-delivered core value. No test covers a
  disconnected warehouse.

### WARE-02 — Single Commercial Center, fallback on full
- `CommercialCenter` (logistics.ts:32-53): `designate(id)` sets the designation;
  a *second* designation returns `{ ok: true, fallback: true, warning }` and does
  not change it; `isDesignated` / `allowedToExport` read the single designation.
- **Covered:** exclusivity asserted (logistics.test.ts:34-44).
- **Gap (GENUINE, decision 3):** §17.4 "Se estiver cheio: procurar armazém
  alternativo que aceite o produto; mostrar aviso; nunca descartar" is absent —
  `CommercialCenter` has no "full" concept, no alternative-warehouse resolution,
  and no full-warning path. The existing `designate` fallback is about a second
  *designation request*, not a full designated center.

### WARE-03 — Production/logistics advisor data
- `LogisticsAdvisorView` (logistics.ts:144-151): `stock, production, consumption,
  inTransit, bottlenecks, stopped`. `logisticsAdvisor(...)` (153-163) composes
  them from already-derived numeric args.
- **Covered (partial):** the compose function is exercised with hardcoded
  numbers (logistics.test.ts:94-102).
- **Gap (GENUINE, decision 4):** there is **no live accessor** that derives
  those aggregates from a running sim. `getProductionAdvisor()` (runner.ts:
  330-347) + `productionAdvisorRows`/`productionAdvisorSummary`
  (advisors.ts:547-626) produce per-building rows and output stock, but nothing
  fills `LogisticsAdvisorView`'s production / consumption / in-transit /
  bottlenecks / stopped aggregates from live state. Warehouses get no advisor
  row (advisors.test.ts:329-330) — stock must be projected separately.

### Determinism (decision 5)
- **Audit:** `src/sim/logistics.ts` contains no `Math.random`, `Date`,
  `Date.now`, or `performance.now` (grep-verified). `ReservationPool`
  (logistics.ts:56-81) has **no expiry at all** (trivially deterministic);
  `GranaryModel.expireReservations(now)` (logistics.ts:377-388) is tick-based.
- **Gap (test):** no chunked-tick determinism test covers the warehouse/logistics
  chain through the runner — the existing chunked tests cover only the food city
  (determinism.test.ts) and the production chain
  (production-chain-determinism.test.ts). The additive `ReservationPool` expiry
  primitive (tick-based) is unproven.

---

## 2. Gaps vs Requirements

| Requirement | Status | Gap |
|-------------|--------|-----|
| WARE-01 six per-commodity order modes enumerated | ✅ as-built | `WarehouseReorder` union (logistics.ts:13) |
| WARE-01 slot gating (one load per slot) | ✅ as-built/model | `warehouseAccepts` usedSlots gate (logistics.ts:26) + runner distinct-commodity slot count (runner.ts:1026); footprint 3×3 deferred |
| WARE-01 order behavior for request/maintain/reserve | ❌ partial | refuse/empty gate by inspection (25-29); maintain & reserve **untested + no surface** (logistics.ts:15-18); per-mode matrix test required (decision 1) |
| WARE-01 runner transfer warehouse stock-rise | ✅ covered | production-runner.test.ts:82-96, production-chain.test.ts:59-79 |
| WARE-01 road-reachable transfer | ❌ genuine | `warehouseCandidates` Manhattan-only (runner.ts:1027); no `findRoadPath`; disconnected warehouse still receives (decision 2) |
| WARE-02 single Commercial Center designation | ✅ covered | logistics.test.ts:34-44; designate fallback+warning (logistics.ts:36-44) |
| WARE-02 fallback on full + warnings + no discard | ❌ genuine | no full concept / alternative resolution on CommercialCenter (decision 3) |
| WARE-03 logistics advisor fields live-derived | ❌ genuine | raw compose only, hardcoded test (logistics.test.ts:94-102); no `getLogisticsAdvisor()` from SimState (decision 4) |
| Determinism: logistics RNG/clock-free | ✅ audit | grep clean; ReservationPool no expiry; granary expiry tick-based (377-388) |
| Determinism: warehouse-chain chunked test + pool expiry | ❌ gap | only food/production chunks exist; no pool-expiry proof (decision 5) |

---

## 3. Open Questions (all RESOLVED)

| # | Question | Resolution |
|---|----------|------------|
| Q1 | Are `maintain` and `reserve` order modes tested or behaviorally surfaced? | **RESOLVED:** No — only accept/capacity/refuse/empty/request asserted (logistics.test.ts:16-32); `WarehousePolicy` has no maintain target / reserve amount. Add the per-mode matrix test + additive `maintainTargets`/`reserveAmounts` + `warehouseOrder`/`warehouseReserves`/`warehouseNeedsStock` (decision 1). `warehouseAccepts` itself is correct as built (slots + refuse/empty). |
| Q2 | Is warehouse drop-off road-reachable today? | **RESOLVED:** No — `warehouseCandidates` (runner.ts:1019-1039) uses Manhattan only; `findRoadPath` is used only for granaries (runner.ts:1100). Add road-pathed warehouse candidates mirroring `findReachableGranary` (decision 2). |
| Q3 | Does "warehouse stock rises" already have a runner test? | **RESOLVED:** Yes — production-runner.test.ts:82-96 etc. Decision 2's new test targets the missing **road-reachable** dimension (disconnected warehouse receives nothing). |
| Q4 | Does CommercialCenter implement §17.4 full-fallback? | **RESOLVED:** No — exclusivity + second-designation fallback exist (logistics.ts:36-44); full-fallback with alternative warehouse + warning + no-discard does not. Additive resolution + tests (decision 3). |
| Q5 | Are logisticsAdvisor fields derived from live sim anywhere? | **RESOLVED:** No — only hardcoded-arg unit test (logistics.test.ts:94-102). Per-building rows are live (advisors.ts:547-626, runner.ts:330-347); the aggregate `LogisticsAdvisorView` is not. Add `logisticsAdvisorFromState` + `getLogisticsAdvisor()` (decision 4). |
| Q6 | Is the 3×3 footprint in WARE-01 satisfied? | **RESOLVED:** Catalogs declare footprint 2 (data/buildings.ts:168, src/sim/buildings.ts:214); the closed assertion at production-chain.test.ts:34 pins footprint 2 and placement/goldens use 2×2 pads (helpers.ts:105). The slot-per-commodity semantic is enforced at policy/runner level (slotCapacity 16, runner.ts:1026); physical footprint parity is **deferred** (CONTEXT <deferred>). |
| Q7 | Is logistics.ts deterministic? | **RESOLVED:** Yes — grep-clean of RNG/clock; ReservationPool has no expiry; granary expiry tick-based. Decision 5 adds the additive pool-expiry primitive + warehouse-chain chunked determinism test (test-only). |
| Q8 | Do the new road-pathed warehouse candidates break existing tests? | **RESOLVED:** No — every existing producer→warehouse layout is road-connected (helpers.ts buildProductionCity roads y=0/3/5 + spine x=7, warehouse at 12,1; production-chain-determinism buildProductionOnGenerated roads y=20/23/25, warehouse at 27,21). Verified the footprints touch connected road rows; stock-rise assertions hold. |
| Q9 | Actual baseline test count? | **RESOLVED:** 467 tests / 63 files, typecheck clean (measured this run; older 424/126/253 references are prior phases). |

---

## 4. Validation Architecture

Applies — see `07-VALIDATION.md` (created). The Vitest suite is fast (~3.7s
full, <1s targeted), so per-task sampling at `npm run typecheck` + the task's
`<automated>` vitest command is fine; the full suite runs after each plan wave.
No Wave-0 infrastructure is needed beyond the test files each task creates
itself (tests/unit/warehouse-orders.test.ts and tests/unit/
warehouse-reservation.test.ts in plan 07-01; tests/integration/
warehouse-runner.test.ts and tests/unit/commercial-center.test.ts in 07-02;
tests/unit/logistics-advisor.test.ts and tests/determinism/
warehouse-logistics-determinism.test.ts in 07-03), plus in-place extension of
src/sim/logistics.ts, src/sim/runner.ts, and src/sim/advisors.ts. All helpers
(reuse tests/helpers.ts productionChainMap/buildProductionCity) already exist.
