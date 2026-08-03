# OpenCaesar

## What This Is

OpenCaesar is a browser-based Caesar-style city-builder (TypeScript + Phaser 3.90)
with a framework-free, deterministic simulation core under `src/sim/`. Players lay
roads, houses, farms, water, industry, and civic buildings while managing population,
goods logistics, trade, finance, and city ratings. A full `src/game/` Phaser view
renders the city and management UI.

## Core Value

A deterministic, frame-rate-independent city simulation where buildings, goods,
services, and residents interact through physical, road-delivered systems — never
an opaque "teleporting stock" or radious-only model.

## Requirements

### Validated

- Seeded terrain map with building placement and terrain validation
- Worker-driven building operation and road-connected labor pool
- Service walkers delivering food, water, and labor coverage to houses
- Housing tiers with evolution/de-evolution
- Tax/wage economy and Population + Prosperity ratings
- Save/load (basic) and deterministic golden-file tests
- Data-driven `data/` catalogs for buildings, commodities, housing, trade, events, missions
- Ratings (4-rating), trade, events (lifecycle), and mission win-condition modules
- Non-military random event engine wired into the sim tick (deterministic, lifecycle)
- Mission win-condition checks wired into the sim tick

### Active

<!-- Current scope. Building toward these. -->
Full build-out of the game.md specification — see REQUIREMENTS.md and ROADMAP.md.

### Out of Scope

- **Military system** — any combat, units, defenses, or war content. See §1 of game.md. Enforced by a CI validator (planned).
- **Pixel-perfect art/music** — placeholder + generated assets only.
- **3D or rotation** requiring assets we do not have.

## Context

- Full specification lives in `game.md` (4,308 lines, 56 sections, Portuguese).
- Implementation is tracked in OpenSpec under `openspec/changes/opencaesar-game-systems/` (79 tasks, 12 sections).
- Live simulation: `src/sim/runner.ts` (`SimRunner`), builds from `src/sim/buildings.ts`, types in `src/sim/types.ts`.
- Live `BuildingType` = road | house | farm | granary | market | well. Live `BuildingCategory` = roads | housing | food | water | infrastructure.
- Tests: Vitest (`npm run test`), 126 passing tests including golden determinism. `tsc --noEmit` must be clean.
- Fragile API contract: expanding certain types previously broke 45 tests; changes need golden-equivalence verification.

## Constraints

- **Architecture**: Framework-free sim core; Phaser is view-only — [preserves determinism; D1]
- **Determinism**: Seeded RNG + fixed timestep; identical seed/map/commands → identical state — [D1, D7]
- **No military**: CI gate rejects forbidden tokens — [§1, §51, D9]
- **Data-driven balance**: no literal balance constants scattered in sim code — [D2]
- **Test hygiene**: all existing tests must stay green; golden tests regenerate only on intentional mechanic change — [§51]

## Key Decisions

- Keep `SimRunner` as the single authority; UI reads snapshots, never duplicates state — [D8]
- Goods exist as physical "loads" moved by carrier walkers; no global teleporting stock — [D6]
- Road network as a graph with localized (dirty-flag) recomputation — [D3]
- Housing follows cumulative-requirement evolution with hysteresis — [D5]

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition**:
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone**:
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

_Last updated: 2026-08-03_
