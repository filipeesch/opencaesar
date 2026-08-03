# Production and Storage Specification

## Purpose

The production-storage capability covers extraction sites (clay, wood, iron
ore, marble, olives, grapes), workshops that transform raw materials into
manufactured goods, warehouses with per-commodity orders, and the physical
load logistics that move goods between producer, storage, and consumer.

## ADDED Requirements

### Requirement: Production chains

The system SHALL implement chains: clay → pottery workshop → pottery; wood →
carpentry → furniture; olives → oil press → oil; grapes → winery → wine; iron
ore → metallurgy → tools; marble → warehouse, construction, or export; and
food farm → granary → market → houses. One load of raw material SHALL yield
one load of finished product unless configured otherwise.

#### Scenario: Clay becomes pottery

- **WHEN** a clay pit feeds a pottery workshop that also has workers
- **THEN** the workshop consumes clay and produces pottery loads over time

#### Scenario: Missing input halts workshop

- **WHEN** a workshop has no raw material input
- **THEN** it reports waiting for material and produces nothing

### Requirement: Extraction sites

Clay pits SHALL operate only near valid clay deposits and produce clay, lower
desirability, and send clay to workshops or warehouses. Timber yards SHALL
operate only near forest and send wood to carpentry or warehouses. Iron mines
SHALL require mineral terrain, produce ore, have high worker needs, and high
visual/desirability impact. Marble quarries SHALL require appropriate rock,
produce high-value marble for monuments and trade.

#### Scenario: Extraction produces raw loads

- **WHEN** a staffed extraction site is placed on a valid deposit with road access
- **THEN** it produces raw-material loads sent to an accepting destination

#### Scenario: Invalid deposit blocks extraction

- **WHEN** an extraction building is not on a valid deposit
- **THEN** it cannot produce

### Requirement: Workshop operation and state

Each workshop SHALL track internal input stock and capacity, production
progress, output stock, porter, preferred destination, produced quantity,
efficiency, and time since last delivery. A fully operating raw-material
producer SHALL roughly sustain two workshops. Workshops SHALL be more
labor-intensive, manufactured goods SHALL be worth more than raw materials,
and transport bottlenecks SHALL reduce real production.

#### Scenario: Workshop inspector reports full state

- **WHEN** a workshop is inspected
- **THEN** the inspector shows input/output stock, progress, efficiency, porters, destination, distance, and stop reason

#### Scenario: Bottleneck lowers output

- **WHEN** a workshop has no porter or no reachable destination
- **THEN** its real production is stalled and it reports the specific bottleneck

### Requirement: Destination selection

When a load is ready, the system SHALL: look for a workshop that accepts the
raw material, prioritize the nearest and most needy, else look for a
warehouse, respect special orders, respect capacity, and if no destination
exists keep the load and mark the building as blocked. Goods SHALL NOT be
silently destroyed.

#### Scenario: Ready load routes to destination

- **WHEN** a raw-material load is ready and an accepting, reachable destination with capacity exists
- **THEN** the load is reserved and transported there

#### Scenario: No destination blocks, no loss

- **WHEN** no destination accepts the load
- **THEN** the load is retained and the building is marked blocked, with nothing destroyed

### Requirement: Warehouse and per-commodity orders

A warehouse SHALL have a 3×3 footprint and store one load per visual slot per
commodity across the list of tradeable goods. The system SHALL support
per-commodity orders: accept, refuse, request, maintain a quantity, empty,
reserve, and prioritize as commercial center.

#### Scenario: Warehouse stores one load per slot

- **WHEN** a warehouse receives commodities
- **THEN** each stored load occupies a slot and total never exceeds slot capacity

#### Scenario: Refuse stops intake

- **WHEN** a warehouse is set to refuse a commodity
- **THEN** it stops accepting new loads of that commodity while continuing to send existing stock

#### Scenario: Maintain sets priority target

- **WHEN** a warehouse is set to maintain 8 loads of pottery
- **THEN** it becomes a priority destination for pottery while below the target

#### Scenario: Reserve prevents distribution

- **WHEN** a commodity is reserved
- **THEN** it cannot be exported, distributed, or consumed by non-priority workshops

### Requirement: Commercial center

The city SHALL have a single warehouse designated as the Commercial Center,
the preferred destination for land imports and the main unloading reference,
changeable by the player. If full, the system SHALL look for an accepting
alternative warehouse, show a warning, and never discard imports unexplained.

#### Scenario: Imports route to commercial center

- **WHEN** a land import arrives and the Commercial Center accepts the product with capacity
- **THEN** the import is delivered there

#### Scenario: Full center falls back with warning

- **WHEN** the Commercial Center is full
- **THEN** an accepting alternative warehouse is used and a warning is shown, with no silent discard
