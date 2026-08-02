## ADDED Requirements

### Requirement: Desirability exposed in state

The system SHALL expose a house's current desirability value in the building snapshot returned by `getState()`, so the UI can display it. The exposed value SHALL equal the desirability computed during housing evolution for the same tick.

#### Scenario: House snapshot includes desirability

- **WHEN** a house exists and `getState()` is called
- **THEN** the house's snapshot includes a desirability number in the same range the evolution logic uses

#### Scenario: Desirability tracks services and policy

- **WHEN** a house gains water/food coverage or the wage/tax policy changes
- **THEN** the exposed desirability updates to reflect the new coverage or policy
