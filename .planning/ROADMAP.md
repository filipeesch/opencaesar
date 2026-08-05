# Roadmap: OpenCaesar

## Overview

Evolve the working Caesar-style MVP into the full OpenCaesar spec (`game.md`, §55
vertical-slice order): a deterministic, data-driven city sim with physical goods
logistics, 21-level housing, road-delivered services, water, industry, trade,
finance, civic systems, ratings, campaign, and management UI — built one playable
slice at a time, keeping the existing 126 tests green and adding golden determinism.

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases: Urgent insertions (marked INSERTED)

## Phases

- [x] **Phase 1: Time & Deterministic Core** - TimeSystem (pause + speeds), paused-command queue, expanded per-tile state, golden determinism
- [x] **Phase 2: Data Catalogs & Military-Absence Gate** - validate catalogs on load; balance externalization; CI military-token validator
- [x] **Phase 3: Road Graph & Walker Categories** - road network graph with dirty-flag recompute; road types; wandering/destination/recruiter walkers
- [x] **Phase 4: Water System** - wells, reservoirs, aqueducts, fountains, public baths, water overlay
- [x] **Phase 5: Agriculture & Food** - food types, farm varieties, fishing wharf, granary commands
- [x] **Phase 6: Production & Manufacturing** - extraction sites and workshops with physical loads
- [x] **Phase 7: Warehouses & Logistics** - warehouses, per-commodity orders, commercial center, logistics advisor data
- [x] **Phase 8: Markets & Home Distribution** - buyer/seller walkers, reservation, per-market config
- [x] **Phase 9: External Trade** - regional map, routes/orders, land caravans + merchant ships, quotas, prices
- [x] **Phase 10: Finance** - full treasury model, royal subsidy, loans, wage/tax balance
- [x] **Phase 11: Civil Safety** - fire, collapse/danger, security/crime, civilization overlay
- [x] **Phase 12: Health, Education, Entertainment** - doctors/infirmaries, schools/libraries, shows
- [x] **Phase 13: Religion** - temples, grand temples, festivals, favor
- [x] **Phase 14: Governance & Requests** - forum/senate/governor; administrative requests
- [ ] **Phase 15: Ratings, Objectives, Events** - four ratings, win conditions, event responses
- [ ] **Phase 16: Full Housing Evolution** - 21 levels, hysteresis, house merging
- [ ] **Phase 17: Campaign, Tutorial & Codex** - 10 missions, contextual tutorial, codex
- [ ] **Phase 18: Management UI** - HUD, 13 advisors, overlays, inspectors
- [ ] **Phase 19: Persistence & Options** - versioned save/load, options/accessibility
- [ ] **Phase 20: UI Redesign — Caesar III Sidebar & Advisors** — Replace current HUD with Caesar III-style sidebar, 13 advisor panels with live sim data, overlay system (fire/danger/collapse/crime/food), building inspector, redesigned build panel. (INSERTED — ui-redesign)

## Phase Details

### Phase 1: Time & Deterministic Core
**Goal**: Fixed-timestep scheduling decoupled from frame rate, pause/speed controls, expanded per-tile state, and locked-in determinism.
**Depends on**: Nothing (foundation)
**Requirements**: CORE-01, CORE-02, CORE-03
**Success Criteria** (what must be TRUE):
  1. Stepping the sim at different frame rates for the same days yields identical state.
  2. Pausing halts simulated time; build/demolish/policy issued while paused is consumed on the next step.
  3. Tiles expose elevation, fertility, resource, waterDepth, aqueduct, risk, pollution, traffic, coverage, ownership, blocked.
**Plans**: 3 (3 complete)

Plans:
- [x] 01-01: TimeSystem fixed-step frame-rate independence + per-speed/boundary tests (CORE-01)
- [x] 01-02: Build/demolish/policy paused-command pipeline + save/load replay (CORE-02)
- [x] 01-03: Read-only per-tile state accessor + paused-command golden (CORE-03)

### Phase 2: Data Catalogs & Military-Absence Gate
**Goal**: Externalize balance into validated data catalogs and add the no-military CI gate.
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. Loading reports an error and refuses to run on corrupt catalog data.
  2. Externalized constants reproduce prior behavior (golden equivalence).
  3. CI fails if any forbidden military token appears in src/ or data/.
**Plans**: 3 (3 complete)

Plans:
- [x] 02-01: Load-time catalog validation incl. balance + hard-fail guard (DATA-01)
- [x] 02-02: Balance externalization parity tests (DATA-02)
- [x] 02-03: Independent military-absence CI gate (DATA-03)

### Phase 3: Road Graph & Walker Categories
**Goal**: Road network as graph with localized recomputation; road types; three walker classes.
**Depends on**: Phase 1
**Requirements**: ROAD-01, ROAD-02, ROAD-03
**Success Criteria** (what must be TRUE):
  1. Adding/demolishing a road recomputes only the affected region; connectivity reflects the change.
  2. Road types affect walker speed and desirability.
  3. Wandering, destination, and recruiter walkers behave per their data (return at max steps, pathfind, labor-pool link).
**Plans**: 3 (3 complete)

Plans:
- [x] 03-01: Road graph dirty-flag recompute + connectivity (ROAD-01)
- [x] 03-02: Road-type wiring: speed/desirability effects (ROAD-02)
- [x] 03-03: Walker categories, per-type data, roadblock permissions, graph-path travel (ROAD-03)

### Phase 4: Water System
**Goal**: Wells, reservoirs, aqueducts, fountains, public baths, and the water overlay.
**Depends on**: Phase 1
**Requirements**: WATR-01, WATR-02, WATR-03, WATR-04, WATR-05, WATR-06
**Success Criteria** (what must be TRUE):
  1. Houses receive water classes from fountains/wells with coverage; fountains go dark without water/workers.
  2. Reservoirs store and supply water; baths consume it and affect health/desirability.
  3. Aqueducts carry flow visibly tile-by-tile; the overlay shows sources, flow, and coverage.
**Plans**: 3 (3 complete)

Plans:
- [x] 04-01: Wells desirability + reservoir storage/level/inlet/outlet (WATR-01/02)
- [x] 04-02: Aqueduct flow propagation/determinism + fountain network/go-dark (WATR-03/04)
- [x] 04-03: Baths supplied+staffed wiring + water overlay advisor data (WATR-05/06)

### Phase 5: Agriculture & Food
**Goal**: Food variety, farm types with fertility-based output, fishing wharf, granary commands.
**Depends on**: Phase 1
**Requirements**: AGRI-01, AGRI-02, AGRI-03
**Success Criteria** (what must be TRUE):
   1. Farm types produce on fertile land with road access and workers; paused farms stop.
   2. Granaries accept/refuse/request/maintain/reserve/export food per command.
   3. Farm → granary → market → house food pipeline works for multiple food types.
**Plans**: 1 (1 complete)

Plans:
- [x] 05-01: Full food supply chain (imported from `game-specs/fodd-supply-chain.md`) — production, physical loads, granary orders/reservations, market distribution, house consumption/variety, import/export, management UI

### Phase 6: Production & Manufacturing
**Goal**: Extraction sites and workshops producing physical loads.
**Depends on**: Phase 5
**Requirements**: PROD-01, PROD-02
**Success Criteria** (what must be TRUE):
  1. Extraction sites require deposits and deliver valid destinations.
  2. Workshops accept inputs, produce outputs to stock, and dispatch porters to chosen destinations.
  3. Bottleneck/blocked states reported without destroying goods.
**Plans**: 3 (3 complete)

Plans:
- [x] 06-01: Deposit gating + destination policy + blocked no-loss (PROD-01/02)
- [x] 06-02: Runtime production types, tick integration, advisor data (PROD-01/02)
- [x] 06-03: Production-chain determinism + acceptance (PROD-01/02)

### Phase 7: Warehouses & Logistics
**Goal**: Warehouses, per-commodity orders, single commercial center, logistics advisor data.
**Depends on**: Phase 6
**Requirements**: WARE-01, WARE-02, WARE-03
**Success Criteria** (what must be TRUE):
  1. Warehouses store one load per slot and honor per-commodity orders.
  2. Only one commercial center may be designated; fallback + warnings on full.
  3. Advisors report stock, production/consumption, in-transit, bottlenecks, stopped buildings.
**Plans**: 3 (3 complete)

Plans:
- [x] 07-01: Warehouse order matrix + tick-based reservation pool (WARE-01)
- [x] 07-02: Road-reachable warehouse transfer + commercial-center fallback (WARE-01/02)
- [x] 07-03: Live logistics advisor + warehouse-chain determinism (WARE-03)

### Phase 8: Markets & Home Distribution
**Goal**: Market buyer/seller walkers with reservation-based selection and per-market config.
**Depends on**: Phase 7
**Requirements**: MARK-01, MARK-02, MARK-03
**Success Criteria** (what must be TRUE):
  1. No load is double-picked (reservation holds during transit).
  2. Distribution prioritizes essential food then evolution-blocking goods.
  3. Per-market product accept/refuse, priority, target stock, and buyer radius are configurable.
**Plans**: 3 (3 complete)

Plans:
- [x] 08-01: Market config matrix, no-double-pick contention, distribution priority tests (MARK-01/02/03)
- [x] 08-02: Per-market config registry + runtime honoring + buyer→seller chain (MARK-01/02)
- [x] 08-03: Market load composition + distribution-priority integration + chain determinism (MARK-03)

### Phase 9: External Trade
**Goal**: Regional map, routes/orders, land caravans + merchant ships, quotas, prices.
**Depends on**: Phase 8
**Requirements**: TRAD-01, TRAD-02, TRAD-03, TRAD-04, TRAD-05
**Success Criteria** (what must be TRUE):
  1. Opening a route and setting per-good orders affects actual goods movement.
  2. Caravans/ships transport loads physically with capacity and berth/road rules.
  3. Quotas cap and reset annually; import/export prices differ, track history, and gate transactions.
**Plans**: 4 waves (single PLAN.md, 8 tasks)

Plans:
- [x] 09-PLAN: Regional catalog, order modes, transports, quotas, prices, advisor + determinism (TRAD-01..05 read more)

### Phase 10: Finance
**Goal**: Complete treasury model with wages, taxes, trade revenue, subsidy, loans.
**Depends on**: Phase 9
**Requirements**: FIN-01
**Success Criteria** (what must be TRUE):
  1. Treasury reflects wages, taxes, trade, subsidy requests, and loan interest.
  2. Running out of money has a visible consequence (e.g., housing downgrade, wage arrears).
**Plans**: 3 waves (single PLAN.md, 5 tasks)

Plans:
- [x] 10-PLAN: Treasury wiring, subsidy/loans/overflow, bankruptcy consequence, advisor + determinism (FIN-01)

### Phase 11: Civil Safety
**Goal**: Fire, collapse/danger, security/crime, and the civilization overlay.
**Depends on**: Phase 4
**Requirements**: SAFE-01, SAFE-02, SAFE-03
**Success Criteria** (what must be TRUE):
  1. Buildings can catch fire and be extinguished by firemen; fire risk rises with density.
  2. Aging/event-damaged buildings risk collapse and show danger states.
  3. Prefecture/marshal coverage reduces crime; the civilization overlay reflects it.
- [x] 11-PLAN: fire lifecycle + firemen, collapse danger + engineer repair, prefecture/marshal crime, civilization overlay, determinism (SAFE-01/02/03)

### Phase 12: Health, Education, Entertainment
**Goal**: Health, literacy, and entertainment services delivered by walkers.
**Depends on**: Phase 3
**Requirements**: HEAL-01, EDUC-01, ENTR-01
**Success Criteria** (what must be TRUE):
  1. Health walkers raise house health; education walkers raise literacy.
  2. Entertainment venues deliver show-based coverage advancing housing.
- [x] 12-PLAN: live civic stats + decaying service flags, TIER_CIVIC_GATES on Domus/Villa, hospital/amphitheatre/colosseum catalog, real advisor coverage, getCivicStats, determinism (HEAL-01/EDUC-01/ENTR-01)
- [x] 13-PLAN: per-god temples + grand temples + live coverage-driven worship/favor + replayable festivals, determinism (RELI-01)
- [x] 14-PLAN: population-gated government buildings with live effects (forum/senate/palatine) + deterministic admin requests with partial fulfillment, rewards/penalties by deadline (GOV-01/GOV-02)

### Phase 13: Religion
**Goal**: Five gods' temples, grand temples, festivals, and favor.
**Depends on**: Phase 12
**Requirements**: RELI-01
**Success Criteria** (what must be TRUE):
  1. Temple/walker coverage raises the respective god's worship level.
  2. Festivals spend denarii to raise favor; grand temples boost coverage.
**Plans**: 13-PLAN

### Phase 14: Governance & Requests
**Goal**: Forum/senate/governor residences and administrative requests.
**Depends on**: Phase 13
**Requirements**: GOV-01, GOV-02
**Success Criteria** (what must be TRUE):
  1. Government buildings unlock at population thresholds with effects.
  2. Requests can be accepted, satisfied (full or partial), and rewarded/penalized by deadline.
**Plans**: ~~14-PLAN~~ (executed — see Phase 14 W1/W2 cuts in 14-PLAN.md)

### Phase 15: Ratings, Objectives, Events
**Goal**: Four ratings, objectives/win conditions, and event responses.
**Depends on**: Phase 14
**Requirements**: RATE-01, RATE-02, RATE-03
**Success Criteria** (what must be TRUE):
  1. Ratings decompose into sub-factors; Prosperity treats construction cost separately.
  2. Win conditions require targets sustained for the required period.
  3. Events are deterministic from seed and expose response choices that change outcomes.
**Plans**: 1 (single 15-PLAN.md, 3 waves)

Plans:
- [ ] 15-PLAN — ratings decomposition + constructionSpend separation (RATE-01), sustained objectives/win conditions + trailing-year annualExports (RATE-02), ~25-event responses + respondEvent command (RATE-03)

### Phase 16: Full Housing Evolution
**Goal**: 21-level progression with cumulative requirements, hysteresis, and merging.
**Depends on**: Phases 5, 8, 12, 13
**Requirements**: HOUS-01, HOUS-02
**Success Criteria** (what must be TRUE):
  1. Houses evolve only when all cumulative goods/services/religion/desirability are met for the minimum period.
  2. Houses devolve after tolerance loss; hysteresis prevents oscillation.
  3. Compatible adjacent houses merge into larger lots when blocks allow.
**Plans**: TBD

### Phase 17: Campaign, Tutorial & Codex
**Goal**: 10-mission campaign, contextual tutorial, and codex.
**Depends on**: Phase 15
**Requirements**: CAMP-01, CAMP-02, CAMP-03
**Success Criteria** (what must be TRUE):
  1. The 10 missions are playable and winnable in sequence.
  2. Tutorial prompts appear contextually as the player encounters systems.
  3. The codex explains every building, good, service, and god.
**Plans**: TBD

### Phase 18: Management UI
**Goal**: HUD, 13 advisors, overlays, and inspectors — all wired.
**Depends on**: Phases 4–17
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. No central button is decorative; every control has a real handler.
  2. All 13 advisors read live sim queries and update.
  3. Overlays and inspectors reflect sim state with legends/heatmaps and click-through.
**Plans**: TBD

### Phase 19: Persistence & Options
**Goal**: Versioned save/load for all systems and options/accessibility.
**Depends on**: Phases 1–17
**Requirements**: PERS-01, PERS-02
**Success Criteria** (what must be TRUE):
  1. Saves round-trip deterministically with migration and validation.
  2. Graphics/audio/gameplay/accessibility options are functional and persisted.
**Plans**: TBD
