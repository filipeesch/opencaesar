# Phase 16: Full Housing Evolution - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous, user accepted all recommended answers)

<domain>
## Phase Boundary

Deliver a full data-driven 21-level housing progression (0 vacant lot → 20 luxury
villa) with cumulative requirements (goods + services + religion + desirability),
sustained-period evolution, tolerance-based devolution with hysteresis, and
compatible adjacent houses merging into larger lots when the block allows.
Covers HOUS-01, HOUS-02.

</domain>

<decisions>
## Implementation Decisions

### 21-Level Progression & Live Integration (HOUS-01)
- Houses evolve only when ALL cumulative requirements (goods + services + religion + desirability) of the target level are met for the minimum eligibility period (`minSatisfiedTicks`), per the existing `decideEvolution` in `src/sim/housingEvolution.ts`.
- The 21-level catalog in `data/housing.ts` (`HOUSING_LEVELS`, 0-20 with `requires`/`requiresGoods`/`desirability`) is the single source of truth; the live house updates its level through `decideEvolution` rather than the 5-tier `house.tier` shortcut.
- Bridge to the existing live model: `HOUSING_LEVELS[level]` supplies capacity/tax/desirability so the 5-tier `HOUSE_TIERS` consumers (economy population/tax/workers, ratings housing factor, advisors) keep working — either by mapping level→tier or by extending house state with a `level` field that these consumers read. Additive: existing 5-tier behavior for levels ≤ 5 is preserved or mapped cleanly.
- `satisfied` inputs to `decideEvolution` are derived from the live house state: fresh service access (health/literacy/entertainment + food/water/labor cooldowns + godAccess religion), goods (food inventory/foodMemory + trade goods access), and desirability (`desirabilityOf`).

### Hysteresis & Devolution (HOUS-02)
- Devolve after tolerance loss: requirements missing (or desirability below the current level's tolerance) for `toleranceTicks`; `DEFAULT_HYSTERESIS` (evolveDesirabilityPadding 5, devolveDesirabilityTolerance 5, minSatisfiedTicks 60, toleranceTicks 90) is the baseline.
- Grace period prevents oscillation: after any level change, reset the opposite counter (evolve clears devolve counter and vice versa), and hysteresis padding/tolerance keep evolve/devolve thresholds separated so a house cannot bounce repeatedly.
- Counters (`satisfiedTicks`/`unsatisfiedTicks` per house) are deterministic from tick history, not wall-clock; save/load replay reproduces them byte-identically.

### House Merging (HOUS-02)
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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `data/housing.ts`: `HOUSING_LEVELS` (21 levels 0-20, each with capacity/taxPerCapita/requires/requiresGoods/desirability), `housingLevelName`, `housingCapacity`, `TIER_CIVIC_GATES`.
- `src/sim/housingEvolution.ts`: `EvolutionInput`, `decideEvolution` (evolve/devolve with hysteresis), `DEFAULT_HYSTERESIS`, `FOOD_VARIETY_REQUIREMENT`, `foodVarietyRequired`, `varietyBlocksEvolution` — pure logic, currently only used by tests.
- `src/sim/housing.ts`: `tickHousing` (5-tier evolution w/ food/water/labor cooldowns + desirabilityOf), `desirabilityOf` (0-200), `tierThreshold` (tier * CONFIG.desirabilityThresholdPerTier), `tickCivic`, house food inventory (`HouseFoodInventory`, `foodVariety`, `deliverToHouse`, `houseFoodState`, `foodShortageEffects`), `HOUSE_FOOD_CAPACITY`, `FOOD_MEMORY_DAYS`, `FOOD_REGRESSION_TOLERANCE_DAYS`.
- `src/sim/config.ts`: `HOUSE_TIERS` (5-tier), CONFIG.desirabilityThresholdPerTier/evolveWindowTicks/devolveWindowTicks.
- `src/sim/runner.ts`: `tickHousing(...)` call at ~290, `getHousing()`/house-level stats (~1592), `getCivilizationOverlay` housing, economy consumers at economy.ts (population HOUSingTier, tax, workers).
- Tests: `tests/integration/food-slice.test.ts` (uses decideEvolution), `tests/unit/housing*.test.ts`, golden tests (evolution behavior may be pinned).

### Established Patterns
- Deterministic-only sim: no Math.random()/Date.now()/new Date() in sim paths; SimState/getStateJson() byte-identical replay; additive-only API changes; goldens untouched.
- Month cadence tickCount % 40 === 0; year = floor(tick/360); ledger resets at tick 360.
- Data-driven catalogs with validation (validateCatalogs()), balance-parity CONFIG.<key> rule for data/balance.ts constants (prefer module-local).
- New player surfaces are replayable SaveCommands; house state extends BuildingInstance.house (see runner.ts:1489 house init).

### Integration Points
- `tickHousing` (housing.ts) — evolve the decideEvolution wiring in place of (or alongside) the 5-tier threshold logic.
- `house` BuildingInstance state — add level/mergeable/counter fields; init at runner.ts:1489.
- Economy/population/tax/ratings consumers of house.tier (economy.ts:21/52/69, runner.ts:913/918/927/1592, advisors.ts:582) — keep consistent via mapping.
- Runner tick — add the deterministic merge step and feed satisfied/desirability inputs to decideEvolution.

</code_context>

<specifics>
## Specific Ideas

- Success criteria to honor: (1) houses evolve only when all cumulative goods/services/religion/desirability are met for the minimum period; (2) houses devolve after tolerance loss, hysteresis prevents oscillation; (3) compatible adjacent houses merge into larger lots when blocks allow.
- The existing `decideEvolution` + `HOUSING_LEVELS` + hysteresis data are already in the repo (from earlier scaffolding) — this phase wires them into the live sim and adds merging.
- `HOUSING_LEVELS` already encode cumulative required goods/services per level; desirability is per level 1..20.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>
