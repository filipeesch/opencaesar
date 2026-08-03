---
phase: 09-external-trade
plan: 09-plan
type: feature (multi-wave: 09-W1..09-W4)
wave: 0
depends_on: [08-03, 07-03]
files_modified:
  - data/trade.ts
  - data/validate.ts
  - data/balance.ts
  - src/sim/trade.ts
  - src/sim/types.ts
  - src/sim/walkers.ts
  - src/sim/walkerProfiles.ts
  - src/sim/runner.ts
  - src/sim/advisors.ts
  - tests/unit/trade-catalog.test.ts
  - tests/unit/trade-orders.test.ts
  - tests/unit/trade-quotas.test.ts
  - tests/unit/trade-prices.test.ts
  - tests/unit/trade-walkers.test.ts
  - tests/integration/trade-transport.test.ts
  - tests/integration/trade-runner.test.ts
  - tests/unit/trade-advisor.test.ts
  - tests/determinism/trade-determinism.test.ts
autonomous: true
requirements: [TRAD-01, TRAD-02, TRAD-03, TRAD-04, TRAD-05]
must_haves:
  truths:
    - "TRAD-01 regional map catalog is real and validated: `data/trade.ts` gains the §19.1 fields per city (landOrSea, routeOpeningCost, merchantFrequency, annualQuotaPerGood, priceModifiers, relationship, events) and `data/validate.ts` rejects a city whose opening cost <= 0, empty buys, invalid landOrSea, or missing relationship — the Phase-2 load-time guard (DATA-01) is extended, not bypassed."
    - "TRAD-02 is behavior-bearing: opening a route charges routeOpeningCost to the treasury, and per-good order modes (no_trade / export_all / export_above_reserve / import_upto_target / stockpile) default to no_trade; setting an order actually drives physical goods movement through dispatched caravans/ships — never an abstract ledger (SC1)."
    - "Disposition: REQUIREMENTS.md lists `priority` among per-commodity trade orders, but the classic Caesar 3 order-mode model (implemented here) has no priority mode; `priority` is explicitly out of scope for TRAD-02 and documented here to avoid silent requirements drift."
    - "TRAD-03 is physical: caravans carry up to 8 loads over the road graph to a road-connected warehouse/Commercial Center (no valid road → wait a limited window then leave without trading, §19.3); merchant ships carry up to 16 loads, require a free wharf berth (queue when full), cannot pass a low bridge, and stage cargo through an entrepot — capacity and berth/road rules gate real transport (SC2)."
    - "TRAD-04 is per-route per-good: `usedQuota` counts against `annualQuotaPerGood`; hitting the cap suspends ONLY that good's transactions while others continue; quotas reset at the tick-based year rollover (Math.floor(tick/360)) driven by the runner year clock (SC3)."
    - "TRAD-05 price state per good/city has base (commodities catalog, import > export for every good), history ring, trend, and event/relationship modifiers; import price always exceeds export price for the same good; transactions gate deterministically: export requires the good exists, is not reserved/stockpiled, is above the export threshold, quota remains, merchant has capacity, storage is reachable; import requires stock below target, quota remains, treasury covers it, accepting storage exists (SC3)."
    - "Determinism & goldens preserved: every trade path is tick-based or seeded-RNG only (no Math.random/Date.now, no unseeded iteration order — routes iterate in stable catalog order, buildings in placement order); the SimState shape is NOT extended (trade runtime state lives in the runner and is exposed only via additive accessors), so both golden fixtures regenerate-free and all 564 baseline tests stay green."
    - "No military tokens: new identifiers (caravan, merchant_ship, wharf, entrepot, quota, stockpile) keep `npm run check:military` clean; advisor/UI data is live-derived from runner trade state, never fabricated."
  artifacts:
    - path: data/trade.ts
      provides: "Extended TradeCityDef with §19.1 fields (landOrSea, routeOpeningCost, merchantFrequency, annualQuotaPerGood, priceModifiers, relationship, events) on every city"
      min_lines: 25
    - path: data/validate.ts
      provides: "Extended TRADE_CITIES validation: positive opening cost, non-empty buys, valid landOrSea, priceModifiers coverage for bought/sold goods"
      min_lines: 10
    - path: src/sim/trade.ts
      provides: "Additive order-mode model (TradeOrderMode, per-good order table, resolveTradeOrder), transaction gating (tradeExportAllowed/tradeImportAllowed per §19.9), route-open surface (openTradeRoute), per-good quota counters + resetAnnualQuotas, and the price state model (TradePriceState, sampleTradePrice, priceTrend, applyPriceEvent) — all existing exports (tickTrade/setImportOrder/tradePrice/exportableSurplus/dangerousExport/importDestinationPriority) unchanged"
      min_lines: 60
    - path: src/sim/types.ts
      provides: "Additive: TradeRoute gains optional order/quota fields; WalkerType union gains 'caravan' | 'ship' (no exhaustive switch must change)"
      min_lines: 10
    - path: src/sim/walkers.ts
      provides: "Additive caravan/ship branches in decide/handleArrival/releaseWalkerLoad using startSeeking/findRoadPath; capacity + load/unload; ship berth queue via transport.ts; legacy buyer/seller paths byte-identical"
      min_lines: 60
    - path: src/sim/runner.ts
      provides: "Trade runtime: openTradeRoute (charges cost), setTradeOrder, per-good quota reset on the tick-based year clock, tickTradeSystem dispatch of caravan/ship walkers driven by orders+quotas+prices against real warehouse/granary stock, getTradeAdvisor accessor, simInternals trade hooks"
      min_lines: 40
    - path: src/sim/advisors.ts
      provides: "tradeAdvisorFromState projection deriving TradeAdvisorView live from runner trade state (routes, orders, per-good prices base/history/trend, quota used/total)"
      min_lines: 25
  key_links:
    - from: src/sim/trade.ts
      to: src/sim/trade.ts
      via: "new order/quota/price surfaces build alongside the existing tickTrade ledger (trade.ts:62-118); exportableAboveMonths (142) and dangerousExport (166) stay authoritative for reserve-aware export thresholds"
    - from: src/sim/trade.ts
      to: data/commodities.ts
      via: "price base reads CommodityDef.baseImportPrice/baseExportPrice (commodities.ts:16-18) which already satisfy import > export for every good"
    - from: src/sim/walkers.ts
      to: src/sim/walkers.ts
      via: "caravan/ship reuse startSeeking (walkers.ts:485-497), handleArrival (503-548), releaseWalkerLoad (462-482), releaseWalkerLoad returning product on expiry — the buyer/seller no-loss guarantee (WR-02)"
    - from: src/sim/walkers.ts
      to: src/sim/transport.ts
      via: "caravanStep (transport.ts:26-34) and shipDocks/Berth (36-68) drive caravan/ship lifecycle; SHIP_CAPACITY 16 / CARAVAN_CAPACITY 8 (9-10) are the load ceilings"
    - from: src/sim/runner.ts
      to: src/sim/runner.ts
      via: "tickTradeSystem (runner.ts:255-285) grows from the wheat-only stub to order/quota/price-driven walker dispatch; year clock Math.floor(tickCount/360) (262) drives quota reset"
    - from: src/sim/runner.ts
      to: src/sim/advisors.ts
      via: "getTradeAdvisor delegates to tradeAdvisorFromState (advisors.ts), mirroring getLogisticsAdvisor (runner.ts:358-360)"
---

<objective>
Gap-fill External Trade (TRAD-01..05) on a working sim that already carries a
**stubbed** trade layer, not a rebuild. RESEARCH verified against the real tree:
(1) `data/trade.ts` has only the minimal `TradeCityDef` (id/name/distance/buys/
sells/priceModifier) — the §19.1 regional-map fields (landOrSea, opening cost,
merchant frequency, per-good quota caps, price modifiers, relationship, events)
do not exist (TRAD-01); (2) `src/sim/trade.ts` has an abstract `tickTrade`
ledger (trade.ts:62-118) plus `setImportOrder`/`setTradeRoute`, but no per-good
**order modes** (export all / export above reserve / import up to target /
stockpile) and the runner only ever wires WHEAT into it (runner.ts:255-285) —
opening a route never moves real multi-good stock, and orders never dispatch
transport (TRAD-02); (3) `src/sim/transport.ts` already models LandCaravan
(cap 8) / MerchantShip (cap 16) / Berth / Entrepot / FoodLoad state machines but
nothing in the walker/runner layer uses them — there is no physical movement, no
road/wharf gating, no berth queue (TRAD-03); (4) only a single per-route
`annualQuota` exists (trade.ts:13-17) — per-good quotas with per-good suspension
and year reset are missing (TRAD-04); (5) `tradePrice` (trade.ts:48-54) is a
single number — no history, trend, or event modifiers, and no transaction
gating beyond treasury (TRAD-05).

The plan is additive only: every existing export keeps its signature and
default behavior (tickTrade/setImportOrder/setTradeRoute/tradePrice keep their
legacy semantics so the 564-test baseline — including tests/trade.test.ts,
tests/integration/supply-chains.test.ts, tests/integration/food-slice.test.ts,
tests/unit/transport.test.ts, and the food-chain/paused-commands goldens — stays
green without regeneration). The SimState shape is untouched: trade runtime
lives on the runner and is exposed via new accessors (`openTradeRoute`,
`setTradeOrder`, `getTradeAdvisor`, `getTradeRoutes`), so JSON goldens
(`getStateJson`) are byte-identical.

Output: `.planning/phases/09-external-trade/09-PLAN.md` plus the wave breakdown
below. Baseline re-confirmed during research: `npm run test` = 77 files / 564
tests green; `npm run typecheck` clean.
</objective>

<execution_context>
@/Users/filipe.esch/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/filipe.esch/.config/opencode/gsd-core/references/gates.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/09-external-trade/09-CONTEXT.md
@.planning/phases/09-external-trade/09-VALIDATION.md
@.planning/phases/08-markets-home-distribution/08-02-PLAN.md
@.planning/phases/08-markets-home-distribution/08-03-PLAN.md

Existing implementation (verified against the tree):
- `data/trade.ts`: `TradeCityDef` (5-16) with id/name/distance/buys/sells/
  priceModifier; `TRADE_CITIES` (18-39) — massilia/caralis/londinium/tarraco;
  `tradeCityName` (41). `data/validate.ts` TRADE_CITIES check (90-94: distance>0,
  buys non-empty).
- `src/sim/trade.ts`: `TradeRouteState` (8-19), `createTradeRoutes` (21-27),
  `setTradeRoute` (29-34), `setImportOrder` (41-46), `tradePrice` (48-54),
  `tickTrade` (62-118, quota reset by year, per-route annualQuota cap),
  `exportableSurplus` (132-139), `exportableAboveMonths` (142-151),
  `dangerousExport` (166-184), `importDestinationPriority` (195-205).
- `src/sim/transport.ts`: `CARAVAN_CAPACITY` 8 / `SHIP_CAPACITY` 16 (9-10),
  `LandCaravan`/`createCaravan`/`caravanStep` (14-34), `MerchantShip`/
  `createShip`/`shipDocks` + `Berth` (36-68), `Entrepot`/`entrepotReceive`
  (70-79), `FoodLoad` state machine (104-168).
- `src/sim/runner.ts`: `tradeRoutes` field (666), `enableTrade`/`getTradeRoutes`
  (654-662), `tickTradeSystem` (255-285, wheat-only, `year = Math.floor(
  tickCount/360)` at 262), `simInternals` (1185-1198), `placeBuilding` stock init
  (483-487), `getWalkerInternals` (709-711), `tick` (201-245).
- `src/sim/walkers.ts`: `SimInternals` (115-133), `createWalker` (143),
  `updateWalker` (163), `decide` (260-265), `decideBuyer` (295-332),
  `handleArrival` (503-548), `releaseWalkerLoad` (462-482), `startSeeking`
  (485-497), `move` (566-618), `nearestMarket` (370-382); buyer/seller walker
  types already carry carryingGood/carriedAmount/carryingLoad/marketId.
- `src/sim/walkerProfiles.ts`: `CATEGORY_BY_ID` (39-54), `walkerProfile`
  (98-108), `WalkerProfile` (16-37). `src/sim/types.ts`: `WalkerType` (32-35),
  `TradeRoute` (146-157), `SimState` (175-191), `Good` (15).
- `data/commodities.ts`: `CommodityDef` with `baseImportPrice`/`baseExportPrice`
  (14-20) — import > export for every good.
- Advisor/live-derived pattern: `getLogisticsAdvisor` (runner.ts:358-360) +
  `logisticsAdvisorFromState` (advisors.ts import at runner.ts:68).
- Tests: `tests/trade.test.ts` (138 lines), `tests/unit/transport.test.ts`,
  `tests/integration/supply-chains.test.ts` (+food-slice), `tests/integration/
  production-chain.test.ts` (warehouse stock), `tests/determinism/
  market-chain-determinism.test.ts` (chunked pattern 1/7/50 + the no-RNG/clock
  source audit), `tests/golden/golden.test.ts` (fixtures food-chain-golden /
  paused-commands-golden), `tests/helpers.ts` (productionChainMap/
  buildProductionCity/foodChainMap/buildFoodCity).

Baseline: 77 files / 564 tests green, typecheck clean, check:military clean
(re-confirm the exact 564 count on 09-W1 task 1). Per-task sampling follows
09-VALIDATION.md.
</context>

# Phase 9 — External Trade Plan

## Goal

Make external trade **physical, order-driven, quota-capped, and price-gated** —
Regional map model (TRAD-01), route opening + per-commodity order modes that
actually move goods (TRAD-02), land caravans + merchant ships as real transports
with capacity and berth/road/wharf rules (TRAD-03), annual per-route quotas with
per-product suspension and year reset (TRAD-04), and import/export prices with
history/trend/modifiers that gate transactions (TRAD-05) — by gap-filling the
existing stub layer additively, keeping every one of the 564 baseline tests green
and the goldens byte-identical.

## Implementation decisions (from 09-CONTEXT, honored here)

- **Additive API only** — existing exported signatures and defaults stay stable;
  new surfaces are additive. `tickTrade`/`setImportOrder`/`setTradeRoute`/
  `tradePrice` keep legacy semantics (the abstract ledger remains the model
  contract for tests/food-slice/supply-chains) while the runner gains a new
  physical path.
- **Determinism** — trade dispatch is tick-scheduled (merchantFrequency, year
  rollover), pickups use stable iteration order (catalog order for routes,
  placement order for buildings), any tie-break uses `this.rng` (seeded). No
  Math.random/Date.now anywhere.
- **Goldens untouched** — SimState is NOT extended; trade runtime state lives on
  the runner and is readable via additive accessors only. Goldens regenerate
  only if a task intentionally changes a golden-scenario mechanic, which this
  plan avoids.
- **No military content** — check:military clean (new tokens are caravan /
  merchant_ship / wharf / entrepot / quota / stockpile, none forbidden).
- **Live-derived advisor/UI data** — trade advisor numbers come from runner
  state (routes, per-good price state, quota counters), never fabricated.
- **Reuse walker infra + data-catalog pattern** — caravan/ship are WalkerType
  members moving via `findRoadPath`; catalog + validation live in `data/` files
  and `data/validate.ts` (the real Phase-2 location — CONTEXT's "src/data/
  catalogs" path does not exist in this repo).

## Requirements mapping (TRAD-01..05 → implementation approach)

| Req | Gap (verified) | Implementation approach | Wave |
|-----|----------------|--------------------------|------|
| TRAD-01 | `data/trade.ts` lacks §19.1 fields; validation only checks distance/buys | Extend `TradeCityDef` (landOrSea, routeOpeningCost, merchantFrequency, annualQuotaPerGood, priceModifiers, relationship, events); extend `validateCatalogs()`; catalog test locks it | 09-W1 |
| TRAD-02 | No per-good order modes; runner moves only wheat abstractly | `TradeOrderMode` + per-good order table + `resolveTradeOrder` + `tradeExportAllowed`/`tradeImportAllowed` gating (§19.6/§19.9); `openTradeRoute`/`setTradeOrder` on the runner; orders drive physical dispatch | 09-W1, 09-W4 |
| TRAD-03 | `transport.ts` model unwired; no walker movement, no berth/road gating | `caravan`/`ship` WalkerType + walkerProfiles; decide/handleArrival load/unload with capacity; caravan road rule + ship berth queue (transport.ts `shipDocks`/`Berth`) + entrepot staging; integration test proves physical move | 09-W3 |
| TRAD-04 | Single per-route annualQuota; no per-good, no per-good suspension | Per-good `usedQuota` vs `annualQuotaPerGood`; `quotaSuspended(good)`, `resetAnnualQuotas(routes, year)` on the tick-based year clock | 09-W2 |
| TRAD-05 | `tradePrice` single number; no history/trend/modifiers; no gating | `TradePriceState` (base/history ring/trend/modifier); `sampleTradePrice`; `priceTrend`; event-modifier hook; import > export invariant; `tradeExportAllowed`/`tradeImportAllowed` gate transactions | 09-W2, 09-W4 |

## Success criteria — verification approach

Runner level (mirrors Phase 7/8):
1. **SC1** (orders affect movement): `tests/integration/trade-runner.test.ts` —
   open Massilia (pay cost), order `pottery: export_above_reserve(2)`,
   `wine: import_upto_target(3)`; after N ticks a caravan arrives at the
   road-connected warehouse, pottery stock falls physically to the reserve
   threshold while reserved/stockpiled goods are untouched, wine rises to the
   target, and treasury/route counters move accordingly; with `no_trade` set for
   a good, its stock never changes.
2. **SC2** (physical transport + berth/road rules): `tests/integration/
   trade-transport.test.ts` — a caravan carrying ≥1 pottery load keeps the goods
   on `WalkerInstance.carryingGood/carryingLoad` between entry and warehouse
   (nothing teleported, nothing lost, `releaseWalkerLoad` on expiry restores);
   a caravan with no road path waits ≤ `merchantWaitTicks` then despawns without
   trading (route stays open); a merchant ship queues behind a busy berth
   (`shipDocks` false → waiting) and unloads into the entrepot when a berth
   frees; ship capacity 16 vs caravan capacity 8.
3. **SC3** (quotas + prices + gating): `tests/unit/trade-quotas.test.ts`,
   `tests/unit/trade-prices.test.ts`, `tests/unit/trade-orders.test.ts` — per-good
   usedQuota vs annualQuotaPerGood suspends only that good; reset on year
   rollover; import price > export price (asserted as a data invariant for every
   commodity); price history advances deterministically; transaction gates
   (threshold/reserve/quota/capacity/reachable/treasury/target) verified.

Every wave leaves `npm run test` green (564 baseline + new tests) and
`npm run typecheck` clean; `npm run check:military` clean at the end of the
phase.

---

# Wave 09-W1 — Regional trade catalog & order/transaction model (TRAD-01, TRAD-02 model)

*Scope: data catalog + model surface only — no runner behavior changes yet; the
564-test baseline (re-confirmed in task 1) plus the new catalog/order tests must
be green at the end of this wave.*

<tasks>

<task type="auto">
  <name>09-W1-1: Extend the trade city catalog with §19.1 fields + load-time validation (TRAD-01, DATA-01)</name>
  <files>data/trade.ts, data/validate.ts, tests/unit/trade-catalog.test.ts</files>
  <read_first>data/trade.ts (TradeCityDef 5-16, TRADE_CITIES 18-39), data/validate.ts (validateCatalogs 49-112, TRADE_CITIES block 90-94), tests/catalog-load-guard.test.ts (guard-engaged pattern), tests/data-catalog.test.ts, 09-CONTEXT.md TRAD-01</read_first>
  <action>Baseline first: run `npm run typecheck` and `npm run test`, confirm 564 tests / 77 files green (record any delta). Do NOT touch src/ in this task.
  In data/trade.ts extend the catalog additively (keep `TradeCityDef` id/name/distance/buys/sells/tradeCityName and every export): (1) add fields to TradeCityDef: `landOrSea: 'land' | 'sea'`, `routeOpeningCost: number`, `merchantFrequency: number` (ticks between merchant arrivals), `annualQuotaPerGood?: number` (default per-good cap), `relationship: 'neutral' | 'friendly' | 'hostile'` (defensive, no military reading — business standing), `events?: string[]` (event keys, optional), and replace the single `priceModifier: number` usage by keeping it (back-compat) AND adding `priceModifiers?: Partial<Record<string, number>>` for per-good modifiers; (2) populate real §19.1 values on all four cities (massilia land, caralis sea, londinium sea, tarraco land; opening costs 500/800/1200/1500 respectively; merchantFrequency 160/220/300/420 ticks; annualQuotaPerGood 12/15/30/40 mirroring the spec §19.7 examples; relationships neutral; priceModifiers retained and mirrored into priceModifiers where sensible); (3) keep every field deterministic data.
  In data/validate.ts extend the TRADE_CITIES validation block (currently 90-94) so `validateCatalogs()` reports (never silently accepts): routeOpeningCost <= 0, empty buys OR sells, a landOrSea value outside 'land'|'sea', merchantFrequency <= 0, annualQuotaPerGood <= 0 when set, relationship outside neutral/friendly/hostile, and any bought/sold good missing from COMMODITIES.
  Create tests/unit/trade-catalog.test.ts importing TRADE_CITIES, validateCatalogs from '../../data/validate', and each city's TradeCityDef type: (1) every city has landOrSea in {'land','sea'}, a positive routeOpeningCost, a positive merchantFrequency, a non-empty buys and sells, a relationship, and buys/sells items all resolvable in COMMODITIES; (2) at least one sea city and one land city exist; (3) validateCatalogs() on the real catalog returns no 'trade' issues (the guard is green on valid data — the load-guard pattern from tests/catalog-load-guard.test.ts); (4) a probe corrupted catalog (clone with a city's routeOpeningCost 0, then empty buys, then landOrSea 'air', then annualQuotaPerGood -1) produces the corresponding 'trade' catalog issue — proving validation is engaged for the new fields; (5) tradeCityName('massilia') still resolves and an unknown id returns the id (legacy behavior unchanged).</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/trade-catalog.test.ts && npm run test</automated>
  </verify>
  <done>trade-catalog.test.ts passes proving the extended §19.1 catalog (landOrSea/routeOpeningCost/merchantFrequency/annualQuotaPerGood/relationship/priceModifiers) validates cleanly on the real catalog and rejects each corrupted field via validateCatalogs(); all 564 baseline tests + the new tests remain green (record the measured delta); typecheck clean.</done>
</task>

<task type="auto">
  <name>09-W1-2: Per-good trade order modes + §19.9 transaction gating model (TRAD-02, TRAD-05 gating, decision 8)</name>
  <files>src/sim/trade.ts, tests/unit/trade-orders.test.ts</files>
  <read_first>src/sim/trade.ts (TradeRouteState 8-19, createTradeRoutes 21-27, setTradeRoute 29, setImportOrder 41-46, tickTrade 62-118, exportableAboveMonths 142-151, dangerousExport 166-184), data/trade.ts (after 09-W1-1), data/commodities.ts (Good ids), 09-CONTEXT.md TRAD-02 + decision 8</read_first>
  <action>Read src/sim/trade.ts before editing. Add the §19.6/§19.9 model to src/sim/trade.ts, additive only — do NOT change the signatures or default behavior of the existing exports (tests/trade.test.ts:8-138, supply-chains.test.ts:72-80, food-slice.test.ts:341-362 depend on them). Additions:
  (1) `export type TradeOrderMode = 'no_trade' | 'export_all' | 'export_above_reserve' | 'import_upto_target' | 'stockpile'`;
  (2) extend `TradeRouteState` with optional additive fields: `orders?: Partial<Record<string, TradeOrderMode>>`, `exportReserve?: Partial<Record<string, number>>` (threshold in loads for export_above_reserve), `importTargets?: Partial<Record<string, number>>` (target stock for import_upto_target), `perGoodQuota?: Partial<Record<string, number>>`, `usedPerGood?: Partial<Record<string, number>>`, `openYear?: number` — all optional so `createTradeRoutes()` output and legacy reads are unchanged;
  (3) `export function resolveTradeOrder(route, good): TradeOrderMode` returning `route.orders?.[good] ?? 'no_trade'`;
  (4) `export function exportAllowed(order, reserve, stock, reserved): boolean` — no_trade/stockpile → false; export_all → stock > reserved; export_above_reserve → (stock - reserved) >= reserve (the §19.6 'exportar acima de 12 cargas' threshold) — exports only the surplus above `reserve`/`reserved`;
  (5) `export function tradeExportGate(g: { order; stock; reserved; quotaLeft; }): { allowed: boolean; reason: string | null }` implementing §19.9 export conditions (exists, not reserved, threshold reached, quota available) and `importGatedBy(g: { order; stock; target; quotaLeft; treasury; price; })` for import conditions (below target, quota available, treasury covers, storage will be asserted at the runner) — both pure and deterministic;
  (6) keep `tickTrade` as-is (the legacy abstract ledger still honors setImportOrder targets and the per-route annualQuota so existing tests stay green).
  Create tests/unit/trade-orders.test.ts importing the new surface + existing createTradeRoutes/setTradeRoute/setImportOrder: (1) resolveTradeOrder defaults to 'no_trade' and returns the configured mode; (2) exportAllowed matrix — stockpile/no_trade never export, export_all exports any unreserved stock, export_above_reserve with reserve 2 and stock 3 exports 1 (surplus above threshold) and with stock 2 exports 0; reserved units are never exportable even under export_all; (3) tradeExportGate reasons: 'no_stock' / 'reserved' / 'below_threshold' / 'quota_exhausted' / 'ok' for the §19.9 conditions; (4) import gating: below-target + quota + affordable → allowed, at/above target → 'at_target', quota exhausted → 'quota_exhausted', price > treasury → 'unaffordable'; (5) the existing legacy path is unchanged — createTradeRoutes() output has no orders (all goods no_trade) and setImportOrder/setTradeRoute still work exactly as before (re-assert the trade.test.ts 'import gating by order' expectations against tickTrade).</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/trade-orders.test.ts && npx vitest run tests/trade.test.ts</automated>
  </verify>
  <done>trade-orders.test.ts passes covering the full order-mode matrix (no_trade/export_all/export_above_reserve/import_upto_target/stockpile), reserve-aware export thresholds, and the §19.9 transaction gates (export: exists/reserved/threshold/quota; import: below-target/quota/affordable) — all pure and deterministic; the legacy trade surface (tickTrade/setImportOrder/setTradeRoute/tradePrice) is unchanged and tests/trade.test.ts stays green; typecheck clean.</done>
</task>

</tasks>

---

# Wave 09-W2 — Per-good quotas & price model (TRAD-04, TRAD-05 model)

*Scope: model additions to src/sim/trade.ts + balance/catalog constants + unit
tests. No runner behavior changes; baseline + new tests green at wave end.*

<tasks>

<task type="auto">
  <name>09-W2-1: Per-route per-good annual quotas with per-good suspension and tick-based year reset (TRAD-04)</name>
  <files>src/sim/trade.ts, tests/unit/trade-quotas.test.ts</files>
  <read_first>src/sim/trade.ts (TradeRouteState 8-19, tickTrade quota reset 75-81, per-route annualQuota cap 81-97), runner.ts year clock (tickTradeSystem 262, use only the Math.floor(tick/360) convention), 09-CONTEXT.md TRAD-04</read_first>
  <action>Read src/sim/trade.ts before editing. Add the §19.7 quota surface, additive, keeping every existing export intact (tickTrade's own legacy per-route annualQuota behavior at 81-97 must remain untouched). Add to src/sim/trade.ts:
  (1) `export function quotaFor(route, good): number` — per-good cap from `route.perGoodQuota?.[good] ?? route.annualQuotaPerGoodResolved` (the catalog `annualQuotaPerGood`, carried via `route.catalogQuota`), else the legacy `route.annualQuota ?? 0` (0 = unlimited);
  (2) `export function quotaRemaining(route, good): number` — `quotaFor - (route.usedPerGood?.[good] ?? 0)`, capped at 0 when quarterly/quota exhausted;
  (3) `export function quotaSuspended(route, good): boolean` — true exactly when quotaFor > 0 and usedPerGood >= quotaFor (per-good suspension only: other goods on the same route keep trading — spec §19.7);
  (4) `export function consumeQuota(route, good, amount): void` — increments usedPerGood (additive helper the runner calls on a completed export/import leg);
  (5) `export function resetAnnualQuotas(routes, year): number` — for every route, when `openYear`/`lastYear` differs from `year`, zero `usedPerGood` and `usedQuota` and record the new year; deterministic, iterates `Object.values(routes)` (stable insertion order), returns how many routes were reset.
  Create tests/unit/trade-quotas.test.ts: (1) quotaFor resolves per-good override > catalog default > legacy annualQuota > 0 (unlimited); (2) quotaRemaining counts down via consumeQuota and clamps at 0; (3) quotaSuspended turns true for a good at its cap and leaves OTHER goods on the same route unsuspended (per-good isolation — a pottery cap of 12 must not suspend wine); (4) resetAnnualQuotas(routes, 1) resets usedPerGood/usedQuota only when the year changed and reports the count; a second call in the same year resets nothing; (5) determinism — two identical route maps reset identically for identical (routes, year) and the legacy tickTrade quota test (tests/trade.test.ts 'caps annual exports...') remains green (its single annualQuota path is untouched); (6) no Math.random/Date appears in the new surface (source read asserted by the determinism audit in 09-W4-2 as a belt-and-braces).</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/trade-quotas.test.ts && npx vitest run tests/trade.test.ts</automated>
  </verify>
  <done>trade-quotas.test.ts passes proving per-good quota caps with per-good-only suspension (a capped good suspends nothing else on the route), countdown/remaining clamping, and deterministic year-reset via resetAnnualQuotas on the Math.floor(tick/360) convention; the legacy tickTrade annualQuota behavior is untouched and tests/trade.test.ts stays green; typecheck clean.</done>
</task>

<task type="auto">
  <name>09-W2-2: Price model — base/history/trend/modifiers, import>export invariant, deterministic sampling (TRAD-05)</name>
  <files>src/sim/trade.ts, data/balance.ts, tests/unit/trade-prices.test.ts</files>
  <read_first>src/sim/trade.ts (tradePrice 48-54, used by trade.test.ts:22 and supply-chains.test.ts:80), data/commodities.ts (CommodityDef 14-20 baseImportPrice/baseExportPrice — verify import > export for every good), data/balance.ts (add-only — balance-parity keeps existing keys), 09-CONTEXT.md TRAD-05</read_first>
  <action>Read src/sim/trade.ts, data/commodities.ts and data/balance.ts before editing. Keep `tradePrice` (48-54) exactly as-is (used by existing tests). Add, additive and pure, to src/sim/trade.ts:
  (1) `export interface TradePriceState { base: number; history: number[]; trend: 'rising' | 'steady' | 'falling'; modifier: number; }` — base from CommodityDef (import uses baseImportPrice, export uses baseExportPrice so import > export always holds), history is a ring of recent sampled prices (deterministic, tick-indexed — no wall clock), manager of a `modifier` (>0 premium, <0 discount) applied multiplicatively;
  (2) `export function createTradePriceState(base: number, historySize = 8): TradePriceState`;
  (3) `export function sampleTradePrice(state, price, at: number): void` — push `price` into the history ring keyed by monotonically increasing `at` (injected tick); no Date.now;
  (4) `export function priceTrend(state, at: number): 'rising' | 'steady' | 'falling'` — compare the latest history entry against the entry `window` steps earlier (steady within ±1 denarius);
  (5) `export function effectivePrice(state, at: number): number` — `Math.round(base * modifier)` combined with the deviation implied by the last sampled price (±, clamp at >=1);
  (6) `export function applyPriceEvent(state, delta, at): void` — deterministic event/shortage modifier entry (additive glue for the Phase-15 event engine; callable with a fixed delta now).
  In data/balance.ts add a `trade:` group of NEW keys only (never touch existing keys — balance-parity.test.ts enforces every key is consumed): `tradePriceHistoryWindow: 8`, `tradePriceSteadyTolerance: 1`, `tradePriceFloor: 1` and `merchantWaitTicks: 120` (caravan no-road wait window, §19.3) — these feed the new model and the 09-W3 walker gating.
  Create tests/unit/trade-prices.test.ts: (1) data invariant — every commodity in COMMODITIES satisfies baseImportPrice > baseExportPrice (TRAD-05 import-vs-export difference, sourced from the catalog); (2) createTradePriceState holds base and an empty history; (3) sampleTradePrice with injected ticks pushes deterministic history (identical (price, at) sequences → identical history), and repeats at the same `at` do not duplicate the ring; (4) priceTrend across window returns rising/steady/falling per the tolerance from BALANCE; (5) effectivePrice = round(base × modifier) with clamping at the floor and never ≤ 0; (6) applyPriceEvent with a positive delta raises effectivePrice and a negative delta lowers it, deterministically, and does not write into the history; (7) `tradePrice('wheat','massilia',true)` still returns the legacy value (unchanged export surface).</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/trade-prices.test.ts && npx vitest run tests/trade.test.ts</automated>
  </verify>
  <done>trade-prices.test.ts passes proving the additive TradePriceState model (base/history ring/trend/modifier/effective price) is deterministic under injected ticks, the import>export catalog invariant holds for every commodity, event modifiers shift effective prices both directions without polluting history, the new BALANCE.trade keys are consumed (balance-parity green), and the legacy tradePrice export is unchanged; typecheck clean.</done>
</task>

</tasks>

---

# Wave 09-W3 — Trade transport walkers: caravans & merchant ships (TRAD-03)

*Scope: new WalkerType members + walkerProfiles + walkers.ts branches + the
existing transport.ts model wired in. Caravan/ship behavior is purely additive —
legacy buyer/seller/market/labor walkers keep byte-identical behavior.*

<tasks>

<task type="auto">
  <name>09-W3-1: caravan/ship WalkerType members + walkerProfiles + decide/handleArrival load & unload with capacity (TRAD-03)</name>
  <files>src/sim/types.ts, src/sim/walkerProfiles.ts, src/sim/walkers.ts, tests/unit/trade-walkers.test.ts</files>
  <read_first>src/sim/types.ts (WalkerType 32-35 — union, additive members are safe: no exhaustive switch covers it; checked this phase), src/sim/walkerProfiles.ts (CATEGORY_BY_ID 39-54, walkerProfile 98-108), src/sim/walkers.ts (SimInternals 115-133, createWalker 143, updateWalker 163, decide 260-265, decideBuyer 295-332 as the load/unload template, handleArrival 503-548, releaseWalkerLoad 462-482, startSeeking 485-497, move 566-618), src/sim/transport.ts (CARAVAN_CAPACITY 9, SHIP_CAPACITY 10, caravanStep 26-34, shipDocks/Berth 36-68, entrepotReceive 75-79), tests/determinism/market-chain-determinism.test.ts (micro-sequence stub pattern 64-174)</read_first>
  <action>Read src/sim/types.ts, src/sim/walkerProfiles.ts, src/sim/walkers.ts and src/sim/transport.ts before editing. All changes additive; the existing walker paths (well/market/labor/buyer/seller/clinic/...) must stay byte-identical.
  (1) types.ts: append `| 'caravan' | 'ship'` to the `WalkerType` union (line 32-35). Additive union member — no other source change required (verified no exhaustive switch over WalkerType).
  (2) walkerProfiles.ts: add `caravan: 'destination'` and `ship: 'destination'` to `CATEGORY_BY_ID` (39-54) so both get a destination-style profile (path-seeking, roadblock pass) and keep the catalog `walkerProfile` fallback untouched; `destination` uses returnPolicy false — walkers leave the map after trading.
  (3) walkers.ts — additive branches, no change to existing behavior:
     a. Extend `WalkerInstance` (27-57) with an optional `trade?: { routeCityId: string; good: string; amount: number; isExport: boolean; capacity: number; ship?: boolean }` payload (additive optional field).
     b. `decide` (260-265): add `else if (w.type === 'caravan' || w.type === 'ship') decideTrade(sim, w, profile)`.
     c. `decideTrade`: when `w.trade` is set and the walker has nothing yet loaded, seek the determined building (for a caravan in-the-city leg just-entered, the road-connected warehouse / Commercial Center via `startSeeking`; for a ship with a free berth, the wharf staging is modeled through the transport state — see 09-W3-2 integration for the wharf, berth-level behavior is driven by `shipDocks` at arrival); when the walker holds a load, seek a second stop (entrance/exit) and despawn on return (walker leaves the map).
     d. `handleArrival` (503-548): add caravan/ship branches that UNLOAD imported goods into the target building's stock (via the existing `writeFood`/stock pattern — warehouses/granaries) and LOAD export goods out of the accepting stock into `w.carryingGood`/`carriedAmount`, bounded by `w.trade.capacity` and per-good stock; a ship whose `shipDocks` check returns false (berth full / low bridge) waits (no movement that tick) instead of unloading — the berth/inUse state is read-only consulted via the transport `Berth` passed through `w.trade`.
     e. `releaseWalkerLoad` (462-482): add a caravan/ship clause so any unloaded export still on the walker returns to its source stock when the trip fails/expires (never loses product — mirrors WR-02 for the legacy buyer/seller).
     f. `applyCoverage` / service paths: explicitly no-op for caravan/ship (they deliver goods, not services) — leave existing if/else chain such that caravan/ship fall through without applying service coverage.
     No Math.random, no Date; movement reuses `move` (566-618) which is profile-driven and seeded-RNG only for wandering (caravans are destination-type so path-follow).
  Create tests/unit/trade-walkers.test.ts mirroring the market-chain-determinism micro-sequence stub (loopMap + stubBuilding + SimInternals): (1) a `createWalker('caravan', ...)` with a trade payload bounded to capacity 8 loads, stepped via `updateWalker`, reserves/collects an export from a warehouse at the source, carries `carriedAmount <= 8` (capacity respected), deposits it at the destination warehouse and despawns — nothing teleported, nothing lost; (2) the same sequence with a ship (capacity 16) — 16-capacity honored; (3) a caravan with `trade.isExport` true and a stock-poor warehouse loads only what exists (never negative); (4) a failing trip (destination unreachable) restores the held units to the source via the caravan releaseWalkerLoad branch; (5) legacy regression — a `createWalker('buyer')`/`seller` on the same stub reproduces the market-chain-determinism expectations (granary 100 → 60 after a buyer fetch; seller delivers 1 wheat to an adjacent house) proving the new branches did not perturb the buyer/seller path; (6) createWalker('caravan') serializes through `toWalkerState`-shaped fields (id/type/x/y/next/progress/state/lifetime/targetBuildingId/carryingGood present) so getState() rendering never crashes.</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/trade-walkers.test.ts && npx vitest run tests/unit/transport.test.ts</automated>
  </verify>
  <done>trade-walkers.test.ts passes proving caravan (cap 8) and ship (cap 16) walkers physically carry trade loads between source and destination with capacity enforcement, no-loss restoration on failed trips, and untouched legacy buyer/seller behavior (market-chain micro-sequence expectations re-asserted); transport.test.ts and the full baseline stay green; typecheck clean.</done>
</task>

<task type="auto">
  <name>09-W3-2: Integration — caravans move goods entry↔warehouse via the road graph; ships queue at the berth and unload via a wharf/entrepot (TRAD-03, SC2)</name>
  <files>tests/integration/trade-transport.test.ts</files>
  <read_first>tests/integration/market-chain.test.ts (runner-integrated walker pattern using getWalkerInternals(), 08-02), tests/helpers.ts (productionChainMap 64-77, buildProductionCity 86-111), tests/integration/warehouse-runner.test.ts (disconnected-warehouse road gating pattern), src/sim/transport.ts (shipDocks/Berth 36-68, entrepotReceive 75-79), 09-CONTEXT.md TRAD-03</read_first>
  <action>Read the integration patterns (market-chain.test.ts, warehouse-runner.test.ts) and src/sim/transport.ts before writing. Build the physical-transport proof against runner state using the region-entry helper from 09-W4 (or, if not yet wired, drive the walkers directly via `getWalkerInternals()` exactly like market-chain.test.ts does — this task is the transport proof, runner dispatch is 09-W4-1). Create tests/integration/trade-transport.test.ts:
  Scenario A 'caravan moves goods over the road graph with capacity': build a production city (buildProductionCity) with a pottery-producing clay pit + pottery workshop + a road-connected warehouse; stock the warehouse with pottery (tick until stock > 0); place a caravan at an entry road tile with a trade payload { good: 'pottery', amount: min(stock, 8), isExport: true, capacity: 8 }; step via updateWalker/getWalkerInternals(); assert the warehouse pottery falls only on collection (departure) and the walker carries exactly the loads — assert at no tick the goods exist BOTH at the warehouse and the walker (no duplication) and never exceed 8 (capacity); destination deposit raises the destination stock by exactly the carried amount (nothing teleported).
  Scenario B 'a caravan with no valid road waits a limited window then leaves without trading, route stays open (§19.3)': place the target warehouse in a disconnected pocket (isolated road, no path from the entry); step the caravan past `merchantWaitTicks`; assert it despawns without changing any warehouse stock and that the runner route (if exposed) remains enabled — no trade, no loss.
  Scenario C 'merchant ship queues at a busy berth and unloads only when a berth frees': using transport.ts Berth + MerchantShip state, simulate two ships against a 1-berth wharf — assert shipDocks(second) === false (waiting) while the first occupies the berth, and that freeing the berth (berth.inUse -= 1) lets the second dock; then an entrepot (capacity ≥ imports) receives the unload via entrepotReceive and never buffers more than capacity.
  Scenario D 'no teleport/no-loss across the whole leg': a caravan mid-journey is expired (lifetime → 0 via updateWalker) — the carried export is restored to the source warehouse and nothing disappears (WR-02 trade extension).
  Keep tests/integration/market-chain.test.ts and tests/integration/warehouse-runner.test.ts green unchanged.</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/integration/trade-transport.test.ts && npm run test</automated>
  </verify>
  <done>trade-transport.test.ts passes proving physical, capacity-bounded transport: caravans carry goods over the road graph between entry and warehouse with no duplication/teleport/loss, a no-road caravan waits `merchantWaitTicks` then leaves without trading (route stays open), a second ship queues at a full berth and unloads only when the berth frees, and the entrepot never buffers past capacity; the full suite stays green; typecheck clean.</done>
</task>

</tasks>

---

# Wave 09-W4 — Runner wiring: orders drive physical movement, quotas, prices, advisor + determinism (TRAD-02/04/05 runtime, SC1, SC3)

*Scope: the capstone — tickTradeSystem grows from the wheat-only stub into the
order/quota/price-driven dispatcher that spawns caravan/ship walkers against
real warehouse/granary stock; new runner accessors + live trade advisor; chunked
determinism. This wave is where opening a route + setting orders affects actual
goods movement (SC1).*

<tasks>

<task type="auto">
  <name>09-W4-1: Runner trade runtime — openTradeRoute/setTradeOrder + order/quota/price-driven walker dispatch (TRAD-02/04/05 runtime, SC1)</name>
  <files>src/sim/runner.ts, src/sim/types.ts, tests/integration/trade-runner.test.ts</files>
  <read_first>src/sim/runner.ts (tradeRoutes 666, enableTrade/getTradeRoutes 654-662, tickTradeSystem 255-285, tick order 201-245 with year at 262, simInternals 1185-1198, tickProduction warehouse candidates 1062-1088, placeBuilding stock init 483-487, getWalkerInternals 709-711), src/sim/trade.ts (after 09-W1/W2: resolveTradeOrder/tradeExportGate/importGatedBy/quotaFor/quotaSuspended/consumeQuota/resetAnnualQuotas/createTradePriceState/sampleTradePrice/effectivePrice), src/sim/types.ts (TradeRoute 146-157 — add the optional additive order/quota fields here too so getTradeRoutes() reflects them), 09-CONTEXT.md decisions 2+8</read_first>
  <action>Read src/sim/runner.ts, src/sim/trade.ts and src/sim/types.ts before editing. All changes additive; `enableTrade` and `getTradeRoutes` must keep their signatures (runner-accessors.test.ts:39-45,139-149 depends on them). Do NOT extend `SimState` (getState shape is frozen so both golden fixtures regenerate-free).
  (1) types.ts: extend the `TradeRoute` interface (146-157) with the same optional additive fields as `TradeRouteState` (orders/exportReserve/importTargets/perGoodQuota/usedPerGood/openYear) — additive optionals, so existing construction sites compile unchanged.
  (2) runner.ts — trade state: hold per-route per-good `TradePriceState` on the runner (`private tradePrices = new Map<string, Map<string, TradePriceState>>()`, keyed cityId → good); derive base prices from COMMODITIES (import = baseImportPrice, export = baseExportPrice — import > export invariant) applying the city catalog `priceModifiers`/`priceModifiers`; sample `effectivePrice` each tick using `this.tickCount` as the deterministic `at` (no clock); apply any `applyPriceEvent` deltas deterministically by tick/event state.
  (3) runner.ts — route API: add `openTradeRoute(cityId: string): { ok: boolean; cost: number; error?: string }` that charges `routeOpeningCost` from the treasury, marks the route enabled, records `openYear = Math.floor(this.tickCount/360)`, and initialises the per-good order table to default `'no_trade'` (TRAD-02: opening never forces a transaction); add `setTradeOrder(cityId, good, mode, opts?: { reserve?: number; target?: number })` that validates against the city's buys/sells (do not allow an order for a good the city neither buys nor sells) and stores it; keep `enableTrade(cityId, enabled)` as a thin wrapper so the existing accessor tests stay green.
  (4) runner.ts — year clock + quotas: in `tickTradeSystem` (255-285) call `resetAnnualQuotas(this.tradeRoutes, year)` each tick (cheap, no-op except at rollover) so per-good quotas reset at the tick-based year, then evaluate each enabled route's enabled goods in stable catalog order; for each good use `resolveTradeOrder` + `tradeExportGate`/`importGatedBy` + `quotaSuspended` to decide whether to dispatch; when authorised, spawn a `caravan`/`ship` walker (land/sea per the city's `landOrSea`) at the regional entry (a road tile adjacent to the map border for caravans; a water-edge tile conceptually for ships) with a trade payload bounded by the transport capacity, target the road-connected warehouse/Commercial Center (`warehouseCandidates`-style reachability via `findRoadPath`), and `consumeQuota` on delivery. Replace the old wheat-only body with this multi-good path for cities that have orders; keep the legacy per-route behavior for cities that only use setImportOrder/setTradeRoute-enable so existing wheat-trade tests and goldens are unaffected (gate the new path on `route.orders` being defined).
  (5) runner.ts — simInternals: expose `trade` hooks (regional entry resolver, whose warehouse accepts which good) through the existing `simInternals()` object (1185-1198) — additive fields only.
  (6) No Math.random/Date.now; dispatch is tick-scheduled by merchantFrequency and stable iteration order; any tie-break uses `this.rng`.
  Create tests/integration/trade-runner.test.ts: (1) SC1 — openTradeRoute('massilia') debits 500 and leaves every good on 'no_trade'; setting `setTradeOrder('massilia','pottery',{mode:'export_above_reserve', reserve:2})` on a city with a stocked road-connected warehouse causes, over enough ticks, the warehouse pottery to fall physically to ≤2 (+ in-transit) while a good left 'no_trade' shows zero movement; treasury rises by export proceeds tracked through the routes; (2) `setTradeOrder(..., 'wine', {mode:'import_upto_target', target:3})` causes warehouse wine to rise toward 3 while staying at/below target, and the treasury decreases only by the imported value; (3) quotas — with `perGoodQuota: { pottery: 2 }` the route stops moving pottery after 2, other goods keep moving, and after forcing a year rollover (tick past `Math.floor(tick/360)` boundary by ticking) the pottery quota resets and exports resume; (4) no_trade/stockpile goods never change stock (SC3 gating through the runner); (5) regression — `enableTrade('massilia', true)` + a granary with wheat still behaves like today's wiring (runner-accessors 'trade wired into sim tick' expectations + the treasury-type checks); (6) determinism sanity — same seed + same commands → byte-identical getStateJson at tick N for N in {50, 100} (full chunked guarantee in 09-W4-2).</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/integration/trade-runner.test.ts && npm run test</automated>
  </verify>
  <done>trade-runner.test.ts passes proving SC1+SC3 through the runner: opening a route debits routeOpeningCost and defaults every good to no_trade, export_above_reserve / import_upto_target orders physically change warehouse stock (reserve thresholds and targets honored), per-good quotas suspend only the capped good and reset at the tick-based year rollover, no_trade/stockpile goods never move, treasury tracks export/import proceeds, and the legacy enableTrade wheat path plus all 564 baseline tests/goldens stay green and byte-identical; typecheck clean.</done>
</task>

<task type="auto">
  <name>09-W4-2: Live trade advisor projection + chunked trade determinism + RNG/clock audit (SC1-3 advisor surface, decision 7)</name>
  <files>src/sim/advisors.ts, src/sim/runner.ts, tests/unit/trade-advisor.test.ts, tests/determinism/trade-determinism.test.ts</files>
  <read_first>src/sim/advisors.ts (SimSnapshot 19-37, advisorsFrom 53-69, logisticsAdvisorFromState import pattern — runner.ts:68), src/sim/runner.ts (getLogisticsAdvisor 358-360 as the accessor template, getTradeRoutes 660-662), tests/determinism/market-chain-determinism.test.ts (chunked run 26-62 and the no-RNG/clock source audit 177-187), tests/determinism/production-chain-determinism.test.ts (chunked 44-63), 09-CONTEXT.md decision 7</read_first>
  <action>Read src/sim/advisors.ts, src/sim/runner.ts and the determinism test patterns before writing. Everything additive.
  (1) src/sim/advisors.ts — add an exported pure projection `tradeAdvisorFromState(routes: Record<string, TradeRoute>, prices: TradePriceSnapshot): TradeAdvisorView` where `TradeAdvisorView = { cities: Array<{ cityId; name; landOrSea; opened; relationship; orders: Record<string, TradeOrderMode>; quota: Record<string, { used: number; cap: number; suspended: boolean }>; prices: Record<string, { base; current; trend }> }>; totals: { exportProceeds: number; importSpend: number; activeRoutes: number } }` — every number derived from the injected routes/prices (live-derived, never fabricated). `TradePriceSnapshot` is a small serializable projection of the runner's per-good TradePriceState (base/effective/trend) produced by the runner, keeping SimState untouched.
  (2) src/sim/runner.ts — add `getTradeAdvisor(): TradeAdvisorView` delegating to `tradeAdvisorFromState(this.tradeRoutes, this.tradePriceSnapshot())` (mirrors getLogisticsAdvisor at 358-360). Additive accessor; does not mutate state.
  (3) Create tests/unit/trade-advisor.test.ts: (a) pure projection on a hand-built routes+prices snapshot returns exact cities/orders/quota(used,cap,suspended)/prices(base,current,trend) values; (b) live accessor on a real runner after openTradeRoute + setTradeOrder + ticks reconciles route.enabled, an ordered good's quota counters (used ≤ cap), and price base/current/trend against the tradePriceSnapshot — live, not fabricated; (c) suspended flag is true only for the capped good; (d) unopened cities appear with opened:false and no orders.
  (4) Create tests/determinism/trade-determinism.test.ts: (a) chunked identity — same seed + same commands (open + order + ticks) produce byte-identical `getStateJson()` for chunk sizes 1/7/50 over the trade city on a production-style map (buildProductionCity + openTradeRoute('massilia') + setTradeOrder pottery export_above_reserve) for seeds {1, 7, 1337} — the year-rollover quota reset must also be chunk-invariant (tick past the year boundary); (b) same-seed run twice → identical JSON; (c) different seeds runnable without crashing; (d) source audit — src/sim/trade.ts, src/sim/transport.ts, src/sim/walkers.ts and src/sim/runner.ts contain no Math.random(), Date.now(), or new Date() invocations (the file-read regex from market-chain-determinism.test.ts:177-187), locking the decision constraint.
  Keep tests/unit/advisors.test.ts, tests/determinism/market-chain-determinism.test.ts and the golden snapshots green unchanged.</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/trade-advisor.test.ts && npm run test && npm run check:military</automated>
  </verify>
  <done>trade-advisor.test.ts and trade-determinism.test.ts pass: the trade advisor projection returns exact live-derived values (orders/quota used+cap+suspended/prices base+current+trend), the runner accessor reconciles against real state, the trade chain reproduces byte-identical getStateJson under chunks 1/7/50 across seeds {1,7,1337} including the year-rollover quota reset, the no-RNG/clock source audit is green for trade/transport/walkers/runner, and `npm run check:military` is clean; the full suite (564 baseline + all Phase-9 additions) stays green; typecheck clean.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Order settings → movement | Only a good explicitly ordered (export_above_reserve/import_upto_target/export_all) may move; no_trade/stockpile must never move goods, and stockpile must also block domestic claim (reserved set) |
| Transport carry → stock | Goods physically ride on the walker between entry and warehouse/entrepot — never duplicated (cannot exist at both source and carrier), never teleported, and returned to source on a failed/expired trip (no-loss) |
| Quota suspension → per good | A capped good's suspension must not spill to other goods on the same route; the reset must be tick-based (Math.floor(tick/360)), never wall-clock |
| Price → transaction gating | Import always prices above export for the same good; both buy and sell are gated (threshold/reserve/quota/capacity/treasury/reachable/accepting storage) so the treasury is never drained blindly and food reserves are never gutted (§19.9) |
| Advisor numbers → UI/state | The trade advisor reports only values traced to runner trade state; SimState shape stays frozen so goldens never regenerate |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-09-01 | Tampering | per-good order bypass / movement when no_trade | high | mitigate | 09-W1-2 order-mode matrix + 09-W4-1 integration test assert no_trade/stockpile goods never change stock; stockpile adds to the reserved set so exports are impossible |
| T-09-02 | Repudiation | transport teleport / double-count / loss | high | mitigate | 09-W3-1/09-W3-2 assert carry-only-on-walker (source falls on collection, dest rises on deposit), capacity never exceeded, expired/failed trip returns units (releaseWalkerLoad trade branch) |
| T-09-03 | Tampering | per-good quota spill / wall-clock reset | high | mitigate | 09-W2-1 per-good suspension isolation + year-reset count; 09-W4-2 chunked determinism ticks across the year boundary |
| T-09-04 | Repudiation | blind import drain / dangerous export | high | mitigate | 09-W2-2 price invariant (import>export) + 09-W1-2 import gating (below-target/quota/affordable) + existing exportableAboveMonths/dangerousExport (trade.ts:142-184) reused for reserve-aware export thresholds |
| T-09-05 | Tampering | non-deterministic trade (clock/RNG) | high | mitigate | 09-W4-2 chunked 1/7/50 identity incl. year rollover + no-RNG/clock source audit over trade/transport/walkers/runner |
| T-09-06 | Privacy | none (pure model) | low | accept | trade advisor is a pure projection of runner state; no secret/user data |

</threat_model>

<verification>
Run `npm run test` (full suite, golden + determinism + property included) and
`npm run typecheck` after every wave; `npm run check:military` after 09-W4.
Per-wave spot-checks:
- 09-W1: `npx vitest run tests/unit/trade-catalog.test.ts` + `tests/unit/trade-orders.test.ts`,
  `tests/trade.test.ts` unchanged and green.
- 09-W2: `tests/unit/trade-quotas.test.ts` + `tests/unit/trade-prices.test.ts`,
  `tests/trade.test.ts` unchanged.
- 09-W3: `tests/unit/trade-walkers.test.ts` + `tests/integration/trade-transport.test.ts`,
  `tests/unit/transport.test.ts` unchanged.
- 09-W4: `tests/integration/trade-runner.test.ts` + `tests/unit/trade-advisor.test.ts` +
  `tests/determinism/trade-determinism.test.ts`; confirm `tests/golden/golden.test.ts`
  and `tests/integration/food-slice.test.ts` are green WITHOUT any golden regeneration.
Per-task sampling follows `.planning/phases/09-external-trade/09-VALIDATION.md`.
</verification>

<success_criteria>
- TRAD-01: regional catalog has §19.1 fields (landOrSea, routeOpeningCost,
  merchantFrequency, annualQuotaPerGood, priceModifiers, relationship, events),
  validated on load; catalog test locks it.
- TRAD-02: openTradeRoute charges opening cost and defaults every good to
  no_trade; setTradeOrder(export_all/export_above_reserve/import_upto_target/
  stockpile) drives real physical stock movement through the runner (SC1).
- TRAD-03: caravan (8) and ship (16) walkers carry loads with capacity, road
  reachability, berth queue and entrepot staging; no-road caravan waits then
  leaves without trading; nothing teleported or lost (SC2).
- TRAD-04: per-route per-good quotas suspend only the capped good and reset on
  the tick-based year rollover (SC3).
- TRAD-05: price state has base/history/trend/modifiers; import > export for
  every commodity (catalog invariant); transactions gate by threshold/reserve/
  quota/capacity/treasury/storage (SC3).
- Live trade advisor derives every number from runner state; SimState frozen so
  both golden fixtures stay green without regeneration; no military tokens;
  564 baseline tests + all Phase-9 additions green; typecheck clean.
</success_criteria>

<output>
Create `.planning/phases/09-external-trade/09-SUMMARY.md` when done.
</output>
