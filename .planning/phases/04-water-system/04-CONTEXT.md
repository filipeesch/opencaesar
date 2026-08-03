# Phase 4: Water System - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Mode:** Smart discuss (accepted decisions batch, THIS is the record)

<domain>
## Phase Boundary

Wells, reservoirs, aqueducts, fountains, public baths, and the water overlay —
`WATR-01..WATR-06`. The water coverage/flow models already exist as a standalone,
unit-testable draft in `src/sim/water.ts` (header: "Phase 4 — tasks 4.1, 4.4, 4.6"
and "tasks 4.2, 4.3, 4.5"). This is a verify-as-built + gap-fill phase: audit the
draft models against WATR-01..05, close the genuine behavior gaps with unit tests,
and make the advisor overlay DATA for WATR-06 exist and be testable. Visual overlay
rendering is deferred to Phase 18 (Management UI). Requirements: WATR-01, WATR-02,
WATR-03, WATR-04, WATR-05, WATR-06.
</domain>

<decisions>
## Implementation Decisions

### Treatment of Existing Implementation (baseline scout)
- Verify-as-built + gap-fill `src/sim/water.ts`. It already drafts `WaterSystem`
  (well = basic water + sanitary risk, fountain = clean water, water class
  none/basic/clean/grand), `AqueductSystem` (4-way BFS flow from map water +
  filled reservoirs, `flowing`/`activeReservoirs`/`suppliedFountains`), and
  `computeBathCoverage` (wellness + desirability radius). Do NOT rewrite; only
  close the genuine gaps found below, with unit tests.
- Baseline confirmed: `npm run typecheck` clean; `npm run test` → **316 tests pass**
  (52 files, ~3s). `tests/unit/water.test.ts` has **7 tests** (3 well/fountain,
  2 aqueduct, 2 baths). Nothing in test or src references the reservoir storage/
  level or fountain-supply behaviors yet.

### 1. WATR-01..WATR-05 gap-fill in the water model layer (unit-tested)
- **Well desirability penalty (WATR-01):** wells must slightly reduce desirability in
  their radius. `TileWater` gains a signed per-tile `desirability` field; an active
  well subtracts `WELL_DESIRABILITY_PENALTY` (module const, default 4) on tiles
  within its radius. Sanitary risk already exists (`water.ts:83`,
  `coveredByWell && pollution > 0`) and is already tested (water.test.ts:5-12) — keep.
- **Reservoir 3×3 storage/inlet/outlet/level (WATR-02):** add an observable
  `ReservoirState { x, y, size, capacity, level, filled, inletConnected,
  outletToAqueduct }` produced by a pure helper over the existing
  `ReservoirDef { x,y,size,active }` + flow set: level = capacity when filled else 0;
  `inletConnected` = touches map water or a flowing aqueduct tile;
  `outletToAqueduct` = a flowing aqueduct tile adjacent to the reservoir footprint.
  Keep `ReservoirDef` itself unchanged (existing tests depend on `{x,y,size,active}`).
- **Fountain network requirement + clean-water radius + desirability (WATR-04):**
  a fountain only provides clean water when **supplied** (on a flowing aqueduct) AND
  **staffed**. Add `FountainDef { x, y, radius, supplied, staffed }` and export
  `resolveFountainActivity(defs): WaterSource[]` computing `active = supplied &&
  staffed` and kind `'fountain'`, feeding `WaterSystem.setSources`. The clean-water
  radius already exists (kind `'clean'` when `coveredByFountain`). Active fountains
  also add `FOUNTAIN_DESIRABILITY_BONUS` (module const, default 4) into the same
  `TileWater.desirability` field. Spec §14.4 "desliga se perder água ou
  trabalhadores" (goes dark without water/workers) is the decision-4 test.
- **Baths reservoir water + workers + health/desirability (WATR-05):** keep
  `computeBathCoverage` and `PublicBathDef` unchanged (existing tests at
  water.test.ts:60-75 depend on them). Add `BathDef { x, y, radius, supplied,
  staffed, waterCostPerTick? }` + `resolveBaths(defs): { active: PublicBathDef[];
  waterConsumed: number }` where a bath is active only when supplied AND staffed
  and waterConsumed = sum of `waterCostPerTick` (default 1) for active baths
  (WATR-05 "consume pequena quantidade de água"). The wellness grid feeds health,
  the desirability grid feeds desirability (decision 2).

### 2. Public baths wiring to health/desirability (decision 2)
- `assignBathEffects(defs, width, height)` returns `{ wellness, desirability,
  waterConsumed }`: resolve active baths via `resolveBaths`, then combine their
  radius coverage into the two grids (wellness = health input; desirability = sim
  desirability input). Add the not-yet-covered test: a bath without workers or
  without reservoir water provides no wellness/desirability; a fully supplied one
  does; water consumption is accounted.

### 3. AqueductSystem BFS flow determinism audit + propagation tests (decision 3)
- Audit `AqueductSystem.computeFlow` (water.ts:147-209): it consumes only the
  injected inputs (aqueductTiles Set, reservoirs, `hasMapWater`), a plain `queue`
  (`pop()`/DFS), and a `dirs` constant. **No `Math.random` / `Date` / wall-clock —
  verified deterministic** for identical inputs. Add flow propagation tests:
  source → chain → fountain activation (a fountain tile on a flowing aqueduct tile
  is in `suppliedFountains`, a disconnected fountain is not); block (tile removed →
  downstream and fountain desupply); repair (tile re-added → flow restores);
  road-arch crossing (chain spanning a road tile still flows — the model follows
  only aqueduct tiles, so roads under the chain never break flow). Fix anything the
  tests expose.

### 4. Explicit fountain-goes-dark test (decision 4)
- Add an explicit test in `tests/unit/fountain.test.ts`: a previously-supplied,
  staffed fountain goes dark and drops the house tile's water class from `clean`
  back to `basic`/`none` when (a) supply is removed (`supplied:false`, e.g. the
  aqueduct was blocked) and (b) workers are removed (`staffed:false`).

### 5. Overlay/advisor data must exist (decision 5, judgment applied)
- Housing "consumes" water in the live sim via `waterCooldown`
  (housing.ts:93-98; delivered by well walkers walkers.ts:157/170) — it does NOT
  consume `WaterClass` today. Judgment: keep the live waterCooldown path untouched
  (stability + 316-test baseline); `WaterClass` remains the overlay classification.
- Add `waterOverlayData(width, height, s)` to `src/sim/advisors.ts` (the UI-advisor
  data layer) returning per-tile `Record<string, number[][]>` grids that expose
  WATR-06: sources, reservoir filled/level, aqueduct flow (flowing vs present),
  well coverage, fountain coverage, house water classes, and per-tile desirability
  from the water model. Advisor DATA must exist and be unit-tested; visual overlay
  rendering (Phaser heatmaps, legends) is Phase 18. Extend `tests/unit/advisors.test.ts`.

### Claude's Discretion (grey areas, auto-answered)
- Well/fountain desirability constants live as module consts in water.ts (the file's
  existing style keeps radii as literals; no new `data/balance.ts` key needed).
- Reservoir/aqueduct/bath are NOT placeable simulator building types today
  (`BuildingType` union in types.ts:17-20 lacks them; `src/sim/buildings.ts` has only
  well/fountain). This phase models their water-layer behavior + advisor data per the
  decisions; adding them as placeable runtime buildings (types/placement/BUILDINGS
  + spawn wiring) is deferred.
- Exact ranges/falloffs of `waterOverlayData` grid values and helper signatures are
  left to the planner/executor as long as the five decisions above hold.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/sim/water.ts` — `WaterSource/WaterClass/TileWater` (13-32),
  `WaterSystem.compute()` (46-91: `coveredByWell`/`coveredByFountain`, `sanitaryRisk`
  line 83, `wellness` line 84, kind none/basic/clean), `ReservoirDef` (99-106),
  `AqueductSystem` (116-242; `computeFlow` 147-209 deterministic; `reservoirTouchesWater`
  215-234; `acceptableFountainSpots` 237-242), `PublicBathDef` (244-249),
  `computeBathCoverage` (252-275: wellness 1 / desirability 4 per active bath).
- `tests/unit/water.test.ts` — 7 tests covering well basic+risk, inactive sources,
  fountain outranks well, aqueduct propagation, broken-chain block, bath coverage,
  inactive baths. The spec reference files live in `data/buildings.ts` (reservoir
  3×3 at 82-85, fountain 86-90) and `data/walkers.ts` (well/fountain walkers 15-16).
- `src/sim/advisors.ts` — `SimSnapshot.hasWater` (19), `advisorsFrom` (44-60),
  generic `overlaysFrom(width,height,perTile)` (63-79) already used by
  `tests/unit/advisors.test.ts:24-30`. Live water percent (covered/total) already
  flows through `runner.derivedSnapshot()` (runner.ts:273-278, 292) via a thin
  `WaterSystem` use.
- Housing actually consumes water via `waterCooldown` (housing.ts:93-98, evolution
  100-127), replenished by well walkers (walkers.ts:156-170, runner tickSpawns
  walkerType line 647).

### Established Patterns
- Sim core is framework-free and unit-testable under Vitest (node env,
  `tests/**/*.test.ts`). Tests import sim modules directly from `src/sim/*.ts`.
- Water model is a pure static coverage/flow layer: no Phaser, no RNG, no wall clock.
- `runScenario`/`place` test helpers (tests/helpers.ts) exist for SimRunner-level
  scenarios but the water model layer is tested directly with plain objects.

### Integration Points
- `advisors.ts` overlay data (extend with `waterOverlayData`) — consumed by Phase 18
  UI; unit-tested in advisors.test.ts.
- `runner.derivedSnapshot()` water line (runner.ts:273-278) — the existing live-sim
  water coverage surface; NOT required to change this phase (advisor-data only).
- `npm run typecheck` + `npm run test` — fast verification loop (~3s).
</code_context>

<specifics>
## Specific Ideas

The accepted decisions (1-5 above) fully define scope: close well-desirability,
reservoir storage/level/inlet/outlet, fountain supply/go-dark/desirability, and bath
worker+water+health/desirability gaps in `src/sim/water.ts` with unit tests; audit +
propagate aqueduct flow determinism; and expose the WATR-06 water overlay advisor data
in `src/sim/advisors.ts` with tests. Visual overlay rendering is Phase 18.
</specifics>

<deferred>
## Deferred Ideas

- Making reservoir / aqueduct / bath placeable **runtime building types**
  (types.ts BuildingType union, src/sim/buildings.ts entries, placement, spawns,
  HUD build menu) — out of the accepted decisions; this phase works at the water
  model + advisor-data layer.
- Wiring the water model into the **live housing desirability / health ticks**
  (housing.desirabilityOf already folds `services.water`; the bath/well/fountain
  per-tile desirability is exposed as advisor data, not fused into `desirabilityOf`
  this phase).
- Visual Phaser water overlay rendering (heatmaps, legends, source icons, flow
  animation) — Phase 18 Management UI, consuming the `waterOverlayData` grids.
- Replacing house `waterCooldown` with a true WaterClass-driven consumption model —
  not required by WATR-06; housing keeps using the service-cooldown path.
- Aqueduct elevation over depressions and segment demolition UX — flow model only
  here (a blocked/removed tile already breaks flow by design).
</deferred>
