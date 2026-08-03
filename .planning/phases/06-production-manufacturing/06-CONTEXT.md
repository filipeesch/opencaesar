# Phase 6: Production & Manufacturing - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous batch acceptance) over the accepted decisions
**Baseline:** `npm run typecheck` clean; `npm run test` → **424 tests / 57 files** green (~3s).

<domain>
## Phase Boundary

Deliver extraction sites (clay pit, timber yard, iron mine, marble quarry) that
require a deposit, and workshops (pottery, carpentry, oil press, winery,
metallurgy) that hold input/output stock, progress, a porter, destination
selection, and bottleneck states. Goods must never be destroyed silently
(§16.4). Requirements: PROD-01, PROD-02. Source spec: `game.md` §16
("Extração e Manufatura"), chains §16.1, selection §16.4. Roadmap Phase 6.
</domain>

<decisions>
## Implementation Decisions

### Mode (verify-as-built + gap-fill + test coverage)
- Consistent with Phases 1-5: `src/sim/production.ts` is a pre-drafted,
  self-contained model. This phase audits it against PROD-01/PROD-02, gap-fills
  the missing enforcement/integration, and adds test coverage.

### Deposit-requirement enforcement (decision 1, PROD-01)
- `EXTRACTION_SITES.requires` (production.ts:38-43) is today an unenforced
  cosmetic string. Add an executable gate surface in `src/sim/production.ts`
  (`satisfiesDeposit` / `canExtract`) backed by `TileState.resourceType`
  (tile.ts:14) and terrain, then wire it into the runner so a site off-deposit
  produces nothing and is reported blocked.
- Destination validity (PROD-02 §16.4 — needy workshop > warehouse > blocked):
  add a concrete `porterDestination` that validates accepts + capacity, and a
  `porterDeliversTo` that actually moves a load into a destination stock;
  gap-fill tests including the warehouse fallback path (decision 1).

### Multi-step pipeline tests (decision 2)
- Add tests asserting the full model chain: input consumed → output produced →
  porter dispatched → destination stock rises, for both a workshop and a
  warehouse destination.

### Blocked-state no-loss (decision 3)
- Verify and lock with tests that `workshopStatus` blocked / missing_input /
  output_full and the no-valid-destination "blocked" state never destroy
  existing goods; add blocked-state no-loss tests.

### SimRunner tick integration + advisor data (decision 4)
- Audit found production.ts is NOT referenced by any src/sim/* module (only
  tests import it). Gap-fill: add runtime building types (extraction /
  workshop / warehouse) to the live catalogs, add `SimRunner.tickProduction()`
  to `tick()` (extraction + workshop stepping + porter dispatch), and add
  production advisor data in `src/sim/advisors.ts` — every value derived from
  live sim state, never fabricated (§33-23).

### Determinism (decision 5)
- Audit confirmed `src/sim/production.ts` is RNG/clock-free (pure math).
- Add a chunked-tick determinism test (chunk sizes 1/7/50 → identical
  `getStateJson()`) for the production chain through the runner.

### Scope boundary
- Visual rendering of production buildings/UI overlays stays out of scope
  (future Phase 18-style); this phase delivers the model + runner wiring +
  advisor data + tests. The `data/buildings.ts` catalog entries for raw
  producers/workshops (data/buildings.ts:121-165) already exist — the runtime
  catalog (`src/sim/buildings.ts`) is the one that gains the new types.

### Claude's Discretion
- Task-level implementation (exact per-building defs, conservation assertions)
  left to the executor within each plan's action and done criteria.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- src/sim/production.ts — EXTRACTION_SITES (38-43), WORKSHOPS (45-51),
  ProductionState (53-60), workshopStatus (66-76), tickWorkshop (78-90),
  porterDelivers (92-98), selectDestination (100-118) — pre-drafted §16 model,
  self-contained and deterministic.
- src/sim/logistics.ts — defaultWarehousePolicy (20-22), warehouseAccepts
  (25-29), LogisticsAdvisorView (144-151) + logisticsAdvisor (153-163).
- src/sim/tile.ts — TileState.resourceType (14) / resourceAmount (15) —
  CORE-03 deposit surface (never populated today).
- src/sim/map.ts — fromLayout (39), mutateTileState (135) to stamp deposits.
- src/sim/runner.ts — tick() (173-216 order: spawns → labor → food → economy →
  housing → walkers → events → missions → trade → derived), tickFood (689-728)
  pattern to mirror for tickProduction, placeBuilding (341-398).
- src/sim/advisors.ts — productionInspection (163-167) generic stub; the food
  advisor pattern (foodAdvisorFromState 379-427) to mirror.
- src/sim/buildings.ts — runtime BUILDINGS catalog (30-164), BuildingDef
  (4-28); types.ts Good (15) already lists all production commodities;
  BuildingType (17-20) and BuildingCategory (22-25) need the raw/workshop types.
- Data catalog: data/buildings.ts raw producers (121-144), workshops
  (146-165), warehouse (167-170); data/validate.ts (49-112).
- Tests: tests/unit/production.test.ts (60), logistics.test.ts (404, ceramics
  chain 104-123), tests/integration/supply-chains.test.ts (ceramics 37-68),
  tests/determinism/determinism.test.ts (chunked 55-76), tests/helpers.ts
  (foodChainMap 26-31, buildFoodCity 37-55), tests/unit/advisors.test.ts.

### Established Patterns
- Deterministic seeded sim core under src/sim/; Phaser view-only.
- Physical loads moved by porters/walkers — never teleporting stock (core value).
- Vitest suite (424 tests) ~3s; golden determinism intact; `tsc --noEmit` clean.
- Phases 1-5 pattern: self-contained model + additive functions + runner tick
  wiring (tickFood) + advisor projection + unit/integration/determinism tests.

### Integration Points
- SimRunner.tick() gains a `tickProduction()` step (between food and economy).
- BuildingInstance (walkers.ts:82-98) gains an optional production state field
  (additive, non-serialized to BuildingState).
- advisors.ts gains production advisor rows derived from `SimState`.
</code_context>

<specifics>
## Specific Ideas

No additional requirements beyond game.md §16 and the five accepted decisions
above.
</specifics>

<deferred>
## Deferred Ideas

- Visual rendering, placement panel, and production overlays (future UI phase).
- Depleting/renewable resource deposits and desirability penalties per site
  (§16.2 "impacto negativo na desejabilidade") — modeled as data fields for a
  later phase.
</deferred>
