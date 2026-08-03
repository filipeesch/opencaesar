# Desirability Specification

## Purpose

The desirability capability computes a per-tile desirability value from radial
influences emitted by buildings and environment, updates it incrementally when
buildings are built or removed, and exposes a decomposable value in each house
inspector so the player can see exactly which factors raise or lower appeal.

## Requirements
### Requirement: Per-tile desirability field

The system SHALL maintain a desirability value for every tile, computed from
radial building effects. Each desirability-emitting building SHALL define
`baseEffect`, `radius`, `falloffPerTile`, and `minimumEffect`. Positive
influences SHALL include gardens, plazas, fountains, statues, temples,
oracles, schools, libraries, academies, baths, theatre, administrative
buildings, governor residences, monumental buildings, clean waterfront, high
ground, and aristocratic houses. Negative influences SHALL include industry,
mines, quarries, warehouses, granaries, very near markets, wharves, traffic,
wells, garbage, fires, abandoned buildings, homeless, disease, crime, and
noisy areas.

#### Scenario: Building raises nearby desirability

- **WHEN** a large garden is placed centered on a tile
- **THEN** tiles within the radius have a higher desirability than distant tiles, decreasing with falloff

#### Scenario: Industry lowers desirability

- **WHEN** a workshop or mine is placed near a house
- **THEN** the house tile's desirability is reduced relative to the same tile before placement

#### Scenario: Influence decays by distance

- **WHEN** two tiles are at different distances from a desirability source
- **THEN** the closer tile has a desirability at least as high as the farther tile

### Requirement: Incremental update on change

The system SHALL recompute desirability incrementally when a building is
constructed or removed, rather than recomputing the whole map each time. The
result after any sequence of builds/removals SHALL equal a full recomputation
for determinism purposes.

#### Scenario: Removal removes influence

- **WHEN** a desirability source is demolished
- **THEN** affected tiles return to the desirability they would have without that source

#### Scenario: Incremental equals recompute

- **WHEN** a sequence of build/remove commands is applied via incremental updates
- **THEN** the resulting desirability field equals a from-scratch recomputation over the same state

### Requirement: Decomposed house desirability

The house inspector SHALL show the total desirability value broken down into
its individual contributing effects (positive and negative) with the source
name and magnitude, never only the total. The inspector SHALL be able to
locate each contributing source on the map.

#### Scenario: Inspector lists contributors

- **WHEN** a house inspector is opened
- **THEN** it lists each contributing factor with name, sign, and magnitude summing to the displayed total

#### Scenario: Contributor locates source

- **WHEN** the player selects a listed contributor
- **THEN** the map highlights the contributing building tile
