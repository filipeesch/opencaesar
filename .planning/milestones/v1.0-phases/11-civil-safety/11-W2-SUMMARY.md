---
phase: 11-civil-safety
plan: 11-w2
wave: 2
subsystem: sim-core
tags: [safety, collapse, earthquake, danger, repair, engineer, crime, prefecture, marshal]
requires:
  - phase: 11-civil-safety
    plan: 11-w1
    provides: safety state plumbing, walker hooks, coverage model
provides:
  - sticky structural danger: s.danger latches (collapse risk > 0.8 or fire-destroyed) and persists until an engineer repairs it — earthquake damage doesn't heal by itself
  - earthquake collapse surge (+0.6) sized so aged (≥ ~20 months) dense housing enters danger during the event
  - engineer walker behavior: repairs adjacent dangerous buildings (clears danger + collapseRisk, rebuilds fire-destroyed)
  - prefecture building (data/buildings.ts + src/sim/buildings.ts: category safety, 2x2, cost 120, workers 5, spawns marshal)
  - marshal walker (data/walkers.ts + walkerProfiles wandering) with patrolCrime hook: adjacent patrol lowers a building's crime, which recovers slowly (0.05 convergence) toward the derived level
  - crime risk wired to securityCoverage (prefecture stations) in the runner
affects: [11-w3]
actuals:
  tokens: 0
  tasks: 2
  commits: 0
tech-stack:
  added: []
  patterns:
    - "Peaceful civic service: marshals calm (patrolCrime), never attack (check:military)"
    - "Sticky damage + walker repair loop: danger persists until engineer contact"
key-files:
  created:
    - tests/unit/collapse.test.ts
    - tests/unit/security.test.ts
  modified:
    - src/sim/runner.ts
    - src/sim/walkers.ts
    - data/walkers.ts
    - data/buildings.ts
    - src/sim/buildings.ts
key-decisions:
  - "Danger is sticky (latches) so an earthquake leaves persistent damage that only engineers clear — makes the repair loop meaningful"
  - "Marshal patrol effect decays exponentially (5% per tick toward the derived crime), visible for ~60 ticks after a visit"
  - "Crime converges from the derived level; fresh buildings start at the derived level (no transient)"
