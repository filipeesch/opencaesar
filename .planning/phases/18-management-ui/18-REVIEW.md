---
phase: 18-management-ui
reviewed: 2026-08-06T02:40:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/game/advisors.ts
  - src/game/scenes/HUDScene.ts
  - src/game/scenes/MainScene.ts
  - src/game/palette.ts
  - src/sim/runner.ts
  - src/sim/advisors.ts
  - index.html
  - tests/unit/water-overlay.test.ts
  - tests/unit/advisor-composer.test.ts
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: fixed
---

# Phase 18: Code Review Report

**Reviewed:** 2026-08-06T02:40:00Z
**Depth:** standard (language-aware + cross-module tracing)
**Files Reviewed:** 9 source/test files from the phase's implementation commits (92a0ba2..e626c8b)
**Status:** issues_found → fixed (see 18-REVIEW-FIX.md; all 1 Critical + 6 Warning findings fixed; Info findings deferred as out of scope).

## Summary

Reviewed the Phase-18 Management UI against the dispatch focus areas: the 13-advisor composer (`src/game/advisors.ts`), `getWaterOverlay()`/`getInspector()` runner seams, the enriched `*Inspection` projections, the HUD control bar / drawer / overlay bar / inspector popups, the MainScene heatmap layer, `OVERLAY_RAMPS`, and index.html CSS. Determinism and golden integrity are sound: `tests/golden` + `tests/determinism` (76 tests) pass, `git status --porcelain tests/golden` is empty, and the new `water-overlay`/`advisor-composer`/`advisors` unit suites pass. No `Math.random()`/`Date.now()`/`new Date()` was introduced into `src/sim`, and all new sim-derived DOM surfaces use `createElement`/`textContent` (no `innerHTML` interpolation on the new surfaces).

One **Critical** defect was proven, not guessed: building and walker IDs come from two independent counters both starting at 1, and `getInspector(id)` resolves buildings first — so a walker whose id overlaps a live building id cannot open the walker inspector (it resolves to the building), and Next/Prev cycling can open the wrong-kind popup. Additionally, the water overlay never renders the well/fountain coverage area, and several inspector/advisor panels display fabricated or mislabeled values. See findings below.

## Critical Issues

### CR-01: Walker inspector is shadowed by the building ID space — `getInspector` resolves buildings first

**Status:** fixed — commit `820816c` (kind-disambiguated `getInspector(id, kind)`; HUD walker call sites pass `'walker'`; regression suite `tests/unit/inspector-id-collision.test.ts` proves a colliding walker id opens the walker inspector)

**File:** `src/sim/runner.ts:2555-2577` (getInspector), `src/sim/runner.ts:188-189` (id counters), `src/game/scenes/HUDScene.ts:432-449` (hud-walker-inspect handler), `src/game/scenes/HUDScene.ts:853-869` (navInspector)

**Issue:** `nextBuildingId` and `nextWalkerId` are independent counters **both starting at 1**. `getInspector(id)` looks up `this.buildingById.get(id)` **before** `this.walkers.find(...)`, so any walker whose numeric id equals a live building id resolves to the *building*. Since a fresh city places buildings (ids 1..N) then spawns walkers (ids 1..M), walker ids 1..min(N live buildings) overlap by construction. Consequences:
- Clicking a walker tile emits `hud-walker-inspect` with the walker id, but the HUD handler calls `getInspector(id)` and the `inspector?.kind === 'walker'` guard fails for colliding ids → the walker inspector **never opens** (silent no-op).
- `navInspector` for walker cycling calls `getInspector(id)`; a colliding id returns `kind: 'building'` → the **building** popup opens while the player believes they are cycling walkers.
- Because e2e retries with the *oldest* surviving walker (an id that after 400 ticks usually exceeds the live-building count), the existing `inspect.spec.ts` test passing does not absolve the collision.

**Proof:** A temporary unit probe (since removed) that placed 4 buildings and ran 200 ticks found 7 live walkers whose ids collided with live building ids, and `getInspector(walker.id)` returned `kind: 'building'` for every one of them.

**Fix:** Disambiguate by kind at the seam. Cleanest options:
1. Prefer walkers in `getInspector` only when the caller is known to be a walker — add a `kind` parameter: `getInspector(id, kind?: 'building' | 'walker')` and have `hud-walker-inspect` pass `'walker'`:
```ts
getInspector(id: number, kind?: 'building' | 'walker') {
  if (kind !== 'walker') {
    const b = this.buildingById.get(id);
    if (b) return { kind: 'building', snapshotId: id, building: ..., internals: b };
  }
  const w = this.walkers.find((walk) => walk.id === id);
  if (w) return { kind: 'walker', ... };
  return null;
}
```
2. Or make the walker id space non-overlapping (e.g. walker ids offset by a high base, or `nextWalkerId = nextBuildingId + BigOffset`), which also fixes `navInspector`'s `getInspector` calls with no code changes.

**Blocking:** YES — UI-04 walker inspector is a headline deliverable and fails for a large subset of walkers.

## Warnings

### WR-01: Water overlay heatmap never paints the coverage area (only source tiles and houses)

**Status:** fixed — commit `d56a632` (water case now paints `wellCoverage`/`fountainCoverage` region in addition to sources + house classes)

**File:** `src/game/scenes/MainScene.ts:196-204` (water case in renderOverlay)

**Issue:** The water overlay builds its `cells` from `sources` (0/1 at the well/fountain tile itself) and `houseWaterClass` only — the `wellCoverage`/`fountainCoverage` grids that `getWaterOverlay()` computes (and that the UI-SPEC lists as the water overlay's grid source: "sources, wellCoverage, fountainCoverage, houseWaterClass …") are never rendered. The result: a well's radius of coverage is invisible; only the source tile and house-class tiles are highlighted. This under-delivers the UI-03 "water layer visualizes well/fountain coverage" contract and makes the heatmap misleading (the player cannot see where water actually reaches).

**Fix:** include the coverage grids in the cell composition, e.g.:
```ts
const ov = this.runner.getWaterOverlay();
cells = Array.from({ length: height }, (_, y) =>
  Array.from({ length: width }, (_, x) =>
    ov.sources[y][x] > 0 ? 4
      : ov.wellCoverage[y][x] > 0 || ov.fountainCoverage[y][x] > 0 ? 1
      : ov.houseWaterClass[y][x],
  ),
);
```

### WR-02: Production inspector fabricates inputs and mislabels stock as output

**Status:** fixed — commit `69496a3` (production inspector feeds live `ProductionState.inputs`/`.output` and a status derived from live state; stock is never relabeled as output)

**File:** `src/game/scenes/HUDScene.ts:771-785` (renderBuildingRows production branch)

**Issue:** The production inspector calls `productionInspection({}, { ...building.stock }, building.active ? 'working' : 'blocked', {...})`:
- `inputs` is hardcoded `{}`, so the "In <g>" rows never render real inputs (the live `ProductionState.inputs` from `internals.production` is never surfaced even though it is passed in).
- `output` is set to `building.stock`, then rendered as `Out <g>` — so warehouse/workshop *stock* is displayed as if it were current *output*, mislabeling data.
- `status` is derived from `building.active` rather than the live `ProductionState` status.

This contradicts the UI-02/UI-04 promise that inspector fields trace to real getters/projections and never fabricate.

**Fix:** pass the live production internals explicitly and label honestly:
```ts
const p = internals?.production;
const insp = productionInspection(
  p?.inputs ?? {}, p?.output ?? { ...building.stock }, p?.status ?? (building.active ? 'working' : 'blocked'),
  { production: p, active: building.active, ... },
);
```

### WR-03: Advisor "Water Grid Cells" is a meaningless sum across all water grids (incl. negative desirability)

**Status:** fixed — commit `2a27af3` (metric now counts tiles with any well/fountain coverage — a real physical metric; the raw cross-grid sum incl. negative desirability is gone)

**File:** `src/game/advisors.ts:224-225` (housing panel)

**Issue:** `const waters = Object.values(waterOverlay ?? {}).reduce(...)` sums **every cell of every grid** returned by `getWaterOverlay()` — `sources` + `wellCoverage` + `fountainCoverage` + `houseWaterClass` + `aqueductPresent` + `aqueductFlow` + `reservoirFilled` + `reservoirLevel` + `desirability`. Because `desirability` carries negative well penalties (-4) and the coverage/class grids double-count tiles, "Water Grid Cells" is a fabricated number with no physical meaning (and can even go negative), violating the "never fabricated numbers" rule the composer was built to enforce.

**Fix:** make the metric mean something or drop it. If the intent is "tiles with any water coverage", compute from the union like the unit test does:
```ts
const waters = (() => {
  const o = waterOverlay ?? {};
  let c = 0;
  for (let y = 0; y < (o.wellCoverage?.length ?? 0); y++)
    for (let x = 0; x < (o.wellCoverage?.[y]?.length ?? 0); x++)
      if (o.wellCoverage?.[y]?.[x] || o.fountainCoverage?.[y]?.[x]) c++;
  return c;
})();
```
(Or remove the row entirely.)

### WR-04: `game.events` listeners are never removed — duplicated side effects across restarts

**Status:** fixed — commit `abe980d` (both scenes store bound handlers and off() them via a scene `SHUTDOWN` hook, so restarts no longer stack duplicate `setOverlay`/popup renders)

**File:** `src/game/scenes/MainScene.ts:150` (`this.game.events.on('overlay-toggle', ...)`), `src/game/scenes/HUDScene.ts:413-456` (wireEvents) — no `this.game.events.off(...)` anywhere in either scene

**Issue:** `game.events` is Phaser's global emitter and outlives scene restarts. `restartToHome()` stops and re-launches Main/HUD, whose `create()` re-registers listeners (`overlay-toggle` in MainScene; `hud-inspect`, `hud-walker-inspect`, `overlay-legend`, `game-pause`, etc. in HUDScene). With no `game.events.off` on shutdown, every restart within a session doubles the handlers: one `emit('overlay-toggle')` calls `setOverlay` N times, one `emit('hud-inspect', id)` renders the popup N times, and memory grows. The Phase-18 additions (`overlay-toggle`, `hud-walker-inspect`, `overlay-legend`) compound the pre-existing pattern.

**Fix:** remove listeners on scene shutdown, e.g. in each scene add:
```ts
override shutdown(): void {
  this.game.events.off('overlay-toggle', this.onOverlayToggle); // store bound handlers as fields
}
```
or use Phaser's scene-scoped emitter (`this.events`) for scene-only signals and keep `game.events` only for cross-scene messaging that is off()'d in shutdown.

### WR-05: Desirability overlay reads only the water-source desirability grid, not tile/house desirability

**Status:** fixed — commit `d9cfc09` (new `getDesirabilityOverlay()` runner getter exposes the same per-tile `desirabilityOf` surface the sim applies to houses; the overlay feeds from it instead of the water delta)

**File:** `src/game/scenes/MainScene.ts:246-250` (desirability case)

**Issue:** The 'D' desirability overlay uses `getWaterOverlay().desirability`, which is only the well/fountain additive delta (-8..+8, mostly 0 off-map-with-no-source). The UI-SPEC defines the desirability overlay as "tile desirability values" — i.e. the desirability surface the sim actually applies to houses (`desirabilityOf(...)` used for house evolution). As implemented, the overlay is blank everywhere except the handful of tiles near wells/fountains, so it does not communicate house desirability at all.

**Fix:** feed the desirability overlay from the same per-tile desirability used by the sim (expose the desirability surface from `getDerived()`/a runner getter, or project `desirabilityOf` per building tile), falling back to water desirability only if the sim surface is genuinely unavailable.

### WR-06: `storageInspection(...)` result is discarded — enriched storage fields never rendered

**Status:** fixed — commit `0e2ac37` (storage popup now uses the projection's output for used/capacity/stock and renders Reserved/In-Transit rows when real internals supply them — no fabricated zeros)

**File:** `src/game/scenes/HUDScene.ts:800-809` (granary/warehouse branch)

**Issue:** Line 803 calls `storageInspection({...building.stock}, Math.min(...), slotCap)` but ignores its return value; the rows that follow are hand-built from `building.stock`. The enriched `reserved`/`inTransit`/`perProduct` fields (UI-04 deliverable for the storage inspector) are therefore computed and thrown away — dead computation plus an unshipped feature. Any future test asserting reserved/in-transit rows in the storage popup will fail.

**Fix:** use the projection's output (and pass real internals) rather than discarding it:
```ts
const insp = storageInspection({ ...building.stock }, used, slotCap,
  { reserved: {...}, inTransit: {...}, perProduct: {...} });
appendRow(body, 'Reserved', String(insp.reserved ? Object.values(insp.reserved as Record<string,number>).reduce((a,b)=>a+b,0) : 0));
appendRow(body, 'In Transit', String(insp.inTransit ? Object.values(insp.inTransit as Record<string,number>).reduce((a,b)=>a+b,0) : 0));
```

## Info

### IN-01: Walker inspector is a static snapshot — never refreshes, never closes on despawn

**Status:** deferred — Info, out of scope for this fix pass (Critical + Warning only); see 18-REVIEW-FIX.md

**File:** `src/game/scenes/HUDScene.ts:432-449`, `update()` renders the popup only when `inspectId !== null`, but walker inspectors set `inspectId = null` and `hud-walker-inspect` does not re-render on tick.

**Issue:** once open, the walker popup never updates as the walker moves and never auto-closes when the walker despawns; it shows stale coordinates/path for a dead entity. Suggest re-rendering under the tick-change guard when a walker inspector is active and closing it when `getInspector(id)` returns null.

### IN-02: `walkerInspection` `maxSteps` is set to remaining lifetime (decrements), not total trip steps

**Status:** deferred — Info, out of scope for this fix pass (Critical + Warning only)

**File:** `src/game/scenes/HUDScene.ts:675-676`

**Issue:** `maxSteps = Math.max(1, walker.lifetime)` passes the *remaining despawn ticks* (which shrink each tick) as the max-steps of the trip; semantically wrong even though the current popup rows don't display `stepsUsed/maxSteps`. Align the parameter with the actual trip length (e.g. the path length) or stop passing a misleading value.

### IN-03: `residenceInspection` HUD call hardcodes `residentClass: 'plebeian'`

**Status:** deferred — Info, out of scope for this fix pass (Critical + Warning only)

**File:** `src/game/scenes/HUDScene.ts:737-741`

**Issue:** every residence inspector passes `'plebeian'` regardless of house tier; the plan's research Q1 asked for a tier-derived class (patrician for high tiers). Not currently displayed, but it is a fabricated value in the projection input. Use the documented tier derivation (e.g. `house.tier >= 3 ? 'patrician' : 'plebeian'`) or drop the param.

### IN-04: `marketInspection` HUD call passes fabricated `housesServed: 0, enabled: []`

**Status:** deferred — Info, out of scope for this fix pass (Critical + Warning only)

**File:** `src/game/scenes/HUDScene.ts:789-793`

**Issue:** the market inspector passes hardcoded `housesServed: 0` and empty `enabled`, then does not render them — dead/untrue data. Either wire real internals (market agent bookkeeping) or remove the fields.

---

_Reviewed: 2026-08-06T02:40:00Z_
_Reviewer: gsd-code-reviewer (adversarial pass)_
_Depth: standard_
