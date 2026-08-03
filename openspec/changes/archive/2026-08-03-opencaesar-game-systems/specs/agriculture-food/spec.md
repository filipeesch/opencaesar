# Agriculture and Food Specification

## Purpose

The agriculture-food capability covers the production, storage, and supply of
food: farms (wheat, vegetables, fruit, meat, olives, vines), fishing wharves,
and granaries that store and release food resources to markets.

## ADDED Requirements

### Requirement: Food types and residential demand

The system SHALL support food types: wheat, vegetables, fruit, meat, and fish
(on coastal or river maps). Low-level residences SHALL require at least one
food type, intermediate residences SHALL require two, and aristocratic
residences SHALL require three or more.

#### Scenario: Low house needs one food

- **WHEN** a low-level house has access to one food type
- **THEN** its food requirement is satisfied

#### Scenario: Aristocratic house needs more food

- **WHEN** a villa/palace requires three food types
- **THEN** the house only satisfies its food requirement when it has access to all three

### Requirement: Farm production

Farms SHALL require fertile terrain (except animal husbandry), and efficiency
SHALL depend on the average fertility of the footprint, workers, road access,
and physical output loads. Production SHALL equal base rate × average
fertility × staffing ratio × religious modifier × event modifier. Farms SHALL
send physical loads to granaries, workshops, or warehouses and SHALL be
pauseable.

#### Scenario: Fertile staffed farm produces

- **WHEN** a staffed farm sits on fertile soil with road access and sufficient time
- **THEN** it produces food loads that move to a granary or warehouse

#### Scenario: Poor fertility reduces output

- **WHEN** a farm's footprint has lower average fertility
- **THEN** its production is proportionally lower

#### Scenario: Paused farm stops

- **WHEN** a farm is paused
- **THEN** it stops producing while paused

### Requirement: Fishing wharf

A fishing wharf SHALL touch navigable water, send a fishing boat, have a
voyage time, return with fish, transfer fish to a granary, and be affected by
river productivity. There SHALL be no naval combat.

#### Scenario: Wharf returns fish

- **WHEN** a fishing wharf touches navigable water with workers
- **THEN** its boat voyages and returns with fish transferred to a granary

#### Scenario: No navigable water, no fish

- **WHEN** a fishing wharf is placed with no navigable water
- **THEN** it cannot operate

### Requirement: Granary

A granary SHALL store only food, with capacity divided into loads, and SHALL
support per-food commands: accept, refuse, request, maintain quantity, empty,
reserve for local consumption, allow export, and high/low priority. The
granary SHALL visually display its content.

#### Scenario: Granary stores food only

- **WHEN** a granary receives produce
- **THEN** it stores only food loads, subject to capacity, and markets can withdraw them

#### Scenario: Granary commands control flow

- **WHEN** a granary is set to refuse a food type
- **THEN** it stops accepting that food and markets/stores no longer draw it for redistribution
