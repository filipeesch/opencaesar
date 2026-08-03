# Governance and Administration Specification

## Purpose

The governance-administration capability covers the city's administrative
buildings (forum, senate, governor residences) and administrative requests
from the imperial administration that the player can accept, reserve goods
for, and deliver.

## Requirements
### Requirement: Administrative buildings

The forum SHALL send tax collectors, temporarily store taxes, moderately raise
desirability, and provide administrative presence. The senate SHALL be the
administrative center, show ratings via flags/visual elements, send tax
collectors, store taxes, gather statistics, and be a camera center point.
Governor residences SHALL have three levels (residence, palace, provincial
mansion) with effects on desirability, prestige, favor, max allowed salary, and
campaign milestones; constructing higher levels SHALL require population or
rating thresholds.

#### Scenario: Forum sends tax collectors

- **WHEN** the forum is staffed and road-connected
- **THEN** it sends tax collectors that register houses for taxation

#### Scenario: Governor residence raises max salary

- **WHEN** the governor residence level increases
- **THEN** the maximum allowed governor salary rises accordingly

#### Scenario: Advanced residence requires threshold

- **WHEN** the player attempts to build a higher governor residence without the population/rating threshold
- **THEN** construction is blocked and the required threshold is shown

### Requirement: Administrative requests

The imperial administration SHALL be able to request food, pottery, oil, wine,
furniture, tools, marble, money, holding a festival, building a monument,
reaching population, opening a route, or maintaining an export. Each request
SHALL have title, description, quantity, deadline, reward, penalty, partial
delivery option, locate-stock button, reserve-product button, and send button.

#### Scenario: Request delivered

- **WHEN** the player reserves goods and sends them to satisfy an accepted request
- **THEN** the request completes, the reward is granted, and reserved goods are consumed

#### Scenario: Reserving goods prevents other use

- **WHEN** goods are reserved for a request
- **THEN** warehouses stop exporting them and markets stop distributing them as required, with progress shown

#### Scenario: Partial delivery supported

- **WHEN** a request allows partial delivery and the player sends part of the quantity
- **THEN** progress updates and the penalty/reward reflect partial completion

#### Scenario: No instant removal before send

- **WHEN** goods are reserved but not yet sent
- **THEN** they are not removed from the city until the player confirms sending
