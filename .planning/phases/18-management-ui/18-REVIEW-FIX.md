---
phase: 18-management-ui
fixed_at: 2026-08-06T09:10:00Z
review_path: .planning/phases/18-management-ui/18-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 18: Code Review Fix Report

**Fixed at:** 2026-08-06T09:10:00Z
**Source review:** `.planning/phases/18-management-ui/18-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (1 Critical — CR-01; 6 Warning — WR-01..WR-06)
- Fixed: 7
- Skipped: 0
- Info findings (IN-01..IN-04): deferred — out of scope (Critical + Warning only per fix scope)

> **Environment note:** this run honored `workflow.use_worktrees: false` in
> `.planning/config.json`, so all edits, verification, and commits ran **directly in
> the main checkout** (branch `main`) — no worktree, no review-fix branch, no
> recovery sentinel. All verification numbers are reproducible from the committed
> working tree.

## Fixed Issues

### CR-01: Walker inspector is shadowed by the building ID space — `getInspector` resolves buildings first

**Files modified:** `src/sim/runner.ts`, `src/game/scenes/HUDScene.ts`, `tests/unit/inspector-id-collision.test.ts` (new regression suite)
**Commit:** `820816c`
**Applied fix:** Replaced the id-only `getInspector(id)` resolve with a kind-disambiguated
signature `getInspector(id, kind?: 'building' | 'walker')` that skips the building lookup when
`kind === 'walker'`. The HUD threads an explicit `inspectKind` through the walker-inspect handler,
`navInspector` (Next/Prev), `renderWalkerInspector` and `renderBuildingRows` so a colliding walker
id (walker and building counters both start at 1) opens the walker inspector and Next/Prev cycles
the same kind without wrong-kind popups. Added `tests/unit/inspector-id-collision.test.ts` (5 tests)
proving the fixture contains live colliding walker+building ids, that the un-kinded resolve returns
the building (documenting the collision), that `getInspector(id, 'walker')` opens the walker
inspector for that id, and that a full same-type walker cycle resolves every id as a walker.

### WR-01: Water overlay heatmap never paints the coverage area (only source tiles and houses)

**Files modified:** `src/game/scenes/MainScene.ts`
**Commit:** `d56a632`
**Applied fix:** The `water` overlay case now composes `wellCoverage`/`fountainCoverage` into the
cell grid (coverage tiles render as the `Basic` band, source tiles as `Source`, house water classes
as before), so the player sees the well/fountain coverage region (UI-03 contract).

### WR-02: Production inspector fabricates inputs and mislabels stock as output

**Files modified:** `src/game/scenes/HUDScene.ts`
**Commit:** `69496a3`
**Applied fix:** The workshop/extraction inspection branch now feeds the live
`ProductionState.inputs`/`ProductionState.output` (via `getInspector` internals) into
`productionInspection` instead of hardcoding `{}` and relabeling `building.stock` as output. Status
is derived from the live production state (`active`/`blocked`) with the old `building.active`
fallback only when internals are absent.

### WR-03: Advisor "Water Grid Cells" is a meaningless sum across all water grids (incl. negative desirability)

**Files modified:** `src/game/advisors.ts`
**Commit:** `2a27af3`
**Applied fix:** The housing panel's "Water Grid Cells" now counts tiles with any
`wellCoverage`/`fountainCoverage` value — a physical, meaningful metric matching the unit-test
coverage definition — instead of summing every cell of every `getWaterOverlay()` grid (which
double-counted and dragged in the negative water-source desirability).

### WR-04: `game.events` listeners are never removed — duplicated side effects across restarts

**Files modified:** `src/game/scenes/MainScene.ts`, `src/game/scenes/HUDScene.ts`
**Commit:** `abe980d`
**Applied fix:** Both scenes store their `game.events` handlers as bound readonly fields and
register a one-shot scene `SHUTDOWN` hook (`this.events.on(Phaser.Scenes.Events.SHUTDOWN, …)`,
which Phaser fires on `scene.stop`/`start`) that `off()`s exactly those handlers. Confirmed from the
Phaser 3.90 source that `Systems.shutdown()` emits the scene `SHUTDOWN` event and does not invoke a
user `shutdown()` method, so the event-based cleanup is the correct hook. MainScene offs
`overlay-toggle`; HUDScene offs `hud-toast`, `overlay-legend`, `game-pause`, `game-resume`,
`hud-inspect`, `hud-walker-inspect`, `hud-build-mode`. Scene-scoped keyboard/input listeners are
cleaned by Phaser itself and need no manual off.

### WR-05: Desirability overlay reads only the water-source desirability grid, not tile/house desirability

**Files modified:** `src/sim/runner.ts`, `src/game/scenes/MainScene.ts`
**Commit:** `d9cfc09`
**Applied fix:** Added a pure, deterministic `SimRunner.getDesirabilityOverlay()` returning a
width×height grid of the sim's actual per-tile desirability (`desirabilityOf` — terrain + policy +
adjacent-road bonus + each live house's real service coverage on its footprint; additive read-only
projection, never serialized, so `getState`/goldens are untouched). The MainScene desirability
overlay consumes this surface instead of the water-only delta grid, with a `0..200 → 0..4` band
mapping.

### WR-06: `storageInspection(...)` result is discarded — enriched storage fields never rendered

**Files modified:** `src/game/scenes/HUDScene.ts`
**Commit:** `0e2ac37`
**Applied fix:** The granary/warehouse branch now captures and uses the `storageInspection()`
projection output (used/capacity/stock rows render from `insp`), and renders `Reserved`/`In
Transit` rows when the projection carries real reserved/inTransit internals. No fabricated zeros:
per-building reserved/inTransit are not currently maintained on `BuildingInstance`, so those rows
render only when real internals exist (honest behavior; the dead computation is gone).

## Verification

All verification ran in the **main checkout** (no worktree — `workflow.use_worktrees: false`).

- `npm run typecheck` (`tsc --noEmit`) — **clean**
- Targeted vitest (`tests/unit/advisor-composer.test.ts`, `tests/unit/water-overlay.test.ts`,
  `tests/unit/advisors.test.ts`, `tests/unit/inspector-id-collision.test.ts`) — **37/37 pass**
- Golden + determinism suite (`tests/golden`, `tests/determinism`) — **76/76 pass**,
  `git status --porcelain tests/golden` **empty** (golden fixtures byte-identical, unchanged)
- Full suite `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` — **117 files
  / 889 tests pass** across two runs. Note: vitest reported 2–3 `Timeout calling "onTaskUpdate"`
  worker-RPC errors per run (count varied 3 → 2), with **zero test/file failures**; these are
  transient worker-communication timeouts under parallel load, not failures (all 117 files passed
  in both runs).
- `npm run check:military` — **clean** (no forbidden military tokens)
- `npm run lint` — modified files clean; the 2 errors (`src/sim/campaign.ts` unused `_city`)
  are **pre-existing** on `main` and unrelated to this fix pass
- Determinism constraints honored: no `Math.random()`/`Date.now()`/`new Date()` introduced into
  `src/sim`; `SimState`/`getStateJson()` byte-identical (goldens untouched); no
  `BuildingState`/`WalkerState` growth; inspectors read internals via the `getInspector` seam;
  no `toBuildingState`/`toWalkerState` edits. UI stays view-only (overlays/inspectors out of
  `getState()`); sim-derived DOM strings still use `createElement`/`textContent` (no innerHTML);
  `data-testid` attributes preserved.

## Skipped Issues

None — every in-scope finding (CR-01, WR-01..WR-06) was fixed. Info findings
(IN-01..IN-04) were deferred by scope (Critical + Warning only) and are documented as
`Status: deferred` in `18-REVIEW.md`.

---

_Fixed: 2026-08-06T09:10:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
