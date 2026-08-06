# Phase 7: Warehouses & Logistics - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Mode:** Research-enabled, Nyquist-validated, verify-as-built + gap-fill over the
accepted decisions
**Baseline:** `npm run typecheck` clean; `npm run test` → **467 tests / 63 files**
green (~3.7s). `tests/unit/logistics.test.ts` holds 31 tests including a 2-test
"warehouse orders & slots" block and a 1-test "commercial center" block.

<domain>
## Phase Boundary

Deliver the warehouses & logistics surface from `game.md` §17: per-commodity
warehouse orders (accept, refuse, request, maintain, empty, reserve), a single
designated Commercial Center with fallback-on-full + warnings, and live-derived
production/logistics advisor data (stock, production/consumption, in-transit,
bottlenecks, stopped buildings). Requirements: WARE-01, WARE-02, WARE-03.
Roadmap Phase 7, depends on Phase 6. Source spec: `game-specs/game.md` §17
("Armazéns e Logística"), §17.1 unit/cargas, §17.2 armazém, §17.3 ordens por
mercadoria, §17.4 centro comercial, §17.5 tela logística.
</domain>

<decisions>
## Implementation Decisions

### Mode (audit + gap-fill + test coverage, verify-as-built)
- Consistent with Phases 5-6: `src/sim/logistics.ts` is a pre-drafted, additive
  model (Phases 7 & 8; tasks 5.4, 5.5, 5.6). This phase audits it against
  WARE-01/02/03, gap-fills the missing dimensions the accepted decisions name,
  and locks behavior with tests. No existing export is renamed or resemantized.

### warehouseAccepts slot gating + per-commodity order modes (decision 1, WARE-01)
- `warehouseAccepts` (logistics.ts:25-29) already gates on `usedSlots >=
  slotCapacity` and rejects `refuse`/`empty`. Audit finding: only
  accept/capacity/refuse/empty/request are asserted today
  (logistics.test.ts:16-32); `maintain` and `reserve` are **untested** and have
  **no behavioral surface** (no maintain target, no reserve amount, no
  priority/need signal on `WarehousePolicy`, logistics.ts:15-18).
- Add a **per-mode matrix test** covering accept/refuse/request/maintain/empty/
  reserve for `warehouseAccepts` (incl. slot-capacity boundaries and the default
  absent-order → accept), and an additive semantic surface on `WarehousePolicy`
  (`maintainTargets` / `reserveAmounts` optional fields, `defaultWarehousePolicy`
  unchanged) plus pure helpers `warehouseOrder`, `warehouseReserves`, and
  `warehouseNeedsStock` so the §17.3 request/maintain ("destino prioritário when
  below target") and reserve (blocks export/distribution) semantics are
  representable and proven. Per-warehouse policy *state wiring into the live
  runner* (which today hardcodes `defaultWarehousePolicy()` at
  runner.ts:1028) is deferred to Phase 8 (markets/distribution), where
  buyer/seller agents actually consume orders.

### Warehousing runner wiring — road-reachable transfer + stock-rise test (decision 2, WARE-01)
- The production → warehouse transfer pipeline exists
  (`tickProduction` → `warehouseCandidates` → `porterDeliversTo`,
  runner.ts:837-982) and a stock-rise test exists
  (tests/integration/production-runner.test.ts:82-96). Audit gap:
  `warehouseCandidates` (runner.ts:1019-1039) selects by **Manhattan distance
  only** — it never checks road reachability (contrast `findReachableGranary`,
  runner.ts:1090-1109, which uses `findRoadPath`), so a warehouse with **no road
  path still receives goods**. Add road-pathing to the warehouse candidates
  (mirror `findReachableGranary`) and a test proving a disconnected warehouse
  receives nothing while goods stay at the producer (no teleport), and that
  stock rises once connected.

### CommercialCenter exclusivity + fallback-on-full + warnings (decision 3, WARE-02)
- `CommercialCenter` (logistics.ts:32-53) already enforces a **single
  designation** (second designation → `{ ok, fallback: true, warning }`) and that
  exclusivity is asserted (logistics.test.ts:34-44). Audit gap: §17.4 fallback
  **on full** is absent — there is no "full" concept, no alternative-warehouse
  resolution, and no warning when the designated center is full. Add an additive
  resolution path (when the designated center is full, pick an alternative
  warehouse that accepts the commodity and emit a warning; when none accepts,
  return refusal-with-warning and never discard the load) plus tests for both
  exclusivity (kept) and fallback-on-full.

### logistics advisor live-derived (decision 4, WARE-03)
- `LogisticsAdvisorView` / `logisticsAdvisor` (logistics.ts:144-163) are pure
  compose functions exercised only with hardcoded values
  (logistics.test.ts:94-102); there is **no runner accessor that derives
  stock/production/consumption/in-transit/bottlenecks/stopped from a live
  `SimState`** (the existing `getProductionAdvisor`, runner.ts:330-347, covers
  per-building rows + output stock only). Gap-fill: a `getLogisticsAdvisor()`
  accessor + a pure `logisticsAdvisorFromState` projection built from the
  production advisor rows and building state — every value traced to live sim
  state, never fabricated (§33-23). Tests assert each dimension against a real
  runner.

### Determinism (decision 5)
- Audit confirmed `src/sim/logistics.ts` is RNG/clock-free (no Math.random/Date/
  performance.now); `ReservationPool` (logistics.ts:56-81) has **no expiry** at
  all (trivially deterministic) and `GranaryModel.expireReservations`
  (logistics.ts:377-388) is tick-based. Add an additive deterministic expiry
  path to `ReservationPool` (tick-based `now`, like the granary) with tests, and
  a chunked-tick determinism test (chunk sizes 1/7/50 → identical
  `getStateJson()`) for the warehouse/logistics chain through the runner.

### Scope boundary
- The physical warehouse **footprint is 2×2** in both catalogs
  (data/buildings.ts:167-170, src/sim/buildings.ts:212-215), not the §17.2 3×3;
  changing it would break the closed assertion at
  tests/integration/production-chain.test.ts:34 and ripple through placement/
  goldens where warehouses sit on 2×2 pads (helpers.ts:105, determinism
  `buildProductionOnGenerated` at production-chain-determinism.test.ts:34). The
  accepted decisions do not call for a footprint change, so the "one load per
  slot" semantic is delivered at the policy/runner level (slotCapacity 16,
  distinct-commodity slot counting) and physical footprint parity is deferred.
- Visual rendering/tela logística (UI) and Phaser wiring stay out of scope
  (future Phase 18-style); this phase delivers the model + runner wiring +
  advisor projection + tests.
- Per-warehouse policy state wired into the runner is deferred to Phase 8.

### Claude's Discretion
- Task-level implementation (exact helper signatures, assertion details, test
  file layout) left to the executor within each plan's action and done criteria,
  bounded by the additive/conservative rules above.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- src/sim/logistics.ts — WarehouseReorder (13), WarehousePolicy (15-18),
  defaultWarehousePolicy (20-22), warehouseAccepts (25-29), CommercialCenter
  (32-53), ReservationPool (56-81), LogisticsAdvisorView + logisticsAdvisor
  (144-163), GranaryModel (219-451) with tick-based expireReservations
  (377-388).
- src/sim/runner.ts — tickProduction (837-982), warehouseCandidates
  (1019-1039), findReachableGranary (1090-1109, findRoadPath pattern),
  getProductionAdvisorRows/getProductionAdvisor (330-347), WAREHOUSE_CAPACITY 40
  / PRODUCTION_WAREHOUSE_SLOTS 16 (86-87).
- src/sim/advisors.ts — productionAdvisorRows (547-597), productionAdvisorSummary
  (610-626) — already live-derived per building.
- src/sim/pathfind.ts — findRoadPath (imported at runner.ts:38).
- src/sim/production.ts — porterDestination (workshop → warehouse → blocked,
  §16.4), porterDeliversTo (148-176) — the destination policy used by the runner.
- Data catalogs: data/buildings.ts warehouse (167-170), runtime
  src/sim/buildings.ts warehouse (212-215); src/sim/types.ts 'warehouse' (24).
  data/commodities.ts marks every non-food good storage:'warehouse' (88-208).
- Tests: tests/unit/logistics.test.ts (16-32 orders/slots, 34-44 commercial
  center, 94-102 advisor hardcoded), tests/integration/production-runner.test.ts
  (82-96 stock-rise), tests/integration/production-chain.test.ts (34 footprint),
  tests/determinism/production-chain-determinism.test.ts, tests/helpers.ts
  (productionChainMap 64-77, buildProductionCity 86-111).

### Established Patterns
- Deterministic seeded sim core under src/sim/; Phaser view-only.
- Physical loads move by road/porters — never teleported (core value; the
  road-reachable warehouse check in decision 2 enforces it for warehouses).
- Vitest suite (467 tests) ~3.7s; golden determinism intact; `tsc --noEmit` clean.
- Phases 5-6 pattern: additive model functions + runner tick wiring + advisor
  projection + unit/integration/determinism tests; verify-as-built audits first.

### Integration Points
- SimRunner gains a `getLogisticsAdvisor()` accessor projecting
  `LogisticsAdvisorView` from live state (production advisor rows +
  warehouse stock).
- `warehouseCandidates` gains road-path filtering (mirroring
  `findReachableGranary`).
- `WarehousePolicy` gains optional `maintainTargets`/`reserveAmounts` (additive);
  `CommercialCenter` gains an additive full-fallback resolution.
</code_context>

<specifics>
## Specific Ideas

No additional requirements beyond game.md §17 and the five accepted decisions
above.
</specifics>

<deferred>
## Deferred Ideas

- Physical 3×3 warehouse footprint parity (data + runtime catalogs) and the
  closed footprint assertion update — deferred to a later data/UI phase; the
  slot-per-commodity semantic is already enforced at the policy/runner level.
- Per-warehouse per-commodity order state wired into the live runner (today
  `warehouseCandidates` hardcodes `defaultWarehousePolicy()`, runner.ts:1028) —
  deferred to Phase 8 (markets/distribution buyer/seller agents consume orders).
- Visual warehouse/porter rendering and the §17.5 logistics screen (tela
  logística) — future UI phase.
- Reservation-pool expiry driven by market walkers (Phase 8) — the
  deterministic tick-based expiry primitive ships here (decision 5).
</deferred>
