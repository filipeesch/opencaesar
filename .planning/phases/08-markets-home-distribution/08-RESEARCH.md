# Phase 8: Markets & Home Distribution — Research

**Date:** 2026-08-03
**Researcher:** gsd-phase-researcher + gsd-planner (combined session)
**Baseline verified:** `npm run typecheck` clean; `npm run test` → **506 tests
pass** across 69 files (~4s, including ~3.5s of property tests).
`tests/unit/logistics.test.ts` holds 31 tests. Suite is fast enough for per-task
sampling: targeted <1s, full ~4s.

---

## 1. Existing Implementation Summary

The market model is a **pre-drafted, additive layer** in `src/sim/logistics.ts`
(header "Phases 7 & 8; tasks 3.4, 3.5, 3.6, 5.x") plus buyer/seller walkers in
`src/sim/walkers.ts`. It is fully deterministic (seeded RNG only, tick-based
expiry), self-contained, and exercised by unit/stub tests — but largely
disconnected from the live runner.

### MARK-01 — buyer (destination) + seller (wandering) walkers, reservation no-double-pick
- `MarketConfig`/`defaultMarketConfig` (logistics.ts:200-211), `MarketSupplier` +
  `findSupplier` (220-240, nearest product-holding supplier within radius),
  `ReservationPool` (111-175: reserve backs unit out of `available`; a second
  `reserve` fails; `reserveWithExpiry`/`expireReservations` are tick-based).
- `GranaryModel.reserve` (logistics.ts, granary section) is transactional with
  ticket-based expiry; unit-tested incl. "a second buyer cannot reserve the same
  60 units" (logistics.test.ts:161-173) and single-buyer pool no-double-pick
  (logistics.test.ts:47-54).
- Walkers: `buyer` (`types.ts:34`) is `destination` and `seller` is `wandering`
  (walkerProfiles.ts:43-44). `decideBuyer` (walkers.ts:289-318) computes food
  demand via `marketFoodState` (372-382), picks via `nextFoodToFetch`, finds a
  road-reachable granary via `pickBuyerGranary` (385-401), and **reserves by
  decrementing granary stock at departure** (walkers.ts:313), restoring on a
  failed trip via `releaseWalkerLoad` (417-437) and depositing on arrival
  (handleArrival 485-494). `decideSeller` (326-340) composes a multi-food load
  via `sellerLoadComposition`, deducts from market stock at origin, and delivers
  via `deliverToAdjacentHouses` (205-230).
- **Covered:** single-buyer reserve + deposit + restore-on-failure
  (tests/integration/food-slice.test.ts:120-192); §32.3 reservation expiry
  (274-294); model-level second-buyer refusal (logistics.test.ts:161-173).
- **GAP (GENUINE, decision 1):** **no two-buyer contention test** — nothing
  proves two buyers contending for one load at the walker-decideBuyer level
  cannot both take it (the walker reserve is a stock decrement; no test follows
  a second `decideBuyer` against the reduced stock).
- **GAP (GENUINE, decision 2):** the buyer→market→seller→house chain is covered
  only through a **walker-stub** (`food-slice.test.ts` builds its own
  `SimInternals`) — **no runner-level integration test** drives the chain
  against the real `SimRunner`, and the runner spawns **neither `buyer` nor
  `seller`** (tickSpawns, runner.ts:746-748 emits 'market' for markets). The
  runner-level `food-chain.test.ts:5-28` exercises the legacy wheat-only market
  walker, not the multi-food chain.

### MARK-02 — per-market configuration
- `MarketConfig` (logistics.ts:200-207): `productRules`
  (Partial<Record<product,'accept'|'refuse'>>), `targetStock`, `buyerRadius`,
  `blockWineForPlebeians`, `preferredSupplier`. `marketAccepts` (214-218) gates
  productRules-refuse + wine-for-plebeians. `findSupplier` uses `radius`.
- **Covered:** accept/refuse + wine-block defaults (logistics.test.ts:67-76);
  one nearest-within-radius (logistics.test.ts:78-90); a ceramics-chain
  market-accepts assertion (logistics.test.ts:119-120).
- **GAP (GENUINE, decision 3):** the **per-config behavior matrix is thin** and
  **`targetStock`, `buyerRadius` (in config), `preferredSupplier` are dead
  fields** — grepping `src/sim/**` shows no production consumer (only the
  interface/constructor and tests). `nextFoodToFetch`'s optional `priority`
  param (logistics.ts:639-643) is never fed. No matrix ties each config field to
  an observable behavior.
- **GAP (GENUINE, decision 4):** **no per-market config exists in the runner** —
  `SimRunner` never references `MarketConfig`/`defaultMarketConfig`, and
  `marketFoodState` (walkers.ts:372-382) ignores the config entirely
  (`basicFood:'wheat'`, `evolutionBlocking:null`, `inTransit:{}`, cap-derived
  `expectedConsumption`).

### MARK-03 — internal inventory + distribution priority
- Model: `MARKET_CAPACITY` 500 (logistics.ts:570), `MARKET_FOOD_CAPS`
  (572-574), `marketDemand` (582-589), `nextFoodToFetch` with
  basic-food-first/coverage/evolution-blocking/priority (618-644),
  `nextPickPriority` essential-then-evolution-blocking (187-197), marketAgents
  by efficiency (701-708), `sellerLoadComposition` priorities (715-734),
  `MarketServicePolicy` 5 options (737) + `policyOrder` (761-775).
- **Covered:** demand math (logistics.test.ts:304-307), food-choice order incl.
  evolution-blocking (309-345), granary scoring (347-356), marketAgents
  (358-364), load capacity+basic-first (366-376), 2 of 5 policies
  (378-387), recordMarketVisit (389-398), capacity/caps (400-403).
- **GAP (GENUINE, decision 5):** `balanced` (default), `promote-evolution`, and
  `patrician-reserve` policies are **untested**; the composed
  "essential food → evolution-blocking good" order through `sellerLoadComposition`
  is unproven; **`policyOrder` is never consumed by production code** (exported
  + tested only) — the market's service policy is not honored at runtime.
- **GAP (determinism):** no chunked-tick test covers the market chain (buyer/
  seller + market inventory) through the runner — only food
  (determinism.test.ts), production (production-chain-determinism.test.ts),
  warehouses (warehouse-logistics-determinism.test.ts).

### Determinism audit
- `src/sim/logistics.ts` and the walker market paths are **RNG/clock-free**
  (grep-verified: no Math.random/Date/performance in logistics.ts; expiry is
  tick-based). `ReservationPool` expiry is deterministic (111-175). The only
  runtime randomness flows through the seeded RNG in `move` (walkers.ts:544).

---

## 2. Gaps vs Requirements

| Requirement | Status | Gap |
|-------------|--------|-----|
| MARK-01 buyer/seller walker types + behaviors | ✅ as-built (stub-tested) | buyer/seller walkers + decideBuyer/decideSeller/deliverToAdjacentHouses (walkers.ts:289-340, 205-230); no runner spawn (runner.ts:748) |
| MARK-01 reservation no double-pick (single) | ✅ covered | logistics.test.ts:47-54, 161-173; food-slice.test.ts:120-162 |
| MARK-01 two buyers contending for one load | ❌ genuine | no contention test at model or walker level (decision 1) |
| MARK-01 buyer→market→seller→house chain | ⚠️ stub-only | no runner-level integration test; spawner untouched (decision 2) |
| MARK-02 per-market accept/refuse + wine block | ✅ covered | logistics.test.ts:67-76 marketAccepts |
| MARK-02 targetStock / buyerRadius / preferredSupplier honored | ❌ genuine | dead fields — no production consumer (decisions 3+4) |
| MARK-02 per-config behavior matrix | ❌ partial | only accept/refuse+wine; no priority/radius-boundary/target/preferred matrix (decision 3) |
| MARK-02 runner per-market config state | ❌ genuine | no setMarketConfig/marketConfig; walkers ignore config (decision 4) |
| MARK-03 internal capacity + per-food caps | ✅ covered | MARKET_CAPACITY/MARKET_FOOD_CAPS assertions (logistics.test.ts:400-403) |
| MARK-03 demand + food-choice order incl. evolution-blocking | ✅ covered | logistics.test.ts:304-345, nextFoodToFetch (618-644) |
| MARK-03 seller load composition priority | ⚠️ partial | single basic-first case (366-376); composed essential→evolution-blocking unproven (decision 5) |
| MARK-03 policyOrder 5 policies | ❌ partial | only avoid-hunger + local-district asserted (378-387); balanced/promote-evolution/patrician untested; runtime honoring absent (decision 5) |
| Determinism (RNG/clock-free) | ✅ audit | logistics.ts grep clean; expiry tick-based |
| Determinism (market-chain chunked test) | ❌ gap | no market-chain determinism test (plan 08-03) |

---

## 3. Open Questions (all RESOLVED)

| # | Question | Resolution |
|---|----------|------------|
| Q1 | Is there a two-buyer, one-load no-double-pick test? | **RESOLVED:** No. Only single-buyer (food-slice.test.ts:120-162) and model-level second-reserve refusal (logistics.test.ts:161-173). Add a contention test over ReservationPool/GranaryModel AND walker `decideBuyer` (decision 1). |
| Q2 | Is the buyer→market→seller→house chain tested against the real runner? | **RESOLVED:** No — only walker-stub (food-slice.test.ts:120-192) + model slice (195-251). food-chain.test.ts runs the legacy 'market' walker. Runner never spawns buyer/seller (runner.ts:748). Add runner-integrated chain test (decision 2). |
| Q3 | Do all MarketConfig fields drive behavior? | **RESOLVED:** No. `productRules`/`blockWineForPlebeians` drive `marketAccepts`; `buyerRadius` reaches `findSupplier` only in the pure function (never from config at runtime). `targetStock` and `preferredSupplier` have **zero** production consumers. Additive honoring + matrix required (decisions 3+4). |
| Q4 | Is per-market config stored in the runner? | **RESOLVED:** No. `SimRunner` has no MarketConfig reference; walkers hardcode marketFoodState (walkers.ts:372-382). Add an additive per-market registry + SimInternals hook, honored only when explicitly set (decision 4). |
| Q5 | Are all 5 service policies covered? | **RESOLVED:** No — 2/5 (avoid-hunger, local-district) asserted. balanced/promote-evolution/patrician-reserve untested; no runtime consumer of policyOrder (decision 5). |
| Q6 | Is the "essential food → evolution-blocking good" order proven through load composition? | **RESOLVED:** No — sellerLoadComposition asserted once with all-priorities + total-cap only (logistics.test.ts:366-376). Add composed priority test + additive marketLoadComposition driven by an explicit market config (decision 5). |
| Q7 | Is the market code deterministic? | **RESOLVED:** Yes — logistics.ts is RNG/clock-free; expiry tick-based. Add a chunked market-chain determinism test (1/7/50 → identical getStateJson). |
| Q8 | Do the additive runner/walker wiring changes break the 506 baseline? | **RESOLVED:** No by construction if the config is honored **only when explicitly set** (unconfigured markets keep today's hardcoded path). The runner registry defaults to defaultMarketConfig() and is inert until setMarketConfig is called; verified no existing test calls it. |
| Q9 | Should the runner start spawning buyer/seller instead of 'market'? | **RESOLVED (deferred):** No in this phase. Keep tickSpawns (runner.ts:748) emitting 'market' so food-chain.test.ts:5-28 and goldens stay green. This phase proves the chain against runner structures; the spawner swap is <deferred>. |
| Q10 | Actual baseline test count? | **RESOLVED:** 506 tests / 69 files, typecheck clean (measured this run). |
| Q11 | Does the seller distribution honor essential-food-first then evolution-blocking? | **RESOLVED:** Partially — `sellerLoadComposition` honors passed `priorities`, but walkers.ts:334 passes FOOD_KEYS (food-only, basic-first) and `deliverToAdjacentHouses` walks adjacent houses first-by-DIRS (walkers.ts:205-230) ignoring policyOrder. The composed `marketLoadComposition(cfg,…)` + full policy matrix closes it at the representable surface (decision 5). |

---

## 4. Validation Architecture

Applies — see `08-VALIDATION.md` (created). The Vitest suite is fast (~4s full,
<1s targeted), so per-task sampling at `npm run typecheck` + the task's
`<automated>` vitest command is fine; the full suite runs after each plan wave.

No Wave-0 infrastructure is needed beyond the test files each task creates
itself, plus in-place additive extension of `src/sim/logistics.ts`,
`src/sim/runner.ts`, and `src/sim/walkers.ts`:

- Plan 08-01 (model audit + matrices): `tests/unit/market-config.test.ts`,
  `tests/unit/market-reservation.test.ts`, `tests/unit/market-distribution.test.ts`
  (all new, test-only).
- Plan 08-02 (runner per-market state + runtime honoring + chain):
  `tests/unit/market-config-surface.test.ts`,
  `tests/unit/market-buyer-config.test.ts`, `tests/integration/market-chain.test.ts`
  (new); source `src/sim/logistics.ts`, `src/sim/runner.ts`, `src/sim/walkers.ts`
  (additive).
- Plan 08-03 (distribution priority + determinism):
  `tests/integration/market-distribution-priority.test.ts`,
  `tests/determinism/market-chain-determinism.test.ts` (new); source
  `src/sim/logistics.ts` (additive `marketLoadComposition`).

Existing fixtures reused: `tests/helpers.ts` (`runScenario`, `foodChainMap`,
`buildFoodCity`) and the `walkers.test.ts`/`food-slice.test.ts` walker-stub
pattern (`createWalker`/`updateWalker` against a `SimInternals` stub).
