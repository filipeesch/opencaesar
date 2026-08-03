# Tasks — OpenCaesar Game Systems

Implementation follows the vertical-slice order of `game.md` §55, each slice
producing a playable, tested version. Tasks reference the delta specs in
`specs/`. The simulation must stay deterministic (seeded RNG, fixed timestep)
and no military system may be introduced.

## 1. Foundation & Deterministic Core (sim-core delta)

- [x] 1.1 Add a `TimeSystem` with fixed-timestep stepping, pause, and speeds 0.5×/1×/2×/4×/8×, decoupled from frame rate
- [x] 1.2 Refactor `SimRunner` so user commands (build, demolish, policy, trade) work while paused and only consumed on next fixed step
- [x] 1.3 Expand per-tile state to include elevation, fertility, resourceType/Amount, waterDepth, aqueduct, desirability, fireRisk, collapseRisk, pollution, traffic, serviceCoverage, ownership, blocked
- [x] 1.4 Create the `data/` catalog schema (buildings, commodities, housing-levels, walkers, trade-cities, events, missions, localization) with load-time validation
- [x] 1.5 Externalize current balance constants from `config.ts` into the data catalog with verified behavioral equivalence (golden tests)
- [x] 1.6 Implement the road network graph with tile-based nodes and localized (dirty-flag) recomputation on road/bridge/roadblock/entrance changes
- [x] 1.7 Implement road types (dirt, paved, plaza, bridge, service roadblock, wharf access, stairs) with speed and desirability effects
- [x] 1.8 Refactor walkers into wandering / destination / recruiter categories with per-type data (maxRoadSteps, serviceTTL, spawnInterval, speed, allowedRoadTypes, roadblockPolicy, serviceRadius, preferredDirection, returnPolicy)
- [x] 1.9 Extend housing evolution to the full data-driven 21-level progression with cumulative requirements, hysteresis, and house/lot merging
- [x] 1.10 Add determinism golden tests over the new core and keep CI green

## 2. Population & Labor (population-labor)

- [x] 2.1 Model population per residence: population, capacity, class, age bands, employed/unemployed, children, elderly, taxable income, inventories, service access, sentiment, crime/health risk
- [x] 2.2 Implement age-band rules and workforce eligibility (plebeians 16–60 work; patricians/children/elderly do not)
- [x] 2.3 Implement migration: attractiveness index, immigration/emigration walkers at entry/exit points, and homelessness flow
- [x] 2.4 Implement the labor pool, recruiter walker access (range 22 segments default), and continuous staffing-ratio efficiency
- [x] 2.5 Implement labor sectors with priority 1–5, pinning, pause, restore-auto, and preview; allocate scarce workers to higher priority first
- [x] 2.6 Implement urban wage policy with imperial reference comparison and unemployment band reporting
- [x] 2.7 Expose migration/labor/attraction signals for the mood/ratings systems and add unit + integration tests

## 3. Food & Distribution (agriculture-food, distribution-market)

- [x] 3.1 Implement food types (wheat, vegetables, fruit, meat, fish) and residential food-type requirements per level
- [x] 3.2 Implement farms (wheat, vegetables, orchard, animals, olives, vines) with fertility-based production formula, road access, workers, and pause; and fishing wharf with boat voyage
- [x] 3.3 Implement granaries (food-only, capacity in loads) with per-food commands (accept, refuse, request, maintain, empty, reserve, export, priority)
- [x] 3.4 Implement market buyer (destination) and seller (wandering) walkers
- [x] 3.5 Implement internal market inventory, supplier selection with reservation (no double-picking), and distribution priority (essential food, then evolution-blocking good)
- [x] 3.6 Implement per-market configuration (accept/refuse per product, priority, target stock, buyer radius, block wine for plebeians, route highlight, preferred supplier)
- [x] 3.7 Add basic-city and food pipeline tests (farm → granary → market → house)

## 4. Water (water)

- [x] 4.1 Implement wells (local basic water, slight desirability penalty, sanitary risk in pollution)
- [x] 4.2 Implement reservoirs (3×3, water source/aqueduct requirement, storage, inlet/outlet/level)
- [x] 4.3 Implement aqueducts (tile-by-tile, road-arch crossing, per-segment demolition, flow display)
- [x] 4.4 Implement fountains (network requirement, clean-water radius, desirability, off without water/workers)
- [x] 4.5 Implement public baths (reservoir water + workers, attendant walker, health/desirability, water consumption)
- [x] 4.6 Implement the water overlay (sources, reservoir state, active/no-flow aqueducts, connected fountains, well/fountain coverage, house water classes)

## 5. Production, Storage & Logistics (production-storage)

- [x] 5.1 Implement extraction sites (clay pit, timber yard, iron mine, marble quarry) with deposit requirements and valid-destination rules
- [x] 5.2 Implement workshops (pottery, carpentry, oil press, winery, metallurgy) with input/output stock, progress, porter, destination selection, and bottleneck states
- [x] 5.3 Implement destination selection (nearest needy workshop → warehouse → orders/capacity) and "blocked, nothing destroyed" behavior
- [x] 5.4 Implement warehouses (3×3, one load per slot) with per-commodity orders: accept, refuse, request, maintain, empty, reserve, commercial center
- [x] 5.5 Implement the single Commercial Center designation, fallback on full, and warnings
- [x] 5.6 Implement the production/logistics advisor data (stock, production/consumption, in-transit, bottlenecks, stopped buildings)
- [x] 5.7 Add ceramics-chain integration test (clay → workshop → warehouse → market → house)

## 6. External Trade (trade)

- [x] 6.1 Implement the Regional map data model (cities, goodsBought/Sold, quotas, landOrSea, opening cost, merchantFrequency, priceModifiers, relationship, events)
- [x] 6.2 Implement route opening flow and per-commodity trade orders (do not trade, export all, export above reserve, import up to target, stockpile, priority consumption)
- [x] 6.3 Implement land caravans (entry/exit, 8-load capacity, road requirement, no-road wait/depart) and the land entrepot
- [x] 6.4 Implement merchant ships, the commercial wharf, and porters fetching loads (16-load capacity, berth queue, no low-bridge passage)
- [x] 6.5 Implement annual per-route quotas with display, suspension on cap, and yearly reset
- [x] 6.6 Implement import/export prices (import > export, history, trend, event modifiers) and reserve/transaction gating rules
- [x] 6.7 Add export and import integration tests (route, order, caravan/ship, quota, treasury effect)

## 7. Finance (finance)

- [x] 7.1 Implement revenue/expense categories and monthly/annual tracking
- [x] 7.2 Implement taxation: per-level tax multipliers, collector walkers (forum/senate/tax office), registration, coverage loss, tax screen data
- [x] 7.3 Implement treasury (balance, monthly change, projection, reserve, alerts) and debt (interest, favor reduction, bounded bailout, progressive worsening, possible defeat)
- [x] 7.4 Implement governor salary levels and personal account, donations, gifts, and festival funding with the no-unlimited-exploit safeguard
- [x] 7.5 Wire the Finance advisor to real revenue/expense and tax data

## 8. Civil Safety (civil-safety)

- [x] 8.1 Implement fire risk model (increasing factors, firefighter reduction), fire lifecycle (flames, evacuation, spread, brigade response, destruction), and the urban brigade
- [x] 8.2 Implement structural aging, engineer inspection (collapse risk reduction), cracks/warnings, and collapse; and the engineering post
- [x] 8.3 Implement crime/civil-order model (drivers, theft/vandalism/protest/strike/road-block events) and urban watch guards that patrol, calm protests, recover goods, and never attack citizens
- [x] 8.4 Add safety overlay data (fire, collapse, crime, damaged buildings)

## 9. Health, Education, Entertainment, Religion (health-education, entertainment-culture, religion)

- [x] 9.1 Implement health buildings (barber, clinic, hospital) and city health state (excellent → epidemic) and outbreaks
- [x] 9.2 Implement education buildings (school, library, academy) with capacity vs. coverage distinction
- [x] 9.3 Implement entertainment: training schools and venues (theatre, auditorium, arena, hippodrome), coverage scoring by type, and variety valuing
- [x] 9.4 Implement festivals (small/medium/large/provincial) with costs, preparation, effects, and screen data
- [x] 9.5 Implement the five cults, temples, oracles, festival square, divine favor states, and blessings/penalties
- [x] 9.6 Wire health/education/entertainment/religion advisors from real sim data

## 10. Governance, Ratings, Events, Campaign (governance-administration, ratings-objectives, events, campaign)

- [x] 10.1 Implement administrative buildings (forum, senate, governor residences) with thresholds and effects
- [x] 10.2 Implement administrative requests (types, title/desc/quantity/deadline/reward/penalty, reservation, locate/send, partial delivery)
- [x] 10.3 Implement the four city ratings (Culture, Prosperity, Stability, Favor) with decomposition and separate construction-cost treatment for Prosperity
- [x] 10.4 Implement objectives and win conditions (targets sustained for the required period)
- [x] 10.5 Implement the non-military event engine (deterministic seed schedule, lifecycle, responses) and catalog
- [x] 10.6 Implement the 10-mission campaign framework, contextual tutorial, and codex

## 11. Management UI (ui-management, game-shell)

- [x] 11.1 Implement the full HUD (top bar, build menu by data-category, control bar, contextual panel) with click-through and tooltips
- [x] 11.2 Implement residence, production, storage, market, and walker inspectors with decomposed data and navigation
- [x] 11.3 Implement all 13 advisors as real-data views (no decorative/toy data) and ranking in the chief advisor
- [x] 11.4 Implement overlays (infrastructure, housing, risks, labor, food, goods, services, economy) with legends, heatmaps, dimming, and click-through
- [x] 11.5 Implement messages with severity/category, grouping/anti-spam, locate, and category mute
- [x] 11.6 Implement the camera controls (pan/zoom/focus/minimap/return-to-center) and view toggles (transparent buildings, hide trees/walkers)
- [x] 11.7 Implement construction/demolition tools (drag, shift, alt, previews, confirmations, partial refunds) and paused-only undo
- [x] 11.8 Implement options and accessibility (graphics, audio mix, gameplay, text scale, high contrast, color-blind palettes, remapping, keyboard nav)

## 12. Persistence & Test Infrastructure (game-sessions, test-infra)

- [x] 12.1 Extend save/load to serialize all new systems with schema versioning, migration + backup, validation, and corrupted-save recovery
- [x] 12.2 Implement autosave rotation, quicksave, and quickload
- [x] 12.3 Add save/load round-trip determinism test
- [x] 12.4 Add the military-absence validator and wire it into CI (blocking)
- [x] 12.5 Extend the test pyramid: unit, integration (ceramics, export, import, labor scarcity, aristocratic evolution, regression), determinism, golden, property, and Playwright E2E
- [x] 12.6 Validate the §54 acceptance criteria end-to-end and confirm no central control is decorative
