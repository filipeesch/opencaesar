---
phase: 20
fixed_at: 2026-08-07T16:10:00Z
review_path: .planning/phases/20/20-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 20: Code Review Fix Report

**Fixed at:** 2026-08-07T16:10:00Z
**Source review:** .planning/phases/20/20-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (5 Warning + 6 Info — all Info findings were trivial/safe, so all were fixed)
- Fixed: 11
- Skipped: 0

## Fixed Issues

### WR-01: Key router fires into focused form controls

**Files modified:** `src/game/scenes/MainScene.ts`, `e2e/keyboard.spec.ts`
**Commit:** `84d4606`
**Applied fix:** Added a target guard in the keydown router: when the event target is an `INPUT`, `SELECT`, or `TEXTAREA` (focused form controls), the router returns immediately so arrow/letter keys on focused sliders/selects no longer flip inspector cards, advisor panels, or overlays. Added an e2e regression lock (focused slider arrows must not change the inspected building).

### WR-02: Category filter has no way back to "All"

**Files modified:** `src/game/ui/sidebar.ts`, `src/game/scenes/HUDScene.ts`, `tests/unit/sidebar-controls.test.ts`
**Commit:** `05110a0`
**Applied fix:** `BUILD_CATEGORIES` now leads with an `'all'` category (14 tabs total) that is the default selection, restoring the pre-regression reset behavior. Re-clicking the active category toggles back to `'all'` (toggle behavior). Unit lock added in `sidebar-controls.test.ts`.

### WR-03: First `B` press is a visible no-op

**Files modified:** `src/game/scenes/HUDScene.ts`, `e2e/sidebar.spec.ts`, `e2e/boots.spec.ts`, `e2e/sessions.spec.ts`, `e2e/placement.spec.ts`, `e2e/acceptance.spec.ts`, `e2e/management-ui.spec.ts`, `e2e/alignment.spec.ts`
**Commit:** `3b973fe`
**Applied fix:** The build panel no longer starts open: `buildPanelOpen` initializes to `false` and `create()` applies the closed state, so the first `B` press visibly opens the panel instead of silently "closing" an invisible panel. The 7 e2e specs that drove build buttons were updated to press `B` first (the panel is now hidden at boot, as the spec's own fixtures already assumed for other flows).

### WR-04: Walker inspector card never refreshes and never auto-closes

**Files modified:** `src/game/scenes/HUDScene.ts`
**Commit:** `59023a8`
**Applied fix:** Introduced a dedicated `inspectWalkerId` state. The per-tick refresh guard re-resolves `getInspector(id, 'walker')` for the current target and re-renders the card when data changes, and auto-closes the inspector when the walker disappears. `closePopup`/`navInspector` keep the building/walker id spaces consistent (closing one clears the other).

### WR-05: Escape pauses the game while the settings drawer or overlay bar is open

**Files modified:** `src/game/ui/keyboard.ts`, `src/game/scenes/MainScene.ts`, `src/game/scenes/HUDScene.ts`, `tests/unit/keyboard.test.ts`, `e2e/keyboard.spec.ts`
**Commits:** `4745d8e`, `9e03ce3`
**Applied fix:** `RouterCtx`/`RouterResult` gained optional `settings` and `overlayBar` open flags; the router precedence stack is now drawer > inspector > settings > overlay-bar > build > pause, so Escape closes the settings drawer or overlay bar first and only falls through to pause when nothing else is open. `MainScene` builds the ctx from `hud.isSettingsOpen()`/`isOverlayBarOpen()` and applies diffs via the now-public `toggleSettingsDrawer`/`toggleOverlayBar` (force seam); the ctx getters are optional-chained so other router callers remain source-compatible. Regression locks added in `tests/unit/keyboard.test.ts` and `e2e/keyboard.spec.ts` (ESC with drawer open closes drawer, not pause). `9e03ce3` is the follow-up typecheck pass (public surface + optional-ctx safety).

### IN-01: Full drawer + inspector card rebuilt every tick while open

**Files modified:** `src/game/scenes/HUDScene.ts`
**Commit:** `c910f83`
**Applied fix:** `renderAdvisor` now renders only the active panel host; switching tabs (keyboard or click in `wireSidebar`) triggers a targeted re-render of just the active panel instead of rebuilding the whole drawer + inspector card every tick.

### IN-02: Dead code — `els.pop`, `advisor-open`, `overlay-bar` events

**Files modified:** `src/game/scenes/HUDScene.ts`
**Commit:** `805953b`
**Applied fix:** Removed the unused `els.pop()` entry and the `'advisor-open'`/`'overlay-bar'` emits that had no listeners anywhere in the codebase.

### IN-03: Stub `setAttribute`→`dataset` divergence masks a test/real-DOM gap

**Files modified:** `src/game/ui/dom.ts`, `tests/unit/inspector.test.ts`
**Commit:** `b371907`
**Applied fix:** `StubNode` now keeps a real `attributes` record and `UiNode` exposes `getAttribute`; `setAttribute` stores the attribute and mirrors `data-*` into `dataset` (browser semantics). The inspector unit test now asserts via `getAttribute('disabled')`/`getAttribute('aria-label')`, closing the test/real-DOM divergence.

### IN-04: `activeAdvisor` set before drawer validation

**Files modified:** `src/game/scenes/HUDScene.ts`
**Commit:** `73c1139`
**Applied fix:** `selectAdvisor` now validates the requested id against the drawer tab catalog before setting `activeAdvisor`, so an unknown id can no longer wedge the active state.

### IN-05: Redundant condition in overlay render

**Files modified:** `src/game/scenes/MainScene.ts`
**Commit:** `16dca41`
**Applied fix:** Simplified the overlay render condition — `!v` already covers the `v === 0` case, so the redundant explicit check was removed.

### IN-06: No key-repeat guard

**Files modified:** `src/game/scenes/MainScene.ts` (combined with WR-01)
**Commit:** `84d4606`
**Applied fix:** Added an `ev.repeat` guard so auto-repeating keys no longer re-fire router actions (e.g., rapid toggle flapping) while a key is held.

## Verification

All verification ran in the main checkout (worktrees disabled per `.planning/config.json`).

- **typecheck:** `tsc --noEmit` — clean (final commit `9e03ce3`).
- **Full suite:** `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` — **129/129 files, 1028/1028 tests passed** (2–3 vitest worker RPC "Timeout calling onTaskUpdate" errors are infra noise: identical errors occur on the pre-fix baseline `7e58505`, all tests pass in both runs).
- **Military gate:** `npm run check:military` — clean (no forbidden tokens).
- **Goldens:** `git status --porcelain tests/golden` — empty (byte-identical).
- **e2e (Playwright):** 59/62 passed. The 3 failures (`boots.spec.ts:4` 'Roman City Builder' title, `campaign.spec.ts:8` objective won flag, `placement.spec.ts:114` population growth) reproduce **identically on the pre-fix baseline commit `7e58505`** — pre-existing environment/timing failures, not regressions from these fixes. Notably the fixed run passes 4 tests that fail on baseline (`placement.spec.ts:4/42/82`, `boots.spec.ts:36`).

---

_Fixed: 2026-08-07T16:10:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
