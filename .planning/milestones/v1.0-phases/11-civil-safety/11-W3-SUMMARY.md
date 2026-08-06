---
phase: 11-civil-safety
plan: 11-w3
wave: 3
subsystem: sim-core
tags: [safety, overlay, civilization, determinism]
requires:
  - phase: 11-civil-safety
    plan: 11-w2
    provides: complete safety state (fire/danger/collapseRisk/crime) per building
provides:
  - civilizationOverlayData pure projection in advisors.ts: per-tile fire / danger / collapse / crime number[][] grids painted over building footprints (clamped to map bounds)
  - runner accessor getCivilizationOverlay() mapping live BuildingInstances (with BUILDINGS footprint) into the projection
  - tests/determinism/safety-determinism.test.ts: chunked 1/7/50 identity (state JSON + overlay JSON) with active safety walkers and seeded events; same-seed rerun identity; no-RNG/clock source audit of safety.ts/advisors.ts/walkers.ts/walkerProfiles.ts/events.ts
  - tests/integration/civilization-overlay.test.ts: grid shape, footprint painting, destroyed → fire=1+danger=1, crime reflects prefecture coverage
affects: []
actuals:
  tokens: 0
  tasks: 2
  commits: 0
tech-stack:
  added: []
  patterns:
    - "Pure projection overlay (overlaysFrom/waterOverlayData pattern): every painted tile traces back to a building footprint"
    - "Chunked determinism across the event system (events fire on tick%40 boundaries identically for any chunking)"
key-files:
  created:
    - tests/determinism/safety-determinism.test.ts
    - tests/integration/civilization-overlay.test.ts
  modified:
    - src/sim/advisors.ts
    - src/sim/runner.ts
key-decisions:
  - "Overlay reads live BuildingInstance.safety (never serialized) — identical to the state the HUD/risk model sees"
  - "Overlay JSON is chunk-independent because the entire safety chain is seeded-deterministic"
