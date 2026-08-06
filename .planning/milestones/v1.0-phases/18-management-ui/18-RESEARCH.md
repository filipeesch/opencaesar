# Phase 18: Management UI - Research

**Researched:** 2026-08-05
**Domain:** Phaser 3 + vanilla TypeScript view layer (DOM HUD + isometric scene) over a deterministic sim core
**Confidence:** HIGH

## Summary

Phase 18 wires the entire Management UI onto the already-complete deterministic sim: a DOM-backed
HUD (every control with a real handler), 13 advisor panels reading live sim queries, tile overlay
heatmaps with legends and click-through, and 5 inspectors opened on entity click. The sim core
(`src/sim/runner.ts` + `src/sim/advisors.ts`) is essentially complete and exposes nearly every
getter the UI-SPEC cites; the work is a **view-layer integration** plus **two sim-side additions**
(water-overlay assembly and enriched inspector projections).

Key findings: (1) the existing `HUDScene` already wires every current control (stats, build
palette + category tabs, policy sliders, message log, pause, speed, save/restart, toast, popup)
under a tick-change guard — there are **no decorative buttons today**, what is missing is the *new*
surfaces (advisor drawer, overlay bar, control bar, enriched inspectors). (2) `advisorsFrom()`
returns **8–9 datasets by name**, not 13 — the 13-advisor set must be composed from a MIX of
`advisorsFrom` (population/labor/finance/ratings/religion/health/education/entertainment) and the
dedicated runner getters (`getFinanceAdvisor`, `getTradeAdvisor`, `getProductionAdvisor`,
`getLogisticsAdvisor`, `getEmployment`, `getGovernance`, `getRequests`, `getMission`/…,
`getEvents`, `getFestival`, `getCivilizationOverlay`, `getCivicStats`). (3) **`getWaterOverlay()`
does not exist and the runner caches no water grid** — it recomputes a throwaway `WaterSystem` at
`derivedSnapshot()` using only the *first* well/fountain; the water overlay needs a new runner
getter that aggregates all live well/fountain sources and feeds `waterOverlayData()` (reservoir/
aqueduct/flow grids will read 0 — those systems are not wired into the runner and reservoir is not
even a placeable `BuildingType`). (4) The pure `*Inspection` stubs are minimal; the rich per-entity
fields live on the *internal* `BuildingInstance`/`HouseInstance`/`WalkerInstance` shapes reachable
via `runner.getWalkerInternals()` — enrich the pure inspectors to accept these (never add fields to
`BuildingState`/`WalkerState`, which would break golden byte-equality).

**Primary recommendation:** implement in three tracks — (A) runner additions: `getWaterOverlay()`
aggregating all water sources + an inspector snapshot seam feeding enriched pure projections
(`getWalkerInternals()` already exists); (B) HUD DOM work: control bar, advisors drawer (tabs),
overlay bar, message-focus, all with `data-testid`; (C) MainScene work: overlay layer rendering
heatmaps + legends + click-through, and the 5 inspector popups built from the enriched pure
inspectors. Wire advisors as a UI composition over existing getters (do not invent a new 13-advisor
pure API); assemble the water overlay in the runner; read inspector internals via
`getWalkerInternals()` instead of mutating the serialized `BuildingState`. All UI reads snapshots
only; no `getState()` shape changes; no new packages.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### HUD & Controls (UI-01)
- Every central button has a real handler wired to a SimRunner command or scene action — no decorative controls; DOM-backed controls (buttons, sliders, message log) follow the existing HUDScene pattern.
- HUD reads `runner.getState()` / `getDerived()` each frame with a tick-change guard (existing pattern: `if (state.tick === this.lastTick) return`) and renders the message log, speed controls, pause/resume, stats summary (money/people/ratings).
- Build-mode / inspector / overlay toggles are real scene interactions (hud-build-mode, hud-inspect events already exist).

#### 13 Advisors (UI-02)
- All 13 advisors read live sim queries and update each frame: the advisor projection layer (`src/sim/advisors.ts` — `advisorsFrom`, `financeAdvisorFromState`, `foodAdvisorFromState`, `productionAdvisorRows`, etc.) is the single source; the HUD renders each advisor's dataset into a panel.
- Advisors update on the same tick-change guard (no re-render when the sim hasn't ticked); each advisor panel has a real "more detail / inspector" open action.
- The advisor set spans finance, food, production, labor, trade, housing, ratings, religion, safety/risks, governance, diplomacy/requests, objectives/missions, and demography — as exposed by the advisor layer.

#### Overlays & Inspectors (UI-03 / UI-04)
- Overlays reflect sim state as tile grids with legends and heatmaps: water coverage (`waterOverlayData`, `foodOverlayGrids`), risks/fire/collapse/crime (`civilizationOverlayData`), desirability, coverage, supply/variety — each with a legend and click-through (clicking a tile selects/advances to that building/entity).
- Overlays are pure projections over live state (deterministic, never in getState()); toggled via keyboard/HUD buttons; heatmap color ramps defined in the UI (view-only).
- Inspectors for residential, productive-building, warehouse/granary, market, and walker entities — open on click, render the existing pure inspections (`residenceInspection`, `productionInspection`, `storageInspection`, `marketInspection`, `walkerInspection`) with close/next buttons.

### the agent's Discretion
- Exact HUD layout/panel arrangement, advisor tab/accordion organization, overlay toggle keys, color ramps, and inspector popup styling — consistent with the existing HUDScene DOM + Phaser mix.
- Which advisor panels are tabbed vs always-visible first.
- Visual hierarchy and density — the existing game uses placeholder/generated art; keep styling functional and consistent, no pixel-perfect art.

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | HUD with every control wired (no decorative buttons) | Existing HUDScene already wires all current controls; the gap is the NEW surfaces (control bar with Advisors/Overlays/Messages, unaffordable-disabled build state). MainScene exposes setBuildMode/setPaused/setSpeed + event bus (hud-inspect, hud-build-mode, hud-toast, game-pause/game-resume). §HUDScene 365 lines verified below. |
| UI-02 | 13 advisors reading live sim queries | Advisors composition provenance: `advisorsFrom` (8–9 datasets) + runner getters (getFinanceAdvisor, getTradeAdvisor, getProductionAdvisor, getLogisticsAdvisor, getEmployment, getGovernance, getRequests, getMission/getMissionProgress/getObjectiveProgress/getCampaignProgress, getEvents, getFestival, getCivilizationOverlay, getCivicStats). All these getters exist; `getWaterOverlay` is the only UI-SPEC-cited getter missing. |
| UI-03 | Overlays with legends, heatmaps, click-through (water, risks, coverage, etc.) | Pure overlay projections exist: `waterOverlayData` (needs a runner `getWaterOverlay()`), `foodOverlayGrids`, `civilizationOverlayData` (wired via `getCivilizationOverlay()`), `getCivicStats()` for coverage. MainScene renders no overlays today — new Phaser layer required; click-through reuses `emitInspect`. |
| UI-04 | Residential, productive-building, warehouse/granary, market, and walker inspectors | Pure `*Inspection` stubs exist but are minimal; rich fields available on internal `BuildingInstance`/`HouseInstance`/`WalkerInstance` via `runner.getWalkerInternals()`. Enrich projections; never add fields to serialized `BuildingState`/`WalkerState` (golden-byte constraint). |
</phase_requirements>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HUD DOM controls (stats, build palette, policy, log, pause/save) | Browser / Client | — | Existing `HUDScene` DOM overlay; reads `runner.getState()/getDerived()` under the tick guard. View-only. |
| Advisor panels (13) | Browser / Client | API / Backend (sim) | HUD renders pure projections; the sim owns the getters (`getFinanceAdvisor`, `getTradeAdvisor`, …). Advisors are a UI composition over existing sim queries. |
| Overlay tile grids + legends + click-through | Browser / Client | API / Backend (sim) | `MainScene` (Phaser) draws the heatmaps from pure grids (getWaterOverlay/foodOverlayGrids/getCivilizationOverlay/getCivicStats); click-through goes through `emitInspect` → `hud-inspect`. |
| Inspectors (5 kinds) | Browser / Client | API / Backend (sim) | Popup DOM renders pure `*Inspection` projections; the sim feeds rich internals via `getWalkerInternals()`. |
| Data validation / policy clamps | API / Backend (sim) | — | All player input is validated in the runner (`setPolicy` clamps via `clamp01`); the UI passes numbers through — never revalidates/duplicates. |
| Determinism contract | API / Backend (sim) | — | Views never write to sim state; new projections are pure and never stored in `getState()`. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Phaser | 3.90.0 | Game shell, scene system, isometric tilemap, camera, input | Existing engine — `package.json` + `npm ls` confirm 3.90.0 [VERIFIED]. `MainScene` renders the isometric view and input today. |
| Vanilla TS DOM (no library) | — | HUD, advisors drawer, overlay bar, inspector popups | Established `HUDScene.buildDom()` pattern via `document.createElement` in `index.html`'s inline CSS system [VERIFIED: src/game/scenes/HUDScene.ts:77-222]. |
| Vitest | 3.2.7 | Pure-function unit tests | Tests are `node`-environment vitest over `tests/**/*.test.ts` [VERIFIED: vitest.config.ts:4-7]. |
| Playwright | 1.62.1 | e2e data-testid flows against real dev server | `playwright.config.ts` serves `npm run dev` at :5173, chromium, workers 1 [VERIFIED: playwright.config.ts]. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | No new npm dependencies required for this phase | All features build on existing Phaser/DOM/vitest/playwright. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-built DOM (HUD) | React/Vue/shadcn component UI | **Rejected** — project is Phaser + vanilla TS; a framework shell is a Phase-20+ architectural change, out of scope (UI-SPEC "Tool: none"). |
| Inspectors reading `getState()` | Reading `getWalkerInternals()` + enriched pure projections | `getState()`'s `BuildingState` lacks safety/production/house internals and **must not** grow (golden byte-equality). `getWalkerInternals()` already exposes the rich internals (verified below). |
| New 13-advisor pure API | Compose UI-panels over `advisorsFrom` + existing getters | The data already exists; a redundant 13-way pure API duplicates the sim surface and adds a second source of truth. |

**Installation:**
```bash
# No new packages — this phase only uses existing dependencies.
npm install   # if node_modules is stale; phaser@3.90.0, vitest@3.2.7 already present
```

**Version verification:** phaser 3.90.0, vite 6.4.3, vitest 3.2.7, typescript 5.9.3, @playwright/test 1.62.1 — all confirmed via `npm ls` [VERIFIED: package-lock].

## Package Legitimacy Audit

> No external packages are installed by this phase. The phase uses only already-present
> dependencies (Phaser, vitest, playwright) plus hand-built DOM — no registry changes, so the
> Package Legitimacy Gate has nothing to audit.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | N/A | No new packages — gate not triggered |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
## Architecture Patterns

### System Architecture Diagram

```
 player input (click / key / DOM)
   │
   ▼
┌─────────────── Phaser view layer (view-only, deterministic) ──────────────┐
│  MainScene (isometric)      HUDScene (DOM overlay)                         │
│   render terrain/buildings   stats + build + policy + log + toast          │
│   overlays: heatmaps (NEW)   advisors drawer (NEW) + overlay bar (NEW)     │
│   click-through: emitInspect inspectors popups (NEW 5 kinds)               │
└───────┬───────────────────────────────────────▲────────────────────────────┘
        │ getState()/getDerived() per frame      │ commands
        │ (tick-change guard: state.tick ===      │ (placeBuilding/setPolicy/
        │  lastTick ? skip render)                │  setPaused/setSpeed/…)
        ▼                                       │
┌─────────────────────────────────────────────────────────────┐
│ SimRunner (src/sim/runner.ts) — authoritative state          │
│  tick() fixed timestep; getState/getDerived/get*Advisor     │
│  getCivilizationOverlay/getCivicStats/getWaterOverlay (NEW)  │
│  getWalkerInternals (rich entity internals for inspectors)   │
└───────────────┬──────────────────────────────────────────────┘
                │ pure projections (src/sim/advisors.ts)
                ▼
   advisorsFrom / financeAdvisorFromState / foodAdvisorFromState /
   productionAdvisorRows / logisticsAdvisorFromState / tradeAdvisorFromState /
   waterOverlayData / civilizationOverlayData / foodOverlayGrids /
   residence|production|storage|market|walkerInspection
```

The primary use case (click a house → residence inspector) flows: pointer up → `tileAtPointer` →
`emitInspect` (`main.ts`-style `hud-inspect` event) → HUDScene renders the pure `residenceInspection`
fed by runner internals → popup with close/next. Advisors flow: each frame after a tick change the
HUD re-runs the same mix of projections for the active tab. Overlays: toggle → MainScene builds
a Phaser graphics layer from the grid → legend DOM; clicking a highlighted tile calls `emitInspect`.

### Recommended Project Structure
```
src/
├── game/
│   ├── scenes/
│   │   ├── HUDScene.ts     # + control bar, advisors drawer, overlay bar (DOM)
│   │   └── MainScene.ts    # + overlay layer (heatmaps, legend, click-through)
│   ├── palette.ts          # + overlay ramp tokens (view-only) [ASSUMED location]
│   └── main.ts             # unchanged scene wiring (Boot → Home/Main + HUD)
└── sim/
    ├── advisors.ts         # enrich *Inspection signatures (pure, additive)
    └── runner.ts           # + getWaterOverlay(), + inspector snapshot feeder
```

### Pattern 1: Tick-change guarded render (existing, must be preserved)
**What:** the HUD renders only when the sim tick advanced; identical-tick frames are skipped.
**When to use:** every advisor panel, stats, overlays refresh.
**Example (existing):**
```typescript
// Source: src/game/scenes/HUDScene.ts:37-41 (verified verbatim)
override update(): void {
  const state = this.main?.runner.getState();
  if (!state || !this.els.pop) return;
  if (state.tick === this.lastTick) return;
  this.lastTick = state.tick;
  // ...render stats/log/advisors (advisors render here)
}
```

### Pattern 2: Pure projection over injected state (existing, must be extended)
**What:** advisors/inspectors/overlays are pure functions of injected data; the runner feeds live
state.
**When to use:** every new projection stays in `src/sim/advisors.ts` (or a like pure module), never
in the scene.
**Example (existing):**
```typescript
// Source: src/sim/advisors.ts:194-237 (verified) — water overlay pure projection.
// It takes an explicit WaterOverlayInput (TileWater grid, aqueduct/flowing Sets,
// reservoirStates) — the runner must ASSEMBLE that input (see Pitfall 4).
export function waterOverlayData(input: WaterOverlayInput): Record<string, number[][]> { /* … */ }
```

### Anti-Patterns to Avoid
- **Adding fields to `BuildingState`/`WalkerState` (serialized via `toBuildingState`/`toWalkerState`):**
  breaks golden byte-equality (`tests/golden/golden.test.ts:27,35-36`) and determinism tests that
  compare `getStateJson()`. Enrich inspectors via `getWalkerInternals()`/new getters, never by
  growing the snapshot.
- **Re-computing sim state in the UI:** the UI is view-only; any derived value (months of food,
  ratings decomposition) must come from existing projections/getters, never a second recompute.
- **One overlay driving camera:** overlays "never take over" pan/zoom (UI-SPEC §Map view); camera
  handling stays in MainScene unchanged.
- **Decorating a button without a handler:** UI-01 success criterion — each new control (Advisors,
  Overlays, Messages, overlay/like toggles) must dispatch a real handler/event.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Housing evolution eligibility / missing requirements in the residence inspector | Hand-rolled per-house requirement recompute | `HOUSING_LEVELS` catalog + `requirementsSatisfied()`/`decideEvolution()` from `src/sim/housingEvolution.ts` | The 21-level requirement ladder is data-driven and already tested; re-deriving it by hand drifts from the live sim. |
| Food months / bands / bottleneck detection | Re-derive months-of-food in the HUD | `foodAdvisorFromState` / `foodHudFromState` / `foodBottlenecks` | Already pure, tested (tests/unit/advisors.test.ts), and the HUD food stat already uses it. |
| Workshop status / bottleneck strings | Hand-derive workshop state | `productionAdvisorRows(state, notes)` via `getProductionAdvisor()` + `productionNotes()` | The runner records authoritative per-tick production internals (runner.ts:1564-1609) — statuses like `missing_input`/`output_full`/`no_destination` are live. |
| Service coverage grids | Recompute coverage in the view | `getCivicStats()` (health/literacy/entertainment) | Already a pure derived accessor (runner.ts:1367-1386). |
| Trade advisor / finance advisor / logistics advisor | Rebuild them in the UI | `getTradeAdvisor()`, `getFinanceAdvisor()`, `getLogisticsAdvisor()` | All exist as pure projections with dedicated tests. |
| Pixel art / icon fonts | New icon system | Unicode glyphs + text labels (existing `❚❚`/`×`/`◉ ◐ ○ ● ·`) | UI-SPEC: "no emoji, no icon-font dependency"; styles live in `index.html`. |

**Key insight:** the sim already exposes nearly every datum the UI needs through pure projections and
getters — the phase's risk is *duplication and drift* (re-deriving statuses/eligibility/coverage in
the view), not *missing data*. Prefer feeding existing projections; add only what is genuinely absent
(water-overlay input assembly, richer inspector param passing).

## Common Pitfalls

### Pitfall 1: `advisorsFrom()` is not the 13-advisor source — the "13" must be composed
**What goes wrong:** the CONTEXT/UI-SPEC imply `advisorsFrom(s)` returns all 13 advisors and that the
HUD just consumes it; the UI-SPEC even cites `advisorsFrom('labor')` / `advisorsFrom('ratings')`
string-keyed calls.
**Why it happens:** `advisorsFrom` actually takes a *snapshot object* and returns datasets named
`population, labor, finance, ratings, religion, health, education, entertainment`
(+ optional `ratings-decomposition`, and `constructionSpend` folded into ratings) —
`[VERIFIED: src/sim/advisors.ts:121-146]`. A string-keyed call `advisorsFrom('labor')` does not
compile.
**How to avoid:** build the housing/trade/safety/diplomacy/missions/demography advisors from the
dedicated runner getters (all verified present) and the `getState()`/`getDerived()` snapshots; use
`advisorsFrom(snapshot)` only for the 8 base datasets. Add a thin pure *composer* (e.g.
`advisorPanels(runner)` in `src/game/` or `src/sim/ui.ts`) the HUD consumes, so tests target a pure
function.
**Warning signs:** a plan task saying "wire `advisorsFrom` to render all 13 panels".

### Pitfall 2: missing `getWaterOverlay()` — the water overlay has no runner feed
**What goes wrong:** `waterOverlayData` requires a `WaterOverlayInput`
(`grid: TileWater[][]`, `aqueductTiles: Set<number>`, `flowing: Set<number>`,
`reservoirStates: ReservoirState[]`) `[VERIFIED: src/sim/advisors.ts:169-176]`. No runner getter
produces it today.
**Why it happens:** the runner does not cache a water grid; `derivedSnapshot()` builds a throwaway
`new WaterSystem()`, sets ONE source via `this.buildings.find((b) => b.type === 'well' || b.type ===
'fountain')` (radius 2), and keeps only `coveredTiles`/`totalTiles` in `derived.water`
`[VERIFIED: src/sim/runner.ts:1316-1321,1336]`.
**How to avoid:** add `getWaterOverlay(): Record<string, number[][]>` on the runner that assembles
`WaterOverlayInput` from ALL live well/fountain buildings (compute the grid once via `WaterSystem`),
passes empty `aqueductTiles`/`flowing` Sets and `[]` reservoirStates (those systems are not wired;
reservoir is not even a placeable `BuildingType` — no `'reservoir'`/`'aqueduct'` in the union
`[VERIFIED: src/sim/types.ts:17-26]`), and calls `waterOverlayData`. Houses' `houseWaterClass` reads
from `WaterSystem.compute`. Note: `grand` (3) is never emitted today `[VERIFIED: src/sim/advisors.ts:178-181]`.
**Warning signs:** a plan that renders the water overlay by reading `getDerived().water` (which only
has `coveredTiles`/`totalTiles`).

### Pitfall 3: golden-byte constraint — never grow `BuildingState`/`WalkerState`
**What goes wrong:** adding e.g. `safety`/`civic`/`residentClass` to the serialized building/walker
snapshots breaks `tests/golden/golden.test.ts` `expect(state).toEqual(recorded)` on `getStateJson()`
and every determinism round-trip.
**Why it happens:** the codebase explicitly keeps internals "never serialized to BuildingState, so
goldens/SimState stay byte-identical" (see many comments, e.g. walkers.ts:100-102,179-183;
STATE.md decisions).
**How to avoid:** enrich inspectors through `runner.getWalkerInternals()` — it returns live
`SimInternals` including the full `BuildingInstance[]`/`WalkerInstance[]` arrays and `buildingById`
`[VERIFIED: src/sim/runner.ts:2501-2503,3011-3021]` — and/or add a dedicated read-only
`getInspector(id)` getter. Never touch `toBuildingState`/`toWalkerState` (runner.ts:3065-3122).
**Warning signs:** a plan diff touching `toBuildingState`/`toWalkerState` or the `BuildingState`
interface.

### Pitfall 4: water coverage divergence — derived.water counts only the first well
**What goes wrong:** the water *overlay* (aggregating all sources) may show coverage the stats water
% (from `getDerived().water`) does not, so the two disagree under multiple wells/fountains.
**Why it happens:** `derivedSnapshot()` uses `find()` — the first well/fountain only
`[VERIFIED: src/sim/runner.ts:1317]`.
**How to avoid:** either (a) make `getWaterOverlay()` aggregate all sources and accept the stats/%
tracks only the first — flag to the user; or (b) fix `derivedSnapshot()` to aggregate all sources
(no golden impact — `derived.water` is not in `getState()`; `tests/integration/buildings-catalog.test.ts:90`
only asserts `> 0`). Prefer (b) so the HUD % and the overlay agree; confirm with the discuss-phase.
**Warning signs:** overlay watermark and stats % disagree after placing 2+ wells.

### Pitfall 5: `residentClass` has no live sim source
**What goes wrong:** UI-SPEC lists `residentClass` as mandatory for the residence inspector, but the
sim's per-resident population model (`src/sim/population.ts` `Residence` class) is a standalone,
NOT runner-wired module; `BuildingState.house` carries no class/population count — only
`populationCapacity` `[VERIFIED: src/sim/types.ts:130-150]`.
**How to avoid:** do not block the inspector on a live class field. Either omit it, derive it from
house tier (patrician = high-tier residences) and mark the derivation, or leave the field as the
pure-projection currently stubs it. Flag as open question Q1.
**Warning signs:** a task asserting `state.buildings[i].house.residentClass` compiles.

### Pitfall 6: innerHTML interpolation of sim-derived strings (light DOM-XSS)
**What goes wrong:** the popup/log build HTML with template strings
(`renderPopup` uses `` `${BUILDINGS[building.type].name}` `` and `<div class="row">` fragments)
`[VERIFIED: src/game/scenes/HUDScene.ts:351-357]`; interpolating a message/building string with
markup could inject. Local single-player content is low-risk, but simulator messages are not escaped.
**Why it happens:** convenience of template literals over `textContent`.
**How to avoid:** for any dynamic sim-derived text (message text, advisor strings, name fields), use
`textContent` or escape; keep static HTML/CSS in the template. Existing log rendering already uses
`textContent` (HUDScene.ts:292) — extend that convention to new surfaces.
**Warning signs:** `innerHTML` + `${...}` interpolation of `messages`/advisor data in new code.

### Pitfall 7: overlay/cheatmaps must not break camera or pointer click-through
**What goes wrong:** overlay layers catching pointer events would break pan/zoom, or covering
buildings would hide them.
**Why it happens:** Phaser layers/render-orders and `input.enabled` are easy to misconfigure.
**How to avoid:** draw overlay heatmaps as Graphics/texture layers below the building sprites
(UI-SPEC §Map view: "below buildings for legibility"), keep the single `pointerup → emitInspect`
path, map highlighted tile → entity via the same building-footprint lookup `emitInspect` uses
(MainScene.ts:462-471), and keep wheel/drag handlers untouched.
**Warning signs:** an e2e where wheel-zoom or right-drag stops working while an overlay is active.
## Code Examples

All examples verified in-repo this session.

### Tick-guard + advisor composition skeleton (HUDScene.update)
```typescript
// Source: src/game/scenes/HUDScene.ts:37-41 pattern; advisor mix from runner getters.
override update(): void {
  const state = this.main?.runner.getState();
  if (!state || !this.els.pop) return;
  if (state.tick === this.lastTick) return;
  this.lastTick = state.tick;
  this.renderStats(state, this.main!.runner.getDerived());
  if (this.drawerOpen) this.renderActiveAdvisor(this.main!.runner); // per active tab
  this.renderLog(state.messages);
}
```

### Runner getter audit — the exact UI-SPEC-cited getters, all verified present except `getWaterOverlay`
```typescript
// Source: src/sim/runner.ts (getter list 273-2513) — each confirmed:
// getState, getDerived, getCivilizationOverlay, getCivicStats, getTutorial, getCodex,
// getProductionAdvisorRows, getProductionAdvisor, getLogisticsAdvisor, getTradeAdvisor,
// getObjectiveProgress, getFinanceAdvisor, getFestival, getGovernance, getPopulation,
// getRequests, getEmployment, getEvents, getMissionProgress, getCampaignProgress,
// getMission, getTradeRoutes, getWalkerInternals, getCommandLog, getSaveData, getStateJson.
// ☐ getWaterOverlay — DOES NOT EXIST (gap this phase must fill).
```

### Assembling the water overlay in the runner (recommended addition)
```typescript
// Recommended — assembles WaterOverlayInput that today exists only in water.ts/advisors.ts.
// grid: WaterSystem.compute(width, height, () => 0) with ALL live well/fountain sources;
// aqueductTiles/flowing: empty Set (AqueductSystem not wired to runner);
// reservoirStates: [] (reservoir not placeable — no 'reservoir' in BuildingType union).
getWaterOverlay(): Record<string, number[][]> {
  const ws = new WaterSystem();
  ws.setSources(
    this.buildings
      .filter((b) => b.type === 'well' || b.type === 'fountain')
      .map((b) => ({ x: b.x, y: b.y, kind: 'well' as const, active: true, radius: 2 })),
  );
  const grid = ws.compute(this.width, this.height, () => 0);
  return waterOverlayData({ width: this.width, height: this.height, grid,
    aqueductTiles: new Set(), flowing: new Set(), reservoirStates: [] });
}
```

### Enriched inspector projections (recommended pattern)
```typescript
// Source: current minimal stubs at src/sim/advisors.ts:281-303 — enrich additively, keep pure.
// residenceInspection(population, capacity, residentClass, services, goods)
//   currently returns { population, capacity, residentClass, services, goods };
// productionInspection(inputs, output, status) → { inputs, output, status };
// storageInspection(stock, usedSlots, capacity) → { stock, usedSlots, capacity };
// marketInspection(inventory, buyerRadius) → { inventory, buyerRadius };
// walkerInspection(id, x, y, status, stepsUsed, maxSteps) → { id, x, y, status, stepsUsed, maxSteps }.
// The rich fields to pass live in BuildingInstance/HouseInstance/WalkerInstance internals:
//   house: level, satisfiedTicks, unsatisfiedTicks, services(TTLs), foodInventory, civic
//   safety: fire, danger, collapseRisk, crime            (walkers.ts:180-191)
//   production: inputs/output/active/blocked             (production.ts:105-112)
//   walker: path, carriedAmount, origin, stepsTaken, trade.waitTicks (walkers.ts:28-63)
// Reach them via runner.getWalkerInternals().buildings / .walkers, NEVER via getState().
```

### Existing overlay e2e-style data-testid conventions
```typescript
// Source: e2e/helpers.ts:29-32 + inspect.spec.ts/placement.spec.ts.
// Every interactive control carries data-testid (build-road, speed-1, pause-button,
// building-popup, toast, pause-overlay, stat-population …); e2e opens via '?test&seed=1337'
// and drives the __cityApi hook. New controls (Advisors, overlay toggles, inspector Next ◀/▶)
// must follow the same data-testid convention so Playwright can assert wiring.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Minimal single-popup inspect (HUDScene.renderPopup: tier/workers/wheat rows) | 5 full inspectors (residence/productive/storage/market/walker) with Next ◀/▶ cycling | This phase | All entity inspection moves onto richer pure projections. |
| No overlays rendered in MainScene | Tile heatmap layers (water/food/risks/coverage/desirability) + legends + click-through | This phase | Requires the new `getWaterOverlay()` runner getter (single missing sim-side piece). |
| `advisorsFrom` consumed ad hoc (only `foodHudFromState` in the HUD today) | Full 13-advisor drawer, each panel a live composition over getters | This phase | UI-02 success criterion; composition is view-layer, sim getters unchanged. |
| Derived water % from first-well-only count | (Recommended) aggregate all sources in `derivedSnapshot` so overlay % and stats agree | This phase | Small runner change; zero golden impact (water not in `getState()`). | |

**Deprecated/outdated:**
- `advisorsFrom('name')` string-keyed style: **never existed** — it takes a `SimSnapshot`; any plan
  text citing string-keyed advisor lookups must be corrected (UI-SPEC contains two such citations). 
- The single `renderPopup` sheet (HUDScene.ts:319-360): superseded by the 5 inspector renderers
  (can remain as a fallback for non-specialized buildings).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Runtime "Roman parchment" / color ramps / spacing tokens (UI-SPEC) are implementable in `index.html` without a new design system | Standard Stack | Low — style-only; adjust ramp hexes in the view. Verify visually via e2e (`building-sprite-visual` precedent). |
| A2 | `residentClass` absent from live sim; should be derived from house tier or omitted in the residence inspector | Common Pitfalls | Medium — UI-SPEC lists it mandatory; a wrong assumption produces a fabricated value. Need discuss-phase confirmation (Q1). |
| A3 | Reservoir/aqueduct overlays intentionally render empty (all-zero grids) because those systems aren't wired and reservoir isn't buildable this phase | Common Pitfalls / Summary | Medium — if a stakeholder expects live reservoir display, scope grows to WATR-02/03. Keep the overlay keys present but empty; document. |
| A4 | Fixing `derivedSnapshot` to aggregate all water sources (for overlay/% agreement) is safe for goldens | Common Pitfalls | Low — `derived.water` is not in `getState()`; only `tests/integration/buildings-catalog.test.ts:90` (`>0`) and campaign snapshots set it manually. Confirm at discuss. |
| A5 | Advisor drawer default tab = advisor of newest critical alert, else Ratings (UI-SPEC) — mapping "newest critical alert" to an advisor is a UI heuristic needing a stable rule | Architecture Patterns | Low — purely cosmetic; fall back to Ratings if ambiguous. |

## Open Questions

> All a question are RESOLVED — the plan (18-PLAN.md) implements the recommendations below.

1. **How should `residentClass` be presented in the residence inspector given no live source?** *(RESOLVED — derive from tier)*
   - What we know: `population.ts` `Residence` class is standalone (not runner-wired); no class on `BuildingState.house`.
   - What's unclear: whether to (a) omit, (b) derive from tier (patrician high-tiers), or (c) wire the population module into the runner (large, out of scope).
   - Recommendation: derive from tier now, omit if contested; record in the plan; do not block UI-04 on it.
   - **Resolution (plan 18-04-01):** residence inspector derives a class label from `house.level`/tier (high tiers → patrician); population module not wired.
2. **Should `derivedSnapshot`'s water coverage aggregate all sources, or keep first-well semantics?** *(RESOLVED — aggregate all sources)*
   - What we know: stats % and a full water overlay would otherwise diverge.
   - What's unclear: whether the divergence is acceptable in this phase.
   - Recommendation: aggregate all sources (one-line change, no golden impact); confirm at discuss.
   - **Resolution (plan 18-03-01):** `getWaterOverlay()` aggregates ALL well/fountain sources via `WaterSystem.setSources`+`compute`; `derivedSnapshot` water aggregation aligned so stats % and the overlay agree.
3. **Overlay legend ramp correctness for water `0..3` (grand)** *(RESOLVED — keep legend, no action; aqueduct not in scope this phase)*
   - `WaterSystem` never emits `grand` today, so the top ramp step is dormant; keep the legend but note it. No action needed unless WATR-03 (aqueduct) lands this phase (it does not).
   - **Resolution (plan 18-03-02):** water legend keeps the `grand` step documented as dormant; reservoir/aqueduct grids expected 0; no aqueduct/reservoir build this phase (no scope creep).
## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | dev/test toolchain | ✓ | 20.20.1 | — |
| npm | installs | ✓ | 10.8.2 | — |
| Vitest | unit/integration/determinism/golden tests | ✓ | 3.2.7 | — |
| Playwright (chromium) | e2e data-testid flows | ✓ | 1.62.1 (npx) | headless chromium via `npm run test:e2e` |
| Vite dev server | e2e webServer + dev | ✓ | 6.4.3 | `vite build` preview |
| Phaser | runtime engine | ✓ | 3.90.0 | — |

**Missing dependencies with no fallback:** none — all tooling verified present.
**Missing dependencies with fallback:** none.

## Validation Architecture

> `.planning/config.json` is absent — `workflow.nyquist_validation` treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.7 (unit/integration/determinism/golden/property) + Playwright 1.62.1 (e2e) |
| Config file | `vitest.config.ts` (node env, include `tests/**/*.test.ts`), `playwright.config.ts` (chromium, :5173, workers 1) |
| Quick run command | `npm run test:unit -- tests/unit/advisors.test.ts` (pure functions, <30s) |
| Full suite command | `npm test` (`vitest run`), plus `npm run test:e2e` for browser flows |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Every new control (Advisors/Overlays/Messages, overlay toggles) dispatches a real handler | e2e | `npx playwright test e2e/management-ui.spec.ts` (new) | ❌ Wave 0 |
| UI-01 | Build button gets unaffordable-disabled state | e2e | same management-ui.spec.ts | ❌ Wave 0 |
| UI-02 | Advisors compose over live getters; tick-guard skips re-render on same tick | unit (pure composer) + e2e | `npm run test:unit -- tests/unit/advisor-composer.test.ts` (new) + e2e | ❌ Wave 0 |
| UI-03 | `getWaterOverlay()` aggregates multiple wells; grids sized width×height; zero aqueduct/reservoir | unit (runner) | `npm run test:unit -- tests/unit/water-overlay.test.ts` (new) | ❌ Wave 0 |
| UI-03 | Overlay toggles render heatmap + legend + click-through→inspector | e2e | management-ui.spec.ts | ❌ Wave 0 |
| UI-04 | Enriched pure inspections project the new fields deterministically | unit | extend `tests/unit/advisors.test.ts` (inspectors block) | ✅ extend |
| UI-04 | 5 inspector popups open on click with close/Next navigation | e2e | extend `e2e/inspect.spec.ts` | ✅ extend |
| Req guard | No `getStateJson()` change from any UI work | determinism/golden | `npm run test:unit -- tests/golden tests/determinism` | ✅ |

### Sampling Rate
- **Per task commit:** `npm run typecheck && npm run test:unit -- tests/unit/advisors.test.ts`
- **Per wave merge:** `npm test` (full vitest) + `npm run test:e2e` (browser)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/water-overlay.test.ts` — new runner getter `getWaterOverlay()` (multiple wells, bounds, zero aqueduct/reservoir)
- [ ] `tests/unit/advisor-composer.test.ts` — the pure 13-advisor composition helper (or extend an existing advisors test)
- [ ] `e2e/management-ui.spec.ts` — control-bar / advisor drawer / overlay bar / build-disabled e2e
- [ ] Extend `tests/unit/advisors.test.ts` inspectors block and `e2e/inspect.spec.ts` for the 5 inspectors

## Security Domain

> `security_enforcement` key absent from config — treated as enabled. This is a local
> single-player, non-network game; the surface is the DOM UI over a deterministic sim.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — no accounts, local-only |
| V3 Session Management | no | N/A — no sessions/network |
| V4 Access Control | no | N/A — single actor, local state |
| V5 Input Validation | yes | All player input funnels through sim validators: `setPolicy` clamps via `clamp01` `[VERIFIED: src/sim/runner.ts:1815-1827]`; `placeBuilding` returns `PlacementResult` errors; commands are replayable SaveCommands with exhaustive dispatch `[VERIFIED: src/sim/runner.ts:3133-3170]`. UI passes numbers through, never re-validates. |
| V6 Cryptography | no | N/A — no secrets, local save via localStorage (`src/game/save.ts`) |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| DOM injection via `innerHTML` interpolation of sim-derived strings in popup/log/advisor surfaces | Tampering | Use `textContent` for dynamic strings; keep static markup in templates (existing HUD log already does this — HUDScene.ts:292). |
| Duplicated/divergent sim state (view recomputes vs projection drift) | Tampering (logic) | Views read only `getState()/getDerived()/runner getters`; deterministic pure projections are the only render source. |

## Sources

### Primary (HIGH confidence — verified in-repo this session)
- `src/game/scenes/HUDScene.ts` (365 lines) — current HUD controls, wiring, tick guard, data-testids
- `src/game/scenes/MainScene.ts` (588 lines) — rendering, input, emitInspect, build/pause/speed, exposeTestApi
- `src/sim/advisors.ts` (903 lines) — all advisor/overlay/inspection pure projections
- `src/sim/runner.ts` (3187 lines) — getter inventory (273–2513), derivedSnapshot water logic (1316–1321, 1336), toBuildingState/toWalkerState (3065–3122), simInternals/getWalkerInternals (2501–2503, 3011–3021), productionNotes (1564–1609), setPolicy (1815–1827)
- `src/sim/types.ts` — BuildingState/WalkerState/SimState shape
- `src/sim/walkers.ts` — BuildingInstance/HouseInstance/WalkerInstance/BuildingSafetyState internals
- `src/sim/water.ts` — WaterSystem/TileWater/AqueductSystem/ReservoirState (warehouse/water models)
- `src/sim/population.ts` — standalone Residence model (not runner-wired)
- `src/sim/ui.ts` — MessageLog (capacity 50) / CameraState / Options
- `src/sim/housingEvolution.ts` — evolution eligibility + requirements catalog
- `tests/unit/advisors.test.ts`, `tests/runner-accessors.test.ts`, `tests/golden/golden.test.ts` — testing conventions
- `e2e/inspect.spec.ts`, `e2e/placement.spec.ts`, `e2e/sessions.spec.ts`, `e2e/helpers.ts` — e2e conventions
- `vitest.config.ts`, `playwright.config.ts`, `package.json`, `index.html` — toolchain + style system

### Secondary (MEDIUM confidence)
- `18-UI-SPEC.md` — design contract (trusted as design intent; corrected where it mis-cites the API, e.g. `advisorsFrom('name')` and `getWaterOverlay`)
- `18-CONTEXT.md` / `18-RESEARCH-DISPATCH.md` — phase decisions and investigation brief

### Tertiary (LOW confidence)
- None — all claims traced to in-repo files read this session or marked `[ASSUMED]` in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; Phaser/vitest/playwright versions verified via `npm ls`
- Architecture: HIGH — every sim-side integration point (getters, projections, internals seam) verified in source
- Pitfalls: HIGH — grounded in live code (golden-byte constraint, water overlay gap, advisorsFrom shape); the residentClass and water-/% divergence items flagged for discuss confirmation

**Research date:** 2026-08-05
**Valid until:** ~2026-09-05 (30 days — stack is stable; no version drift expected within the phase)




