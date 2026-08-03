# Phase 8: Markets & Home Distribution - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Mode:** Research-enabled, Nyquist-validated, verify-as-built + gap-fill over the
accepted decisions (all grey areas PRE-ACCEPTED — no open questions)
**Baseline:** `npm run typecheck` clean; `npm run test` → **506 tests / 69 files**
green (~4s, incl. property tests). `tests/unit/logistics.test.ts` holds 31 tests
including market blocks ("market reservation", "distribution priority",
"per-market configuration", "market buyer", "market demand & distribution");
`tests/integration/food-slice.test.ts` holds the WR-02 buyer/seller walker-stub
block (3 tests) plus the §32 vertical-slice scenarios.

<domain>
## Phase Boundary

Deliver the markets & home-distribution surface from `game.md` §18 ("Mercados e
Distribuição Doméstica") and `game-specs/fodd-supply-chain.md` §12: market buyer
(destination) + seller (wandering) walkers with reservation-based supplier
selection (no double-picking, §18.3 + §12.5/§12.8), per-market configuration
(accept/refuse per product, priority, target stock, buyer radius, block wine for
plebeians, preferred supplier, §18.5 + §12.14), and the internal market inventory
+ distribution priority (essential food first, then the evolution-blocking good,
§18.2/§18.4 + §12.6/§12.7/§12.11/§12.15). Requirements: MARK-01, MARK-02,
MARK-03. Roadmap Phase 8, depends on Phase 7. The market model was **pre-drafted
additively** in `src/sim/logistics.ts` (header "Phases 7 & 8; tasks 3.4, 3.5,
3.6, 5.x") together with buyer/seller walkers in `src/sim/walkers.ts`; this
phase audits that drafting against MARK-01/02/03 and the accepted decisions,
gap-fills the missing dimensions, wires the accepted per-market config into the
runner (per-market state), and locks behavior with tests.
</domain>

<decisions>
## Implementation Decisions

### Mode (audit + gap-fill + test coverage + runner per-market wiring, verify-as-built)
- Consistent with Phases 5-7: the market model and buyer/seller walkers are
  pre-drafted and additive. This phase audits them against MARK-01/02/03 and
  §18, gap-fills the dimensions the accepted decisions name, and locks behavior
  with tests. No existing export is renamed or resemantized. All runtime wiring
  is additive and default-preserving so the 506-test baseline stays green.

### Buyer reservation no-double-pick — holds during transit (decision 1, MARK-01)
- The model already prevents double-picking two ways: `ReservationPool`
  (logistics.ts:111-175) backs reserved units out of `available` so a second
  `reserve` fails, and `GranaryModel.reserve` (logistics.test.ts:161-173) is
  transactional with tick-based expiry. The walker `decideBuyer`
  (walkers.ts:289-318) reserves by **decrementing granary stock at departure**
  (walkers.ts:308-317) and restores it on a failed trip (`releaseWalkerLoad`,
  walkers.ts:417-437). Audit finding: **no test proves two buyers contending for
  one load cannot both take it** — the existing coverage is a single buyer
  (food-slice.test.ts:120-144) and the model-level single reservation
  (logistics.test.ts:47-54). Add a **no-double-pick contention test** at both the
  model (ReservationPool/GranaryModel) and the walker-decideBuyer level: buyer 1
  reserves 40, a second buyer must not be able to reserve the same 40 (walker
  read sees the reduced stock), and the total held across buyers never exceeds
  the granary's stock.

### Buyer→market→seller→house integration chain — gap-fill coverage (decision 2, MARK-01)
- The chain is covered at the **walker-stub level** (food-slice.test.ts:120-192,
  WR-02: buyer reserves + deposits, seller composes + delivers + records
  coverage) and the **model level** (food-slice.test.ts:195-251 §32.1 vertical
  slice). Audit finding: **no runner-level integration test** drives the
  multi-food buyer/seller chain against the real `SimRunner` — the runner-level
  `food-chain.test.ts` exercises the legacy wheat-only `market` walker (spawned
  by `tickSpawns`, runner.ts:748), and the runner spawns neither `buyer` nor
  `seller` (they exist in types.ts:34 and walkerProfiles.ts:43-44 but never in
  `tickSpawns`). Gap-fill: a runner-integrated test (new
  `tests/integration/market-chain.test.ts`) that drives buyer → market → seller
  → house through a runner-built `SimInternals` and asserts the physical
  end-state through runner state (market stock rises only on deposit, granary
  falls by the reserved amount, house gains foodInventory + marketCoverage,
  nothing teleported/lost). Whether the runner should *spawn* buyer/seller (vs.
  the legacy `market` walker) for real cities is deferred (see <deferred>) —
  this phase proves the chain is runnable against runner structures, not a
  spawner swap.

### Per-market config model, matrix + dead-field honoring (decision 3, MARK-02)
- `MarketConfig` (logistics.ts:200-207) + `defaultMarketConfig` (209-211) exist;
  `marketAccepts` (214-218) gates productRules refuse + block-wine-for-plebeians;
  `findSupplier` (228-240) picks the nearest product-holding supplier within
  radius. Audit finding: the **per-config behavior matrix is thin** — only
  accept/refuse + wine-block defaults asserted (logistics.test.ts:67-76) and a
  single nearest/radius `findSupplier` case (logistics.test.ts:78-90). Worse,
  **`targetStock`, `buyerRadius`, and `preferredSupplier` are dead fields**: grep
  finds no production consumer — `buyerRadius` never reaches `findSupplier`,
  `targetStock` never drives restock, `preferredSupplier` is never consulted.
  Gap-fill: (a) a **per-config behavior test matrix** locking each dimension
  (per-product accept/refuse incl. resident-class interplay, block-wine toggle,
  radius boundary for `findSupplier`, priority), and (b) additive model surface
  so `targetStock` (restock threshold helper) and `preferredSupplier` (prefer
  the named supplier before nearest) become honored, representable dimensions
  with tests — matching §18.5 "estoque-alvo" and "selecionar granário/armazém
  preferencial".

### Runner per-market state stored and honored at runtime (decision 4, MARK-02)
- Audit finding: **no per-market configuration exists in the runner** —
  `SimRunner` never references `MarketConfig`/`defaultMarketConfig`, and
  `marketFoodState` (walkers.ts:372-382) hardcodes `basicFood: 'wheat'`,
  `evolutionBlocking: null`, `inTransit: {}`, and cap-derived expected
  consumption; none of blockWineForPlebeians/productRules/targetStock/
  buyerRadius/preferredSupplier reach walkers at runtime. Gap-fill: add an
  **additive per-market config registry on `SimRunner`**
  (`setMarketConfig(buildingId, cfg)` / `marketConfig(buildingId)`, defaulting to
  `defaultMarketConfig()`), expose it to walkers through an optional
  `SimInternals.marketConfig` hook, and honor the config at runtime **only when
  it has been explicitly set** (unconfigured markets keep today's exact
  behavior, so the baseline is byte-identical). Add a test proving config is
  stored per-market, survives the runner round-trip, and changes runtime
  behavior when set (buyer radius narrows the supplier search, refused product
  stops the buyer/seller handling it, target stock changes the restock
  decision).

### Distribution priority: policyOrder + seller load composition gap-fill (decision 5, MARK-03)
- `MarketServicePolicy` (logistics.ts:737), `policyOrder` (761-775),
  `sellerLoadComposition` (715-734), `nextFoodToFetch` (618-644),
  `nextPickPriority` (187-197) implement the §18.4/§12.11/§12.15 priority
  (essential food first, then evolution-blocking good) at the model level.
  Audit finding: only **2 of 5 policies** are asserted
  (avoid-hunger + local-district, logistics.test.ts:378-387); `balanced`,
  `promote-evolution`, and `patrician-reserve` are **untested**; the composed
  "essential food → evolution-blocking good" ordering through
  `sellerLoadComposition` is unproven (single all-priorities case,
  366-376); and **`policyOrder` is never consumed by production code** — the
  market's service policy is not honored at runtime (the seller walks a fixed
  DIRS adjacency order, walkers.ts:205-230). Gap-fill: (a) a **full 5-policy
  matrix test**, (b) a composed distribution-priority test proving essential
  food then evolution-blocking good through `sellerLoadComposition` +
  `nextPickPriority` against a market config, and (c) an additive runner/
  walker composition (`marketLoadComposition(cfg, marketStock, perFoodCap)`) so
  the market's configured priorities drive the seller's actual load order,
  proven against a composed market state.

### Determinism
- Audit: `src/sim/logistics.ts` and the walkers' market paths are RNG/clock-free
  (seeded RNG only; `ReservationPool`/reservation expiry are tick-based). Gap: **no
  chunked-tick determinism test covers the market chain** (buyer/seller +
  market inventory + per-market config through the runner); the existing chunked
  tests cover food city (determinism.test.ts), production
  (production-chain-determinism.test.ts), and warehouses
  (warehouse-logistics-determinism.test.ts). Add a market-chain chunked test
  (chunk sizes 1/7/50 → identical `getStateJson()`), reusing the accepted
  decision-1/2 chain.

### Scope boundary
- The seller's **adjacency-only** delivery mover (deliverToAdjacentHouses,
  walkers.ts:205-230) is kept — a broader "walk to demand" route selection
  (serviceRadiusFromCurrentTile, §12.12 route config, "destacar rota do
  vendedor") is deferred; the service policy (policyOrder) gap-fill lands as an
  additive composed surface (`marketLoadComposition`) + full matrix tests, not a
  runtime route re-planner.
- The buyer remains **food/granary-focused** today (walkers.ts:372-382,
  pickBuyerGranary walkers.ts:385-401); buyer fetching manufactured goods from
  warehouses (§18.1 "procura bens em armazéns") is deferred — the per-market
  productRules gate reached at acceptance (`marketAccepts`) covers goods at the
  model level, but warehouse-good fetch wiring is Phase-9/external-trade scope.
- Visual rendering / tela do mercado (§18.2 "Mostrar: ...") and the inspector
  (advisors.ts marketInspection, advisors.ts:178-179) stay view-level — future
  Phase 18 management UI.
- Runner **spawner** behavior (tickSpawns, runner.ts:734-765) is untouched —
  the legacy `market` wheat walker keeps flowing so food-chain.test.ts and the
  goldens stay green; buyer/seller runner spawning is deferred (see
  <deferred>).

### Claude's Discretion
- Task-level implementation (exact helper signatures, assertion details, test
  file layout, how `SimInternals.marketConfig` is threaded) is left to the
  executor within each plan's action and done criteria, bounded by the
  additive/conservative rules above and the "honored only when explicitly
  configured" default-preserving contract.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- src/sim/logistics.ts — MarketConfig (200-207), defaultMarketConfig (209-211),
  marketAccepts (214-218), MarketSupplier + findSupplier (220-240),
  nextPickPriority (187-197), ReservationPool (111-175, tick-based expiry),
  MARKET_CAPACITY 500 (570), MARKET_FOOD_CAPS (572-574), SELLER_CAPACITY 100
  (576), SELLER_MAX_ROAD_STEPS 40 / SELLER_MAX_DAYS_OUT 60 (578-579),
  marketDemand (582-589), MarketFoodState (591-604), nextFoodToFetch (618-644),
  GranaryCandidate/scoreGranary/pickGranary (646-698), marketAgents (701-708),
  sellerLoadComposition (715-734), MarketServicePolicy (737), HouseServingInfo
  (739-749), policyOrder (761-775), recordMarketVisit (778-783).
- src/sim/walkers.ts — WalkerInstance incl. marketId/reservedGranaryId/
  carryingLoad (27-57), SimInternals (115-127), decideBuyer (289-318),
  decideSeller (326-340), deliverToAdjacentHouses (205-230), releaseWalkerLoad
  (417-437), handleArrival buyer deposit (485-494), marketFoodState (372-382),
  pickBuyerGranary (385-401), BUYER_FETCH_AMOUNT 40 (279), FOOD_KEYS (277).
- src/sim/runner.ts — tickSpawns (734-765, spawns 'market' for markets at 748),
  tickFood (792-814), getState/getStateJson, SimRunner class; NO MarketConfig
  reference anywhere.
- src/sim/walkerProfiles.ts — CATEGORY_BY_ID: market 'destination', buyer
  'destination', seller 'wandering' (39-54); walkerProfile (98-108).
- src/sim/types.ts — WalkerType incl. 'buyer' | 'seller' (34).
- src/sim/housingEvolution.ts — evolution requirements from requiresGoods
  (53); data/housing.ts requiresGoods per level incl. pottery/furniture/wine/oil
  (23-43) — the "evolution-blocking good" source.
- Data catalogs: data/walkers.ts market def only (17) — no buyer/seller entries;
  data/commodities.ts storage 'granary' foods vs 'warehouse' goods (26-196);
  data/buildings.ts market 2x2 commerce (112-115).
- Tests: tests/unit/logistics.test.ts (market reservation 46-55, distribution
  priority 57-62, per-market config 67-76, market buyer 78-90, market demand &
  distribution 303-404), tests/integration/food-slice.test.ts (WR-02 120-192,
  §32.1 195-251, §32.3 274-294), tests/integration/food-chain.test.ts (legacy
  market walker 5-28), tests/helpers.ts (runScenario 12, foodChainMap 26,
  buildFoodCity 37), tests/determinism/warehouse-logistics-determinism.test.ts.

### Established Patterns
- Deterministic seeded sim core under src/sim/; Phaser view-only.
- Physical loads move by walkers — never teleported (core value).
- Phases 5-7 pattern: additive model functions + runner tick wiring + test
  matrices; verify-as-built audits first; per-task sampling on a ~4s suite.
- `marketFoodState`/`decideBuyer`/`decideSeller` are testable via `updateWalker`
  against a `SimInternals` stub (food-slice.test.ts pattern) or a built runner.

### Integration Points
- `SimRunner` gains an additive per-market config registry
  (`setMarketConfig`/`marketConfig`) defaulting to `defaultMarketConfig()`.
- `SimInternals` gains an optional `marketConfig?(id)` hook so walkers read
  per-market config (unconfigured → legacy behavior).
- `src/sim/logistics.ts` gains additive `marketNeedsRestock` (targetStock) and
  `marketLoadComposition` (config-driven seller priorities); `findSupplier`
  gains an optional trailing `preferredSupplier` param (additive, existing
  calls unaffected).
- Walker buyer/seller paths honor an explicitly-set per-market config (buyer
  radius, refused-product gate, target stock) via the `SimInternals` hook.
</code_context>

<specifics>
## Specific Ideas

No additional requirements beyond game.md §18, fodd-supply-chain.md §12, and the
five PRE-ACCEPTED decisions above. Every listed decision is accepted as-is and
reflected verbatim in the plans; there are no grey areas awaiting user input.
</specifics>

<deferred>
## Deferred Ideas

- Buyer fetching **manufactured goods from warehouses** (§18.1 "procura bens em
  armazéns") and the warehouse-good market stock classes (ceramics, furniture,
  oil, wine beyond the existing food stock) — deferred to Phase 9
  (external trade / upstream goods routing); productRules gate covers goods at
  the acceptance model level only.
- Runner **spawner** swap from the legacy `market` wheat walker to an
  auto-spawned buyer/seller population for real cities (tickSpawns,
  runner.ts:748) — deferred; this phase proves the chain against runner
  structures without changing who `tickSpawns` emits.
- Seller route-preference / "destacar rota do vendedor" / service
  radius-selection beyond adjacency (§12.12, §18.5) — deferred.
- §18.2 market inspector display (Mostrar: quantidade, capacidade, consumo
  recente, casas atendidas, produto mais solicitado, fornecedor atual,
  comprador/vendedor em viagem) and the UI tela do mercado — future Phase 18
  management UI (advisors.ts marketInspection, advisors.ts:178-179 exists as a
  stub projection).
- Per-food cap persistence through save/load and player-editable capacity
  limits (§12.4 "O jogador pode alterar os limites") — deferred to the
  management-UI/config-serialization phase.
</deferred>
