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

- [ ] **Phase 1: Time & Deterministic Core** - TimeSystem (pause + speeds), paused-command queue, expanded per-tile state, golden determinism
- [ ] **Phase 2: Data Catalogs & Military-Absence Gate** - validate catalogs on load; balance externalization; CI military-token validator
- [ ] **Phase 3: Road Graph & Walker Categories** - road network graph with dirty-flag recompute; road types; wandering/destination/recruiter walkers
- [ ] **Phase 4: Water System** - wells, reservoirs, aqueducts, fountains, public baths, water overlay
- [ ] **Phase 5: Agriculture & Food** - food types, farm varieties, fishing wharf, granary commands
- [ ] **Phase 6: Production & Manufacturing** - extraction sites and workshops with physical loads
- [ ] **Phase 7: Warehouses & Logistics** - warehouses, per-commodity orders, commercial center, logistics advisor data
- [ ] **Phase 8: Markets & Home Distribution** - buyer/seller walkers, reservation, per-market config
- [ ] **Phase 9: External Trade** - regional map, routes/orders, land caravans + merchant ships, quotas, prices
- [ ] **Phase 10: Finance** - full treasury model, royal subsidy, loans, wage/tax balance
- [ ] **Phase 11: Civil Safety** - fire, collapse/danger, security/crime, civilization overlay
- [ ] **Phase 12: Health, Education, Entertainment** - doctors/infirmaries, schools/libraries, shows
- [ ] **Phase 13: Religion** - temples, grand temples, festivals, favor
- [ ] **Phase 14: Governance & Requests** - forum/senate/governor; administrative requests
- [ ] **Phase 15: Ratings, Objectives, Events** - four ratings, win conditions, event responses
- [ ] **Phase 16: Full Housing Evolution** - 21 levels, hysteresis, house merging
- [ ] **Phase 17: Campaign, Tutorial & Codex** - 10 missions, contextual tutorial, codex
- [ ] **Phase 18: Management UI** - HUD, 13 advisors, overlays, inspectors
- [ ] **Phase 19: Persistence & Options** - versioned save/load, options/accessibility

## Phase Details

### Phase 1: Time & Deterministic Core
**Goal**: Fixed-timestep scheduling decoupled from frame rate, pause/speed controls, expanded per-tile state, and locked-in determinism.
**Depends on**: Nothing (foundation)
**Requirements**: CORE-01, CORE-02, CORE-03
**Success Criteria** (what must be TRUE):
  1. Stepping the sim at different frame rates for the same days yields identical state.
  2. Pausing halts simulated time; build/demolish/policy issued while paused is consumed on the next step.
  3. Tiles expose elevation, fertility, resource, waterDepth, aqueduct, risk, pollution, traffic, coverage, ownership, blocked.
**Plans**: TBD

Plans:
- [ ] 01-01: Introduce TimeSystem paced by simulation step with pause + 0.5×/1×/2×/4×/8×
- [ ] 01-02: Add expanded tile state and persistence
- [ ] 01-03: Add deterministic golden tests over the new core

### Phase 2: Data Catalogs & Military-Absence Gate
**Goal**: Externalize balance into validated data catalogs and add the no-military CI gate.
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. Loading reports an error and refuses to run on corrupt catalog data.
  2. Externalized constants reproduce prior behavior (golden equivalence).
  3. CI fails if any forbidden military token appears in src/ or data/.
**Plans**: TBD

### Phase 3: Road Graph & Walker Categories
**Goal**: Road network as graph with localized recomputation; road types; three walker classes.
**Depends on**: Phase 1
**Requirements**: ROAD-01, ROAD-02, ROAD-03
**Success Criteria** (what must be TRUE):
  1. Adding/demolishing a road recomputes only the affected region; connectivity reflects the change.
  2. Road types affect walker speed and desirability.
  3. Wandering, destination, and recruiter walkers behave per their data (return at max steps, pathfind, labor-pool link).
**Plans**: TBD

### Phase 4: Water System
**Goal**: Wells, reservoirs, aqueducts, fountains, public baths, and the water overlay.
**Depends on**: Phase 1
**Requirements**: WATR-01, WATR-02, WATR-03, WATR-04, WATR-05, WATR-06
**Success Criteria** (what must be TRUE):
  1. Houses receive water classes from fountains/wells with coverage; fountains go dark without water/workers.
  2. Reservoirs store and supply water; baths consume it and affect health/desirability.
  3. Aqueducts carry flow visibly tile-by-tile; the overlay shows sources, flow, and coverage.
**Plans**: TBD

### Phase 5: Agriculture & Food
**Goal**: Food variety, farm types with fertility-based output, fishing wharf, granary commands.
**Depends on**: Phase 1
**Requirements**: AGRI-01, AGRI-02, AGRI-03
**Success Criteria** (what must be TRUE):
  1. Farm types produce on fertile land with road access and workers; paused farms stop.
  2. Granaries accept/refuse/request/maintain/reserve/export food per command.
  3. Farm → granary → market → house food pipeline works for multiple food types.
**Plans**: TBD

### Phase 6: Production & Manufacturing
**Goal**: Extraction sites and workshops producing physical loads.
**Depends on**: Phase 5
**Requirements**: PROD-01, PROD-02
**Success Criteria** (what must be TRUE):
  1. Extraction sites require deposits and deliver valid destinations.
  2. Workshops accept inputs, produce outputs to stock, and dispatch porters to chosen destinations.
  3. Bottleneck/blocked states reported without destroying goods.
**Plans**: TBD

### Phase 7: Warehouses & Logistics
**Goal**: Warehouses, per-commodity orders, single commercial center, logistics advisor data.
**Depends on**: Phase 6
**Requirements**: WARE-01, WARE-02, WARE-03
**Success Criteria** (what must be TRUE):
  1. Warehouses store one load per slot and honor per-commodity orders.
  2. Only one commercial center may be designated; fallback + warnings on full.
  3. Advisors report stock, production/consumption, in-transit, bottlenecks, stopped buildings.
**Plans**: TBD

### Phase 8: Markets & Home Distribution
**Goal**: Market buyer/seller walkers with reservation-based selection and per-market config.
**Depends on**: Phase 7
**Requirements**: MARK-01, MARK-02, MARK-03
**Success Criteria** (what must be TRUE):
  1. No load is double-picked (reservation holds during transit).
  2. Distribution prioritizes essential food then evolution-blocking goods.
  3. Per-market product accept/refuse, priority, target stock, and buyer radius are configurable.
**Plans**: TBD

### Phase 9: External Trade
**Goal**: Regional map, routes/orders, land caravans + merchant ships, quotas, prices.
**Depends on**: Phase 8
**Requirements**: TRAD-01, TRAD-02, TRAD-03, TRAD-04, TRAD-05
**Success Criteria** (what must be TRUE):
  1. Opening a route and setting per-good orders affects actual goods movement.
  2. Caravans/ships transport loads physically with capacity and berth/road rules.
  3. Quotas cap and reset annually; import/export prices differ, track history, and gate transactions.
**Plans**: TBD

### Phase 10: Finance
**Goal**: Complete treasury model with wages, taxes, trade revenue, subsidy, loans.
**Depends on**: Phase 9
**Requirements**: FIN-01
**Success Criteria** (what must be TRUE):
  1. Treasury reflects wages, taxes, trade, subsidy requests, and loan interest.
  2. Running out of money has a visible consequence (e.g., housing downgrade, wage arrears).
**Plans**: TBD

### Phase 11: Civil Safety
**Goal**: Fire, collapse/danger, security/crime, and the civilization overlay.
**Depends on**: Phase 4
**Requirements**: SAFE-01, SAFE-02, SAFE-03
**Success Criteria** (what must be TRUE):
  1. Buildings can catch fire and be extinguished by firemen; fire risk rises with density.
  2. Aging/event-damaged buildings risk collapse and show danger states.
  3. Prefecture/marshal coverage reduces crime; the civilization overlay reflects it.
**Plans**: TBD

### Phase 12: Health, Education, Entertainment
**Goal**: Health, literacy, and entertainment services delivered by walkers.
**Depends on**: Phase 3
**Requirements**: HEAL-01, EDUC-01, ENTR-01
**Success Criteria** (what must be TRUE):
  1. Health walkers raise house health; education walkers raise literacy.
  2. Entertainment venues deliver show-based coverage advancing housing.
**Plans**: TBD

### Phase 13: Religion
**Goal**: Five gods' temples, grand temples, festivals, and favor.
**Depends on**: Phase 12
**Requirements**: RELI-01
**Success Criteria** (what must be TRUE):
  1. Temple/walker coverage raises the respective god's worship level.
  2. Festivals spend denarii to raise favor; grand temples boost coverage.
**Plans**: TBD

### Phase 14: Governance & Requests
**Goal**: Forum/senate/governor residences and administrative requests.
**Depends on**: Phase 13
**Requirements**: GOV-01, GOV-02
**Success Criteria** (what must be TRUE):
  1. Government buildings unlock at population thresholds with effects.
  2. Requests can be accepted, satisfied (full or partial), and rewarded/penalized by deadline.
**Plans**: TBD

### Phase 15: Ratings, Objectives, Events
**Goal**: Four ratings, objectives/win conditions, and event responses.
**Depends on**: Phase 14
**Requirements**: RATE-01, RATE-02, RATE-03
**Success Criteria** (what must be TRUE):
  1. Ratings decompose into sub-factors; Prosperity treats construction cost separately.
  2. Win conditions require targets sustained for the required period.
  3. Events are deterministic from seed and expose response choices that change outcomes.
**Plans**: TBD

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
