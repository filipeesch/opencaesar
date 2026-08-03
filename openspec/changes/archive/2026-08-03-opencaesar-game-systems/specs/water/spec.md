# Water Specification

## Purpose

The water capability manages the water supply for the city: wells providing
basic local water, reservoirs storing water, aqueducts carrying water across
tiles, fountains delivering clean water to a radius, and public baths sending
attendants onto roads. It exposes a water overlay showing coverage and flow.

## ADDED Requirements

### Requirement: Well

A well SHALL provide basic local water without a network, have a local range,
serve low residential levels, slightly reduce desirability, be insufficient
for rich districts, and may carry a sanitary risk in polluted regions.

#### Scenario: Well serves low houses

- **WHEN** a well is placed near low-level houses
- **THEN** those houses receive basic water access and low residential levels can maintain water

#### Scenario: Well not enough for rich houses

- **WHEN** an advanced/rich house is served only by a well
- **THEN** the house does not satisfy the clean-water requirement needed for its level

### Requirement: Reservoir

A reservoir SHALL have a 3×3 footprint, need to touch a water source or
receive an aqueduct, store water, feed aqueducts and fountains, and expose its
inlet, outlet, and level.

#### Scenario: Reservoir stores water

- **WHEN** a reservoir is connected to a water source and filled
- **THEN** it reports a water level that feeds connected aqueducts and fountains

#### Scenario: Disconnected reservoir is dry

- **WHEN** a reservoir has no water source and no aqueduct feed
- **THEN** it stays empty and does not supply water

### Requirement: Aqueduct

An aqueduct SHALL be built tile by tile, connect reservoirs, may cross roads by
an arch, must not cross buildings, may elevate over depressions when
supported, and SHALL be demolisheable per segment. The water overlay SHALL show
active vs. no-flow aqueducts.

#### Scenario: Aqueduct carries water

- **WHEN** an aqueduct chain connects a full reservoir to a fountain
- **THEN** the fountain has active supply and the overlay shows the chain as active

#### Scenario: Broken chain stops flow

- **WHEN** an aqueduct segment is removed between the reservoir and the fountain
- **THEN** the fountain loses supply and the overlay shows a no-flow gap

### Requirement: Fountain

A fountain SHALL require network connection, provide clean water within a
radius, raise desirability, serve intermediate and advanced housing, and SHALL
switch off if it loses water or workers.

#### Scenario: Fountain serves clean water

- **WHEN** a fountain is connected to the water network and staffed
- **THEN** houses in its radius receive clean-water access and a desirability bump

#### Scenario: Fountain off without supply

- **WHEN** a connected fountain loses water or workers
- **THEN** it stops serving and houses lose clean-water access

### Requirement: Public bath

A public bath SHALL require reservoir water and workers, SHALL send an
attendant service walker along roads providing bath service, improve health
and desirability, and consume a small amount of water.

#### Scenario: Bath sends attendant

- **WHEN** a staffed, watered public bath is present on a road network
- **THEN** it sends a bath attendant walker that provides bath service to houses it passes

#### Scenario: Bath idle without water or workers

- **WHEN** a public bath has no water or no workers
- **THEN** it does not send attendants for bath service

### Requirement: Water overlay

The water overlay SHALL display: natural sources, full/empty reservoirs,
active aqueducts, no-flow aqueducts, connected fountains, well coverage,
fountain coverage, houses without water, houses with basic water, houses with
clean water, and consumer buildings.

#### Scenario: Overlay shows coverage classes

- **WHEN** the water overlay is active
- **THEN** it distinguishes houses with no water, basic water, and clean water, plus source and network state
