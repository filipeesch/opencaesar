# Phase 18: Management UI - Pattern Map

**Mapped:** 2026-08-05
**Files analyzed:** 12 (7 source, 5 test/e2e)
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/sim/runner.ts` (add `getWaterOverlay()`, aggregate `derivedSnapshot` water, optional `getInspector` seam) | service (runner accessor) | read-only projection (CRUD-read) | `getCivilizationOverlay()` `src/sim/runner.ts:1353-1362` | exact |
| `src/sim/advisors.ts` (enrich 5 `*Inspection` signatures) | service (pure projection) | transform | `productionAdvisorRows()` `src/sim/advisors.ts:669-719` + its `notes` param | exact |
| `src/game/advisors.ts` (NEW — 13-advisor pure composer, e.g. `advisorPanels(runner)`) | service (pure projection) | transform / CRUD-read | `advisorsFrom()` `src/sim/advisors.ts:115-147` | role-match |
| `src/game/scenes/HUDScene.ts` (control bar, advisors drawer, overlay bar, 5 popups, build-disabled) | controller (DOM overlay) | request-response (snapshot read) | `HUDScene.ts` itself — `buildDom()`/`wireEvents()`/`update()` | exact (self-extension) |
| `src/game/scenes/MainScene.ts` (overlay heatmap layer, keyboard W/F/R/C/D/X/A, click-through) | controller (Phaser scene) | streaming (per-frame), event-driven | `MainScene.ts` — `syncEntities()`/`updateGhost()`/`emitInspect()` | exact (self-extension) |
| `src/game/palette.ts` (add overlay ramp tokens + heatmap colors) | config | static | `src/game/palette.ts` itself (`BUILDING_COLORS`/`WALKER_COLORS`) | exact (self-extension) |
| `index.html` (extend CSS: drawer, overlay bar, legend, inspector panels, `:disabled`) | config (styles) | static | `.hud-panel/.hud-build-btn/.hud-popup` `index.html:43-239` | exact |
| `tests/unit/water-overlay.test.ts` (NEW) | test | n/a | `tests/unit/water.test.ts` + `tests/runner-accessors.test.ts` | exact |
| `tests/unit/advisor-composer.test.ts` (NEW) | test | n/a | `tests/unit/advisors.test.ts` + `tests/runner-accessors.test.ts` | exact |
| `tests/unit/advisors.test.ts` (extend inspectors block) | test | n/a | `tests/unit/advisors.test.ts:144-152` | exact |
| `e2e/management-ui.spec.ts` (NEW) | test (e2e) | n/a | `e2e/placement.spec.ts` + `e2e/inspect.spec.ts` | exact |
| `e2e/inspect.spec.ts` (extend 5 inspectors) / `e2e/helpers.ts` (typing only, if needed) | test (e2e) | n/a | `e2e/inspect.spec.ts` + `e2e/helpers.ts` | exact |

## Pattern Assignments

### `src/sim/runner.ts` (runner accessor, read-only projection) — add `getWaterOverlay()`

**Analog:** `getCivilizationOverlay()` — `src/sim/runner.ts:1353-1362`

**Why closest:** identical shape — a read-only getter that assembles per-building inputs from internal `this.buildings` and funnels them into a pure `advisors.ts` projection returning `Record<string, number[][]>`. `getWaterOverlay()` assembles `WaterOverlayInput` (the only UI-SPEC-cited getter that does not exist today) and returns `waterOverlayData(...)`.

**Core getter pattern** (run `src/sim/runner.ts:1353-1362`):
```typescript
  /** Civilization overlay (Phase 11): per-tile fire / danger / collapse /
   *  crime grids projected from the live per-building safety state. */
  getCivilizationOverlay(): Record<string, number[][]> {
    return civilizationOverlayData(
      this.width,
      this.height,
      this.buildings.map((b) => {
        const fp = BUILDINGS[b.type].footprint;
        return { x: b.x, y: b.y, w: fp, h: fp, safety: b.safety };
      }),
    );
  }
```

**Water-source assembly source** (`derivedSnapshot`, `src/sim/runner.ts:1316-1321` — reuse the exact `WaterSystem` usage, but aggregate ALL sources instead of `find()`):
```typescript
    const water = new WaterSystem();
    const well = this.buildings.find((b) => b.type === 'well' || b.type === 'fountain');
    water.setSources(well ? [{ x: well.x, y: well.y, kind: 'well', active: true, radius: 2 }] : []);
    const grid = water.compute(this.width, this.height, () => 0);
```

**Target input shape** (`src/sim/advisors.ts:169-176`, `WaterSystem` API at `src/sim/water.ts:22-39,90-98`):
- `WaterOverlayInput = { width, height, grid: TileWater[][], aqueductTiles: Set<number>, flowing: Set<number>, reservoirStates: ReservoirState[] }`.
- `WaterSystem.setSources(sources: WaterSource[])` where `WaterSource = { x, y, kind: 'well'|'fountain', active, radius }` (`water.ts:22-29`); `compute(width, height, pollutionAt)` returns `TileWater[][]`.
- No `'reservoir'`/`'aqueduct'` in the `BuildingType` union (`types.ts:17-26`), so pass `aqueductTiles: new Set()`, `flowing: new Set()`, `reservoirStates: []`.

**Delta (new getter):**
```typescript
  getWaterOverlay(): Record<string, number[][]> {
    const ws = new WaterSystem();
    ws.setSources(
      this.buildings
        .filter((b) => b.type === 'well' || b.type === 'fountain')
        .map((b) => ({ x: b.x, y: b.y, kind: 'well' as const, active: true, radius: 2 })),
    );
    const grid = ws.compute(this.width, this.height, () => 0);
    return waterOverlayData({
      width: this.width, height: this.height, grid,
      aqueductTiles: new Set(), flowing: new Set(), reservoirStates: [],
    });
  }
```
Add `waterOverlayData` to the existing `./advisors` import block (runner.ts imports `financeAdvisorFromState` there today — search `import { financeAdvisorFromState } from './advisors'`).

**Optional sim-side delta — enriched inspector seam:** `getWalkerInternals()` already returns `SimInternals` with the full `BuildingInstance[]`/`WalkerInstance[]` and `buildingById` (`runner.ts:2501-2503`, `simInternals()` at `runner.ts:3011-3049`). Feed internals into the enriched pure `*Inspection` projections the same way `productionAdvisorRows(state, notes)` is fed by `productionNotes()` (`runner.ts:1564-1609`). **Never touch `toBuildingState`/`toWalkerState`** (`runner.ts:3065-3122`) or the `BuildingState`/`WalkerState` interfaces (`types.ts:116-171`) — golden-byte constraint (`tests/golden/golden.test.ts`).

---

### `src/sim/advisors.ts` (pure projection, transform) — enrich the 5 `*Inspection` functions

**Analog:** `productionAdvisorRows()` — `src/sim/advisors.ts:669-719` (with `ProductionInternalNote` at 652-660)

**Why closest:** the established pattern for "enrich a pure projection with runner-internal data WITHOUT growing the serialized shape" — the runner passes a per-building `notes` Map; the projection uses it when present and falls back to `SimState`-serialized values otherwise.

**The dual-input pattern** (`src/sim/advisors.ts:669-683`):
```typescript
export function productionAdvisorRows(
  state: SimState,
  notes?: Map<number, ProductionInternalNote> | Record<number, ProductionInternalNote>,
): ProductionAdvisorRow[] {
  const noteFor = (id: number): ProductionInternalNote | undefined => {
    if (!notes) return undefined;
    if (notes instanceof Map) return notes.get(id);
    return notes[id];
  };
  const rows: ProductionAdvisorRow[] = [];
  for (const b of state.buildings) {
    const exKey = EXTRACTION_BUILDING_TYPES[b.type];
    ...
    const note = noteFor(b.id);
    if (note) {
      rows.push({ id: b.id, ..., status: note.status, bottleneck: note.bottleneck, ... });
      continue;
    }
    // SimState-only fallback (no internal note): report what is serialized.
    ...
  }
  return rows;
}
```

**Current inspection stubs to enrich** (`src/sim/advisors.ts:281-303`):
```typescript
export function residenceInspection(
  population: number, capacity: number, residentClass: string, services: string[], goods: Record<string, number>,
): Record<string, unknown> {
  return { population, capacity, residentClass, services, goods };
}
export function productionInspection(inputs, output, status) { return { inputs, output, status }; }
export function storageInspection(stock, usedSlots, capacity) { return { stock, usedSlots, capacity }; }
export function marketInspection(inventory, buyerRadius) { return { inventory, buyerRadius }; }
export function walkerInspection(id, x, y, status, stepsUsed, maxSteps) { return { id, x, y, status, stepsUsed, maxSteps }; }
```

**Rich internals available to feed them** (never via `getState()`):
- `BuildingInstance` (`src/sim/walkers.ts:145-177`): `house?`, `production?` (workshop/extraction internals), `safety?` (fire/danger/collapseRisk/crime, `walkers.ts:180-191`), `lastDestinationId?`/`lastDestinationKind?`.
- `HouseInstance` (`walkers.ts:88-122`): `level`, `satisfiedTicks`, `unsatisfiedTicks`, `combinedPopulation`, `services` (TTLs), `foodInventory`, `civic` (health/literacy/entertainment, `walkers.ts:125-132`).
- `WalkerInstance` (`walkers.ts:28-63`): `path`, `carriedAmount`, `origin`, `stepsTaken`, `targetBuildingId`, `trade.waitTicks`.
- `ProductionState` (`src/sim/production.ts:105-112`): `inputs`/`output`/`active`/`blocked`.
- Reach them via `runner.getWalkerInternals().buildings` / `.walkers` / `.buildingById(id)` — **not** `getWalkerInternals` internals? yes it returns `SimInternals` (`walkers.ts:197-224`).

**Delta:** keep each `*Inspection` a pure `(serializedOrBasic, internals?)` projection in the style above — additive params, never writing to `BuildingState`/`WalkerState`. Housing evolution eligibility comes from `HOUSING_LEVELS` + `requirementsSatisfied()`/`decideEvolution()` (`src/sim/housingEvolution.ts`), never re-derived by hand. Keep `residentClass` tier-derived or omitted (research Q1 — no live class source).

---

### `src/game/advisors.ts` (NEW — 13-advisor pure composer, transform)

**Analog:** `advisorsFrom()` — `src/sim/advisors.ts:115-147`

**Why closest:** `advisorsFrom` builds a labeled dataset array purely from an injected snapshot. The 13-advisor composition is the same shape but a **UI-side** composition: take the `SimRunner` (or a narrow read-interface of it), fold `advisorsFrom(snapshot)`'s 8 base datasets together with the dedicated runner getters (`getFinanceAdvisor`, `getTradeAdvisor`, `getProductionAdvisor`, `getLogisticsAdvisor`, `getEmployment`, `getGovernance`, `getRequests`, `getMission`/`getMissionProgress`/`getObjectiveProgress`/`getCampaignProgress`, `getEvents`, `getCivilizationOverlay`, `getCivicStats`) into 13 named panels. Keep it a **pure function of the runner's live state** so `tests/unit/advisor-composer.test.ts` can import and test it in the node-env vitest setup.

**Pattern — dataset assembly with stable order** (`src/sim/advisors.ts:121-146`):
```typescript
  const datasets: AdvisorDataset[] = [
    { name: 'population', data: { population: s.population } },
    { name: 'labor', data: { employed: s.employed, jobs: s.jobs, unemployment: Math.max(0, s.jobs - s.employed) } },
    { name: 'finance', data: { treasury: s.treasury, taxRate: s.taxRate, wageRate: s.wageRate } },
    { name: 'ratings', data: { culture: targets.culture, ... } },
    // ... RATE-01: decomposition appended only when present, additively:
  if (s.decomposition) { ... datasets.push({ name: 'ratings-decomposition', data: buckets }); }
```

**Why NOT extend `advisorsFrom`:** it takes a `SimSnapshot` payload (not a runner) and returns only 8–9 datasets; a string-keyed `advisorsFrom('labor')` does not compile (research Pitfall 1). The composer is the recommended seam so the HUD renders one pure call, not 13 inline compositions.

**Delta:** export `advisorPanels(runner: SimRunner): Record<string, AdvisorPanel>` (or a `ReadonlySim` interface) with panel order locked to the UI-SPEC tab order (7 Ratings default, then 1 Finance…12 Objectives — UI-SPEC §"Advisor tab order"). Each panel carries its live dataset + a "Locate/Open inspector" action descriptor (UI-SPEC Advisors Inventory table). Location: `src/game/advisors.ts` recommended (UI-side composition); `src/sim/ui.ts` is the documented alternative (same pure-import pattern).

---

### `src/game/scenes/HUDScene.ts` (controller, request-response) — control bar, advisors drawer, overlay bar, 5 inspector popups, build-disabled

**Analog:** `HUDScene.ts` itself — `buildDom()`/`wireEvents()`/`update()` (self-extension)

**Why closest:** the new surfaces are the same DOM-backing pattern already in this file: `document.createElement(...)` + `dataset.testid` + `game.events` wiring + tick-change guard. No new mechanism is needed.

**Tick-change guard** (`src/game/scenes/HUDScene.ts:37-41`) — every new surface (advisors, overlay bar, message focus) renders from here:
```typescript
  override update(): void {
    const state = this.main?.runner.getState();
    if (!state || !this.els.pop) return;
    if (state.tick === this.lastTick) return;
    this.lastTick = state.tick;
    // ... stats, log, advisors (new), build-disabled (new)
```

**DOM construction pattern** (`buildDom`, `src/game/scenes/HUDScene.ts:77-138`):
```typescript
    const stats = document.createElement('div');
    stats.className = 'hud-panel hud-stats';
    stats.innerHTML = `... <div class="hud-stat"><span>Population</span><b data-testid="stat-population"></b></div> ...`;
    const build = document.createElement('div');
    build.className = 'hud-panel hud-build';
    ...
    for (const type of BUILD_ORDER) {
      const btn = document.createElement('button');
      btn.className = 'hud-build-btn';
      btn.dataset.testid = `build-${type}`;
      btn.dataset.build = type;
      btn.textContent = `${def.name} (${def.cost})`;
      grid.appendChild(btn);
    }
    root.append(stats, build, policy, log, toast, popup, speedRow, pauseBtn, overlay);
    document.getElementById('hud')?.appendChild(root);
    this.els.pop = root.querySelector('[data-testid="stat-population"]') as HTMLElement;
```
New surfaces follow the same recipe: `control bar` (Advisors/Overlays/Messages buttons, each `data-testid="controls-*"`), `advisors drawer` (tabbed — one `<button class="advisor-tab" data-testid="advisor-tab-<name>">` per advisor, single active panel beneath, regex the `hud-cat-btn active` toggling at `HUDScene.ts:225-232`), `overlay bar` (5 radio toggles, `data-testid="overlay-<key>"`, `:active` highlight per `hud-build-btn.active`).

**Event wiring pattern** (`wireEvents`, `src/game/scenes/HUDScene.ts:224-275`) — new events ride the same bus:
```typescript
    this.game.events.on('hud-inspect', (id: number | null) => {
      if (id === null) { this.closePopup(); }
      else { this.inspectId = id;
        const building = state?.buildings.find((b) => b.id === id);
        if (building) this.renderPopup(building); }
    });
    this.game.events.on('hud-build-mode', () => { ... toggle .active on build buttons ... });
```
Add `game.events.on('overlay-toggle', ...)` / `'advisor-open', ...` here; the HUD-side legend DOM and inspector popups key off the same bus. `hud-toast` stays the updated-status channel (`HUDScene.ts:250`, `showToast` at 298-304).

**Popup renderer** (`renderPopup`, `src/game/scenes/HUDScene.ts:319-360`) — evolve into 5 inspector layouts. Keep the `row(label, value)` helper (`363-365`) and `.ok/.bad` spans; add **Next ◀/▶** buttons (`data-testid="inspector-prev"/"inspector-next"`) that cycle entities of the same kind (stable sort by entity id — UI-SPEC §UI Considerations "entity id (inspector Next navigation)"). Close on pause, build-mode, ESC, click-outside (`HUDScene.ts:251-274` precedent).

**XSS/light-DOM guard:** sim-derived strings (message text, advisor strings) must go through `textContent`, not `innerHTML` interpolation — existing precedent at `renderLog` (`HUDScene.ts:286-296`):
```typescript
    const li = document.createElement('li');
    li.dataset.testid = 'message-entry';
    li.textContent = `[${m.tick}] ${m.text}`;   // textContent — never innerHTML + ${}
    li.classList.add(`msg-${m.type}`);
```

**Build-disabled state (UI-01):** in `update()` set `btn.disabled = state.treasury < BUILDINGS[type].cost`; style with the existing disabled rule in `index.html:313-316` (`.home-btn:disabled { opacity: 0.5; cursor: default; }`) — copy it to `.hud-build-btn:disabled`.

---

### `src/game/scenes/MainScene.ts` (controller, streaming + event-driven) — overlay heatmap layer, keyboard, click-through

**Analog:** `MainScene.ts` itself — `syncEntities()`/`updateGhost()` for Graphics grid drawing, `emitInspect()` for click-through (self-extension)

**Why closest:** overlays are Phaser Graphics drawn per frame over the tile layer, exactly like `ghost`/`entityObjs`; click-through reuses the existing building-footprint lookup.

**Per-frame Graphics rebuild pattern** (`syncEntities`, `src/game/scenes/MainScene.ts:344-359,453-459`) — draw overlay once per frame from the pure grids, destroy/rebuild or `clear()`+redraw each frame:
```typescript
    const items: { depth: number; make: () => RenderObj }[] = [];
    for (const b of state.buildings) { ... const top = tileTop(b.x, b.y); const depth = top.y + n * TILE_H; ... }
    items.sort((a, b) => a.depth - b.depth);
    for (const item of items) { const obj = item.make(); obj.setDepth(item.depth); this.entityObjs.push(obj); }
```

**Grid-fill drawing primitive** (`updateGhost`, `src/game/scenes/MainScene.ts:473-500` + `tileTop` at 536-538 + `drawDiamond` at 543-562) — the heatmap tile-shape is this exact path:
```typescript
    const top = tileTop(tile.x, tile.y);
    ghost.fillStyle(valid ? 0x7dff7d : 0xff5c5c, 0.35);
    ghost.lineStyle(2, valid ? 0x2f9e2f : 0xc0392b, 0.9);
    ghost.beginPath();
    ghost.moveTo(top.x, top.y);
    ghost.lineTo(top.x + (n * TILE_W) / 2, top.y + (n * TILE_H) / 2);
    ghost.lineTo(top.x, top.y + n * TILE_H);
    ghost.lineTo(top.x - (n * TILE_W) / 2, top.y + (n * TILE_H) / 2);
    ghost.closePath(); ghost.fillPath(); ghost.strokePath();
```
Overlay heatmaps use the same diamond fill per `grid[y][x]` value, colored from the view-only ramp tokens (below buildings for legibility — set their `setDepth` below building depths; do NOT touch camera/pan/zoom/wheel handlers at `MainScene.ts:211-261`).

**Click-through** (`emitInspect`, `src/game/scenes/MainScene.ts:461-471`) — a highlighted overlay tile opens the same inspector path (click → `tileAtPointer` (291-308) → `emitInspect` → `hud-inspect`; overlay click just routes here too):
```typescript
  private emitInspect(tx: number, ty: number): void {
    const state = this.runner.getState();
    const building = state.buildings.find((b) => {
      const inX = tx >= b.x && tx < b.x + b.footprint;
      const inY = ty >= b.y && ty < b.y + b.footprint;
      return inX && inY;
    });
    this.game.events.emit('hud-inspect', building && building.type !== 'road' ? building.id : null);
  }
```

**Keyboard pattern** (ESC precedence, `src/game/scenes/MainScene.ts:116-127`) — extend with the locked shortcuts W/F/R/C/D (toggle overlay, one at a time), X (None), A (advisors; `A` handled in HUD DOM is fine too):
```typescript
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.paused) { this.setPaused(false); return; }
      if (this.buildType) { this.setBuildMode(null); return; }
      this.setPaused(true);
    });
```

**Sim-read source for overlays (never recompute):** `runner.getCivilizationOverlay()` (`runner.ts:1353-1362`), `runner.getCivicStats().houses` per-house health/literacy/entertainment (`runner.ts:1367-1386`), `foodOverlayGrids(state)` (`advisors.ts:570-604`), new `runner.getWaterOverlay()`. Legend DOM lives in the HUD (bottom-right, `hud-subtitle` style); it can be rendered from MainScene via a `game.events.emit('overlay-legend', ramp)` to the HUDScene.

---

### `src/game/palette.ts` (config, static) — overlay ramp tokens

**Analog:** `src/game/palette.ts` itself (`BUILDING_COLORS`/`WALKER_COLORS`) — self-extension

**Why closest:** view-only color constants already live here and are imported by MainScene (`import { BUILDING_COLORS, HOUSE_COLORS, TILE_H, TILE_W, WALKER_COLORS } from '../palette';` at `MainScene.ts:18`). Overlay ramps follow the same exported-const style.

**Existing pattern** (`src/game/palette.ts:12-39`):
```typescript
export const BUILDING_COLORS: Record<Exclude<BuildingType, 'house'>, number> = {
  road: 0xc2b088, farm: 0x79b044, granary: 0xd8a963, market: 0x9d7bd1, well: 0x59c4ee, ...
};
export const HOUSE_COLORS: readonly number[] = [0x9e9d9a, 0xc9a27d, 0xd98c3f, 0xdc562e, 0xc9302c];
export const WALKER_COLORS: Record<..., number> = { market: 0xec407a, well: 0x29b6f6, ... };
```

**Delta:** add `OVERLAY_RAMPS: Record<OverlayKind, readonly number[]>` (5-step ramps from UI-SPEC §Color — water blues, food red→amber→green, risks, coverage per-service hues, desirability umber→green→gold) consumed only by the MainScene overlay layer — view-only, never in the sim. (Research `[ASSUMED]` location.)

---

### `index.html` (config, static) — CSS for new panels

**Analog:** existing HUD CSS block `index.html:43-239`

**Why closest:** all new panels must reuse the "Roman parchment" tokens already defined — umber panels `rgba(40,28,14,0.9)`, bronze border `#7a6234`, gold `#e8c46b`, muted gold `#b39a62`, button fill `#4a3517`/hover `#5d4420`/active `#7a5c22`. New classes (`.hud-control-bar`, `.advisor-drawer`, `.advisor-tab.active`, `.overlay-toggle.active`, `.overlay-legend`, `.hud-popup .inspector-nav`) copy the existing rules verbatim and extend with the documented tokens. **Legacy frozen sizes stay**: `.hud-title` 15px, `.hud-overlay-title` 20px, `.home-title` 34px; normalize new horizontal padding to 12px (multiples-of-4, UI-SPEC §Spacing Scale).

**Disabled state to reuse for unaffordable build buttons** (`index.html:313-316`):
```css
      .home-btn:disabled { opacity: 0.5; cursor: default; }
```

---

### `tests/unit/water-overlay.test.ts` (NEW — runner getter test)

**Analog:** `tests/unit/water.test.ts` (`WaterSystem` usage at 4-30) + `tests/runner-accessors.test.ts` (SimRunner getter style, 10-57) + `tests/helpers.ts` (`runScenario`/`place`)

**Why closest:** this test targets the new `SimRunner.getWaterOverlay()` — a runner accessor producing grids, so it needs both the accessor-assert style and the `WaterSystem` setup used by water tests. Unit tests are node-env vitest (`vitest.config.ts` include `tests/**/*.test.ts`).

**Accessor + WaterSystem style** (`tests/unit/water.test.ts:4-12` and `tests/runner-accessors.test.ts:10-33`):
```typescript
import { describe, it, expect } from 'vitest';
import { WaterSystem } from '../../src/sim/water';
// ...
it('wells provide basic water within radius ...', () => {
  const ws = new WaterSystem();
  ws.setSources([{ x: 1, y: 1, kind: 'well', active: true, radius: 2 }]);
  const grid = ws.compute(5, 5, ...);
  expect(ws.waterClassAt(grid, 1, 1)).toBe('basic');
});
```
plus a `SimRunner` with `place(r, 'well', x, y)` (from `tests/helpers.ts:20-24`):
```typescript
export function place(r: SimRunner, type: BuildingType, x: number, y: number): void {
  const result = r.placeBuilding(type, x, y);
  if (!result.ok) throw new Error(`place ${type}@${x},${y} rejected: ${result.error}`);
}
```

**Delta cases (per research Validation Map):** (1) 2+ wells/fountains → overlay `wellCoverage`/`fountainCoverage` grids cover both; grids sized `width × height`; (2) `houseWaterClass` maps 0/1/2 (never 3 grand); (3) `aqueductPresent`/`aqueductFlow`/`reservoirFilled`/`reservoirLevel` all zero with those systems unwired; (4) determinism — same seed + commands → identical `getWaterOverlay()`.

---

### `tests/unit/advisor-composer.test.ts` (NEW — pure composer test)

**Analog:** `tests/unit/advisors.test.ts` (dataset assertions on pure projections, 61-152) + `tests/runner-accessors.test.ts`

**Why closest:** the composer is a pure function of runner state, so tests build a `SimRunner` (empty or `runScenario` with `foodChainMap`/`productionChainMap` from `tests/helpers.ts`), read the composed panels, and assert exact field provenance. Keep the `advisorsFrom(snap)` fixture style (`tests/unit/advisors.test.ts:54-59`) for building the 8 base panels.

**Dataset assertion style** (`tests/unit/advisors.test.ts:62-69`):
```typescript
    const data = advisorsFrom(snap);
    expect(data.map((d) => d.name)).toEqual(expect.arrayContaining(['finance', 'religion', 'health', 'education', 'labor', 'ratings']));
    const health = data.find((d) => d.name === 'health');
    expect(health!.data.wellness).toBe(80);
```

**Delta cases:** composer returns exactly 13 panels in the UI-SPEC lock order (7 Ratings default when no critical alert, else alert-mapped); every panel value traces to a runner getter/snapshot (no fabricated numbers); tick-change guard is a HUD concern (not tested here — the composer snapshot is tick-indexed).

---

### `tests/unit/advisors.test.ts` (extend inspectors block)

**Analog:** the existing `inspectors (task 11.2)` block — `tests/unit/advisors.test.ts:144-152`

**Why closest:** the enrichment is additive to these exact functions; extend the same block with `toMatchObject` assertions on the new fields (services TTLs, safety, civic, walker path), keeping the existing minimal-field assertions intact.

**Current block to extend** (`tests/unit/advisors.test.ts:144-152`):
```typescript
  it('builds residence/production/storage/market/walker datasets', () => {
    expect(residenceInspection(10, 20, 'plebeian', ['well'], { wheat: 2 })).toMatchObject({ population: 10, residentClass: 'plebeian' });
    expect(productionInspection({ clay: 3 }, { pottery: 1 }, 'working')).toMatchObject({ status: 'working' });
    expect(storageInspection({ wheat: 5 }, 3, 16)).toMatchObject({ usedSlots: 3 });
    expect(marketInspection({ wheat: 4 }, 2)).toMatchObject({ buyerRadius: 2 });
    expect(walkerInspection(1, 2, 3, 'travelling', 4, 8)).toMatchObject({ id: 1, status: 'travelling' });
  });
```

---

### `e2e/management-ui.spec.ts` (NEW) + `e2e/inspect.spec.ts` (extend) + `e2e/helpers.ts` (typing)

**Analog:** `e2e/placement.spec.ts` + `e2e/inspect.spec.ts` + `e2e/helpers.ts`

**Why closest:** e2e drives `?test&seed` + `__cityApi` (`e2e/helpers.ts:29-32`), presses UI `data-testid` buttons and asserts sim/stat effects — exactly the flows UI-01..04 need.

**e2e harness (never mention in tests)** (`e2e/helpers.ts:5-22,29-48`):
```typescript
declare global {
  interface Window {
    __cityApi?: {
      place: (type: BuildingType, x: number, y: number) => PlacementResult;
      runTicks: (n: number) => void;
      state: () => SimState;
      derived: () => DerivedSnapshot-ish;
      camera: () => { zoom: number; scrollX: number; scrollY: number };
      setZoom: (z: number) => void;
    };
  }
}
export async function openGame(page: Page): Promise<void> {
  await page.goto('/?test&seed=1337', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__cityApi);
}
export function placeOn(page, type, x, y) { return page.evaluate((args) => window.__cityApi!.place(...), args); }
export function runTicks(page, n) { return page.evaluate((count) => window.__cityApi!.runTicks(count), n); }
```
If the new UI needs a runner query e2e (e.g. asserting `getWaterOverlay` grids), extend `MainScene.exposeTestApi()` (`MainScene.ts:502-526`) with the getter and mirror it in the `helpers.ts` `Window.__cityApi` declaration (`helpers.ts:5-22`) + optional helper.

**Button-click → active-class + sim effect** (`e2e/placement.spec.ts:10-11,159-170`):
```typescript
  await page.getByTestId('build-road').click();
  await expect(page.getByTestId('build-road')).toHaveClass(/active/);
  // ...
  await runTicks(page, 1); await page.waitForTimeout(200);
  const popBefore = Number(await page.getByTestId('stat-population').textContent());
```
New flows reuse this: `controls-advisors` opens the drawer, `advisor-tab-*` switches panels, each overlay toggle `overlay-water` renders a legend (`overlay-legend` becomes visible) + clicking a highlighted tile opens `building-popup`; unaffordable build button asserts `toBeDisabled()`.

**Inspector popup asserts to extend** (`e2e/inspect.spec.ts:4-21` + `47-51`):
```typescript
  const popup = page.getByTestId('building-popup');
  await expect(popup).toBeVisible();
  await expect(popup).toContainText('House');
```
Extend for the 5 kinds (residence, productive, storage, market, walker) and Next ◀/▶ cycling (`inspector-next` navigates to the next same-kind entity, `inspector-prev` back).

**Error capture convention:** `page.on('pageerror', ...)` + `page.on('console', ...)` collecting into `errors`, asserted `toEqual([])` at the end (`placement.spec.ts:5-6,111-118,185`).

**Shared helper reuse:** `pickTile`/`tileCenter`/`zoomOut`/`getState`/`findBuilding`/`toastText` (`e2e/helpers.ts:55-107`).

---

## Shared Patterns

### Tick-change guarded render
**Source:** `src/game/scenes/HUDScene.ts:37-41`
**Apply to:** every new HUD surface (stats, advisors drawer panels, overlay bar, log focus)
```typescript
    const state = this.main?.runner.getState();
    if (!state || !this.els.pop) return;
    if (state.tick === this.lastTick) return;
    this.lastTick = state.tick;
```
Never re-render on identical-tick frames; panels always show the last complete snapshot (no spinner — UI-SPEC §Component States "Tick-stale").

### Pure projection over injected state — never recompute in the view
**Source:** `src/sim/advisors.ts` (`advisorsFrom` 115-147, `waterOverlayData` 194-237, `productionAdvisorRows` 669-719) + runner getters
**Apply to:** every advisor panel, overlay, and inspector row. The view calls a getter/pure function with live state; it never recomputes statuses, eligibility, or coverage (research "Don't Hand-Roll": `HOUSING_LEVELS`/`requirementsSatisfied`, `foodAdvisorFromState`, `productionAdvisorRows`+`productionNotes`, `getCivicStats`, `getTradeAdvisor`, `getFinanceAdvisor`, `getLogisticsAdvisor`).

### Event bus wiring
**Source:** `src/game/scenes/HUDScene.ts:250-274` + `src/game/scenes/MainScene.ts:145-169,461-471`
**Apply to:** overlay toggles (`overlay-toggle`-style), advisor panel opens, legend updates, inspector popups, pause/build-mode steering. Every new control **must** dispatch a real handler/event (UI-01 success criterion) — no decorative buttons.
```typescript
    this.game.events.on('hud-toast', (text: string) => this.showToast(text));
    this.game.events.on('game-pause', () => { ... });
    this.game.events.on('hud-inspect', (id: number | null) => { ... });
    this.game.events.on('hud-build-mode', () => { ... });
    // new: overlay-toggle, advisor-open
```

### textContent over innerHTML for sim-derived strings
**Source:** `src/game/scenes/HUDScene.ts:286-296`
**Apply to:** advisor strings, message log, inspector rows — any `${...}` interpolation of sim text goes through `textContent`; keep static HTML in templates (research Pitfall 6 / ASVS V5).

### Golden-byte constraint — never grow serialized snapshots
**Source:** `src/sim/runner.ts:3065-3122` (`toBuildingState`/`toWalkerState`) + `src/sim/types.ts:116-171`
**Apply to:** `src/sim/advisors.ts` inspector enrichment and any runner getter. Enrich via `getWalkerInternals()` (`runner.ts:2501-2503`) / the `productionNotes` dual-input pattern, never by editing `toBuildingState`/`toWalkerState` or the `BuildingState`/`WalkerState` interfaces. `npm run test:unit -- tests/golden tests/determinism` guards this.

### data-testid on every interactive control
**Source:** `src/game/scenes/HUDScene.ts:85-190` + `e2e/*.spec.ts`
**Apply to:** all new control-bar buttons, advisor tabs, overlay toggles, inspector Next/Prev. Pattern: `btn.dataset.testid = 'controls-advisors'` etc.; asserted via `page.getByTestId(...)`.

### Overlays must not break camera / click-through
**Source:** `src/game/scenes/MainScene.ts:211-261` (wheel/drag untouched) + `emitInspect` 461-471
**Apply to:** overlay heatmap layer — draw below buildings for legibility, keep the single `pointerup → tileAtPointer → emitInspect` path, map highlighted tile → entity via the same footprint lookup.

### Build-disabled styling
**Source:** `index.html:313-316` (`.home-btn:disabled`)
**Apply to:** `.hud-build-btn:disabled { opacity: 0.5; cursor: default; }` when `state.treasury < BUILDINGS[type].cost` in `HUDScene.update()`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | Every planned file maps to an existing in-repo analog. The nearest "new mechanism" is the 13-advisor composer (`src/game/advisors.ts`) — it is a composition over existing getters with no novel machinery; model it on `advisorsFrom` + `productionAdvisorRows`. |

## Metadata

**Analog search scope:** `src/game/`, `src/game/scenes/`, `src/sim/`, `tests/unit/`, `tests/`, `e2e/`, `index.html`, config files (`vitest.config.ts`, `playwright.config.ts`, `package.json`)
**Files scanned:** ~80 (full reads of HUDScene.ts, MainScene.ts, advisors.ts, water.ts key sections, walkers.ts internals, types.ts, palette.ts, ui.ts, production.ts, index.html, main.ts; targeted reads of runner.ts (derivedSnapshot/getCivilizationOverlay/getCivicStats/getProductionAdvisor/productionNotes/getWalkerInternals/simInternals/toBuildingState/toWalkerState), tests (water/advisors/runner-accessors), e2e (inspect/placement/helpers))
**Pattern extraction date:** 2026-08-05
