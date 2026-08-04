---
phase: 11-civil-safety
plan: 11-w1
wave: 1
subsystem: sim-core
tags: [safety, fire, fireman, coverage, ignition]
requires:
  - phase: 10-finance
    provides: runner tick-ordering patterns (tickSafety slot), balance-catalog CONFIG conventions
provides:
  - WalkerType union extended additively with 'fireman' | 'engineer' | 'marshal' (src/sim/types.ts)
  - spawner reverse-lookup fix: fire_station/engineer_post/prefecture now spawn their catalog walkers (fireman/engineer/marshal); all other buildings keep the legacy building-named walker type so serialized walker state stays byte-identical
  - safety walker spawn cadence: CONFIG.safetySpawnEveryTicks wired into fire_station/engineer_post/prefecture in src/sim/buildings.ts
  - tickSafety: per-building fire lifecycle (ignition hazard > 0.7 during fire/earthquake events, station/fireman brigade response, doused 10-tick immunity), sticky structural danger, crime convergence toward the derived level
  - real coverage in the derived risk computation (was hardcoded 0): buildingDensity (manhattan-3 occupancy) + safetyCoverage (station radius CONFIG.safetyCoverageRadius, active-staffed only)
  - SimInternals safety hooks: extinguishFire / repairBuilding / patrolCrime (additive, runner owns mutation)
  - fireman walker behavior: extinguishes adjacent burning buildings (walkers.ts applyCoverage branch); firemanNear patrol response
  - CONFIG.safetySpawnEveryTicks/safetyCoverageRadius/safetyPatrolRadius added to data/balance.ts
affects: [11-w2, 11-w3]
actuals:
  tokens: 0
  tasks: 2
  commits: 0
tech-stack:
  added: []
  patterns:
    - "Internal-only safety state on BuildingInstance (never serialized) so SimState/goldens stay byte-identical"
    - "Stations prevent (risk coverage), walkers respond (extinguish/repair/patrol)"
key-files:
  created:
    - tests/unit/fire-service.test.ts
  modified:
    - src/sim/runner.ts
    - src/sim/walkers.ts
    - src/sim/types.ts
    - src/sim/buildings.ts
    - src/sim/walkerProfiles.ts
    - data/walkers.ts
    - data/buildings.ts
    - data/balance.ts
    - src/game/palette.ts
    - src/game/buildingArt.ts
key-decisions:
  - "Additive spawner fix: only the three safety buildings map to catalog walkers; legacy building-named walkers (clinic etc.) are preserved so goldens never change"
  - "Ignition requires a seeded event surge (fire +0.35, earthquake +0.2) on top of density-derived fireRisk — only dense neighborhoods ignite; station coverage keeps hazard well below the 0.7 threshold"
  - "Extinguished buildings get a 10-tick douse window so a doused building stays out and the effect is observable"
  - "Safety state (fire/danger/collapseRisk/crime/dousedTicks) lives on BuildingInstance.safety — internal, never in BuildingState"
