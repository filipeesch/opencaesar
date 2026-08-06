# Requirements: OpenCaesar

**Defined:** 2026-08-03
**Core Value:** Deterministic, physical, road-delivered city systems with no military content.

## Milestone v1.0 Requirements

Requirements for completing the OpenCaesar build-out. Each maps to roadmap phases.

### Time & Determinism (Core)

- [ ] **CORE-01**: Player can pause and select 0.5×/1×/2×/4×/8× speeds; sim advances on a fixed timestep independent of frame rate
- [ ] **CORE-02**: Build, demolish, and policy orders issued while paused are consumed on the next fixed step
- [ ] **CORE-03**: Per-tile state exposes elevation, fertility, resourceType/Amount, waterDepth, aqueduct, road, desirability, fireRisk, collapseRisk, pollution, traffic, serviceCoverage, ownership, blocked

### Data Catalogs & Guarantees

- [ ] **DATA-01**: All building/commodity/housing/walker/trade/event/mission/localization definitions live in validated external data catalogs
- [ ] **DATA-02**: Balance constants are externalized from config with verified behavioral equivalence (golden tests)
- [ ] **DATA-03**: A CI validator rejects any military token in src/ and data/, allowing only labeled doc mentions

### Roads, Walkers & Services

- [ ] **ROAD-01**: Road network is a graph with localized dirty-flag recomputation on road/bridge/roadblock/entrance changes
- [ ] **ROAD-02**: Road types (dirt, paved, plaza, bridge, service roadblock, wharf access, stairs) have distinct movement and desirability
- [ ] **ROAD-03**: Walkers are categorized wandering/destination/recruiter with per-type data (maxRoadSteps, serviceTTL, spawnInterval, speed, allowedRoadTypes, roadblockPolicy, serviceRadius, preferredDirection, returnPolicy)

### Population & Labor (Section 10, 13)

- [x] **POP-01**: Population is modeled per residence with class, age bands, employment, children/elderly, taxable income, inventories, service access, sentiment, crime/health risk
- [x] **POP-02**: Migration (attractiveness index, immigration/emigration walkers, homelessness) is modeled
- [x] **POP-03**: Labor sectors with priority 1–5, pinning, pause, restore-auto; scarce workers allocated by priority
- [x] **POP-04**: Urban wage policy with imperial reference comparison and unemployment band reporting

### Housing (Section 11)

- [x] **HOUS-01**: Full data-driven 21-level progression (0 vacant lot → 20 luxurious palace) with cumulative requirements
- [x] **HOUS-02**: Evolution/de-evolution uses hysteresis (evolve limit, devolve limit, 1–3 month grace) and house merging into larger lots

### Water (Section 14)

- [ ] **WATR-01**: Wells (local water, desirability penalty, sanitary risk)
- [ ] **WATR-02**: Reservoirs (3×3, storage, inlet/outlet/level)
- [ ] **WATR-03**: Aqueducts (tile-by-tile, road-arch crossing, flow display)
- [ ] **WATR-04**: Fountains (network requirement, clean-water radius, desirability)
- [ ] **WATR-05**: Public baths (reservoir water + workers, health/desirability)
- [ ] **WATR-06**: Water overlay (sources, reservoir, aqueduct flow, coverage, house water classes)

### Agriculture & Food (Section 15)

- [ ] **AGRI-01**: Food types (wheat, vegetables, fruit, meat, fish) with per-level residential requirements
- [ ] **AGRI-02**: Farms (wheat, vegetables, orchard, animals, olives, vines) with fertility-based production; fishing wharf with boat voyage
- [ ] **AGRI-03**: Granaries with per-food commands (accept, refuse, request, maintain, empty, reserve, export, priority)

### Production & Manufacturing (Section 16)

- [ ] **PROD-01**: Extraction sites (clay pit, timber yard, iron mine, marble quarry) with deposit requirements
- [ ] **PROD-02**: Workshops (pottery, carpentry, oil press, winery, metallurgy) with input/output stock, progress, porter, destination selection, bottleneck states

### Warehouses & Logistics (Section 17)

- [ ] **WARE-01**: Warehouses (3×3, one load per slot) with per-commodity orders (accept, refuse, request, maintain, empty, reserve)
- [ ] **WARE-02**: Single Commercial Center designation, fallback on full, warnings
- [ ] **WARE-03**: Production/logistics advisor data (stock, production/consumption, in-transit, bottlenecks, stopped buildings)

### Markets & Home Distribution (Section 18)

- [ ] **MARK-01**: Market buyer (destination) and seller (wandering) walkers with reservation-based supplier selection (no double-picking)
- [ ] **MARK-02**: Per-market configuration (accept/refuse per product, priority, target stock, buyer radius, block wine for plebeians, preferred supplier)
- [ ] **MARK-03**: Internal market inventory and distribution priority (essential food, then evolution-blocking good)

### External Trade (Section 19)

- [ ] **TRAD-01**: Regional map model (cities, buy/sell lists, quotas, landOrSea, opening cost, merchant frequency, price modifiers, relationship, events)
- [ ] **TRAD-02**: Route opening flow and per-commodity trade orders (no trade, export all, export above reserve, import up to target, stockpile, priority)
- [ ] **TRAD-03**: Land caravans and merchant ships with real transports (berth queue, capacity, road/wharf requirements, entrepot)
- [ ] **TRAD-04**: Annual per-route quotas with suspension on cap and yearly reset
- [ ] **TRAD-05**: Import/export prices with history, trend, event modifiers, and reserve/transaction gating

### Finance (Section 20)

- [ ] **FIN-01**: Full finance: wages, taxes, trade revenue, royal subsidy request, loans/interest, treasury overflow

### Civil Safety (Section 21)

- [ ] **SAFE-01**: Fire service (fire risk, firemen walkers, wells as water supply) and building fires
- [ ] **SAFE-02**: Collapse risk (aging buildings, earthquake events) and danger/repair states
- [ ] **SAFE-03**: Security (prefecture, marshal walkers, crime/robbery) and the civilization overlay

### Health & Education (Sections 22–23)

- [ ] **HEAL-01**: Health services (doctors, barbers, baths, hospitals) raising house health via walkers
- [ ] **EDUC-01**: Education (schools, academies, libraries) raising literacy via walkers

### Entertainment & Culture (Section 24)

- [ ] **ENTR-01**: Entertainment venues (theater, amphitheater, colosseum, hippodrome) with show-based coverage

### Religion (Section 25)

- [ ] **RELI-01**: Temples for 5 gods, grand temples, coverage-driven favor, festivals

### Governance & Requests (Sections 26, 28)

- [ ] **GOV-01**: Administrative buildings (forum, senate, governor residences) with thresholds/effects
- [ ] **GOV-02**: Administrative requests (types, title/desc/quantity/deadline/reward/penalty, reservation, locate/send, partial delivery)

### Ratings & Objectives (Sections 27, 29)

- [x] **RATE-01**: Four city ratings (Culture, Prosperity, Stability, Favor) with decomposition and separate construction-cost treatment for Prosperity
- [x] **RATE-02**: Objectives and win conditions (targets sustained for a required period)
- [x] **RATE-03**: Non-military event engine with catalog (deterministic schedule, lifecycle, responses)

### Campaign & Tutorial (Sections 42–44)

- [x] **CAMP-01**: 10-mission campaign framework
- [x] **CAMP-02**: Contextual tutorial
- [x] **CAMP-03**: Codex

### Management UI (Sections 31–40)

- [x] **UI-01**: HUD with every control wired (no decorative buttons)
- [x] **UI-02**: 13 advisors reading live sim queries
- [x] **UI-03**: Overlays with legends, heatmaps, and click-through (water, risks, coverage, etc.)
- [x] **UI-04**: Residential, productive-building, warehouse/granary, market, and walker inspectors

### Persistence & Options (Sections 45–46)

- [x] **PERS-01**: Versioned save/load migration covering all systems with validation and deterministic reload
- [x] **PERS-02**: Options and accessibility (graphics, audio, gameplay, accessibility)

## v2 Requirements

Deferred future release. Tracked but not in current roadmap.

### Polish & Meta

- [ ] Telemetry/debug overlay (§50), performance chunking (§52), difficulty presets (§53)
- [ ] Full audio (§48) and final visual direction (§47)

## Out of Scope

- Any military system of any kind (explicit; §1 + §51 + D9)
