## 1. Project Scaffold

- [x] 1.1 Initialize Vite + TypeScript project with `src/sim/` and `src/game/` directories
- [x] 1.2 Add dependencies: phaser, vitest, fast-check, @playwright/test
- [x] 1.3 Configure ESLint boundary rules: `no-restricted-imports` blocking Phaser/`src/game` imports in `src/sim/`, and blocking `Math.random` in `src/sim/`
- [x] 1.4 Add npm scripts: `dev`, `build`, `test`, `test:unit`, `test:e2e`, `typecheck`
- [x] 1.5 Verify placeholder Phaser game boots in dev (blank scene, no errors)

## 2. Sim Core — Map, Buildings, Placement

- [x] 2.1 Implement `Tile` types, `Map` class (2D grid, size-parameterized, in-bounds queries, terrain from explicit layout and from seed)
- [x] 2.2 Implement seeded RNG module (mulberry32 or xorshift) injectable into sim
- [x] 2.3 Implement building registry (footprint, terrain requirement, road-access requirement, workers required, capacity, produces) for house/farm/granary/market/well/road
- [x] 2.4 Implement placement validation: bounds, occupancy, terrain, road adjacency
- [x] 2.5 Implement building state: staffed/active, stock with capacity bounds

## 3. Sim Core — Walkers and Services

- [x] 3.1 Implement road graph overlay (recompute adjacency on road changes) and A* pathfinding on it
- [x] 3.2 Implement walker base: type, position, state, lifetime ticks, target, seeded junction direction choice
- [x] 3.3 Implement coverage model: houses on passed tiles gain service flag with cooldown; cooldown expires
- [x] 3.4 Implement market walker cycle (fetch wheat from granary → return → deliver food to houses)
- [x] 3.5 Implement well walker (wander → deliver water)
- [x] 3.6 Implement labor walker (connect houses to workplaces; labor pool assignment; shortage → inactive)
- [x] 3.7 Implement walker despawn on lifetime expiry / objective complete

## 4. Sim Core — Economy, Housing, Ratings

- [x] 4.1 Implement farm production (staffed + fertile → wheat stock increases) and granary storage/capacity
- [x] 4.2 Implement house tiers (5 tiers), evolution up with sustained food+water+desirability, devolution on shortfall, per-tier population capacity
- [x] 4.3 Implement desirability model (base terrain + services + tax/wage policy)
- [x] 4.4 Implement taxes per house tier → treasury, wages paid, treasury floor at zero with desirability penalty
- [x] 4.5 Implement policy sliders (tax rate, wage rate) via `setPolicy`
- [x] 4.6 Implement Population and Prosperity ratings computed from sim state
- [x] 4.7 Centralize tunable constants (walk speeds, cooldowns, tier thresholds, tick rates) in `sim/config.ts`

## 5. Sim Core — SimRunner API and Determinism

- [x] 5.1 Implement `SimRunner` (seed, map) with `tick()`, `getState()`, `placeBuilding()`, `setPolicy()`, error returns on rejected commands
- [x] 5.2 Make `SimState` plain serializable data with a `toJSON`/snapshot helper
- [x] 5.3 Emit sim messages (inactive building, house evolved, low food) into a message log in state
- [x] 5.4 Verify determinism: same seed + commands → identical snapshots (manual test script before formal tests)

## 6. Test Infrastructure — Unit and Integration

- [x] 6.1 Add Vitest config and `runScenario({ seed, map, buildings, ticks })` helper
- [x] 6.2 Unit tests: placement rules (valid, terrain, road access, occupancy, bounds)
- [x] 6.3 Unit tests: walker lifecycle, junction choice determinism, coverage + cooldown decay, despawn
- [x] 6.4 Unit tests: tax calc, treasury floor, policy effects on desirability
- [x] 6.5 Unit tests: housing tier up/down transitions and population capacity
- [x] 6.6 Integration tests: food pipeline scenario (farm→granary→market→houses feed population)
- [x] 6.7 Integration tests: negative scenarios (no granary → no food; labor shortage → inactive)
- [x] 6.8 Determinism test: two sims same seed + commands → byte-identical snapshots
- [x] 6.9 Golden-file tests: record scenario final state, assert equality on re-run (with regenerate script)

## 7. Test Infrastructure — Property and E2E

- [x] 7.1 fast-check property tests: invariants (no negative resources, walkers stay on roads, capacity bounds, no NaN, no negative building counts)
- [x] 7.2 Playwright setup (headless Chromium) and E2E smoke: boot, place road + farm + granary + market + houses, assert HUD population increases, assert no console errors
- [x] 7.3 GitHub Actions workflow: vitest on push; playwright on demand/nightly; fail on test failure

## 8. Game Shell — Rendering

- [x] 8.1 BootScene + MainScene with Phaser isometric tilemap (ISOMETRIC orientation) reading sim state
- [x] 8.2 Diff-driven sprite layer: buildings/walkers mirrored from sim state each frame, renderer holds no authoritative data
- [x] 8.3 Camera pan/zoom controls over the isometric map

## 9. Game Shell — UI

- [x] 9.1 HUDScene: population, treasury, ratings, tax/wage display, updated from state each frame
- [x] 9.2 Build menu with categories (roads, housing, food, water, infrastructure), names and costs
- [x] 9.3 Placement mode: ghost preview with valid/invalid tint, click to place, error message on rejection
- [x] 9.4 Policy sliders for tax rate and wage rate wired to `setPolicy`
- [x] 9.5 Advisor message log rendering sim messages

## 10. Art Pipeline

- [x] 10.1 Procedural placeholder renderer (Phaser Graphics flat-color tiles/buildings) — game boots and is playable with zero art assets
- [x] 10.2 Asset manifest + loader: sprite sheets keyed by type with placeholder fallback
- [x] 10.3 Generate first AI isometric art set (terrain tiles + one building) and wire into manifest
- [x] 10.4 Document art pipeline (sheet dims, naming, regeneration) for future sets

## 11. Verification and Handoff

- [x] 11.1 Run full verification: `npm run typecheck`, `npm run test` (all vitest + property), `npm run test:e2e`
- [x] 11.2 Manual playtest: full happy path from empty map to population growth and rating movement
- [x] 11.3 Verify OpenSpec specs are covered by tests; sync any gaps back to specs
