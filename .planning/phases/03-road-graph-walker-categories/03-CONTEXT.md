# Phase 3: Road Graph & Walker Categories - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous batch acceptance, THIS is the record)

<domain>
## Phase Boundary

Turn the road network into a graph with localized (dirty-flag) recomputation, give
roads distinct types with movement + desirability effects, and categorize walkers as
wandering / destination / recruiter with real per-type data. Requirements: ROAD-01,
ROAD-02, ROAD-03. Success criteria (ROADMAP): (1) adding/demolishing a road recomputes
only the affected region and connectivity reflects the change; (2) road types affect
walker speed and desirability; (3) wandering, destination, and recruiter walkers behave
per their data (return at max steps, pathfind, labor-pool link).

Baseline verified 2026-08-03: `npm run typecheck` clean; `npm run test` → **289 tests
pass** across 46 files (~2.6s). This phase is NON-frontend and test-driven — no Phaser/UI
work; every behavior is unit-tested through the `src/sim/*` pure modules.
</domain>

<decisions>
## Implementation Decisions

### Treatment of Existing Implementation (baseline scout)
- Verify-as-built + gap-fill, mirroring Phase 2. `src/sim/roadNet.ts`, `roadTypes.ts`,
  `walkerProfiles.ts` already exist with passing unit tests (5 / 4 / 3 tests). Do NOT
  rewrite them — close the genuine gaps below and add the missing wiring/tests.
- Baseline confirmed: `npm run typecheck` clean; `npm run test` → **289 tests pass**
  (46 files, ~2.6s).

### 1. ROAD-01: audit + fix roadNet dirty-flag region + connectivity; multi-region tests
- Audit `src/sim/roadNet.ts` and fix correctness: an `addRoad` on a tile with NO road
  neighbors never gets a component id (verified empirically — `connected(tile, tile)`
  returns false for an isolated node, roadNet.ts:135-146 fallback branch is dead when
  `seeds` is empty). Connectivity must reflect isolated adds.
- Widen `affectedTiles()` to report the actual recomputed (dirty) region — today it
  returns only the single changed tile (`[{x,y}]`, roadNet.ts:75/86) while the recompute
  re-floods the whole touched component(s). This is the "dirty-flag region correctness"
  the decision names.
- Add tests for multi-region disconnect/reconnect: two independent components bridged by
  a single tile, then cut — both halves stay internally connected while the cross link
  breaks; a third region stays untouched (region isolation).
- Wiring `RoadNetwork` into `SimRunner`'s build/demolish is OUT of scope this phase
  (class-level audit per the decision). Note as deferred.

### 2. ROAD-02: 7-type coverage verified; speed + desirability effects NOT wired — wire them
- `ROAD_TYPES` covers all 7 types (dirt, paved, plaza, bridge, service_roadblock,
  wharf_access, stairs) — as-built, `tests/unit/road-types.test.ts` pins it. No change
  needed to the type table.
- **Genuine gap (verified):** `roadTypes.ts` is imported NOWHERE in `src/` (grep). Walker
  speed uses the flat `CONFIG.walkerSpeedPerTick` (walkers.ts:263) and house desirability
  ignores roads entirely (housing.ts:17-52). The map has no per-tile road type (TileType
  is a bare 'road', types.ts:9; TileState has no roadType field, tile.ts:9-25). So the
  ROAD-02 success criterion is unmet.
- Wire at the sim level (NON-frontend): add a per-tile `roadType: RoadType | null`
  side-channel on `TileState` (null == dirt), Map gets `roadTypeAt`/`setRoadType`, walker
  per-tick progress multiplies by `roadSpeedMultiplier(effectiveType)`, and
  `desirabilityOf` adds `roadDesirability(effectiveType)` from orthogonally adjacent road
  tiles. `service_roadblock` is impassable for movement but still contributes its (0)
  desirability. Paving via a UI is deferred (frontend); tests construct typed tiles
  directly via `Map.setRoadType`.
- Because adjacent-road desirability is new, the two food-city goldens
  (`tests/golden/fixtures/*.json`, houses sit on road-adjacent rows) change — regenerate
  them intentionally (`GOLDEN_UPDATE=1 npm run test:golden:update`) in the task that wires
  desirability.

### 3. ROAD-03: audit three categories against walkerProfiles; gap-fill tests + wiring
- Category data as-built: `walkerProfiles.ts` classifies well/fountain/engineer/fireman/
  doctor/teacher/librarian/entertainer/priest -> wandering, market -> destination, and
  official/senator -> recruiter. Tests pin classification (walker-profiles.test.ts).
- **Genuine gaps (verified):** `walkerProfiles.ts` is imported NOWHERE in `src/` (grep);
  `walkers.ts` behavior never consults a profile. Concretely:
  - Wandering: NO return-at-maxRoadSteps (move() picks a random neighbor forever until
    lifetime; walkers.ts:254-260).
  - Destination: market/labor pathfind via `findRoadPath` — as-built ✓ (walkers.ts:190-200).
  - Recruiter: `official`/`senator` are categorized recruiter but are NOT in the
    `WalkerType` union (types.ts:27-29) so no recruiter walker can spawn or act. The
    existing labor-pool link mechanism is the house-spawned `labor` walker
    (runner.ts:621-645, walkers.ts:234-239) — that IS the recruiter behavior in the code.
- Implement the cheap, testable wiring: per-type movementSpeed (default 0.5 ==
  CONFIG.walkerSpeedPerTick), serviceTTL for service freshness (default 120 ==
  CONFIG.serviceCooldownTicks), and wandering return-at-maxRoadSteps with
  `returnPolicy`. Defaults equal current constants so no golden churn. Recruiter spawn of
  official/senator walkers is deferred (governance, Phase 14) — the phase proves the
  recruiter labor-link via the existing `labor` walker contract test.

### 4. WalkerProfile schema: verify all per-type fields + profile-contract test
- Schema (walkerProfiles.ts:14-35) already covers all 9 ROAD-03 fields: maxRoadSteps,
  serviceTTL, spawnInterval, movementSpeed (= "speed"), allowedRoadTypes, roadblockPolicy,
  serviceRadiusFromCurrentTile (= "serviceRadius"), preferredDirection, returnPolicy.
  No fields missing — add a profile-contract test that pins every field for every catalog
  walker (typed, finite, in-range) so the schema cannot silently regress.

### 5. Per-category roadblock permissions (configurable) + tests; graph-path distance
- Add a per-category `ROADBLOCK_POLICY_BY_CATEGORY` table (defaults: wandering 'stop',
  destination 'pass', recruiter 'stop') consumable by a `mayTraverse(profile, type)`
  helper: a walker crosses a tile when it is normally passable AND (the type is in
  `allowedRoadTypes` OR the type is service_roadblock with policy 'pass').
- Give `findRoadPath` an optional per-walker `isTraversable` predicate (default unchanged
  = terrain 'road') so destination pathfinding routes around blocked roadblocks; wandering
  neighbor choice honors the same predicate.
- Confirm road DISTANCE is graph-path only: tests prove a Manhattan-near-but-graph-
  unreachable granary is never served (startSeeking returns false, no Euclidean fallback).

### Claude's Discretion
Exact internal shapes (which recolorRegion returns for the dirty set; how
`ROADBLOCK_POLICY_BY_CATEGORY` is configured; field names on TileState) are left to the
planner/executor so long as the five decisions above hold and their tests stay green.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/sim/roadNet.ts:27-177` — `RoadNetwork` (edges/components/localized recolor);
  add/remove at 64-87; `affectedTiles()` at 42-44; isolated-add bug at 135-146.
- `src/sim/roadTypes.ts:29-37` — `ROAD_TYPES` (all 7 types), speedMultiplier/desirability/
  passable helpers at 39-53. Verified UNCONSUMED in src/.
- `src/sim/walkerProfiles.ts` — `WalkerProfile` (all 9 fields), category map, defaults.
  Verified UNCONSUMED in src/.
- `src/sim/walkers.ts` — `WalkerInstance`, `createWalker` (101-117), `updateWalker`
  (120-141), `move` (249-271, flat CONFIG.walkerSpeedPerTick at 263), `serviceHousesAround`
  (154-166, CONFIG.serviceCooldownTicks), `startSeeking` (190-201, findRoadPath at 193).
- `src/sim/pathfind.ts:33-101` — deterministic A* over the road graph; hardcoded
  `map.get(...) === 'road'` at 36/77 (no type/predicate filter).
- `src/sim/map.ts` — `Map` class; `tileState`/`mutateTileState` side-channel at 128-137;
  terrain authority is `set`/`setRect`.
- `src/sim/tile.ts:9-25` — `TileState` bag (CORE-03); will host the new `roadType`.
- `src/sim/housing.ts:17-52` — `desirabilityOf` (terrain base + policy + service bonus);
  the hook point for adjacent-road desirability.
- `src/sim/runner.ts:382-384/421-423` — road build/demolish mutate terrain only;
  `getTileState` at 495-498 (where roadType surfaces); `tickSpawns` 621-645 (house -> labor
  recruiter walker); `adjacentRoadTile` 760-767.
- Existing tests: `tests/unit/roadnet.test.ts` (5), `road-types.test.ts` (4),
  `walker-profiles.test.ts` (3), `walkers.test.ts` (13), `tests/property/invariants.test.ts`
  (incl. "walkers never leave the road graph"), `tests/golden/golden.test.ts` (2).

### Established Patterns
- Sim core is framework-free and unit-testable under Vitest (node env, tests/**/*.test.ts).
- TileState is the CORE-03 side-channel bag; terrain grid stays the authority for
  placement/pathfinding — roadType follows this pattern (side-channel refinement).
- Config/balance values are externalized via CONFIG (walkerSpeedPerTick=0.5,
  serviceCooldownTicks=120, laborSpawnEveryTicks=60 in data/balance.ts:17/25/31); profile
  defaults intentionally match them to avoid behavioral churn.
- `Map.setRoadType` + direct stub SimInternals (pattern from tests/unit/walkers.test.ts)
  is the unit-test harness — no Phaser.
- Golden regeneration is an intentional, documented mechanic change
  (`npm run test:golden:update`).

### Integration Points
- `walkers.ts move()` — speed multiplier composition (profile.movementSpeed *
  roadSpeedMultiplier(tile)).
- `housing.ts desirabilityOf` — adjacent-road desirability contribution.
- `pathfind.ts findRoadPath` — optional isTraversable predicate (used by walkers.ts).
- `runner.ts getTileState` — expose roadType to the public snapshot (no UI change).
- Fast loop: `npm run typecheck` + targeted `npx vitest run tests/unit/<file>`; full
  `npm run test` after each wave.
</code_context>

<specifics>
## Specific Ideas

The accepted decisions (1-5 above) fully define scope. Every decision is verifiable by
unit tests; wiring stays in the pure sim layer. No user input needed — this is a
verify-as-built + gap-fill batch with genuine implementation gaps to close (road types
unwired, walker profiles unconsumed, isolated-add connectivity bug). Golden fixtures are
regenerated once, deliberately, for the desirability wiring.
</specifics>

<deferred>
## Deferred Ideas

- Wiring `RoadNetwork` into `SimRunner` build/demolish (so the sim itself maintains the
  graph, not just the class) — ROAD-01 lives at class level this phase.
- Official/senator (recruiter) walker spawning from forum/senate — WalkerType lacks them;
  deferred to Phase 14 (Governance). The recruiter labor-pool link is proven via the
  existing `labor` walker.
- Paving/parking UI (placing paved/plaza/etc. roads from the game shell) — frontend,
  deferred; typed roads are exercised at the sim/test level via `Map.setRoadType`.
- Per-walker (not per-category) movement/service overrides in `data/walkers.ts` — today
  all walkers of a category share defaults; per-walker data is a future enhancement.
- Entrance/wharf/stairs-specific pathing semantics beyond passability (e.g., boat ramps)
  — only the 7-type desirability/speed/passability table is wired now.
</deferred>
