## Why

We want a browser-based 2D isometric city-building game in the spirit of Caesar III (1998): build a Roman settlement, manage food/water/labor, and watch population grow. The MVP is the playable core — terrain, roads, buildings, the walker service mechanic, and a simple economy — plus a full automated test pyramid so the game mechanics are validated as they're built.

The single most important architectural decision: the simulation is a **pure, deterministic TypeScript state machine with zero Phaser imports** (`sim/`), and Phaser is only a thin renderer/input shell (`game/`). This is what makes the whole game testable headlessly in Node, and it mirrors how real city-builders separate logic from presentation.

## What Changes

This change builds the complete MVP from scratch:

- **Simulation core** (`src/sim/`) — pure TS, deterministic, seeded RNG:
  - Isometric grid map (~40x40): earth, water, fertile land, trees, rock, roads
  - Buildings: house, farm, granary, market, well (footprints, terrain requirements, road access)
  - Walker system (the signature mechanic): agents pathfind along the road graph, deliver food/water/labor by "covering" houses they pass
  - Economy: farm produces wheat → granary stores → market distributes; houses provide workers; taxes → treasury; wage/tax sliders
  - Housing evolution: tiers from service coverage + desirability → population
  - Ratings: Population + Prosperity for MVP
  - Fixed-timestep tick loop, `SimRunner` as the command/query API
- **Phaser shell** (`src/game/`) — isometric tilemap rendering, building placement with ghost preview, HUD (population, treasury, ratings), build menu, advisor messages
- **Test pyramid** — Vitest unit + integration + determinism/golden, `fast-check` property invariants, Playwright E2E smoke, CI via GitHub Actions
- **Art pipeline** — AI-generated isometric sprite sheets (small, consistent sets per building/tile type), with procedural placeholder fallback while art lands

## Capabilities

### New Capabilities

- `sim-core`: The deterministic simulation engine — map, buildings, walkers, economy, housing, ratings, `SimRunner` API. Pure TS, no Phaser, seeded RNG.
- `game-shell`: Phaser 3 renderer + input + UI — isometric tilemap, placement, HUD, build menu, message log.
- `test-infra`: The automated test pyramid — Vitest (unit/integration/determinism), fast-check (invariants), Playwright (E2E), CI workflow.

### Modified Capabilities

None — new project.

## Impact

- New codebase: Vite + TypeScript + Phaser 3 project scaffold
- `src/sim/` is framework-free and headless-testable; `src/game/` depends on Phaser
- Test infrastructure: vitest, fast-check, playwright, GitHub Actions workflow
- Art assets: AI-generated isometric sprite sheets (terrain tiles, building sprites), placeholder fallback
- Out of scope for this change: military/combat, disasters, campaign/scenarios, multiplayer, save/load, full rating set (Culture/Peace/Favor deferred)
