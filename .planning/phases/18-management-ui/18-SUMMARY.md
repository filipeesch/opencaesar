---
phase: 18-management-ui
plan: 18
subsystem: ui
tags: [phaser, hud, advisors, overlays, inspectors, d3]
requires:
  - phase: 15-ratings-objectives-events
    provides: ratings decomposition, objectives, events, requests
  - phase: 16-full-housing-evolution
    provides: live house level/tier internals, evolution catalog
  - phase: 17-campaign-tutorial-codex
    provides: missions, campaign progress, codex, tutorial
provides:
  - "HUD control bar (Advisors/Overlays/Messages) with real handlers + live build-button unaffordable-disabled state (UI-01)"
  - "13-advisor drawer (src/game/advisors.ts advisorPanels) reading live runner getters under the tick-change guard with open-inspector/locate/open-overlay/open-codex actions (UI-02)"
  - "SimRunner.getWaterOverlay() aggregating all well/fountain sources + derived water coverage (UI-03), Phaser heatmap layer + legends + keyboard W/F/R/C/D/X + click-through"
  - "5 enriched inspector popups fed by getWalkerInternals()/getInspector() with close × + Next ◀/▶ same-kind cycling (UI-04)"
  - "OVERLAY_RAMPS view-only palette + panel-frame CSS on the existing umber/bronze/gold token system"
affects: [Phase 19 (options/reduced-motion palettes), Phase 20 (sidebar redesign, walker Follow/Route)] 
actuals:
  tokens: 23920  # chars/4 over the realized diff (92,217 added + 3,464 deleted chars)
  tasks: 10
  commits: 10
tech-stack:
  added: []
  patterns:
    - "View-only overlay seam: SimRunner exposes getWaterOverlay()/getInspector() as pure read-only projections; all heatmap/inspector values trace to runner getters — never duplicated sim state"
    - "Tick-change guard for every HUD surface (control bar, drawer, overlay legend, inspectors): render only when state.tick advances"
    - "textContent/createElement for all sim-derived DOM strings (T-18-01) — no innerHTML interpolation on new surfaces"
    - "Additive optional internals params on pure *Inspection projections — original minimal calls unchanged, golden byte-equality preserved"
key-files:
  created:
    - src/game/advisors.ts
    - tests/unit/advisor-composer.test.ts
    - tests/unit/water-overlay.test.ts
    - e2e/management-ui.spec.ts
  modified:
    - src/game/scenes/HUDScene.ts
    - src/game/scenes/MainScene.ts
    - src/sim/runner.ts
    - src/sim/advisors.ts
    - src/game/palette.ts
    - index.html
    - tests/unit/advisors.test.ts
    - e2e/inspect.spec.ts
key-decisions:
  - "UI-01: every central control is a real handler — control bar toggles its surface; build buttons disable live on state.treasury < cost; an e2e audit proves no control is decorative"
  - "UI-02: advisorPanels composes the 13 advisors by ACTUAL getter names (never string-keyed advisorsFrom — research Pitfall 1); empty-city calls are total with noData flags"
  - "UI-03: getWaterOverlay() aggregates ALL well/fountain sources; sources keep their real kind (fountain→fountainCoverage, well→wellCoverage); derived water % = well∪fountain union so HUD and overlay agree"
  - "UI-04: inspectors are enriched via getInspector(id)/getWalkerInternals read-only seam (never growing BuildingState/WalkerState); Next/Prev cycles same-kind entities by stable id"
  - "Overlay/legend/overlay bars live outside the scrolling HUD column as fixed panels; legend is display-only (pointer-events none)"
  - "Walker Follow/Route buttons deferred to Phase 20 (camera-tracking polish); Origin shown as a row this phase"
patterns-established:
  - "Pattern: view-layer seams over a deterministic core — every new getter is pure read-only, no Math.random/Date.now, never serialized"
  - "Pattern: Wave-0 test scaffolds written against the TARGET surface (RED until implementing wave), sanctioned type-stub for typecheck sequencing"
requirements-completed: [UI-01, UI-02, UI-03, UI-04]
coverage:
  - id: D1
    description: "Control bar (Advisors/Overlays/Messages) with real handlers and build buttons disabled live on state.treasury < cost; no decorative controls (UI-01)"
    requirement: UI-01
    verification:
      - kind: e2e
        ref: "e2e/management-ui.spec.ts#control bar opens the advisors drawer, overlay bar, and message-log focus (UI-01)"
        status: pass
      - kind: e2e
        ref: "e2e/management-ui.spec.ts#build buttons disable when treasury < cost and track live treasury (UI-01)"
        status: pass
      - kind: e2e
        ref: "e2e/management-ui.spec.ts#no decorative control audit (UI-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "13-advisor drawer composed from live runner getters; tab switching with .active; real per-panel actions (UI-02)"
    requirement: UI-02
    verification:
      - kind: unit
        ref: "tests/unit/advisor-composer.test.ts#advisor composer (UI-02)"
        status: pass
      - kind: e2e
        ref: "e2e/management-ui.spec.ts#advisors drawer switches panels with a live active tab (UI-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "SimRunner.getWaterOverlay() aggregating all well/fountain sources + Phaser heatmap layer, legends, radio toggle bar, keyboard W/F/R/C/D/X, click-through, camera intact (UI-03)"
    requirement: UI-03
    verification:
      - kind: unit
        ref: "tests/unit/water-overlay.test.ts#water overlay runner getter (UI-03)"
        status: pass
      - kind: e2e
        ref: "e2e/management-ui.spec.ts#overlay toggle shows a legend and clicking a highlighted tile opens the inspector (UI-03)"
        status: pass
      - kind: e2e
        ref: "e2e/management-ui.spec.ts#camera wheel-zoom keeps working while an overlay is active (UI-03)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Five inspector popups (residence/productive/storage/market/walker) enriched via getWalkerInternals()/getInspector() with close × and Next ◀/▶ same-kind cycling (UI-04)"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "tests/unit/advisors.test.ts#inspectors enriched via getWalkerInternals (UI-04, Wave 0 scaffold)"
        status: pass
      - kind: e2e
        ref: "e2e/inspect.spec.ts#residence inspector shows enriched live fields (UI-04)"
        status: pass
      - kind: e2e
        ref: "e2e/inspect.spec.ts#inspector Next/Prev cycles same-kind houses in stable id order (UI-04)"
        status: pass
      - kind: e2e
        ref: "e2e/inspect.spec.ts#clicking a walker tile opens the walker inspector (UI-04)"
        status: pass
    human_judgment: false
duration: 91min
completed: 2026-08-06
status: complete
---

# Phase 18: Management UI Summary

**Wired the full Management UI onto the deterministic sim core: a control bar with every control real (no decorative buttons), a 13-advisor drawer composed from live runner getters under the tick-change guard, a 5-overlay heatmap layer with legends and click-through, and five enriched inspectors with close/Next cycling — with zero getState()/SaveData shape change and zero golden regeneration.**

## Performance

- **Duration:** 91 min
- **Started:** 2026-08-05T23:27:22Z
- **Completed:** 2026-08-06T00:58:46Z
- **Tasks:** 10 (Wave 0 scaffold → Wave 1 control bar → Wave 2 advisors → Wave 3 overlays → Wave 4 inspectors → Wave 5 close gate)
- **Files modified:** 12 (8 modified + 4 created)

## Accomplishments

- **UI-01 control bar + build-disabled:** Advisors/Overlays/Messages buttons each dispatch a real handler that visibly toggles its surface (drawer / overlay bar / log focus); every build button disables when `state.treasury < BUILDINGS[type].cost`, re-evaluated live each tick; an e2e audit proves no control-bar/build button is decorative.
- **UI-02 13-advisor drawer:** `src/game/advisors.ts` `advisorPanels(source)` returns exactly 13 panels in the UI-SPEC locked order, each value traced to an ACTUAL runner getter (finance→getFinanceAdvisor, food→foodAdvisorFromState, production/logistics→getProductionAdvisor+getLogisticsAdvisor, labor→getEmployment, trade→getTradeAdvisor, housing→state.buildings+water overlay, ratings→getDerived()+decomposition, religion→godWorship+getFestival, safety→getCivilizationOverlay, governance→getGovernance, diplomacy→getRequests+getEvents, objectives→getMission/getMissionProgress/getCampaignProgress, demography→derived+house census). The drawer renders one live panel under the tick-change guard with real open-inspector/locate/open-overlay/open-codex actions.
- **UI-03 overlays:** `SimRunner.getWaterOverlay()` aggregates ALL live well/fountain sources (never find()-first); derived water % counts the well∪fountain union so the HUD agrees with the overlay; the MainScene heatmap layer draws per-tile diamonds below building depths for water/food/risks/coverage/desirability with rendered legends, radio toggle bar + keyboard W/F/R/C/D/X, and click-through via the unchanged `emitInspect` path — wheel-zoom/drag-pan stay intact (e2e-proven).
- **UI-04 inspectors:** the five pure *Inspection projections are enriched via additive optional internals params fed by `getWalkerInternals()`/`getInspector(id)` (residence level/satisfiedTicks/civic/safety, production blocked/bottleneck/workers, storage used/capacity, market stock, walker type/origin/path/carriedAmount); five inspector popups open on click with close × and Next ◀/▶ same-kind cycling in stable entity-id order, disabled at the ends.
- **Golden-byte contract intact:** golden + determinism suites stay byte-identical; `git status --porcelain tests/golden` empty; full suite 884/884 green, typecheck green, check:military green.

## Task Commits

Each task was committed atomically (9 code commits + 1 docs commit):

1. **Task 18-00-01: Wave-0 validation scaffolds** - `92a0ba2` (test)
2. **Task 18-01-01: control bar + build-disabled (tracer)** - `9851ba9` (feat)
3. **Task 18-01-02: panel-frame CSS + no-decorative audit** - `5cdb5c2` (feat)
4. **Task 18-02-01: 13-advisor pure composer** - `d6a5ec1` (feat)
5. **Task 18-02-02: advisors drawer + live panel + actions** - `8f3b898` (feat)
6. **Task 18-03-01: getWaterOverlay + derived water aggregation** - `af417be` (feat)
7. **Task 18-03-02: overlay bar + Phaser heatmap layer + legends + click-through** - `9c634e4` (feat)
8. **Task 18-04-01: enriched *Inspection projections + getInspector seam** - `3ba84a5` (feat)
9. **Task 18-04-02: 5 inspector popups + close/Next cycling** - `e626c8b` (feat)
10. **Task 18-05-01: full suite + typecheck + check:military green (close gate)** - verification only, no code commit

**Plan metadata:** `(docs: complete plan)` — documented in the final commit below.

## Files Created/Modified

- `src/game/advisors.ts` — NEW pure 13-advisor composer (`advisorPanels`, `AdvisorSource`, `AdvisorPanel`, `OverlayId`, `ADVISOR_TAB_ORDER`); started as a Wave-0 type-stub, fully implemented in 18-02-01
- `tests/unit/advisor-composer.test.ts` — NEW 13-panel order / getter provenance / trade totals / action kinds / empty-city totality
- `tests/unit/water-overlay.test.ts` — NEW multi-source aggregation / bounds / zero aqueduct-reservoir / max class 2 / determinism / derived-agreement
- `e2e/management-ui.spec.ts` — NEW control-bar / build-disabled / no-decorative audit / advisors drawer / overlay legend+click-through / camera-zoom / residence inspector
- `src/game/scenes/HUDScene.ts` — control bar, advisors drawer (tabs + panel + actions), overlay bar + legend, 5 inspector popups + Next/Prev, build affordability, all new DOM via textContent
- `src/game/scenes/MainScene.ts` — overlay heatmap Graphics layer (depth 1), keyboard W/F/R/C/D/X, setOverlay radio source of truth, walker-tile emitInspect
- `src/sim/runner.ts` — `getWaterOverlay()`, `liveWaterSources()`, `getInspector(id)`, derived water union aggregation
- `src/sim/advisors.ts` — additive enriched `*Inspection` internals params
- `src/game/palette.ts` — `OVERLAY_RAMPS` + `hexToPhaser`
- `index.html` — `.hud-control-bar`, `.advisor-tab(.active)`, `.overlay-toggle(.active+shortcut)`, `.overlay-legend`, `.hud-popup .inspector-nav(:disabled)`, `.hud-build-btn:disabled`, `.hud-log.active`; FIX `.hud-popup` pointer-events
- `tests/unit/advisors.test.ts` — extended enriched-inspectors block
- `e2e/inspect.spec.ts` — extended enriched residence / Next-Prev cycling / walker-tile inspector

## Decisions Made

- **UI-01:** the new central controls are real handlers with an e2e no-decorative audit; build buttons have a live unaffordable-disabled state (never static).
- **UI-02:** the 13 advisors are COMPOSED from `advisorsFrom(snapshot)` + dedicated getters mapped by actual method names (research Pitfall 1 — string-keyed `advisorsFrom('name')` does not compile); empty-city calls are total with `noData` flags.
- **UI-03:** `getWaterOverlay()` feeds `waterOverlayData` from `this.buildings.filter(well|fountain)` with empty aqueduct/reservoir sets (reservoir is not a placeable BuildingType); `derivedSnapshot()` water counts the well∪fountain union so the HUD % equals the overlay coverage — the plan's literal `kind:'well' as const` mapping was corrected (see deviations) so fountains land in `fountainCoverage` and the fountain-only `buildings-catalog` gate holds.
- **UI-04:** enriched fields come ONLY from `getInspector(id)`/`getWalkerInternals()` internals — never grown `BuildingState`/`WalkerState`; Next/Prev cycles same-kind entities stably by id.
- **Symmetry/ownership:** `MainScene.setOverlay` is the single radio source of truth; the overlay-bar toggles, keyboard, and advisor `open-overlay` all route through it (`overlay-toggle` bus); the bar visibility uses a separate `overlay-bar` event.
- **Deferred (recorded, per plan):** walker Follow/Route buttons → Phase 20 (camera-tracking polish); origin shown as a row this phase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] getWaterOverlay/derived water source kind mapping**
- **Found during:** Task 18-03-01 (getWaterOverlay + water-overlay tests)
- **Issue:** The plan's action literal maps every source as `kind:'well' as const`, which would put fountains in `wellCoverage` (never `fountainCoverage`) — contradicting the plan's own `water-overlay.test.ts` contract ("a fountain variant lands in fountainCoverage") and breaking the pre-existing `buildings-catalog` gate (`getDerived().water.coveredTiles > 0` with a fountain-only city).
- **Fix:** `liveWaterSources()` maps each source by its real kind (fountain→'fountain', well→'well'); `getWaterOverlay()` then paints `fountainCoverage` correctly; `derivedSnapshot()` counts the well∪fountain union (identical total coverage value to before — no golden/getState change).
- **Files modified:** src/sim/runner.ts, tests/unit/water-overlay.test.ts
- **Verification:** water-overlay tests (6) + buildings-catalog + golden + determinism (89 tests) green.
- **Committed in:** af417be (Task 18-03-01)

**2. [Rule 1 - Bug] .hud-popup had pointer-events: none — the popup-close × was never clickable**
- **Found during:** Task 18-01-02 (adding the inspector nav into the popup; pre-existing bug surfaced by the UI-04 close requirement)
- **Issue:** `.hud-popup` inherits `pointer-events: none` from `#hud`, so the existing close × (and any new popup controls) never received clicks; the canvas intercepted them.
- **Fix:** added `pointer-events: auto` (+ internal `max-height/overflow-y: auto` for scrollable inspectors) to `.hud-popup`.
- **Files modified:** index.html
- **Verification:** management-ui inspector close + inspect.spec close/ESC/empty-terrain cases green.
- **Committed in:** 5cdb5c2 (Task 18-01-02)

### Implementation Notes (plan-sanctioned / documented)

**3. Wave-0 `advisorPanels` type-stub.** The plan's typecheck-sequencing note sanctions stubs so Wave-0 scaffolds parse; `src/game/advisors.ts` shipped as a Wave-0 type-stub (AdvisorSource/AdvisorPanel/OverlayId + placeholder) and was fully implemented in 18-02-01.

**4. e2e error assertion filters pre-existing loader noise.** With Vite's SPA fallback the HEAD probe for the missing `assets/terrain.png`/`house.png` returns 200 and Phaser logs "Failed to process file: … spritesheet terrain/house" on EVERY boot (confirmed on the base commit via a temp worktree). The management-ui error assertions filter those two known messages so they catch only new page/console errors.

**5. advisor-composer balance provenance uses `toBeCloseTo(…, 0)`** — the panel displays rounded denarii while the getter returns a float; exact equality on the raw float would be wrong.

### Out-of-scope / pre-existing (not regressions)

**6. Three pre-existing e2e failures** (`boots.spec#boots the game shell`, `campaign.spec#winning a trivial objective is reported through the live sim`, `placement.spec#full supply chain grows the HUD population`) fail identically on the pre-Phase-18 base commit `33dc6b0` (verified in a temp worktree) — environment noise (SPA-loader console errors + sim-tick timing), not caused by Phase 18. Per the plan's documented best-effort e2e fallback, the pure-function unit suites are the hard gate and are fully green.

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs) + 3 documented implementation notes + 1 pre-existing-environment note.
**Impact on plan:** all auto-fixes were correctness/safety requirements (golden-byte consistency, clickable close control). No scope creep; the 6 waves executed in order.

## Issues Encountered

- **Vitest worker RPC timeouts:** the full-suite run reported 2 `Timeout calling "onTaskUpdate"` worker-communication errors with 116/116 files passing (884/884 tests). This is a vitest parallel-worker infrastructure artifact in this environment, not a test failure — no test was affected.
- **e2e environment noise:** Vite SPA-fallback loader errors flake the pre-existing `boots`/`campaign`/`placement` console-error and timing assertions (confirmed pre-existing at base).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Management UI is fully wired: control bar, 13 advisors, 5 overlays, 5 inspectors — all reading the deterministic sim core read-only.
- Phase 19 can build on the now-wired surfaces (options screen, reduced-motion/colorblind palettes, limit-evolution controls).
- Phase 20 sidebar redesign and walker Follow/Route camera-tracking can reuse the `emitInspect`/`getInspector`/overlay-layer seams.
- Deferred: walker Follow/Route buttons (Phase 20); housing overlay is not a separate overlay (water/food/risks/coverage/desirability per UI-SPEC).

## Self-Check: PASSED

All required files exist and all 9 code commits are present (verified `git log --all`): 92a0ba2, 9851ba9, 5cdb5c2, d6a5ec1, 8f3b898, af417be, 9c634e4, 3ba84a5, e626c8b.

---
*Phase: 18-management-ui*
*Completed: 2026-08-06*
