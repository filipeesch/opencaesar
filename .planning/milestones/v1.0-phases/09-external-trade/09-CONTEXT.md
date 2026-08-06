# Phase 9: External Trade - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Mode:** Auto-generated (smart-discuss, all grey areas pre-accepted by user)

<domain>
## Phase Boundary

Regional map, routes/orders, land caravans + merchant ships, quotas, prices.

Success criteria (from ROADMAP):
1. Opening a route and setting per-good orders affects actual goods movement.
2. Caravans/ships transport loads physically with capacity and berth/road rules.
3. Quotas cap and reset annually; import/export prices differ, track history, and gate transactions.

Requirements: TRAD-01 (regional map model), TRAD-02 (route opening + per-commodity trade orders), TRAD-03 (land caravans + merchant ships with real transports), TRAD-04 (annual per-route quotas), TRAD-05 (import/export prices with history).
</domain>

<decisions>
## Implementation Decisions

### Pre-Accepted Grey Areas (user approved all, do not re-ask)
- **Verify-as-built**: Audit existing sim code against TRAD requirements; gap-fill, do not rebuild what already works. The sim already has walkers (buyer/seller/caravan patterns), building registry, and logistics. Reuse `SimRunner`, `SimInternals`, walker infrastructure, and data catalogs.
- **Gap-fill + add tests**: Missing requirements become new additive features + tests. All existing tests stay green.
- **Determinism**: Seeded RNG only, never `Math.random`/`Date.now`; no unseeded iteration order; goldens regenerate only on intentional mechanic change via `GOLDEN_UPDATE=1 npm run test:golden:update`.
- **No military content**: Keep `check:military` clean (no military tokens).
- **Live-derived data**: Any advisor/UI data surfaces must be derived from real sim state, never fabricated.
- **Additive API**: Keep existing exported signatures stable; new surfaces are additive.

### Agent's Discretion
- Trade system design follows the Caesar 3 trade model: route open cost, per-good order modes (no trade / export all / export above reserve / import up to target / stockpile), caravans/ships as walkers with capacity + berth/wharf rules, per-route quotas capped annually, prices with base/history/trend and event modifiers, gated transactions.
- Data catalogs for trade goods/cities follow the Phase 2 pattern (`src/data/catalogs/*.ts` + validation).

</decisions>

<code_context>
## Existing Code Insights

- `src/sim/runner.ts`: `SimRunner` owns the tick loop, `SimInternals` seams, `getState()`, `getWalkerInternals()`, save-while-paused queue.
- `src/sim/walkers.ts`: buyer/seller walker chain with reservation holds; caravan/ship walkers can follow the same pattern (load/unload, capacity).
- `src/sim/logistics.ts`: `marketNeedsRestock`, `findSupplier(preferredSupplier)`, `marketLoadComposition` — supply-chain utilities reusable for trade routes.
- `src/data/catalogs/*.ts`: validated balance catalogs (Phase 2 pattern) for goods/behavior config.
- `tests/helpers`: `buildFoodCity`-style helpers for constructing minimal cities in tests.
- Goldens: deterministic snapshot tests in `tests/determinism/`.

Codebase context will be deepened during plan-phase research.
</code_context>

<specifics>
## Specific Ideas

- TRAD-01: `TradeCity` registry (name, buy/sell lists, quota caps, landOrSea, opening cost, merchant frequency, price modifiers, relationship, events) in a catalog; `TradeRoute` runtime model on the runner.
- TRAD-02: Per-good order modes enum + per-route/per-city order table; orders drive actual walker dispatches (gap-fill the existing buyer/seller infrastructure).
- TRAD-03: `TradeCaravan`/`MerchantShip` walkers with capacity, road/wharf requirements, berth queue, entrepot staging; movement on the road graph + sea edges.
- TRAD-04: Per-route quota counters, cap suspension, yearly reset ticked by the runner's year clock.
- TRAD-05: Price model per good/city: base, history buffer, trend, event modifiers; import vs export prices differ; gating when price/reserve conditions unmet.
</specifics>

<deferred>
## Deferred Ideas

- Full trade UI screens are deferred to the Management UI phase (Phase 18); data surfaces only.
- Campaign/tutorial trade scenarios deferred to Phase 17.
</deferred>
