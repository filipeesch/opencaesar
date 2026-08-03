# City Ratings and Objectives Specification

## Purpose

The ratings-objectives capability computes four city ratings (Culture,
Prosperity, Civic Stability, Administrative Favor), each 0–100 with a
decomposable value, plus campaign objectives and win conditions.

## ADDED Requirements

### Requirement: City ratings

The system SHALL compute four ratings 0–100: Culture, Prosperity, Civic
Stability, and Administrative Favor. Ratings SHALL be decomposed into their
contributing factors so the UI can show exactly what moves each rating.

#### Scenario: Culture decomposes into factors

- **WHEN** Culture is computed
- **THEN** it decomposes into education, entertainment, religion, festivals, and coverage penalties

#### Scenario: Prosperity reflects economy

- **WHEN** Prosperity is computed
- **THEN** it reflects average housing level, patrician count, operating balance, unemployment, wages, trade, long-term stability, and debt

#### Scenario: Stability decomposes into factors

- **WHEN** Civic Stability is computed
- **THEN** it reflects fire history, homelessness, crime, protests, health, supply, employment, collapses, and residential stability

#### Scenario: Favor reflects administration

- **WHEN** Administrative Favor is computed
- **THEN** it reflects requests fulfilled/ignored, debt, gifts, objectives, tribute, governor salary, and city performance

### Requirement: Prosperity handles construction separately

Construction costs SHALL be treated separately from the operating balance so
productive expansion is not double-penalized.

#### Scenario: Construction not double-penalized

- **WHEN** a city builds productive infrastructure
- **THEN** the one-time construction cost does not count against the operating balance used for Prosperity

### Requirement: Objectives and win conditions

A mission SHALL be able to require population, ratings, treasury, and annual
exports (e.g., population 5000, Culture 60, Prosperity 55, Stability 70,
Favor 50, treasury 10000, annual pottery exports 20 loads). Victory SHALL
occur only when all requirements are held for the defined period (default three
months).

#### Scenario: Win requires sustained targets

- **WHEN** all mission targets are met and held for the defined period
- **THEN** the mission is won

#### Scenario: Targets not met, no win

- **WHEN** any required target is below its threshold
- **THEN** the mission is not won and the shortfall is shown
