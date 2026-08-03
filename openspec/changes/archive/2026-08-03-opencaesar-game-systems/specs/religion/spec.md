# Religion Specification

## Purpose

The religion capability models five cults (Ceres, Neptune, Mercury, Vesta,
Venus), religious buildings (small and large temples, oracles, festival
square), per-deity divine favor with states, and blessings and penalties that
are never instantly devastating.

## ADDED Requirements

### Requirement: Cults and religious buildings

The system SHALL support the cults Ceres (agriculture/food), Neptune
(water/fishing/sea trade), Mercury (trade/logistics), Vesta (homes/stability/
fire protection), and Venus (mood/culture/immigration). Temples SHALL send
priest walkers. Oracles SHALL not send walkers, increase favor of all, require
marble, and raise desirability.

#### Scenario: Temple sends priest

- **WHEN** a temple of a deity is staffed and road-connected
- **THEN** it sends a priest walker providing that cult's service to houses passed

#### Scenario: Oracle boosts all favor

- **WHEN** an oracle is present
- **THEN** favor of all deities rises and desirability increases, without sending walkers

### Requirement: Divine favor

Each deity SHALL have a favor value 0–100 affected by temple count and size,
population, time since last festival, coverage, neglect, and events. Favor
states SHALL be furious, displeased, indifferent, satisfied, honored, and
exalted.

#### Scenario: Favor reflects worship

- **WHEN** temples, festivals, and coverage for a deity increase and population demand is met
- **THEN** that deity's favor rises through the states

#### Scenario: Neglect lowers favor

- **WHEN** a deity is neglected with low coverage and no recent festival at growing population
- **THEN** its favor falls through the states

### Requirement: Blessings and penalties

Ceres blessing SHALL increase harvest and granary food preservation; penalty
SHALL temporarily reduce agriculture. Neptune blessing SHALL increase ship
frequency and fishing; penalty SHALL delay trade or reduce fishing. Mercury
blessing SHALL improve export prices and porter efficiency; penalty SHALL
temporarily reduce quotas or delay logistics. Vesta blessing SHALL reduce fire
risk and support residential stability; penalty SHALL slightly raise fire
risk. Venus blessing SHALL increase mood, immigration, and culture; penalty
SHALL lower mood or entertainment. Penalties SHALL NOT be instantly
devastating.

#### Scenario: Blessing applies

- **WHEN** a deity is honored enough to grant a blessing
- **THEN** the matching positive effect is applied while the blessing is active

#### Scenario: Penalty is bounded

- **WHEN** a deity grants a penalty
- **THEN** the penalty effect is bounded and not instantly devastating to the city
