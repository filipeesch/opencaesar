---
phase: 03-road-graph-walker-categories
verified: 2026-08-03T12:17:00Z
status: passed
score: 13/13 must-haves verified
behavior_unverified: 0
---

# Phase 3: Road Graph & Walker Categories Verification Report

**Phase Goal:** Turn the road network into a graph with localized (dirty-flag) recomputation, give roads distinct types with movement + desirability effects, and categorize walkers as wandering / destination / recruiter with real per-type data, enforced roadblock permissions, and graph-path-only travel.

**Verified:** 2026-08-03T12:17:00Z
**Status:** passed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Adding a road tile with no road neighbors still assigns it a component so connected(tile, tile) is true and connectivity reflects the change (ROAD-01). | ✓ VERIFIED | `tests/unit/roadnet.test.ts#an isolated addRoad assigns a component (ROAD-01)` — `addRoad(0,0)` on empty map → `nodeCount()===1`, `connected(0,0, 0,0)===true` |
| 2 | affectedTiles() reports the recomputed (dirty) region touched by an add/remove, not only the single changed tile (ROAD-01). | ✓ VERIFIED | `src/sim/roadNet.ts` `recolorRegion` returns re-flooded set; tests `merging two components widens...` (>=2 tiles) and `a cut widens...` (old component tiles, not the removed tile) |
| 3 | Adding/demolishing a road recomputes only the affected region; connectivity reflects the change (ROAD-01). | ✓ VERIFIED | Bridge/cut tests in `tests/unit/roadnet.test.ts` (connected flips true/false on add/remove); third-region isolation test proves dirty region stays local |
| 4 | Two independent road components bridged by one tile then cut stay internally connected while the cross link breaks; a third far region is unaffected (ROAD-01 multi-region). | ✓ VERIFIED | `describe('RoadNetwork multi-region disconnect/reconnect (ROAD-01)')` — bridged→cut→re-bridged over articulation (3,3); both halves internally connected after cut; third region (7,0) never merged, never dirtied |
| 5 | ROAD_TYPES covers the seven required road types (dirt, paved, plaza, bridge, service roadblock, wharf access, stairs) with distinct movement and desirability (ROAD-02). | ✓ VERIFIED | `tests/unit/road-types.test.ts` (existing, unchanged, green) pins the 7-type key set + speed/desirability/passable helpers |
| 6 | Road types affect walker speed: per-tick road progress on a typed road tile scales by roadSpeedMultiplier(effectiveType), paved faster than dirt (ROAD-02). | ✓ VERIFIED | `src/sim/walkers.ts:301-302` `w.progress += profile.movementSpeed * speed`; `tests/unit/road-type-effects.test.ts` — paved 0.625 vs dirt 0.5 (strictly greater); `walker-category-behavior.test.ts` speed pipeline |
| 7 | Road types affect desirability: house adjacent to a road tile gains that type's desirability (plaza > dirt) in desirabilityOf (ROAD-02). | ✓ VERIFIED | `src/sim/housing.ts:56` adjacency loop; `road-type-effects.test.ts` — plaza +4, service_roadblock +0, bare road +0, non-orthogonal no effect |
| 8 | The public per-tile snapshot exposes each road tile's effective roadType via SimRunner.getTileState (ROAD-02). | ✓ VERIFIED | `src/sim/runner.ts:497` `roadType: this.map.roadTypeAt(x,y)`; `road-type-wiring.test.ts#SimRunner.getTileState exposes...` |
| 9 | WalkerProfile schema covers all nine ROAD-03 per-type fields for every catalog walker (ROAD-03). | ✓ VERIFIED | `tests/unit/walker-profile-contract.test.ts` — all 9 fields own-defined, typed/finite/in-range, profile count == WALKERS count, category coverage, recruiter spawnInterval 60 |
| 10 | Wandering walkers with returnPolicy true turn back at maxRoadSteps and never stray farther from their origin than maxRoadSteps tiles (ROAD-03). | ✓ VERIFIED | `src/sim/walkers.ts` return-at-maxRoadSteps (origin/stepsTaken); `walker-category-behavior.test.ts` loop-map (distance ≤ 8, min 0) and 1D-corridor (maxY ≤ 8, returns to origin) |
| 11 | Destination walkers travel by graph path only: a Manhattan-near but road-unreachable target is never served (no Euclidean fallback) (ROAD-03). | ✓ VERIFIED | `walker-roadblock-permissions.test.ts#a Manhattan-near but road-unreachable granary is never served` — `findRoadPath` returns null, path stays empty, stock unchanged |
| 12 | One walker of each category is profiled; per-type assets (movementSpeed, serviceTTL) consumed by behavior (ROAD-03). | ✓ VERIFIED | Contract test asserts all three categories profiled; `walker-category-behavior.test.ts` proves `profile.movementSpeed` and `profile.serviceTTL` drive progress/cooldowns |
| 13 | Per-category roadblock permissions configurable and enforced: 'stop' walker never enters service_roadblock; 'pass' walker traverses it (ROAD-03). | ✓ VERIFIED | `ROADBLOCK_POLICY_BY_CATEGORY` + `mayTraverse` (walkerProfiles.ts:78-93); `walker-roadblock-permissions.test.ts` — config defaults, path-bypass, market reaches granary through roadblock (stock 10→5), well never occupies roadblock |

**Score:** 13/13 truths verified (0 present-but-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/sim/roadNet.ts` | Isolated-add component fix; region-returning recolor | ✓ EXISTS + SUBSTANTIVE | `addRoad` seeds empty-neighbor case with the new tile; `recolorRegion` returns `Vec2[]`; `floodComponent` returns colored keys |
| `src/sim/tile.ts` | `roadType: RoadType \| null` (default null) | ✓ EXISTS + SUBSTANTIVE | Field on `TileState`, `null` in `defaultTileState()` |
| `src/sim/map.ts` | `roadTypeAt`/`setRoadType` | ✓ EXISTS + SUBSTANTIVE | Out-of-bounds safe; no terrain mutation |
| `src/sim/runner.ts` | `getTileState().roadType` | ✓ EXISTS + SUBSTANTIVE | Wired from `map.roadTypeAt` (line 497) |
| `src/sim/walkers.ts` | Profile wiring, return-at-maxRoadSteps, per-walker traversability | ✓ EXISTS + SUBSTANTIVE | `origin`/`stepsTaken`; `walkerProfile` threaded; `traversableFor` predicate |
| `src/sim/housing.ts` | Adjacent-road desirability | ✓ EXISTS + SUBSTANTIVE | 4-neighbor loop via `roadDesirability` |
| `src/sim/walkerProfiles.ts` | `ROADBLOCK_POLICY_BY_CATEGORY`, `mayTraverse`, per-category policy | ✓ EXISTS + SUBSTANTIVE | Lines 78-93; CONFIG-derived defaults |
| `src/sim/pathfind.ts` | Optional `isTraversable` predicate | ✓ EXISTS + SUBSTANTIVE | Default equals prior terrain-only check |
| 6 new test files | Wiring/effect/contract/behavior/roadblock tests | ✓ EXISTS + SUBSTANTIVE | 5+2+3+4+5+10 = 29 new tests across the phase (roadnet incl. plan 03-01) |

**Artifacts:** 8/8 source artifacts + 6 test files verified

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| walkers.move | roadTypes.roadSpeedMultiplier | `import` + call in `move()` | ✓ WIRED | walkers.ts:16 (import), 302 (call `roadSpeedMultiplier(rt)`) |
| walkers.move | map.roadTypeAt | per-tick read | ✓ WIRED | walkers.ts:301 `sim.map.roadTypeAt(w.x, w.y)` |
| housing.desirabilityOf | roadTypes.roadDesirability | adjacency loop | ✓ WIRED | housing.ts:9 (import), 56 (call) |
| runner.getTileState | map.roadTypeAt | snapshot field | ✓ WIRED | runner.ts:497 |
| walkers.startSeeking | pathfind.findRoadPath | isTraversable arg | ✓ WIRED | walkers.ts:204 `findRoadPath(map, from, to, traversableFor(sim, profile))` |
| walkers wandering/move | walkerProfiles.mayTraverse | predicate | ✓ WIRED | walkers.ts:261,281,302; walkerProfiles.ts:90 |
| walkers.updateWalker | walkerProfiles.walkerProfile | profile resolved per tick | ✓ WIRED | walkers.ts:19 (import); updateWalker |
| walkerProfiles defaults | config (CONFIG.walkerSpeedPerTick/serviceCooldownTicks) | CONFIG consumers | ✓ WIRED | walkerProfiles.ts:60,62 — preserves DATA-02 balance-parity invariant |

**Wiring:** 8/8 connections verified

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| ROAD-01: Road network is a graph with localized dirty-flag recomputation on road/bridge/roadblock/entrance changes | ✓ SATISFIED | - |
| ROAD-02: Road types (dirt, paved, plaza, bridge, service roadblock, wharf access, stairs) have distinct movement and desirability | ✓ SATISFIED | - |
| ROAD-03: Walkers categorized wandering/destination/recruiter with per-type data | ✓ SATISFIED | - |

**Coverage:** 3/3 requirements satisfied

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|----------------|---------|
| tests/unit/roadnet.test.ts | ROAD-01 | 10 | 0 | No | Behavioral (multi-step bridge/cut cycle) | PASS |
| tests/unit/road-type-wiring.test.ts | ROAD-02 | 5 | 0 | No | Value (round-trip, snapshot) | PASS |
| tests/unit/road-type-effects.test.ts | ROAD-02 | 2 | 0 | No | Value (exact deltas) | PASS |
| tests/unit/walker-profile-contract.test.ts | ROAD-03 | 3 | 0 | No | Value/structural (schema + ranges) | PASS |
| tests/unit/walker-category-behavior.test.ts | ROAD-03 | 4 | 0 | No | Behavioral (speed pipeline, return) | PASS |
| tests/unit/walker-roadblock-permissions.test.ts | ROAD-03 | 5 | 0 | No | Behavioral (config, bypass, stop/pass, no-fallback) | PASS |

**Disabled tests on requirements:** 0
**Circular patterns detected:** 0 (golden.test.ts writes fixtures only under the intentional `GOLDEN_UPDATE` regeneration path; normal runs compare against recorded snapshots — established snapshot convention, not a new circular pattern)
**Insufficient assertions:** 0

### Decision Coverage

`gsd_tools check.decision-coverage-verify` → skipped ("no trackable decisions" — CONTEXT.md `<decisions>` headings are not parsed as trackable by this helper). Non-blocking; every CONTEXT decision (1–5) is reflected in the shipped artifacts/SUMMARYs and verified above.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| - | - | none | - | - |

**Anti-patterns:** 0 found

## Human Verification

N/A — Infrastructure/foundation phase with no user-facing elements. All acceptance criteria are verifiable programmatically; all 13 must-have truths are exercised by passing behavioral tests.

## Gaps Summary

**No gaps found.** Phase goal achieved. Ready to proceed.

Goldens: `tests/golden/fixtures/food-chain-golden.json` and `paused-commands-golden.json` were regenerated with `GOLDEN_UPDATE=1 npm run test:golden:update` in 03-02 (documented ROAD-02 desirability mechanic) and again in 03-03 (documented ROAD-03 wandering-trajectory mechanic). The 03-02 regeneration produced byte-identical content (all golden-city roads are untyped → dirt, desirability 0); the 03-03 regeneration changed only walker positions (52 + 26 line hunks, all walker `x`/`y`/`tick` fields). Both are intentional, documented mechanic changes, not test weakening.

## Verification Metadata

**Verification approach:** Goal-backward (derived from phase goal)
**Must-haves source:** PLAN.md frontmatter (03-01, 03-02, 03-03)
**Automated checks:** 313 passed, 0 failed (51 test files); `npm run typecheck` exit 0; `npm run lint` exit 0 (max-warnings 0)
**Human checks required:** 0
**Total verification time:** ~3 min

---
*Verified: 2026-08-03T12:17:00Z*
*Verifier: the agent (subagent)*
