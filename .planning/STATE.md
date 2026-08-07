---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: UI Redesign — Caesar III Sidebar & Advisors
status: planning
last_updated: "2026-08-07T06:51:30.739Z"
last_activity: 2026-08-07
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 6
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: 20 — UI Redesign — Caesar III Sidebar & Advisors (1 of 1)
Plan: None yet (roadmap created; awaiting plan-phase)
Status: Ready to plan
Last activity: 2026-08-07 — Milestone v1.1 roadmap created (Phase 20, 6 plans)

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

## Session

**Last session:** 2026-08-06T20:02:06.293Z
**Stopped at:** Completed 19.1-PLAN.md
**Resume file:** None

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
