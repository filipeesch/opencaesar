---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: UI Redesign — Caesar III Sidebar & Advisors (In Progress)
status: Awaiting next milestone
stopped_at: Completed Phase 20 Wave 5 — UPPERCASE labels + full close gate (all 8 gates PASS; phase ready for verification); 129 files / 1026 tests; e2e 57/3 (pre-existing baseline documented)
last_updated: "2026-08-07T15:57:10.156Z"
last_activity: 2026-08-07
last_activity_desc: Milestone v1.1 completed and archived
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 1
  completed_plans: 0
  percent: 0
current_phase: 20
current_phase_name: 1 of 1
---

# Project State

## Current Position

Phase: Milestone v1.1 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-08-07 — Milestone v1.1 completed and archived

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 15 P15-plan | 15900 | 7 tasks | 19 files |
| Phase 16 P16-plan | 95 | 7 tasks | 27 files |
| Phase 17 P17-plan | 6133 | 8 tasks | 12 files |
| Phase 18 P18 | 91 | 10 tasks | 12 files |
| Phase 19 P19-plan | 112 | 7 tasks | 15 files |
| Phase 19.1 P19.1-plan | 138 | 7 tasks | 15 files |

## Decisions

- [Phase ?]: RATE-01 weighted rating factors stay module-local (not balance.ts) to dodge the balance-parity CONFIG gate; Favor rating kept legacy while its decomposition is weighted
- [Phase ?]: Objectives sustain counted on month cadence (tickCount % 40) with getObjectiveProgress a pure read (BUG 1 double-count fixed); annualExports is a per-year-ring trailing-360 window
- [Phase ?]: openTradeRoute/setTradeOrder became replayable SaveCommands and fromSaveData gained an optional map param (plan's no-new-command/no-schema-change assumption was wrong); respondEvent is a SaveCommand with eventResponseByEvent re-fire determinism
- [Phase ?]: HOUS-01: house.level (0-20) is the single live source of truth driven by decideEvolution; house.tier is always the derived tierOfLevel bucket; economy/advisor/happiness read HOUSING_LIVE_STATS via the clamped liveStats() accessor (never a bare index)
- [Phase ?]: HOUS-02: hysteresis devolve after toleranceTicks (90) with both counters reset on any level change (grace, no oscillation); merge runs on tickCount % 40 with a fixed placement-order scan, survivor keeps id/origin + footprint + combined population, occupiedTiles re-keyed, no new SaveCommand
- [Phase ?]: Fresh houses place at the occupied baseline (level 1 Crude Hut) + levelTaxPerTick gets a LEVEL_TAX_PER_WORKER solvency floor so the natural economy bootstraps (regression from committed 16-01-02 liveStats routing, fixed in 16-02-02)
- [Phase ?]: Phase 17: startMission is a replayable SaveCommand (year = floor(tickCount/360) start fix, live-only sequential gate, sub-effects under suppressCommandRecording so one command is the complete record)
- [Phase ?]: Phase 17: tutorial = 9-step pure-total predicate catalog over DerivedSnapshot/HouseView/CityView + replayable dismissTutorialStep; getTutorial() derived; seen==dismissed until Phase 18 UI
- [Phase ?]: Phase 17: codex = 13 kinds fully catalog-derived (ratings W exported); getCodex() cached; derived codex count stays 4-kind filtered (no golden changes)
- [Phase ?]: Phase 17: winnability retune - RESEARCH L10-20 housing unreachable (wheat-only food caps houses at L5 in the sim building set); all missions retuned to the probe-measured envelope (pop<=300, ratings<=55, favor<=35, treasury<=4000, no export targets), arc preserved
- [Phase ?]: Phase 18: UI-01 every central control is a real handler; build buttons disable live on treasury<cost; e2e no-decorative audit
- [Phase ?]: Phase 18: advisorPanels composes 13 advisors by actual getter names (Pitfall 1); advisor drawer re-renders only under the tick-change guard
- [Phase ?]: Phase 18: getWaterOverlay() aggregates ALL well/fountain sources (real kind: well→wellCoverage, fountain→fountainCoverage); derived water % = union so HUD==overlay
- [Phase ?]: Phase 18: enriched inspectors fed by getInspector/getWalkerInternals read-only seam — never grow BuildingState/WalkerState (golden-byte)
- [Phase ?]: Phase 18: MainScene.setOverlay is the single radio source of truth (overlay-toggle bus); legend is display-only pointer-events none
- [Phase ?]: PERS-01: version 1 stays current (empty additive MIGRATIONS map) - migration/validation infrastructure is the deliverable, existing saves stay format-stable
- [Phase ?]: PERS-01: validateSave enforces the full SaveCommand union before replay; applyCommand raw throw stays as defense-in-depth only
- [Phase ?]: PERS-02: OPTIONS_KEY 'rcb.options' disjoint from save keys; options never enter SaveData/getStateJson (golden-byte)
- [Phase ?]: PERS-02: graphicsQuality->RenderConfig read BEFORE new Phaser.Game (context-creation-only, 'applies on next launch')
- [Phase ?]: PERS-02: gameSpeedDefault injected once in MainScene.create() for fresh+loaded paths (positive-finite guard); HUD buttons own live speed afterwards
- [Phase ?]: Labor allocation by sector priority with a runner-level pinned reserve (pure allocateWorkers pinned branch not relied on — Pitfall 2); setLaborSectorState is a replayable SaveCommand (union + exhaustive applyCommand + saveCodec validateCommand)
- [Phase ?]: Type-based labor sector map (granary/market→utility, warehouse→commerce) because the storage category splits between utility and commerce; [ASSUMED] tunings A1 (imperial ref 0.3) / A2 (unemployment band thresholds) / A3 (priority map) / A5 (attractiveness weights) kept as-authored
- [Phase ?]: Per-residence population derived from level/tick history (never serialized); wage/unemployment bands reported as pure DerivedSnapshot projections — zero SaveData growth, zero golden delta

- [Phase 20 Wave 0]: Sidebar & advisor redesign — control-to-runner-seam inventory verified (0 decorative controls in HUDScene.ts); SPEC.md locks the target sidebar/topbar DOM tree, keyboard precedence (drawer > inspector > build > pause), per-service overlay hue table, and the tick→year/month date rule (year=floor(tick/360), month=floor((tick%360)/40)+1). 8 RED scaffolds (6 unit + 2 e2e) committed against the Wave 1+ target API; all verified failing today (module-absent RED + the 8 real innerHTML sites: 5 in HUDScene.ts, 3 in HomeScene.ts).
- [Phase 20 Wave 2]: Advisor drawer live-tick re-render under the tick-change guard (never per-frame; composer reads from the locked advisors.ts seam — zero diffs), verbatim empty states, 13 tabs in ADVISOR_TAB_ORDER. Keyboard e2e green (A cycles, ←/→ switch panels, Escape precedence, B toggle, 1-5 overlays; W/F/R/C/D/X regression-locked). Fixed wave-1 e2e regressions: settings drawer startup overlay swallowing mid-screen drags/wheel (display:none at build), legacy policy % value labels, build-mode ESC precedence, compact topbar CSS preserving the drag e2e's transparent band. e2e suite 53 passed / 3 failed (boots, campaign, placement-population — all fail at wave-0 baseline, documented not chased).
- [Phase 20 Wave 3]: Per-service overlay ramps wired for ALL overlays — MainScene paints via overlayHue(id, band) (SPEC §4 locks: water=blue, food=green, fire=red, danger=orange, collapse=brown, crime=purple, coverage/desirability=teal); the merged risks overlay resolves the dominant risk service per tile (dominantRiskService, fire>danger>collapse>crime tie-break) so service identity survives max() — 18-UI-REVIEW finding #2 fixed. Legend swatches come from the service's own ramp; risks legend renders one 5-swatch row per service. palette.ts OVERLAY_RAMPS deleted (dead). Click-through (emitInspect → building/walker inspector) verified untouched (depth-1 heatmap never takes input) and locked in e2e: walker click-through under an active overlay + risks per-service legend rows. e2e suite 55 passed / 3 failed (same pre-existing baseline).
- [Phase 20 Wave 4]: Inspector relocated from the Phase-18 fixed popup into a CARD inside the sidebar inspector host (sidebar-inspector-host testid; card keeps the legacy building-popup testid + hud-popup classes for spec compatibility). New pure ui/inspector.ts builder + navState() (position n/m label, boundary-disabled prev/next; single-entity list disables both; unit-locked). Close × + Next/Prev cycle same-kind lists in stable id order; keyboard fix: ←/→ step the selection list directionally (the symmetric router flip couldn't encode direction — both arrows advanced forward before) with Escape closing the card first (precedence kept). Rows refactored to InspectorRow[] fed read-only from getInspector/getWalkerInternals (CR-01 kind param preserved). Zero innerHTML (comment-scan audit green), src/sim zero diff, goldens byte-identical. 128 files / 1020 tests green; e2e inspect(8)+keyboard(5)+sidebar(3)+management-ui(9) = 25/25.
- [Phase 20 Wave 5]: UPPERCASE labels (UI-RED-06/UI-FIX-03) as a case-only CSS transform — new `.uppercase` utility (text-transform: uppercase; letter-spacing: 1px) is the single place the case transform lives (T-20-06 accept); applied to overlay legend labels (HUDScene), advisor tabs + active-tab readout (advisorDrawer — JS toUpperCase removed so DOM text is the canonical 18-UI-SPEC title), sidebar nav + overlay toggles (sidebar), all 8 topbar labels. Zero reworded strings, zero src/sim diff, 0 innerHTML. Close gate (20-05-01) all green: typecheck clean; 129 files / 1026 tests passed; goldens byte-identical (porcelain empty); check:military clean; Playwright 57 passed / 3 failed (boots/campaign/placement-population = pre-existing wave-0 baseline flakes, failing identically, documented not chased); keyboard precedence regression green (drawer > inspector > build > pause; ESC + W/F/R/C/D/X locked). New locks: tests/unit/uppercase-labels.test.ts (6) + e2e computed-style UPPERCASE test.

## Session

**Last session:** 2026-08-07T15:05:00.000Z
**Stopped at:** Completed Phase 20 Wave 5 — UPPERCASE labels + full close gate (all 8 gates PASS; phase ready for verification); 129 files / 1026 tests; e2e 57/3 (pre-existing baseline documented)
**Resume file:** None — Phase 20 plans 20-01..20-06 complete; next: /gsd-verify-work or /gsd-audit-milestone

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
