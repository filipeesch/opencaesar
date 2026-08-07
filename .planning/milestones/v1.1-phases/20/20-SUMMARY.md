---
phase: 20
plan: 20-plan
subsystem: game-ui
tags: [ui-redesign, sidebar, advisors, overlays, inspectors, keyboard, xss-safe]
dependency_graph:
  requires: [v1.0 (phase 19.1)]
  provides: [UI-RED-01..08, UI-FIX-01..03]
  affects: [src/game (ui modules, scenes, palette), tests (unit + e2e)]
tech-stack:
  added: [src/game/ui/{dom,topbar,sidebar,advisorDrawer,keyboard,overlays,inspector}.ts, .uppercase CSS utility]
  patterns: [node-safe DOM builder (StubNode for node-env), tick-change re-render guard, key-router precedence stack, per-service hue table, inspector card + same-kind cycling]
key-files:
  created:
    - src/game/ui/dom.ts
    - src/game/ui/topbar.ts
    - src/game/ui/sidebar.ts
    - src/game/ui/advisorDrawer.ts
    - src/game/ui/keyboard.ts
    - src/game/ui/overlays.ts
    - src/game/ui/inspector.ts
  modified:
    - src/game/scenes/HUDScene.ts
    - src/game/scenes/MainScene.ts
    - src/game/scenes/HomeScene.ts
    - src/game/palette.ts
decisions:
  - "Right sidebar is the interaction hub; minimal top status bar keeps population/date/treasury/ratings (Caesar III layout)"
  - "Advisor drawer overlays the sidebar, not replaces it; A cycles, ←/→ switch panels, Escape closes surfaces first"
  - "Per-service coverage hues from a small color table (fire red, danger orange, collapse brown, crime purple, food green, water blue, desirability teal) — fixes 18-UI-REVIEW finding #2"
  - "Keyboard additive: A/←/→/Escape + B (build panel) + 1-5 (overlays); precedence drawer > inspector > settings > overlay-bar > build > pause; ESC/W/F/R/C/D/X regression-locked"
  - "UPPERCASE via .uppercase CSS utility (text-transform + 1px letter-spacing) — case-only, wording byte-matched to 18-UI-SPEC"
  - "Inspectors relocated from fixed popup into sidebar cards; getInspector(kind,id)/getWalkerInternals seams unchanged; ←/→ step the selection directionally"
  - "Key router guards focused form controls (INPUT/SELECT/TEXTAREA/BUTTON) so arrow/letter keys on sliders don't flip inspectors/advisors"
  - "Build category filter gains an 'All' reset + click-again toggle"
  - "Settings drawer and overlay bar join the Escape precedence stack"
metrics:
    duration: 0
    completed: 2026-08-07
    tasks: 10
    commits: 19
    files: 11
status: complete
actuals:
  tasks: 10
  commits: 19
---

# Phase 20 Plan 20-plan: Caesar III Sidebar & Advisors

Replaced the top HUD with a Caesar III-style right sidebar (build panel, tools, speed, advisor drawer, overlay toggles) plus a minimal top status bar, rebuilt advisors/overlays/inspectors as sidebar-driven UI with keyboard-first navigation, per-service overlay color ramps, and UPPERCASE labels — view-only, sim core byte-identical.

## One-liner

Full Caesar III-style sidebar + advisor drawer + keyboard-first UI delivered as view-only Phaser/DOM layers over the deterministic sim: zero src/sim diff, goldens byte-identical, zero innerHTML.

## Tasks

| Task | Name | Type | Commit | Status |
| ---- | ---- | ---- | ------ | ------ |
| 20-00-01 | Wave 0: control→seam inventory + SPEC.md + 8 RED scaffolds | auto | a84c1d5 | complete |
| 20-01-01 | Wave 1: sidebar + top bar + advisor drawer + key router modules | tracer | f215ca9 | complete |
| 20-01-02 | Wave 1: replace all 8 innerHTML sites; RED scaffolds green | auto | f215ca9 | complete |
| 20-02-01 | Wave 2: advisor drawer live-tick re-render + e2e | auto | 81e43fd | complete |
| 20-02-02 | Wave 2: keyboard e2e (A/←/→/Escape/B/1-5) + regression fixes | auto | 1844569 | complete |
| 20-03-01 | Wave 3: per-service overlay ramps + legends (UI-FIX-02) | auto | b3e3d27 | complete |
| 20-03-02 | Wave 3: click-through to inspector e2e-locked | auto | 40efd59 | complete |
| 20-04-01 | Wave 4: sidebar inspector cards + close/Next cycling | auto | 8612f56 | complete |
| 20-05-01 | Wave 5: UPPERCASE labels (UI-RED-06/UI-FIX-03) | auto | 498aa99 | complete |
| 20-05-02 | Wave 5: close gate 8/8 (typecheck, suite, goldens, innerHTML, sim-diff, military, e2e, precedence) | auto | b4517ae | complete |

## What was built

- **Sidebar hub** (`src/game/ui/sidebar.ts`): nav (Advisors/Overlays/Messages/Settings), build panel (13 categories with All reset + 17 building buttons from BUILDINGS), tools (tax/wage policy sliders), speed row (0.5–8×), advisor button, overlay group (pause/resume/save/restart), inspector/log/toast hosts — every control wired to a real runner seam (0 decorative).
- **Top status bar** (`topbar.ts`): population, date (year=floor(tick/360), month=floor((tick%360)/40)+1), treasury, 5 ratings from getState()/getDerived().
- **Advisor drawer** (`advisorDrawer.ts`): 13 tabs in ADVISOR_TAB_ORDER, live getter data under tick-change guard (never per-frame), verbatim empty states, one visible panel.
- **Key router** (`keyboard.ts`): A cycles advisors, ←/→ switch panels directionally, Escape closes surfaces first (drawer > inspector > settings > overlay-bar > build > pause), B toggles build panel, 1-5 toggle overlays, W/F/R/C/D/X back-compat; guard against focused form controls; key-repeat guard.
- **Overlays** (`overlays.ts`): per-service hue table (fire red, danger orange, collapse brown, crime purple, food green, water blue, desirability teal), legends with 5-band swatches per service (risks legend renders one row per service), click-through to inspector e2e-locked.
- **Inspectors** (`inspector.ts`): sidebar cards fed by unchanged getInspector(kind,id)/getWalkerInternals seams, close × + Next/Prev same-kind cycling with boundary-disabled buttons.
- **DOM safety** (`dom.ts`): node-safe el()/clear()/text() with real HTMLElement in browser and StubNode in node-env vitest; all 8 legacy innerHTML sites (HUDScene ×5, HomeScene ×3) replaced — grep count 0.
- **UPPERCASE labels**: .uppercase CSS utility (text-transform + 1px letter-spacing) applied to overlay legends, advisor tabs/readouts, sidebar nav/toggles, topbar labels — case-only, wording unchanged.

## Per-requirement evidence

- **UI-RED-01/08**: sidebar-controls + no-innerhtml tests + e2e/sidebar.spec.ts (3/3).
- **UI-RED-02/03/07 + UI-FIX-01**: advisor-drawer + keyboard tests + e2e/keyboard.spec.ts (5/5).
- **UI-RED-04 + UI-FIX-02**: overlay-hues + ui.test.ts hue/risk-resolver tests + e2e overlay legend/click-through locks.
- **UI-RED-05**: inspector unit tests (12) + e2e/inspect.spec.ts (8/8) incl. arrow/ESC card test.
- **UI-RED-06 + UI-FIX-03**: uppercase-labels tests (6) + computed-style e2e test.
- **Gates**: typecheck clean; 129 files/1028 tests green; check:military clean; goldens byte-identical (porcelain empty); src/sim zero diff; grep innerHTML = 0; e2e 59/62 with the 3 failures reproducing identically on the wave-0 baseline (pre-existing flakes).

## Deviations from Plan

- **SERVICE_HUES landed in `ui/overlays.ts`** instead of PLAN's `palette.ts` (equivalent, test-locked; palette.ts keeps the deleted OVERLAY_RAMPS removal).
- **Settings drawer/overlay bar added to the Escape precedence stack** (beyond SPEC's drawer > inspector > build > pause) per code-review WR-05.
- **Focus guard for form controls** added to the key router per WR-01 (sliders/selects no longer trigger inspector/advisor flips).
- **Build category 'All' reset + click-again toggle** per WR-02.
- Phase-18 fixed inspector popup **relocated into sidebar cards** (kept legacy testid/classes) per Wave 4.
- Wave-5 SUMMARY.md was never committed by the executor; reconstructed by the orchestrator from wave reports.

## Security & threat-model notes

STRIDE dispositions from the plan implemented: no innerHTML (DOM tampering, T-20-01); key-router precedence + focus guard (key hijack, T-20-02); options seam untouched (T-20-03); tick-change guard prevents render loops (T-20-04); src/sim zero-diff keeps sim-core invariant (T-20-05); UPPERCASE case-only keeps label wording byte-identical (T-20-06); textContent-only rendering for sim-derived strings (XSS, T-20-07).

## Known Stubs

None — every scaffold test is green and all rows serve real data.

## Self-Check: PASSED

- All 10 tasks committed (git log 61d2c8c..HEAD); typecheck, 129/1028 tests, military, goldens, innerHTML grep, src/sim diff all verified by the phase verifier (8/8 goals PASS).
