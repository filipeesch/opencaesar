# Phase 16: Full Housing Evolution — Pattern Map

**Mapped:** 2026-08-05
**Phase dir:** `.planning/phases/16-full-housing-evolution/`
**Files analyzed:** 20 new/modified files classified
**Analogs found:** 16 with matches / 20 total (4 are self-analogs on inspected files)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/sim/housingLive.ts` (NEW) | service (pure bridge) | transform + static lookup | `src/sim/economy.ts` | role-match |
| `src/sim/housingMerge.ts` (NEW) | service (pure transform) | transform (occupancy) | `src/sim/placement.ts` + `runner.ts:2730 footprintsTouch` | role-match |
| `src/sim/housing.ts` (MOD) | service (live tick engine) | transform (per-tick) | itself (`tickHousing` 132-206) + `housingEvolution.ts` | self-analog |
| `src/sim/economy.ts` (MOD) | service | CRUD/read | itself (consumers 21/52/73/95) | self-analog |
| `src/sim/advisors.ts` (MOD) | service (read-only derived) | read | itself (`foodOverlayGrids` 570-602, clamped lookup 582) | self-analog |
| `src/sim/runner.ts` (MOD) | controller/orchestrator | tick loop + serialization | itself (`tick()` 281-, `tickSafety` 388-, `toBuildingState` 2632) | self-analog |
| `src/sim/walkers.ts` (MOD) | model/type | state (additive fields) | itself (`HouseInstance` 88-109 additive optional fields) | self-analog |
| `src/sim/types.ts` (MOD) | model/type | serialization | itself (`MessageType` 60 union, `BuildingState.house` 120-137) | self-analog |
| `data/housing.ts` (MOD) | config/data catalog | static catalog | itself (`HOUSING_LEVELS` 22-44, `TIER_CIVIC_GATES` 66-70) | self-analog |
| `data/validate.ts` (MOD) | utility / config-validator | static validation | itself (`validateCatalogs` housing block 75-83) | self-analog |
| `tests/unit/housing-level-bridge.test.ts` (NEW) | test/unit | transform boundary | `tests/unit/housing-evolution.test.ts` | exact |
| `tests/unit/housing-merge.test.ts` (NEW) | test/unit | pure-helper transform | `tests/unit/housing.test.ts` (food-inventory helper tests 187-261) | role-match |
| `tests/integration/housing-evolution-live.test.ts` (NEW) | test/integration | live-city scenario | `tests/integration/health-education-entertainment.test.ts` | exact |
| `tests/determinism/housing-evolution-determinism.test.ts` (NEW) | test/determinism | replay/byte-identical | `tests/determinism/governance-determinism.test.ts` | exact |
| `tests/unit/housing.test.ts` (MOD) | test/unit | timing asserts | itself (devolve timing 139-152) | exact |
| `tests/unit/civic-services.test.ts` (MOD) | test/unit | 5-tier gate math | itself (87-117) | exact |
| `tests/unit/economy.test.ts` / `labor` / `happiness` / `advisors` (MOD) | test/unit | kitty `level` | itself (`mkHouse` 10-35) | exact |
| `tests/integration/health-education-entertainment.test.ts` (MOD) | test/integration | tier bounds | itself (`maxTier` 82-84) | exact |
| `tests/integration/bankruptcy.test.ts` (MOD) | test/integration | devolve window timing | itself | exact |
| `tests/integration/food-chain.test.ts` (MOD) | test/integration | message assert | itself (`house-evolved` 43) | exact |
| `tests/golden/fixtures/*.json` (REGEN) | test/golden | snapshot | `tests/golden/golden.test.ts` (GOLDEN_UPDATE gate) | exact |

---

## Pattern Assignments

### `src/sim/housingLive.ts` (service, transform/static-lookup) — NEW

**Analog:** `src/sim/economy.ts` — the repo's pure "bridge" module: pure functions over building state that the runner wires into the tick. `housingLive.ts` plays the identical role for the 21-level bridge.

**Why closest:** economy.ts is header-documented "Pure functions over building state — the runner wires them into the tick" (lines 1-4), which is exactly what `HOUSING_LIVE_STATS`/`levelDesirability`/`deriveSatisfied`/`tierOfLevel` are. The catalog-lookup helpers (`housingLevelName`/`housingCapacity` in `data/housing.ts:46-54`) are the single-source-of-truth precedent for the stats table. Line budgets and doc-comment style both match.

**Imports pattern** (economy.ts:6-8) — copy this module header + import shape:
```typescript
import { CONFIG, HOUSE_TIERS } from './config';
import type { Policy, Ratings } from './types';
import type { BuildingInstance } from './walkers';
```
Delta for the new file: import `HOUSING_LEVELS` from `../../data/housing` (see `housingEvolution.ts:11` — the exact cross-dir import used by the pure engine), and `CONFIG` from `./config` for the normalizer scale. `type`-only imports for `BuildingInstance`/`Map`.

**Export shape for the stats table** (data shape precedent: `HOUSING_LEVELS` entries at data/housing.ts:22-44 + `HOUSE_TIERS` at config.ts:22-27):
```typescript
export interface LiveHouseStats { population: number; workers: number; taxPerTick: number; }
export const HOUSING_LIVE_STATS: readonly LiveHouseStats[] = HOUSING_LEVELS.map((l) => ({ ... }));
```
Delta: derive `population` from `l.capacity` (data/housing.ts:8-11), `taxPerTick`/`workers` via discretion helpers. Keep it `readonly` like `HOUSE_TIERS` (config.ts:22) and `HOUSING_LEVELS` (data/housing.ts:22).

**Scale-normalization helper pattern** (analog: `tierThreshold`, housing.ts:116-118 — the existing pure number→threshold scalar):
```typescript
/** Desirability needed to reach the given 1-indexed tier (1..5). */
export function tierThreshold(tier: number): number {
  return tier * CONFIG.desirabilityThresholdPerTier;
}
```
Delta: write sibling `levelDesirability(tileDesirability: number): number` `clamp(0,20, Math.round(x/10))` (RESEARCH Pattern 1 / Open Q1 — the ÷10 mapping is the discuss-phase recommendation). Same pure pad/clamp style as `tierThreshold` and `clampCivic` (housing.ts:56-60).

**Bridge accessor pattern** (so consumers never index unguarded — precedent: advisors.ts:582 clamp):
```typescript
const pop = HOUSE_TIERS[Math.max(0, Math.min(HOUSE_TIERS.length - 1, b.house.tier))].population;
```
Delta: `tierOfLevel(level`buckets 0-4 for ratings (runner.ts:918/927 `HOUSE_TIERS.length` denominator stays valid) and a `liveStats(level)` accessor that clamps to `HOUSING_LIVE_STATS.length - 1`.

**deriveSatisfied contract** — align with `EvolutionInput.satisfied: string[]` (housingEvolution.ts:13-23) and `requirementsSatisfied` (housingEvolution.ts:50-55) which needs exactly the union of `requires`+`requiresGoods` keys. Populate ONLY those keys (RESEARCH Pattern 2 key map: `'well'|'fountain'`→`waterCooldown>0`, `'market'`→`foodCooldown>0|marketCoverage.lastFoodDelivery`, school/clinic/library/theatre/hospital/amphitheatre→`services` fresh keys, temple/grand_temple→`Object.keys(godAccess).length>0`, goods→`isFood(g) ? foodInventory : cityGoodsAccess`).

**Balance-parity guard** (data/balance.ts:7 + tests/balance-parity.test.ts:36-68): any new tuning scalar must be a `HOUSING_*`/`LEVEL_*`-prefixed module-local constant (no BALANCE-key collision, no `CONFIG.<new>` orphan).

---

### `src/sim/housingMerge.ts` (service, transform/occupancy) — NEW

**Analog:** `src/sim/placement.ts` — the repo's pure side-effect-free occupancy module ("Pure and side effect free: the caller (SimRunner) commits the placement only after this returns ok", placement.ts:1-7). Merge's `blockFits` shares placement's injected-`isOccupied` predicate style; `runner.ts:2730-2739 footprintsTouch` gives the footprint-axis geometry math.

**Why closest:** The RESEARCH recommendation (Anti-Pattern: "Merge as a rebuild-from-scratch footprint system: reuse occupiedTiles/tileKey/buildingAt") requires a pointer-pure helper that injects the occupancy map — placement.ts is the canonical example of exactly that injection pattern, and it is the only module that already reasons about n×n footprint squares over `occupiedTiles`.

**Imports pattern** (placement.ts:9-11):
```typescript
import { BUILDINGS } from './buildings';
import type { Map } from './map';
import type { BuildingType, PlacementResult } from './types';
```
Delta: import `HOUSING_LEVELS` from `../../data/housing` for `targetFootprint(level)` (2×2@11-14, 3×3@15-18, 4×4@19-20 — game-specs/game.md:839-861 ladder; catalog must first gain the field) and type-only `BuildingInstance` from `./walkers`.

**Occupancy-scan pattern to copy** (placement.ts:34-38 — the n×n inner double loop over a predicate):
```typescript
for (let dy = 0; dy < n; dy++) {
  for (let dx = 0; dx < n; dx++) {
    if (isOccupied(x + dx, y + dy)) return { ok: false, error: 'occupied' };
  }
}
```
Delta: `blockFits(a, b, want, occupied, tileKey)` scans the union rect (from `min(a.x,b.x)`..`+want`) and returns false if any tile is occupied by a non-merge id; the merging houses' own tiles are exempt.

**Overlap geometry precedent** (runner.ts:2730-2739 — `footprintsTouch`; copy this axis overlap math for the orthogonality check):
```typescript
function footprintsTouch(a: BuildingInstance, b: BuildingInstance): boolean {
  const ax2 = a.x + a.footprint - 1;
  const ay2 = a.y + a.footprint - 1;
  const bx2 = b.x + b.footprint - 1;
  const by2 = b.y + b.footprint - 1;
  if (a.x > bx2 + 1 || b.x > ax2 + 1) return false;
  if (a.y > by2 + 1 || b.y > ay2 + 1) return false;
  return !(a.x <= bx2 && b.x <= ax2 && a.y <= by2 && b.y <= ay2);
}
```
Delta: merge needs *orthogonal (non-overlapping) adjacency* — reuse the axis math but require gap==1 (edge-sharing), or reuse the `DIRS` orthogonal-neighbor iteration from walkers.ts:213-218 (`[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]`) anchored at the partner's tiles.

**Determinism by construction:** fixed scan order over `this.buildings` (placement order — the same guarantee walkers rely on, walkers.ts:187-189 "All buildings in placement order (stable iteration for deterministic tie-breaks)"). No RNG/clock in this file — matches the military-absence rule enforced in `tests/determinism/governance-determinism.test.ts:148-158`.

---

### `src/sim/housing.ts` (service, per-tick transform) — MODIFIED

**Analog:** itself — but the *wiring target* `decideEvolution`/`DEFAULT_HYSTERESIS`/`EvolutionInput` live in `src/sim/housingEvolution.ts:38-81` (pure, already unit-tested — do NOT rewrite it).

**Core loop to preserve & rewire** (housing.ts:143-205) — copy the per-house loop skeleton verbatim, replacing the 5-tier evolve/devolve decision blocks (162-192, 193-202) with the `decideEvolution` call:
```typescript
for (const b of buildings) {
  const house = b.house;
  if (!house) continue;
  house.foodCooldown = Math.max(0, house.foodCooldown - 1);
  house.waterCooldown = Math.max(0, house.waterCooldown - 1);
  house.laborCooldown = Math.max(0, house.laborCooldown - 1);
  tickCivic(house);
  const hasFood = house.foodCooldown > 0;
  const hasWater = house.waterCooldown > 0;
  const hasLabor = house.laborCooldown > 0;
  ...
}
```

**Emit/measure pattern to preserve** (housing.ts:156-202 — the `evolved`/`devolved` counters and message emission are golden-pinned):
```typescript
house.evolveCounter = 0;
house.devolveCounter += 1;
if (house.devolveCounter >= CONFIG.devolveWindowTicks && house.tier > 0) {
  house.tier -= 1;
  house.devolveCounter = 0;
  devolved += 1;
  emit('house-devolved', `House devolved to ${HOUSE_TIERS[house.tier].name}`);
}
```
Delta: message text swaps `HOUSE_TIERS[house.tier].name` → `housingLevelName(house.level)` (housing.ts:182/171 + data/housing.ts:46-49), the counter thresholds swap `CONFIG.devolveWindowTicks`→`DEFAULT_HYSTERESIS.toleranceTicks` and `CONFIG.evolveWindowTicks`→`minSatisfiedTicks`, and `house.tier` becomes a *derived* `house.tier = tierOfLevel(house.level)` assignment (kept for consumers). Keep `evolveCounter`/`devolveCounter` additive-or-remove per the RESEARCH A10 note; do NOT index `HOUSE_TIERS[house.tier]` with a level-valued field (RESEARCH Pitfall 3 — economy.ts reads it unguarded).

**New wiring to insert inside the loop** (imports: `decideEvolution, DEFAULT_HYSTERESIS` from `./housingEvolution`, `housingLevelName` from `../../data/housing`; the `deriveSatisfied`/`levelDesirability`/`tierOfLevel` imports from `./housingLive`):
```typescript
const action = decideEvolution({
  currentLevel: house.level,
  satisfied: deriveSatisfied(house, ctx),
  desirability: levelDesirability(desirabilityOf(map, b.x, b.y, policy, wagesUnpaid, {...}, arrearsDepth)),
  satisfiedTicks: house.satisfiedTicks,
  unsatisfiedTicks: house.unsatisfiedTicks,
}, DEFAULT_HYSTERESIS);
```
Evolve/devolve branches: `house.level += 1` / `-= 1`, then **reset the opposite counter + clear both** (`house.satisfiedTicks = 0; house.unsatisfiedTicks = 0;`) per CONTEXT grace-period rule (housingEvolution.ts:57-81 semantics + CONTEXT "after any level change, reset the opposite counter").

**Counter increment rule** (HOUS-02, before the decide call each tick): if `requirementsSatisfied(nextLevel, satisfied) && levelDesirability(...) >= next.desirability` → `satisfiedTicks++ / unsatisfiedTicks=0`, else flip. Deterministic from tick history only — never wall-clock (contrast with the walker TTL decay above which is per-tick — both deterministic).

**Desirability gating caveat (RESEARCH Pitfall 2):** desirability *must* pass through `levelDesirability` before `decideEvolution` — raw 0-200 (housing.ts:68-113, base earth=30) would make the padded requirement (max 25) vacuous.

---

### `src/sim/runner.ts` (controller/orchestrator, tick + serialization) — MODIFIED

**Analog:** itself. Four distinct edit sites, each has an in-file precedent to copy.

**1. House init** (runner.ts:1489-1493) — copy + extend:
```typescript
if (type === 'house') {
  building.house = { tier: 0, foodCooldown: 0, waterCooldown: 0, laborCooldown: 0, evolveCounter: 0, devolveCounter: 0 };
}
```
Delta: `level: 0, satisfiedTicks: 0, unsatisfiedTicks: 0, mergeable: true` (RESEARCH architecture step 1). `footprint: def.footprint` stays 1 (buildings.ts:41-50) — merge mutates it at runtime.

**2. Merge step cadence** — add a private `this.tickHousingMerge()` invoked from `tick()` right after `tickHousing(...)` (runner.ts:290-297). Copy the cadence-step placement pattern from the existing month-bound steps:
```typescript
if (this.tickCount % 40 === 0) this.tickRequests();   // runner.ts:362
...
this.tickTradeSystem();   // runner.ts:368
...
this.tickSafety();        // runner.ts:374
```
Delta: monthly cadence (`if (this.tickCount % 40 === 0) this.tickHousingMerge();`) matches the "1-3 month grace" language (RESEARCH Pattern 4 / Open Q5). Make `tickHousingMerge()` structurally mirror `private tickSafety()` (runner.ts:388-425): iterate `this.buildings` in order, mutate `occupiedTiles`/`buildingById`/`buildings` in place. **Reuse** `this.tileKey` (runner.ts:2686-2689), `this.buildingAt` (2568-2572), `this.emitMessage` (2618-2623) — do not introduce a second occupancy representation.

**3. toBuildingState additive fields** (runner.ts:2632-2652) — copy the house-builder IIFE and add `level`/`levelName`:
```typescript
const h: NonNullable<BuildingState['house']> = {
  tier: b.house!.tier,
  tierName: HOUSE_TIERS[b.house!.tier].name,
  populationCapacity: HOUSE_TIERS[b.house!.tier].population,
  foodCooldown: b.house!.foodCooldown,
  ...
};
```
Delta: change `populationCapacity`/`tierName` source to `HOUSING_LIVE_STATS[b.house!.level]`/`housingLevelName(b.house!.level)` (additive `level`/`levelName` keys; optional-if-undefined pattern mirrors `b.god !== undefined ? { god: b.god } : {}` at 2665). This is the golden-pinned serialized surface — RESEARCH Pitfall 1.

**4. RATE-01 consumers** (runner.ts:913-929) — `avgHousingLevel` (918 `sum += b.house!.tier`) and `patricianShare` (927 `tier >= 3`): keep reading the derived `house.tier` bucket (tierOfLevel) so the `HOUSE_TIERS.length` normalizer (919) and the `tier >= 3` Domus+ bar stay valid. **getState happiness weighting** (runner.ts:1594 `HOUSE_TIERS[b.house!.tier].population`) → `HOUSING_LIVE_STATS[b.house!.level].population.value` via the clamped bridge accessor (monotonic under merge — typology note in plan).

---

### `src/sim/economy.ts` (service, CRUD/read) — MODIFIED

**Analog:** itself. The three scalar consumers must switch `HOUSE_TIERS[tier]` → `HOUSING_LIVE_STATS[level]` through the single clamped bridge accessor (never inline-index — RESEARCH Pitfall 3):

| Site | Copy this | Replace with |
|------|-----------|--------------|
| economy.ts:21 | `if (b.house && b.house.laborCooldown > 0) total += HOUSE_TIERS[b.house.tier].workers;` | `liveStats(b.house.level).workers` (inside the `laborCooldown > 0` guard) |
| economy.ts:52 | `if (b.house) taxIncome += HOUSE_TIERS[b.house.tier].taxPerTick * policy.taxRate;` | `liveStats(b.house.level).taxPerTick * policy.taxRate` |
| economy.ts:73 | `if (b.house) total += HOUSE_TIERS[b.house.tier].population;` | `liveStats(b.house.level).population` |
| economy.ts:95 | `tierSum += b.house.tier + 1;` | unchanged — keep the derived 0-4 `tier` bucket so `HOUSE_TIERS.length` normalization (99) holds |

Delta: import `HOUSING_LIVE_STATS` (or the accessor) from `./housingLive` alongside the existing `./config` import (economy.ts:6). Include a defensive clamp in the accessor (don't let a level ≥ array length return `undefined` — the file currently has no clamp, RESEARCH Pitfall 3).

---

### `src/sim/advisors.ts` (service, read-only derived) — MODIFIED

**Analog:** itself. `foodOverlayGrids` at advisors.ts:570-602 already indexes `HOUSE_TIERS` *with a clamp* (582) for the food-days projection — this is the bridge precedent:
```typescript
const pop = HOUSE_TIERS[Math.max(0, Math.min(HOUSE_TIERS.length - 1, b.house.tier))].population;
```
Delta: route `pop` through `HOUSING_LIVE_STATS[...].population` using the same clamped-accessor shape, so the food-days estimate scales with the 21-level population. Note the advisor reads `foodInventory` directly (579-584) — the goods side of `deriveSatisfied` can reuse the same inventory source.

---

### `src/sim/walkers.ts` (model/type, additive fields) — MODIFIED

**Analog:** itself. `HouseInstance` (walkers.ts:88-109) already uses the additive-optional-field convention for exactly this kind of bridge state — `services`, `godAccess`, `foodInventory`, `marketCoverage`, `civic` are all `?`-optional, internal, and deliberately NOT serialized (doc comments at 96-100 / 105-108). Copy that convention for the new fields:
```typescript
/** Service access delivered by walkers (health/literacy/religion/entertainment). */
services?: Partial<Record<string, number>>;
```
Delta additions: `level: number` (0-20, required — LIVE state), `satisfiedTicks: number`, `unsatisfiedTicks: number`, `mergeable: boolean` (Counter fields required in the init object runner.ts:1490). Mark counters "Internal only — never serialized" per the same comment discipline. Those counters are deterministic from tick history (CONTEXT) — no wall-clock.

---

### `src/sim/types.ts` (model/type, serialization) — MODIFIED

**Analog:** itself. Two additive edits, both with in-file precedent:

1. `MessageType` (types.ts:60) is an additive union — prior phases appended types the same way:
```typescript
export type MessageType = 'building-inactive' | 'building-active' | 'house-evolved' | 'house-devolved' | 'warning';
```
Delta: append `'house-merged'` (RESEARCH Pattern 4 item 7). Any exhaustive `switch` on MessageType inside the browser renderer must be updated (search `house-devolved` consumers before editing).

2. `BuildingState.house` (types.ts:120-137) — copy the optional-field convention and add `level`/`levelName` (additive, serialized → goldens):
```typescript
house?: {
  tier: number;
  tierName: string;
  populationCapacity: number;
  ...
  /** Current desirability of the house tile (same value the evolution logic uses). */
  desirability: number;
  ...
};
```
Delta: `level: number; levelName: string;` — populated in `toBuildingState` (runner.ts:2632). `populationCapacity` semantics change from 5-tier to level-capacity (golden regeneration is intentional — RESEARCH Pitfall 1).

---

### `data/housing.ts` (config/data catalog) — MODIFIED

**Analog:** itself. `HousingLevelDef` (data/housing.ts:7-20) + `HOUSING_LEVELS` (22-44) use additive field conventions already proven by `TIER_CIVIC_GATES` (66-70). Delta:
```typescript
export interface HousingLevelDef {
  level: number;
  name: string;
  capacity: number;
  taxPerCapita: number;
  /** Services required to reach this level (service keys). */
  requires: string[];
  /** Goods required to reach this level (commodity ids). */
  requiresGoods: string[];
  /** Desirability contribution of a house at this level. */
  desirability: number;
  /** Square footprint in tiles (n x n) — merge ladder, game.md §11.3. ADDITIVE NEW. */
  footprint: number;
  // optional: workers: number;  (DISCRETION — RESEARCH A1)
}
```
Ladder values from game-specs/game.md:839-861 — 1×1:0-10, 2×2:11-14, 3×3:15-18, 4×4:19-20. Keep additive so the existing `tests/data-catalog.test.ts` housing assertions (lines 26-30: ascending, bounded, `housingCapacity(5) > 0`) stay green; extend them for footprint monotonicity.

---

### `data/validate.ts` (utility/config-validator) — MODIFIED

**Analog:** itself. Copy the housing block (data/validate.ts:75-83) and extend with the Phase-16 constraints (RESEARCH Validation Architecture + Pitfall 5 / Security V5):
```typescript
for (let i = 0; i < HOUSING_LEVELS.length; i++) {
  const lvl = HOUSING_LEVELS[i];
  if (lvl.capacity < 0) { issues.push({...}); }
  if (i > 0 && HOUSING_LEVELS[i - 1].level >= lvl.level) { issues.push({...}); }
}
```
Delta additions in the same `issues.push({ catalog: 'housing', message: ... })` style: (a) `lvl.footprint` finite positive; (b) footprint non-decreasing across the ladder; (c) **catalog-consistency gate** `requiresGoods` ⊆ `FOOD_TYPES ∪ { g | COMMODITIES[g]?.houseGood }` — this catches the known `tools` (houseGood:false, data/commodities.ts:204-215) vs `HOUSING_LEVELS[15..20].requiresGoods` mismatch and forces the RESEARCH Pitfall 5 decision (proxy vs cap). Import `FOOD_TYPES`/`COMMODITIES` (both already imported at validate.ts:6-7).

---

## Test Pattern Assignments

### `tests/unit/housing-level-bridge.test.ts` (unit, transform boundary) — NEW

**Analog:** `tests/unit/housing-evolution.test.ts` — exact style: pure-function imports, a `CFG = DEFAULT_HYSTERESIS` constant, small boundary cases. Copy:
```typescript
import { describe, it, expect } from 'vitest';
import { decideEvolution, DEFAULT_HYSTERESIS } from '../../src/sim/housingEvolution';
// lines 1-3, line 5: const CFG = DEFAULT_HYSTERESIS;
// lines 8-14: it('evolves when next-level requirements and desirability are met ...', () => { ... })
```
Delta: import `levelDesirability, tierOfLevel, HOUSING_LIVE_STATS` from `../../src/sim/housingLive`; assert (RESEARCH Validation map HOUS-01): `HOUSING_LIVE_STATS.length === 21`, monotonic population, `levelDesirability` boundaries `(0→0, 200→20, 30→3, 75→8, 101→10)`, `tierOfLevel` buckets 0-4, bridge accessor clamps. Add the desirability-normalization boundary tests in the same `describe` shape as housing.test.ts:49-75 (`expect(...).toBe(N)`).

### `tests/unit/housing-merge.test.ts` (unit, pure-helper transform) — NEW

**Analog:** `tests/unit/housing.test.ts` food-inventory helper tests (187-261) — the repo's pattern for testing a pure helper with directly-constructed `BuildingInstance` fixtures. Copy the `mkHouse` factory:
```typescript
function mkHouse(tier: number, overrides: Partial<BuildingInstance['house']> = {}): BuildingInstance {
  return { id: 1, type: 'house', x: 1, y: 1, footprint: 1, ..., house: { tier, foodCooldown: 0, ..., ...overrides } };
}
// housing.test.ts:13-37
```
Delta: build two adjacent 1×1 `mkHouse` fixtures + a `Map<number,id>` occupied-tiles map using the same `(x << 20) | y` key (runner.ts:2686-2689); assert `targetFootprint(5)=1`, `targetFootprint(11)=2`, `targetFootprint(15)=3`, `targetFootprint(19)=4`; assert `blockFits` true for an empty 2×2 block and false when a third building occupies a tile; assert scan-order determinism (identical result for identical input array order; differing order → same survivor id set consistent with array order).

### `tests/integration/housing-evolution-live.test.ts` (integration, live-city) — NEW

**Analog:** `tests/integration/health-education-entertainment.test.ts` — exact: custom map builder (`civicCity` at 12-38: `SimMap.fromLayout` + road grid + farm/granary/market/well + `requestRoyalSubsidy` + `placeBuilding` throw-on-error) + a runner-inspection helper (`maxTier` at 82-84) + `describe` blocks of `for (let i = 0; i < 500; i++) r.tick();` with tier-bound asserts. Copy:
```typescript
function maxTier(r: SimRunner): number {
  return Math.max(...houses(r).map((b) => b.house!.tier));
}
// lines 82-84; the map builder lines 12-38 (throw on place failure at 33-35)
```
Delta: add `maxLevel(r)` reading `b.house!.level`; HOUS-01 scenario asserting full 21-level progression when cumulative goods/services/religion/desirability are all present for ≥ `minSatisfiedTicks`; HOUS-02 devolution after `toleranceTicks` of a removed requirement; a merge-enabled city asserting `house-level` changes, survivor `footprint` growth, `occupiedTiles` re-key, and combined population. Assert the `'house-merged'` message like food-chain.test.ts:43 (`state.messages.some((m) => m.type === 'house-evolved')`).

### `tests/determinism/housing-evolution-determinism.test.ts` (determinism, replay) — NEW

**Analog:** `tests/determinism/governance-determinism.test.ts` — the exact template for a Phase determinism suite: chunked-run helper (48-72), save→load replay (99-145), and the Math.random/Date.now absence file-scope assertion (148-158). Copy:
```typescript
function chunkedGovRun(seed: number, chunk: number, total: number, ...): string {
  const r = new SimRunner(seed, govMap());
  ... setup ...
  while (ticked < total) {
    const n = Math.min(chunk, total - ticked);
    for (let i = 0; i < n; i++) r.tick();
    ticked += n;
  }
  return r.getStateJson();
}
// lines 48-72; expect(a).toBe(b); expect(b).toBe(c);  (chunks 1/7/50, lines 76-83)

// save→load (lines 137-140):
const loaded = SimRunner.fromSaveData(r.getSaveData());
expect(loaded.getStateJson()).toBe(r.getStateJson());

// absence check (lines 149-157):
expect(/Math\.random\s*\(/.test(src)).toBe(false);  // + Date.now + new Date
```
Delta: build a housing city that reaches several levels AND triggers a merge; assert byte-identical `getStateJson()` across chunks 1/7/50, across save→load round-trip (counters `satisfiedTicks`/`unsatisfiedTicks` included), and the no-`Math.random`/`Date` scan over `src/sim/housing.ts`, `src/sim/housingLive.ts`, `src/sim/housingMerge.ts`, `data/housing.ts`.

### Modified existing tests (deltas only — keep existing structure)

| File | Copy/keep | Delta |
|------|-----------|-------|
| `tests/unit/housing.test.ts` | `mkHouse` (13-37), `makeEmitter` (43-47), devolve block (139-152) | re-time devolve to `DEFAULT_HYSTERESIS.toleranceTicks` (90): devolve at tick 90 not 240; `mkHouse` gains `level`; asserts on `house.level` + `housingLevelName` in messages |
| `tests/unit/civic-services.test.ts` | `stubHouse` (11-20), `evolveOneTick` (33-49), `gateMap` (23-31) | `evolveCounter: 59` → `satisfiedTicks: minSatisfiedTicks-1/60`; `tierThreshold(4)=100` gate → `levelDesirability(≈101)=10` vs level-requirement check; TIER_CIVIC_GATES assert (84) retained if path kept |
| `tests/unit/economy.test.ts` | `mkHouse` (10-35) with `house:` overrides | kitty sets `level` (e.g. `{ level: 2 }`) alongside `tier`; expected workers/tax/pop values re-derived from `HOUSING_LIVE_STATS` |
| `tests/unit/labor.test.ts`, `happiness.test.ts`, `advisors.test.ts` | `{ tier: N }` kitty constructions | add consistent `level` (RESEARCH Pitfall 4 / Research §"tests/behavioral assertions") |
| `tests/integration/health-education-entertainment.test.ts` | `maxTier` (82-84), gate describes (125-143) | keep monotonic bounds (`>=3` with clinic, `<=2` without) — validate the level→tier mapping preserves them; add `maxLevel` if asserting level-facing values |
| `tests/integration/bankruptcy.test.ts` | arrears + devolve-window logic | align devolution trigger to `toleranceTicks` (90), not `devolveWindowTicks` (240) |
| `tests/integration/food-chain.test.ts` | line 43 `state.messages.some((m) => m.type === 'house-evolved')` | keep assert; expectations on reachable level shrink (no fountain/pottery → caps below Insula under 21-level rules) |
| `tests/golden/fixtures/*.json` | `golden.test.ts` (GOLDEN_UPDATE gate) | **regenerate intentionally** (RESEARCH Pitfall 1 / A8) — see Shared Patterns |

---

## Shared Patterns

### Golden regeneration (apply to: fixture regeneration task)
**Source:** `tests/golden/golden.test.ts:16-38` + `package.json` script `"test:golden:update": "GOLDEN_UPDATE=1 vitest run tests/golden"`.
**Pattern:** the golden test re-derives state from `runScenario(12345, foodChainMap(), ...)` (lines 18-27); when `process.env.GOLDEN_UPDATE` is set (29-33) it writes the fixture instead of comparing. Regeneration = intentional mechanic change (header lines 12-15). The pinned 5-tier values that WILL change: `tier: 2`/`tierName: "Insula"`/`populationCapacity: 20`/`desirability: 75`/`happiness: 69` in both fixtures, and `house-evolved` message ticks (143/149/161/203/209/221/251/311 in food-chain-golden.json) — because the food-chain city cannot hold an Insula under 21-level cumulative requirements and `toleranceTicks` (90) ≠ `devolveWindowTicks` (240).

```typescript
if (process.env.GOLDEN_UPDATE) {
  mkdirSync(dirname(fixturePath), { recursive: true });
  writeFileSync(fixturePath, JSON.stringify(state, null, 2) + '\n');
  return;
}
```
Command: `npm run test:golden:update` then `npx vitest run tests/golden -x` (from package.json scripts).

### Determinism / no-RNG rule (apply to: housingLive.ts, housingMerge.ts, housing.ts wiring, runner merge step)
**Source:** `tests/determinism/governance-determinism.test.ts:148-158` + `tests/determinism/determinism.test.ts:15-17` (byte-identical `getStateJson()`). Busin: no `Math.random()`/`Date.now()`/`new Date()` in any Phase-16 sim path; the merge + counters depend only on tick history and placement-ordered `buildings` iteration (walkers.ts:187-189). After regeneration, keep the determinism suites green — they pin behavioral equivalence, not values.

### Clamped bridge accessor (apply to: economy.ts:21/52/73, advisors.ts:582, runner.ts:1594)
**Source:** `src/sim/advisors.ts:582` — the repo's only guarded `HOUSE_TIERS` index:
```typescript
const pop = HOUSE_TIERS[Math.max(0, Math.min(HOUSE_TIERS.length - 1, b.house.tier))].population;
```
All new `HOUSING_LIVE_STATS[level]` reads must go through a clamped accessor in `housingLive.ts` (never bare-index — RESEARCH Pitfall 3: economy.ts would silently produce `NaN`).

### Additive MessageType + emit (apply to: housing.ts evolve/devolve, merge step)
**Source:** `types.ts:60` (union), `runner.ts:2618-2623` (`emitMessage`), `housing.ts:171/182/200` (emit call sites). New `'house-merged'` is additive to the union; emit with `emit('house-merged', 'House merged to ${housingLevelName(level)}')`. Any exhaustive MessageType switch in the browser layer must be updated (grep `house-devolved` first).

### Catalog validation discipline (apply to: data/housing.ts + deriveSatisfied goods keys)
**Source:** `data/validate.ts:75-83` housing block + `tests/data-catalog.test.ts:26-30`. New `footprint`/`workers` fields must be added to `validateCatalogs` and to catalog tests; the `requiresGoods ⊆ FOOD_TYPES ∪ houseGood` consistency gate (validate.ts style `issues.push({ catalog: 'housing', message })`) forces the RESEARCH Pitfall 5 decision on `tools` and non-food delivery.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/sim/housingMerge.ts` (block-fit/scan-order internals) | service | transform (occupancy) | Merge is net-new — no existing module mutates `occupiedTiles` registry wholesale. PLANNER: use `placement.ts` for the pure injected-predicate + occupancy-loop patterns, `runner.ts footprintsTouch` (2730) for axis geometry, and `runner.ts tickSafety` (388) for the runner-owned in-place mutation skeleton. |
| `src/sim/housingLive.ts` (`deriveSatisfied` specifically) | service | transform | No existing module derives a per-house `satisfied[string[]]` from live service/goods state; the assembly is net-new. PLANNER: reference RESEARCH Pattern 2 key map + live field sources (walkers.ts:88-109, 121-130, 306-370) — do not invent a second service model. |

## Metadata

**Analog search scope:** `src/sim/*` (housing, housingEvolution, economy, runner, walkers, types, config, buildings, placement, advisors, safety), `data/*` (housing, validate, commodities, balance), `tests/{unit,integration,determinism,golden}/*`, `game-specs/game.md` §11.
**Files scanned:** 25 (14 source, 11 test/golden)
**Pattern extraction date:** 2026-08-05
