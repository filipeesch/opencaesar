# Milestones

## v1.0 OpenCaesar v1.0 (Shipped: 2026-08-06)

**Phases completed:** 20 phases, 34 plans, 101 tasks

**Key accomplishments:**

- 1. [Rule 1 - Plan expectation bug] 8x speed test was unachievable at the default maxCatchupSteps
- Adds SimRunner.demolish(x, y) threaded through PendingCommand/SaveCommand with deterministic fromSaveData replay, plus a paused-command pipeline test suite (unit + determinism + save/load round-trip) that locks the CORE-02 contract that build/demolish/policy issued while paused are consumed on the next fixed step.
- Exposes read-only per-tile state through SimRunner.getTileState(x, y) (copy accessor, all 15 CORE-03 fields), extends the TileState defaults test to assert resourceAmount and desirability, and adds a paused-command pipeline golden snapshot while keeping the determinism suite and food-chain golden green.
- validateCatalogs() now validates the BALANCE catalog via a new validateBalance() helper, and the SimRunner constructor hard-fails on corrupt catalog data through a one-time throwCatalogIssues() guard (DATA-01).
- A 5-test parity suite (tests/balance-parity.test.ts) proves CONFIG is a value-identical re-export of the 29-key BALANCE catalog, maps each key to a CONFIG consumer under src/, and blocks any re-declaration of a balance key in code (DATA-02).
- The military-absence gate is now a standalone exit-code scanner (scripts/check-military.mjs) wired as `npm run check:military` with an explicit CI quality-job step, and the vitest gate imports the same token list + scan (single source of truth, DATA-03).
- RoadNetwork now assigns a component to isolated road adds (connected(tile, tile) true) and affectedTiles() reports the genuinely recomputed dirty region, with multi-region disconnect/reconnect and third-region isolation tests.
- Per-tile roadType side-channel (TileState/Map/SimRunner) now drives walker movement speed via roadSpeedMultiplier and house desirability via roadDesirability of orthogonally adjacent road tiles, with golden fixtures regenerated intentionally.
- WalkerProfile schema pinned by contract test; movementSpeed/serviceTTL/wandering-return-at-maxRoadSteps wired into walker behavior; per-category roadblock permissions enforced via mayTraverse + isTraversable-aware pathfinding with graph-path-only travel.
- WATR-02 reservoir 3x3 storage/level/inlet/outlet derivations and a WATR-01 well desirability penalty in `TileWater`, both unit-tested, on top of a re-confirmed 316-test baseline.
- Deterministic aqueduct flow-propagation tests (source→chain→fountain, block, repair, road-arch crossing, repeat-call equality) and a WATR-04 fountain `supplied && staffed` network gate with go-dark and a desirability bonus.
- WATR-05 bath supplied&&staffed gating with wellness/desirability grids and water-cost accounting, plus a WATR-06 `waterOverlayData` advisor surface exposing per-tile sources, coverage, water classes, aqueduct flow, reservoir state, and desirability.
- Physical-load food supply chain as additive, deterministic sim modules: production output-stock loads, granary per-food orders + no-double-pick reservations, market demand/buyer/seller modelling, house inventory + variety memory — all pinned by 65 new tests, with the HUD months-of-food indicator wired to live sim state (goldens and all 346 baseline tests untouched).
- Deposit-requirement gates (satisfiesDeposit/canExtract), §16.4 destination policy (porterDestination) with load transfer into destination stock (porterDeliversTo), and no-loss/pipeline unit coverage locking the production model contract
- Runtime raw/workshop/warehouse building types, deposit-gated SimRunner.tickProduction() (extraction → workshop → porter → warehouse, no-loss), and a SimState-derived production advisor accessor
- Chunked-tick determinism for the production chain (1/7/50 → identical state), save/load round-trip over a production city, and end-to-end runner acceptance proving deposit enforcement, the extraction→workshop→porter→warehouse pipeline with destination fallback, and blocked-state no-loss
- Per-commodity warehouse order semantics (all six §17.3 modes + default + slot boundaries) and a deterministic tick-based ReservationPool expiry, all additive to src/sim/logistics.ts and locked with 15 new unit tests.
- Warehouse deliveries now move only by road (warehouseCandidates requires a findRoadPath and ranks by road distance, mirroring findReachableGranary), and the Commercial Center gains §17.4 fallback-on-full with warnings and no-discard.
- A live SimRunner.getLogisticsAdvisor() accessor that derives every logistics aggregate (stock, production, consumption, in-transit, bottlenecks, stopped) from running sim state — never fabricated — plus chunked-tick determinism (1/7/50) and ReservationPool expiry identity locked with tests.
- Per-market configuration behavior matrix, reservation no-double-pick contention (model + walker), and the full 5-policy distribution-priority matrix locked against the pre-drafted market model with 29 new assertions — test-only, zero source changes.
- Additive per-market config registry on the runner (setMarketConfig/marketConfig + getWalkerInternals), marketNeedsRestock/preferred-supplier model surface, and a runner-integrated buyer→market→seller→house chain test driving the walkers against real runner state — 18 new tests, no existing behavior changes.
- marketLoadComposition config-driven successor load ordering (essential → evolution-blocking → rest, skipping refused products) plus market-chain chunked determinism proven at 1/7/50 chunk sizes with a configured per-market config and a fixed-seed buyer/seller repeat-run — 10 new tests, additive export only.
- §19.1 regional trade catalog (landOrSea/opening cost/merchant frequency/per-good quotas/relationship/price modifiers) validated on load, plus the additive §19.6 order-mode matrix and §19.9 transaction gates — legacy trade surface unchanged, all 564 baseline tests green.
- Per-route per-good annual quotas (per-good-only suspension, tick-based year reset) and the base/history/trend/modifier trade price model with the import>export invariant — legacy tickTrade/tradePrice unchanged, 595 tests green.
- caravan/ship walker types with capacity-bounded physical load/unload (8/16), no-loss restore on failure, §19.3 no-road wait-then-leave, and berth-queue/entrepot rules — proven against runner state; 605 tests green, goldens untouched.
- The bare `treasury: number` in SimRunner is now a categorized `Treasury` ledger instance — taxes/wages/trade flow through categorized entries, the royal subsidy and loans are command-replayable runner APIs, interest accrues on the tick-based year boundary, and the treasury is capped at the overflow limit — with `getTreasury()`/goldens byte-identical and 631 tests green.
- Status: Complete
- Status: Complete
- Status: Complete
- Status: Complete
- 1. [Rule 3 - Blocking] Route commands were not replayable, so the Wave-0 save/load determinism tests cannot pass
- 21-level housing progression driven by decideEvolution, hysteresis devolution with anti-oscillation grace, deterministic month-cadence house merging (footprint ladder + combined population), a clamped 21-level live-stats economy bridge, intentional golden regeneration, and catalog validation complete — with the full suite, typecheck, military and balance-parity gates green (813 tests).
- Replayable 10-mission campaign (start-year-fixed startMission SaveCommand, live-only sequential unlock gate, per-mission maps/routes/modifiers, winnability-probe-pinned targets), a state-observed 9-step contextual tutorial with replayable "don't show again", and a 13-kind catalog-derived codex — all deterministic (byte-identical save/load) with zero golden changes.
- Wired the full Management UI onto the deterministic sim core: a control bar with every control real (no decorative buttons), a 13-advisor drawer composed from live runner getters under the tick-change guard, a 5-overlay heatmap layer with legends and click-through, and five enriched inspectors with close/Next cycling — with zero getState()/SaveData shape change and zero golden regeneration.
- Versioned save/load boundary (SAVE_VERSION + additive migrateSave + typed validateSave + validated loadSavedGame at Home and MainScene) and functional persisted options/accessibility (rcb.options store, boot RenderConfig, gameSpeedDefault at boot, text-size/reduced-motion CSS seams, no-asset audio mix seam, Phase-18-pattern Settings drawer).
- 1. [Rule 1 - Bug] `getLaborSectors()` reported `assigned: 0` always (in-flight 19.1-03-01 work)

---
