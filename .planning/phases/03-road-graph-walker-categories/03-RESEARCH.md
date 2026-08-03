# Phase 3: Road Graph & Walker Categories — Research

**Date:** 2026-08-03
**Researcher:** gsd-phase-researcher (inline, combined session)
**Baseline verified:** `npm run typecheck` clean; `npm run test` → **289 tests pass** across
46 files (~2.6s). Sieves: full suite is cheap, so per-task sampling is a targeted vitest file
+ typecheck, with the full suite after each wave.

---

## 1. Existing Implementation Summary

### ROAD-01 — RoadNetwork graph with localized recompute (mostly as-built, two genuine gaps)

- `src/sim/roadNet.ts:27-177` implements the graph: `build` (51-61) reconstructs from the
  map; `addRoad` (64-76) and `removeRoad` (79-87) update edges and re-color only the
  touched component(s) via `recolorRegion` (135-161); `connected` (101-106) is O(1) via the
  component map; `affectedTiles` (42-44) exposes the observability/dirty set.
- Verified connect/disconnect across a bridge works: bridging two clusters then removing
  the single bridge tile splits them again with both halves internally connected
  (empirically confirmed; also covered by roadnet.test.ts:21-38 for the single-bridge case).
- **Gap A (GENUINE — bug, empirically confirmed):** `addRoad` on a tile with no road
  neighbors never assigns a component. `recolorRegion` receives `seeds = []` (roadNet.ts:66,
  135), `touchedCompIds` is empty (143), and the fallback loop `for (const k of seeds)
  this.floodComponent(k)` (145) iterates nothing — so the new isolated node keeps no entry
  in `components` and `connected({x,y},{x,y})` returns **false** even with `nodeCount() ===
  1`. "Connectivity reflects the change" fails for isolated adds.
- **Gap B (GENUINE — dirty-flag region):** `affectedTiles()` returns only the single
  changed tile `[{x,y}]` (roadNet.ts:75, 86) while the header (34-35) promises "the dirty
  set … (affected region)". The actual recompute re-floods every tile in the touched
  component(s) (149-160), so the observable dirty region is wrong/too small.
- **Gap C (coverage):** no multi-region disconnect/reconnect tests — existing coverage is
  single-bridge only (roadnet.test.ts:21-38) and the first attempt at a bridge is even
  commented out as flawed (roadnet.test.ts:24-26). No region-isolation test.
- **Observability:** `RoadNetwork` is not imported anywhere in `src/` (grep) — the sim
  build/demolish mutates terrain only (runner.ts:382-384, 421-423). Decision confines
  ROAD-01 to class-level correctness this phase.

### ROAD-02 — road types (table as-built; effects NOT wired)

- `src/sim/roadTypes.ts:29-37` defines all **7** required types (dirt, paved, plaza,
  bridge, service_roadblock, wharf_access, stairs) with speedMultiplier / desirability /
  passable. `tests/unit/road-types.test.ts` pins the key set and helpers (1-25).
  Coverage vs the 7-type list: **complete**.
- **Gap (GENUINE — effects never wired):** `roadTypes.ts` helpers are imported NOWHERE in
  `src/` (grep; only road-types.test.ts imports them). Specifically:
  - Walker speed: `move()` at walkers.ts:263 advances `w.progress +=
    CONFIG.walkerSpeedPerTick` (flat 0.5) with no road-type multiplier.
  - Desirability: `desirabilityOf` (housing.ts:17-52) reads only the house tile's own
    terrain base (switch at 26-41) — no adjacent-road contribution at all; paved/plaza
    desirability values are dead data.
  - No per-tile road type exists: `TileType` is a bare `'road'` (types.ts:9) and
    `TileState` has no roadType field (tile.ts:9-25). A tile cannot be "paved" vs "plaza".
- Goldens: houses in the food-city sit on road-adjacent rows (helpers.ts:38-54), so adding
  adjacent-road desirability changes `BuildingState.house.desirability` (runner.ts:561) —
  the two `tests/golden/fixtures/*.json` must be regenerated intentionally.

### ROAD-03 — walker categories & per-type data (schema as-built; behavior NOT wired)

- `src/sim/walkerProfiles.ts:11-35` — `WalkerCategory`, `RoadBlockPolicy`, and the
  `WalkerProfile` interface covering all 9 ROAD-03 fields: maxRoadSteps, serviceTTL,
  spawnInterval, movementSpeed (=req "speed"), allowedRoadTypes, roadblockPolicy,
  serviceRadiusFromCurrentTile (=req "serviceRadius"), preferredDirection, returnPolicy.
  Classification map (37-50): well/fountain/engineer/fireman/doctor/teacher/librarian/
  entertainer/priest -> wandering; market -> destination; official/senator -> recruiter.
  Defaults (52-63): maxRoadSteps 8, serviceTTL 120, spawnInterval 40 (recruiter 60),
  movementSpeed 0.5, allowedRoadTypes [dirt,paved,plaza,bridge], roadblockPolicy 'stop',
  serviceRadiusFromCurrentTile 0, preferredDirection 'straight', returnPolicy true.
  Existing tests: walker-profiles.test.ts (3 tests).
- **Gap (GENUINE — profiles unconsumed):** `walkerProfiles.ts` is imported NOWHERE in
  `src/` (grep). `walkers.ts` never calls `walkerProfile()`; behavior is hardcoded:
  - Wandering: `decide()` (169-172) does nothing for non-market/labor types and `move()`
    (254-260) picks a random road neighbor forever — no maxRoadSteps return, no
    returnPolicy.
  - Destination: market + labor pathfind via `startSeeking`/`findRoadPath` (190-201),
    covered by walkers.test.ts (201-239) — **as-built** ✓.
  - Recruiter: `official`/`senator` (recruiter per profiles) are absent from the `WalkerType`
    union (types.ts:27-29), so no recruiter walker can spawn. The actual labor-pool link in
    code is the house-spawned `labor` walker (runner.ts:621-645; walkers.ts:234-239 sets
    `laborConnected`), which IS the recruitment mechanism.
- WalkerType union (types.ts:27-29) also lacks doctor/fireman/engineer/priest/entertainer
  spawn types, but those service walkers are surfaced via category-default behavior; only
  recruiter spawning is deferred (Phase 14).

### Pathfinding & distance semantics (ROAD-03 decision 5)

- `src/sim/pathfind.ts:33-101` — deterministic A* over the road graph (FIFO tie-break),
  hardcoded `map.get(...) === 'road'` at 36/77. No per-walker traversability, no Euclidean
  fallback in the travel path.
- Candidate SELECTION uses Manhattan (`nearestHouseNeeding`/`nearestGranaryWithWheat`/
  `nearestBuildingNeedingLabor`, walkers.ts:273-318), but actual TRAVEL is always
  `findRoadPath` (graph A*). So distance used for movement is graph-path; a
  Manhattan-near-but-unreachable target yields `path === null` → `startSeeking` returns
  false (walkers.ts:194) and the walker keeps wandering. This is confirmable by test.

---

## 2. Gaps vs Requirements

| Requirement | Status | Gap |
|-------------|--------|-----|
| ROAD-01 graph exists | ✅ as-built | `RoadNetwork` class works for built/bridge cases |
| ROAD-01 connectivity after isolated add | ❌ bug | Isolated `addRoad` never gets a component (roadNet.ts:135-146) — `connected(t,t)` false |
| ROAD-01 dirty-flag region | ❌ wrong | `affectedTiles()` returns only the single tile (roadNet.ts:75/86); promises affected region |
| ROAD-01 multi-region disconnect/reconnect tests | ❌ missing | Only single-bridge coverage (roadnet.test.ts:21-38); no isolation test |
| ROAD-02 all 7 types covered | ✅ as-built | road-types.test.ts pins the key set |
| ROAD-02 type affects walker speed | ❌ missing | `roadTypes.ts` unused; flat CONFIG.walkerSpeedPerTick (walkers.ts:263) |
| ROAD-02 type affects desirability | ❌ missing | `desirabilityOf` ignores roads (housing.ts:17-52) |
| ROAD-02 per-tile road type | ❌ missing | No roadType on TileState/tile.ts; TileType is bare 'road' |
| ROAD-03 schema covers all 9 fields | ✅ as-built | All fields present (walkerProfiles.ts:14-35) |
| ROAD-03 wandering return-at-maxRoadSteps | ❌ missing | No steps counter/return in walkers.ts |
| ROAD-03 destination pathfind | ✅ as-built | findRoadPath via startSeeking (walkers.ts:190-201) |
| ROAD-03 recruiter labor-pool link | ⚠️ partial | Via `labor` walker only; official/senator unspawnable (types.ts:27-29) |
| ROAD-03 profile data consumed | ❌ missing | walkerProfiles.ts imported nowhere in src/ |
| Per-category roadblock permissions | ❌ missing | No per-walker traversability predicate; pathfind hardcodes road |
| Graph-path distance (no Euclidean fallback) | ✅ as-built | Travel is findRoadPath; needs a confirming test |

---

## 3. Open Questions (all RESOLVED)

| # | Question | Resolution |
|---|----------|------------|
| Q1 | Does `RoadNetwork` handle isolated adds correctly? | **RESOLVED:** No — bug at roadNet.ts:135-146 (fallback loop dead when seeds empty). Empirical: `connected({0,0},{0,0})` false after single `addRoad(0,0)`. |
| Q2 | Is `affectedTiles()` the real dirty region? | **RESOLVED:** No — returns only `[{x,y}]` while recolor re-floods the whole touched component(s). Widen to the re-colored region. |
| Q3 | Are ROAD_TYPES wired anywhere? | **RESOLVED:** No — grep finds zero src/ imports of roadTypes helpers. Speed + desirability effects must be wired this phase. |
| Q4 | Is there per-tile road type storage? | **RESOLVED:** No — TileState has no roadType; TileType is bare 'road'. Add a side-channel field (CORE-03 pattern). |
| Q5 | Are walkerProfiles consumed by movement logic? | **RESOLVED:** No — walkers.ts never reads a profile. Wire movementSpeed/serviceTTL/returnPolicy/maxRoadSteps/roadblock. |
| Q6 | Which walker categories exist as spawnable types? | **RESOLVED:** Destination (market/labor) ✓; wandering (well/service) partially; recruiter spawn deferred — official/senator absent from WalkerType (types.ts:27-29). Recruiter labor-link proven via the `labor` walker. |
| Q7 | Do profile defaults preserve current behavior (no golden churn)? | **RESOLVED:** Yes — movementSpeed 0.5 == CONFIG.walkerSpeedPerTick (0.5); serviceTTL 120 == CONFIG.serviceCooldownTicks (120). Only ROAD-02 desirability changes goldens (regenerated once). |
| Q8 | Does pathfinding ever use Euclidean distance for travel? | **RESOLVED:** No — candidate selection uses Manhattan, but travel is always graph A* (findRoadPath). Add a confirming test (unreachable-near granary never served). |
| Q9 | Actual baseline test count? | **RESOLVED:** 289 tests / 46 files (~2.6s). Older "273" (Phase 2) is superseded. |
| Q10 | Will road-type speed wiring break "walkers never leave the road graph"? | **RESOLVED:** No — the property invariant tests only assert tiles are 'road'; multipliers change speed, not legality. |
| Q11 | Does the profile-contract decision need schema mutation? | **RESOLVED:** No fields are missing — decision 4 lands as a contract test, not a schema change. |

---

## 4. Validation Architecture

Applies — see `03-VALIDATION.md` (created). The Vitest suite is fast (~2.6s full, <1s
targeted), so per-task sampling with `npm run typecheck` + the task's targeted vitest file
is the feedback loop. The ROAD-02 desirability task performs one intentional golden
regeneration (`GOLDEN_UPDATE=1 npm run test:golden:update`) and then the full suite. All
phase behaviors are automatable: roadNet connectivity/dirty-region unit tests, road-type
speed/desirability wiring tests through stubbed `SimInternals`, walker category behavior
tests, profile-contract tests, and roadblock/graph-path tests.
