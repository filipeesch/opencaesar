## Context

The existing project (`roman-city-builder`) is a browser game built on **TypeScript + Phaser 3.90**, with a framework-free simulation under `src/sim/` exposed through a single `SimRunner`, a Phaser view under `src/game/`, Vitest + Playwright testing, and OpenSpec specs (`sim-core`, `game-shell`, `game-sessions`, `happiness`, `test-infra`). Today the sim covers: a seeded terrain map, building placement/validation, worker-driven building operation, walkers delivering food/water/labor coverage, housing tiers, a tax/wage economy, and Population + Prosperity ratings. `game.md` (4,308 lines) defines the full OpenCaesar vision across 55 sections. This design covers how to evolve the existing foundation into the complete game without a rewrite, preserving determinism and the framework-free simulation principle.

## Goals / Non-Goals

**Goals:**
- A deterministic, fixed-timestep simulation (pause + 0.5×/1×/2×/4×/8×) that never depends on frame rate.
- Fully data-driven balance: buildings, commodities, housing levels, walkers, trade cities, events, missions, localization.
- Physical goods logistics: extraction → workshop → warehouse → market → house with visible loads and no teleportation.
- Organic housing evolution across 21 plebeian/patrician levels with hysteresis and house merging.
- Road-network walker services (wandering + destination + recruiter) with coverage decay.
- Full systems: water, agriculture/food, production/storage, distribution/markets, external trade, finance, civil safety, health/education, entertainment/culture/festivals, religion/favor, ratings, requests, non-military events, campaign/tutorial/codex, and management UI.
- An automated guarantee that **no military system exists**.

**Non-Goals:**
- No military logic, combat, units, defenses, or war-themed content of any kind.
- No rewrite of already-working foundational modules unless required for the fixed-timestep/data-driven migration.
- No pixel-perfect commercial art/music (original placeholder assets + generated art only).
- No 3D or rotation requiring assets we do not have.

## Decisions

### 1. Keep the framework-free simulation core; add a fixed-timestep scheduler (D1)
`SimRunner` already separates sim from view. Add a `TimeSystem` with a configurable simulation step (e.g., 1 in-game day per N ms of real time, scaled by speed multiplier). The renderer samples the sim each frame, but the sim advances only via `step(days)` / tick. **Rationale:** guarantees determinism and frame-rate independence (§3). **Alternative:** tie sim to RAF delta — rejected (nondeterministic).

### 2. Data-driven catalogs under `data/` compiled into typed modules (D2)
Move all constants from `config.ts` into typed JSON data catalogs (buildings, commodities, housing levels, walkers, trade cities, events, missions, localization) loaded at boot and validated against schemas. **Rationale:** §3 requires all balance externalized; enables the campaign/scenario content and difficulty modifiers. **Alternative:** keep constants in code — rejected (violates spec).

### 3. Road network as a graph with localized recomputation (D3)
Represent roads as an undirected graph of tile nodes. On road build/demolish/bridge/roadblock/building-entrance changes, recompute only affected regions (dirty flags + BFS from changed tiles). Walkers route over this graph; `RoadNetworkSystem` provides reachability, pathfinding, and road-type-aware speed. **Rationale:** §9 requires connectivity and incremental updates; avoids full-map recalcs (§52).

### 4. Walker agents: wandering, destination, and recruiter (D4)
Implement walkers as light state machines driven each tick over the road graph, with per-type data (`maximumRoadSteps`, `serviceTTL`, `spawnInterval`, `movementSpeed`, `allowedRoadTypes`, `roadblockPolicy`, `serviceRadiusFromCurrentTile`, `preferredDirection`, `returnPolicy`). Wandering walkers choose deterministic pseudo-random turns at intersections and renew house service access on proximity; destination walkers run pathfinding; recruiters determine labor-pool connectivity (not per-worker). **Rationale:** §9.3–9.5; services are road-delivered, not radius circles (§4.4), except where data explicitly justifies a radius.

### 5. Housing evolution as cumulative-requirement logic with hysteresis (D5)
`HousingSystem` models each lot's current level, population, age bands, class, inventory, service access, and desirability. Evolution/de-evoution gates use cumulative `requirements`, `evolveDesirability`/`devolveDesirability`, eligibility periods, and cargo tolerance to prevent oscillation (§11.2). Merging into 2×2/3×3/4×4 lots handled by a lot/block representation. **Rationale:** §11; matches data model in §49.

### 6. Physical goods as "loads" moved by carrier walkers (D6)
Commodities exist as integer loads (1 load ≈ 100 units, §17.1). Production emits loads; carriers (`porter`, `cart`) physically travel from source to destination; warehouses/granaries/markets track reserved, in-transit, and stored amounts. No global teleporting stock (§4.2, §56). **Rationale:** the core pillar "goods exist physically" requires a transport queue and reservation system.

### 7. All simulation state on a single owned `GameState` with save/load via serialization (D7)
Evolve `save.ts` into a versioned serializer covering every system (seed, time, map, buildings, houses, population, inventories, walkers, production, routes, trade, prices, quotas, finance, religion, ratings, events, objectives, settings). Autosave rotation, quicksave/quickload, schema `version` + migration with backup, validation, and deterministic reload (§45). **Rationale:** §45 and §51 require full deterministic restore.

### 8. Management UI reads live sim snapshots; every control is wired (D8)
Advisors, overlays, inspectors, HUD, messages, and regional map are thin views over sim queries (no duplicated authority). Every listed button has a real handler; overlays use legend + heatmaps + click-through. **Rationale:** §54 acceptance criterion "no central button is merely decorative."

### 9. Military-absence enforcement as CI gate (D9)
A validator scans `src/` and `data/` for forbidden tokens (`military`, `army`, `legion`, `soldier`, `fort`, `barracks`, `weapon`, `enemy`, `invasion`, `combat`, `damageFromUnit`, etc.), allowing only explicitly-labeled documentation mentions. This is part of `test-infra` and blocks CI. **Rationale:** §1 and §51 mandate a verifiable absence guarantee.

## Risks / Trade-offs

- **[Full-game scope is large]** → Implement by vertical slices (§55: Foundation → Population → Food → Services → Industry → Trade → Advanced city → Management → Campaign → Polish), each producing a playable version; track in tasks.
- **[Data-driven migration risk of breaking existing economy]** → Keep a validated default catalog identical in behavior to current constants; golden tests lock behavior before/after migration.
- **[Walker pathfinding performance at scale]** → Road graph with localized dirty-flag recomputation, chunked spatial updates, walker pooling, and staggered updates (§52).
- **[Great-house merging/bookkeeping complexity]** → Represent merging within a block/lot model and add dedicated integration tests; keep house-merge toggleable.
- **[Determinism regressions]** → Fixed-timestep core, seeded RNG only, golden-file determinism tests, and serialization round-trip tests (§51).
- **[UI volume (13 advisors, many overlays/icons)]** → Build UI from data-driven tables/templates and wire controls incrementally per system; skip "decorative" buttons (D8).

## Migration Plan

1. Freeze current behavior with golden tests.
2. Introduce `TimeSystem` fixed timestep while keeping existing systems functionally unchanged.
3. Externalize current constants into the data catalog (validated equivalence).
4. Add systems bottom-up in the §55 slice order, landing a playable version each step.
5. Expand specs/tests in lockstep; run the military-absence validator in CI.
6. Extend save/load schema with versioning and migration once new systems land.
7. Sync delta specs to main `openspec/specs/` per the OpenSpec workflow.

Rollback: each slice is independently commit-able and reverts cleanly; data catalog changes are behind the default catalog so behavior can be pinned to prior golden output.

## Open Questions

- Exact in-game day length and speed multipliers for balance (defaults: 1× ≈ 1 day/sec real time, configurable).
- Whether housing "merge" is default-on per tier; `game.md` allows a player toggle — default on, configurable.
- Scope of per-slice UI: build minimal wired UI per slice vs. deferring to the Management slice (default: minimal per-slice inspectors, full advisors later).
- Campaign localization language (spec is Portuguese; likely ship Portuguese-first with a localization catalog).
