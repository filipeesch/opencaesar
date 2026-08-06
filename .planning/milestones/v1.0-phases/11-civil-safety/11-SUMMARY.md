# Phase 11 Summary: Civil Safety

## Overview

Wired the safety model into the live sim: fire lifecycle with real density/
coverage risk, fireman extinguishing, sticky structural danger with engineer
repair, crime with prefecture coverage and marshal patrols, and the
civilization overlay exposing it all per-tile. Every safety mechanic is
seeded-deterministic and peaceful; safety state stays internal so goldens
never change.

### Accomplishments

- **SAFE-01 fire/firemen**: dense neighborhoods ignite during city fire events
  (hazard = density-derived fireRisk + event surge, threshold 0.7); fire
  stations covering a district prevent ignition entirely (coverage radius 8);
  fireman walkers patrol and extinguish burning buildings (adjacency +
  patrol-response), with a 10-tick douse window after an extinguish.
- **SAFE-02 collapse/danger**: aging (ageMonths) plus density drives collapse
  risk; earthquakes add a +0.6 surge that pushes aged dense housing into a
  persistent `danger` state; engineer walkers repair dangerous (and
  fire-destroyed) buildings on contact.
- **SAFE-03 prefecture/marshal + overlay**: crime = density*0.5 + 0.05 −
  security coverage; prefectures (new building, spawns marshals) suppress it;
  marshal patrols leave a slowly-recovering calm; `getCivilizationOverlay()`
  projects per-tile fire/danger/collapse/crime grids.
- **Spawner fix**: safety buildings now spawn their catalog walkers
  (fireman/engineer/marshal) via reverse lookup — the old code spawned a
  bogus building-named walker; every other building keeps legacy behavior so
  serialized state stays byte-identical.
- **Config**: `safetySpawnEveryTicks`, `safetyCoverageRadius`,
  `safetyPatrolRadius` added to the balance catalog (parity test enforces
  consumption).
- **Verification**: unit (fire-service, collapse, security), integration
  (civilization overlay), determinism (chunked 1/7/50, state + overlay
  identity, no-RNG/clock audit).

### Numbers

- Tests: 663 passed / 95 files (baseline 642 / 90 → +21 / +5)
- Typecheck: clean; Lint: clean; `check:military`: clean
- Goldens: unchanged, no regeneration required (`SimState` frozen)
- Seed anchors used: fire tests seed 1 (fire@79, fireman saves), cover seed 1
  (maxFire 0), collapse seed 777 (earthquake@799 → danger, engineers repair),
  crime seed 5 (none 0.34 / cover 0.00 / patrol calm)

## Decisions

- Safety state lives on `BuildingInstance.safety` — internal only, never in
  `BuildingState`, so goldens/SimState stay byte-identical.
- Ignition requires a seeded event (fire/earthquake) — without one, dense
  neighborhoods stay at hazard ≤ 0.8.
- Danger latches (sticky) so earthquake damage persists until an engineer
  repairs it.
- Additive-only spawner change: safety buildings → catalog walkers; legacy
  building-named walkers untouched.
