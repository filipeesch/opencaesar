# Phase 16: Full Housing Evolution - Research

**Researched:** 2026-08-05
**Domain:** Deterministic city-sim housing progression (21-level evolution, hysteresis, house merging)
**Confidence:** HIGH (in-repo facts verified by reading source this session); MEDIUM for bridge design recommendations; LOW ([ASSUMED]) for merge-design details not present in code

## Summary

Phase 16 wires the already-scaffolded 21-level housing catalog (`data/housing.ts`) and pure evolution engine (`src/sim/housingEvolution.ts`) into the live deterministic sim, then adds hysteresis-driven devolution and adjacent-house merging. The scaffolding exists and is used **only by tests** today — `decideEvolution` is imported exclusively in `tests/unit/housing-evolution.test.ts` and `tests/integration/food-slice.test.ts`, never in the live sim. `tickHousing` in `src/sim/housing.ts` still runs the legacy 5-tier (`HOUSE_TIERS`) engine, and `house.tier` is consumed by economy, ratings, advisors, and the snapshot path in 8 live call sites.

The dominant risk is **not** writing the 21-level logic — it exists — but the **bridge** between the two data models, which mismatches on five axes: (1) `HOUSING_LEVELS.desirability` is 1–20 while the live `desirabilityOf` scale is 0–200; (2) `HOUSING_LEVELS.requires` uses building-type keys (`well`, `market`, `fountain`, …) while live `house.services` holds wellness keys (`health`, `literacy`, `religion`, `entertainment`) plus `foodCooldown`/`waterCooldown`/`godAccess`; (3) `requiresGoods` references non-food luxuries (pottery/furniture/wine/oil, plus `tools` which is flagged `houseGood:false`) for which **no per-house delivery path exists** in the live sim; (4) `HOUSING_LEVELS` carries `capacity`/`taxPerCapita` but **no workers column and no taxPerTick unit**, so the economy consumers need a new additive 21-entry live-stats table; (5) the catalog has **no footprint field** — the merge step's footprint ladder must be sourced from `game-specs/game.md` §11.3 (1×1 → 4×4) since merging is entirely net-new.

The second big risk is behavioral drift against existing tests and golden fixtures. The happy-path golden (`tests/golden/fixtures/food-chain-golden.json`) pins the 5-tier outcome (`tier: 2` Insula, `desirability: 75`, `house-evolved` message ticks 143/149/161/203/209/221/251/311) for a food-chain city that has no fountain or goods chain — under the 21-level rules that city cannot hold an Insula. A 21-level rewire is an **intentional mechanic change**, so the goldens must be regenerated (`npm run test:golden:update`) as an explicit task, and `tests/unit/housing.test.ts` (devolveWindowTicks=240 timing), `tests/unit/civic-services.test.ts` (exact 5-tier threshold math), `tests/integration/health-education-entertainment.test.ts`, `tests/integration/bankruptcy.test.ts`, `tests/integration/food-chain.test.ts`, and the economy/labor unit tests must be updated or re-validated for the new model.

**Primary recommendation:** Add `house.level` (0–20) driven by `decideEvolution` as the single source of truth; keep `house.tier` as a derived 0–4 bucket (`tierOfLevel(level)`) so the normalized rating factors and patrician share stay intact; route economy/population/happiness **values** through a new additive `HOUSING_LIVE_STATS` 21-entry table (population/workers/taxPerTick per level, derived from `HOUSING_LEVELS.capacity`/`taxPerCapita` + a new workers column) so the 21-level economy is accurate; normalize live `desirabilityOf` (0–200) onto the 1–20 level scale before feeding `decideEvolution`; assemble `satisfied[]` from a documented deterministic per-key derivation; and add a runner tick-cadence merge step using a fixed scan order. Treat the golden regeneration as an intentional mechanic change with a dedicated task.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Houses evolve only when ALL cumulative requirements (goods + services + religion + desirability) of the target level are met for the minimum eligibility period (`minSatisfiedTicks`), per the existing `decideEvolution` in `src/sim/housingEvolution.ts`.
- The 21-level catalog in `data/housing.ts` (`HOUSING_LEVELS`, 0-20 with `requires`/`requiresGoods`/`desirability`) is the single source of truth; the live house updates its level through `decideEvolution` rather than the 5-tier `house.tier` shortcut.
- Bridge to the existing live model: `HOUSING_LEVELS[level]` supplies capacity/tax/desirability so the 5-tier `HOUSE_TIERS` consumers (economy population/tax/workers, ratings housing factor, advisors) keep working — either by mapping level→tier or by extending house state with a `level` field that these consumers read. Additive: existing 5-tier behavior for levels ≤ 5 is preserved or mapped cleanly.
- `satisfied` inputs to `decideEvolution` are derived from the live house state: fresh service access (health/literacy/entertainment + food/water/labor cooldowns + godAccess religion), goods (food inventory/foodMemory + trade goods access), and desirability (`desirabilityOf`).
- Devolve after tolerance loss: requirements missing (or desirability below the current level's tolerance) for `toleranceTicks`; `DEFAULT_HYSTERESIS` (evolveDesirabilityPadding 5, devolveDesirabilityTolerance 5, minSatisfiedTicks 60, toleranceTicks 90) is the baseline.
- Grace period prevents oscillation: after any level change, reset the opposite counter (evolve clears devolve counter and vice versa), and hysteresis padding/tolerance keep evolve/devolve thresholds separated so a house cannot bounce repeatedly.
- Counters (`satisfiedTicks`/`unsatisfiedTicks` per house) are deterministic from tick history, not wall-clock; save/load replay reproduces them byte-identically.
- Compatible adjacent houses (same current level, both flagged mergeable, contiguous free tiles forming a block that fits the larger target lot) merge into one larger house when the block allows.
- Merging only happens up to the catalog's top level (no merge beyond level 20); a merge to a larger-lot level requires the cumulative requirements of the target level borne solely by one surviving house instance.
- Additive data: houses gain a footprint/mergeable hint and the runner gains a deterministic merge step (tick cadence), with the merged house producing the combined population and the evicted tile freed.
- Determinism: merging order is deterministic (fixed scan order over buildings); no RNG/clock; replay reproduces the same merges.

### the agent's Discretion
- Exact level→tier mapping/derivation strategy for the live 5-tier consumers (map level→tier index, or extend house with `level` and adjust consumers) — as long as economy/tax/population/ratings stay consistent and additive.
- How `satisfied` is assembled per house from the multiple live service/goods sources (which precedence, which keys map to `HOUSING_LEVELS.requires`/`requiresGoods`).
- Merge trigger precision: which adjacent configurations (orthogonal only, 2×1 vs 2×2) merge at which level, and the exact block-fit rule.
- Whether merge requires both houses' desirability above threshold and the surviving house's cumulative requirements met.
- Exact `minSatisfiedTicks`/`toleranceTicks` calibration within the hysteresis baseline.

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOUS-01 | Full data-driven 21-level progression (0 vacant lot → 20 luxurious palace) with cumulative requirements | `HOUSING_LEVELS` (data/housing.ts:22-44) is complete (level/name/capacity/taxPerCapita/requires/requiresGoods/desirability). `decideEvolution` (housingEvolution.ts:57-81) implements cumulative requirements + min-eligibility-period. This phase's work is the live bridge: add `house.level`, assemble `satisfied[]` from live state, wire into `tickHousing`/runner, normalize desirability scale. |
| HOUS-02 | Evolution/de-evolution uses hysteresis (evolve limit, devolve limit, 1–3 month grace) and house merging into larger lots | `DEFAULT_HYSTERESIS` (housingEvolution.ts:38-43: padding 5 / tolerance 5 / minSatisfiedTicks 60 / toleranceTicks 90) already encodes the hysteresis model; counters must be added per house and reset on state change. Merging is net-new (no code exists) — design in §HOUS-02 below, footprint ladder from game-specs/game.md §11.3. |
</phase_requirements>

## Current Implementation State (verified this session)

### Catalog: `data/housing.ts` — COMPLETE, un-wired
- `HOUSING_LEVELS` — 21 entries (0–20). Each has `level/name/capacity/taxPerCapita/requires/requiresGoods/desirability` [VERIFIED: data/housing.ts:7-44]:
  - Level 0: `{ level: 0, name: 'Vacant Lot', capacity: 0, taxPerCapita: 0, requires: [], requiresGoods: [], desirability: 0 }` [VERIFIED: data/housing.ts:23]
  - Level 20: `{ level: 20, name: 'Luxury Villa', capacity: 420, taxPerCapita: 20, requires: ['market','fountain','hospital','school','library','theatre','temple','amphitheatre','forum','garden','senate','grand_temple'], requiresGoods: ['wheat','pottery','vegetables','fruit','fish','meat','furniture','wine','oil','tools'], desirability: 20 }` [VERIFIED: data/housing.ts:43]
- Requirements are cumulative-by-inclusion: `requiresGoods` grows item-by-item across levels 2→15 (wheat → +pottery → +vegetables → +fish → +furniture → +wine → +oil → +fruit/+meat → +tools); `requires` grows across 1→20. [VERIFIED: data/housing.ts:22-44 verbatim above]
- `housingLevelName(level)`, `housingCapacity(level)` helpers exist but are used only by `tests/data-catalog.test.ts`. [VERIFIED]
- `TIER_CIVIC_GATES: Readonly<Record<number, readonly string[]>>` = `{ 3: ['health'], 4: ['literacy'], 5: ['entertainment'] }` — a 5-tier-index mirror, consumed by `tickHousing`'s `civicGateSatisfied`. [VERIFIED: data/housing.ts:66-70, housing.ts:22-26]

### Evolution engine: `src/sim/housingEvolution.ts` — COMPLETE, pure, test-only
- `EvolutionInput { currentLevel; satisfied: string[]; desirability; satisfiedTicks; unsatisfiedTicks }` [VERIFIED: housingEvolution.ts:13-23]
- `EvolutionAction = 'evolve' | 'devolve' | 'none'` [VERIFIED: housingEvolution.ts:25]
- `DEFAULT_HYSTERESIS = { evolveDesirabilityPadding: 5, devolveDesirabilityTolerance: 5, minSatisfiedTicks: 60, toleranceTicks: 90 }` [VERIFIED: housingEvolution.ts:38-43]
- `decideEvolution(input, cfg)`: evolve when next level's `requires`+`requiresGoods` ⊆ `satisfied` AND `desirability >= nextDef.desirability + evolveDesirabilityPadding` AND `satisfiedTicks >= minSatisfiedTicks`; devolve (currentLevel>0) when current requirements unmet OR `desirability < current.desirability - devolveDesirabilityTolerance`, AND `unsatisfiedTicks >= toleranceTicks`. [VERIFIED: housingEvolution.ts:50-81]
- `FOOD_VARIETY_REQUIREMENT` is **5-entry only** (0:0,1:1,2:2,3:2,4:3,5:4) and caps at level 5 — not a 21-level table; `foodVarietyRequired` clamps to 5. [VERIFIED: housingEvolution.ts:90-102]
- Wired **nowhere in the live sim** — imported only by `tests/unit/housing-evolution.test.ts` and `tests/integration/food-slice.test.ts` [VERIFIED via grep + reads]. (Dispatch said "only food-slice" — housing-evolution.test.ts also imports it.)

### Live engine: `src/sim/housing.ts` — 5-tier legacy, alive
- `tickHousing(map, buildings, policy, wagesUnpaid, emit, arrearsDepth=0)` is called from the runner each tick at `runner.ts:290-297`. [VERIFIED]
- Per house it decays `foodCooldown/waterCooldown/laborCooldown` and calls `tickCivic` (which decays `house.services` TTL and `godAccess` TTL, then moves `civic.health/literacy/entertainment` toward ceiling). [VERIFIED: housing.ts:34-60, 147-150]
- Evolve branch: requires `hasFood && hasWater`, desirability `>= tierThreshold(house.tier + 2)`, `hasLabor`, `civicGateSatisfied(h.tier+1)`; increments `evolveCounter`, evolves at `>= CONFIG.evolveWindowTicks (60)` and `house.tier < HOUSE_TIERS.length - 1`. [VERIFIED: housing.ts:156-192, balance.ts:47]
- Devolve branch: desirability `< tierThreshold(house.tier)` sustained, or no-food/no-water; increments `devolveCounter`, devolves at `>= CONFIG.devolveWindowTicks (240)` and `house.tier > 0`. [VERIFIED: housing.ts:156-202, balance.ts:49]
- Emits `house-evolved` / `house-devolved` messages with text `House evolved to ${HOUSE_TIERS[house.tier].name}`. [VERIFIED: housing.ts:171/182/200]  (These message texts and ticks are pinned in goldens.)
- `desirabilityOf(map,x,y,policy,wagesUnpaid,services,arrearsDepth)` → **0–200 scale**; terrain base: fertile 40 / earth 30 / trees 20 / rock 10; +policy spread; +15 per active food/water/labor service; −100×(1+arrearsDepth) unpaid; ±adjacent road desirability; clamped [0,200]. [VERIFIED: housing.ts:68-113, balance.ts:53-57]
- `tierThreshold(tier) = tier * CONFIG.desirabilityThresholdPerTier (25)` → 0–100 range on the 0–200 scale. [VERIFIED: housing.ts:116-118, balance.ts:51]
- Food inventory: `HOUSE_FOOD_CAPACITY = [20,40,80,160,250,400]` indexed by tier (6 entries); `deliverToHouse`/`consumeHouseFood`/`foodVariety`/`houseFoodFromUnits`/`tickHouseFoodMemory` are pure helpers used by tests + advisor overlays; **`consumeHouseFood` and `tickHouseFoodMemory` are NOT wired in the runner** — `house.foodInventory` only accumulates unit counts from seller deliveries (walkers.ts:324-349), so it never decays in the live sim. [VERIFIED via grep: no runner callers; advisors.ts:579-589 reads it]

### Config: `src/sim/config.ts` / `data/balance.ts`
- `HOUSE_TIERS` 5 entries: `{ name, population, workers, taxPerTick }` — Shack(5,1,5), Hovel(10,2,7), Insula(20,4,9), Domus(35,7,11), Villa(55,11,13). [VERIFIED: config.ts:22-27]
- `CONFIG = { ...BALANCE }`; relevant keys: `evolveWindowTicks 60`, `devolveWindowTicks 240`, `desirabilityThresholdPerTier 25`. [VERIFIED: config.ts:12, balance.ts:47-51]
- **Balance-parity gate:** every BALANCE key must be consumed as `CONFIG.<key>` in src/ and no src/ file (other than config.ts) may re-declare/re-assign a BALANCE key; new module-local constants are fine if their names don't collide with BALANCE keys. [VERIFIED: tests/balance-parity.test.ts:36-68]

### Consumers of `house.tier` (must keep working)
| # | File:line | Read | Will break if tier semantics change |
|---|-----------|------|-------------------------------------|
| 1 | economy.ts:21 `workerPool` | `HOUSE_TIERS[b.house.tier].workers` if `laborCooldown>0` | yes |
| 2 | economy.ts:52 `tickEconomy` | `HOUSE_TIERS[b.house.tier].taxPerTick * policy.taxRate` | yes |
| 3 | economy.ts:73 `populationOf` | `HOUSE_TIERS[b.house.tier].population` | yes |
| 4 | economy.ts:95 `computeRatings` | `tierSum += b.house.tier + 1`, normalized by `HOUSE_TIERS.length` | yes (used in getState().ratings) |
| 5 | advisors.ts:582 `foodOverlayGrids` | `HOUSE_TIERS[clamp(tier,0,4)].population` (food-days projection) | yes |
| 6 | runner.ts:918 `avgHousingLevel` (RATE-01) | `sum(tier)/count/(HOUSE_TIERS.length-1)` | yes |
| 7 | runner.ts:927 `patricianShare` (RATE-01) | `tier >= 3` | yes |
| 8 | runner.ts:1594 `getState` city happiness | `HOUSE_TIERS[b.house.tier].population` (weighting) | yes |
| 9 | runner.ts:2637-2639 `toBuildingState` | `tier`, `tierName: HOUSE_TIERS[tier].name`, `populationCapacity: HOUSE_TIERS[tier].population` | yes (serialized → SimState → goldens) |
| 10 | housing.ts:260/282 `homeStorageCapacity(idx=tier)` | `HOUSE_FOOD_CAPACITY[tier]` | if tier leaves 0–5 |

Also: `house.tier` index is used **unguarded** (no clamp) in economy.ts:21/52/73 — a tier value ≥ 5 would return `undefined` and break tax/pop/workers. `house.footprint` is read by `toBuildingState`, `placeBuilding`, `demolish`, `footprintsTouch`, `adjacentRoadTile`, `buildingAt` (via `occupiedTiles`).

### Runner integration points
- `tickHousing(...)` call: runner.ts:290-297 (into `buildings`, `map`, `policy`, `lastWagesUnpaid>0`, emit, `arrearsDepth()`).
- House init: runner.ts:1490 `building.house = { tier: 0, foodCooldown: 0, waterCooldown: 0, laborCooldown: 0, evolveCounter: 0, devolveCounter: 0 };` [VERIFIED]
- `occupiedTiles: Map<number,id>` keyed by `tileKey = (x<<20)|y`; updated at placement (1504-1508) and demolish (1532-1536); `buildingAt` (2569) reads it. Houses are currently **always 1×1** (`BUILDINGS.house.footprint = 1`). [VERIFIED: buildings.ts:41-50, runner.ts:1504-1508/2569]
- SaveData = `{version, seed, mapSize, commands, pendingCommands, paused, tickCount, savedAt}`; `fromSaveData` replays **commands** then ticks to tickCount. A deterministic tick-driven merge needs **no new SaveCommand** — replay reproduces it. [VERIFIED: types.ts:92-103, runner.ts:2107-2123]

### tests/golden constraints
- `tests/golden/food-chain-golden.json` — `getState()` at tick 1200 of the food-chain city pins: all 4 houses `tier: 2`, `tierName: "Insula"`, `populationCapacity: 20`, `desirability: 75`, `happiness ≈ 69`, `foodInventory: []`; `house-evolved`/`devolved` message texts and ticks (143,149,161,203,209,221,251,311). [VERIFIED: read fixture]
- `tests/golden/paused-commands-golden.json` — second fixture (verified same city; paused-command pipeline).
- `tests/golden/golden.test.ts` — regenerates via `GOLDEN_UPDATE=1`. [VERIFIED: golden.test.ts:29-32]
- Determinism suites (`tests/determinism/*.test.ts`) assert equality across runs/replays — they pin **behavioral equivalence**, not specific values, so they stay valid under a rewire as long as determinism holds.

### tests/behavioral assertions that a 21-level rewire directly threatens [VERIFIED by reading each]
- `tests/unit/housing.test.ts` — "devolves one tier after a sustained food/water shortfall" asserts tier stays 2 through tick 239 then drops at tick 240 (**timed to devolveWindowTicks=240**). Under `toleranceTicks=90` the house would devolve at tick 90 → test fails unless updated.
- `tests/unit/civic-services.test.ts` — "Domus requires fresh health" asserts exact 5-tier transition 2→3 at `evolveCounter=59` with desirability ≥ `tierThreshold(4)=100`; control stays 2. Exact 5-tier threshold math; breaks if tier semantics change.
- `tests/integration/health-education-entertainment.test.ts` — live-city scenarios assert `maxTier >= 3` with clinic and `<= 2` without (TIER_CIVIC_GATES), and hospital/amphitheatre civic rise. A level→tier mapping must keep these monotonic bounds.
- `tests/integration/bankruptcy.test.ts` — asserts a house `tier >= 1` after 400 ticks then devolves below that after arrears + `devolveWindowTicks`. Depends on the devolution window (~`devolveWindowTicks`), which differs from `toleranceTicks`.
- `tests/integration/food-chain.test.ts:43` — asserts a `house-evolved` message exists (message text unchanged type-wise).
- `tests/unit/economy.test.ts`, `tests/unit/labor.test.ts`, `tests/unit/happiness.test.ts`, `tests/unit/advisors.test.ts` — construct houses with `{ tier: N }` kitty values and assert `HOUSE_TIERS[tier]`-derived worker/tax/pop values. If consumers switch to level-based stats, these kitty constructions must set `level` consistently.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 21-level catalog + cumulative requirements | Data catalog (`data/housing.ts`, pure `housingEvolution.ts`) | — | Data-driven level defs and pure evolution decisions belong in data/pure logic, already scaffolded |
| Per-house level/counter state | API/Backend sim (`HouseInstance` + `tickHousing`) | — | `satisfiedTicks`/`unsatisfiedTicks`/`level` derive from live walker-delivered state each tick |
| Desirability derivation | API/Backend (tile + services) | — | `desirabilityOf` (0–200) already lives in `src/sim/housing.ts` |
| Economy population/tax/workers reading level stats | API/Backend (`economy.ts` consumers) | — | Economy must read the level-driven live-stats table, not the 5-tier shortcut |
| Ratings housing factor / patrician share | API/Backend (`runner.ts` RATE-01) using normalized tier | Data catalog (HOUSING_LEVELS) | Kept as a 0–4 derived bucket so the normalized rating math stays stable |
| House merging / block-fit | API/Backend (runner tick step + occupancy grid) | Data catalog (per-level footprint ladder) | Merge mutates the occupancy grid and building registry — runner-owned, deterministic |
| Determinism / save replay | API/Backend (`getSaveData`/`fromSaveData`) | — | Merge must be tick-driven with fixed scan order so replay reproduces it |
| Visualization / inspector | Browser (DOM inspector reads `BuildingState.house`) | — | `toBuildingState` must expose `level`/`levelName` additively |

## Standard Stack

This is an **in-repo wiring + net-new design phase: no new external libraries are required or recommended.** The "stack" is the existing deterministic sim modules. Any proposed third-party package would be a red flag (see Package Legitimacy Audit — none).

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `data/housing.ts` `HOUSING_LEVELS` | in-repo | 21-level source of truth | Locked by CONTEXT; already validated by `data/validate.ts:75-83` |
| `src/sim/housingEvolution.ts` `decideEvolution` | in-repo | Pure evolve/devolve decision w/ hysteresis | Locked by CONTEXT; already unit-tested |
| `src/sim/housing.ts` `tickHousing`/`desirabilityOf`/food inventory | in-repo | Live per-house tick engine | Existing live loop; wiring point |
| `src/sim/runner.ts` tick + `occupiedTiles` + save/load | in-repo | Merge step + level-state init + replay | Determinism contract owner |

### Supporting (all in-repo)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `data/housing.ts` `TIER_CIVIC_GATES` | Retain the 5-tier service mirrors | While any 5-tier path remains; can be superseded by the requires mapping |
| `data/balance.ts`/`CONFIG` | Desirability scale constants (`desirabilityThresholdPerTier`) | Normalizing 0–200 → 1–20 |
| `data/commodities.ts` `isFood`/`isHouseGood` | Validate requiresGoods keys | Assembling goods side of `satisfied` |
| `game-specs/game.md` §11.1/§11.3/§11.4 | Merge conditions, per-level footprints, patrician/pleb split | Merge design + class reporting [VERIFIED: game-specs/game.md:789-796, 839-861] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Additive `HOUSING_LIVE_STATS` 21-entry table | Bucket level→tier and read `HOUSE_TIERS[tier]` | Bucketing is zero-churn but **saturates** population/tax/workers at Villa level ≥ 10 (economy flat for top half of the ladder) — unacceptable for a 21-level economy. Live table keeps the 21-level economy real with ~6 consumer edits. |
| Normalize live desirability to 1–20 before `decideEvolution` | Feed raw 0–200 into `decideEvolution` | Raw feed makes desirability a no-op (earth=30 ≥ every level's padded 7–25 requirement) — breaks the cumulative requirement contract. Normalization is required. |
| Net-new merge module | Hand-rolled inline in `tickHousing` | Merge mutates occupancy + registry; keep it a separate deterministic step in the runner like `tickSafety`/`tickTradeSystem` (see runner.ts:374/368). |
| Golden regeneration | Surgically preserve 5-tier behavior for levels ≤ 5 | Preservation is fragile across the funnel of scale mismatches (requiresGoods gaps alone cap the food-chain city below Insula) and contradict the phase's purpose. Regenerate deliberately. |

**Version verification:** No external packages are installed by this phase. Node v20.20.1, npm 10.8.2, tsc 5.9.3, vitest 3.2.7 verified present. [`npm view`/`pip index` n/a — no new ecosystem packages.]

## Package Legitimacy Audit

> No external packages are introduced or required by this phase. The entire implementation uses the existing in-repo sim modules; no install step, no network dependency.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| *(none)* | — | — | — | — | — | No packages to audit |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### Integration Approach (HOUS-01 + HOUS-02 wiring)

```
                              ┌─────────────────────────────────────────────┐
┌──────────┐   place(house)   │  SimRunner.tick()  (deterministic, no RNG)  │
│  Player  │ ───────────────▶ │                                             │
└──────────┘                  │ 1. house init: level:0, satisfiedTicks:0,   │
                              │    unsatisfiedTicks:0, mergeable:true       │
                              │                                             │
                              │ 2. Walkers deliver: food/water/labor cooldown│
                              │    + services{health,literacy,religion,     │
                              │    entertainment}+godAccess (per-god TTL)   │
                              │    + foodInventory units (seller)           │
                              │                                             │
                              │ 3. tickHousing (per house):                 │
                              │    a. decay cooldowns + tickCivic (TTLs)    │
                              │    b. satisfied[] = deriveSatisfied(house)  │
                              │       (well/fountain/market/... + goods +   │
                              │        religion + desirability normalize)   │
                              │    c. desirabilityLvl = normalize100(desirab)│
                              │    d. decideEvolution({currentLevel,        │
                              │          satisfied, desirability: ...,      │
                              │          satisfiedTicks, unsatisfiedTicks}) │
                              │    e. apply action: level±1, reset opposite │
                              │       counter, emit house-evolved/devolved  │
                              │    f. house.tier := tierOfLevel(level)      │
                              │       (derived, for ratings/patricians)     │
                              │                                             │
                              │ 4. [tick cadence] merge step: fixed scan    │
                              │    order over buildings, look for same-level│
                              │    orthogonal pairs + free block that fits  │
                              │    target footprint; surviving house keeps  │
                              │    id, gains footprint, occupiedTiles       │
                              │    re-keyed, evicted tiles freed            │
                              │                                             │
                              │ 5. economy/ratings/advisor consumers read   │
                              │    HOUSING_LIVE_STATS[level] + tierOfLevel  │
                              └─────────────────────────────────────────────┘
```

### Pattern 1: Additive `HOUSING_LIVE_STATS` bridge (HOUS-01)
**What:** Keep `HOUSING_LEVELS` as the game-design source of truth, and add a thin additive 21-entry table (`population`/`workers`/`taxPerTick` per level) that the existing `HOUSE_TIERS` consumers read instead. Add `house.level` (0–20) as the live source of truth; derive `house.tier = tierOfLevel(level)` for the two normalized rating factors.
**When to use:** Any consumer that needs a scalar per-house capacity/tax/workers value. Recommended mapping source for capacity/tax is `HOUSING_LEVELS.capacity` and `taxPerCapita` (converted to per-tick); **workers is not in the catalog** — a new column or derived ratio (e.g., `workers = max(1, round(capacity * laborShare))`) is required (discretion, needs confirmation).
**Example (skeleton — values illustrative, not final):**
```typescript
// src/sim/housingLive.ts (additive, deterministic, validated by data-catalog)
import { HOUSING_LEVELS } from '../../data/housing';

export interface LiveHouseStats { population: number; workers: number; taxPerTick: number; }

/** 21-entry live bridge. Derived from HOUSING_LEVELS so it can never drift. */
export const HOUSING_LIVE_STATS: readonly LiveHouseStats[] = HOUSING_LEVELS.map((l) => ({
  population: l.capacity,
  workers: livingWorkers(l),          // DISCRETION: new column or capacity-derived ratio
  taxPerTick: livingTax(l),           // DISCRETION: taxPerCapita/30 (per-month → per-tick) or direct
}));

/** Normalize live 0–200 tile desirability onto HOUSING_LEVELS 1–20 scale. */
export function levelDesirability(tileDesirability: number): number {
  // DISCRETION: round(tile / CONFIG.desirabilityThresholdPerTier) is 0–8; a /10 scale
  // (0–20) better matches the catalog's 1–20. Confirmed by discuss-phase.
  return Math.max(0, Math.min(20, Math.round(tileDesirability / 10)));
}
```
**Sources:** catalog fields [VERIFIED: data/housing.ts:7-44]; `HOUSE_TIERS` shape [VERIFIED: config.ts:14-27]; consumer list [VERIFIED: economy.ts:21/52/73/95, advisors.ts:582, runner.ts:918/927/1594/2637-2639].

### Pattern 2: Deterministic `satisfied[]` derivation (HOUS-01)
**What:** Build `satisfied` (the array `decideEvolution` checks against `requires`+`requiresGoods`) from per-house live state each tick. Each `HOUSING_LEVELS.requires` key maps to a deterministic boolean:
- `'well'` → `house.waterCooldown > 0` (well walkers serve water)
- `'fountain'` → `house.waterCooldown > 0` (fountain walkers also serve water — same service)
- `'market'` → `house.foodCooldown > 0` OR `marketCoverage?.lastFoodDelivery` within the memory window (fresh market touch)
- `'school'`/`'clinic'`/`'library'`/`'theatre'`/`'hospital'`/`'amphitheatre'` → **city building present AND the mapped fresh wellness service** (`services.literacy`/`services.health`/`services.entertainment` > 0), because the live walker flags are wellness-level, not building-level (SERVICE_BY_WALKER: school+library→literacy, clinic+hospital→health, theatre+amphitheatre+colosseum→entertainment) [VERIFIED: walkers.ts:121-130, 358-367]
- `'temple'`/`'grand_temple'` → `Object.keys(house.godAccess).length > 0` (per-god religion access) [VERIFIED: walkers.ts:306-315]
- `'forum'`/`'garden'`/`'senate'` → city building present (no dedicated live walker service; deterministic city-presence fallback — **DISCRETION, needs confirmation**)
- Goods (`'wheat'`, `'pottery'`, …) → `isFood(g)` ? (`house.foodInventory?.[g] ?? 0) > 0 || (g==='wheat' && house.foodCooldown > 0)` : `cityGoodsAccess(g)` (sum of `stock[g]` across storage buildings > 0, OR an import route provides g) — **DISCRETION** (see Open Q3; no per-house non-food delivery exists today).
**When to use:** The single function `deriveSatisfied(house, ctx)` called once per house per tick inside `tickHousing`.
**Key decisions for discuss-phase:** precedence (feed `satisfied` **only** requirement-relevant keys — `requires`+`requiresGoods` union sets), and the religion key mapping (`'temple'` currently requires any god, vs per-god on high levels — game.md §11.3 uses "acesso a dois cultos"/"três cultos"). HOUSING_LEVELS currently lists only a single `'temple'`/`'grand_temple'` key — the multi-god requirement is not expressible without catalog extension (Open Q4).

### Pattern 3: Hysteresis counters + reset (HOUS-02)
**What:** Per-house `satisfiedTicks`/`unsatisfiedTicks` (additive to HouseInstance). Each tick: if current requirements (for the **next** level, matching `minSatisfiedTicks` semantics) satisfied → `satisfiedTicks++`, `unsatisfiedTicks=0`; else `satisfiedTicks=0`, `unsatisfiedTicks++`. On `'evolve'` → `satisfiedTicks=0`; on `'devolve'` → `unsatisfiedTicks=0` (grace/reset prevents oscillation per CONTEXT). Pure, deterministic.
**Pitfall to preempt:** legacy counters `evolveCounter`/`devolveCounter` keep semantics in the 5-tier path; decide whether they are retired or aliased to the new counters (retiring them changes `HouseInstance` + init at runner.ts:1490 + unit tests that set them, e.g. civic-services.test.ts:91 `evolveCounter:59`).

### Pattern 4: Deterministic merge step (HOUS-02, net-new)
**What:** A runner tick-cadence step (recommended: every tick or monthly `tickCount % 40 === 0` — **discretion**, but monthly matches the "1–3 month grace" language and is cheaper). Fixed scan order over `buildings` (placement order — deterministic). For each house flagged `mergeable` at level L (L where target footprint > 1, from game.md §11.3 ladder):
1. Check orthogonal neighbor houses at the **same level**, also mergeable.
2. Compute contiguous free-tile union forming a square block matching the **target level's footprint** (2×2 at levels 11–14, 3×3 at 15–18, 4×4 at 19–20 per game.md §11.3 — **catalog lacks a footprint field; must add one** [VERIFIED: game.md:839-861 vs data/housing.ts:7-44]).
3. Every union tile must be unoccupied (`!occupiedTiles.has(tileKey)`) except the merging houses' own tiles.
4. Surviving house keeps its id and origin; its `footprint` grows; `occupiedTiles` re-keyed to the surviving id for the whole block; other merged instances removed from `buildings`/`buildingById`; their walker targets (labor walkers targeted `targetBuildingId`) handled — **walkers store `targetBuildingId`, verify none reference evicted ids** (they may just walk to a now-gone building and expire; acceptable if the target resolution already tolerates missing ids — verify in plan).
5. The merged house represents the **combined population** (sum of the merged houses' `HOUSING_LEVELS.capacity` or the target level's capacity — CONTEXT says "combined population", so recommend `targetLevel.capacity` OR sum — **discretion, needs confirmation**).
6. Merging **only** to a level whose cumulative requirements the surviving instance meets, and never beyond level 20.
7. Emit a new `MessageType` (additive, e.g. `'house-merged'`) — the `MessageType` union in types.ts:60 is additive.
**When to use:** As the explicit new step in `tick()` near `tickHousing` (runner.ts:290) or alongside the other cadence steps (`tickSafety`/`tickTradeSystem` at runner.ts:374/368).
**Example (merge scan skeleton — deterministic by construction):**
```typescript
function mergeHouses(buildings: BuildingInstance[], occupied: Map<number, number>, emit: ...): void {
  const key = (x: number, y: number) => (x << 20) | y;      // same tileKey as runner
  for (const a of buildings) {                               // fixed placement order
    if (!a.house || !a.house.mergeable) continue;
    const want = targetFootprint(a.house.level);             // 2x2 @ 11+, 3x3 @ 15+, 4x4 @ 19+
    if (!want || a.footprint >= want) continue;
    // fixed direction scan (e.g. right, then down) for a same-level partner
    const b = findSameLevelPartner(a, buildings, occupied);  // orthogonal, same level, mergeable
    if (!b) continue;
    if (blockFits(a, b, want, occupied, key)) {
      // grow a, absorb b, re-key occupied, remove b
    }
  }
}
```
**Why safe for replay:** `fromSaveData` replays commands then ticks; the merge runs identically on replay because it depends only on tick history (level, counters, occupancy). **No new SaveCommand needed.** (Constructing a footprinted house directly via a save command would be different — not the case here.)

### Recommended Project Structure (changes within existing modules; no new folders)
```
src/sim/
├── housingEvolution.ts   # unchanged pure engine (maybe add livingWorkers/livingTax helpers here or a new file)
├── housing.ts            # tickHousing: call deriveSatisfied + decideEvolution; add levelDesirability normalize
├── housingLive.ts        # [NEW, additive] HOUSING_LIVE_STATS + levelDesirability + deriveSatisfied (or fold into housing.ts)
├── runner.ts             # house init +level/counters/mergeable; tickHousing call passes satisfied factory; merge step; toBuildingState +level/levelName
└── economy.ts|advisors.ts|happiness paths → read HOUSING_LIVE_STATS[level] instead of HOUSE_TIERS[tier]
data/
└── housing.ts            # [additive] per-level footprint + (optionally) workers column for the ladder; keep fields additive
tests/
├── unit/housing-level-bridge.test.ts   # [NEW] levelDesirability normalization + statistics table sanity
├── unit/merge.test.ts                  # [NEW] block-fit/determinism/scan-order tests (pure helpers)
├── determinism/housing-evolution-determinism.test.ts  # [NEW] live-city replay byte-identical incl. merge
└── golden/fixtures/*.json              # regenerated (intentional mechanic change)
```

### Anti-Patterns to Avoid
- **Writing level into `house.tier`:** `house.tier` is read **unguarded** in economy.ts:21/52/73 — any value ≥ 5 immediately breaks tax/pop/workers with `undefined` arithmetic. Always keep `house.tier` a 0–4 derived bucket or migrate every consumer at once.
- **Feeding raw 0–200 desirability to `decideEvolution`:** makes the desirability cumulative requirement vacuous (earth base = 30 ≥ padded requirement 7–25 for all levels). Normalize.
- **Rolling `satisfied` from the whole city instead of the house:** ruins the per-house "only when THIS house is served" contract and would let one market evolve every house regardless of walker reach.
- **Merge as a rebuild-from-scratch footprint system:** reuse `occupiedTiles`/`tileKey`/`buildingAt`; do not introduce a second occupancy representation.
- **New RNG/clock in the merge or evolution path:** breaks `getStateJson()` byte-identical replay and the determinism suites (tests/determinism/determinism.test.ts:15-17 asserts byte-identical).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Evolve/devolve decision + hysteresis | A new threshold engine inside `tickHousing` | Existing `decideEvolution` + `DEFAULT_HYSTERESIS` (housingEvolution.ts:38-81) | Already implemented, unit-tested, and locked by CONTEXT. Wiring ≠ rewriting. |
| Level naming/capacity lookup | Hand-written level→name maps | `housingLevelName`/`housingCapacity` (data/housing.ts:46-54) | Single-source catalog helpers already exist and are validated. |
| House food inventory | A separate food tracking | `HouseFoodInventory`/`foodVariety`/`deliverToHouse`/`houseFoodFromUnits` (housing.ts:218-321) | §13 model exists; wire consumption/memory if the goods side needs it (currently unbounded accumulation — see Open Q3). |
| Desirability per tile | A new radial desirability system | `desirabilityOf` (housing.ts:68-113) + `levelDesirability` normalizer | The 0–200 tile/road/policy/wage model is live and golden-pinned; only normalize the scale for the level comparison. |
| Per-house goods delivery | A new home-goods logistics chain | Food inventory for food + a deterministic `cityGoodsAccess` proxy (DISCRETION) | Full home-goods delivery is out of scope until the distribution/trade phases; the bridge only needs a deterministic boolean. |
| Merge block-fit scan | An FPP/repositioning engine | A pure `blockFits` helper over `occupiedTiles` in fixed scan order | Merging is a narrow, deterministic transform; it does not need a general population-placement solver. |

**Key insight:** every expensive primitive this phase might be tempted to hand-roll (evolution decision, hysteresis, catalog lookup, food inventory, desirability) **already exists in the repo as pure, tested code** — the phase's difficulty is 80% the *bridge* (scale/key mapping) and 20% the merge transform, not new engine-writing. Merge (net-new) should be a pure, occupancy-driven helper unit-tested in isolation before wiring into the runner.

## Common Pitfalls

### Pitfall 1: Golden fixtures drift under the 21-level rewire
**What goes wrong:** `food-chain-golden.json` / `paused-commands-golden.json` pin 5-tier outcomes (`tier:2`/`Insula`/`desirability:75`, message ticks 143/…). A 21-level rewire changes reachable levels (food-chain has no fountain, pottery, etc. → caps low) and messages → `golden.test.ts:36` fails.
**Why it happens:** The golden city is tiny (4 houses + well/market/farm/granary); the 21-level cumulative requirements for an Insula (level 5 needs `fountain`, `pottery`) cannot be met there, and hysteresis timing (90 vs 240) shifts message ticks even where levels match.
**How to avoid:** Treat it as an **intentional mechanic change**. Add a task to regenerate (`npm run test:golden:update`) and, ideally, add a Phase-16 determinism test that asserts stability after regeneration. Do NOT try to preserve the exact old snapshot behavior.
**Warning signs:** `golden.test.ts` failure with `toEqual` diff on `buildings[].house` or `messages[]`.

### Pitfall 2: Desirability scale mismatch (1–20 vs 0–200) silently disables the desirability gate
**What goes wrong:** `decideEvolution` compares `desirability >= nextDef.desirability + 5` (max 25). Live `desirabilityOf` base is ≥ 30 for any earth/fertile tile. Naive wiring → desirability never blocks → HOUS-01 cumulative-requirement success criterion (1) unverified.
**Why it happens:** The two models use incompatible scales; the scaffolding predates the live 0–200 tile/section model.
**How to avoid:** Mandatory `levelDesirability(tileDesirability)` normalizer (recommended `round(x/10)`, 0–20); unit-test the normalizer and an `Open Q1`-style decision in discuss-phase.
**Warning signs:** a house with no food/water/labor services evolves purely on terrain desirability; `desirability` snapshot value vs `HOUSING_LEVELS.desirability` look incomparable.

### Pitfall 3: Unguarded `house.tier` indexing crashes the economy
**What goes wrong:** `HOUSE_TIERS[b.house.tier].workers` returns `undefined` for tier ≥ 5 → `workerPool`/`tickEconomy`/`populationOf` produce `NaN`.
**Why it happens:** economy.ts:21/52/73 accesses the array with no clamp (unlike advisors.ts:582 which clamps). If `house.tier` is ever assigned a level-like value, it breaks silently.
**How to avoid:** Keep `house.tier` a derived 0–4 bucket, or migrate these consumers atomically with the `HOUSING_LIVE_STATS` table in the same commit. Add a clamp in the bridge helper for defense.
**Warning signs:** `getState().ratings.population` or `totalWorkers` becomes `NaN`.

### Pitfall 4: Unit tests that time 5-tier thresholds get stale
**What goes wrong:** `housing.test.ts` (devolve at tick 240), `civic-services.test.ts` (evolve at `evolveCounter=59` with `tierThreshold(4)=100`), `bankruptcy.test.ts` (arrears + `devolveWindowTicks`), `health-education-entertainment.test.ts` (`maxTier >= 3` bound) all assume exact 5-tier math/timing.
**How to avoid:** Enumerate these in the plan as UPDATE tasks with the new 21-level expectations (or re-derive from `HOUSING_LIVE_STATS`). Keep `tests/unit/housing-evolution.test.ts` green (pure engine untouched).
**Warning signs:** failing asserts whose only purpose was to prove 5-tier timing.

### Pitfall 5: Non-food `requiresGoods` with no per-house delivery path
**What goes wrong:** levels 4+ require pottery/furniture/wine/oil/tools, but no code delivers non-food goods to houses today (`foodInventory` holds only foods; `COMMODITIES.tools.houseGood === false`, yet `HOUSING_LEVELS[15..20].requiresGoods` includes `'tools'` [VERIFIED: data/commodities.ts:204-215 + data/housing.ts:38-43]).
**How to avoid:** Decide (discuss-phase) between (a) `cityGoodsAccess` proxy (warehouse/route stock > 0) gating high levels, or (b) capping live evolution at the food+services ceiling and leaving goods-gated levels unreachable until the distribution phases. Mount a catalog-consistency check (e.g., validate `requiresGoods ⊆ houseGood ∪ FOOD_TYPES`) as a test.
**Warning signs:** `satisfied` can never contain `'pottery'` … `'tools'` so the top half of the ladder is unreachable and tests for it must be manufactured (expectation mismatch).

### Pitfall 6: Merge breaking save/load or walker targets
**What goes wrong:** A merged footprint re-keys `occupiedTiles`, removes instances, grows `footprint`. If `fromSaveData` replay inverts this (non-deterministic scan) or walkers hold `targetBuildingId` of an evicted house (walkers.ts:44 `targetBuildingId`) the replayed city differs/freezes.
**How to avoid:** Deterministic merge (fixed scan order over `buildings`, which is placement-ordered), a save/load round-trip determinism test with a merge, and a walker-target-leak check (either tolerate missing ids in destination resolution or repoint targets to the survivor).
**Warning signs:** `determinism.test.ts` replays diverge once a merge occurs; walkers perpetually seek a removed house.

### Pitfall 7: Balance-parity CONFIG gate traps new tuning constants
**What goes wrong:** `data/balance.ts` is locked by `tests/balance-parity.test.ts` (every key needs a `CONFIG.<key>` consumer; no re-declaration in src). Adding hysteresis/tax tuning as bare constants in `housing.ts` collides only if the name matches a BALANCE key.
**How to avoid:** Put new tunable scalars either in `data/balance.ts` **with a consuming `CONFIG.<key>` reference**, or as clearly-prefixed module-local constants (e.g., `HOUSING_*`/`LEVEL_*`) that don't collide. Prefer module-local for phase-specific tuning (project precedent: RATE-01 factor weights stay module-local — STATE.md Decisions).
**Warning signs:** `tests/balance-parity.test.ts` failing on "no CONFIG.X consumer" or "re-declared".

## Runtime State Inventory

> Omit for greenfield/feature phase. This is a feature (wiring) phase, not a rename/refactor/migration — no runtime state rename. The only "stateful" artifacts are the two golden fixtures (cataloged in Common Pitfall 1 as an intentional regeneration). Nothing else carries renamed identifiers at runtime.

## Code Examples

Verified patterns from the repo (all read this session):

### Wire `decideEvolution` into a per-house loop (pattern derived from `tickHousing`, housing.ts:143-206 + runner.ts:290-297)
```typescript
// Inside tickHousing, replacing the 5-tier branch's evolve/devolve decisions:
const desirability = desirabilityOf(map, b.x, b.y, policy, wagesUnpaid, services, arrearsDepth);
const action = decideEvolution({
  currentLevel: house.level,
  satisfied: deriveSatisfied(house, ctx),   // Pattern 2 — new, deterministic
  desirability: levelDesirability(desirability), // Pattern 1 — normalize 0-200 -> 1-20
  satisfiedTicks: house.satisfiedTicks,
  unsatisfiedTicks: house.unsatisfiedTicks,
}, DEFAULT_HYSTERESIS);
if (action === 'evolve') {
  house.level += 1; house.satisfiedTicks = 0; house.unsatisfiedTicks = 0; evolved += 1;
  emit('house-evolved', `House evolved to ${housingLevelName(house.level)}`);
} else if (action === 'devolve') {
  house.level -= 1; house.satisfiedTicks = 0; house.unsatisfiedTicks = 0; devolved += 1;
  emit('house-devolved', `House devolved to ${housingLevelName(house.level)}`);
}
house.tier = tierOfLevel(house.level); // keep 0-4 for ratings/patrician (runner.ts:918/927)
```
Source: engine semantics [VERIFIED: housingEvolution.ts:57-81]; message/emit pattern [VERIFIED: housing.ts:171/182/200]; `housingLevelName` [VERIFIED: data/housing.ts:46-48].

### Live satisfied-state sources used to assemble `deriveSatisfied` (verbatim from house fields)
```typescript
// From HouseInstance (walkers.ts:88-109) — what the live sim actually tracks:
house.services  // Partial<Record<string, number>> — wellness keys health|literacy|religion|entertainment, decremented by tickCivic (housing.ts:34-40)
house.godAccess // Record<string, number> — per-god TTL set by serviceGodAround (walkers.ts:306-315)
house.foodCooldown / waterCooldown / laborCooldown  // TTL set by serviceHousesAround (walkers.ts:358-367)
house.foodInventory // Record<string, number> — delivered food units by seller (walkers.ts:324-349); never decays in live sim
house.marketCoverage // §12.13 lastMarketVisit/servingMarketId/foodDeliveredByType
house.civic // { health, literacy, entertainment } 0..100 (walkers.ts:111-119)
```

### Regression/devolve-window baseline vs new tolerance (why goldens shift) — [VERIFIED values]
```typescript
// Legacy (housing.ts:178/167, balance.ts:47-49): evolve at 60 ticks; devolve at 240 ticks.
// New DEFAULT_HYSTERESIS (housingEvolution.ts:38-43): minSatisfiedTicks 60; toleranceTicks 90.
// 60 == 60 (evolve compatible), but 240 != 90 (devolve NOT compatible) — timing drift is expected.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 5-tier `HOUSE_TIERS` progression inside `tickHousing` (housing.ts:156-202) with `CONFIG.evolveWindowTicks`/`devolveWindowTicks` | 21-level `HOUSING_LEVELS` + pure `decideEvolution` with `DEFAULT_HYSTERESIS` (housingEvolution.ts:57-81) | Phase 16 (locked by CONTEXT) | 21 cumulative requirement stages; hysteresis on both sides; bridge to economy via live-stats table |
| `house.tier` = live progression state, read directly by economy/ratings/advisors | `house.level` (0–20) = live state; `house.tier` = derived 0–4 bucket + `HOUSING_LIVE_STATS[level]` for scalar values | Phase 16 | Additive; economy accurate across all 21 levels; consumers migrate in-place |
| Houses always 1×1, no merging (`BUILDINGS.house.footprint = 1`, buildings.ts:41-50) | Deterministic tick-driven merge to 2×2/3×3/4×4 per level (game.md §11.1/§11.3) | Phase 16 (net-new) | House lots grow; occupancy/registry management must stay replay-deterministic |
| House desirability gate on 0–200 `tierThreshold(tier*25)` (housing.ts:116-118) | Level comparison on normalized 1–20 `levelDesirability` | Phase 16 | Uniform contract with `HOUSING_LEVELS.desirability` |

**Deprecated/outdated:**
- `CONFIG.evolveWindowTicks` (60) is redundant with `DEFAULT_HYSTERESIS.minSatisfiedTicks` (60) — keep or alias, do not dual-tune. `CONFIG.devolveWindowTicks` (240) diverges from `toleranceTicks` (90); decide which governs devolution, and note it changes `bankruptcy.test.ts` timing.
- The legacy 5-tier `tickHousing` branch (`tierThreshold`, `evolveCounter`/`devolveCounter`, `TIER_CIVIC_GATES`) becomes dead once `house.level` drives decisions — keep the code additive-or-remove per the plan, but the **`house.tier` field itself must remain** (consumers still index it).
- `FOOD_VARIETY_REQUIREMENT` caps at level 5 (housingEvolution.ts:90-97) — fine for the food system's "blocking shortage" messaging, but not a 21-level variety ladder; don't confuse it with `requiresGoods` gating.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `HOUSING_LIVE_STATS` workers/tax-per-tick derivation from `HOUSING_LEVELS` (workers has no catalog column; taxPerCapita is per-month-per-resident, live tax is per-tick-per-house) | Standard Stack / Pattern 1 | Economy population/tax/worker magnitudes wrong or NaN; unit tests (economy/labor) need corresponding kitty updates — confirm exact conversion in discuss-phase |
| A2 | `levelDesirability` normalization mapping (recommend `round(desirability/10)` → 0–20) | Pattern 1 / Pitfall 2 | If wrong scale, desirability gate is either vacuous or unreachable — needs user confirmation of the intended pace |
| A3 | `satisfied` key mapping for `'forum'`/`'garden'`/`'senate'` uses a city-building-presence fallback (no per-house walker service exists) | Pattern 2 | High levels may evolve without real per-house access; or with strict per-house keys, those levels are unreachable — confirm precedence |
| A4 | Non-food goods use `cityGoodsAccess` (warehouse/route stock > 0) as the deterministic per-house proxy | Pattern 2 / Open Q3 | Without it the top half of the ladder is unreachable this phase; with a loose proxy, houses evolve without true home delivery — confirm |
| A5 | `'temple'`/`'grand_temple'` satisfied by any `godAccess` TTL; multi-god counts (2–3 cults) not expressible in current `requires` | Pattern 2 / Open Q4 | Religion-gated levels (11+/13+) may be under- or over-gated vs game.md §11.3 — confirm whether to extend the catalog with god-count fields |
| A6 | Merge footprint ladder from game.md §11.3 (1×1:0-10, 2×2:11-14, 3×3:15-18, 4×4:19-20); `HOUSING_LEVELS` has no footprint field | Pattern 4 | Wrong footprint ladder mis-sizes merge lots; catalog extension required — confirm against game.md §11.3 and that the catalog is the source of truth for the field |
| A7 | Merge runs every tick or monthly cadence and requires (same level, mergeable flag, block fits, no merge beyond 20); combined population = target-level capacity or sum | Pattern 4 | Oscillation/over-merge or under-merge; economy population jumps at merge — confirm cadence + population semantics |
| A8 | Golden regeneration is an acceptable intentional mechanic change (headers say "Regenerate intentionally on mechanic changes", tests/golden/golden.test.ts:13-14) | Pitfall 1 | If the project strictly forbids golden updates, the whole rewire contradicts Preservation-of-low-level behavior — confirm with user; no config.json sets policy |
| A9 | `consumeHouseFood`/`tickHouseFoodMemory` remain unwired (foodInventory only accumulates) unless goods-derivation requires them | Pattern 2 / Open Q3 | `foodInventory` monotonic growth means `hasFood` never expires → food-derived `satisfied` never devolves on food loss alone — decide whether to wire consumption in this phase |
| A10 | Retiring legacy `evolveCounter`/`devolveCounter`/`TIER_CIVIC_GATES` path is acceptable (additive-or-remove) | Pattern 3 | Unit tests that set old counters (civic-services.test.ts:91) must be updated or the fields kept — confirm removal scope |

## Open Questions

> All five questions are RESOLVED — the plan (16-PLAN.md) implements the recommendations below, with the desirability normalization updated to `clamp(0,30, round(x/6))` so the full 21-level ladder is satisfiable.

1. **Desirability normalization (A2)** *(RESOLVED — clamped to 0..30 so the full ladder is reachable)*
   - What we know: live scale 0–200 (`desirabilityOf`, housing.ts:68-113); catalog scale 1–20 (`HOUSING_LEVELS.desirability`); `decideEvolution` expects the catalog scale with ±5 padding/tolerance.
   - What's unclear: exact mapping (÷10 vs ÷`desirabilityThresholdPerTier`) and whether a house with zero services should ever evolve on terrain alone.
   - Recommendation: `levelDesirability = clamp(0,20, round(tileDesirability / 10))`; confirm in discuss-phase; unit-test boundaries (0, 200, 30=earth, 75=golden house).
   - **Resolution (plan 16-01-01):** `clamp(0,30, round(tileDesirability / 6))` — cap 30 (NOT 20) because `decideEvolution` requires `desirability >= next + 5` (level 20 needs 25); a cap-20 normalizer made levels 16-20 mathematically unreachable. Boundaries 0/5/13/17/30 for raw 0/30/75/101/200.
2. **`satisfied` assembly precedence / requirements-set semantics (A3/A5)** *(RESOLVED — deriveSatisfied per-house function in 16-01-01)*
   - What we know: `requirementsSatisfied` (housingEvolution.ts:50-55) requires **every** `requires`+`requiresGoods` key to be present in `satisfied`; live keys are wellness-level, catalog keys are building-level.
   - What's unclear: exact per-key derivation and whether `satisfied` should carry the requirement-key vocabulary (recommended: yes — populate only the union of `requires`+`requiresGoods`).
   - Recommendation: implement `deriveSatisfied` as a single pure function with the key map in Pattern 2; gate each mapping behind a line-item confirmation in discuss-phase.
   - **Resolution (plan 16-01-01):** `deriveSatisfied(house, buildings)` populates only the `requires`+`requiresGoods` union with the Pattern-2 key map (water→waterCooldown, market→food, wellness→SERVICE_BY_WALKER + city building present, temple→godAccess, civic→city presence, goods→foodInventory ∨ cityGoodsAccess).
3. **Non-food goods + foodInventory erosion (A4/A9)** *(RESOLVED — cityGoodsAccess proxy; goods devolution out of scope this phase)*
   - What we know: no live per-house non-food delivery; `foodInventory` never decays; `tools` marked `houseGood:false` but required at levels 15+.
   - What's unclear: whether to add `cityGoodsAccess` (proxy) or cap high levels until the distribution/trade phases; whether to wire consumption/memory.
   - Recommendation: proxy goods via deterministic city storage/route stock for this phase (so the ladder is reachable), document that real home delivery arrives with MARK/TRADE phases; flag the `tools` catalog inconsistency to DATA work.
   - **Resolution (plan 16-01-01/16-03-02):** `cityGoodsAccess` deterministic city-stock proxy (16-01-01); `tools` removed from levels 15-20 `requiresGoods` + validate gate (16-03-02); goods-derived `satisfied` is sticky this phase, so the devolve scenario inverts a service/desirability key, never a goods key (16-00-01/16-02-02).
4. **Multi-god / multi-service count requirements (A5)** *(RESOLVED — single-key any-god this phase, deferred)*
   - What we know: game.md §11.3 asks e.g. "acesso a dois cultos" and "três cultos"; `HOUSING_LEVELS.requires` has a single `'temple'`/`'grand_temple'` key.
   - What's unclear: whether to extend the catalog with god-count/min-service-count fields or keep single-key templated access.
   - Recommendation: stay single-key (any god) this phase; defer multi-god gating to a catalog extension tracked as a follow-up; note the deviation from game.md explicitly.
   - **Resolution (plan 16-01-01):** single-key `temple`/`grand_temple` satisfied by any active godAccess TTL; multi-god gating deferred to a catalog extension.
5. **Merge population arithmetic + cadence (A6/A7)** *(RESOLVED — monthly cadence, footprint ladder, combined population)*
   - What we know: CONTEXT says "the merged house producing the combined population"; merge is deterministic, block-fit over `occupiedTiles`; footprint ladder from game.md §11.3; catalog lacks footprint.
   - What's unclear: cadence (every tick vs monthly `% 40`), combined population (target capacity vs sum), whether both partners must be `>=` the level's desirability.
   - Recommendation: add `footprint` (and optionally `workers`) as an additive catalog field; run the merge on the monthly cadence to match the "1–3 month grace" scale and limit churn; population = sum of merged capacities (matches "combined population"); confirm exact block-fit rule (orthogonal-only vs 2×2 corner fill) in discuss-phase.
   - **Resolution (plan 16-02-01/16-02-02):** `footprint` ladder added to `HOUSING_LEVELS` (1×1:0-10, 2×2:11-14, 3×3:15-18, 4×4:19-20); merge on the `%40` monthly cadence in fixed placement-order scan; block-fit over `occupiedTiles` via `blockFits`/`findMergePartner`; survivor gains footprint + combined population + re-keyed occupancy; never above level 20.

## Environment Availability

> This phase is code + data + regenerated fixtures only — no new external services, databases, or CLIs. Existing toolchain verified.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | vitest/tsc/vite | ✓ | v20.20.1 | — |
| npm | install/test scripts | ✓ | 10.8.2 | — |
| TypeScript (tsc) | typecheck (`npm run typecheck`) | ✓ | 5.9.3 | — |
| Vitest | test suites (`npm run test`, `npm run test:unit`) | ✓ | 3.2.7 | — |
| ESLint | lint gate (`max-warnings 0`) | ✓ | (present) | — |
| Golden updater | `GOLDEN_UPDATE=1 vitest run tests/golden` | ✓ | — | Regenerate fixture files |
| Military check | `npm run check:military` | ✓ | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

> `.planning/config.json` does not exist — `workflow.nyquist_validation` is treated as enabled (absent = enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.7 |
| Config file | `vitest.config.ts` (present) |
| Quick run command | `npx vitest run <file> -x` |
| Full suite command | `npm run test` (or `npm run test:unit`) |
| Type gate | `npm run typecheck` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOUS-01 | 21-level cumulative progression wired in a live SimRunner city | integration | `npx vitest run tests/integration/housing-evolution-live.test.ts -x` | ❌ Wave 0 |
| HOUS-01 | `levelDesirability` normalization boundaries | unit | `npx vitest run tests/unit/housing-level-bridge.test.ts -x` | ❌ Wave 0 |
| HOUS-01 | Economy/population/tax/workers reflect `HOUSING_LIVE_STATS[level]` | unit | `npx vitest run tests/unit/economy.test.ts -x` | ✅ (update kitty to `level`) |
| HOUS-02 | Hysteresis: evolve at `minSatisfiedTicks`, no oscillation near boundary | unit | `npx vitest run tests/unit/housing-evolution.test.ts -x` | ✅ (pure engine, unchanged) |
| HOUS-02 | Devolve after `toleranceTicks`; grace resets on level change | unit/integration | `npx vitest run tests/unit/housing.test.ts -x` | ✅ (update timing asserts) |
| HOUS-02 | Merge block-fit + scan-order determinism (pure helpers) | unit | `npx vitest run tests/unit/housing-merge.test.ts -x` | ❌ Wave 0 |
| HOUS-02 | Merge + evolution replay byte-identical via save/load | determinism | `npx vitest run tests/determinism/housing-evolution-determinism.test.ts -x` | ❌ Wave 0 |
| HOUS-02 | Golden fixtures stable after intentional regeneration | golden | `npm run test:golden:update` then `npx vitest run tests/golden -x` | ✅ (regenerate) |

### Sampling Rate
- **Per task commit:** `npm run typecheck && npx vitest run <touched files> -x`
- **Per wave merge:** `npm run test:unit` (unit+integration+determinism+golden+property)
- **Phase gate:** full `npm run test` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/housing-level-bridge.test.ts` — desirability normalization + `HOUSING_LIVE_STATS` sanity (REQ HOUS-01)
- [ ] `tests/unit/housing-merge.test.ts` — pure block-fit/scan-order/occupancy transform (REQ HOUS-02)
- [ ] `tests/integration/housing-evolution-live.test.ts` — full 21-level city progression + devolution + enable merge (REQ HOUS-01/HOUS-02)
- [ ] `tests/determinism/housing-evolution-determinism.test.ts` — save/load replay with level change + merge + counters (REQ HOUS-02 determinism)
- Update: `tests/unit/housing.test.ts`, `tests/unit/civic-services.test.ts`, `tests/unit/economy.test.ts`, `tests/unit/labor.test.ts`, `tests/integration/health-education-entertainment.test.ts`, `tests/integration/bankruptcy.test.ts`, `tests/integration/food-chain.test.ts`, golden fixtures (regenerate)

## Security Domain

> No new external interfaces, network, or untrusted input in this phase. `security_enforcement` is enabled by default (no config.json), so the mapping below is provided for completeness; the phase's real "security" property is **deterministic state integrity** (byte-identical replay), already enforced by the determinism suites.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — no auth surface |
| V3 Session Management | no | n/a |
| V4 Access Control | no | SaveCommand distribution is internal `applyCommand` (runner.ts:2695-2728) |
| V5 Input Validation | partial | Catalog data validated at load (`data/validate.ts`); new `footprint`/`workers` catalog fields must be added to `validateCatalogs` (validate.ts:75-83 housing block) and to catalog tests |
| V6 Cryptography | no | no secrets/keys; only real risk is RNG/clock leakage in sim paths (forbidden — `tests/determinism` + military-absence-style scans) |

### Known Threat Patterns for {stack}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Non-determinism (Math.random/Date/new Date) in evolution/merge path | Tampering (state divergence) | Deterministic-only rule already enforced; add a regression in `tests/determinism` that replays a merged city and compares `getStateJson()` byte-identical |
| Unguarded array index on `house.tier` → NaN economy | Tampering | `HOUSING_LIVE_STATS` lookup with clamped level assertion (equivalent to advisors.ts:582 clamp) |
| Catalog inconsistency (`tools` houseGood:false vs requiresGoods) | — | Add a `requiresGoods ⊆ houseGood ∪ FOOD_TYPES` validation in `data/validate.ts` |

## Sources

### Primary (HIGH confidence — all read this session)
- `data/housing.ts` — `HOUSING_LEVELS` 21 levels (22-44), helpers (46-54), `TIER_CIVIC_GATES` (66-70)
- `src/sim/housingEvolution.ts` — `EvolutionInput` (13-23), `decideEvolution` (57-81), `DEFAULT_HYSTERESIS` (38-43), food-variety ladder (90-113)
- `src/sim/housing.ts` — `tickCivic` (34-54), `desirabilityOf` (68-113), `tierThreshold` (116-118), `tickHousing` (132-206), food inventory (218-401)
- `src/sim/config.ts` — `HOUSE_TIERS` (22-27), `CONFIG` (12)
- `data/balance.ts` — evolveWindow 60 / devolveWindow 240 / desirabilityThresholdPerTier 25 (47-51)
- `src/sim/economy.ts` — consumers at 21/52/73/95
- `src/sim/runner.ts` — tickHousing call (290-297), avgHousingLevel (914-920), patricianShare (923-929), place (1475-1512), house init (1489-1493), getState happiness (1589-1614), fromSaveData (2107-2123), toBuildingState (2632-2668), buildingAt/occupiedTiles (2568-2572), applyCommand (2695-2728), footprintsTouch (2730-2739)
- `src/sim/walkers.ts` — `SERVICE_BY_WALKER` (121-130), `HouseInstance` (88-109), service application (306-370), seller delivery (324-349)
- `src/sim/types.ts` — `SaveData` (92-103), `BuildingState.house` (120-137), `MessageType` (60)
- `src/sim/placement.ts` — occupancy checks (17-61)
- `src/sim/buildings.ts` — `house.footprint = 1` (41-50)
- `data/commodities.ts` — `houseGood` flags (23-216), `FOOD_TYPES` (218)
- `data/validate.ts` — housing validation (75-83)
- `game-specs/game.md` — §11.1 merge conditions (789-796), §11.3 footprint ladder (839-861), §11.4 patronage (863-885)
- `tests/golden/golden.test.ts` + both fixture JSONs — pinned 5-tier outcomes
- `tests/determinism/determinism.test.ts` — byte-identical replay contract
- `tests/unit/housing-evolution.test.ts`, `tests/unit/housing.test.ts`, `tests/unit/civic-services.test.ts`, `tests/integration/food-chain.test.ts`, `tests/integration/health-education-entertainment.test.ts`, `tests/integration/bankruptcy.test.ts`, `tests/unit/economy.test.ts`, `tests/unit/labor.test.ts`, `tests/balance-parity.test.ts`, `tests/data-catalog.test.ts`

### Secondary (MEDIUM confidence)
- `.planning/phases/12-*/12-SUMMARY.md`, `12-W1-SUMMARY.md`, `13-*/13-VERIFICATION.md`, `13-CONTEXT.md` — history of TIER_CIVIC_GATES and "21-level model arrives in Phase 16"
- `openspec/specs/agriculture-food/spec.md`, `desirability/spec.md` — high-level housing/desirability behavior statements (thin)

### Tertiary (LOW confidence — training knowledge, not fetched this session)
- Caesar III merge/FPP community knowledge (game-specs/game.md §11 is the in-repo surrogate used here); where used it is tagged `[ASSUMED]`/A-items. (WebSearch provider unavailable in this session; the design was grounded in the in-repo game doc + code conventions instead.)

## Metadata

**Confidence breakdown:**
- Standard stack (in-repo wiring): HIGH — every module and consumer verified by reading source this session.
- Architecture (bridge + merge design): MEDIUM — recommended structure grounded in verified code, but the five scale/key mappings and merge arithmetic are discretion-level and tagged in Open Questions/Assumptions.
- Pitfalls (goldens/tests/scale/economy): HIGH for the enumerated failure modes (all backed by read files/values); MERGENT design details remain MEDIUM/LOW.

**Research date:** 2026-08-05
**Valid until:** 2026-09-04 (stable in-repo domain; re-verify only if housing/evolution/merge modules or goldens change before planning)
