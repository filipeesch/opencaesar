## Why

`game.md` defines a complete master specification for **OpenCaesar**, a 2D isometric Roman city-builder. The current project (`roman-city-builder`) implements only a foundation slice: terrain map, basic placement, walkers, food/water/labor coverage, housing evolution, tax/wage economy, and Population + Prosperity ratings. The full vision -- physical goods logistics, evolution-based housing across 21 levels, markets and trade routes, water/aqueducts, fire/collapse/crime, health/education/entertainment/religion, city ratings, administrative requests, and a campaign -- is not yet implemented. This change proposes implementing the full gameplay systems described in `game.md` as a set of data-driven, deterministic, testable capabilities, with an explicit guarantee that **no military system exists**.

## What Changes

- Add a **fixed-timestep deterministic simulation core** with pause and 0.5×–8× speeds, where the simulation never depends on frame rate.
- Make **all balance data data-driven** (buildings, commodities, housing levels, walkers, trade cities, events, missions, localization) instead of scattered constants.
- Implement **physical goods logistics**: extraction → workshop → warehouse → market → house, with real loads moved by visible walkers and no teleportation.
- Implement **organic housing evolution** across the 21-level plebeian/patrician progression with cumulative requirements, hysteresis, and house merging.
- Add **service walkers that travel roads** (wandering and destination-based), road network graph, labor recruiters, and coverage decay.
- Add **water system** (wells, reservoirs, aqueducts, fountains, baths), **agriculture/food** (farms, fishing, granaries), **production/storage** (extraction, workshops, warehouses with per-commodity orders), **markets** (buyers/sellers), and **external trade** (regional map, land/sea routes, quotas, prices).
- Add **finance** (taxes, treasury, debt, governor salary), **civil safety** (fire, collapse, crime, urban watch, engineering), **health & education**, **entertainment → culture & festivals**, and **religion with divine favor**.
- Add **city ratings** (Culture, Prosperity, Stability, Favor), **administrative requests**, **non-military random events**, a **campaign with 10 missions**, **contextual tutorial**, and **codex**.
- Add **advisors, overlays, inspectors, messages, regional map, options & accessibility** UI that reflects real sim state (no decorative controls).
- Add **extended save/load** with autosave, quicksave, migration, and deterministic reload.
- Enforce **no military system** via a dedicated absence test and search.

## Capabilities

### New Capabilities

- `desirability`: per-tile desirability field from radial building effects, incremental updates, and decomposed house inspector.
- `population-labor`: population per-residence model, age bands, social classes, migration attractiveness, homelessness, labor force, recruiter walkers, wages, unemployment.
- `water`: wells, reservoirs, aqueducts, fountains, public baths, water flow/coverage and overlay.
- `agriculture-food`: farms, olive/vine farms, fishing wharf, granaries, food types, production formula.
- `production-storage`: extraction sites, workshops, warehouses, per-commodity storage orders, and physical load logistics.
- `distribution-market`: market buyers/sellers, internal market stock, supplier selection, household distribution.
- `trade`: regional/empire map, land and sea routes, caravans, merchant ships, commercial wharf, trade orders, annual quotas, prices.
- `finance`: taxes, treasury, debt, governor salary and personal account, revenue/expense tracking.
- `civil-safety`: fire risk/response, structural collapse, crime and civil order, urban watch, engineering posts.
- `health-education`: health buildings (bath, barber, clinic, hospital), education buildings (school, library, academy), capacity vs. coverage.
- `entertainment-culture`: training schools and venues (theatre, auditorium, arena, hippodrome), coverage scoring, festivals.
- `religion`: cults, temples, oracles, festival square, divine favor states and blessings/penalties.
- `governance-administration`: forum, senate, governor residences, administrative requests, personal account.
- `ratings-objectives`: Culture/Prosperity/Stability/Favor ratings, decomposition, campaign objectives and win conditions.
- `events`: deterministic non-military random events with cause/duration/effects/messages.
- `campaign`: original 10-mission campaign, contextual tutorial, and in-game codex.
- `ui-management`: advisors (13), overlays, inspectors (house, production, storage, market, walker), messages/alert aggregation, options & accessibility.

### Modified Capabilities

- `sim-core`: extend to a fixed-timestep deterministic core with the full road network graph, road types, walker categories, data-driven building catalog, and wider tile state (fire/collapse/pollution/traffic/desirability).
- `game-shell`: extend the Phaser view for overlay renderer, walker/effect renderers, build menu with categories, and full HUD fed from real sim state.
- `game-sessions`: extend save/load to serialize all new systems, with autosave, quicksave, schema versioning, migration, and deterministic reload.
- `happiness`: extend to a city wide mood/sentiment that feeds migration attractiveness and ratings.
- `test-infra`: extend integration scenarios (basic city, ceramics chain, export, import, labor scarcity, aristocratic evolution, regression, save/load) and the military-absence test.

## Impact

- **Code**: `src/sim/*` (new systems, refactoring `config.ts` to data-driven), `src/game/*` (renderers, scenes, UI), new data files under `data/`, and expanded `src/save.ts`.
- **Specs**: new delta/spec files under this change; main specs under `openspec/specs/` will be synced on archive.
- **Data**: new JSON data-driven catalogs for buildings, commodities, housing levels, walkers, trade cities, events, missions, localization.
- **Tests**: expanded Vitest unit/integration/determinism suites, Playwright E2E, and a mandatory military-absence validator.
- **Dependencies**: no new runtime framework beyond Phaser (already present).
