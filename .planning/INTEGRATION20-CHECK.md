# Integration Check — Milestone v1.1 (UI Redesign — Caesar III Sidebar & Advisors)

**Date:** 2026-08-07
**Scope:** Phase 20 vs v1.0 sim seams (phase 19.1), E2E flows, phase-18 deferred fixes, regressions
**Method:** git diff/seam tracing + live e2e runs (`npx playwright test` on dev :5173, `?test&seed=1337`) + wave-0 baseline worktree replay for failure triage
**Verdict:** **PASSED with gaps (2 WARNINGs, 0 BLOCKERs)** — all 11 requirements wired end-to-end; the only 3 e2e failures reproduce identically on the phase-20 wave-0 baseline (pre-existing, not regressions)

---

## 1. v1.0 Sim Seam Check (requirement: milestone constraint "view-only, zero sim diff")

### src/sim zero-diff — CONFIRMED
- `git log 61d2c8c..HEAD -- src/sim/` → **0 commits**; `git diff 61d2c8c HEAD -- src/sim/` → **empty**; `git status --short -- src/sim/` → **clean**. The phase-20 baseline commit (61d2c8c, "phase 20 UI-RED sidebar plan") is the last commit touching sim.
- Goldens: `git status --porcelain tests/golden` → empty (byte-identical, verified at checkout state).

### Seam consumption map (all WIRED)

| Seam (v1.0) | Declared in | Consumed by | Status |
|---|---|---|---|
| `getState()` | runner.ts:2163 | HUDScene.update/buildDom, MainScene.create/update, topbar.ts value nodes, sidebar.ts policy prefill | WIRED |
| `getDerived()` | runner.ts:1596 | HUDScene.update (culture/stability/favor), topbar.ts | WIRED |
| `setPolicy`/`getPolicy` | runner.ts:2142/2158 | HUDScene applyTax/applyWage (sidebar sliders, input+change) | WIRED |
| `setBuildMode`/`getBuildMode` | MainScene:380/388 | HUDScene build grid clicks; ghost/cursor in MainScene | WIRED |
| `setSpeed` | MainScene:407 → TimeSystem | HUDScene speed row (`speed-{0.5..8}`), boot default via `loadOptions()` | WIRED |
| `setPaused` | MainScene:393 | HUDScene pause/resume (sidebar + pause overlay); keyboard ESC fall-through | WIRED |
| `saveGame` (writeSave+getSaveData) | HUDScene:781-785, MainScene:438 | sidebar Save + pause overlay Save; **e2e sessions.spec "save → restart → load resumes same city" PASSED** | WIRED |
| `restartToHome` | MainScene:443 | sidebar Restart + pause overlay Restart; e2e sessions.spec "restart returns home" PASSED | WIRED |
| `getInspector(kind,id)` | runner.ts:2846 | HUDScene onHudWalkerInspect, renderWalkerInspector, buildingRows, navInspector (kind-disambiguated, CR-01) | WIRED |
| `getWalkerInternals()` | runner.ts:2828 | consumed by 5 unit test files (population/finance-runner/trade-advisor/advisors/sidebar-controls); UI reaches the same live `WalkerInstance` via `getInspector().internals` (HUDScene:806-808) — same data, different accessor | WIRED (via getInspector) |
| `advisorPanels(runner)` | game/advisors.ts:102 | HUDScene.buildDom (drawer frame) + renderAdvisor (live panel under tick guard) | WIRED |
| `game.events` | Phaser global emitter | 7 emit/7 listen pairs wired both directions (hud-toast, overlay-legend, game-pause/resume, hud-inspect, hud-walker-inspect, hud-build-mode, overlay-toggle); WR-04 shutdown off() prevents restart leaks | WIRED |
| options `loadOptions`/`saveOptions`/`applyOptions` | game/options.ts | HUDScene.fillSettingsControls/saveSettings; MainScene boot-speed default; e2e settings.spec "persist across page reload" PASSED | WIRED |

No orphaned exports, no missing connections in the seam layer.

---

## 2. E2E Flows (live runs, dev server :5173, `?test&seed=1337`)

**62 tests executed across all 16 spec files — 59 passed / 3 failed.**

| Flow | Specs (passed/total) | Result |
|---|---|---|
| Load game → sidebar renders (build panel, tools, speed, advisors, overlays, topbar) | sidebar.spec 4/4, management-ui.spec 9/9, boots 1/2 | **COMPLETE** |
| Sidebar controls: build grid → setBuildMode, policy sliders → setPolicy, speed → setSpeed, pause/resume, save/restart, settings drawer → options | management-ui, sessions 6/6, settings 4/4, boots 1/2 | **COMPLETE** |
| Advisor drawer: A cycles, ←/→ panels, Escape closes, live tick re-render | keyboard.spec 5/5, sidebar 1, management-ui 1 | **COMPLETE** |
| Overlays: 1-5 toggles, per-service hues, legends (incl. per-service risks legend UI-FIX-02), click-through to inspector, walker click-through while overlay active, zoom with overlay | keyboard 1, management-ui 3 | **COMPLETE** |
| Inspector: click-through house/farm/walker, ESC close, Next/Prev same-kind cycling, ←/→ + ESC precedence | inspect.spec 8/8 | **COMPLETE** |
| Build/placement: B opens panel, click places, placement errors toast, ESC cancels build, camera drag/zoom | boots 1/2, placement 2/3, sessions 2, alignment 4/4, building-sprite 4/4 | **COMPLETE** (1 pre-existing failure) |
| Save → restart → load resumes same city; restart → home | sessions 2/6 (relevant subset), settings 4/4 | **COMPLETE** |
| Keyboard back-compat W/F/R/C/D/X + new A/B/←/→/1-5/ESC, focused-slider guard (WR-01) | keyboard 5/5 (incl. explicit "1-5 toggle overlays; existing W/F/R/C/D/X stay wired") | **COMPLETE** |
| Campaign objectives through live sim | campaign 2/3 | **COMPLETE** (1 pre-existing failure) |
| Population growth via supply chain | placement 2/3 | **COMPLETE** (1 pre-existing failure) |

### The 3 failures — verified PRE-EXISTING (not phase-20 regressions)
Replayed the same 3 specs in a git worktree at the wave-0 baseline **61d2c8c** (pre-implementation): all 3 failed **identically** (same tests, same assertions, same values). Phase-20 summary claim confirmed.

1. `boots.spec.ts:15` — `getByText('Roman City Builder')` not found. The assertion dates to the MVP commit (3e1dc77) and `?test` boots straight to Main (BootScene skips HomeScene), so the home title is never in the DOM. **Deterministic pre-existing spec defect.**
2. `campaign.spec.ts:18` — `objectiveProgress().won === false` after `setObjective({population:0, sustainChecks:1})` + 10 ticks; page snapshot shows POPULATION 0. Objective cadence/tick-alignment dependent, sim-side, untouched by phase 20 (src/sim zero-diff). **Pre-existing flake.**
3. `placement.spec.ts:174` — `popAfter (80) not > popBefore (80)`. Supply-chain population growth not observed within the test window. Sim/evolution timing, untouched by phase 20. **Pre-existing flake.**

---

## 3. Phase-18 Deferred UI-Review Fixes (from `.planning/milestones/v1.0-phases/18-management-ui/18-UI-REVIEW.md`)

| Finding #1 (keyboard bindings) | **DELIVERED** | KeyRouter (ui/keyboard.ts) adds A/←/→/Escape/B/1-5 with precedence drawer > inspector > settings > overlay-bar > build > pause; W/F/R/C/D/X kept (KEY_MAP back-compat row); focus guard for INPUT/SELECT/TEXTAREA (WR-01); key-repeat guard (IN-06). e2e keyboard.spec 5/5 + WR-05 regression locks. |
|---|---|---|
| Finding #2 (per-service hues) | **PARTIAL — see WARNING W-2** | SERVICE_HUES table (ui/overlays.ts) + `overlayHue(id,band)` 5-step ramps + `dominantRiskService()` per-tile for the risks overlay; legends render one 5-swatch row per risk service. **But** the *coverage* overlay still paints `max(health, literacy, entertainment)` in a single teal ramp — the exact collapse the finding described — and the finding's locked health `#59c4ee` / literacy `#6aa5d6` / entertainment `#cf6fd1` hues appear nowhere. |
| Finding #3 (UPPERCASE) | **DELIVERED** | `.uppercase` utility in index.html:794-797 (`text-transform: uppercase; letter-spacing: 1px`); applied to sidebar nav, advisor tabs, overlay toggles, topbar labels, legend rows, drawer active tab; DOM text stays as-authored (case-only). Computed-style e2e lock in sidebar.spec:113 PASSED. |

---

## 4. Requirements Integration Map

| Requirement | Integration Path | Status | Issue |
|---|---|---|---|
| UI-RED-01 | sidebar.ts builder → HUDScene.buildDom/wireSidebar → runner seams | **WIRED** | — |
| UI-RED-02 | advisorDrawer.ts → advisorPanels(runner) → getState/getDerived feeds → live re-render under tick guard | **WIRED** | empty-state copy partial (W-1) |
| UI-RED-03 | KeyRouter (keyboard.ts) → MainScene keydown ctx → HUDScene.toggleAdvisors/selectAdvisorTab → drawer tick guard | **WIRED** | — |
| UI-RED-04 | overlays.ts hues → MainScene.renderOverlay + setOverlay radio; legend HUDScene.renderOverlayLegend; click-through emitInspect | **WIRED** | coverage sub-service identity (W-2) |
| UI-RED-05 | inspector.ts card + navState → HUDScene renderInspectorShell/buildingRows → getInspector(kind,id).internals | **WIRED** | — |
| UI-RED-06 | .uppercase CSS → sidebar/topbar/advisorDrawer/legend classNames | **WIRED** | — |
| UI-RED-07 | KeyRouter KEY_MAP (A/←/→/Escape/B/1-5) → MainScene diff application | **WIRED** | — |
| UI-RED-08 | dom.ts el()/textContent everywhere; grep innerHTML/outerHTML/insertAdjacentHTML in src/game + index.html = 0 | **WIRED** | — |
| UI-FIX-01 | KeyRouter + precedence stack + save-error toast + advisor "No data yet" state | **PARTIAL** | "No messages yet" + "Nothing highlighted" empty states not implemented (W-1) |
| UI-FIX-02 | SERVICE_HUES + overlayHue + dominantRiskService + per-service risks legend | **PARTIAL** | coverage overlay still single-ramp max (W-2) |
| UI-FIX-03 | .uppercase + letter-spacing on controls/tabs/toggles | **WIRED** | — |

**Requirements with no cross-phase wiring:** none — all 11 requirements have live integration paths verified above.

---

## Detailed Findings

### W-1 (WARNING) — UI-FIX-01: two of three locked verbatim empty states not delivered
- **Evidence:** PLAN.md task 20-02-01 locks verbatim empty states: `"No data yet"` (empty panel), `"No messages yet"` (log), `"Nothing highlighted"` (no selection). Delivered: "No data yet" advisor panel state (HUDScene:625-634) ✓; save-error toast ✓ (HUDScene:577/784). **Missing:** `renderLog` renders a blank `<ul>` when `state.messages` is empty (HUDScene:751-761) — no "No messages yet" entry; `renderOverlayLegend` hides the legend when no overlay is active — no "Nothing highlighted" block. Grep for both strings across src/tests/e2e = 0 hits. Acceptance criterion "empty states render verbatim" is therefore unmet.
- **Impact:** low — flows complete; only the "nothing here" UX feedback from the 18-UI-REVIEW finding #1 scope is absent. No test locked these strings, so no test failure.
- **REQ-ID:** UI-FIX-01 (also touches UI-RED-02's "verbatim empty states" claim in the phase SUMMARY).

### W-2 (WARNING) — UI-FIX-02: coverage overlay still collapses health/literacy/entertainment into one ramp
- **Evidence:** 18-UI-REVIEW finding #2: "Coverage overlay loses per-service color identity… paints max(health,literacy,entertainment)" with locked hues health `#59c4ee`, literacy `#6aa5d6`, entertainment `#cf6fd1`. MainScene.renderOverlay `coverage` case (lines 330-348) still computes `Math.max(h.health, h.literacy, h.entertainment)` and paints with the single `coverage` teal ramp (`#2aa4a4`). Phase SPEC §4 locked coverage=teal, and the phase's own CONTEXT decision #3 wording ("Coverage overlay paints per-service hue instead of max single ramp") is not what shipped — the per-service treatment landed on the **risks** overlay instead (dominantRiskService), which the original finding did not ask for.
- **Impact:** the delivered per-service hue table + risks identity is a real improvement and is test-locked (management-ui "risks overlay legend lists each risk service ramp" PASSED), but the finding's actual complaint (which service is deficient on the Coverage overlay) remains unresolved.
- **REQ-ID:** UI-FIX-02 (UI-RED-04 partial).

### W-3 (INFO-level note) — getWalkerInternals consumed via getInspector().internals, not directly
- HUDScene walker inspector resolves internals through `getInspector(id,'walker').internals` (the live `WalkerInstance` — same data getWalkerInternals() exposes). The seam itself is unchanged and still consumed by 5 unit test files. Data path verified end-to-end (inspect.spec walker card PASSED). Not a break; recorded for accuracy vs. the SUMMARY's phrasing.
- **REQ-ID:** UI-RED-05.

---

## 5. Regression Check (previously shipped flows)

| Flow | Evidence | Status |
|---|---|---|
| Placement (click-to-place, ghost, toasts, ESC cancel, right-click cancel) | boots 1/2 (placement-errors PASSED), placement 2/3, sessions ESC-cancel PASSED | **No regression** (1 pre-existing baseline failure) |
| Population (topbar live stat, evolution via supply chain) | sidebar.spec topbar PASSED, placement 2/3 | **No regression** (1 pre-existing baseline failure) |
| Campaign (objectives, win reporting, long-haul no-error) | campaign 2/3 PASSED | **No regression** (1 pre-existing baseline failure) |
| Military check | `check:military` gate + src/sim zero-diff (sim untouched) | **No regression** |
| Save/load/restart + settings persistence | sessions 6/6, settings 4/4 PASSED | **No regression** |
| Camera pan/zoom/alignment, sprites, walker rendering | alignment 4/4, building-sprite 4/4 PASSED | **No regression** |
| Determinism/goldens | git status clean on tests/golden | **No regression** |
| XSS surface (UI-RED-08) | innerHTML grep = 0 across src/game + index.html | **No regression** |

---

## Verdict

**PASSED with gaps.** All 11 milestone requirements (UI-RED-01..08, UI-FIX-01..03) are wired end-to-end; every v1.0 sim seam is consumed by the new UI with src/sim byte-identical; 59/62 e2e tests pass with the 3 failures proven pre-existing via wave-0 baseline replay. Two gaps to track: W-1 (missing "No messages yet"/"Nothing highlighted" empty states, UI-FIX-01 partial) and W-2 (coverage overlay sub-service hues still collapsed, UI-FIX-02 partial). Both are scoped, low-impact UX-contract items with no broken user flows.
