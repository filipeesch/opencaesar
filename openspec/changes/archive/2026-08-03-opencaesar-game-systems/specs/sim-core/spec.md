# Sim Core (Delta)

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Housing evolution

Houses SHALL progress through data-driven levels (0 empty lot through 20
luxurious palace, including plebeian levels 1–12 and patrician villas/palaces
13–20) with population capacity per level. Each level SHALL have cumulative
requirements (food types, goods, services, religion count, entertainment
points, desirability). A house SHALL evolve up when occupied, all requirements
are satisfied (goods and active service access), the minimum desirability is
met, there is no extreme risk, and it remains eligible for the configured
minimum period; SHALL devolve when it loses requirements past the tolerance
period, desirability falls below the regression threshold, food is lacking,
essential services are absent, or structural damage persists; and SHALL use
hysteresis (higher evolve limit, lower devolve limit, 1–3 month grace period).
Adjacent houses SHALL be able to merge into larger lots when levels are
compatible, tiles belong to the same block, no building blocks, footprint
space exists, merging is needed for the next level, and not disabled by the
player.

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
