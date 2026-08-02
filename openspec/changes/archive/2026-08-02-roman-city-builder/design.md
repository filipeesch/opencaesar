# Design — Roman City Builder MVP

## Context

Greenfield browser game: a Caesar III-inspired 2D isometric Roman city-builder. Stack decided in exploration: **Phaser 3 + TypeScript + Vite**, sim logic framework-free, full automated test pyramid. MVP covers the playable core: terrain, roads, buildings, the walker service mechanic, food/water/labor flows, taxes, and Population + Prosperity ratings. Art is AI-generated isometric sprites with a procedural placeholder fallback.

## Goals / Non-Goals

**Goals:**
- A playable loop: place roads + buildings → walkers deliver services → houses evolve → population grows → taxes fill treasury.
- Deterministic, headless-testable simulation (`src/sim/` with zero Phaser imports).
- Full test pyramid: Vitest unit/integration/determinism, fast-check invariants, Playwright E2E, GitHub Actions CI.
- Clean sim/renderer seam so mechanics are validated without a browser.

**Non-Goals (explicitly deferred):**
- Military/combat, disasters, campaign/scenarios, multiplayer, save/load, Culture/Peace/Favor ratings, advanced trade (import/export), sound design, high-fidelity art.

## Decisions

### D1: Sim/renderer split with an ESLint boundary

`src/sim/` imports nothing from `src/game/` or Phaser; enforced via ESLint `no-restricted-imports` rule. `SimRunner` is the single public API: `tick()`, `getState()`, `placeBuilding()`, `setPolicy()`, `getCommandLog()`. `SimState` is plain serializable data.

**Rationale:** enables headless Node tests running thousands of ticks in ms; keeps mechanics independent of Phaser lifecycle; Phaser scene becomes a dumb view. **Alternatives considered:** Phaser-scene-centric design (sim inside scene) — rejected, ties logic to render loop; embedded ECS (Bevy) — rejected, two-language complexity.

### D2: Deterministic RNG injected into the sim

All randomness (walker junction turns, terrain gen, spawn variance) flows through a seeded RNG (e.g. mulberry32/xorshift) owned by `SimRunner` and injected at construction. No global `Math.random` in `sim/` (ESLint rule).

**Rationale:** same seed + same command sequence → identical state after N ticks. Unlocks golden-file tests and reproducible debugging. **Alternatives:** global random with seedable override — rejected, fragile and easy to bypass.

### D3: Fixed-timestep simulation loop

Sim advances in fixed tick units (e.g. 10 ticks/s for game-time); Phaser's `update()` accumulates real dt and runs exactly N sim ticks, capped (spiral-of-death guard). Rendering reads state each frame.

**Rationale:** deterministic behavior regardless of frame rate; tests just call `tick()` N times. **Alternatives:** per-frame variable-step — rejected, non-deterministic and flaky for walker timing.

### D4: Walkers as state machines on a road graph

Each walker: `{ type, tile, state, lifetimeTicks, targetTile, carriedGoods }`. States per type (e.g. market: `going-to-granary`, `returning-with-food`, `delivering`; well: `wandering`). Junctions choose direction via seeded RNG. **Coverage**: each tick, walker marks houses on tiles it passes with a service flag + cooldown; services must be re-supplied (cooldown decay), preventing one-time "cheese".

**Rationale:** mirrors Caesar III's famous walker mechanic; the cooldown model keeps it testable (assert flag set → decay after N ticks). **Alternatives:** radius-based "aura" services — simpler but loses the signature gameplay and the walking-on-roads requirement that makes road layout matter.

### D5: Road graph with on-demand pathfinding

Road tiles form an undirected graph; A* used for targeted walkers (market → granary, labor → workplace). Graph recomputed on road placement/removal (cheap at 40x40).

**Rationale:** A* on a small graph is fast and gives targeted delivery; random wander for well/simple walkers. **Alternatives:** precomputed path grids — overkill at MVP scale.

### D6: Housing tiers from coverage + desirability

House tiers (shack → villa, 5 tiers): evolve up when food + water + labor coverage and desirability thresholds met for a sustained window; devolve on persistent shortfall. Population = sum of house tier capacities. Desirability = base terrain + a bonus per active service (food/water/labor coverage) + wage/tax policy spread − unpaid-wage penalty; coverage also gates evolution directly.

**Rationale:** captures Caesar III's evolution hook without full luxury-goods simulation. **Alternatives:** flat population growth — too simple, loses the "why build services" feedback loop.

### D7: Economy — worker pool + taxes + policy sliders

- **Labor**: houses produce workers (tier-based) → a city worker pool; buildings pull workers when a labor walker connects them to houses (per-building connection flag with a cooldown); shortage → building inactive (production stops). The pool is global — per-building "reachability" is approximated by the connection flag rather than a per-building set.
- **Taxes**: houses pay per tick by tier; treasury accumulates; over-taxation reduces desirability.
- **Policy sliders**: tax rate and wage rate; wages paid from treasury reduce desirability pressure and keep workers loyal (simplified: wage affects desirability + worker availability).

**Rationale:** a small, legible economy loop that rewards planning; no money-goods transport beyond wheat. **Alternatives:** full import/export trade — deferred to later change.

### D8: Phaser shell — isometric tilemap, scene-per-concern

- Phaser `Tilemap` with `mapOrientation: ISOMETRIC`, tile dims (e.g. 60x30) matching our art sheet grid.
- Scenes: `BootScene` (asset load) → `MainScene` (game view: tilemap, building sprites, walker sprites) → `HUDScene` (top-level UI overlay).
- Building placement: pointer → tile under cursor → ghost preview (valid/invalid tint) → click issues `placeBuilding` to `SimRunner`.
- Sprites are added/removed based on sim state diffs (renderer mirrors state, never holds authoritative game data).

**Rationale:** Phaser's built-in isometric tilemap handles diamond math, depth sorting, camera pan/zoom. Scenes isolate concerns. **Alternatives:** raw PixiJS — full control but we'd hand-build the tilemap; rejected for MVP speed.

### D9: Test pyramid

```
                    ┌────────────┐
                    │ E2E (few)  │ Playwright: boot, place building, sim reacts
                    ├────────────┤
                    │ Renderer   │ Phaser smoke: boot scene, no console errors
                    ├────────────┤
                    │ Integration│ Vitest scenarios: farm→granary→market→houses
                    ├────────────┤
                    │ Unit       │ Vitest: economy, walkers, housing, placement
                    └────────────┘
```

- **Unit (Vitest)**: each sim module in isolation — walker states, coverage decay, placement rules, tax calc, tier transitions.
- **Integration (Vitest)**: `runScenario({map, buildings, ticks})` helper stepping `SimRunner`; assert full pipeline results (food reaches houses → population grows).
- **Determinism/golden (Vitest)**: same seed + commands → byte-identical state snapshots; golden files recorded and asserted.
- **Property (fast-check)**: invariants over random seeds/maps — no negative food, walkers never leave roads, granary never exceeds capacity, no NaN state.
- **E2E (Playwright)**: headless Chromium — boot game, place road + farm + granary + market + houses via UI, assert HUD population increases.
- **CI (GitHub Actions)**: vitest on every push; playwright on demand/nightly.

### D10: Art pipeline

AI-generated isometric sprite sheets (e.g. per-tile 60x30 dims, per-building footprint-scaled sheets), generated in small consistent sets (one terrain tile set, one sheet per building type). Loose naming convention `sheet:<type>` with a loader manifest. **Fallback:** procedural flat-color tiles/sprites rendered by Phaser `Graphics` until real art exists — the game must boot and test with zero art assets. This unblocks development and CI; art swap is a data change only.

**Rationale:** art is the riskiest dependency; keeping it a swappable asset layer avoids blocking the sim. **Alternatives:** hand-drawn (slow, needs artist), CC0 packs (inconsistent style).

## Risks / Trade-offs

- [AI art consistency] → small per-building sheets, single-style prompts, procedural fallback keeps CI green.
- [Walker performance at scale] → A* on 40x40 graph is trivial; revisit with thousands of walkers later (not in MVP).
- [Sim complexity creep] → non-goals list enforced; every feature beyond MVP goes in a follow-up change.
- [Phaser tilemap isometric quirks] → keep rendering diff-driven and thin; visual bugs don't corrupt sim state.
- [Golden files become stale] → regenerate intentionally on mechanic changes; determinism contract documented.

## Migration Plan

Greenfield — no migration. Rollback = revert commit; sim state is plain data so no schema migration path needed yet.

## Open Questions

- Exact walker service cooldown durations and house tier thresholds — tune during integration testing; expose as constants in `sim/config.ts` so tests can reference them.
- Default map size 40x40 vs larger — start 40x40, keep `Map` size-parameterized.
- Phaser version pinned (3.60+ recommended) for isometric tilemap stability.
