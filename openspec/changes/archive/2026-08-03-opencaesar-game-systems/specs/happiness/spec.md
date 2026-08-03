# Happiness (Delta)

## ADDED Requirements

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
