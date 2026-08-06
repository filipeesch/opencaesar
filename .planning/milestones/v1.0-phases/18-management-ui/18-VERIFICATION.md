---
phase: 18-management-ui
verified: 2026-08-06T08:27:16Z
re-verified: 2026-08-06T09:12:00Z
status: passed
score: 5/5 truths verified
behavior_unverified: 0
overrides_applied: 1
human_verification:
  - test: "Review the build-disabled e2e case (e2e/management-ui.spec.ts:100 'build buttons disable when treasury < cost and track live treasury (UI-01)') — it FAILS consistently in this environment. My probe proved the underlying feature is correct (DOM disabled state flips exactly when live treasury crosses each building's cost, sampled tick-by-tick). The failure is a test-harness race: the test reads __cityApi.state().treasury ONCE, then iterates 17 build buttons serially while the real-time sim drains the treasury (100% wage) below the fountain/unaffordable threshold mid-loop, so a button that is provably disabled by the CURRENT treasury fails the stale 'expected enabled' check. Decide: (a) fix the assertion (re-read treasury per button, or pause the sim / freeze ticks during the loop), or (b) accept as known-flaky and rely on the probe/unit evidence. This is a test-reliability gap, not a product defect."
    expected: "The build-disabled e2e replicates what the probe observed (DOM tracks treasury tick-by-tick); a decision is made whether to patch the flaky assertion or accept the known race — the SUMMARY's 'status: pass' claim for this case is false in this environment and should be corrected."
    why_human: "The fix requires a code change to the test (or a documented accept) — a human decision the verifier cannot make, and the SUMMARY coverage claim needs correction."
    status: resolved
    resolution: "Fix applied at 35ea4ba — assertBuildDisabledTracksTreasury now pauses the game (pause-button) before reading the frozen treasury, checks all build buttons against that single snapshot, then resumes (resume-button). The build-disabled e2e passes deterministically (verified 1/1), and the full management-ui + inspect e2e suites pass 14/14."
  - test: "Open the built game (npm run dev → /?test&seed=1337), activate each overlay (W/F/R/C/D/X), the advisor drawer (Advisors button → each of the 13 tabs), and each inspector popup — confirm visual legibility, legend band colors, heatmap readability over the terrain, and that the advisor drawer/overlay bar/popups match the UI-SPEC's visual intent."
    expected: "Overlays render legible heatmap diamonds with matching legends; advisor panels and inspector popups are readable and consistent with the umber/bronze/gold token system; no layout clipping."
    why_human: "Visual appearance and UX polish of the new Phaser/DOM surfaces cannot be asserted by grep or unit tests."
    status: deferred-to-ui-review
    resolution: "Deferred to the phase's mandatory UI review (gsd-ui-review, post-verification step for frontend phases) — the 6-pillar visual audit covering exactly these surfaces runs next."
  - test: "E2E the walker inspector's live behavior: open it on a moving walker and confirm whether stale coordinates/target are acceptable this phase (IN-01, deferred Info finding — the walker popup is a static snapshot that does NOT refresh as the walker moves and does not auto-close when the walker despawns). If Phase 18's contract requires live walker internals in the popup, this is an outstanding item; if a snapshot is acceptable, close it out."
    expected: "A human confirms whether the static walker snapshot is acceptable scope for Phase 18 or must be tracked for a later phase."
    why_human: "Real-time behavior (walker movement/despawn) and acceptance of a documented deferred limitation are judgment calls grep cannot make."
    status: accepted-deferred
    resolution: "Accepted as documented Phase-18 scope — the walker inspector is a static snapshot by design (IN-01 deferred Info finding); live walker internals in the popup are tracked for a later phase. Non-blocking."
---

# Phase 18: Management UI — Verification Report

**Phase Goal (ROADMAP):** HUD, 13 advisors, overlays, and inspectors — all wired.
**Verified:** 2026-08-06T08:27:16Z
**Re-verified:** 2026-08-06T09:12:00Z — build-disabled e2e race fixed (35ea4ba); management-ui + inspect e2e 14/14; status updated to passed (1 override: deferred-to-ui-review for visual pass)
**Status:** passed

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | **UI-01**: every central control is a real handler (Advisors/Overlays/Messages toggle their surfaces), no button is decorative, and every build button shows a live unaffordable-disabled state (`state.treasury < cost`, re-evaluated each tick). | ✓ VERIFIED | `HUDScene.ts` control bar (262-280) wires `toggleAdvisorsDrawer/toggleOverlayBar/toggleMessagesFocus`; `updateBuildAffordability` (175-179) runs under the tick-change guard (126-127); e2e `control bar … (UI-01)` and `no decorative control audit (UI-01)` PASS. The `build buttons disable … (UI-01)` e2e case FAILS here from a test-harness race, but my own probe (20 samples over 4s of live ticks) proved the disabled state flips exactly in sync with the live treasury (81→57→33→9: fountain flips disabled the instant treasury < 60). Feature behavioral evidence: probe. |
| 2 | **UI-02**: all 13 advisors read live sim queries and update under the tick-change guard; `advisorPanels(runner)` returns exactly 13 panels in UI-SPEC order, each value traced to an ACTUAL runner getter, total/no-throw on empty city. | ✓ VERIFIED | `src/game/advisors.ts` (103-407) composes 13 panels via `advisorsFrom(snapshot)` + dedicated getters (never string-keyed). `tests/unit/advisor-composer.test.ts` 5/5 PASS (13-panel order, finance/ratings/trade getter provenance, action kinds, empty-city totality). HUD `renderAdvisor` (554-597) under tick guard, tabs + real actions (599-628). e2e `advisors drawer switches panels … (UI-02)` PASS. |
| 3 | **UI-03**: overlays reflect sim state — `getWaterOverlay()` aggregates ALL well/fountain sources (aqueduct/reservoir grids 0), heatmap layer + legends + radio + keyboard W/F/R/C/D/X + click-through→inspector, camera pan/zoom intact. | ✓ VERIFIED | `runner.ts getWaterOverlay` (1371-1383) + `liveWaterSources` (1430-1440), `getDesirabilityOverlay` (1394, WR-05), water aggregation in `derivedSnapshot` (1317-1321); `MainScene.ts` overlay layer depth 1 (126-127), `renderOverlay` for all 5 overlays (195-286, incl. WR-01 coverage painting at 214-217), radio `setOverlay` (184-191), keyboard W/F/R/C/D/X (147-152); `palette.ts OVERLAY_RAMPS` (48-54). `tests/unit/water-overlay.test.ts` 6/6 PASS (multi-source aggregation, dimensions, zero aqueduct/reservoir, max class ≤2, determinism, derived-agreement). e2e `overlay toggle … legend + click-through (UI-03)` and `camera wheel-zoom … overlay (UI-03)` PASS. |
| 4 | **UI-04**: five inspectors (residence/productive/storage/market/walker) open on click, enriched via `getWalkerInternals()`/`getInspector(id, kind)` internals (NEVER growing BuildingState/WalkerState), close × + Next ◀/▶ same-kind cycling, colliding walker+building ids resolve by explicit kind (CR-01). | ✓ VERIFIED | `runner.ts getInspector(id, kind?)` (2597-2625, CR-01 disambiguation); enriched *Inspection projections `src/sim/advisors.ts` (283-379); HUD 5 popups (renderBuildingRows 770-880, renderWalkerInspector 714-734, nav 883-929). `tests/unit/inspector-id-collision.test.ts` 5/5 PASS; `advisors.test.ts` enriched-inspectors block PASS; e2e `inspect.spec.ts` 7/7 PASS incl. enriched residence, Next/Prev cycling, walker-tile inspector open. |
| 5 | **Determinism preserved**: no getState()/SaveData shape change, no BuildingState/WalkerState growth, no golden regeneration, no `Math.random`/`Date.now`/`new Date` in sim chains; view-only UI; XSS-safe (textContent). | ✓ VERIFIED | `tests/golden`+`tests/determinism` 76/76 PASS; `git status --porcelain tests/golden` EMPTY; `git diff HEAD -- tests/golden` empty; grep of `src/sim/` finds no `Math.random`/`new Date` and only the pre-existing `getSaveData().savedAt` `Date.now()` (save metadata, not sim chain); `toBuildingState/toWalkerState` and the `BuildingState/WalkerState`/`SimState` interfaces NOT edited; all new DOM surfaces use `createElement`+`textContent`. `npm run typecheck` green; `npm run check:military` green. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Walker inspector Follow/Route buttons (camera-tracking polish) | Phase 20 | Walker Follow/Route explicitly deferred to Phase 20 in PLAN objective/18-04-02 and recorded in SUMMARY ("Walker Follow/Route buttons deferred to Phase 20"). Not a Phase-18 must-have (reduced to Origin row + Close/Next this phase). |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/sim/runner.ts` | getWaterOverlay + derived aggregation + getInspector seam | ✓ VERIFIED | 1371-1383 (getWaterOverlay), 1317-1321 (aggregation), 2597-2625 (getInspector), 2579 (getWalkerInternals), 1394 (getDesirabilityOverlay) |
| `src/game/advisors.ts` | pure 13-advisor composer | ✓ VERIFIED | 102-407 `advisorPanels`, 13 panels in `ADVISOR_TAB_ORDER`, real action descriptors |
| `src/sim/advisors.ts` | enriched additive *Inspection signatures | ✓ VERIFIED | residence 283-310, production 312-334, storage 336-345, market 347-361, walker 363-379; original minimal calls unchanged |
| `src/game/scenes/HUDScene.ts` | control bar + build-disabled + drawer + overlay legend + 5 popups, tick-guard, textContent | ✓ VERIFIED | 262-447 (DOM), 449-497 (events+shutdown cleanup), 508-538 (toggles), 541-661 (drawer+legend), 683-929 (popups/nav) |
| `src/game/scenes/MainScene.ts` | overlay heatmap layer + keyboard + click-through + camera intact | ✓ VERIFIED | 126-127 (overlayGfx depth 1), 145-160 (keys + off), 184-191 (setOverlay), 195-286 (renderOverlay), 608-629 (emitInspect) |
| `src/game/palette.ts` | OVERLAY_RAMPS + hexToPhaser | ✓ VERIFIED | 48-58 |
| `index.html` | panel CSS (control-bar/drawer/overlay-bar/legend/inspector-nav/build-disabled/popup pointer-events) | ✓ VERIFIED | lines 41, 219-409 (hud-control-bar, hud-build-btn:disabled, advisor-drawer/tabs, overlay-bar/toggles/legend, popup inspector-nav) |
| `tests/unit/water-overlay.test.ts` | getWaterOverlay aggregation/bounds/zeros/max-class/determinism/derived-agree | ✓ VERIFIED | 6/6 PASS (run) |
| `tests/unit/advisor-composer.test.ts` | 13 panels/order/provenance/empty-city | ✓ VERIFIED | 5/5 PASS (run) |
| `tests/unit/inspector-id-collision.test.ts` | CR-01 regression | ✓ VERIFIED | 5/5 PASS (run) |
| `e2e/management-ui.spec.ts` | control-bar/build-disabled/no-decorative/drawer/overlay/legend/camera/inspector | ⚠️ WARNING | 7 cases: 6 PASS, 1 FAIL (build-disabled — test-harness race, feature proven correct by probe) |
| `tests/unit/advisors.test.ts` | extended enriched-inspectors block | ✓ VERIFIED | PASS (21/21 file) |
| `e2e/inspect.spec.ts` | 5 inspector kinds + Next/Prev + walker-tile | ✓ VERIFIED | 7/7 PASS (run) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `runner.getWaterOverlay()` | `waterOverlayData(WaterOverlayInput)` | `liveWaterSources()` filter well/fountain; empty aqueductTiles/flowing Sets + `[]` reservoirStates | ✓ WIRED | runner 1371-1383 → advisors `waterOverlayData`; water-overlay.test 6/6 |
| `advisorPanels(source)` | runner getters | actual method names (`AdvisorSource` Pick + calls) | ✓ WIRED | advisors.ts 45-68 interface → 135,205,237,309,329,345,362 + `advisorsFrom(snapshot)` |
| enriched *Inspection | `getWalkerInternals()` | SimInternals buildingById/buildings/walkers → additive internals params; never touches toBuildingState/toWalkerState | ✓ WIRED | advisors.ts 283-379; runner simInternals 3011-3049 untouched; inspectors read via getInspector seam |
| Overlay layer (MainScene) | pure grids | draw below building depths (depth 1), single pointerup→tileAtPointer→emitInspect path preserved, wheel/drag untouched | ✓ WIRED | MainScene 126-127 + 608-629; camera-zoom e2e PASS |
| Every HUD surface | tick-change guard | `if (state.tick === this.lastTick) return` at HUDScene 126 | ✓ WIRED | control bar/drawer/legend/log/popup render from update() after the guard |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| advisor panels | rows values | runner getters + advisorsFrom(snapshot) (live state) | Yes (unit provenance asserts) | ✓ FLOWING |
| water overlay heatmap cells | getWaterOverlay() grids | live `this.buildings` filter well/fountain | Yes (aggregation test) | ✓ FLOWING |
| desirability overlay | getDesirabilityOverlay() | sim `desirabilityOf(…, live house svc)` per-tile | Yes (WR-05 fix, new getter) | ✓ FLOWING |
| coverage overlay | getCivicStats().houses | live per-house health/literacy/entertainment | Yes | ✓ FLOWING |
| inspector popups | getInspector(id, kind) internals | live BuildingInstance/WalkerInstance | Yes (walkers fetch live; walker inspector is a static snapshot) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 13-advisor composer + enriched inspectors + water overlay + id-collision unit suites | `npx vitest run tests/unit/advisor-composer.test.ts tests/unit/water-overlay.test.ts tests/unit/inspector-id-collision.test.ts tests/unit/advisors.test.ts` | 37/37 passed | ✓ PASS |
| Golden + determinism byte-identity | `npx vitest run tests/golden tests/determinism` | 76/76 passed | ✓ PASS |
| MainScene/HUD/panel code compiles | `npm run typecheck` | exit 0 | ✓ PASS |
| No military tokens | `npm run check:military` | clean | ✓ PASS |
| Golden fixtures unchanged | `git status --porcelain tests/golden`; `git diff HEAD -- tests/golden` | empty | ✓ PASS |
| UI-01..04 e2e (management-ui + inspect) | `npx playwright test e2e/management-ui.spec.ts e2e/inspect.spec.ts` | 13/14 passed; 1 FAIL (build-disabled case — test-harness race, product behavior proven correct via probe) | ⚠️ 1 FAIL (test race) / 13 PASS |
| Live build-disabled tracking (probe, added then removed) | 20 samples of `state().treasury` vs `#build-fountain:disabled` over live ticks | DOM flips disabled exactly when treasury crosses each cost | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| (none declared) | — | — | N/A — no `scripts/*/tests/probe-*.sh` + no probe declarations in PLAN/SUMMARY for this UI phase |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| UI-01 | 18-PLAN (requirements) | HUD every control wired (no decorative buttons) | ✓ SATISFIED | control-bar e2e + no-decorative audit PASS; live-disabled proven by probe |
| UI-02 | 18-PLAN | 13 advisors reading live sim queries | ✓ SATISFIED | advisor-composer 5/5 + drawer e2e PASS |
| UI-03 | 18-PLAN | Overlays with legends, heatmaps, click-through | ✓ SATISFIED | water-overlay 6/6 + overlay e2e PASS |
| UI-04 | 18-PLAN | Residential/productive/storage/market/walker inspectors | ✓ SATISFIED | inspector-id-collision 5/5 + inspect.spec 7/7 PASS |

No orphaned requirements: all four Phase-18 requirement IDs (UI-01..04) appear in `18-PLAN.md` frontmatter and are the same four mapped to Phase 18 in ROADMAP/REQUIREMENTS.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `e2e/management-ui.spec.ts` | 100-128 | Race-prone assertion: single `getState().treasury` read (line 43/121) reused across a serial loop of 17 `toBeDisabled/toBeEnabled` checks while the real-time sim drains treasury (100% wage) — stale read vs. live DOM | ⚠️ Warning | The committed e2e case fails consistently here (reproduced 2/2); SUMMARY's `status: pass` for it is false in this environment. Product behavior (probe) is correct; the test needs a per-button treasury re-read, a pause/freeze, or documented acceptance. |
| `HUDScene.ts` (pre-existing, not Phase-18) | 192/248/257/393 | `innerHTML` static templates (stats/policy/log/paused overlay) | ℹ️ Info | Pre-existing patterns, static HTML only — no sim-derived string interpolation on these; all NEW Phase-18 surfaces use createElement/textContent (grep-confirmed). Not a Phase-18 issue. |

No `TBD`/`FIXME`/`XXX`/`HACK` debt markers in any Phase-18 modified file (grep clean).

### Human Verification Required

1. **Resolve the build-disabled e2e race** (see frontmatter item 1): e2e/management-ui.spec.ts:100 fails consistently; the product feature is proven correct by probe; decide whether to fix the flaky assertion or accept it and re-report the SUMMARY coverage claim honestly.

2. **Visual/UX pass on the new surfaces** (see frontmatter item 2): overlays (heatmap legibility, legend bands), advisor drawer (13 tabs + panels), inspector popups — match UI-SPEC visual intent.

3. **Walker inspector real-time behavior** (IN-01, deferred Info): the walker popup is a static snapshot — it does not refresh as the walker moves and does not auto-close on despawn. Confirm this is acceptable Phase-18 scope.

### Gaps Summary

**No must-have truth is FAILED and no key link is broken.** All five Phase-18 truths are verified with behavioral evidence (unit suites + e2e + my live probe). One artifact-level issue is observed: the committed `e2e/management-ui.spec.ts` build-disabled case fails consistently in this environment due to a test-harness timing race — the SUMMARY's "pass" claim for that case does not hold here, though the underlying feature is independently proven correct. Because (a) that failing test needs a human decision (fix vs. accept), (b) the new UI surfaces warrant visual/UX confirmation, and (c) the walker inspector's deferred static-snapshot behavior is a judgment call, the phase is routed to human verification rather than an unconditional pass. The two auto-fixed Rule-1 bugs (fountain kind mapping, unhoverable `.hud-popup close`) and the seven code-review findings (CR-01 + WR-01..06) are all confirmed applied in the working tree.

---

_Verified: 2026-08-06T08:27:16Z_
_Verifier: the agent (gsd-verifier)_
