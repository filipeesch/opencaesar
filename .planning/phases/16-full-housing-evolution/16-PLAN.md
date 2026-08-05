---
phase: 16-full-housing-evolution
plan: 16-plan
type: execute
wave: 0
depends_on: [15-PLAN]
files_modified:
  - src/sim/housingLive.ts
  - src/sim/housingMerge.ts
  - src/sim/housing.ts
  - src/sim/walkers.ts
  - src/sim/types.ts
  - src/sim/runner.ts
  - src/sim/economy.ts
  - src/sim/advisors.ts
  - data/housing.ts
  - data/validate.ts
  - tests/unit/housing-level-bridge.test.ts
  - tests/unit/housing-merge.test.ts
  - tests/unit/housing.test.ts
  - tests/unit/civic-services.test.ts
  - tests/unit/economy.test.ts
  - tests/unit/labor.test.ts
  - tests/unit/happiness.test.ts
  - tests/unit/advisors.test.ts
  - tests/integration/housing-evolution-live.test.ts
  - tests/integration/health-education-entertainment.test.ts
  - tests/integration/bankruptcy.test.ts
  - tests/integration/food-chain.test.ts
  - tests/determinism/housing-evolution-determinism.test.ts
  - tests/golden/fixtures/food-chain-golden.json
  - tests/golden/fixtures/paused-commands-golden.json
autonomous: true
requirements: [HOUS-01, HOUS-02]

estimate:
  tokens: 140000
  raw_tokens: 140000
  tasks: 7
  confidence: low

must_haves:
  truths:
    - "HOUS-01: every house's live progression state is `house.level` (0-20) driven exclusively by `decideEvolution` against `HOUSING_LEVELS` cumulative requirements — it evolves up only when ALL of the target level's requires+requiresGoods are satisfied (per-house, via deriveSatisfied) AND normalized desirability (levelDesirability, 0-200 -> 1-30) clears the padded threshold (level + 5, so level 20 needs 25 <= reachable 30) AND satisfiedTicks has reached minSatisfiedTicks (60); house.tier (0-4) is a derived bucket (tierOfLevel) so the RATE-01 rating denominator and patrician bar stay valid."
    - "HOUS-01: the 21-level economy is real — workerPool/tickEconomy/populationOf/advisor food-days/happiness-weighting read HOUSING_LIVE_STATS[level] (clamped `liveStats` accessor, never a bare index), population=capacity, tax/workers deterministic per level, so population/tax/workers/ratings scale across all 21 levels instead of saturating at Villa."
    - "HOUS-01/2: hysteresis is live — satisfiedTicks/unsatisfiedTicks accumulate from tick history only (deterministic, no wall-clock), a house devolves only after toleranceTicks (90) of lost requirements or desirability below the current level's tolerance, and any level change (evolve or devolve) zeroes both counters so a house cannot oscillate (grace period)."
    - "HOUS-02: compatible adjacent houses merge — two orthogonally-adjacent same-level mergeable houses whose contiguous block fits the target level's footprint (1x1:0-10, 2x2:11-14, 3x3:15-18, 4x4:19-20, from the new HOUSING_LEVELS.footprint field) merge on the month cadence (tickCount % 40 === 0) in fixed placement-order scan; the survivor keeps id/origin, gains the footprint, produces the combined population, occupiedTiles are re-keyed for the whole block, the evicted tiles are freed, and a house-merged message is emitted; merging never exceeds level 20."
    - "HOUS-02: merging and evolution are deterministic — a city that evolves AND merges yields byte-identical getStateJson() across chunked ticks (1/7/50) and a getSaveData()->fromSaveData() round-trip with counters and combined population included; no RNG/clock anywhere in housing.ts, housingLive.ts, housingMerge.ts, data/housing.ts."
    - "Golden compatibility: the food-chain city can no longer hold an Insula (it lacks fountain/pottery), so tests/golden fixtures are regenerated as an INTENTIONAL mechanic change (npm run test:golden:update) and thereafter the golden + full suite + check:military + balance-parity gates are green; no new BALANCE keys are added (housing tuning stays module-local HOUSING_*/LEVEL_*-prefixed)."
    - "Catalog integrity: every HOUSING_LEVELS entry carries a valid footprint (monotonic ladder) and requiresGoods stays within FOOD_TYPES ∪ houseGood — the known 'tools' (houseGood:false) mismatch is resolved (tools removed from levels 15-20 requiresGoods) and enforced at load time by validateCatalogs plus data-catalog tests."
  artifacts:
    - path: src/sim/housingLive.ts
      provides: "additive pure bridge: LiveHouseStats, HOUSING_LIVE_STATS (21 entries from HOUSING_LEVELS.map), levelDesirability(tile) clamp(0,30,round(x/6)) — full 21-level ladder satisfiable (level 20 needs 25 <= 30), tierOfLevel(level) buckets, liveStats(level) clamped accessor, deriveSatisfied(house, buildings), requirementsMet(level, satisfied)"
      min_lines: 90
    - path: src/sim/housingMerge.ts
      provides: "pure occupancy transform: targetFootprint(level), findMergePartner(a, buildings) fixed-DIRS same-level scan, blockFits(origin, n, isOccupied, exemptTiles), mergeProposal survivor/absorbed/footprint"
      min_lines: 60
    - path: src/sim/housing.ts
      provides: "tickHousing rewired to decideEvolution + DEFAULT_HYSTERESIS (counter accumulation, normalized desirability, derived house.tier, housingLevelName messages); legacy 5-tier decision block retired"
      min_lines: 40
    - path: src/sim/runner.ts
      provides: "house init level/satisfiedTicks/unsatisfiedTicks/mergeable; tickHousingMerge %40 step after tickHousing; toBuildingState level/levelName + HOUSING_LIVE_STATS populationCapacity; happiness weighting via liveStats; house-merged emit"
      min_lines: 60
    - path: src/sim/economy.ts
      provides: "workerPool/tickEconomy/populationOf read liveStats(level) (clamped); computeRatings tierSum keeps derived tier"
      min_lines: 10
    - path: src/sim/advisors.ts
      provides: "foodOverlayGrids population via liveStats(level) clamped accessor"
      min_lines: 4
    - path: src/sim/walkers.ts
      provides: "HouseInstance additive fields level?/satisfiedTicks?/unsatisfiedTicks?/mergeable? + combinedPopulation? (internal, never serialized)"
      min_lines: 5
    - path: src/sim/types.ts
      provides: "MessageType += 'house-merged'; BuildingState.house += level/levelName"
      min_lines: 2
    - path: data/housing.ts
      provides: "HousingLevelDef += footprint (1:0-10, 2:11-14, 3:15-18, 4:19-20); 'tools' removed from levels 15-20 requiresGoods"
      min_lines: 4
    - path: data/validate.ts
      provides: "housing block += footprint positive/monotonic + requiresGoods subset FOOD_TYPES ∪ houseGood gate"
      min_lines: 8
    - path: tests/unit/housing-level-bridge.test.ts
      provides: "levelDesirability boundaries 0/30/75/101/200 (0/5/13/17/30), tierOfLevel buckets, HOUSING_LIVE_STATS length 21 + monotonic, liveStats clamp"
      min_lines: 60
    - path: tests/unit/housing-merge.test.ts
      provides: "targetFootprint ladder 0-20, blockFits true/false over a tileKey occupancy map, fixed-scan same-level partner determinism"
      min_lines: 60
    - path: tests/integration/housing-evolution-live.test.ts
      provides: "live city (all services + goods access) progresses 0->high level after minSatisfiedTicks; devolution after toleranceTicks on a removed requirement; merge scenario (footprint growth, combined population, house-merged message, occupiedTiles re-key)"
      min_lines: 120
    - path: tests/determinism/housing-evolution-determinism.test.ts
      provides: "chunked run (1/7/50) + save->load byte-identity on a city that evolves AND merges (counters + combined population included); no-RNG/clock source audit over housing.ts/housingLive.ts/housingMerge.ts/data/housing.ts"
      min_lines: 60
  key_links:
    - "tickHousing (housing.ts) -> decideEvolution (housingEvolution.ts): the per-tick satisfiedTicks/unsatisfiedTicks accumulation and normalized levelDesirability feed are the single most likely place to break HOUS-01 criterion 1 — if the raw 0-200 scale leaks in instead of levelDesirability, the desirability gate goes vacuous (Pitfall 2); if counters are not zeroed on level change, houses oscillate (success criterion 2)."
    - "economy.ts/runner.ts/advisors.ts -> housingLive.ts liveStats: every HOUSING_LIVE_STATS[level] read must go through the clamped accessor (never a bare index) or a level >= array length yields undefined and population/tax/workers silently become NaN (Pitfall 3); house.tier must stay a derived 0-4 bucket so computeRatings/avgHousingLevel/patricianShare keep their HOUSE_TIERS.length denominator."
    - "runner.tick() -> tickHousingMerge(): the merge step must run on the month cadence with a fixed placement-order scan and re-key occupiedTiles to the survivor id, or fromSaveData replay diverges (Pitfall 6) — no new SaveCommand; the absorbed id must not be left referenced by walkers' targetBuildingId."
    - "data/housing.ts footprint/requiresGoods -> data/validate.ts: the catalog-consistency gate (requiresGoods subset FOOD_TYPES ∪ houseGood) forces the tools resolution and catches any future key drift (V5); footprint ladder must stay monotonic 1..4."
    - "toBuildingState/getStateJson -> tests/golden: switching tierName/populationCapacity/desirability to level-derived values shifts the golden snapshots — regenerate via npm run test:golden:update as an intentional mechanic change, never hand-edit, and never let a level value leak into the legacy 5-tier message texts without a matching regeneration."
---

<objective>
Deliver Phase 16 — wire the already-scaffolded 21-level housing catalog (`data/housing.ts` `HOUSING_LEVELS`, 0–20) and the pure hysteresis evolution engine (`src/sim/housingEvolution.ts` `decideEvolution` + `DEFAULT_HYSTERESIS`) into the live deterministic sim as the single source of truth for a house's progression, then add tolerance-based devolution with an anti-oscillation grace period and deterministic adjacent-house merging into larger lots.

Purpose: this is a **wiring + one net-new transform** phase over existing tested primitives. `HOUSING_LEVELS` (21 entries) and `decideEvolution` exist and are used ONLY by tests today; the live `tickHousing` still runs the legacy 5-tier `HOUSE_TIERS` engine, and 8+ live call sites read `house.tier` unguarded. The difficulty is the **bridge** between the two data models (five scale/key mismatches: desirability 1–20 vs 0–200, building-type vs wellness service keys, non-food `requiresGoods` with no per-house delivery path, missing workers + tax-per-tick unit, missing footprint for merging) plus the new deterministic merge. `house.tier` stays a derived 0–4 bucket so the normalized rating factors and patrician share keep their math.
Output: new `housingLive.ts` + `housingMerge.ts`, rewired `housing.ts`/`runner.ts`/`economy.ts`/`advisors.ts`/`walkers.ts`/`types.ts`, catalog + validate extension (`footprint`, tools resolution), 4 new test files, updated timing/tier asserts, and **intentionally regenerated** golden fixtures.
</objective>

<execution_context>
@/Users/filipe.esch/projects/pessoal/opencaesar/.opencode/gsd-core/workflows/execute-plan.md
@/Users/filipe.esch/projects/pessoal/opencaesar/.opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/16-full-housing-evolution/16-CONTEXT.md
@.planning/phases/16-full-housing-evolution/16-RESEARCH.md
@.planning/phases/16-full-housing-evolution/16-PATTERNS.md
@.planning/phases/16-full-housing-evolution/16-VALIDATION.md

# Sim-core seams (read before Wave 1-2 implementation):
@src/sim/housing.ts
@src/sim/housingEvolution.ts
@src/sim/housingLive.ts (created Wave 1)
@src/sim/housingMerge.ts (created Wave 2)
@src/sim/economy.ts
@src/sim/advisors.ts
@src/sim/runner.ts
@src/sim/walkers.ts
@src/sim/types.ts
@data/housing.ts
@data/validate.ts
@data/balance.ts
@src/sim/config.ts
</context>

# Execution order (waves are sequential; tasks within a wave run in listed order — shared files force sequential edits):

- **Wave 0** — validation test scaffolds: 4 new test files (unit bridge, unit merge, live integration, determinism). RED until their implementing waves; typecheck-clean (they target the Phase-16 APIs, which do not exist yet — write against the target surface, not today's surface).
- **Wave 1 (HOUS-01)** — bridge + level wiring. 16-01-01 (tracer) first: creates `housingLive.ts`, adds the house state fields, rewires `tickHousing` to `decideEvolution` (this is where the satisfied/unsatisfied counter accumulation and both evolve/devolve paths land, since `decideEvolution` requires the counters on input), sets derived `house.tier`, and surfaces `level`/`levelName` in `toBuildingState`. 16-01-02 then routes the scalar consumers (economy/advisor/happiness) through `HOUSING_LIVE_STATS` and updates the kitty tests that the switch breaks — it must run in the same wave and sequentially after the tracer.
- **Wave 2 (HOUS-02)** — deterministic merge. 16-02-01 adds the pure `housingMerge.ts` transform + the catalog `footprint` field (the merge ladder) and flips the merge unit test; 16-02-02 wires the runner `%40` merge step (occupancy re-key, combined population, evicted tiles freed, `house-merged` message, walker-target safety), flips the integration devolution + merge scenarios and the determinism file.
- **Wave 3** — golden regeneration + test updates, last. 16-03-01 regenerates both golden fixtures (intentional mechanic change). 16-03-02 updates the timing/tier asserts across the threatened unit/integration files, adds the `requiresGoods ⊆ FOOD_TYPES ∪ houseGood` validate gate and resolves the `tools` mismatch, and closes with the full suite green.

# Locked decisions honored (16-CONTEXT.md §HOUS-01 / §HOUS-02 / §House Merging):
- `HOUSING_LEVELS` + `decideEvolution` + `DEFAULT_HYSTERESIS` are the single source of truth; a house updates its level through `decideEvolution`, never the 5-tier shortcut; satisfied inputs come from live house state (service TTLs, food/water/labor cooldowns, godAccess, foodInventory, desirability).
- Hysteresis: devolve after `toleranceTicks` of lost requirements or desirability-below-tolerance; grace prevents oscillation (level change resets the opposite counter); counters are deterministic from tick history, replay byte-identical.
- Merging: same-level orthogonal adjacent mergeable houses whose block fits the target-level footprint, merged only up to level 20, one surviving instance bears the target-level cumulative requirements, combined population, evicted tiles freed, fixed scan order, NO new SaveCommand (replay re-derives merges).
- Deferred ideas: none — discussion stayed in scope.

# Multi-source coverage audit (all COVERED):
- GOAL: 21-level progression + hysteresis + merging → Wave 1 (levels/progression), Wave 2 (hysteresis devolution verification + merge), Wave 3 (goldens/tests).
- REQ HOUS-01 (21-level cumulative progression): Waves 0-1 + 16-03-02 tests.
- REQ HOUS-02 (hysteresis + merging): Wave 2 + devolution timing in 16-03-02.
- RESEARCH: bridge keys/scale normalization (16-01-01), HOUSING_LIVE_STATS economy bridge (16-01-02), deterministic merge helpers + runner step (16-02-01/02), footprint ladder + tools resolution + validate gate (16-02-01 / 16-03-02), golden regen as intentional mechanic change (16-03-01), no-RNG determinism (16-02-02), module-local tuning constants / balance-parity avoidance (all).
- CONTEXT §HOUS-01/§HOUS-02/§House Merging: all items covered as above; discretion areas (level→tier buckets, satisfied-assembly precedence, merge trigger precision, counter calibration) are resolved concretely in the task actions below.

<tasks>

<!-- ===================== WAVE 0 — validation test scaffolds ===================== -->

<task type="auto">
  <name>Task 16-00-01: Wave 0 — create validation test scaffolds (bridge, merge, live integration, determinism)</name>
  <files>tests/unit/housing-level-bridge.test.ts, tests/unit/housing-merge.test.ts, tests/integration/housing-evolution-live.test.ts, tests/determinism/housing-evolution-determinism.test.ts</files>
  <read_first>
    - tests/unit/housing-evolution.test.ts (pure-function unit style, CFG = DEFAULT_HYSTERESIS, boundary cases)
    - tests/unit/housing.test.ts:13-37 (mkHouse factory) and :139-152 (devolve-window timing block — the old 240-tick expectation this phase replaces)
    - tests/integration/health-education-entertainment.test.ts:12-38 (custom map builder) and :82-84 (maxTier runner-inspection helper)
    - tests/determinism/governance-determinism.test.ts:48-72 (chunked-run helper), :137-140 (save->load round-trip), :149-157 (no Math.random/Date source audit)
    - src/sim/housingEvolution.ts (EvolutionInput, decideEvolution, DEFAULT_HYSTERESIS)
    - src/sim/runner.ts:2686-2689 (tileKey = (x<<20)|y) and :1489-1493 (house init)
  </read_first>
  <action>
    Create the four missing test files as RED scaffolds pinned to the Phase-16 target APIs (they fail typecheck/tests until Waves 1-2 implement them — expected, and how the Nyquist gate tracks them). Do NOT write them against the current 5-tier surface; write against the target surface so the implementing tasks flip them green.

    1. tests/unit/housing-level-bridge.test.ts (REQ HOUS-01). Vitest (import from 'vitest').     Import the Phase-16 target exports from '../../src/sim/housingLive': `levelDesirability`, `tierOfLevel`, `HOUSING_LIVE_STATS`, `liveStats`. Assert: HOUSING_LIVE_STATS.length === 21; population is monotonic non-decreasing and equals HOUSING_LEVELS[i].capacity; workers/taxPerTick are finite, non-negative, monotonic non-decreasing; `levelDesirability` boundaries (0→0, 200→30, 30→5, 75→13, 101→17, negatives→0) AND the full-ladder reachability claim `levelDesirability(200) >= 25` (so a maximally-desirable city can satisfy the level-20 padded requirement 25); `tierOfLevel` returns 0..4 (e.g. levels 0 and 4 → 0, levels 8 and 11 → 2, level 20 → 4) and is monotonic non-decreasing; `liveStats` clamps out-of-range levels (liveStats(99) === liveStats(20), liveStats(-1) === liveStats(0)) and never returns undefined.
    2. tests/unit/housing-merge.test.ts (REQ HOUS-02). Import Phase-16 target exports from '../../src/sim/housingMerge': `targetFootprint`, `findMergePartner`, `blockFits`. Build two adjacent 1x1 `mkHouse` fixtures with `level` set and an occupancy `Map<number, number>` using the `(x << 20) | y` tileKey (runner.ts:2686). Assert: `targetFootprint(5) === 1`, `targetFootprint(11) === 2`, `targetFootprint(15) === 3`, `targetFootprint(19) === 4`, `targetFootprint(20) === 4`; `blockFits` returns true for an empty target square and false when a third building occupies a tile inside the union; `findMergePartner` returns the mapper-deterministic same-level orthogonal partner in fixed scan order and null when none (same-level requirement enforced). Assert scan-order determinism: identical input array order yields an identical merge result.
    3. tests/integration/housing-evolution-live.test.ts (REQ HOUS-01 + HOUS-02). Copy the live-city builder pattern from health-education-entertainment.test.ts:12-38 (SimMap.fromLayout + road grid + place buildings with throw-on-error + requestRoyalSubsidy to fund). Define three clearly-named describes so early waves can target them individually with `vitest -t`:
       - describe 'progression': a city providing ALL cumulative services (well, market, fountain, school, clinic, library, theatre, hospital, temple, amphitheatre, forum, garden, senate, grand_temple) AND all goods access (warehouses/granaries stocked with wheat, pottery, vegetables, fruit, fish, meat, furniture, wine, oil, tools) asserts `maxLevel(r)` (a helper reading `b.house!.level`) reaches a high level (>= 11) after enough ticks (> minSatisfiedTicks + walker latency), and that `house-evolved` messages reference the level names. PLUS a reachability assertion: a maximally-desirable house (desirability ~200, i.e. fertile + full services) subject to every cumulative requirement, sustained past the min period, reaches a level whose padded desirability is normally impossible under a cap-20 normalizer — assert `levelDesirability(raw=200) >= 25` and that the ladder is reachable to at least level 16 (the highest level whose padded requirement 21 fits under the 30 cap with margin; the full level-20 path is additionally covered by the merge 4×4 scenario which requires levels 19-20).
       - describe 'devolve': after a house reaches a level, removing a required SERVICE or collapsing desirability (e.g. demolish the city's only fountain so 'fountain' service access lapses, or drive desirability below the current level's tolerance) and continuing > toleranceTicks causes `house-devolved`; assert the house does not oscillate right at the boundary (grace period). NOTE: do NOT try to devolve by removing a GOOD — foodInventory never decays (consumeHouseFood/tickHouseFoodMemory are unwired in the runner) and cityGoodsAccess is a city-stock sum, so goods-derived satisfied is sticky this phase; devolution must invert a service or desirability key (removing the only well/forcing a policy collapse), never a goods key.
       - describe 'merge': two adjacent same-level 1x1 houses at a footprint-gated level merge — assert survivor `footprint` grows, `occupiedTiles` re-keyed (buildingAt resolves the survivor on both tiles), combined population doubles, a `house-merged` message is emitted, and the absorbed instance is gone from the buildings list. Include a 2×2→4×4 drill (levels 11-14) AND a 4×4 (levels 19-20, the largest footprint) merge path so the top of the ladder and the biggest merge are exercised live, not only the 2×2.
       Include the `maxLevel`/`houses(r)` inspection helpers (mirror maxTier at :82-84).
    4. tests/determinism/housing-evolution-determinism.test.ts (REQ HOUS-02). Copy the chunked-run helper from governance-determinism.test.ts:48-72. Build a city that evolves several levels AND triggers a merge (e.g. two adjacent houses reaching a footprint-gated level). Assert byte-identical `getStateJson()` across chunks 1/7/50 for seeds [1, 7, 1337], and `SimRunner.fromSaveData(r.getSaveData()).getStateJson() === r.getStateJson()` (counters `satisfiedTicks`/`unsatisfiedTicks` and the merged combined population included in the byte identity). Include the no `Math.random`/`Date.now`/`new Date` file-scope source audit (governance-determinism.test.ts:149-157) pinned to the fixed list `src/sim/housing.ts, src/sim/housingLive.ts, src/sim/housingMerge.ts, data/housing.ts`.

    These scaffolds intentionally reference APIs delivered later (housingLive.ts, housingMerge.ts, house.level, combined population). They are expected RED until their implementing tasks.
  </action>
  <verify>
    <human-check>Wave 0 is complete when all four files exist and target the Phase-16 APIs; they are expected RED until the implementing tasks flip them green.</human-check>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && test -f tests/unit/housing-level-bridge.test.ts && test -f tests/unit/housing-merge.test.ts && test -f tests/integration/housing-evolution-live.test.ts && test -f tests/determinism/housing-evolution-determinism.test.ts</automated>
  </verify>
  <acceptance_criteria>The four files exist, target the Phase-16 target APIs, and are discovered by the vitest include glob (tests/**/*.test.ts).</acceptance_criteria>
  <done>Four new test files exist targeting the Phase-16 APIs (RED until their implementing waves) and are picked up by the vitest config.</done>
</task>

<!-- ===================== WAVE 1 (HOUS-01) — bridge + level wiring ===================== -->

<task type="tracer">
  <name>Task 16-01-01: Tracer — end-to-end 21-level level-driven progression (one path)</name>
  <files>src/sim/housingLive.ts, src/sim/housing.ts, src/sim/walkers.ts, src/sim/types.ts, src/sim/runner.ts, tests/unit/housing-level-bridge.test.ts, tests/integration/housing-evolution-live.test.ts</files>
  <read_first>
    - src/sim/economy.ts:1-9 (module header + import shape for the pure-bridge file to copy) and src/sim/housingEvolution.ts:11 (the cross-dir `../../data/housing` import used by the pure engine)
    - src/sim/housing.ts:75-118 (desirabilityOf 0-200 + tierThreshold — the normalizer's source of truth), :132-206 (tickHousing per-house loop to rewire), :22-26 (civicGateSatisfied + TIER_CIVIC_GATES to retire)
    - src/sim/housingEvolution.ts:50-81 (requirementsSatisfied + decideEvolution semantics)
    - src/sim/walkers.ts:88-109 (HouseInstance additive-optional field convention), :121-130 (SERVICE_BY_WALKER), :306-370 (service application: godAccess, cooldowns, seller delivery)
    - src/sim/runner.ts:1489-1493 (house init), :2632-2668 (toBuildingState house builder)
    - src/sim/types.ts:120-137 (BuildingState.house), :60 (MessageType)
    - data/housing.ts:22-54 (HOUSING_LEVELS + housingLevelName/housingCapacity)
  </read_first>
  <behavior>
    - Test 1: levelDesirability(75) === 13, levelDesirability(200) === 30, levelDesirability(0) === 0, and levelDesirability(200) >= 25 (reachability of the level-20 padded requirement) (housing-level-bridge.test.ts).
    - Test 2 (e2e path): in a fully-served live city, a placed house reaches a high level via decideEvolution (house.level advances), while a control house missing goods stays at the food+water+services floor; house.tier mirrors the derived bucket (housing-evolution-live.test.ts 'progression' describe).
    - Test 3: after an evolve action the house did not jump more than one level per eligibility period (minSatisfiedTicks respected).
  </behavior>
  <action>
    Wire ONE end-to-end 21-level progression path (tracer slice) per decision §HOUS-01 — proven for a single house before the horizontal consumer expansion in 16-01-02:

    1. Create src/sim/housingLive.ts (additive pure bridge, role-analog of economy.ts "pure functions over building state"). Single-source-of-truth: import `HOUSING_LEVELS` from '../../data/housing' (cross-dir import as housingEvolution.ts:11), `CONFIG` from './config', `FoodTypes/isFood/isHouseGood` from '../../data/commodities', type imports from './walkers'/'./types'. Export:
       - `interface LiveHouseStats { population: number; workers: number; taxPerTick: number; }`
       - `const HOUSING_LIVE_STATS: readonly LiveHouseStats[] = HOUSING_LEVELS.map(...)` — `population = l.capacity`; workers and taxPerTick derived via module-local helpers (initially legitimate placeholders the executor calibrates: e.g. workers = max(1, round(capacity / 5)) matching the existing HOUSE_TIERS ~5:1 ratio, taxPerTick = max(1, round(capacity * taxPerCapita / 20)) — keep them monotonic non-decreasing and finite). Name the helpers/constants with a HOUSING_/LEVEL_ prefix so they never collide with BALANCE keys (tests/balance-parity.test.ts:36-68); do NOT add keys to data/balance.ts.
       - `levelDesirability(tileDesirability: number): number` — `clamp(0, 30, Math.round(tileDesirability / 6))` (RESEARCH Pitfall 2 + Open Q1 — the mandatory normalizer; raw 0-200 would make the desirability gate vacuous; cap 30 (NOT 20) so the full 21-level ladder is satisfiable — decideEvolution requires `desirability >= nextDef.desirability + evolveDesirabilityPadding (5)`, i.e. level 20 needs 25, which the old cap-20 normalizer could never produce; a maximally-desirable tile (raw 200) normalizes to 30 and clears every level's padded threshold).
       - `tierOfLevel(level: number): number` — bucket 0-4, recommended `Math.min(4, Math.floor(level / 4))` (levels 0-3→0, 4-7→1, 8-11→2, 12-15→3, 16-20→4; monotonic non-decreasing; keeps the HOUSE_TIERS.length-1 denominator at runner.ts:919 and the tier>=3 patrician bar at :927 valid).
       - `liveStats(level): LiveHouseStats` — the ONLY way consumers read the table: clamp the input (level ?? 0, min 0, max 20) so an out-of-range/undefined level can never return undefined (Pitfall 3 — economy.ts has no clamp today).
       - `requirementsMet(level: number, satisfied: string[]): boolean` — every require+requiresGoods key of HOUSING_LEVELS[level] is present in satisfied (mirror housingEvolution.requirementsSatisfied without touching housingEvolution.ts).
       - `deriveSatisfied(house, buildings): string[]` — the per-house key vocabulary (RESEARCH Pattern 2 key map). Populate ONLY the union of requires+requiresGoods keys that this house currently has: 'well'/'fountain' → waterCooldown > 0; 'market' → foodCooldown > 0 (and/or marketCoverage.lastFoodDelivery fresh); 'school'/'clinic'/'library'/'theatre'/'hospital'/'amphitheatre'/'colosseum' → the mapped wellness service fresh (SERVICE_BY_WALKER) AND at least one city building of that type present; 'temple'/'grand_temple' → any godAccess TTL active (multi-god counts deferred — RESEARCH Open Q4); 'forum'/'garden'/'senate' → a city building of that type present (deterministic city-presence fallback, RESEARCH A3); goods → isFood(g) ? (house.foodInventory?.[g] ?? 0) > 0 : cityGoodsAccess(g). Add the private helper `cityGoodsAccess(g, buildings): boolean` — deterministic city-stock proxy (sum of stock[g] across storage buildings > 0 or an enabled import route provides g) so the non-food ladder is reachable this phase (RESEARCH A4; real home delivery arrives with the distribution phases).
    2. src/sim/walkers.ts HouseInstance (:88-109): add the additive optional fields `level?: number; satisfiedTicks?: number; unsatisfiedTicks?: number; mergeable?: boolean; combinedPopulation?: number;` — internal-only, never serialized (same comment discipline as services/godAccess). Optional keeps every existing construction compiling (16-03-02 enriches them with explicit levels).
    3. src/sim/runner.ts house init (:1490): set `level: 0, satisfiedTicks: 0, unsatisfiedTicks: 0, mergeable: true` alongside the existing fields.
    4. src/sim/housing.ts tickHousing (:132-206): replace the legacy 5-tier decision blocks with the decideEvolution drive (do NOT edit housingEvolution.ts):
       - Per house: decay foodCooldown/waterCooldown/laborCooldown and tickCivic (unchanged).
       - Compute raw = desirabilityOf(map, b.x, b.y, policy, wagesUnpaid, {food, water, labor}, arrearsDepth); normalized = levelDesirability(raw).
       - satisfied = deriveSatisfied(house, buildings) (pass the buildings the runner already supplies).
       - Counter accumulation (deterministic, before decideEvolution): next = level+1; `baseOk = hasFood && hasWater && hasLabor` (the live labor-walker precondition the catalog cannot express) && requirementsMet(next, satisfied) && normalized >= (nextDef?.desirability ?? 0). If baseOk → satisfiedTicks++ and unsatisfiedTicks = 0; else → satisfiedTicks = 0 and unsatisfiedTicks++.
       - action = decideEvolution({ currentLevel: level, satisfied, desirability: normalized, satisfiedTicks, unsatisfiedTicks }, DEFAULT_HYSTERESIS). Apply: 'evolve' → house.level += 1, reset BOTH counters to 0, evolved += 1, emit `house-evolved`, text `House evolved to ${housingLevelName(house.level)}`; 'devolve' → house.level -= 1, reset BOTH counters to 0, devolved += 1, emit `house-devolved`, text `House devolved to ${housingLevelName(house.level)}`. Zeroing both counters on either action is the CONTEXT grace-period rule (no oscillation).
       - After the decision: house.tier = tierOfLevel(house.level) — derived, never the decision source.
       - Retire the now-dead legacy 5-tier decision code (tierThreshold compare, evolveCounter/devolveCounter increments, civicGateSatisfied + its TIER_CIVIC_GATES import) — the module-local helper civicGateSatisfied must be removed once its only call site is gone (unused-local lint). Keep the `evolveCounter`/`devolveCounter` fields additive on HouseInstance for one wave (16-03-02 may drop them); they no longer drive anything.
    5. src/sim/types.ts BuildingState.house (:120-137): add `level: number; levelName: string;` (serialized → goldens).
    6. src/sim/runner.ts toBuildingState (:2632-2668): populate `level` and `levelName` (housingLevelName(b.house!.level)); switch `populationCapacity` to `liveStats(b.house!.level).population`; keep `tier`/`tierName` (derived). This is the golden-pinned serialized surface — its values WILL shift (Pitfall 1, intentional).
    7. Test wiring: flip tests/unit/housing-level-bridge.test.ts green; make the 'progression' describe of tests/integration/housing-evolution-live.test.ts pass (run it alone via -t 'progression'). Leave the 'devolve'/'merge' describes RED until Wave 2 (they need tolerance-removal and the merge step).
    Discretion resolved here (per CONTEXT §the agent's Discretion): tierOfLevel buckets and workers/taxPerTick derivation are defined as above; satisfied assembly precedence is "only requirement-relevant keys, with food+water+labor as a base precondition on the counter"; the desirability padding stays DEFAULT_HYSTERESIS (evolveDesirabilityPadding 5 / devolveDesirabilityTolerance 5).
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/unit/housing-level-bridge.test.ts tests/integration/housing-evolution-live.test.ts -t 'progression' -x</automated>
  </verify>
  <acceptance_criteria>house.level (0-20) is the live source of truth driven by decideEvolution (evolve only when all cumulative requires+requiresGoods satisfied + normalized desirability >= padded threshold + satisfiedTicks >= minSatisfiedTicks); house.tier is the derived tierOfLevel bucket; levelDesirability/HOUSING_LIVE_STATS/deriveSatisfied are exported by housingLive.ts; toBuildingState surfaces level/levelName; the bridge unit test and integration 'progression' scenario pass; goldens are now intentionally shifting (RED) and stay RED until Wave 3 regeneration.</acceptance_criteria>
  <done>The 21-level progression path is wired end-to-end (tickHousing → deriveSatisfied → decideEvolution → house.level → toBuildingState) with the bridge table exported, derived tier kept for ratings, bridge unit + progression integration green, and the golden mechanic-shift acknowledged as intentional.</done>
</task>

<task type="auto">
  <name>Task 16-01-02: Route economy/tax/population/workers/ratings consumers through HOUSING_LIVE_STATS</name>
  <files>src/sim/economy.ts, src/sim/advisors.ts, src/sim/runner.ts, src/sim/types.ts, tests/unit/economy.test.ts, tests/unit/labor.test.ts, tests/unit/happiness.test.ts, tests/unit/advisors.test.ts</files>
  <read_first>
    - src/sim/economy.ts:18-24 (workerPool), :45-67 (tickEconomy tax at :52), :69-76 (populationOf at :73), :91-99 (computeRatings tierSum at :95 — the derived-tier exception)
    - src/sim/advisors.ts:570-602 (foodOverlayGrids clamped HOUSE_TIERS index at :582 — the bridge precedent)
    - src/sim/runner.ts:1589-1597 (getState happiness weighting at :1594), :913-929 (avgHousingLevel :918 + patricianShare :927 — keep derived tier)
    - tests/unit/economy.test.ts:10-35 (mkHouse with house overrides), tests/unit/labor.test.ts + tests/unit/happiness.test.ts + tests/unit/advisors.test.ts (the `{ tier: N }` kitty constructions)
  </read_first>
  <behavior>
    - Test 1: a kitty house with `{ tier: 2, level: 8 }` contributes HOUSING_LIVE_STATS[8] workers to workerPool, taxPerTick to tickEconomy, and population to populationOf (economy.test.ts re-derived expectations).
    - Test 2: avgHousingLevel/patricianShare still read the derived `house.tier` bucket so the rating math (HOUSE_TIERS.length denominator) is unchanged on the same levels.
    - Test 3: houseHappiness weighting in runner.getState() uses the level-based population (liveStats) so merged/level-driven populations weight happiness consistently.
  </behavior>
  <action>
    Scale the scalar consumers to the 21-level economy per decision §HOUS-01 ("bridge so the 5-tier consumers keep working"), all through the single clamped `liveStats(level)` accessor from housingLive.ts — never a bare HOUSING_LIVE_STATS index (Pitfall 3):

    1. src/sim/economy.ts: import `liveStats` from './housingLive'. At :21 workerPool — inside the `b.house.laborCooldown > 0` guard, `total += liveStats(b.house.level).workers`. At :52 tickEconomy — `taxIncome += liveStats(b.house.level).taxPerTick * policy.taxRate`. At :73 populationOf — `total += liveStats(b.house.level).population`. At :95 computeRatings — KEEP `tierSum += b.house.tier + 1` (the derived 0-4 bucket; the HOUSE_TIERS.length normalization at :99 stays valid). Remove the now-unused `HOUSE_TIERS` import if no other reference remains.
    2. src/sim/advisors.ts: at :582 foodOverlayGrids — route the population used for the food-days projection through the same clamped liveStats accessor (copy the clamp style already present at :582), so the estimate scales with the 21-level population.
    3. src/sim/runner.ts getState happiness weighting (:1594): replace `HOUSE_TIERS[b.house!.tier].population` with `liveStats(b.house!.level).population`.
    4. Update the four kitty test files in the SAME task (the consumer switch breaks them otherwise): economy.test.ts, labor.test.ts, happiness.test.ts, advisors.test.ts — set an explicit `level` on every constructed house (e.g. `{ tier: 2, level: 8 }` consistent with the tierOfLevel mapping) and re-derive the expected workers/tax/population values from HOUSING_LIVE_STATS (prefer importing HOUSING_LIVE_STATS and indexing by the same level the test asserts, rather than hard-coding the numbers, so the suite stays coherent if the ladder is retuned).
    5. Leave housing.test.ts / civic-services.test.ts / bankruptcy.test.ts / health-education-entertainment.test.ts / food-chain.test.ts RED until 16-03-02 (timing/tier re-derivation) — do not touch them here.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/unit/economy.test.ts tests/unit/labor.test.ts tests/unit/happiness.test.ts tests/unit/advisors.test.ts -x</automated>
  </verify>
  <acceptance_criteria>workerPool/tax/income/population read HOUSING_LIVE_STATS[level] through the clamped accessor; computeRatings/avgHousingLevel/patricianShare keep the derived tier bucket; happiness weighting uses level population; the four kitty suites pass with an explicit level field; no NaN from unguarded indexing.</acceptance_criteria>
  <done>Economy/tax/population/workers/advisor/happiness consumers all read HOUSING_LIVE_STATS[level] via the clamped accessor; ratings keep the derived tier; the four kitty suites are green and level-aware.</done>
</task>

<!-- ===================== WAVE 2 (HOUS-02) — hysteresis devolution verification + deterministic merge ===================== -->

<task type="auto">
  <name>Task 16-02-01: housingMerge pure helpers + catalog footprint ladder</name>
  <files>src/sim/housingMerge.ts, data/housing.ts, tests/unit/housing-merge.test.ts</files>
  <read_first>
    - src/sim/placement.ts:1-7 (pure injected-predicate occupancy convention) and :34-38 (n x n double-loop over a predicate — the blockFits skeleton)
    - src/sim/runner.ts:2730-2739 (footprintsTouch axis geometry) and :2686-2689 (tileKey)
    - src/sim/walkers.ts:213-218 (DIRS orthogonal neighbors)
    - game-specs/game.md:839-861 (footprint ladder: 1x1 levels 0-10, 2x2 11-14, 3x3 15-18, 4x4 19-20)
    - data/housing.ts:7-44 (HousingLevelDef + HOUSING_LEVELS to extend additively)
  </read_first>
  <behavior>
    - Test 1: targetFootprint(5)===1, (11)===2, (15)===3, (19)===4, (20)===4 and monotonic over 0-20 (housing-merge.test.ts).
    - Test 2: blockFits is false when a foreign building occupies any tile inside the target square, true when only the merging houses' tiles are inside (injected occupancy predicate, placement.ts style).
    - Test 3: findMergePartner returns a same-level orthogonally-adjacent mergeable partner in fixed scan order and null for non-adjacent or different-level houses.
  </behavior>
  <action>
    Build the deterministic merge pure-transform per decision §House Merging — measured, no mutation, runner-owned application later:

    1. data/housing.ts: add `footprint: number;` to `HousingLevelDef` (:7-20) and set it on every HOUSING_LEVELS entry per the game.md §11.3 ladder: footprint 1 for levels 0-10, 2 for 11-14, 3 for 15-18, 4 for 19-20. Additive and monotonic (existing data-catalog housing asserts stay green; footprint monotonicity validation lands in 16-03-02 with the rest of the validate.ts housing block).
    2. Create src/sim/housingMerge.ts (pure, side-effect-free, placement.ts style). Import `HOUSING_LEVELS` from '../../data/housing' and type-only `BuildingInstance` from './walkers'. Export:
       - `targetFootprint(level: number): number` — read `HOUSING_LEVELS[level].footprint` (fall back to 1 when undefined) — the merge ladder for a level.
       - `findMergePartner(a: BuildingInstance, buildings: readonly BuildingInstance[]): BuildingInstance | null` — fixed scan in placement order; return the first building that is a house, same `house.level` as a, `mergeable === true`, and orthogonally adjacent to a (edge-sharing, gap === 1, using the footprintsTouch axis math with strict edge contact — DIRS-anchored).
       - `blockFits(originX: number, originY: number, n: number, isOccupied: (x: number, y: number) => boolean, exemptTileKeys?: Set<number>): boolean` — every tile in the n x n square must satisfy `!isOccupied(...)` OR be in the exempt set (the two merging houses' own tiles). Pure predicate over an injected occupancy check (placement.ts:34-38 pattern); the runner injects `this.occupiedTiles`.
       - `mergeProposal(a: BuildingInstance, b: BuildingInstance, footprint: number, isOccupied): { survivor: BuildingInstance; absorbed: BuildingInstance; footprint: number } | null` — validates same-level, blockFits on the union square anchored at the survivor's origin (a), returns the proposal when the block fits; deterministic given fixed inputs.
    3. Flip tests/unit/housing-merge.test.ts green (pure helpers, no runner wiring yet).
    4. Do NOT touch runner.ts in this task — the % 40 integration step is 16-02-02.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/unit/housing-merge.test.ts tests/data-catalog.test.ts -x</automated>
  </verify>
  <acceptance_criteria>data/housing.ts carries the monotonic footprint ladder (1/2/3/4); housingMerge.ts exports targetFootprint/findMergePartner/blockFits/mergeProposal as pure functions; the merge unit test passes; no runner or occupancy mutation in this task.</acceptance_criteria>
  <done>Catalog footprint ladder added (monotonic, game.md §11.3) and the pure merge transform (targetFootprint, findMergePartner, blockFits, mergeProposal) is implemented and unit-tested green; nothing is wired into the runner yet.</done>
</task>

<task type="auto">
  <name>Task 16-02-02: Runner deterministic merge step + integration/ determinism flip</name>
  <files>src/sim/runner.ts, src/sim/types.ts, src/sim/walkers.ts, tests/integration/housing-evolution-live.test.ts, tests/determinism/housing-evolution-determinism.test.ts</files>
  <read_first>
    - src/sim/runner.ts:281-386 (tick() order — where tickHousing :290-297 sits and the % 40 cadence-step pattern :362/:368/:374), :388-428 (tickSafety in-place mutation skeleton for tickHousingMerge to mirror), :1474-1508 (building registry push + occupiedTiles re-key), :1529-1536 (demolish occupiedTiles deletion), :2568-2572 (buildingAt), :2618-2623 (emitMessage), :2107-2123 (fromSaveData replay — derives merges, no new SaveCommand)
    - src/sim/types.ts:60 (MessageType additive union — append 'house-merged')
    - src/sim/walkers.ts:44/80-85 (targetBuildingId / destBuildingId — verify removal tolerance)
    - src/sim/housingMerge.ts (16-02-01 helpers) and src/sim/housing.ts tickHousing (the devolution path from 16-01-01)
  </read_first>
  <behavior>
    - Test 1 (merge): two adjacent same-level houses at a footprint-gated level merge on the month cadence — survivor footprint grows, combinedPopulation doubles, occupiedTiles re-keyed so buildingAt resolves the survivor on both tiles, absorbed instance removed, 'house-merged' emitted (housing-evolution-live.test.ts 'merge' describe).
    - Test 2 (devolve): removing a required service/good + holding past toleranceTicks devolves the house and it does not oscillate immediately after (grace — both counters reset) (housing-evolution-live.test.ts 'devolve' describe).
    - Test 3 (determinism): a city that evolves AND merges yields byte-identical getStateJson() across chunks 1/7/50 and a save->load round-trip, merged combined population included (housing-evolution-determinism.test.ts).
  </behavior>
  <action>
    Wire the deterministic merge step (decision §House Merging) and close the hysteresis devolution verification:

    1. src/sim/types.ts MessageType (:60): append `'house-merged'` to the union (additive; preserve the existing literals). Grep the repo for exhaustive MessageType switches (search house-devolved consumers, e.g. the browser layer) and add a `house-merged` case wherever the switch would otherwise become exhaustive-incomplete.
    2. src/sim/runner.ts: add a private `tickHousingMerge(): void` mirroring the `tickSafety` skeleton (:388-428) — in-place mutation of this.buildings/this.buildingById/this.occupiedTiles; reuse `this.tileKey` (:2686), `this.buildingAt` (:2568), `this.emitMessage` (:2618). Invoke it from `tick()` immediately AFTER the tickHousing call, gated on the month cadence `if (this.tickCount % 40 === 0) this.tickHousingMerge();` (matches the "1-3 month grace" scale and the existing cadence-step precedent at :362/:368/:374).
       Merge algorithm (fixed scan order over `this.buildings`, placement order — deterministic):
       - For each building a in order: skip if not a house, `!a.house.mergeable`, `a.house.level > 20`, or `a.footprint >= targetFootprint(a.house.level)` (already grown, or levels 0-10 whose floor footprint is 1 — no-op for most cities).
       - neighbour = findMergePartner(a, this.buildings) using this.buildingAt around a's tiles; require neighbour.house.mergeable and same level.
       - proposal = mergeProposal(a, neighbour, targetFootprint(a.house.level), (x, y) => this.occupiedTiles.has(this.tileKey(x, y))) with exemptTiles = a's + neighbour's current tile keys.
       - On success: survivor = a keeps its id and origin; survivor.footprint = proposal.footprint. Combined population: `survivor.house.combinedPopulation = effectivePop(a) + effectivePop(neighbour)` where effectivePop(h) = h.house.combinedPopulation ?? liveStats(h.house.level).population — the merged house "produces the combined population" (CONTEXT); clear the override on any later level change (evolve/devolve) so a post-merge level change re-derives from the new level (documented rule). Re-key occupiedTiles: delete the absorbed house's tiles under the absorbed id and set the WHOLE new footprint square to the survivor id. Remove the absorbed building from this.buildings and this.buildingById; free the evicted tiles (the absorbed origin tiles are released automatically by the survivor's larger footprint). Merge only up to level 20 (the ladder already caps at 4x4 for 19-20). Emit `this.emitMessage('house-merged', 'House merged to ${housingLevelName(a.house.level)}')`.
       - Walker-target safety (Pitfall 6): after removing the absorbed id, scan this.walkers for `targetBuildingId === absorbed.id` (and destBuildingId). If the walker destination-resolution path (walkers.ts) already tolerates a null buildingById (walkers expire), no-op; otherwise repoint those walkers to the survivor id or despawn them in the merge step. Add a test that a walker targeting the absorbed house does not break the replayed state.
    3. src/sim/walkers.ts: no new fields needed beyond 16-01-01 (combinedPopulation already added); touch only if the walker-target tolerance in step 2 requires a destination-resolution guard.
    4. Flip the tests/integration/housing-evolution-live.test.ts 'devolve' and 'merge' describes green, and flip tests/determinism/housing-evolution-determinism.test.ts green (chunked 1/7/50 + save->load byte identity with the merged state; the no-RNG/clock source audit covers housing.ts/housingLive.ts/housingMerge.ts/data/housing.ts).
    5. Goldens remain intentionally RED here — regeneration is Wave 3.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/integration/housing-evolution-live.test.ts tests/determinism/housing-evolution-determinism.test.ts tests/unit/housing-merge.test.ts -x</automated>
  </verify>
  <acceptance_criteria>Merge runs on the % 40 cadence with fixed placement-order scan; survivor gains the footprint, produces combined population, occupiedTiles re-keyed, evicted tiles freed, house-merged emitted, no merge beyond level 20; walkers targeting an absorbed id are safe; devolution works via toleranceTicks with grace reset; the integration devolve/merge describes and the determinism file pass; goldens still RED (Wave 3).</acceptance_criteria>
  <done>The runner owns a deterministic month-cadence merge step (combined population, footprint growth, occupancy re-key, evicted tiles freed, house-merged message, walker-target safety) and the devolve + merge integration scenarios and the evolution/merge determinism suite are green; goldens remain intentionally unregenerated until Wave 3.</done>
</task>

<!-- ===================== WAVE 3 — golden regeneration + test updates ===================== -->

<task type="auto">
  <name>Task 16-03-01: Regenerate golden fixtures (intentional mechanic change)</name>
  <files>tests/golden/fixtures/food-chain-golden.json, tests/golden/fixtures/paused-commands-golden.json</files>
  <read_first>
    - tests/golden/golden.test.ts:16-38 (GOLDEN_UPDATE gate + runScenario contract)
    - package.json scripts "test:golden:update" (GOLDEN_UPDATE=1 vitest run tests/golden)
    - tests/golden/fixtures/food-chain-golden.json (the pinned 5-tier values that will shift: tier:2, tierName: Insula, populationCapacity: 20, desirability: 75, house-evolved ticks)
  </read_first>
  <behavior>
    - Test 1: after regeneration, tests/golden passes without GOLDEN_UPDATE (the committed fixture matches current behavior).
    - Test 2: the regenerated snapshot reflects the 21-level mechanic — the food-chain city (no fountain/pottery) lands BELOW the old Insula (level/tier/tierName/populationCapacity differ), message texts use the level names.
  </behavior>
  <action>
    Regenerate the golden fixtures as an INTENTIONAL mechanic change (RESEARCH Pitfall 1 / A8 — the golden header itself directs "Regenerate intentionally on mechanic changes"):

    1. Run `npm run test:golden:update` (GOLDEN_UPDATE=1 vitest run tests/golden) to rewrite tests/golden/fixtures/food-chain-golden.json and paused-commands-golden.json from the current behavior.
    2. Inspect the committed diff to confirm the expected mechanic shift: the 4-house food-chain city (well/market/farm/granary — no fountain, no pottery/vegetables…) cannot hold an Insula, so house.level/ tier/tierName/populationCapacity/desirability and the house-evolved/devolved message ticks change (e.g. cap near the well+market+wheat level, desirability 75 normalizing to levelDesirability(75)=13). If a value looks impossible (level > 20, negative desirability, NaN population), STOP and re-check 16-01-01/16-02-02 — the merge step must only feed occupancy/population, and the level ladder only 0-20.
    3. Run `npx vitest run tests/golden -x` WITHOUT GOLDEN_UPDATE to confirm the committed fixtures are stable.
    4. Do NOT hand-edit the fixtures; do not "tune" the sim to restore the old 5-tier snapshot.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run test:golden:update && npx vitest run tests/golden -x</automated>
  </verify>
  <acceptance_criteria>Both golden fixtures are regenerated via the update script and match current behavior (golden tests green without GOLDEN_UPDATE); the snapshot reflects the 21-level mechanic (food-chain city below Insula, message-name/ticks shifted); determinism suite (behavioral equivalence) still green.</acceptance_criteria>
  <done>tests/golden fixtures regenerated as an intentional mechanic change and stable under the golden test; determinism suites hold (they pin equivalence, not values).</done>
</task>

<task type="auto">
  <name>Task 16-03-02: Update timing/tier asserts, add validate gate, resolve tools mismatch, full-suite green</name>
  <files>data/validate.ts, data/housing.ts, tests/unit/housing.test.ts, tests/unit/civic-services.test.ts, tests/integration/health-education-entertainment.test.ts, tests/integration/bankruptcy.test.ts, tests/integration/food-chain.test.ts</files>
  <read_first>
    - data/validate.ts:75-83 (housing block to extend) and :6-7 (FOOD_TYPES/COMMODITIES imports already present)
    - data/commodities.ts:204-215 (tools houseGood:false), :218-227 (FOOD_TYPES isFood isHouseGood)
    - tests/unit/housing.test.ts:139-152 (devolve timed to devolveWindowTicks=240 — now toleranceTicks=90), :13-37 (mkHouse — add level)
    - tests/unit/civic-services.test.ts:87-117 (exact 5-tier threshold math: evolveCounter:59, tierThreshold(4)=100 — re-derive to minSatisfiedTicks + levelDesirability)
    - tests/integration/bankruptcy.test.ts (arrears + devolve-window timing), tests/integration/health-education-entertainment.test.ts:82-84/:125-143 (maxTier bounds via the tierOfLevel mapping), tests/integration/food-chain.test.ts:43 (house-evolved message assert type)
  </read_first>
  <behavior>
    - Test 1: housing.test.ts devolve fires at toleranceTicks (90) not devolveWindowTicks (240); mkHouse sets a consistent level; messages use level names.
    - Test 2: civic-services.test.ts asserts the 21-level gate — a covered house evolves after minSatisfiedTicks (60) with levelDesirability meeting the level requirement; the control stays.
    - Test 3: validateCatalogs() === [] holds with the new gate (footprint monotonic + requiresGoods subset FOOD_TYPES ∪ houseGood) after tools is removed from levels 15-20 requiresGoods (data-catalog suite green).
  </behavior>
  <action>
    Close the mechanistic-compat surface per RESEARCH Pitfall 4 / A9/A10 and the dispatch's Wave-3 items:

    1. data/housing.ts: resolve the known tools mismatch (Pitfall 5) — remove `'tools'` from the `requiresGoods` of levels 15-20 (houseGood:false per data/commodities.ts:212; the gate forces this). Add a one-line comment above HOUSING_LEVELS noting tools is a workshop good with no house delivery and is excluded from the cumulative housing requirements.
    2. data/validate.ts housing block (:75-83): add (a) each level's `footprint` is a finite positive integer, and (b) `footprint` is non-decreasing across the ladder, and (c) the catalog-consistency gate `requiresGoods ⊆ FOOD_TYPES ∪ { g | COMMODITIES[g]?.houseGood }` (import FOOD_TYPES/COMMODITIES already present at :6-7; push issues in the existing `{ catalog: 'housing', message }` style). This gate is what makes the tools resolution durable.
    3. tests/unit/housing.test.ts: update the devolve-window timing block (:139-152) to the DEFAULT_HYSTERESIS toleranceTicks (90) and assert against the level model (house.level drops after toleranceTicks of a lost requirement, house.tier follows tierOfLevel, messages carry housingLevelName); add `level` to mkHouse (:13-37).
    4. tests/unit/civic-services.test.ts: re-derive the exact-threshold asserts (:87-117) from the new model — `evolveCounter: 59` becomes a satisfiedTicks chase to minSatisfiedTicks (60) under the 21-level gate; the `tierThreshold(4)=100` desirability gate becomes a levelDesirability/level-requirement check (a house with fresh health at the required goods/services evolves at satisfiedTicks=60 with normalized desirability >= the level's padded requirement; the control stays flat).
    5. tests/integration/bankruptcy.test.ts: align the devolution trigger to toleranceTicks (90) instead of devolveWindowTicks (240).
    6. tests/integration/health-education-entertainment.test.ts: keep the monotonic service bounds but re-derive them through the tierOfLevel mapping (clinic/no-clinic monotonicity preserved — e.g. `maxTier` comparisons become consistent maxLevel/tierOfLevel comparisons) and add maxLevel asserts if simpler.
    7. tests/integration/food-chain.test.ts:43: keep the `house-evolved` message-type assert; adjust any reachable-level expectations to the 21-level floor (the food-chain city caps below Insula).
    8. If any of economy/labor/happiness/advisors unit tests still lack a consistent `level` on a house the consumer reads, add it (16-01-02 should have covered the consumer-break cases).
    9. Run the full suite + typecheck + military gate; everything must be green — this closes the phase. Confirm the balance-parity suite is green (no new BALANCE keys were added; tuning constants stayed module-local).
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4 && npm run check:military</automated>
  </verify>
  <acceptance_criteria>All timing/tier asserts re-derived to the 21-level model (devolve at toleranceTicks=90, evolve at minSatisfiedTicks under the level gate, monotonic health-education bounds preserved, food-chain message assert intact); data/validate.ts enforces footprint monotonicity + requiresGoods subset; tools removed from levels 15-20 requiresGoods; full suite, typecheck, and military gate green together.</acceptance_criteria>
  <done>The full suite (unit + integration + determinism + golden + property), typecheck, and military-absence gate are green with the 21-level model; the catalog gate and tools resolution are in place; Phase 16 is verifiable.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Data catalogs → load-time gate | data/housing.ts (new footprint + requiresGoods edits) is untrusted-as-checks input validated once at construction (validateCatalogs; data/validate.ts housing block). |
| Sim state → economy/ratings consumers | house.tier/house.level crossing into economy/advisors/runner — unguarded array indexing here silently produces NaN (Pitfall 3). |
| Runner tick → occupancy registry (merge) | the new merge step mutates occupiedTiles/buildingById/buildings; a non-deterministic scan or a walker left targeting an evicted id breaks byte-identical replay (Pitfall 6). |
| getStateJson → golden fixtures | level-derived serialized values shift the golden snapshots; regeneration is an explicit mechanic change, never a hand-edit. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-16-01 | Tampering | economy.ts/runner.ts/advisors.ts reading HOUSING_LIVE_STATS[level] unguarded (level >= 21 or undefined → NaN tax/pop/workers) | high | mitigate | All consumers route through the single clamped `liveStats` accessor in housingLive.ts (never a bare index); house.tier stays a derived 0-4 bucket so ratings math is untouched (tasks 16-01-01/02). |
| T-16-02 | Tampering | merge step non-determinism (RNG/clock, wall-clock cadence, or non-fixed scan order) breaking getStateJson() byte-identity | high | mitigate | Merge is tick-driven with fixed placement-order scan on the % 40 cadence; no RNG/clock in housing.ts/housingLive.ts/housingMerge.ts/data/housing.ts; locked by the Wave 0 determinism suite (chunked 1/7/50 + save->load) flipped in 16-02-02. |
| T-16-03 | Tampering | merge evicting an id still referenced by walker targetBuildingId/destBuildingId → replayed city freezes or diverges | medium | mitigate | Merge step scans walkers for the absorbed id and repoints to the survivor or despawns them when destination resolution cannot tolerate a null buildingById; verified by the integration merge scenario + determinism suite (16-02-02). |
| T-16-04 | Tampering | catalog inconsistency — requiresGoods referencing a non-house good (tools) or unknown id, or a non-monotonic footprint ladder corrupting the merge | medium | mitigate | validateCatalogs() housing block gains footprint positive/monotonic checks and the requiresGoods ⊆ FOOD_TYPES ∪ houseGood gate; tools removed from levels 15-20; data-catalog.test.ts asserts validateCatalogs() === [] (16-03-02). |
| T-16-05 | Tampering | level value leaking into the legacy 5-tier consumer (tier >= 5) via an unguarded HOUSE_TIERS index | high | mitigate | house.tier is derived only through tierOfLevel (0-4) after every decision; no code path ever assigns a level-like value to house.tier; 16-01-02 migrates every scalar consumer away from HOUSE_TIERS[tier]. |
| T-16-06 | Tampering | golden drift — hand-editing fixtures or silently regenerating on a bug | medium | mitigate | Regeneration happens only via `npm run test:golden:update` as an explicit intentional-mechanic-change task (16-03-01); the regenerated snapshot is inspected for plausible 21-level values; determinism suites pin behavioral equivalence regardless of values. |
| T-16-SC | Tampering | npm/pip/cargo installs | low | accept | Accepted: this phase installs no packages (research Package Legitimacy Audit: none); if a later phase adds one it re-enters the gate. |

## Mitigation Notes for ASVS Level 1
- V5 Input Validation is the only applicable control: catalog data (footprint, requiresGoods) is validated at load time and by data-catalog.test.ts; merge/evolution reject impossible states by construction (level ladder 0-20, footprint ladder monotonic).
- V2/V3/V4/V6 are N/A — local offline single-player deterministic sim with no identities, sessions, access control, or cryptographic use; the phase's real "security" property is deterministic state integrity (byte-identical replay), enforced by the Wave 0 determinism suite and the no-RNG/clock source audit.
</threat_model>

<verification>
- After every task commit: run that task's `<automated>` command (all < 60s). Wave 0's structural gate is a `test -f` check (the four scaffolds are expected RED).
- After every wave: `cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` — full suite green EXCEPT the declared-RED files at that point in the phase: after Wave 1 the golden fixtures + housing/civic-services/bankruptcy/health-ed-ent/food-chain timing/tier asserts + the merge/determinism/integration-devolve-merge scaffolds are knowingly RED (each implementing task flips its targets); after Wave 2 only the golden fixtures + the 16-03-02 timing asserts remain RED; after Wave 3 everything is green.
- After every wave: `npm run check:military` green; `tests/balance-parity.test.ts` green (no new data/balance.ts keys — housing tuning stays module-local HOUSING_*/LEVEL_* prefixed).
- Wave 3 close: full suite + typecheck + military all green before /gsd-verify-work.
- Determinism guarantees: satisfiedTicks/unsatisfiedTicks, combinedPopulation, and every merge must be replay-derivable from saveCommands + tickCount (fromSaveData contract); the merge adds NO SaveCommand kind.
</verification>

<success_criteria>
1. HOUS-01: houses evolve only when ALL cumulative goods/services/religion/desirability of the target level are met for the minimum period (minSatisfiedTicks, per decideEvolution); house.level (0-20) is the live source of truth and house.tier is its derived 0-4 bucket; economy/tax/population/workers/advisor/happiness read HOUSING_LIVE_STATS[level] via the clamped accessor; desirability is normalized (levelDesirability, 0-200 → 1-30, cap 30 so the full ladder to level 20 is satisfiable).
2. HOUS-02: houses devolve after toleranceTicks of lost requirements/desirability-below-tolerance; hysteresis prevents oscillation (both counters reset on any level change); compatible orthogonal adjacent same-level mergeable houses merge on the month cadence when the block fits the target footprint (ladder 1/2/3/4), with combined population, freed evicted tiles, re-keyed occupancy, and no merge beyond level 20.
3. Determinism: a city that evolves and merges replays byte-identically across chunked ticks and save→load (counters + combined population included), no RNG/clock in the new paths.
4. Goldens regenerate as an intentional mechanic change and the golden + full suite + military + balance-parity gates are green; catalog validates (footprint monotonic + requiresGoods ⊆ FOOD_TYPES ∪ houseGood; tools resolved).
</success_criteria>

<output>
Create `.planning/phases/16-full-housing-evolution/16-SUMMARY.md` when the phase is done and verified (per the execute-plan workflow / summary template).
</output>
