---
phase: 05-agriculture-food
plan: 05-01
subsystem: simulation
tags: [food-supply-chain, loads, granary, market, housing, trade, advisor, sim-core, deterministic]

requires:
  - phase: 01-core-data
    provides: seeded RNG, SimRunner, map/road graph, buildings registry, walker lifecycle
  - phase: 03-road-graph-walker-categories
    provides: road pathfinding, walker profiles, roadblock permissions
provides:
  - Physical-load production model: fertility × worker-ratio production formula, output-stock loads (1 load = 100 units, 25-unit dispatch gate), full farm stop-reason vocabulary, fishing wharf/boat voyage state machine
  - Physical-load state machine (CREATED→…→CONSUMED/SPOILED/CANCELLED) with invalid-transition dev errors and cancellation returning product to source
  - Granary food hub: shared 3,200-unit capacity, per-food orders (accept/refuse/request/maintain/empty/reserve/max), stock classes (physical/available/reserved/incoming/outgoing/spoiled), transactional no-double-pick reservations with expiry, granary→granary transfer with ping-pong/cooldown guards, deterministic serialize/deserialize
  - Market model: demand calc, food-choice order, explainable supplier scoring, worker-efficiency agent scaling, seller multi-food load composition, per-market service policy, per-house coverage bookkeeping
  - House food model: per-food inventory, daily consumption, basic-first-but-any-food-sustains, variety from stock/memory, 30-day memory + regression tolerance, class storage capacity, shortage effects (stop evolution / mood·health / regression/emigration/crime)
  - Trade with urban reserves: exportable surplus formula, export-above-reserve, dangerous-export warning with options, import destination priority
  - Management UI data surface: HUD months-of-food indicator (icon+text+band, never colour-only), per-food advisor table, bottlenecks, overlays, grouped alerts — all live-sim-derived, wired into HUDScene
affects: [06-production-manufacturing, 07-warehouses-logistics, 08-markets-distribution, 09-external-trade, 18-ui-polish, 19-balance]

actuals:
  tokens: ~11000
  tasks: 7
  commits: 0

tech-stack:
  added: []
  patterns:
    - Additive verify-as-built modules: new pure exports appended to existing sim files, existing exports/tests untouched
    - Deterministic state machines with seeded/injected state (no Math.random)
    - Per-food accounting with reservation-backed availability preventing double-pick
    - UI reads sim snapshots only — food indicator/advisor derived from live state, never fabricated

key-files:
  created:
    - tests/integration/food-slice.test.ts
  modified:
    - src/sim/agriculture.ts
    - src/sim/logistics.ts
    - src/sim/transport.ts
    - src/sim/housing.ts
    - src/sim/housingEvolution.ts
    - src/sim/trade.ts
    - src/sim/advisors.ts
    - src/game/scenes/HUDScene.ts
    - tests/unit/agriculture.test.ts
    - tests/unit/logistics.test.ts
    - tests/unit/transport.test.ts
    - tests/unit/housing.test.ts
    - tests/unit/housing-evolution.test.ts
    - tests/unit/advisors.test.ts
    - tests/trade.test.ts

key-decisions:
  - "Execute 05-01 as gap-fill + test hardening (verify-as-built), not a rebuild: the live sim's wheat food chain and all 346 baseline tests stay green; new mechanics are additive modules"
  - "Physical-load / granary / market / house-food / trade models implemented as pure additive modules in the existing files; the runner's tickFood transfer is NOT rewritten (goldens intact, determinism preserved)"
  - "New tunables live as module constants (UNITS_PER_LOAD, GRANARY_CAPACITY, etc.), not data/balance.ts, to preserve the locked BALANCE↔CONFIG equivalence contract"
  - "Management UI produces advisor/UI DATA surfaces wired into the HUD (stat-food element); full screen builders/polish are Phase 18 per plan scope"
  - "data/commodities.ts already registered the five food commodities under category 'food' — no change needed, pinned by test"

patterns-established:
  - "Load lifecycle: every food load walks CREATED→AVAILABLE→RESERVED→ASSIGNED→PICKING_UP→IN_TRANSIT→DELIVERED→CONSUMED with invalid transitions throwing dev errors"
  - "Reservation accounting: available(food) = physical − reserve-order − active tx reservations; expiry restores availability (no double-pick, no loss)"
  - "Ping-pong guard: granaryTransfer stamps recentOut/recentIn and refuses re-exchange within the 90-day cooldown"
  - "Any-food-sustains consumption: basic food consumed first, but a house with only vegetables never starves"
  - "Memory + regression tolerance: variety counts stock>0 or access memory; 30-day memory, 30-day famine tolerance before regression"

requirements-completed: [AGRI-01, AGRI-02, AGRI-03]

coverage:
  - id: D1
    description: "Physical-load production with fertility/worker-ratio formula, output-stock capacities, full farm stop reasons, and the fishing-wharf boat voyage"
    requirement: AGRI-02
    verification:
      - kind: unit
        ref: "tests/unit/agriculture.test.ts#physical-load production (AGRI-02, spec §3.1, §6.6–6.8)"
        status: pass
      - kind: unit
        ref: "tests/unit/agriculture.test.ts#fishing wharf with boat voyage (AGRI-02, spec §10)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Granary food hub: shared capacity, per-food orders, stock classes, transactional no-double-pick reservations with expiry, transfer cycle/cooldown guards, deterministic save/load"
    requirement: AGRI-03
    verification:
      - kind: unit
        ref: "tests/unit/logistics.test.ts#granary food hub (AGRI-03, spec §11)"
        status: pass
      - kind: unit
        ref: "tests/unit/transport.test.ts#physical-load state machine (AGRI-02, spec §25)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Market model: demand calculation, food-choice order, explainable supplier scoring, worker-efficiency agent scaling, seller multi-food load composition, service policy, house coverage bookkeeping"
    requirement: AGRI-03
    verification:
      - kind: unit
        ref: "tests/unit/logistics.test.ts#market demand & distribution (AGRI-03, spec §12)"
        status: pass
      - kind: unit
        ref: "tests/unit/walkers.test.ts#market reservation (existing + policyOrder)"
        status: pass
    human_judgment: false
  - id: D4
    description: "House food inventory, daily consumption, basic-first-but-any-food-sustains, variety from stock/memory, 30-day memory + regression, class storage, shortage effects, and variety-gated evolution"
    requirement: AGRI-01
    verification:
      - kind: unit
        ref: "tests/unit/housing.test.ts#house food inventory & consumption (AGRI-01, spec §13)"
        status: pass
      - kind: unit
        ref: "tests/unit/housing-evolution.test.ts#food variety requirements per level (AGRI-01, spec §13.4)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Import/export with urban reserves: exportable surplus formula, export-above-reserve, dangerous-export warning with actionable options, import destination priority, treasury debit/credit"
    requirement: AGRI-03
    verification:
      - kind: unit
        ref: "tests/trade.test.ts#food export with urban reserves (spec §14, TRAD-04)"
        status: pass
      - kind: unit
        ref: "tests/trade.test.ts#trade quotas"
        status: pass
    human_judgment: false
  - id: D6
    description: "Management UI data surface: HUD months-of-food indicator with icon+text+band, per-food advisor table, bottlenecks, overlays, grouped alerts — all derived from live sim state; wired into HUDScene stat-food"
    requirement: AGRI-03
    verification:
      - kind: unit
        ref: "tests/unit/advisors.test.ts#food HUD months-of-food & advisor data (AGRI-03, spec §15/§21)"
        status: pass
      - kind: unit
        ref: "tests/unit/advisors.test.ts#grouped food notifications (AGRI-03, spec §23.4)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Integration + determinism + acceptance coverage for the full vertical slice, save/load reservation round-trip, and §32/§33 scenarios"
    verification:
      - kind: integration
        ref: "tests/integration/food-slice.test.ts#§32.1/§35 vertical slice"
        status: pass
      - kind: integration
        ref: "tests/integration/food-slice.test.ts#§32.8 save/load preserves the chain deterministically"
        status: pass
      - kind: integration
        ref: "npm run test (57 files, 411 tests)"
        status: pass
    human_judgment: false

duration: 47min
completed: 2026-08-03
status: complete
---

# Phase 5 Plan 1: Agriculture & Food — Summary

**Physical-load food supply chain as additive, deterministic sim modules: production output-stock loads, granary per-food orders + no-double-pick reservations, market demand/buyer/seller modelling, house inventory + variety memory — all pinned by 65 new tests, with the HUD months-of-food indicator wired to live sim state (goldens and all 346 baseline tests untouched).**

## Performance

- **Duration:** 47 min
- **Started:** 2026-08-03T14:16:00Z
- **Completed:** 2026-08-03T15:03:00Z
- **Tasks:** 7
- **Files modified:** 16 (+1 new test file)

## Accomplishments

- **Task 1 — Production:** fertility-based `effectiveFarmProduction` (base × fertility × worker ratio × event × religion × condition, §6.6), `produceFarmOutput` load creation in output stock (1 load = 100 units, never exceeds capacity, §29.1 never-destroy), 25-unit dispatch threshold, full `FarmStopReason` vocabulary (§6.7), `FishingBoat` voyage state machine (idle→sailing→fishing 30-day→returning→unloading, 100-unit capacity, §10) with wharf stop reasons (§10.5).
- **Task 2 — Storage:** `FoodLoad` state machine (CREATED→AVAILABLE→RESERVED→ASSIGNED→PICKING_UP→IN_TRANSIT→DELIVERED→CONSUMED/…, invalid transitions raise dev errors, §25), `GranaryModel` with shared 3,200-unit capacity, per-food orders (accept/refuse/request/maintain/empty/reserve/max), stock classes (physical/available/reserved/incoming/outgoing/spoiled, §11.7), transactional reservations that expire on collector failure (§11.8 no-double-pick), `granaryTransfer` with benefit + ping-pong/cooldown guards (§24.3–24.4), deterministic serialize/deserialize (§32.8).
- **Task 3 — Market:** `marketDemand` (§12.6), `nextFoodToFetch` choice order (§12.7), explainable `scoreGranary`/`pickGranary` (§12.8), worker-efficiency `marketAgents` (§12.3), `sellerLoadComposition` multi-food 100-unit loads (§12.10), `policyOrder` for the 5 service policies (§12.15), `recordMarketVisit` coverage bookkeeping (§12.13).
- **Task 4 — Houses:** `HouseFoodInventory` with `deliverToHouse`/`consumeHouseFood` (basic-first but any food sustains, §13.3), `foodVariety` from stock or 30-day memory (§13.4–13.5), class-based `homeStorageCapacity` (§13.6), `houseFoodState` (§13.8), `foodShortageEffects` brief vs prolonged famine (§13.9), variety-gated evolution `foodVarietyRequired` per level (§13.4).
- **Task 5 — Trade:** `exportableSurplus` / `exportableAboveMonths` urban-reserve formula (§14.4), `dangerousExport` warning with cancel/sell-anyway/reduce/raise-reserve options (§14.5), `importDestinationPriority` (§14.2); existing import-to-target, quotas (annual cap + yearly reset) and treasury debit/credit pinned.
- **Task 6 — Management UI:** `foodHudIndicator` months-of-food (icon+text+band, never colour-only, §15.1–15.2), `foodTooltip` breakdown (§15.3), `foodAdvisorFromState` per-food table + `foodBottlenecks`/recommendations (§21), `foodOverlayGrids` supply/variety (§22), `groupedAlerts` (§23.4) — all live-sim-derived; wired into HUDScene as the `stat-food` element.
- **Task 7 — Integration/determinism/acceptance:** `tests/integration/food-slice.test.ts` covers §32.1 basic chain, §32.2 granary refusing, §32.3 no-route reservation expiry + alert, §32.4 variety memory/regression, §32.5 overload, §32.6/7 import/export, §32.8 save/load determinism, plus §33 acceptance spot-checks. Full suite: 57 files / 411 tests green, goldens intact, determinism verified.

## Task Commits

Each task was implemented with additive code + tests, verified by its `<verify>` command. **Commits were intentionally NOT created** per the execution instructions for this phase ("Do NOT commit; write SUMMARY/VERIFICATION files only"). Task verification status:

1. **Task 1: Production** — `npx vitest run tests/unit/agriculture.test.ts` (16 tests) + typecheck ✓
2. **Task 2: Storage** — `npx vitest run tests/unit/logistics.test.ts tests/unit/transport.test.ts` (35 tests) + typecheck ✓
3. **Task 3: Market** — `npx vitest run tests/unit/walkers.test.ts tests/unit/logistics.test.ts` (40 tests) + typecheck ✓
4. **Task 4: Houses** — `npx vitest run tests/unit/housing.test.ts tests/unit/housing-evolution.test.ts` (25 tests) + typecheck ✓
5. **Task 5: Trade** — `npx vitest run tests/trade.test.ts` (13 tests) + typecheck ✓
6. **Task 6: Management UI** — `npx vitest run tests/unit/advisors.test.ts tests/unit/ui.test.ts` (16 tests) + typecheck ✓
7. **Task 7: Integration + determinism + acceptance** — `npm run test` (57 files / 411 tests) + typecheck + lint ✓

## Files Created/Modified

- `src/sim/agriculture.ts` - Physical-load production (+248): UNITS_PER_LOAD=100, MIN_DISPATCH_UNITS=25, SOIL_FERTILITY, effectiveFarmProduction, farmStopReason, produceFarmOutput, FARM_OUTPUT_CAPACITY, FishingBoat/boatStep/fishingWharfState; FarmDef gains outputCapacity
- `src/sim/logistics.ts` - Granary & market hub (+542): GranaryModel (capacity/orders/reservations/stock classes/transfer guards/serialize), GRANARY_CAPACITY=3200, market demand/choice/scoring, marketAgents, sellerLoadComposition, policyOrder, recordMarketVisit
- `src/sim/transport.ts` - Load state machine (+89): FoodLoad lifecycle with invalid-transition errors and non-destructive cancel
- `src/sim/housing.ts` - House food model (+181): inventory, consumption, variety/memory, storage capacity, delivery, shortage effects
- `src/sim/housingEvolution.ts` - Variety-gated evolution (+32): foodVarietyRequired/varietyBlocksEvolution/nextLevelFoodVarietyNeeded
- `src/sim/trade.ts` - Urban-reserve trade (+84): exportableSurplus, exportableAboveMonths, dangerousExport, importDestinationPriority
- `src/sim/advisors.ts` - Food mgmt data (+225): monthsOfFood/foodBand/foodHudIndicator, foodTooltip, foodAdvisorFromState/foodBottlenecks/foodRecommendations, foodHudFromState, foodOverlayGrids, groupedAlerts
- `src/game/scenes/HUDScene.ts` - Wired months-of-food indicator (stat-food element reading live sim)
- `tests/integration/food-slice.test.ts` - NEW: vertical slice, §32 scenarios, §33 acceptance, save/load determinism
- `tests/unit/agriculture.test.ts`, `tests/unit/logistics.test.ts`, `tests/unit/transport.test.ts`, `tests/unit/housing.test.ts`, `tests/unit/housing-evolution.test.ts`, `tests/unit/advisors.test.ts`, `tests/trade.test.ts` - New test blocks pinning each mechanic

## Decisions Made

1. **Verify-as-built, not rebuild.** Current live sim systems already provide farm/granary/market/house/trade behavior (wheat chain) with 346 passing tests. Where behavior exists it was pinned; only real gaps were implemented — as additive modules. runner.ts untouched → goldens intact.
2. **New tunables stay in module constants, not data/balance.ts.** The BALANCE↔CONFIG equivalence test locks key parity and consumer presence; adding food constants there would destabilize the locked catalog. Constants (UNITS_PER_LOAD, GRANARY_CAPACITY, MARKET_CAPACITY, HOME capacity table, etc.) live beside their consumers.
3. **Management UI = data surface, not screens.** Per CONTEXT.md + plan scope, this plan wires the advisor/HUD DATA (months-of-food indicator, per-food advisor table, overlays, grouped alerts) to live sim state; full screen builders and visual polish are Phase 18.
4. **data/commodities.ts unchanged** — the five foods (wheat/vegetables/fruit/meat/fish) were already registered under category `food`; pinned by test rather than modified.

## Deviations from Plan

None - plan executed as written under the verify-as-built + gap-fill mandate. All 7 tasks' `<verify><automated>` commands pass; `<done>` criteria met per task.

## Issues Encountered

- Fishing-boat state machine initially never left `fishing` (the 30-day cycle timer was not applied). Fixed `boatStep` to drive sailing/fishing/returning purely off `remaining` ticks (fishing accumulates catch each tick of the cycle, then returns/unloads); strengthened lifecycle test to assert the full cycle terminates.
- gsd-tools key-link checker reports "Target not referenced" for cross-module links to transport.ts/housing.ts because they carry no literal import between them; the links are exercised by `tests/integration/food-slice.test.ts`, which imports and composes all modules (see VERIFICATION.md §Key Link Verification).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- AGRI-01/02/03 satisfied with automated test evidence (411 tests green, +65).
- Vertical-slice chain, load state machine, reservation invariants, urban-reserve export and food management data surfaces are ready for Phase 6 (production & manufacturing, physical loads), Phase 7/8 (warehouses/markets can reuse GranaryModel/MarketModel), Phase 9 (trade reuse), and Phase 18 (full food advisor/overlay screens building on the advisor data surface).
- No blockers. Determinism held (goldens unmodified; identical seed/map/commands reproduced identical food HUD state).

---
*Phase: 05-agriculture-food*
*Completed: 2026-08-03*
