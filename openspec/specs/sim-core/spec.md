# Sim Core Specification

## Purpose

The sim core is the framework-free simulation engine: a size-parameterized
terrain map, building placement with validation, building operation and
workforce, walkers moving along roads delivering services, the food/water/labor
supply chains, housing evolution, the tax/wage economy, and Population +
Prosperity ratings. It is deterministic (seeded RNG only) and exposed through
the single `SimRunner` API.

## Requirements
### Requirement: Map grid and terrain

The system SHALL provide a rectangular tile grid (default 40x40, size-parameterized) where each tile has a terrain type: earth, water, fertile, trees, rock, or road. The map SHALL be constructible from a seed, deterministically, and from an explicit tile layout for scenarios.

#### Scenario: Terrain lookup

- **WHEN** a map is constructed with a known layout
- **THEN** querying any tile returns its terrain type

#### Scenario: Out-of-bounds query

- **WHEN** a tile is queried outside the map bounds
- **THEN** the query returns an out-of-bounds marker, never undefined or a crash


### Requirement: Building placement rules

The system SHALL validate building placement before accepting it. Validation SHALL check: footprint fully inside map; all footprint tiles free (trees/rock may be flagged as replaceable); terrain requirement satisfied (e.g. farm requires fertile); and road access (at least one footprint edge adjacent to a road tile) for buildings that require it.

#### Scenario: Valid placement

- **WHEN** a house is placed on free earth with an adjacent road tile
- **THEN** the placement succeeds and the building appears in sim state

#### Scenario: Invalid terrain

- **WHEN** a farm is placed on earth without fertile soil
- **THEN** the placement is rejected with a terrain error and sim state is unchanged

#### Scenario: Missing road access

- **WHEN** a market is placed with no road tile adjacent to its footprint
- **THEN** the placement is rejected with a road-access error

#### Scenario: Occupied footprint

- **WHEN** a building is placed over any tile already occupied by another building
- **THEN** the placement is rejected with an occupancy error

#### Scenario: Out-of-map footprint

- **WHEN** a building footprint extends beyond the map edge
- **THEN** the placement is rejected with an out-of-bounds error


### Requirement: Building operation and workforce

Buildings SHALL have a worker requirement. A building SHALL be active only when its required workers are assigned; when unstaffed it SHALL cease production (e.g. farm stops producing wheat). Buildings with storage (granary, farm) SHALL have a capacity that is never exceeded; market distribution SHALL be bounded by the walker carry amount.

#### Scenario: Staffed farm produces

- **WHEN** a farm has its required workers and sits on fertile land
- **THEN** its wheat stock increases over ticks up to its local capacity

#### Scenario: Unstaffed farm stops

- **WHEN** a farm loses all assigned workers
- **THEN** its wheat stock stops increasing and it reports inactive

#### Scenario: Capacity bound

- **WHEN** a granary's wheat stock is at capacity
- **THEN** no further wheat is added and stock never exceeds capacity


### Requirement: Walker lifecycle and road movement

Walkers SHALL be agents spawned by buildings that move along road tiles only. Each walker SHALL have a type, position, state, lifetime in ticks, and optional target. Walkers SHALL choose directions at road junctions via the seeded RNG. Walkers SHALL despawn when their lifetime expires or their objective completes.

#### Scenario: Walker stays on roads

- **WHEN** a walker exists on a road-connected map for its full lifetime
- **THEN** every tile it occupies during movement is a road tile

#### Scenario: Walker despawns after lifetime

- **WHEN** a walker's lifetime ticks elapse
- **THEN** the walker is removed from sim state


### Requirement: Service coverage by walkers

Walkers SHALL deliver services to houses near the road tiles they walk: each tick, houses on tiles orthogonally adjacent to the walker's current tile SHALL receive the walker's service flag (e.g. food, water, labor) with a cooldown. A house's received service SHALL expire when its cooldown elapses without a new visit, so services must be re-supplied.

#### Scenario: House covered by market walker

- **WHEN** a market walker carrying food passes a house tile
- **THEN** the house gains a food-service flag with a cooldown

#### Scenario: Coverage decays

- **WHEN** a house has a food-service flag and is not re-visited for longer than the cooldown
- **THEN** the food-service flag expires


### Requirement: Food supply chain

The system SHALL implement the food chain: farm produces wheat → granary stores wheat → market walkers fetch wheat from a granary and carry it back → market walkers deliver food to houses passed. Houses SHALL consume food; a house with no food service for a sustained period SHALL stop growing (and may devolve).

#### Scenario: Full pipeline feeds houses

- **WHEN** a scenario has a staffed farm on fertile land, a granary, a market, and houses all connected by roads, run for enough ticks
- **THEN** the granary receives wheat, the market walker fetches wheat, and houses acquire the food-service flag

#### Scenario: No granary, no food

- **WHEN** a market exists but no granary has wheat
- **THEN** market walkers return empty and houses never acquire the food-service flag


### Requirement: Water service

Well buildings SHALL spawn water walkers that wander roads and deliver a water-service flag to houses they pass, with the same cooldown semantics as food.

#### Scenario: Well waters houses

- **WHEN** a well is placed on a road-connected map with houses nearby
- **THEN** water walkers spawn and houses passed acquire the water-service flag


### Requirement: Labor pool

Houses SHALL provide workers based on tier (higher tiers provide more). Buildings SHALL become reachable for labor when a labor walker connects them to houses. Assigned workers SHALL be drawn from the reachable worker pool; on shortage the building SHALL go inactive.

#### Scenario: Workers assigned to building

- **WHEN** houses exist and a labor walker connects a building to them
- **THEN** the building receives workers up to its requirement from the pool

#### Scenario: Labor shortage deactivates building

- **WHEN** total reachable workers are below the building's requirement
- **THEN** the building is understaffed and inactive

#### Scenario: Connected building stays staffed

- **WHEN** a building has received a labor walker and is labor-connected
- **THEN** it remains labor-connected and keeps its workers assigned across ticks, rather than dropping the connection merely because a walker cooldown or the walker's lifetime expired

#### Scenario: Unconnected building needs a labor walker

- **WHEN** a worker-requiring building has not yet been reached by a labor walker
- **THEN** it stays disconnected and unstaffed until a labor walker reaches it


### Requirement: Housing evolution

Houses SHALL have tiers (shack → villa, 5 tiers) with population capacity per tier. A house SHALL evolve up when food, water, labor, and desirability thresholds are satisfied for a sustained window of ticks; SHALL devolve on persistent shortfall; and SHALL never exceed the max tier.

#### Scenario: House evolves with services

- **WHEN** a house has sustained food + water coverage and meets desirability threshold
- **THEN** it advances one tier and its population capacity increases

#### Scenario: House devolves without food

- **WHEN** a house has no food coverage for longer than the sustained-shortfall window
- **THEN** it devolves one tier and its population capacity decreases

#### Scenario: House evolves with all requirements

- **WHEN** a house is occupied and satisfies all cumulative goods, services, religion, and desirability requirements for the minimum period
- **THEN** it advances one level and its capacity updates

#### Scenario: House devolves after tolerance

- **WHEN** a house loses a requirement past its tolerance period
- **THEN** it devolves one level and excess residents are relocated

#### Scenario: Hysteresis prevents oscillation

- **WHEN** a house's condition hovers near the boundary
- **THEN** the grace period and separate evolve/devolve limits prevent constant level switching

#### Scenario: Houses merge into larger lot

- **WHEN** compatible adjacent houses with room and no blocking merge enables the next level
- **THEN** they merge into a larger footprint lot and capacity/class update accordingly


### Requirement: Economy — taxes and treasury

Houses SHALL pay taxes per tick based on tier. The treasury SHALL accumulate taxes and pay wages at the configured wage rate. Tax and wage rates SHALL be adjustable via policy. Higher tax rates SHALL reduce desirability; higher wage rates SHALL increase desirability.

#### Scenario: Taxes fill treasury

- **WHEN** houses exist and the tax rate is above zero
- **THEN** the treasury increases each tick by the sum of house taxes minus wages

#### Scenario: Wage policy affects desirability

- **WHEN** the wage rate is raised
- **THEN** desirability calculations reflect the new rate

#### Scenario: Treasury cannot go negative from wages

- **WHEN** the treasury is zero and wages are due
- **THEN** the treasury does not go below zero (wages unpaid, with a desirability penalty)

#### Scenario: Growing city stays solvent

- **WHEN** a city grows houses and employs workers at default policy rates
- **THEN** the treasury does not structurally bleed to zero from wages exceeding taxes

#### Scenario: Treasury recovers from temporary deficit

- **WHEN** the treasury hits zero and wages go unpaid briefly
- **THEN** the city can recover as taxes resume and the unpaid-wage penalty clears


### Requirement: Ratings — population, prosperity, and happiness

The system SHALL track Population (sum of house population capacities), Prosperity (computed from housing quality, employment, and revenue), and a city Happiness rating (population-weighted average of per-house happiness). Ratings SHALL be exposed in state for HUD display.

#### Scenario: Population tracks housing

- **WHEN** houses evolve up
- **THEN** the Population rating equals the sum of all house tier capacities

#### Scenario: Prosperity reflects economy

- **WHEN** housing tiers, employment, and treasury change
- **THEN** the Prosperity rating is recomputed from those factors

#### Scenario: Ratings include happiness

- **WHEN** the sim computes ratings
- **THEN** the ratings include a Happiness value alongside Population and Prosperity


### Requirement: Desirability exposed in state

The system SHALL expose a house's current desirability value in the building snapshot returned by `getState()`, so the UI can display it. The exposed value SHALL equal the desirability computed during housing evolution for the same tick.

#### Scenario: House snapshot includes desirability

- **WHEN** a house exists and `getState()` is called
- **THEN** the house's snapshot includes a desirability number in the same range the evolution logic uses

#### Scenario: Desirability tracks services and policy

- **WHEN** a house gains water/food coverage or the wage/tax policy changes
- **THEN** the exposed desirability updates to reflect the new coverage or policy


### Requirement: Deterministic simulation

The simulation SHALL be deterministic: given the same seed, the same map, and the same command sequence, the state after N ticks SHALL be identical. All randomness SHALL come from the injected seeded RNG; the sim SHALL never call global random functions.

#### Scenario: Same seed reproduces state

- **WHEN** two sims are constructed with the same seed, map, and command sequence and ticked N times
- **THEN** their full state snapshots are identical


### Requirement: SimRunner API

The system SHALL expose `SimRunner` as the single public interface with: `tick()`, `getState()` returning a plain serializable snapshot, `placeBuilding(type, x, y)`, `setPolicy(taxRate, wageRate)`, and construction taking `(seed, map)`. Commands SHALL be validated and rejected commands SHALL leave state unchanged.

#### Scenario: Command then state change

- **WHEN** `placeBuilding('house', x, y)` is called on a valid tile
- **THEN** `getState()` reflects the new house at that tile

#### Scenario: Rejected command leaves state intact

- **WHEN** `placeBuilding('farm', x, y)` is called on invalid terrain
- **THEN** `getState()` is unchanged and an error is returned

### Requirement: Fixed-timestep deterministic scheduler

The simulation SHALL advance on a fixed timestep controlled by a TimeSystem
and SHALL NOT depend on frame rate. The player SHALL be able to pause and to
select speeds 0.5×, 1×, 2×, 4×, and 8×. The player SHALL be able to build,
demolish, consult panels, change priorities, and issue trade orders while
paused.

#### Scenario: Sim advances on fixed timestep

- **WHEN** the sim is stepped at different real frame rates for the same number of simulated days
- **THEN** the resulting state is identical regardless of frame rate

#### Scenario: Pause halts the sim

- **WHEN** the sim is paused
- **THEN** no simulated time advances


### Requirement: Data-driven building and balance catalog

The system SHALL keep all building, commodity, housing-level, walker,
trade-city, event, mission, and localization definitions in external data that
is validated on load. The system SHALL read placement and operation from this
catalog. The system SHALL NOT scatter balance values as literal constants in
simulation code.

#### Scenario: Buildings defined in data

- **WHEN** a building is placed
- **THEN** its cost, footprint, workers, inputs/outputs, and risks come from the data catalog and are validated

#### Scenario: Catalog validation fails safe

- **WHEN** a catalog entry is invalid (e.g., missing fields)
- **THEN** loading reports the error and the game does not run with corrupt data


### Requirement: Road network graph and tile state

The sim SHALL represent roads as a graph and maintain an expanded per-tile
state: coordinates, terrainType, elevation, fertility, resourceType,
resourceAmount, waterDepth, road, aqueduct, buildingId, desirability, fireRisk,
collapseRisk, pollution, traffic, serviceCoverage, ownership, and blocked. The
graph SHALL be updated incrementally only in affected regions when roads,
bridges, or roadblocks change or a building entrance changes.

#### Scenario: Road graph recomputes locally

- **WHEN** a road is added or demolished
- **THEN** only the affected region of the road graph is recomputed and connectivity/accessibility reflect the change

#### Scenario: Tile carries risk fields

- **WHEN** a tile is queried
- **THEN** it exposes desirability, fireRisk, collapseRisk, pollution, traffic, and coverage per the expanded tile model


### Requirement: Walker categories and road types

Walkers SHALL be categorized as wandering, destination, or recruiter, with
per-type configurable data (maximumRoadSteps, serviceTTL, spawnInterval,
movementSpeed, allowedRoadTypes, roadblockPolicy, serviceRadiusFromCurrentTile,
preferredDirection, returnPolicy). Road types SHALL include dirt, paved,
plaza, bridge, service roadblock, wharf access, and stairs, each with its own
movement and desirability effects.

#### Scenario: Wandering walker returns at limit

- **WHEN** a wandering walker reaches its maximum road steps without returning
- **THEN** it returns to its origin building

#### Scenario: Destination walker finds a path

- **WHEN** a destination walker has a valid target
- **THEN** it travels the shortest valid road path to the target

#### Scenario: Recruiter determines labor access

- **WHEN** a recruiter reaches a plebeian residence within its range
- **THEN** the building is connected to the urban labor pool (rather than per-worker representation)

#### Scenario: Road types affect movement

- **WHEN** walkers traverse different road types
- **THEN** movement speed and desirability reflect the road type (e.g., paved plaza)

