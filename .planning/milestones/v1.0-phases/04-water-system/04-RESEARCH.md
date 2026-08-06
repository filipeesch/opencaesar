# Phase 4: Water System — Research

**Date:** 2026-08-03
**Researcher:** gsd-phase-researcher (inline, combined session)
**Baseline verified:** `npm run typecheck` clean; `npm run test` → **316 tests pass**
across 52 files (~3s). `tests/unit/water.test.ts` holds **7 tests**. Suite runs in
~3s full / <1s targeted, so per-task verification is cheap and the full suite can run
after every plan wave.

---

## 1. Existing Implementation Summary

The `src/sim/water.ts` module is a **pre-drafted, standalone model layer** (its own
header: "Phase 4 — tasks 4.1, 4.4, 4.6" and "tasks 4.2, 4.3") plus
`computeBathCoverage` (task 4.5). It is self-contained (no Phaser, no RNG, no wall
clock) and only lightly wired into the live sim.

### WATR-01 — Wells (extração: poço local, penalidade de desejabilidade, risco sanitário)
- `WaterSystem` (water.ts:38-97): `compute()` marks `coveredByWell` for active `well`
  sources within `radius` (Manhattan dist, water.ts:67); `sanitaryRisk` is set when
  `coveredByWell && pollution > 0` (water.ts:83, `Math.min(1, pollution)`); water class
  `'basic'` (water.ts:86).
- Spec reference: building `well` (data/buildings.ts:78-81, serviceRadius 4).
- **Gap (GENUINE):** **no desirability penalty.** `TileWater` (water.ts:25-32) has
  `wellness`/`sanitaryRisk` but no desirability field, so the §14.1 "reduz levemente
  desejabilidade" behavior is absent everywhere (model, advisor data, tests).
- Sanitary risk is already implemented + tested (water.test.ts:5-12) — no work needed.

### WATR-02 — Reservoirs (3×3, storage, inlet/outlet/level)
- `ReservoirDef` (water.ts:99-106) is only `{ x, y, size, active }`. `AqueductSystem`
  seeds flow from filled reservoirs (water.ts:159-174) via `reservoirTouchesWater`
  (water.ts:215-234), but nothing exposes the reservoir's **storage / level /
  inlet / outlet** for the §14.2 "armazena água / mostra entrada, saída e nível"
  requirement.
- Spec reference: `reservoir` building is 3×3 (data/buildings.ts:82-85).
- **Gap (GENUINE):** no `ReservoirState` (capacity/level/filled/inletConnected/
  outletToAqueduct) observable. No reservoir tests in water.test.ts.

### WATR-03 — Aqueducts (tile-by-tile, road-arch crossing, flow display)
- `AqueductSystem` (water.ts:116-242): `computeFlow()` (147-209) floods 4-way BFS
  along `aqueductTiles` from map-water-adjacent seeds and filled reservoirs; returns
  `{ flowing, activeReservoirs, suppliedFountains }`. Tile-by-tile, `isFlowing`
  (211-213). Segment block breaks flow (existing test water.test.ts:46-57).
- **Determinism audit (decision 3):** `computeFlow` consumes only injected inputs
  (aqueductTiles `Set`, reservoirs array, `hasMapWater`, width/height), a `queue`
  (`pop()` = DFS), a `dirs` constant array, and Set membership. **No `Math.random`,
  no `Date`/`performance.now`, no external state** — deterministic for identical
  inputs. No changes required for determinism; the phase only adds propagation tests.
- **Road-arch crossing (§14.3):** naturally supported by the model — BFS only follows
  `aqueductTiles`, so a road tile under an aqueduct chain never breaks flow. No
  terrain-model change needed; add a flow test proving it.
- Spec: `TileState.aqueduct` exists (tile.ts:17/38) but is never populated; no
  runtime 'aqueduct' BuildingType (types.ts:17-20). Placeability is deferred (see
  CONTEXT deferrals).

### WATR-04 — Fountains (network requirement, clean-water radius, desirability)
- `WaterSystem.compute` marks `coveredByFountain` (→ water class `'clean'`) for any
  **active** `fountain`-kind source (water.ts:70-71, 85). Clean-water radius exists.
- **Gap (GENUINE):** a fountain's `active` flag is **externally supplied** today; the
  model does not itself enforce the §14.4 "exige conexão à rede … desliga se perder
  água ou trabalhadores" network requirement. No coupling between `AqueductSystem`
  (`suppliedFountains`) and fountain activity. `fountain` sources are also treated as
  plain `well`-like sources in the live sim (runner.ts:274-276).
- **Gap (GENUINE):** **no fountain desirability bonus** anywhere (data catalog has
  `desirability: { effect: 4, radius: 2 }` at data/buildings.ts:89 but it is not
  applied). No `FOUNTAIN_DESIRABILITY_BONUS` in the model.
- Tests today only cover inactive-provides-nothing (water.test.ts:14-19) and
  fountain-outranks-well (21-29). No go-dark test (decision 4).

### WATR-05 — Public baths (reservoir water + workers, health/desirability)
- `computeBathCoverage` (water.ts:252-275) sets wellness=1 and desirability=4 within
  `radius` for `baths` with `active:true`. Existing tests cover active coverage and
  inactive-nothing (water.test.ts:60-75).
- **Gap (GENUINE):** the model does not enforce the §14.5 preconditions — **reservoir
  water and workers** — nor does it account for the small water consumption; neither
  wellness nor desirability is wired into a health/sim input (decision 2).
- No `bath` building in data/buildings.ts or the runtime BUILDINGS catalog (deferred).

### WATR-06 — Water overlay (sources, reservoir, flow, coverage, water classes)
- Advisor/UI data layer: `advisors.ts` has `SimSnapshot.hasWater` (19) and the generic
  `overlaysFrom(width,height,perTile)` (63-79) with a water overlay test
  (advisors.test.ts:24-30). Live sim exposes only a scalar water coverage percent
  (runner.ts:273-278, 292 — `water: { coveredTiles, totalTiles }`).
- **Gap (GENUINE):** no advisor-data function exposes **per-tile** sources, reservoir
  state, aqueduct flow, well/fountain coverage, or **house water classes** — the §14.6
  overlay data surface. Visual rendering is Phase 18 (deferred), but the advisor DATA
  must exist (decision 5).
- **Housing consumption audit (decision 5):** housing consumes water via
  `waterCooldown` decay (housing.ts:93-98) replenished by well walkers
  (walkers.ts:156-170; tickSpawns walkerType at runner.ts:647). Housing does NOT
  consume the `WaterClass` model today. Judgment (CONTEXT decision 5): keep the live
  waterCooldown path; expose WaterClass via the overlay advisor grids.

---

## 2. Gaps vs Requirements

| Requirement | Status | Gap |
|-------------|--------|-----|
| WATR-01 wells: basic water + sanitary risk | ✅ as-built | `WaterSystem` + test (water.ts:83, water.test.ts:5-12) |
| WATR-01 wells: desirability penalty | ❌ missing | No desirability field/effect in the water model (TileWater water.ts:25-32) |
| WATR-02 reservoir 3×3 + storage/inlet/outlet/level | ❌ partial | `ReservoirDef` is 3×3-capable but stores no state; no ReservoirState, no tests |
| WATR-03 aqueduct tile-by-tile flow + block | ✅ as-built | BFS model + 2 tests; deterministic (audit confirmed) |
| WATR-03 road-arch crossing / flow propagation tests | ❌ missing | No source→chain→fountain / block / repair / road-crossing flow tests |
| WATR-04 fountain clean-water radius | ✅ as-built | `coveredByFountain` → `'clean'` (water.ts:70-71, 85) |
| WATR-04 network requirement + go-dark | ❌ missing | `active` externally set; no supplied-and-staffed coupling; no go-dark test |
| WATR-04 fountain desirability | ❌ missing | No desirability output for fountains in the model |
| WATR-05 bath health/desirability coverage | ✅ as-built | `computeBathCoverage` wellness/desirability (+ 2 tests) |
| WATR-05 reservoir-water + workers + water cost | ❌ missing | No supplied/staffed gating, no waterConsumed accounting, no wiring test |
| WATR-06 overlay advisor data (sources/flow/coverage/classes) | ❌ missing | No per-tile water overlay data builder in advisors.ts; only scalar percent |
| WATR-06 visual rendering | ➖ out of scope | Phase 18 (CONTEXT deferral) — advisor DATA only |

---

## 3. Open Questions (all RESOLVED)

| # | Question | Resolution |
|---|----------|------------|
| Q1 | Is `AqueductSystem.computeFlow` deterministic? | **RESOLVED:** Yes — inputs only (aqueductTiles Set, reservoirs, hasMapWater), `pop()`-DFS queue, `dirs` const; no `Math.random`/`Date` (water.ts:147-209). Add propagation tests, no code change for determinism. |
| Q2 | Does housing consume WaterClass? | **RESOLVED:** No — it consumes `waterCooldown` (housing.ts:93-98; walkers.ts:157/170). Keep that path; expose WaterClass via advisor overlay data (decision 5 judgment). |
| Q3 | Where does the water overlay advisor data belong? | **RESOLVED:** `src/sim/advisors.ts` (the UI-advisor data layer) — `waterOverlayData(width,height,state)` returning `Record<string, number[][]>` grids; rendering deferred to Phase 18. |
| Q4 | How to implement fountain "network requirement"? | **RESOLVED:** `resolveFountainActivity(FountainDef[])` → active = supplied && staffed → `WaterSource[]` fed to `WaterSystem.setSources`; go-dark when either is lost (decision 4). |
| Q5 | How to model baths' preconditions + water cost? | **RESOLVED:** keep `computeBathCoverage`/`PublicBathDef`; add `BathDef {supplied, staffed, waterCostPerTick?}` + `resolveBaths` (active = supplied && staffed; waterConsumed sum) + `assignBathEffects` (wellness/desirability/waterConsumed). |
| Q6 | Are reservoir/aqueduct/bath placeable sim buildings today? | **RESOLVED:** No — types.ts:17-20 `BuildingType` lacks them; runtime BUILDINGS (buildings.ts) only has well/fountain. Out of scope (CONTEXT deferral); this phase models water-layer behavior + advisor data. |
| Q7 | Actual baseline test count? | **RESOLVED:** 316 tests / 52 files (typecheck clean). Older "126"/"273"/"289" references are from earlier phases. |
| Q8 | Will the new model additions change goldens/determinism? | **RESOLVED:** No — water model is additive and only calls `npm run test`'s vitest run; no golden files, no runner tick changes. |
| Q9 | Does the existing fountain clean-water radius need rework? | **RESOLVED:** No — `coveredByFountain` → `'clean'` is correct; only activity gating + desirability + go-dark tests are added. |

---

## 4. Validation Architecture

Applies — see `04-VALIDATION.md` (created). The Vitest suite is fast (~3s full,
<1s targeted), so per-task sampling at `npm run typecheck` + the task's `<automated>`
vitest command is fine; the full suite runs after each plan wave. No Wave-0
infrastructure is needed beyond the new test files each task creates itself
(tests/unit/reservoir.test.ts, tests/unit/aqueduct-flow.test.ts,
tests/unit/fountain.test.ts, tests/unit/baths.test.ts),
plus in-place extension of the existing tests/unit/water.test.ts and
tests/unit/advisors.test.ts.
