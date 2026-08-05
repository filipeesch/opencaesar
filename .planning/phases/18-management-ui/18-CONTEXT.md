# Phase 18: Management UI - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous, user accepted all recommended answers)

<domain>
## Phase Boundary

Deliver a fully wired Management UI in the Phaser `src/game/` view: HUD with every
control wired (no decorative buttons), 13 advisors reading live sim queries,
overlays with legends/heatmaps/click-through (water, risks, coverage, etc.), and
inspectors for residential, productive-building, storage/granary, market, and
walker entities. All UI reads the deterministic sim (SimRunner queries /
getState / getDerived / advisor projections) — the UI is view-only, never
duplicates state. Covers UI-01, UI-02, UI-03, UI-04.

</domain>

<decisions>
## Implementation Decisions

### HUD & Controls (UI-01)
- Every central button has a real handler wired to a SimRunner command or scene action — no decorative controls; DOM-backed controls (buttons, sliders, message log) follow the existing HUDScene pattern.
- HUD reads `runner.getState()` / `getDerived()` each frame with a tick-change guard (existing pattern: `if (state.tick === this.lastTick) return`) and renders the message log, speed controls, pause/resume, stats summary (money/people/ratings).
- Build-mode / inspector / overlay toggles are real scene interactions (hud-build-mode, hud-inspect events already exist).

### 13 Advisors (UI-02)
- All 13 advisors read live sim queries and update each frame: the advisor projection layer (`src/sim/advisors.ts` — `advisorsFrom`, `financeAdvisorFromState`, `foodAdvisorFromState`, `productionAdvisorRows`, etc.) is the single source; the HUD renders each advisor's dataset into a panel.
- Advisors update on the same tick-change guard (no re-render when the sim hasn't ticked); each advisor panel has a real "more detail / inspector" open action.
- The advisor set spans finance, food, production, labor, trade, housing, ratings, religion, safety/risks, governance, diplomacy/requests, objectives/missions, and demography — as exposed by the advisor layer.

### Overlays & Inspectors (UI-03 / UI-04)
- Overlays reflect sim state as tile grids with legends and heatmaps: water coverage (`waterOverlayData`, `foodOverlayGrids`), risks/fire/collapse/crime (`civilizationOverlayData`), desirability, coverage, supply/variety — each with a legend and click-through (clicking a tile selects/advances to that building/entity).
- Overlays are pure projections over live state (deterministic, never in getState()); toggled via keyboard/HUD buttons; heatmap color ramps defined in the UI (view-only).
- Inspectors for residential, productive-building, warehouse/granary, market, and walker entities — open on click, render the existing pure inspections (`residenceInspection`, `productionInspection`, `storageInspection`, `marketInspection`, `walkerInspection`) with close/next buttons.

### the agent's Discretion
- Exact HUD layout/panel arrangement, advisor tab/accordion organization, overlay toggle keys, color ramps, and inspector popup styling — consistent with the existing HUDScene DOM + Phaser mix.
- Which advisor panels are tabbed vs always-visible first.
- Visual hierarchy and density — the existing game uses placeholder/generated art; keep styling functional and consistent, no pixel-perfect art.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/game/scenes/HUDScene.ts` (365 lines): DOM-backed HUD (sliders, buttons, message log, pause/save/restart overlay, toast, inspect/build-mode/pause events), tick-change guard `if (state.tick === this.lastTick) return`, updates from `main.runner.getState()`/`getDerived()`.
- `src/game/scenes/MainScene.ts` (588 lines): isometric game view + SimRunner, hud-inspect/hud-build-mode events, restartToHome, setPaused.
- `src/game/scenes/BootScene.ts`, `HomeScene.ts`, `src/game/main.ts` (Home → Main + HUD wiring).
- `src/sim/advisors.ts`: `advisorsFrom(s)` → `AdvisorDataset[]` (13 advisors), `financeAdvisorFromState`, `foodAdvisorFromState`/`foodHudFromState`/`foodTooltip`, `productionAdvisorRows`, `waterOverlayData`, `civilizationOverlayData`, `foodOverlayGrids`, inspections (`residenceInspection`, `productionInspection`, `storageInspection`, `marketInspection`, `walkerInspection`), `groupedAlerts`, overlaysFrom.
- `src/sim/runner.ts`: `getState()`, `getDerived()`, `getCivicStats()`, `getGovernance()`, `getTutorial()`, `getCodex()`, `getMission()`, `getEvents()`, `getCivilizationOverlay()`.

### Established Patterns
- UI is view-only: reads SimRunner snapshots/queries; never duplicates or mutates sim state; determinism preserved.
- DOM-backed HUD controls with `data-testid` for tests; Phaser scenes for the isometric view.
- Pure advisor/inspection/overlay projections in `src/sim/advisors.ts` consumed by the HUD.
- Data-testids + existing vitest unit tests for the pure advisor functions (HUD DOM wiring is thin, Phaser scene code not unit-tested today — tests target the pure `*AdvisorFromState`/inspection/overlay functions).

### Integration Points
- `HUDScene.update()` — wire advisors/overlays/inspectors to the existing tick-change guard.
- `MainScene` — overlay rendering (tile grids + heatmaps + click-through), inspector popups, build-mode.
- Event bus (`hud-inspect`, `hud-build-mode`, `game-pause/game-resume`, `hud-toast`) — extend for overlay toggles and advisor panel opens.
- `advisors.ts` — 13-advisor dataset (already complete as pure functions); the HUD just consumes it.

</code_context>

<specifics>
## Specific Ideas

- Success criteria to honor: (1) no central button is decorative — every control has a real handler; (2) all 13 advisors read live sim queries and update; (3) overlays and inspectors reflect sim state with legends/heatmaps and click-through.
- Overlays list from requirements: water, risks (fire/collapse/crime), coverage (service/desirability), supply/variety — all as heatmaps with legends.
- Inspectors: residential, productive-building, warehouse/granary, market, and walker — open on click with the existing pure `*Inspection` functions.
- All UI reads live sim queries (getState/getDerived/advisor projections); no decorative controls.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>
