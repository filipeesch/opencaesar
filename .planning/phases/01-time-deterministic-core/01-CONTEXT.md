# Phase 1: Time & Deterministic Core - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous batch acceptance)

<domain>
## Phase Boundary

Deliver fixed-timestep scheduling decoupled from frame rate, pause/speed controls
(0.5×/1×/2×/4×/8×), a paused-command queue (build/demolish/policy issued while
paused are consumed on the next step), an expanded per-tile state surface
(elevation, fertility, resourceType/Amount, waterDepth, aqueduct, road, desirability,
fireRisk, collapseRisk, pollution, traffic, serviceCoverage, ownership, blocked),
and locked-in golden determinism. Requirements: CORE-01, CORE-02, CORE-03.
</domain>

<decisions>
## Implementation Decisions

### Treatment of Existing Implementation
- Verify-as-built + gap-fill: plans audit existing behavior (src/sim/time.ts,
  src/sim/runner.ts paused queue, src/sim/tile.ts TileState) against CORE-01/02/03,
  add tests for any uncovered acceptance criteria, and fix only genuine gaps.
- Acceptance evidence lives in GSD VERIFICATION.md, with expanded golden determinism
  coverage rather than relying on git history alone.

### Golden Determinism Depth
- Add a paused-command pipeline golden: commands issued while paused are applied
  identically on resume (same seed → identical final state).
- Keep the existing determinism suite (same-seed idempotence) and document the
  TimeSystem integer-division frame-rate-independence argument in the plan.

### Per-Tile State Surface (CORE-03)
- Audit src/sim/tile.ts TileState against the full CORE-03 field list and add any
  missing fields now (elevation, fertility, resourceType/Amount, waterDepth,
  aqueduct, road, desirability, fireRisk, collapseRisk, pollution, traffic,
  serviceCoverage, ownership, blocked).
- Tile state stays read-only outside src/sim/ (preserves determinism D1).

### Claude's Discretion
Approach details (which tests to write first, exact audit layout) left to the planner.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- src/sim/time.ts — TimeSystem: fixed-step accumulator, pause flag, speed multiplier,
  SPEED_PRESETS [0.5,1,2,4,8], max-catchup drop to prevent spiral-of-death.
- src/sim/runner.ts:135 — setPaused + pendingCommands queue for while-paused orders.
- src/sim/tile.ts:9 — TileState interface.
- tests/determinism/determinism.test.ts and tests/golden/golden.test.ts — existing
  determinism + golden coverage.

### Established Patterns
- Sim core is framework-free; Phaser is view-only (D1).
- Seeds drive a mulberry32 RNG; map generation consumes the same RNG stream as the
  sim body for reproducible save replay.
- Tests run via Vitest (`npm run test`); golden regen via `npm run test:golden:update`.

### Integration Points
- SimRunner.tick() is the single stepping entry point; UI reads snapshots.
- Save/load replays command log for determinism.
</code_context>

<specifics>
## Specific Ideas

No specific user requirements beyond the accepted grey-area answers above — the
accepted decisions define scope.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>
