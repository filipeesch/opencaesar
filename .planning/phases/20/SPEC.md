# Phase 20 SPEC — Sidebar & Advisor UI Redesign (Wave 0: Inventory + Test Scaffolds)

Status: **Wave 0 complete** (inventory + RED scaffolds). Wave 1+ implements the target API these tests lock.

## 0. Locked constraints (from CONTEXT.md / UI-RED-01..08)

1. **View-only redesign.** Zero changes under `src/sim/*`; `getState()`/`getDerived()` shapes and SaveData schema unchanged; `tests/golden/*` fixtures byte-identical.
2. **UI-RED-08: zero `innerHTML`/`outerHTML`/`insertAdjacentHTML` in `src/game/**` + `index.html`.** All DOM composed via `createElement` + `textContent` builders.
3. Every existing control keeps a real runner seam — no orphan controls after relocation.
4. UPPERCASE labels verbatim from 18-UI-SPEC; no reworded labels.

## 1. Control inventory — HUDScene.ts (1177 lines) → runner seams

Source of truth: `src/game/scenes/HUDScene.ts`. All seams are read-only runner getters or the existing MainScene command methods (`setBuildMode`, `setPaused`, `setSpeed`, `setOverlay` bus, `restartToHome`, `writeSave`).

| Control (current) | Lines | Existing seam (read) | Existing seam (write) | Wave 1 target |
|---|---|---|---|---|
| Stats panel `.hud-stats` (12 cells: Population/Prosperity/Happiness/Treasury/Employed/Food/Culture/Stability/Favor/Water/Risk/Gov) | 195-211 | `getState().ratings` (population/prosperity/happiness/treasury), `getState().workers`, `getDerived()` (culture/stability/favor/water %/risk/gov) | none (display-only) | **Top status bar** (Population, date, Treasury, ratings) |
| Build panel `.hud-build` (title + 13-category bar + 17-building grid `BUILD_ORDER`) | 213-249, 29 | `BUILDINGS[type].cost`, `BUILDINGS[type].category` | `MainScene.setBuildMode(type)` toggle | **Right sidebar build panel** |
| Policy panel `.hud-policy` (tax/wage sliders) | 251-257 | `runner.getPolicy()` | `runner.setPolicy(taxRate, wageRate)` | **Sidebar tools panel** |
| Message log `.hud-log` | 259-262 | `getState().messages` | none | **Sidebar log surface** |
| Control bar `.hud-control-bar` (Advisors/Overlays/Messages/Settings) | 267-290 | — | `toggleAdvisorsDrawer()`, `toggleOverlayBar()`, `toggleMessagesFocus()`, `toggleSettingsDrawer()` | **Sidebar nav buttons** |
| Advisors drawer `.advisor-drawer` (13 tabs + 13 panel hosts) | 292-323 | `advisorPanels(runner)` (13 feeds), `ADVISOR_TAB_ORDER` (13 ids) | `selectAdvisor(id)` | **Sidebar advisor drawer** |
| Overlay bar `.overlay-bar` (5 toggles + None) | 324-363 | — | `game.events.emit('overlay-toggle', id)` → `MainScene.setOverlay` | **Sidebar overlay toggle group** |
| Settings drawer `.settings-drawer` (opt-graphics/music/sfx/speed/text-size/reduced-motion + Save) | 369-431 | `loadOptions()` | `saveOptions(o)` + `applyOptions(o)` | **Sidebar tools/settings panel** |
| Pause overlay `.pause-overlay` (Resume/Save/Restart) | 468-483 | `getSaveData()` | `setPaused(false)`, `writeSave(getSaveData())`, `restartToHome()` | **Sidebar pause/action group** |
| Pause button `.hud-pause-btn` | 449-453 | — | `setPaused(true)` | **Sidebar pause button** |
| Speed row `.hud-speed-row` (0.5×/1×/2×/4×/8×) | 455-466 | — | `setSpeed(s)` | **Sidebar speed row** |
| Toast `.hud-toast` | 439-442 | — | `game.events.emit('hud-toast')` → `showToast(text)` | **Sidebar toast host** |
| Building/walker inspector popup | 444-447, 824-1116 | `getInspector(id, kind)`, `getWalkerInternals()` | — | **Sidebar inspector card** |

**Decorative (non-wired) control audit: 0.** Every HUDScene button/slider/toggle has a real handler today (verified line-by-line in Wave 0). Nothing to remove; the redesign is pure relocation.

### Runner seam catalog (verified in `src/sim/runner.ts` + `src/game/scenes/MainScene.ts`)

- Reads: `getState`, `getDerived`, `getFinanceAdvisor`, `getTradeAdvisor`, `getProductionAdvisor`, `getLogisticsAdvisor`, `getEmployment`, `getGovernance`, `getRequests`, `getMission`, `getMissionProgress`, `getEvents`, `getFestival`, `getCivicStats`, `getCivilizationOverlay`, `getWaterOverlay`, `getDesirabilityOverlay`, `getInspector`, `getWalkerInternals`, `getPolicy`, `getSaveData`.
- Writes (unchanged): `setPolicy`, `setBuildMode`, `setPaused`, `setSpeed`, `saveOptions/applyOptions`, `writeSave`, `restartToHome`, `setOverlay` (via `overlay-toggle` bus).

## 2. Target layout

### Right sidebar (`.sidebar`)
```
sidebar
├─ nav (Advisors / Overlays / Messages / Settings)
├─ build-panel   (category tabs + 17-building grid)      [seam: setBuildMode]
├─ tools-panel   (policy sliders, settings drawer, pause/restart/save) [setPolicy / loadOptions+saveOptions+applyOptions / setPaused / writeSave / restartToHome]
├─ speed-row     (0.5× 1× 2× 4× 8×)                      [seam: setSpeed]
├─ advisor-drawer (13 tabs + panel host)                 [seam: advisorPanels + ADVISOR_TAB_ORDER]
├─ overlay-group (water/food/risks/coverage/desirability + none) [seam: overlay-toggle bus → setOverlay]
├─ inspector-card (building/walker)                      [seam: getInspector + getWalkerInternals]
└─ log + toast hosts                                     [seam: state.messages + hud-toast]
```

### Top status bar (`.topbar`)
```
topbar
├─ population (getState().ratings.population)
├─ date       (year = floor(tickCount/360), month = floor((tickCount%360)/40)+1; 9 months/yr, month cadence tickCount%40)
├─ treasury   (getState().treasury)
└─ ratings    (prosperity/happiness/culture/stability/favor from getState().ratings + getDerived())
```
Labels verbatim: `POPULATION`, `DATE`, `TREASURY`, plus 18-UI-SPEC stat labels.

## 3. Keyboard map (additive to existing ESC/W/F/R/C/D/X)

| Key | Action | Precedence slot |
|---|---|---|
| `A` | Cycle advisors (open drawer, next tab) | drawer |
| `←` / `→` | Switch panels (drawer tab, else inspector card when one open) | drawer > inspector |
| `Escape` | Close drawer/inspector first, then existing ESC behavior (cancel build mode → toggle pause) | drawer > inspector > build > pause |
| `B` | Toggle build panel | build |
| `1`-`5` | Toggle overlays water/food/risks/coverage/desirability | overlay group |
| existing `W/F/R/C/D/X` | unchanged overlay toggles (back-compat) | overlay group |

**Precedence guard (single router): drawer > inspector > build mode > pause.** A key is consumed by the highest open surface; when drawer or inspector is open, `←/→/Escape/A` never leak to build/pause.

## 4. Per-service overlay hue table (Wave 1 palette)

| Overlay id | Service | Base hue (locked) | Notes |
|---|---|---|---|
| `water` | Wells/Aqueducts | **blue** `#2b7cc4` | water overlay ramp from `getWaterOverlay()` |
| `food` | Granaries/Markets | **green** `#6fcf5f` | food coverage |
| `fire` | Fire risk | **red** `#d05b4a` | fire service |
| `danger` | Collapse risk | **orange** `#e0642c` | structural danger |
| `collapse` | Collapse risk | **brown** `#8f5a2b` | collapse overlay |
| `crime` | Crime | **purple** `#a98fd1` | crime overlay |
| `coverage` | Health/Education | **teal** `#2aa4a4` | civic coverage |
| `desirability` | Desirability | **teal** `#2aa4a4` | desirability overlay |

Hue contract (test-locked): `overlayHue(overlayId, band)` returns a 5-step ramp (`band 0..4`) whose **band 4 base hue** matches the table above; ramps darken toward band 0. Implemented in `src/game/ui/overlays.ts` as `SERVICE_HUES` + `rampFor(hue)`.

## 5. UI-RED-08 audit (Wave 0 finding)

Actual `innerHTML`/`outerHTML`/`insertAdjacentHTML` assignment sites in `src/game/**`:

| File | Line | Site |
|---|---|---|
| `src/game/scenes/HUDScene.ts` | 197 | stats panel template |
| `src/game/scenes/HUDScene.ts` | 253 | policy panel template |
| `src/game/scenes/HUDScene.ts` | 262 | log template |
| `src/game/scenes/HUDScene.ts` | 471 | pause overlay template |
| `src/game/scenes/HUDScene.ts` | 791 | `renderLog` clear (`innerHTML = ''`) |
| `src/game/scenes/HomeScene.ts` | 47 | seed row template |
| `src/game/scenes/HomeScene.ts` | 62 | map-size row template |
| `src/game/scenes/HomeScene.ts` | 114 | home panel template |

Total: **5 HUDScene sites + 3 HomeScene sites = 8 assignment sites** (plus 6 comment mentions of `innerHTML`). Wave 1+ must replace all 8 with `createElement`/`textContent` builders and delete the comments; the `no-innerhtml` RED test scans `src/game/**` and fails until zero.

## 6. RED scaffold contract (Wave 0 deliverables)

Target modules Wave 1+ will implement (tests import these — RED today because they don't exist):

- `src/game/ui/dom.ts` — `el(tag, attrs, children)` + `textContent` helpers; no innerHTML.
- `src/game/ui/sidebar.ts` — `buildSidebarDom(state, derived)` → `{ nav, buildPanel, toolsPanel, speedRow, advisorButton, overlayGroup, inspectorHost, logHost, toastHost }`.
- `src/game/ui/topbar.ts` — `buildTopBarDom(state, derived)` → `{ population, date, treasury, ratings }` (date via tick→year/month rule).
- `src/game/ui/advisorDrawer.ts` — `buildAdvisorDrawer(panels)` → `{ tabHost, panelHost, tabOrder }` with 13 tabs in `ADVISOR_TAB_ORDER`.
- `src/game/ui/overlays.ts` — `SERVICE_HUES` + `overlayHue(id, band)`.
- `src/game/ui/keyboard.ts` — `KEY_MAP` + `KeyRouter.handleKey(key, ctx)` enforcing drawer > inspector > build > pause.

RED test files (8): `tests/unit/{sidebar-controls,sidebar-layout,overlay-hues,advisor-drawer,keyboard,no-innerhtml}.test.ts`, `e2e/{sidebar,keyboard}.spec.ts`. They fail today because the target modules are absent (assertion-level failures: module-not-found at import + the no-innerhtml scan finds the 8 real sites). Wave 1+ makes them green.

## 7. Wave plan

- **Wave 1** — `dom.ts` + `topbar.ts` + `sidebar.ts` relocation (no sim changes); kill HUDScene innerHTML sites; green: sidebar-controls, sidebar-layout, no-innerhtml.
- **Wave 2** — `advisorDrawer.ts` + `overlays.ts`; green: advisor-drawer, overlay-hues.
- **Wave 3** — `keyboard.ts` + e2e; green: keyboard, sidebar.spec, keyboard.spec.
- Golden fixtures re-run byte-identical at every wave (`npm run test:golden`).
