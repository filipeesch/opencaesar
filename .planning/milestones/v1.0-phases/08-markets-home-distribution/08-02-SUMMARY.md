---
phase: 08-markets-home-distribution
plan: 08-02
subsystem: simulation
tags: [market, logistics, config-registry, runner, walkers, vitest]

# Dependency graph
requires:
  - phase: 08-01
    provides: "Per-market config behavior matrix, reservation no-double-pick contention tests, distribution-priority matrix (all green as this plan's foundation)"
  - phase: 07-warehouses-logistics
    provides: "MarketConfig/defaultMarketConfig, marketAccepts, findSupplier, marketFoodState/decideBuyer/decideSeller in walkers.ts, SimRunner"
provides:
  - "marketNeedsRestock(cfg, stock, inTransit) additive restock signal honoring targetStock"
  - "findSupplier optional preferredSupplier param (prefer-the-named when it holds within radius)"
  - "SimRunner per-market config registry: setMarketConfig / marketConfig / hasMarketConfig / getWalkerInternals"
  - "SimInternals.marketConfig(id) hook + walker runtime honoring (buyer radius, refused-product gate, target stock) only when explicitly configured"
  - "Runner-integrated buyer→market→seller→house chain test against real runner state"
affects: [08-03, 09-trade-goods, management-UI phase]

# Actuals (#2632) — no commits made (executor instructed to write SUMMARY only).
actuals:
  tokens: 8900
  tasks: 3
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive runner registry + optional SimInternals hook: unconfigured markets keep byte-identical legacy behavior"
    - "getWalkerInternals() exposes the runner's own live simInternals() seam for integration tests (no disconnected stub)"

key-files:
  created:
    - tests/unit/market-config-surface.test.ts
    - tests/unit/market-buyer-config.test.ts
    - tests/integration/market-chain.test.ts
  modified:
    - src/sim/logistics.ts
    - src/sim/runner.ts
    - src/sim/walkers.ts

key-decisions:
  - "Per-market config is stored per-building on the runner and honored only when explicitly set; unconfigured markets are byte-identical to baseline (decision 4)."
  - "targetStock at runtime is derived via marketNeedsRestock(cfg, stock, inTransit) with inTransit counted from live buyer cargo (SimInternals.walkers), so a food at/above target never triggers a fetch."
  - "marketFoodState with a config skips refused products and sets expectedConsumption from the target-stock need; the unconfigured path keeps the legacy cap-derived signal."

patterns-established:
  - "Pattern 1: runner-integrated walker tests resolve building ids from the live internals.buildings registry (roads consume ids) and staff the market via the live seam so marketAgents() allocates a buyer/seller."
  - "Pattern 2: SimInternals.walkers (optional) feeds in-transit accounting without changing the legacy default (absent → 0)."

requirements-completed: [MARK-01, MARK-02]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Additive market-config surface: marketNeedsRestock reports below-target restock honoring targetStock with in-transit counted; findSupplier prefers the configured preferredSupplier when it holds the product within radius and falls back to nearest otherwise"
    requirement: MARK-02
    verification:
      - kind: unit
        ref: "tests/unit/market-config-surface.test.ts#marketNeedsRestock honors cfg.targetStock"
        status: pass
      - kind: unit
        ref: "tests/unit/market-config-surface.test.ts#findSupplier preferred-supplier preference"
        status: pass
    human_judgment: false
  - id: D2
    description: "SimRunner per-market config registry: setMarketConfig/marketConfig with defaultMarketConfig() fallback, per-market isolation, hasMarketConfig; getWalkerInternals returns the live simInternals seam"
    requirement: MARK-02
    verification:
      - kind: unit
        ref: "tests/unit/market-config-surface.test.ts#SimRunner per-market config registry"
        status: pass
      - kind: integration
        ref: "tests/integration/market-chain.test.ts#buyer→market→seller→house chain against runner state"
        status: pass
    human_judgment: false
  - id: D3
    description: "SimInternals.marketConfig hook honored at runtime only when set: buyerRadius narrows/widens the supplier search, a refused product stops the buyer's fetch, targetStock drives the restock decision (at/above target overrides legacy cap logic); unconfigured path reproduces legacy decideBuyer byte-identically"
    requirement: MARK-02
    verification:
      - kind: unit
        ref: "tests/unit/market-buyer-config.test.ts#per-market config honored at runtime only when explicitly set"
        status: pass
    human_judgment: false
  - id: D4
    description: "Runner-integrated buyer→market→seller→house chain proven against runner-owned state: reserve-at-departure + rise-on-deposit (nothing teleported/lost), seller load composition + delivery to an adjacent house (foodInventory + marketCoverage), two buyers contend for one granary without double-picking (total held never exceeds stock)"
    requirement: MARK-01
    verification:
      - kind: integration
        ref: "tests/integration/market-chain.test.ts#buyer reserves at departure and deposits on arrival"
        status: pass
      - kind: integration
        ref: "tests/integration/market-chain.test.ts#seller composes a load from market stock"
        status: pass
      - kind: integration
        ref: "tests/integration/market-chain.test.ts#two buyers stepping against one granary never double-pick"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-08-03
status: complete
---

# Phase 8 Plan 2: Markets & Home Distribution — Runner Per-Market Registry + Chain Summary

**Additive per-market config registry on the runner (setMarketConfig/marketConfig + getWalkerInternals), marketNeedsRestock/preferred-supplier model surface, and a runner-integrated buyer→market→seller→house chain test driving the walkers against real runner state — 18 new tests, no existing behavior changes.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-03T21:24:05 local
- **Completed:** 2026-08-03T21:34:00 local
- **Tasks:** 3
- **Files modified:** 3 created (tests), 3 modified (src/sim/logistics.ts, src/sim/runner.ts, src/sim/walkers.ts — additive)

## Accomplishments

- `marketNeedsRestock(cfg, stock, inTransit)` added to `src/sim/logistics.ts` — pure, deterministic restock signal (stock + inTransit < targetStock) closing the previously dead `targetStock` field (§18.5 'estoque-alvo').
- `findSupplier` gained an optional trailing `preferredSupplier?: string | null` param — prefers the named supplier when it holds the product within radius, else the existing nearest-within-radius behavior (additive; existing callsites unaffected).
- `SimRunner` gained the additive per-market config registry: `setMarketConfig(buildingId, cfg)`, `marketConfig(buildingId)` (defaults to `defaultMarketConfig()`), `hasMarketConfig`, and `getWalkerInternals()` exposing the runner's own live `simInternals()` seam for integration tests. Inert until a market is configured — no existing runner method changed behavior (MARK-02, decision 4).
- `SimInternals` gained the optional `marketConfig?(id)` hook (plus optional `walkers?` for in-transit accounting); `decideBuyer`/`marketFoodState`/`pickBuyerGranary` honor an explicitly-configured market's buyerRadius (filter candidates by Manhattan from the market), refused products (skip from the food choice), and targetStock (derive restock need via marketNeedsRestock, counting live buyer cargo in transit). Unconfigured markets keep the legacy hardcoded path byte-identical.
- Runner-integrated chain test (`tests/integration/market-chain.test.ts`) drives buyer → market → seller → house against real runner state via `getWalkerInternals()`: reserve-at-departure (granary −40, market unchanged), deposit-on-arrival (market +40), seller load composition + house delivery (foodInventory + foodCooldown + marketCoverage), and two buyers contending for one granary with total held never exceeding stock (nothing teleported, lost, or double-picked).

## Task Commits

No commits were made — the executing agent was instructed to write SUMMARY/VERIFICATION files only (no git operations).

1. **Task 1: Additive market-config surface + runner per-market config registry** — `marketNeedsRestock` + `findSupplier` preferredSupplier (logistics.ts), runner registry + `getWalkerInternals` (runner.ts), `tests/unit/market-config-surface.test.ts` (9 tests)
2. **Task 2: Runtime honoring of configured per-market config via SimInternals.marketConfig** — `walkers.ts` wiring, `tests/unit/market-buyer-config.test.ts` (6 tests)
3. **Task 3: Runner-integrated buyer→market→seller→house chain test** — `tests/integration/market-chain.test.ts` (3 tests)

## Files Created/Modified

- `src/sim/logistics.ts` — added `marketNeedsRestock`, extended `findSupplier` with `preferredSupplier` (additive)
- `src/sim/runner.ts` — added `marketConfigs` registry, `setMarketConfig` / `marketConfig` / `hasMarketConfig` / `getWalkerInternals`; `simInternals()` now exposes `walkers` + `marketConfig`
- `src/sim/walkers.ts` — `SimInternals.marketConfig?` + `walkers?`; `decideBuyer`/`marketFoodState`/`pickBuyerGranary` honor an explicitly-set config
- `tests/unit/market-config-surface.test.ts` — 9 tests (surface + registry)
- `tests/unit/market-buyer-config.test.ts` — 6 tests (runtime honoring)
- `tests/integration/market-chain.test.ts` — 3 tests (runner-integrated chain)

## Decisions Made

- Followed decisions 3+4 exactly: config stored per-market and honored only when explicitly set; unconfigured path byte-identical.
- In-transit accounting feeds `marketNeedsRestock` at runtime via the optional `SimInternals.walkers` list (live buyer cargo), making the target-stock signal genuinely in-transit-aware without adding surface to unconfigured paths.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in test setup] Runner-placed market must be staffed for marketAgents() to allocate a buyer/seller**
- **Found during:** Task 3 (Runner-integrated chain test)
- **Issue:** `placeBuilding('market')` produces `workersAssigned: 0` (no labor connectivity), so `decideBuyer` reads `marketAgents(0).buyers <= 0` and the buyer never fetches. The food-slice stub worked only because it hardcoded `workersRequired: 1, workersAssigned: 1`.
- **Fix:** `buildMarketCity` staffs the market via the live seam (`market.workersAssigned = Math.max(1, market.workersRequired)`), matching how production-runner tests handle staffing.
- **Files modified:** tests/integration/market-chain.test.ts
- **Verification:** chain tests 3/3 pass; full suite green.
- **Committed in:** not committed (executor withheld from git)

**2. [Rule 1 - Bug in test setup] Building ids must be resolved from the live registry (roads consume ids)**
- **Found during:** Task 3 (Runner-integrated chain test)
- **Issue:** Hardcoded ids (`marketId: 1, houseId: 3`) were wrong because `placeBuilding` increments `nextBuildingId` for roads too, and the house at (8,0) was rejected because the road row extended over it.
- **Fix:** `buildMarketCity` resolves granary/market/house ids from `internals.buildings` and stops the road row at x=7 so the house tile stays earth adjacent to the seller tile.
- **Files modified:** tests/integration/market-chain.test.ts
- **Verification:** chain tests 3/3 pass.
- **Committed in:** not committed (executor withheld from git)

---

**Total deviations:** 2 auto-fixed (2 test-setup bugs)
**Impact on plan:** Both fixes necessary to drive walkers against real runner state as planned; no scope creep and no source behavior change beyond the planned additive surface.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-03 depends on the green per-market config registry (`setMarketConfig`), `getWalkerInternals`, and the buyer/seller chain determinism foundation — all in place.
- Full suite at 553 tests / 75 files; typecheck clean; 08-01 matrices, food-slice.test.ts, food-chain.test.ts, walkers.test.ts all unchanged and green.

---
*Phase: 08-markets-home-distribution*
*Completed: 2026-08-03*
