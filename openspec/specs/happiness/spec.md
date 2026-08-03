# Happiness Specification

## Purpose

The happiness capability derives a per-house resident Happiness score (0–100)
and a city-wide Happiness rating from the same coverage, desirability, and
wage signals the rest of the sim already tracks. Happiness is derived each tick
(never stored as mutable state) and exposed in the building snapshot and the
city ratings for HUD display.

## Requirements
### Requirement: Per-house happiness

The system SHALL compute a Happiness score (0–100) for each house from its current food, water, and labor coverage, its desirability, and whether wages were paid last tick. Happiness SHALL be exposed in the house building snapshot.

#### Scenario: Well-served house is happy

- **WHEN** a house has active food, water, and labor coverage, high desirability, and wages were paid
- **THEN** its happiness is near the top of the 0–100 range

#### Scenario: Deprived house is unhappy

- **WHEN** a house has no food or water coverage or wages went unpaid
- **THEN** its happiness is near the bottom of the 0–100 range

#### Scenario: Happiness updates with coverage

- **WHEN** a house gains or loses a service
- **THEN** its happiness recomputes to reflect the new coverage in the same tick


### Requirement: City Happiness rating

The system SHALL track a city Happiness rating derived from the happiness of all houses (e.g. population-weighted average), exposed in `Ratings` for HUD display, and SHALL update every tick.

#### Scenario: Rating reflects population

- **WHEN** the city has happy, populous houses
- **THEN** the Happiness rating is high and rises as more houses are served

#### Scenario: Rating falls with hardship

- **WHEN** houses lose services or wages go unpaid
- **THEN** the Happiness rating falls to reflect the hardship

### Requirement: City mood/sentiment feeds attraction

The system SHALL maintain a city mood/sentiment signal (derived from
per-house happiness and city hardship) that feeds migration attractiveness and
city ratings, alongside the per-house happiness already derived.

#### Scenario: Mood feeds migration attractiveness

- **WHEN** city mood rises (served, prosperous population)
- **THEN** migration attractiveness increases

#### Scenario: Hardship lowers mood

- **WHEN** houses lose services or wages go unpaid
- **THEN** city mood falls, lowering migration attractiveness and ratings
