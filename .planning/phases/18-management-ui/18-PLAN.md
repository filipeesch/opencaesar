---
phase: 18-management-ui
plan: 18-plan
type: execute
wave: 1
depends_on: [15-PLAN, 16-PLAN, 17-PLAN]
files_modified:
  - src/game/scenes/HUDScene.ts
  - src/game/scenes/MainScene.ts
  - src/game/advisors.ts
  - src/game/palette.ts
  - src/sim/runner.ts
  - src/sim/advisors.ts
  - index.html
  - tests/unit/advisor-composer.test.ts
  - tests/unit/water-overlay.test.ts
  - tests/unit/advisors.test.ts
  - e2e/management-ui.spec.ts
  - e2e/inspect.spec.ts
autonomous: true
requirements: [UI-01, UI-02, UI-03, UI-04]

estimate:
  tokens: 150000
  raw_tokens: 150000
  tasks: 9
  confidence: low

must_haves:
  truths:
    - "UI-01: every new central control (Advisors / Overlays / Messages in the new control bar) is a real, wired control — clicking it visibly toggles its surface (advisors drawer / overlay bar / message-log focus) in the running game, and every build button is disabled when state.treasury < BUILDINGS[type].cost; verified end-to-end by e2e/management-ui.spec.ts against the ?test&seed=1337 + __cityApi harness (no button is decorative)."
    - "UI-02: the 13 advisors read live sim queries — src/game/advisors.ts advisorPanels(source) returns exactly 13 panels in the UI-SPEC tab order, every panel value traces to a dedicated runner getter (getFinanceAdvisor, getTradeAdvisor+getTradeRoutes, getProductionAdvisor, getLogisticsAdvisor, getEmployment, getGovernance, getRequests, getMission/getMissionProgress/getCampaignProgress, getEvents, getFestival, getCivilizationOverlay, getCivicStats, getDerived, getWaterOverlay) or advisorsFrom(snapshot) — mapped by the ACTUAL getter names, never string-keyed, never fabricated — and the drawer re-renders only when the sim tick advances (tick-change guard at HUDScene.ts:37-41)."
    - "UI-03: overlays reflect sim state — SimRunner.getWaterOverlay() aggregates ALL live well/fountain sources into WaterOverlayInput-fed grids (aqueduct/flow/reservoir grids intentionally empty), the Phaser heatmap layer (MainScene) draws per-tile grids below the buildings with a rendered legend (HUD DOM), exactly one overlay is active at a time, keyboard W/F/R/C/D/X toggle them, and clicking a highlighted tile opens the matching inspector through the existing emitInspect path without breaking camera pan/zoom."
    - "UI-04: five inspectors (residence / productive building / storage-granary / market / walker) open on click, built from the enriched pure *Inspection projections fed by runner.getWalkerInternals() (SimInternals.buildingById/buildings/walkers) — never by growing serialized BuildingState/WalkerState — with a close × and Next ◀/▶ controller cycling same-kind entities in stable entity-id order."
    - "Determinism preserved: no getState()/SaveData shape change and no golden regeneration anywhere in the phase; the enriched-inspector seam and getWaterOverlay() are pure read-only projections guarded by the existing determinism/golden suites, and the phase closes with the full suite + typecheck + check:military green together."
  artifacts:
    - path: src/sim/runner.ts
      provides: "getWaterOverlay(): Record<string, number[][]> assembling WaterOverlayInput from this.buildings.filter(well|fountain) (WaterSystem.setSources + compute) with empty aqueductTiles/flowing Sets and [] reservoirStates, feeding waterOverlayData(); derivedSnapshot() water aggregation over ALL well/fountain sources (not find() first-well) so the stats % agrees with the overlay; getInspector(id) read-only seam returning the BuildingState/WalkerState snapshot + its SimInternals instance for the enriched inspectors"
      min_lines: 45
    - path: src/game/advisors.ts
      provides: "NEW pure 13-advisor composer advisorPanels(source): AdvisorPanel[] in UI-SPEC tab order (ratings, finance, food, production-logistics, labor, trade, housing, demography, safety-risks, religion, governance, diplomacy, objectives), each panel with rows + alerts + a real action descriptor (open-inspector/locate/open-overlay/open-codex), composed from advisorsFrom(snapshot) for the 8 base datasets + the dedicated runner getters mapped by actual method names"
      min_lines: 120
    - path: src/sim/advisors.ts
      provides: "enriched additive signatures on residenceInspection/productionInspection/storageInspection/marketInspection/walkerInspection: an optional internals param (HouseInstance + BuildingSafetyState, ProductionState + workers/road-labor access, storage detail, market config, WalkerInstance) that appends rich fields (level/satisfiedTicks/foodInventory/civic, fire/danger/collapseRisk/crime, path/origin/carriedAmount/trade.waitTicks) while the original minimal calls keep returning the same shape"
      min_lines: 80
    - path: src/game/scenes/HUDScene.ts
      provides: "control bar (controls-advisors/controls-overlays/controls-messages) with real handlers, build-button unaffordable-disabled, advisors drawer (tabs + one live panel under the tick guard + open actions), overlay bar + legend DOM, and the 5 inspector popups with close × + Next ◀/▶; all sim-derived strings rendered via textContent"
      min_lines: 200
    - path: src/game/scenes/MainScene.ts
      provides: "overlay heatmap Graphics layer fed by the pure grids (getWaterOverlay/foodOverlayGrids/getCivilizationOverlay/getCivicStats), drawn below building depths, keyboard W/F/R/C/D/X, and click-through reusing emitInspect; camera wheel/drag handlers untouched"
      min_lines: 80
    - path: src/game/palette.ts
      provides: "OVERLAY_RAMPS: Record<'water'|'food'|'risks'|'coverage'|'desirability', readonly number[]> 5-step view-only ramps consumed only by the MainScene overlay layer"
      min_lines: 15
    - path: index.html
      provides: "CSS for .hud-control-bar, .advisor-drawer/.advisor-tab(.active), .overlay-bar/.overlay-toggle(.active), .overlay-legend, .hud-popup .inspector-nav, and .hud-build-btn:disabled — reusing the existing umber/bronze/gold tokens + legacy frozen sizes; new horizontal padding normalized to 12px"
      min_lines: 60
    - path: tests/unit/water-overlay.test.ts
      provides: "NEW — getWaterOverlay() aggregates 2+ wells/fountains (wellCoverage/fountainCoverage), grids sized width×height, aqueductPresent/aqueductFlow/reservoirFilled/reservoirLevel all-zero, houseWaterClass never reads 3 (grand), deterministic identical output across identical runners"
      min_lines: 60
    - path: tests/unit/advisor-composer.test.ts
      provides: "NEW — advisorPanels returns exactly 13 panels in UI-SPEC order; every panel value traces to a runner getter (finance.balance === getFinanceAdvisor().balance, ratings.culture === getDerived().culture, ...); empty-city totality (no throw, 13 panels, no-data flags)"
      min_lines: 70
    - path: e2e/management-ui.spec.ts
      provides: "NEW — control-bar buttons open their surfaces, build-disabled vs state.treasury, advisor tab switching + live values, overlay toggle → legend + heatmap + click-through→inspector, unaffordable button toBeDisabled; errors console/pageerror asserted empty at the end"
      min_lines: 90
    - path: tests/unit/advisors.test.ts
      provides: "extended inspectors block — enriched (internals) calls assert the rich fields (civic, safety, walker path/origin, house level/satisfiedTicks) toMatchObject while the original minimal calls keep passing"
      min_lines: 30
    - path: e2e/inspect.spec.ts
      provides: "extended — 5 inspector kinds open on click with the enriched fields visible, inspector-next/inspector-prev cycle same-kind entities, popup-close closes"
      min_lines: 40
  key_links:
    - "getWaterOverlay() ↔ waterOverlayData(WaterOverlayInput): the runner getter must assemble WaterOverlayInput from this.buildings.filter((b) => b.type === 'well' || b.type === 'fountain') via WaterSystem.setSources + compute(width,height,() => 0) and pass aqueductTiles: new Set(), flowing: new Set(), reservoirStates: [] — NEVER read getDerived().water (first-well-only counts, no grid); verified by tests/unit/water-overlay.test.ts (18-03-01)."
    - "advisorPanels(source) ↔ runner getters: each panel maps to its ACTUAL getter name — finance→getFinanceAdvisor, production/logistics→getProductionAdvisor+getLogisticsAdvisor, trade→getTradeAdvisor+getTradeRoutes, labor→getEmployment, governance→getGovernance, diplomacy→getRequests+getEvents, objectives→getMission/getMissionProgress/getCampaignProgress, religion→getDerived().godWorship+getFestival, safety/risks→getDerived()+getCivilizationOverlay(), housing→state.buildings+foodOverlayGrids, demography/ratings/labor/finance/religion base→advisorsFrom(snapshot) — a string-keyed call like advisorsFrom('labor') does not compile (research Pitfall 1); verified by tests/unit/advisor-composer.test.ts (18-02-01)."
    - "enriched *Inspection ↔ getWalkerInternals(): SimInternals.buildingById/buildings/walkers (runner.ts:2501-2503, simInternals() 3011-3049) feeds the additive internals params (HouseInstance.level/satisfiedTicks/services/foodInventory/civic, BuildingSafetyState fire/danger/collapseRisk/crime, ProductionState inputs/output/active/blocked, WalkerInstance.path/origin/carriedAmount/trade.waitTicks) — NEVER by growing toBuildingState/toWalkerState (runner.ts:3065-3122) or the BuildingState/WalkerState interfaces, or the golden-byte determinism suites fail (18-04-01)."
    - "Overlay heatmap layer (MainScene) ↔ input: draw the Graphics below building depths (setDepth < building depths), keep the single pointerup → tileAtPointer → emitInspect path (MainScene.ts:224-245,461-471), and never touch the wheel/drag handlers (MainScene.ts:211-261) — e2e asserts zoom/pan still work with an overlay active (18-03-02)."
    - "Every HUD surface ↔ tick-change guard (HUDScene.ts:37-41): the control bar, drawer panel, overlay bar, log focus and inspector popup all render from inside the existing `if (state.tick === this.lastTick) return` block so identical-tick frames skip — the 'tick-stale' state is never a visible spinner (18-01-01)."
---
<objective>
Deliver Phase 18 — wire the complete Management UI onto the deterministic sim core: every central control with a real handler and no decorative buttons (UI-01), a 13-advisor drawer where each advisor reads live sim queries and updates under the tick-change guard with a real open action (UI-02), a Phaser overlay bar with legends, heatmaps and click-through for water/food/risks/coverage/desirability (UI-03), and five richer inspectors (residence, productive building, storage-granary, market, walker) opened on click with close/Next navigation (UI-04).

Purpose: this is a **view-layer integration** over an essentially complete sim core. The existing HUDScene already wires every current control (stats, build palette + category tabs, policy sliders, message log, pause, speed, save/restart, toast, popup) under the tick-change guard — the gap is the NEW surfaces: a control bar (Advisors/Overlays/Messages), the advisors drawer, the overlay bar + heatmap layer, and enriched inspectors. The sim work is small and surgical: add `getWaterOverlay()` (the only UI-SPEC-cited getter that does not exist — the runner caches no water grid today), aggregate the `derivedSnapshot()` water coverage over ALL well/fountain sources so the HUD % agrees with the overlay, and add a read-only inspector seam so the enriched pure `*Inspection` projections can be fed `getWalkerInternals()` internals without growing the serialized `BuildingState`/`WalkerState` (golden-byte constraint). The high-risk items are (a) composing the 13 advisors from the REAL getter surface (research Pitfall 1 — `advisorsFrom` returns 8-9 datasets, not 13, and string-keyed calls do not compile), (b) feeding the water overlay (Pitfall 2/4), (c) never breaking the golden determinism (Pitfall 3), and (d) keeping overlays from hijacking camera/click-through (Pitfall 7). The UI is view-only: every value rendered comes from `getState()`/`getDerived()`/runner getters/pure projections — never duplicated or mutated sim state.
Output: `src/game/advisors.ts` (13-advisor pure composer), `getWaterOverlay()` + inspector seam in `src/sim/runner.ts`, enriched `*Inspection` projections in `src/sim/advisors.ts`, the control bar/drawer/overlay bar/5 inspector popups in `HUDScene.ts`, the overlay heatmap layer + keyboard + click-through in `MainScene.ts`, `OVERLAY_RAMPS` in `src/game/palette.ts`, new CSS in `index.html`, one new unit test per pure seam (`advisor-composer.test.ts`, `water-overlay.test.ts`), an extended `advisors.test.ts` inspectors block, a new `e2e/management-ui.spec.ts`, and an extended `e2e/inspect.spec.ts`.
</objective>

<execution_context>
@/Users/filipe.esch/projects/pessoal/opencaesar/.opencode/gsd-core/workflows/execute-plan.md
@/Users/filipe.esch/projects/pessoal/opencaesar/.opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/18-management-ui/18-CONTEXT.md
@.planning/phases/18-management-ui/18-RESEARCH.md
@.planning/phases/18-management-ui/18-PATTERNS.md
@.planning/phases/18-management-ui/18-UI-SPEC.md
@.planning/phases/18-management-ui/18-VALIDATION.md

# Sim-core seams (read before implementing the matching wave):
@src/sim/runner.ts
@src/sim/advisors.ts
@src/sim/types.ts
@src/sim/water.ts
@src/sim/walkers.ts

# View layer (read before editing the matching wave):
@src/game/scenes/HUDScene.ts
@src/game/scenes/MainScene.ts
@src/game/palette.ts
@index.html

# Tests (read before editing the matching wave scaffolds):
@tests/helpers.ts
@tests/unit/advisors.test.ts
@tests/runner-accessors.test.ts
@e2e/helpers.ts
@e2e/inspect.spec.ts
</context>

# Execution order (waves are sequential; tasks within a wave run in listed order — shared files force sequential edits):

- **Wave 0** — validation test scaffolds: NEW `tests/unit/advisor-composer.test.ts` (13-advisor composer), NEW `tests/unit/water-overlay.test.ts` (`getWaterOverlay`), NEW `e2e/management-ui.spec.ts` (control bar / advisors drawer / overlay toggles / inspectors / build-disabled via `data-testid` + `?test&seed=1337` + `__cityApi`), EXTEND `tests/unit/advisors.test.ts` (inspectors block, enriched calls). Extensions and the new unit files are RED until their implementing waves (write them against the TARGET API surface).
- **Wave 1 (UI-01)** — control bar + build-disabled. 18-01-01 (tracer) first: the new control bar (Advisors/Overlays/Messages) with every button a real handler dispatching through the event bus, build-button unaffordable-disabled, and the `management-ui` e2e control-bar + disabled cases flip green — the thinnest end-to-end slice proving the whole DOM→event→surface→e2e architecture. 18-01-02 completes UI-01 with the drawer/overlay-bar/legend/inspector panel-frame CSS in `index.html` plus the no-decorative-button audit gate.
- **Wave 2 (UI-02)** — advisors. 18-02-01 creates the pure 13-advisor composer `src/game/advisors.ts` (`advisorPanels`) mapped by actual getter names and flips `advisor-composer.test.ts` green. 18-02-02 renders the advisors drawer (tabs + one live panel under the tick-change guard + real open actions) in `HUDScene.ts` and flips the e2e advisor drawer cases green.
- **Wave 3 (UI-03)** — overlays. 18-03-01 adds `getWaterOverlay()` to the runner (aggregate ALL well/fountain sources; reservoir/aqueduct/flow grids 0) + aggregates `derivedSnapshot()` water and flips `water-overlay.test.ts` green. 18-03-02 builds the overlay bar (5 toggles + None, keyboard W/F/R/C/D/X), the Phaser heatmap layer (tile grids, heatmaps, legends, click-through → inspector) for water/food/civilization/coverage/desirability, and flips the e2e overlay cases green.
- **Wave 4 (UI-04)** — inspectors. 18-04-01 enriches the 5 pure `*Inspection` projections (residence/production/storage/market/walker) to rich fields fed via `getWalkerInternals` (never grow serialized state) + adds the `getInspector(id)` seam, flipping the extended `advisors.test.ts` inspectors block green. 18-04-02 renders the 5 inspector popups with close/Next in `HUDScene.ts` and flips the e2e inspector cases green (extend `inspect.spec.ts` + `management-ui.spec.ts`).
- **Wave 5 (close)** — 18-05-01 runs the full suite + typecheck + `check:military` green with no golden regeneration as the phase gate.

# Locked decisions honored (18-CONTEXT.md §§HUD & Controls / 13 Advisors / Overlays & Inspectors + RESEARCH):
- Every central button has a real handler wired to a SimRunner command or scene action (UI-01). DOM-backed controls follow the existing HUDScene pattern (`buildDom`/`wireEvents`, `data-testid`).
- HUD reads `runner.getState()`/`getDerived()` each frame with the tick-change guard (`if (state.tick === this.lastTick) return`) and renders the message log, speed controls, pause/resume, stats summary; the new surfaces render from the same guard.
- All 13 advisors read live sim queries each frame; the advisor projection layer (`src/sim/advisors.ts`) + dedicated runner getters are the single source; the HUD renders each advisor's dataset into a panel; each panel has a real "more detail / open inspector / locate" action. The 13-advisor set is COMPOSED (research Pitfall 1) — a string-keyed `advisorsFrom('name')` does not load.
- Overlays are pure projections over live state (deterministic, never in `getState()`); toggled via keyboard/HUD buttons; heatmap color ramps defined in the UI (view-only); each overlay has a legend and click-through (clicking a tile selects/advances to that building/entity via `emitInspect`).
- Inspectors open on click, render the existing pure `*Inspection` functions enriched by `getWalkerInternals()` internals (never adding fields to `BuildingState`/`WalkerState` — golden byte-equality), with close/next buttons.
- The agent's Discretion (layout/panel arrangement, tab organization, toggle keys, color ramps, popup styling) is resolved concretely in each task and stays consistent with the existing HUDScene DOM + Phaser mix, functional not pixel-perfect.
- Deferred ideas: none — discussion stayed in phase scope.

# Multi-source coverage audit (all COVERED):
- GOAL (HUD/13 advisors/overlays/inspectors wired) → Wave 1 (control bar + build-disabled) + Wave 2 (13 advisors) + Wave 3 (overlays) + Wave 4 (inspectors); success criterion 1 (no decorative button) → 18-01-01/02 audit + e2e; criterion 2 (13 advisors live) → 18-02-01/02; criterion 3 (overlays + inspectors with legends/heatmaps/click-through) → 18-03-01/02 + 18-04-01/02.
- REQ UI-01 (HUD every control wired) → Wave 1. REQ UI-02 (13 advisors live) → Wave 2. REQ UI-03 (overlays legends/heatmaps/click-through) → Wave 3. REQ UI-04 (5 inspectors) → Wave 4. Every UI-01..04 ID appears in this plan's frontmatter `requirements`.
- RESEARCH: `getWaterOverlay()` missing → 18-03-01; advisorsFrom 8-9 not 13 → 18-02-01 composer; golden-byte constraint → 18-04-01 (guard in `<verify>`); derived water first-well aggregation → 18-03-01; overlay must not hijack camera/click-through → 18-03-02 (e2e assert); textContent over innerHTML for sim-derived strings → every HUD task + T-18-01.
- CONTEXT: every locked decision above has a task (traced in the task actions); discretion areas (panel layout, tab order, toggle keys, ramps, popup styling, composer location `src/game/advisors.ts`) are resolved concretely.
- Exclusions checked: no deferred ideas; items scoped to other phases (full sidebar redesign → Phase 20; limit-evolution control → Phase 19/20) are out of scope here.
<tasks>

<!-- ===================== WAVE 0 — validation test scaffolds ===================== -->

<task type="auto">
  <name>Task 18-00-01: Wave 0 — create/extend validation test scaffolds (advisor-composer, water-overlay, management-ui e2e, advisors inspectors block)</name>
  <files>tests/unit/advisor-composer.test.ts, tests/unit/water-overlay.test.ts, e2e/management-ui.spec.ts, tests/unit/advisors.test.ts</files>
  <read_first>
    - tests/unit/advisors.test.ts:54-70 (the advisorsFrom(snap) fixture + dataset-assertion style to reuse for the composer test), :144-152 (the inspectors block to EXTEND)
    - tests/runner-accessors.test.ts:10-41 (SimRunner-accessor test style: new SimRunner(seed, map), place via helpers, tick, assert getter shape)
    - tests/helpers.ts:12-24 (runScenario + place helpers), :26-55 (foodChainMap/buildFoodCity)
    - tests/unit/water.test.ts:1-30 (WaterSystem usage + TileWater/waterClassAt assertions to mirror for the runner getter test)
    - e2e/helpers.ts:5-61 (Window.__cityApi declaration, openGame('/?test&seed=1337'), placeOn, runTicks, getState, zoomOut, tileCenter, pickTile, toastText)
    - e2e/inspect.spec.ts:4-21 (place house → click → building-popup assert pattern) and e2e/placement.spec.ts:159-170 (button click → active class → sim effect)
    - 18-RESEARCH.md Validation Architecture (Wave 0 Gaps + Phase Requirements → Test Map) + 18-VALIDATION.md
  </read_first>
  <action>
    Create the validation scaffolds as RED tests pinned to the Phase-18 target APIs (they fail until Waves 1-4 implement the features — expected, and how the Nyquist gate tracks them). Write against the TARGET surface, not today's surface.

    1. NEW tests/unit/advisor-composer.test.ts (REQ UI-02). Target import: { advisorPanels } from '../../src/game/advisors'. Build runners with new SimRunner(seed, foodChainMap()) + buildFoodCity + ticks. Assert: (a) advisorPanels(r) returns exactly 13 panels in the UI-SPEC locked order [ratings, finance, food, production-logistics, labor, trade, housing, demography, safety-risks, religion, governance, diplomacy, objectives]; (b) field provenance — finance panel's balance equals r.getFinanceAdvisor().balance, ratings panel's culture equals r.getDerived().culture, trade totals equal r.getTradeAdvisor() totals, each panel carries a non-null action descriptor (the target action shape: open-inspector | locate | open-overlay | open-codex); (c) empty-city totality — advisorPanels(new SimRunner(seed)) does not throw, still returns 13 panels, and panels with no data carry a no-data flag.
    2. NEW tests/unit/water-overlay.test.ts (REQ UI-03). Target: SimRunner.getWaterOverlay(). Build two separate wells (place(r,'well',x,y) on foodChainMap or an all-earth map) that do not overlap, tick a few steps, then assert r.getWaterOverlay(): (a) wellCoverage[well.y][well.x] === 1 for BOTH wells (aggregation — this getter must not use find()-style first-source semantics) and a fountain variant (place(r,'fountain',...)) lands in fountainCoverage; (b) every returned grid has length === state.height and every row length === state.width; (c) aqueductPresent/aqueductFlow/reservoirFilled/reservoirLevel are all-zero across the whole grid (systems unwired); (d) houseWaterClass values never exceed 2 (grand is never emitted); (e) determinism — two identical runners (same seed + same commands + same ticks) return JSON-equal getWaterOverlay(). Target typed as Record<string, number[][]>.
    3. NEW e2e/management-ui.spec.ts (REQ UI-01..04). Import { openGame, getState, placeOn, runTicks, zoomOut, tileCenter, pickTile } from './helpers' and { BUILDINGS } from '../src/sim/buildings'. Wire page.on('pageerror')/page.on('console') into an errors array asserted toEqual([]) at the end (placement.spec.ts precedent). Cases: (a) control bar — controls-advisors, controls-overlays, controls-messages exist and clicking controls-advisors makes the advisors drawer (data-testid="advisor-drawer") visible, controls-overlays makes the overlay bar (data-testid="overlay-bar") visible; (b) build-disabled — for each BUILD_ORDER type (build-<type> data-testid), expectedDisabled = BUILDINGS[type].cost > (await getState(page)).treasury, assert toBeDisabled()/not.toBeDisabled() accordingly, then runTicks(120) (wages spend treasury) and re-assert at least one button flips disabled (unaffordable state is live); (c) advisors drawer — advisor-tab-<id> buttons switch the active panel and the active tab carries the .active class; (d) overlay — clicking overlay-water shows the legend (data-testid="overlay-legend") and clicking a highlighted tile opens the building-popup (click-through); (e) inspector — placing a house and clicking it opens building-popup with inspector-prev/inspector-next visible. These target the Phase-18 data-testids.
    4. EXTEND tests/unit/advisors.test.ts inspectors block (REQ UI-04), keeping the existing minimal asserts (:146-150) intact. Add an enriched describe: build a runner city, pull internals via r.getWalkerInternals() (SimInternals.buildingById / .buildings / .walkers) and assert each enriched *Inspection call with the internals param returns the RICH fields toMatchObject — residenceInspection(..., house) → .level/.satisfiedTicks/.foodInventory/.civic present and the safety block (fire/danger/collapseRisk/crime) appended from the internals; productionInspection(..., productionInternals) → .blocked/.bottleneck; walkerInspection(..., walker) → .type/.origin/.path/.carriedAmount. The exact enriched signatures are the target API (Wave 4); write these against the planned additive param shape.
    These scaffolds intentionally reference APIs delivered later (advisorPanels, getWaterOverlay, getInspector, enriched *Inspection internals params, control-bar/drawer/overlay-bar/inspector data-testids). They are expected RED until the implementing tasks flip them green.
  </action>
  <verify>
    <human-check>Wave 0 is complete when all four files exist/extend and target the Phase-18 APIs; the new/extended cases are expected RED until the implementing tasks flip them green.</human-check>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && test -f tests/unit/advisor-composer.test.ts && test -f tests/unit/water-overlay.test.ts && test -f e2e/management-ui.spec.ts && npm run typecheck</automated>
  </verify>
  <acceptance_criteria>tests/unit/advisor-composer.test.ts and tests/unit/water-overlay.test.ts and e2e/management-ui.spec.ts exist and are discovered by the vitest/playwright include globs; tests/unit/advisors.test.ts carries the enriched-inspector target-surface cases; typecheck still passes on the written test code.</acceptance_criteria>
  <done>The four test files carry the Phase-18 target-surface scaffolds (advisor-composer + water-overlay unit tests NEW, management-ui e2e NEW, advisors.test.ts inspectors block extended), are discovered by the runners, typecheck-clean, and are RED only where their implementing waves have not yet landed.</done>
</task>

<!-- ===================== WAVE 1 (UI-01) — control bar + build-disabled ===================== -->

<task type="tracer">
  <name>Task 18-01-01: Tracer — control bar (Advisors/Overlays/Messages) with real handlers + build-button unaffordable-disabled (one UI-01 surface wired end-to-end)</name>
  <files>src/game/scenes/HUDScene.ts, src/game/scenes/MainScene.ts, index.html, e2e/management-ui.spec.ts</files>
  <read_first>
    - src/game/scenes/HUDScene.ts:37-41 (tick-change guard), :77-138 (buildDom — the createElement + data-testid recipe), :224-275 (wireEvents — event-bus wiring + the main?.setX handler pattern), :319-360 (renderPopup — the DOM pattern to extend)
    - src/game/scenes/MainScene.ts:144-178 (setBuildMode/setPaused/setSpeed), :224-245 (pointerup → tileAtPointer → emitInspect)
    - index.html (the current HUD CSS block to extend: .hud-panel/.hud-build-btn/.home-btn:disabled tokens)
    - e2e/helpers.ts (openGame/placeOn/runTicks/zoomOut/tileCenter/pickTile) and the management-ui.spec.ts control-bar + build-disabled cases scaffolded in 18-00-01
  </read_first>
  <behavior>
    - Test 1: clicking controls-advisors opens the advisors drawer (data-testid="advisor-drawer" becomes visible) inside the live game; clicking controls-overlays shows the overlay bar (data-testid="overlay-bar"); controls-messages adds a focus class to the message log — every control-bar button round-tripped through a real handler (e2e management-ui.spec.ts).
    - Test 2: for each build button, disabled === (BUILDINGS[type].cost > state.treasury); after runTicks the disabled set tracks the live treasury (e2e).
    - Test 3: HUD.update() still skips same-tick frames — opened surfaces do not re-render when state.tick is unchanged.
  </behavior>
  <action>
    Wire the NEW control bar and the build-button unaffordable-disabled state (decision UI-01; the thinnest UI-01 slice proven end-to-end before the advisors/overlays/inspector expansion):

    1. HUDScene.buildDom(): after the speedRow/pauseBtn, append a control bar div (className "hud-control-bar", the new panel) with three buttons:
       - Advisors — data-testid "controls-advisors", text "Advisors", click → this.toggleAdvisorsDrawer() (an instance flag this.drawerOpen) that toggles the advisors drawer element (data-testid "advisor-drawer") visible/hidden and emits 'advisor-open' on this.game.events with the open state; the drawer itself is a frame div (built here with a heading "Advisors" + a tab host + panel host, empty content) filled by 18-02-02.
       - Overlays — data-testid "controls-overlays", click → toggles the overlay bar element (data-testid "overlay-bar", a frame div with an "Overlays" heading + a None + 5-toggle host) and emits 'overlay-toggle' with the open state; the toggle buttons are filled by 18-03-02.
       - Messages — data-testid "controls-messages", click → adds/removes an "active" class on the log panel (focus the message log) and scrolls the log list to the newest entry; a real scene-side effect.
       Store them in this.els (controlBar, advisorsDrawer, overlayBar, log). Every label is static text set via textContent — never innerHTML interpolation.
    2. HUDScene.wireEvents(): the per-button addEventListener in buildDom is the existing pattern (MainScene.setPaused/setBuildMode/setSpeed are the precedents); the buttons call real methods or toggle real scene-owned surfaces — no button is decorative.
    3. HUDScene.update(): inside the existing tick-change guard, after the stats/log rendering, set each build button's disabled state every tick from state.treasury < BUILDINGS[type].cost (BUILDINGS already imported), only when changed to avoid layout thrash. Add the unaffordable rule in index.html: .hud-build-btn:disabled { opacity: 0.5; cursor: default; } (copy the .home-btn:disabled rule at index.html:313-316).
    4. index.html: add the .hud-control-bar and skeletal .advisor-drawer/.overlay-bar frame rules reusing the existing umber/gold/bronze tokens (the full panel-frame CSS arrives in 18-01-02; here only what the show/hide needs).
    5. Flip green the management-ui.spec.ts control-bar (a) + build-disabled (b) cases scaffolded in 18-00-01 (the advisor-tab/overlay/inspector cases stay RED until their waves).
    Discretion resolved here (per CONTEXT §the agent's Discretion): the control bar sits at the bottom of the HUD column above the speed row; the drawer/overlay-bar are bottom-center overlay panels opened by these buttons; Messages focuses the existing log rather than a new surface.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx playwright test e2e/management-ui.spec.ts -g "controls|build-disabled"</automated>
  </verify>
  <acceptance_criteria>controls-advisors/controls-overlays/controls-messages each dispatch a real handler that visibly toggles its surface (drawer/overlay bar/log focus) in the live game; every build button is disabled when state.treasury &lt; BUILDINGS[type].cost and re-evaluates on tick; the control-bar + build-disabled e2e cases pass and same-tick frames are still skipped.</acceptance_criteria>
  <done>The control bar is wired end-to-end (Advisors/Overlays/Messages buttons → real handlers → visible surfaces under the tick-change guard), the build palette shows a live unaffordable-disabled state, and the management-ui e2e proves both with zero page errors.</done>
</task>

<task type="auto">
  <name>Task 18-01-02: Panel-frame CSS for drawer/overlay-bar/legend/inspector + no-decorative-button audit gate</name>
  <files>index.html, src/game/scenes/HUDScene.ts, e2e/management-ui.spec.ts</files>
  <read_first>
    - index.html:43-239 (the existing .hud-panel/.hud-subtitle/.hud-build-btn/.hud-log/.hud-popup/.home-btn rule block to extend), :313-316 (.home-btn:disabled)
    - 18-UI-SPEC.md Spacing Scale (multiples-of-4; new horizontal padding normalized to 12px; frozen legacy headline sizes .hud-title 15px/.hud-overlay-title 20px/.home-title 34px), Color (umber/bronze/gold/muted-gold tokens), Component States (advisor tab active gold, overlay toggle active gold + shortcut badge, inspector nav disabled when none)
  </read_first>
  <action>
    Ship the reusable panel CSS the later waves fill, and add a hard gate proving UI-01's no-decorative-button success criterion (decision UI-01):

    1. index.html: add (all reusing existing tokens — umber panels rgba(40,28,14,0.9), bronze border #7a6234, gold #e8c46b, muted gold #b39a62, button fill #4a3517/hover #5d4420/active #7a5c22):
       - .advisor-drawer (bottom-center overlay panel, max-height + overflow-y auto), .advisor-tab (32px min-height, horizontal-scrolling tab bar with overflow-x auto) and .advisor-tab.active (gold underline/fill);
       - .overlay-bar (bottom-center panel) and .overlay-toggle (32px min-height) + .overlay-toggle.active (gold + shortcut badge);
       - .overlay-legend (bottom-right hud-subtitle-style panel, ramp swatch rows);
       - .hud-popup .inspector-nav (◀/▶ row) and its :disabled state;
       - .hud-build-btn:disabled (from 18-01-01 if not yet present).
       New horizontal padding normalized to 12px; do NOT change the frozen legacy headline sizes.
    2. HUDScene.buildDom(): give the drawer/overlay-bar frames and the inspector-nav host their data-testids and class hooks now (advisor-drawer, overlay-bar, overlay-legend host, inspector-prev/inspector-next placeholders to be populated in 18-04-02) so later waves slot DOM in without restructuring.
    3. No-decorative audit gate: extend e2e/management-ui.spec.ts with a case that loads the HUD and asserts every element matching '.hud-control-bar button, .hud-build-btn, .advisor-tab, .overlay-toggle' carries a non-empty data-testid AND every control-bar/drawer/overlay button's click has an observable effect (visibility class on its target surface, or an active class on itself) — compute each target's state before vs after the click and assert it changed; keep it deterministic with seed 1337.
    Discretion resolved here: exact spacing/ramp pixels follow the UI-SPEC tokens; the audit gate lives in e2e because HUD DOM wiring is not unit-tested (Phaser scene).
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx playwright test e2e/management-ui.spec.ts -g "decorative|panel-frame"</automated>
  </verify>
  <acceptance_criteria>index.html carries the drawer/overlay-bar/legend/inspector-nav/disabled rules on the existing token system; the HUD states the drawer/overlay-bar/legend/inspector-nav data-testid hooks; the e2e audit proves no HUD/control-bar/drawer/overlay button is decorative (every click has an observable effect).</acceptance_criteria>
  <done>UI-01 is complete: the reusable panel CSS + data-testid hooks exist for later waves, and an e2e gate proves no central/control-bar/drawer/overlay button is decorative.</done>
</task>
<!-- ===================== WAVE 2 (UI-02) — 13 advisors ===================== -->

<task type="auto">
  <name>Task 18-02-01: 13-advisor pure composer over the real getter surface (advisorsFrom + dedicated runner getters, mapped by actual names)</name>
  <files>src/game/advisors.ts, tests/unit/advisor-composer.test.ts</files>
  <read_first>
    - src/sim/advisors.ts:26-54 (SimSnapshot/AdvisorDataset types), :115-147 (advisorsFrom — the 8-9 base datasets: population/labor/finance/ratings/religion/health/education/entertainment + optional ratings-decomposition + constructionSpend folded into ratings; string-keyed calls do NOT compile)
    - src/sim/runner.ts:135-162 (DerivedSnapshot — population/culture/prosperity/stability/favor/employment/services/godWorship/water/fireRisk/collapseRisk/crime/decomposition/constructionSpend/annualExports), :1906 (getFinanceAdvisor), :1559 (getTradeAdvisor), :1512 (getProductionAdvisor), :1529 (getLogisticsAdvisor), :2224 (getEmployment), :2047 (getGovernance), :2190 (getRequests), :2397 (getMission), :2233 (getEvents), :1986 (getFestival), :1353 (getCivilizationOverlay), :1367 (getCivicStats), 18-RESEARCH.md Pitfall 1 (the composition rule)
    - 18-UI-SPEC.md Advisors Inventory (the 13 advisors, their live sources, and the locked tab order)
  </read_first>
  <behavior>
    - Test 1: advisorPanels(r) returns exactly 13 panels in the UI-SPEC locked order [ratings, finance, food, production-logistics, labor, trade, housing, demography, safety-risks, religion, governance, diplomacy, objectives]; a city with finance/employment data populates those panels from the live getters (advisor-composer.test.ts).
    - Test 2: field provenance — finance.balance === r.getFinanceAdvisor().balance, ratings.culture === r.getDerived().culture, labor.employed/totalJobs === r.getEmployment(), trade totals === r.getTradeAdvisor() totals, housing uses state.buildings houses; empty-city advises without throwing (13 panels, no-data flags).
    - Test 3: every panel carries a real action descriptor (open-inspector/locate/open-overlay/open-codex) so the HUD's "more detail" is wired (18-02-02 consumes it).
  </behavior>
  <action>
    Create the pure 13-advisor composition seam (decision UI-02; research Pitfall 1 — advisorsFrom returns 8-9 datasets by name, so the 13 must be COMPOSED from advisorsFrom + the dedicated runner getters, mapped by the ACTUAL method names, never string keys):

    1. NEW src/game/advisors.ts. Export a narrow source interface (e.g. AdvisorSource) typed as the subset of SimRunner the composer reads: getState/getDerived/getFinanceAdvisor/getTradeAdvisor/getTradeRoutes/getProductionAdvisor/getLogisticsAdvisor/getEmployment/getGovernance/getRequests/getMission/getMissionProgress/getCampaignProgress/getEvents/getFestival/getCivilizationOverlay/getCivicStats/getWaterOverlay/getWalkerInternals. Export a panel shape AdvisorPanel { id, title, rows: { label: string; value: string; tone?: 'ok'|'bad'|'muted' }[], alerts?: string[], action: { kind: 'open-inspector'; id: number } | { kind: 'locate'; id: number } | { kind: 'open-overlay'; overlay: OverlayId } | { kind: 'open-codex'; entryId: string } | null, noData?: boolean } and OverlayId = 'water'|'food'|'risks'|'coverage'|'desirability'.
    2. Export advisorPanels(source: AdvisorSource): AdvisorPanel[] returning exactly 13 panels in the UI-SPEC tab order. Build the 8 base datasets ONCE by constructing a SimSnapshot from source.getState()/getDerived() (population, treasury, taxRate, wageRate, hasReligion = derived.services.religion > 0, hasEntertainment = derived.services.entertainment > 0, hasEducation = derived.services.literacy > 0, hasHealth = derived.services.health > 0, hasWater = derived.water.coveredTiles > 0, hasFood = completed by monthsOfFood > 0 from foodAdvisorFromState, jobs = derived.employment.jobs, employed = derived.employment.employed, welfare: {}, godWorship = derived.godWorship, doctorCoverage = derived.services.health/100, educationCoverage = derived.services.literacy/100, entertainmentCoverage = derived.services.entertainment/100, decomposition = derived.decomposition, constructionSpend = derived.constructionSpend) and calling advisorsFrom(snapshot).
    3. Per panel (map each by the REAL getter):
       - finance → getFinanceAdvisor() (balance, monthly deficit, debt/interest, subsidy used, arrears, overflowDropped; tax/wage) with a locate/no-target action.
       - food → foodAdvisorFromState(state) + foodHudFromState(state) (months headline + per-food rows + bottlenecks/recommendations) action open-overlay 'food' + locate a starving house/granary.
       - production-logistics → getProductionAdvisor() rows+summary + getLogisticsAdvisor() (active/blocked/stopped counts, per-building rows) action open-inspector on a blocked row id.
       - labor → getEmployment() + state.assignedWorkers/totalJobs (employment %, unemployment, vacancies) action locate an unstaffed building.
       - trade → getTradeAdvisor() + getTradeRoutes() (totals + per-city rows) action open-inspector/locate a route building.
       - housing → state.buildings houses (tier, level, populationCapacity, desirability) + foodOverlayGrids(state) + getWaterOverlay() water classes (level distribution, vacancies, food/water readiness) action open-inspector on a selected house id + open-overlay 'water'.
       - ratings → advisorsFrom('ratings' by name) + derived four ratings + ratings-decomposition flattened (culture/prosperity/stability/favor + top +/- factor) action open-codex mission/objectives entry.
       - religion → derived.godWorship + advisorsFrom ('religion') + getFestival() (per-god worship, boost/festival state) action locate a temple.
       - safety-risks → derived.fireRisk/collapseRisk/crime + getCivilizationOverlay() grids (counts of buildings in danger/burning) action open-overlay 'risks' + locate a burning/danger building id.
       - governance → getGovernance() (unlocked/placed/effects + governor finances) action locate forum/senate/palatine.
       - diplomacy → getRequests() + getEvents() (active requests table with deadline + history + event log) action open-inspector/locate the request source.
       - objectives → getMission() + getMissionProgress() + getCampaignProgress() (mission title, objective progress, campaign next-unlocked) action open-codex mission entry.
       - demography → derived.population + state.ratings.population + house census (class via house.tier, per CONTEXT/research Q1 — no live residentClass field) + advisorsFrom ('population') action locate vacant/unhoused residences.
       Every value must come from the getter/snapshot — no fabricated numbers. Panels whose source data is empty (no buildings/walkers/missions/requests) set noData: true and keep the action or set it to null.
    4. Flip green the advisor-composer.test.ts cases (a/b/c) scaffolded in 18-00-01.
    Discretion resolved here: composer lives in src/game/advisors.ts (UI-side composition, pure function of the injected source) so the node-env vitest can import it without Phaser; exact row labels follow the UI-SPEC inventory.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/unit/advisor-composer.test.ts tests/unit/advisors.test.ts -x</automated>
  </verify>
  <acceptance_criteria>src/game/advisors.ts exports advisorPanels returning exactly 13 named panels in the UI-SPEC order, every panel's values trace to a real runner getter/snapshot (never string-keyed advisorsFrom, never fabricated), empty-city calls are total and no-throw; advisor-composer.test.ts passes; typecheck green.</acceptance_criteria>
  <done>The 13-advisor composition is a pure, tested seam (`advisorPanels` over `advisorsFrom` + the dedicated runner getters mapped by actual names) with a real action descriptor per panel, ready for the HUD drawer to consume.</done>
</task>

<task type="auto">
  <name>Task 18-02-02: Advisors drawer — 13 tabs + one live panel under the tick-change guard + real open actions</name>
  <files>src/game/scenes/HUDScene.ts, src/game/scenes/MainScene.ts, index.html, e2e/management-ui.spec.ts</files>
  <read_first>
    - src/game/scenes/HUDScene.ts:37-41 (tick-change guard — the drawer panel re-renders from here), :77-138 (buildDom recipe), :224-275 (wireEvents + event-bus patterns), :319-360 (renderPopup row(label,value) helper at :363-365 to reuse for panel rows)
    - src/game/advisors.ts (the advisorPanels shape from 18-02-01) and src/sim/runner.ts getters it calls (getMission/getMissionProgress/getCampaignProgress/getRequests/getGovernance/getFestival/getCivicStats/getEvents/getCivilizationOverlay/getProductionAdvisor/getTradeAdvisor/getLogisticsAdvisor/getFinanceAdvisor/getEmployment/getWaterOverlay/getWalkerInternals)
    - index.html (the .advisor-drawer/.advisor-tab rules from 18-01-02) and e2e/management-ui.spec.ts advisor cases scaffolded in 18-00-01
  </read_first>
  <behavior>
    - Test 1: clicking controls-advisors opens the drawer with 13 advisor-tab-<id> buttons; clicking a tab makes that panel's container visible with the .active class on the tab and renders live values from the composer (e2e management-ui.spec.ts).
    - Test 2: the active panel re-renders only when the sim tick advances — after runTicks(n) the panel text updates, while an unresolved identical-tick frame keeps the last snapshot (no spinner).
    - Test 3: each panel's action button dispatches a real scene effect (open-inspector → hud-inspect to that building id; open-overlay → overlay-toggle water/food/risks/coverage/desirability; open-codex → toast/codex-entry; locate → emitInspect at the entity) — verified by wiring the available actions and asserting at least the open-inspector and open-overlay paths land in the DOM (e2e).
  </behavior>
  <action>
    Render the 13-advisor drawer from the pure composer (decision UI-02), all surfaces under the existing tick-change guard:

    1. HUDScene.create(): keep a reference to this.main.runner; openGame '?test&seed=1337' already runs a live runner so advisorPanels(this.runnerAdapter()) has data after a few ticks.
    2. buildDom(): inside the advisor-drawer frame (from 18-01-01) build a tab host (horizontal scroll, overflow-x auto) and a panel host. For each of the 13 advisor ids in UI-SPEC order create a button.advisor-tab data-testid "advisor-tab-<id>" with the title textContent, and a panel div (hidden unless active). Default active tab: the advisor relevant to the newest critical/gold alert in state.messages (message type 'warning'/'house-devolved'/'building-inactive'), else ratings — the mapping heuristic falls back to ratings when ambiguous (research A5). The e2e asserts advisor-tab-<id> switches the visible panel.
    3. update(): inside the `if (state.tick === this.lastTick) return` guard, after stats, if this.drawerOpen and an active advisor is set, call a private renderAdvisor(this.main.runner) that invokes advisorPanels(runnerAdapter()), finds the active panel's rows/alerts, and rebuilds the panel DOM: every label/value/alert line is created via document.createElement + textContent (advisors are sim-derived strings — NEVER innerHTML interpolation; the renderLog precedent at HUDScene.ts:286-296). Preserve the row(label,value) helper convention.
    4. Actions: render each panel's action descriptor as a real <button> (action-open-<kind> data-testid): open-inspector → this.game.events.emit('hud-inspect', id) (opens the popup, w/ the inspector from 18-04-02); locate → emit the hud-inspect on that building id too (or a toast if no entity); open-overlay → this.game.events.emit('overlay-toggle', overlay) consumed by 18-03-02; open-codex → hud-toast with the entry name (the codex UI is already Phase 17; a toast is the concrete action this phase). If an action id is null, omit the button. Every button is real — none decorative.
    5. MainScene/props: add the this.game.events listeners for 'overlay-toggle'/'advisor-open' where needed (the HUD owns the drawer DOM; MainScene only consumes overlay-toggle in 18-03-02 — this task may just add the HUD-side listeners).
    6. index.html: ensure the .advisor-drawer/.advisor-tab/.advisor-tab.active rules from 18-01-02 are applied (adjsut if the drawer needs a max-height scroll).
    7. Flip green the management-ui.spec.ts advisors-drawer cases (advisor tabs + live values) scaffolded in 18-00-01.
    Discretion resolved here: drawer is bottom-center, tab bar scrolls horizontally when full; the tick-stale state is invisible (guard skips re-render) — no spinner.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx playwright test e2e/management-ui.spec.ts -g "advisor|drawer"</automated>
  </verify>
  <acceptance_criteria>the advisors drawer opens via controls-advisors showing 13 advisor-tab-<id> buttons; clicking a tab shows that panel with live composer data and the .active class; the active panel re-renders only on tick change; each panel's action button dispatches a real effect (open-inspector lands the popup, open-overlay emits overlay-toggle, open-codex toasts); the advisor e2e cases pass with zero page errors.</acceptance_criteria>
  <done>The 13-advisor drawer is live: tabs switch panels, every panel renders the composer's live read of the sim under the tick-change guard, and each panel's "more detail" action is a wired real handler.</done>
</task>
<!-- ===================== WAVE 3 (UI-03) — overlays ===================== -->

<task type="auto">
  <name>Task 18-03-01: Runner getWaterOverlay() aggregating ALL well/fountain sources + aggregate derivedSnapshot water coverage</name>
  <files>src/sim/runner.ts, tests/unit/water-overlay.test.ts</files>
  <read_first>
    - src/sim/runner.ts:1353-1362 (getCivilizationOverlay — the read-only getter shape to copy: assemble per-building inputs from this.buildings, feed the pure advisors.ts projection, return Record<string, number[][]>), :1316-1321 (the derivedSnapshot throwaway WaterSystem — currently find()-s the FIRST well/fountain; the pattern to aggregate), :1336 (derived.water = coveredTiles/totalTiles)
    - src/sim/water.ts:22-29 (WaterSource shape), :90-98 (WaterSystem.setSources + compute(width,height,pollutionAt))
    - src/sim/advisors.ts:169-176 (WaterOverlayInput), :194-237 (waterOverlayData — the keys sources/wellCoverage/fountainCoverage/houseWaterClass/aqueductPresent/aqueductFlow/reservoirFilled/reservoirLevel/desirability)
    - src/sim/types.ts:17-26 (BuildingType union — no 'reservoir'/'aqueduct', so those grids read 0)
    - 18-RESEARCH.md Pitfall 2 + 4 (getWaterOverlay absent; derived.water first-well divergence; option b = aggregate in derivedSnapshot)
  </read_first>
  <behavior>
    - Test 1: getWaterOverlay() with two non-overlapping wells paints wellCoverage=1 on BOTH source tiles (aggregation, not first-well); a fountain paints fountainCoverage (water-overlay.test.ts).
    - Test 2: every returned grid is width×height of state; aqueductPresent/aqueductFlow/reservoirFilled/reservoirLevel are all-zero; houseWaterClass never exceeds 2 (grand not emitted); two identical runners return JSON-equal overlays (determinism).
    - Test 3: derivedSnapshot aggregates ALL well/fountain sources so the HUD water % (getDerived().water) matches the overlay's coverage under multiple wells (buildings-catalog integration test still >0; no golden impact — derived.water is not in getState()).
  </behavior>
  <action>
    Add the water-overlay runner getter and align the derived water %, per decision UI-03 and research Pitfall 2/4 (the only UI-SPEC-cited getter that does not exist):

    1. runner.ts getWaterOverlay(): Record<string, number[][]> — copy the getCivilizationOverlay() shape (a read-only getter over this.buildings feeding a pure advisors.ts projection). Assemble a WaterSystem, setSources over ALL live water sources: this.buildings.filter((b) => b.type === 'well' || b.type === 'fountain').map((b) => ({ x: b.x, y: b.y, kind: 'well' as const, active: true, radius: 2 })) — NO find()-first semantics. Compute the grid: ws.compute(this.width, this.height, () => 0). Return waterOverlayData({ width: this.width, height: this.height, grid, aqueductTiles: new Set(), flowing: new Set(), reservoirStates: [] }) — the aqueduct/reservoir systems are not wired into the runner and reservoir is not a placeable BuildingType, so those grids are intentionally empty (research A3). Import waterOverlayData (and the WaterSystem type) into the runner's existing ./advisors import block (the runner already imports financeAdvisorFromState there).
    2. runner.ts derivedSnapshot() water block (currently a throwaway find()-first WaterSystem at :1316-1321): change the single well lookup to aggregate ALL well/fountain sources (same .filter/map as step 1) so derived.water.coveredTiles counts every source — the HUD water % (stats) and the water overlay (all sources) then agree (Pitfall 4 option b). This must NOT touch getState() (derived.water is not serialized) and must keep tests/integration/buildings-catalog.test.ts:90 (>0) satisfied.
    3. Flip green the water-overlay.test.ts cases (aggregation, bounds, zero aqueduct/reservoir, max class 2, determinism) scaffolded in 18-00-01.
    Discretion resolved here: the getter is pure read-only over live buildings (no caching — deterministic, cheap for a 40×40 grid), matching getCivilizationOverlay.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/unit/water-overlay.test.ts tests/integration/buildings-catalog.test.ts tests/determinism tests/golden -x</automated>
  </verify>
  <acceptance_criteria>getWaterOverlay() exists on the runner and aggregates ALL well/fountain sources (wellCoverage/fountainCoverage both painted), grids are width×height, aqueduct/flow/reservoir grids all-zero, houseWaterClass ≤ 2, identical runners return identical overlays; derivedSnapshot water coverage aggregates all sources with no getState() shape change and no golden regeneration.</acceptance_criteria>
  <done>The water overlay is fed by a real runner getter aggregating every live well/fountain source, empty aqueduct/reservoir grids are honored, the HUD water % agrees with the overlay, and the determinism/golden suites stay green.</done>
</task>

<task type="auto">
  <name>Task 18-03-02: Overlay bar + Phaser heatmap layer (tile grids, legends, click-through) for water/food/risks/coverage/desirability</name>
  <files>src/game/scenes/MainScene.ts, src/game/scenes/HUDScene.ts, src/game/palette.ts, index.html, e2e/management-ui.spec.ts, e2e/helpers.ts</files>
  <read_first>
    - src/game/scenes/MainScene.ts:344-359 (syncEntities — the per-frame Graphics rebuild pattern), :473-500 (updateGhost — the diamond-fill drawing primitive to reuse for heatmap tiles), :536-562 (tileTop + drawDiamond), :461-471 (emitInspect — the shared click-through path), :211-261 (wheel/drag handlers — MUST stay untouched)
    - src/game/scenes/HUDScene.ts:37-41 (tick guard), :319-360 (legend host + popup interaction)
    - src/game/palette.ts (BUILDING_COLORS/HOUSE_COLORS — add OVERLAY_RAMPS here), 18-UI-SPEC.md Overlays Inventory (5 overlays, shortcuts W/F/R/C/D + X None, legend ramps) and Color table (the exact ramp hexes)
    - src/sim/advisors.ts:570-604 (foodOverlayGrids), :255-278 (civilizationOverlayData via runner.getCivilizationOverlay), src/sim/runner.ts:1353-1362 (getCivilizationOverlay), :1367-1386 (getCivicStats per-house coverage)
    - e2e/helpers.ts:5-22 (extend Window.__cityApi with a getOverlay query if the heatmap needs e2e assert), e2e/management-ui.spec.ts overlay cases scaffolded in 18-00-01
  </read_first>
  <behavior>
    - Test 1: clicking overlay-water shows the legend (data-testid="overlay-legend") with the 5-step blue ramp and the Phaser layer draws a wellCoverage heatmap; clicking overlay-food swaps to the food legend; exactly one overlay is active (radio) and overlay-none (or X) clears to no legend (e2e).
    - Test 2: clicking a highlighted tile (a well/fountain/house under the water overlay) opens that building's inspector via the existing emitInspect path (e2e click-through).
    - Test 3: while an overlay is active, wheel-zoom and drag-pan still work (camera controls are not hijacked) — asserted by changing zoom via wheel and reading __cityApi.camera() (e2e).
  </behavior>
  <action>
    Render the 5 overlays as a Phaser heatmap layer below the buildings with legends and click-through, plus the overlay bar (decision UI-03; locked keyboard shortcuts):

    1. palette.ts: export OVERLAY_RAMPS: Record<'water'|'food'|'risks'|'coverage'|'desirability', readonly number[]> with the UI-SPEC 5-step hex ramps (water blues; food red→amber→green; risks umber→dark-red→gold on dark base; coverage per-service hues health #59c4ee/literacy #6aa5d6/entertainment #cf6fd1; desirability umber→green→gold). Convert hex→Phaser number at draw time. View-only — never imported by the sim.
    2. MainScene overlay layer: add a private overlay: OverlayId | null = null and an overlayGfx: Phaser.GameObjects.Graphics (created in create(), depth BELOW the building depths so buildings stay legible — setDepth(1) or a constant under the entity depths used in syncEntities). In update(), after syncEntities, if overlay is set call a private renderOverlay(state, overlayId) that clears the Graphics and, for each grid [y][x] of the active overlay's source projection, fills a diamond (reuse updateGhost's beginPath/moveTo/lineTo diamond with the ramp color chosen by quantizing the cell value into 5 bands; use fillStyle(ramp[band], 0.55)). Sources: water → runner.getWaterOverlay() (wellCoverage/houseWaterClass/desirability keys); food → foodOverlayGrids(state) (supplyDays + variety); risks → runner.getCivilizationOverlay() (fire/danger/collapse/crime); coverage → runner.getCivicStats() per-house health/literacy/entertainment projected per house tile; desirability → getWaterOverlay().desirability (or civilization desirability if present). If an overlay has no matching tile, still render the legend (research A3/zero-state copy).
    3. Keyboard (MainScene.create, extending the ESC handler block at :116-127): keydown W → setOverlay('water'), F → 'food', R → 'risks', C → 'coverage', D → 'desirability', X → setOverlay(null). setOverlay(id) stores the id, clears/rebuilds the layer next frame, emits this.game.events.emit('overlay-toggle', id) for the HUD legend, and emits hud-inspect null (close any open popup on a fresh overlay). Exactly one overlay active at a time (radio) — setting one clears the other; None is the default.
    4. Overlay bar (HUDScene, using the frame from 18-01-01/02): 5 toggle buttons data-testid "overlay-water"/"overlay-food"/"overlay-risks"/"overlay-coverage"/"overlay-desirability" + "overlay-none", each labeled with its name + shortcut glyph (no emoji — the existing unicode-glyph convention); click → this.game.events.emit('overlay-toggle', id) and MainScene.setOverlay handles it (single source of truth), toggling .active classes on the bar. The legend: a host element data-testid "overlay-legend" rendered/cleared on 'overlay-toggle' with the active overlay's ramp swatches + band labels, built via createElement + textContent (labels are static strings, safe).
    5. e2e/helpers.ts: extend Window.__cityApi with a camera:() already present — reuse it for the zoom-still-works assert; add a getOverlay/findGrid query ONLY if the spec needs to assert the layer tiles (otherwise the legend + click-through asserts suffice). e2e asserts per the cases in the behavior block.
    6. index.html: ensure .overlay-bar/.overlay-toggle(.active)/.overlay-legend rules (18-01-02) present.
    Discretion resolved here: overlay layer depth is a constant below building depths; ramps and keys follow UI-SPEC exactly; the legend labels are the band names from UI-SPEC.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx playwright test e2e/management-ui.spec.ts -g "overlay|water|food|risks|legend|click-through|zoom"</automated>
  </verify>
  <acceptance_criteria>the overlay bar toggles exactly one overlay at a time (radio) with keyboard W/F/R/C/D/X; each overlay draws a Phaser heatmap from its pure grid below the buildings with a rendered legend; clicking a highlighted tile opens the matching inspector through emitInspect; wheel-zoom and drag-pan keep working while an overlay is active; the overlay e2e cases pass with zero page errors.</acceptance_criteria>
  <done>The 5 overlays are live — heatmaps from pure grids, legends, radio toggle bar + keyboard, and click-through to inspectors — without breaking camera controls or the single click-inspect path.</done>
</task>
<!-- ===================== WAVE 4 (UI-04) — inspectors ===================== -->

<task type="auto">
  <name>Task 18-04-01: Enrich the 5 pure *Inspection projections to rich fields fed via getWalkerInternals (+ getInspector(id) seam)</name>
  <files>src/sim/advisors.ts, src/sim/runner.ts, tests/unit/advisors.test.ts</files>
  <read_first>
    - src/sim/advisors.ts:281-303 (the current minimal *Inspection stubs to enrich ADDITIVELY), :669-719 (productionAdvisorRows — the dual-input pattern: serialized state + an internal-notes param, fallback when absent)
    - src/sim/walkers.ts:28-63 (WalkerInstance: path/carriedAmount/origin/targetBuildingId/stepsTaken/trade.waitTicks), :88-122 (HouseInstance: level/satisfiedTicks/unsatisfiedTicks/combinedPopulation/services/godAccess/foodInventory/civic), :125-132 (HouseCivicState), :145-191 (BuildingInstance + BuildingSafetyState fire/danger/collapseRisk/crime), :197-224 (SimInternals)
    - src/sim/production.ts:105-112 (ProductionState: inputs/output/active/blocked)
    - src/sim/runner.ts:2501-2503 (getWalkerInternals()), :3011-3049 (simInternals() — buildingById), :3065-3122 (toBuildingState/toWalkerState — DO NOT EDIT), src/sim/types.ts:116-171 (BuildingState/WalkerState — DO NOT grow)
    - 18-RESEARCH.md Pitfall 3 + 5 (golden-byte constraint; residentClass has no live source → derive from house tier or keep the stub)
  </read_first>
  <behavior>
    - Test 1: every enriched *Inspection called with an internals param returns its RICH fields toMatchObject while the ORIGINAL minimal calls keep returning the same shape (extended advisors.test.ts inspectors block): residenceInspection(..., house) → level/satisfiedTicks/unsatisfiedTicks/foodInventory/civic plus safety fire/danger/collapseRisk/crime; productionInspection(..., production internals) → active/blocked/bottleneck/workers; storageInspection(..., detail) → reserved/in-transit rows; marketInspection(..., market internals) → workers/housesServed/enabled products; walkerInspection(..., walker) → type/origin/path/carriedAmount/waitTicks.
    - Test 2: the new getInspector(id) runner seam returns the building/walker snapshot + its SimInternals instance (or null for an unknown id) — used by the HUD popups; it is read-only and never touches toBuildingState/toWalkerState.
    - Test 3: golden / determinism suites stay green — getStateJson() is byte-identical (the inspectors only READ internals, never serialize them).
  </behavior>
  <action>
    Enrich the inspector projections without growing the serialized shape (decision UI-04; research Pitfall 3 — the internals live on BuildingInstance/HouseInstance/WalkerInstance reachable via runner.getWalkerInternals(), NEVER on BuildingState/WalkerState):

    1. advisors.ts — make each *Inspection ADDITIVE: keep the existing positional params the current tests call (so tests/unit/advisors.test.ts:146-150 stay green) and append an optional internals param. Signature guidance:
       - residenceInspection(population, capacity, residentClass, services, goods, internals?: { house?: HouseInstance; safety?: BuildingSafetyState; happiness?: number; desirability?: number; evolution?: { eligible: boolean; missing: string[] } }): append house.level / levelName / satisfiedTicks / unsatisfiedTicks / foodInventory (from HouseInstance), civic (health/literacy/entertainment from HouseInstance.civic), services TTLs (house.services / godAccess), safety (fire/danger/collapseRisk/crime from BuildingSafetyState), happiness + desirability, and evolution eligibility via the HOUSING_LEVELS catalog + requirementsSatisfied() from src/sim/housingEvolution. residentClass stays tier-derived (palatium/high tiers → patrician) per research Q1 — mark the derivation; do not block on a live class field.
       - productionInspection(inputs, output, status, internals?: { production?: ProductionState; workersAssigned?: number; workersRequired?: number; active?: boolean; laborConnected?: boolean; roadAccess?: boolean; destination?: string | null; distance?: number }): append active/blocked/bottleneck (from ProductionState + the status string), workers assigned/required, road & labor access, destination + distance when present.
       - storageInspection(stock, usedSlots, capacity, internals?: { reserved?: Record<string, number>; inTransit?: Record<string, number>; perProduct?: Record<string, { stored: number; cap: number }> }): append reserved/in-transit/per-product rows when the internals carry them.
       - marketInspection(inventory, buyerRadius, internals?: { workersAssigned?: number; housesServed?: number; enabled?: string[]; demand?: number; buyers?: number; sellers?: number }): append workers/houses-served/enabled-products/buyer-seller activity when present.
       - walkerInspection(id, x, y, status, stepsUsed, maxSteps, internals?: WalkerInstance): append type/origin/path (steps remaining), carriedAmount (or carryingLoad for sellers), targetBuildingId, serving info, trade.waitTicks when present. All appended fields are optional — the projection stays total (never throws on absent internals).
    2. runner.ts getInspector(id: number): { kind: 'building' | 'walker'; snapshotId: number; building?: BuildingState; walker?: WalkerState; internals?: BuildingInstance | WalkerInstance } | null — a thin read-only seam: resolve the id via this.buildingById (building) or this.walkers (walker), return the serialized snapshot + the live internal instance; null for unknown. It only READS — it must not call toBuildingState/toWalkerState and must not mutate.
    3. Flip green the extended advisors.test.ts inspectors block (enriched toMatchObject cases) scaffolded in 18-00-01 — using internals pulled from r.getWalkerInternals() (SimInternals.buildingById/.buildings/.walkers).
    Discretion resolved here: the internals params are additive + optional so existing call sites and tests compile unchanged; evolution eligibility uses the existing data-driven HOUSING_LEVELS (don't-hand-roll per research).
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/unit/advisors.test.ts tests/golden tests/determinism -x</automated>
  </verify>
  <acceptance_criteria>each *Inspection keeps its original minimal behavior and gains an optional internals param producing the rich fields (house evolution/civic/safety, production blocked/bottleneck, storage reserved/in-transit, market activity, walker path/origin/carriedAmount); getInspector(id) returns the snapshot + internals (null for unknown) read-only; golden and determinism suites stay byte-identical green.</acceptance_criteria>
  <done>The 5 inspector projections are enriched with rich live fields fed by getWalkerInternals() (never serialized), served by a thin read-only getInspector(id) seam, with zero golden/determinism impact.</done>
</task>

<task type="auto">
  <name>Task 18-04-02: 5 inspector popups (residence/productive/storage/market/walker) with close × + Next ◀/▶ cycling</name>
  <files>src/game/scenes/HUDScene.ts, src/game/scenes/MainScene.ts, index.html, e2e/management-ui.spec.ts, e2e/inspect.spec.ts</files>
  <read_first>
    - src/game/scenes/HUDScene.ts:319-360 (renderPopup — to evolve into the 5 inspector layouts), :306-310 (closePopup), :363-365 (row(label,value) helper), :224-245 (pointerup inspect path in MainScene)
    - src/sim/advisors.ts (the enriched *Inspection signatures from 18-04-01) and src/sim/runner.ts getInspector(id)
    - index.html (the .hud-popup .inspector-nav rules from 18-01-02), e2e/inspect.spec.ts + e2e/management-ui.spec.ts inspector cases scaffolded in 18-00-01
  </read_first>
  <behavior>
    - Test 1: clicking a house opens the residence inspector popup showing the enriched fields (level/evolution/services/civic/safety) and popup-close closes it (e2e inspect.spec.ts enriched asserts).
    - Test 2: inspector-next cycles to the next same-kind entity (stable sort by entity id) and inspector-prev goes back; when only one entity of the kind exists the nav buttons are disabled (e2e).
    - Test 3: production/storage/market/walker inspectors open on clicking their building (and the walker inspector opens via clicking a walker tile or an advisor open-inspector action) and render their enriched fields (e2e).
  </behavior>
  <action>
    Render the 5 inspector popups from the enriched pure inspections (decision UI-04), with close/Next navigation:

    1. HUDScene.renderPopup evolution: dispatch on the building type (house → residenceInspection via getInspector; workshop/extraction productive types → productionInspection; granary/warehouse → storageInspection; market → marketInspection; other types fall back to the existing minimal rows). For each, call this.main.runner.getInspector(id), then the matching enriched *Inspection with the snapshot values + internals, and build the popup DOM via createElement + textContent (building/status/evolution strings are sim-derived — NEVER innerHTML interpolation; the renderLog precedent applies). Reuse the row(label,value) helper. Enriched field groups per 18-04-01 (evolution eligibility, services, safety, blocked/bottleneck, reserved/in-transit, market activity, walker path/origin/carriedAmount).
    2. Next ◀/▶ navigation: add inspector-prev / inspector-next buttons (data-testid) in a .inspector-nav row. Build the same-kind list from the current state: houses = state.buildings.filter(house); productive = buildings whose type is in the workshop/extraction catalogs (WORKSHOP_BUILDING_TYPES/EXTRACTION_BUILDING_TYPES or via getProductionAdvisor().rows ids); storage = granary+warehouse; market = market buildings; walker = state.walkers filtered by the current walker's type. Sort each list stably by entity id (UI-SPEC ordering contract). inspector-next advances the index; inspector-prev decrements; wrap or clamp (disable the button when at either end — Component States "disabled when none"). On navigation, re-run getInspector + the enriched projection and re-render.
    3. Walker inspector: opened when clicking a walker tile — extend MainScene.emitInspect to also check state.walkers at (tx,ty) (a walker whose interpolated tile is under the pointer) and emit a new 'hud-walker-inspect' event (or reuse hud-inspect with a walker id flag) that the HUD maps to the walker inspector via getInspector; the advisor open-inspector action (18-02-02) also routes here when the id is a walker. Close semantics: popup-close, ESC, pause, build-mode entry, click-on-empty (existing hud-inspect null) — all already wired through closePopup (HUDScene.ts:306-310, game-pause/hud-build-mode handlers).
    4. index.html: ensure .hud-popup .inspector-nav and the popup max-height/internal-scroll rules (18-01-02) applied.
    5. Flip green the inspector cases (a/b/c) in e2e/inspect.spec.ts (enriched residence + close/Next cycling) and e2e/management-ui.spec.ts (5 popups + click-through) scaffolded in 18-00-01.
    Discretion resolved here: popup is the centered hud-popup card with internal scroll; the walker inspector's Follow/Route/Origin buttons from UI-SPEC are reduced to Origin (open origin building inspector via getInspector on the walker's origin) + Close/Next this phase — Follow/Route are deferred to Phase 20 (camera-tracking polish) and recorded.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx playwright test e2e/inspect.spec.ts e2e/management-ui.spec.ts -g "inspector|popup|next|prev|walker"</automated>
  </verify>
  <acceptance_criteria>all 5 inspector kinds open on click with the enriched pure-projection fields; popup-close closes; inspector-next/inspector-prev cycle same-kind entities in stable id order and disable at the ends; ESC/pause/build-mode/empty-click close; the inspector e2e cases (inspect.spec.ts + management-ui.spec.ts) pass with zero page errors.</acceptance_criteria>
  <done>The 5 inspectors are live popups over the enriched pure projections with close × and Next ◀/▶ same-kind cycling, meet the UI-04 success criterion, and the inspector e2e suites pass.</done>
</task>

<!-- ===================== WAVE 5 (close) — phase gate ===================== -->

<task type="auto">
  <name>Task 18-05-01: Full suite + typecheck + check:military green with no golden regeneration (phase close gate)</name>
  <files>none</files>
  <read_first>
    - package.json scripts (test = vitest run; test:unit = unit/integration/determinism/golden/property; typecheck = tsc --noEmit; test:e2e = playwright test; check:military = node scripts/check-military.mjs)
    - 18-VALIDATION.md (Phase Requirements → Test Map + Sign-Off; Req guard 'No getStateJson change from UI work')
  </read_first>
  <behavior>
    - Test 1: full vitest suite green (unit + integration + determinism + golden + property) with no golden fixture regeneration.
    - Test 2: typecheck green (tsc --noEmit) and check:military green (no military tokens introduced in the new UI code).
    - Test 3: the e2e suites (management-ui + inspect + the pre-existing placement/sessions) green together against the dev server.
  </behavior>
  <action>
    Close the phase (success criteria 1-3 + the determinism contract). Run the full command set and confirm no golden regeneration:

    1. cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck
    2. NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4  (the 18-VALIDATION.md full-suite command; ~50s baseline over unit/integration/determinism/golden/property)
    3. npm run check:military
    4. npx playwright test  (e2e — dev server via playwright webServer; management-ui + inspect + the pre-existing specs)
    5. Confirm no golden fixture changed: the work was view-only + read-only runner getters (getWaterOverlay/getInspector/derived water aggregation) — git status shows no tests/golden/* fixture diffs, and the golden/determinism suites pass without GOLDEN_UPDATE=1.
    If any gate is red, fix the offending source (never regenerate goldens unless the change INTENTIONALLY alters serialized state — none of Phase 18 does) and re-run until all four are green together.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4 && npm run check:military && git status --porcelain tests/golden</automated>
  </verify>
  <acceptance_criteria>typecheck, the full vitest suite (unit/integration/determinism/golden/property), check:military, and the e2e suites are all green together; `git status --porcelain tests/golden` shows no fixture diffs (no golden regeneration); the UI is view-only — no getState()/SaveData shape change from Phase 18 work.</acceptance_criteria>
  <done>Phase 18 closes with the full suite + typecheck + check:military green and zero golden changes, proving the management UI is fully wired over the deterministic sim with the golden-byte contract intact.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| DOM HUD UI → SimRunner | The HUD/control-bar/drawer/overlay buttons call runner commands (`setBuildMode`/`setPaused`/`setSpeed`) or scene methods; views read snapshots only — any path where the UI writes to sim state is a boundary violation (view-only contract). |
| Sim-derived text → DOM | advisor strings, message entries, inspector fields, building names are interpolated into the DOM; the popup/log/advisors surfaces build HTML with template strings today (HUDScene.ts:351-357) — the new surfaces must use textContent/createElement. |
| MainScene (Phaser) → runner | the overlay layer reads pure grids per frame; the click-through path (pointerup → tileAtPointer → emitInspect) must stay single and unbroken by overlay Graphics. |
| Runner getters → pure projections | getWaterOverlay assembles WaterOverlayInput from live buildings; getInspector reads SimInternals — both are read-only and must never touch toBuildingState/toWalkerState (golden-byte). |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-18-01 | Tampering | DOM injection via `innerHTML` interpolation of sim-derived strings in advisor panels, inspector popups, and the message log | high | mitigate | every new surface renders dynamic sim text via `document.createElement` + `textContent` (renderLog precedent HUDScene.ts:286-296); static HTML/CSS stays in templates; the no-decorative + textContent conventions are asserted in the e2e (18-01-01/02/02-02/04-02). ASVS V5. |
| T-18-02 | Tampering (logic) | view recomputes sim state (re-deriving statuses/eligibility/coverage) → drift from the live sim and duplicated state | high | mitigate | every advisor/overlay/inspector value comes from runner getters + pure projections only (advisorsFrom/dedicated getters/foodAdvisorFromState/productionAdvisorRows/getCivicStats/waterOverlayData/civilizationOverlayData/*Inspection); the composer test asserts exact getter provenance (18-02-01); no second recompute. ASVS V5. |
| T-18-03 | Tampering | growing serialized BuildingState/WalkerState (or editing toBuildingState/toWalkerState) to enrich inspectors breaks golden byte-equality and determinism round-trips | high | mitigate | inspectors are enriched via getWalkerInternals()/getInspector(id) (read-only); the phase gate runs tests/golden + tests/determinism and asserts `git status --porcelain tests/golden` empty (18-04-01, 18-05-01). |
| T-18-04 | DoS | the overlay heatmap layer intercepts pointer events → breaks wheel-zoom/drag-pan or the click-inspect path (research Pitfall 7) | medium | mitigate | heatmap Graphics drawn below building depths (setDepth below syncEntities depths); the single pointerup → tileAtPointer → emitInspect path is preserved; wheel/drag handlers (MainScene.ts:211-261) untouched; e2e asserts zoom still works with an overlay active (18-03-02). |
| T-18-05 | Tampering (logic) | water overlay (aggregating all sources) and the stats water % (first-well only) diverge under multiple wells | medium | mitigate | getWaterOverlay() aggregates ALL well/fountain sources AND derivedSnapshot() water is aggregated to match; water-overlay.test.ts asserts multi-source coverage and the determinism byte-identity (18-03-01). |
| T-18-06 | Tampering (logic) | advisor composer string-keyed or fabricated numbers (`advisorsFrom('labor')` does not compile; fabricated rows mislead the player) | medium | mitigate | the composer maps each panel to an ACTUAL runner getter by name; advisor-composer.test.ts asserts the 13 panels return and their field provenance (finance.balance === getFinanceAdvisor().balance, etc.) — no fabricated numbers (18-02-01). |
| T-18-07 | Tampering | non-determinism in the new runner getters (getWaterOverlay/getInspector) or wall-clock reads breaking byte-identical replay | high | mitigate | both are pure functions of live `this.buildings`/`this.walkers` (no Math.random/Date.now); water-overlay.test.ts adds a determinism case (identical runners → identical overlays); the golden/determinism suites gate (18-03-01, 18-04-01). |
| T-18-SC | Tampering | npm/pip/cargo installs | low | accept | Accepted: this phase installs no packages (RESEARCH Package Legitimacy Audit: none); if a later phase adds one it re-enters the gate. |

## Mitigation Notes for ASVS Level 1
- V5 Input Validation is the only applicable control: every player input funnels through sim validators (setPolicy clamps via clamp01, placeBuilding returns PlacementResult); UI passes numbers through, never re-validates. The phase's real control is DOM safety (T-18-01: textContent for sim-derived strings) plus deterministic state integrity (T-18-03/07: getWaterOverlay/getInspector pure read-only; golden/determinism suites).
- V2/V3/V4/V6 are N/A — local offline single-player deterministic sim with no identities, sessions, access control, or crypto.
</threat_model>

<verification>
- After every task commit: run that task's `<automated>` command. Wave 0's gate is `test -f` for the new files plus typecheck (the scaffolds are expected RED). E2e verify commands use `npx playwright test <file> -g "<pattern>"` (dev server auto-starts via playwright webServer); where a full e2e run is impractical in the execution harness, the pure-function unit tests (advisor-composer, water-overlay, advisors inspectors) remain the hard gate and e2e is best-effort with this documented fallback.
- After every wave: `cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` — full suite green EXCEPT the declared-RED scaffolds at that point: after Wave 0 all four scaffolds are RED; after Wave 1 the advisor-composer/water-overlay/inspector scaffolds are still RED (their waves not landed); after Wave 2 only water-overlay + inspectors remain RED; after Wave 3 only the inspector cases remain RED; after Wave 4 everything is green.
- After every wave with new DOM: `npm run check:military` green (advisor copy/inspector labels carry no military tokens).
- After every wave touching sim: `npx vitest run tests/golden tests/determinism -x` green (the golden-byte contract: getWaterOverlay/getInspector/derived-water aggregation change no serialized state).
- Wave 5 close: typecheck + full vitest + check:military + full e2e all green together before /gsd-verify-work; `git status --porcelain tests/golden` empty (no golden regeneration).
</verification>

<success_criteria>
1. UI-01: every central control is wired — including the new control-bar Advisors/Overlays/Messages buttons, each with a real handler that visibly toggles its surface; no button in the HUD/control-bar/drawer/overlay is decorative (e2e audit); build buttons show a live unaffordable-disabled state (treasury < cost).
2. UI-02: the 13 advisors read live sim queries — the pure composer returns exactly 13 panels in the UI-SPEC order over the real getter surface (advisorsFrom + dedicated getters, never string-keyed, never fabricated), and the drawer renders each panel under the tick-change guard with a real open/locate/codex action for every advisor.
3. UI-03: overlays reflect sim state — SimRunner.getWaterOverlay() aggregates all well/fountain sources (aqueduct/reservoir grids intentionally empty); the Phaser heatmap layer draws per-tile grids below the buildings with rendered legends; exactly one overlay is active (radio) with keyboard W/F/R/C/D/X; clicking a highlighted tile opens the matching inspector via emitInspect; camera pan/zoom stays intact.
4. UI-04: the five inspectors (residence / productive building / storage-granary / market / walker) open on click, render the enriched pure projections fed by getWalkerInternals()/getInspector(id) (never growing serialized BuildingState/WalkerState), and provide close × + Next ◀/▶ cycling same-kind entities by stable id.
5. Gates: full suite (unit/integration/determinism/golden/property) + typecheck + check:military + e2e green; no getState()/SaveData shape change; no golden regeneration; the goldens/determinism suites guard the inspector and overlay seams.
</success_criteria>

<output>
Create `.planning/phases/18-management-ui/18-SUMMARY.md` when the phase is done and verified (per the execute-plan workflow / summary template).
</output>





