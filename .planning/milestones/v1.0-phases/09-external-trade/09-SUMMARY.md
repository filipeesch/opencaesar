# Phase 9 Summary: External Trade

## Overview

Gap-filled the existing wheat-only trade stub into a full regional trade system:
regional trade city catalog, per-good trade order modes, physical caravan/ship
transports, annual per-route quotas, and import/export pricing with a live
trade advisor. Trade UI is deferred to Phase 18; campaign scenarios to Phase 17.

### Accomplishments

- **TRAD-01** Regional map catalog: `data/trade.ts` extended with `landOrSea`,
  `routeOpeningCost`, `merchantFrequency`, `annualQuotaPerGood`,
  `priceModifiers`, `relationship`, `events`; `data/validate.ts` extended to
  reject invalid city definitions (Phase-2 load-time guard).
- **TRAD-02** Per-good order modes (`no_trade` / `export_all` /
  `export_above_reserve` / `import_upto_target` / `stockpile`) defaulting to
  no_trade; `openTradeRoute` charges the opening cost and records `openYear`;
  `setTradeOrder` validates against the city's buys/sells; orders drive actual
  physical stock movement through the runner (SC1). Legacy `enableTrade` /
  `setImportOrder` / `setTradeRoute` / `tradePrice` kept byte-identical.
- **TRAD-03** Caravan (capacity 8) and merchant ship (capacity 16) transports
  with road reachability, berth queue, and entrepot staging; maritime leg is
  modeled as tick-duration + berth/entrepot state (no sea graph, no new
  placeable building). Goods ride on the walker, never duplicated or teleported.
- **TRAD-04** Per-route per-good quotas with cap suspension of only the capped
  good and tick-based (`Math.floor(tick/360)`) annual reset (SC3).
- **TRAD-05** Price state (base/history/trend/event modifiers) with the
  import > export invariant per good; deterministic transaction gating
  (threshold/reserve/quota/capacity/treasury/reachable storage).
- **Advisor + determinism** Pure `tradeAdvisorFromState` projection + live
  `runner.getTradeAdvisor()` — every number traced to runner state, never
  fabricated. Chunked 1/7/50 determinism across the year-rollover boundary;
  no-RNG/clock source audit over the trade simulation files. `SimState` frozen —
  both golden fixtures green without regeneration.

### Wave Plan

- 09-W1: Regional trade catalog + order/transaction model (TRAD-01/02)
- 09-W2: Quotas + prices (TRAD-04/05)
- 09-W3: Physical transports — caravans and ships (TRAD-03)
- 09-W4: Runner wiring, trade advisor, determinism (TRAD-01..05 runtime)

### Tests

Baseline 564 tests / 77 files → **622 tests / 86 files** (+58 tests / +9 files).
Typecheck clean, `npm run check:military` clean. Both golden fixtures and the
food-slice integration test stayed green without regeneration.

## Files Changed

- `data/trade.ts` — extended trade city definitions (TRAD-01)
- `data/validate.ts` — extended TRADE_CITIES validation
- `data/balance.ts` — trade constants
- `src/sim/trade.ts` — order modes, gating, quotas, prices (extended additively)
- `src/sim/transport.ts` — caravan/ship/berth/entrepot models (wired)
- `src/sim/types.ts` — additive `TradeRoute` order/quota/price fields
- `src/sim/runner.ts` — `openTradeRoute`/`setTradeOrder`/`getTradeAdvisor`/`tradePriceSnapshot`
- `src/sim/walkers.ts` — caravan/ship walkers on the WalkerType union
- `src/sim/walkerProfiles.ts` — trade walker profiles
- `src/sim/advisors.ts` — `tradeAdvisorFromState` projection
- Tests: `trade-catalog`, `trade-orders`, `trade-quotas`, `trade-prices`,
  `trade-walkers`, `trade-advisor` (unit), `trade-transport`,
  `trade-runner` (integration), `trade-determinism` (determinism)

## Decisions Log

- Additive gap-fill, not a rebuild: legacy trade signatures and the wheat-only
  path preserved (existing `tests/trade.test.ts`, runner-accessors, food-slice
  depend on them); new path gated on `route.orders`.
- `SimState` shape not extended — trade runtime state lives on the runner,
  exposed via additive accessors only, so golden fixtures are untouched.
- Ships have no sea graph; maritime leg is tick-duration + berth/entrepot state.
- Lifetime `priority` order mode from REQUIREMENTS.md is documented out of scope
  (classic Caesar 3 order-mode model has no priority mode) — see PLAN.md.

## Deferred

- Trade management UI → Phase 18 (advisor data surfaces ready).
- Campaign/tutorial trade scenarios → Phase 17.
- Save/load serialization of trade configs → Phase 19 Persistence & Options.
