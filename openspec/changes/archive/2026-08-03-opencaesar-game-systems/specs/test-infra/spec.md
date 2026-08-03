# Test Infrastructure (Delta)

## ADDED Requirements

### Requirement: Extended integration scenarios

The test suite SHALL include integration scenarios for: ceramics chain (clay
extracted → workshop produces pottery → warehouse stores → market fetches →
house consumes); export (route opened, order configured, caravan collects a
load, quota reduces, treasury increases); import (target set, merchant delivers,
treasury decreases, load reaches the commercial center and is usable); labor
scarcity (priority sector keeps workers, low-priority sector loses workers);
aristocratic evolution (houses merge, capacity changes, excess residents seek
homes, taxes/prosperity increase); regression (removing a service, waiting the
grace period, devolve, excess residents relocated, UI explains the cause);
and save/load round-trip producing the same deterministic results.

#### Scenario: Ceramics chain works end to end

- **WHEN** a scenario runs clay pit → pottery workshop → warehouse → market → house
- **THEN** clay is extracted, pottery is produced, stored, fetched, and consumed by the house

#### Scenario: Export flow works

- **WHEN** a route is opened with an export order and a caravan arrives
- **THEN** the caravan collects a load, the quota decreases, and the treasury increases

#### Scenario: Import flow works

- **WHEN** an import target is set and a merchant arrives
- **THEN** the treasury decreases, the load reaches the commercial center, and a market/workshop can use it

#### Scenario: Regression scenario explains cause

- **WHEN** a service is removed and the grace period elapses
- **THEN** the house devolves, excess residents are relocated, and the UI explains the cause

### Requirement: Save/load round-trip test

The suite SHALL save, load, and continue the sim, comparing state, and SHALL
assert the same seed produces the same results.

#### Scenario: Round-trip reproduces state

- **WHEN** a game is saved, loaded, and continued for N ticks
- **THEN** the state matches a fresh replay from the saved snapshot and determinism holds

### Requirement: Military-absence validator

The suite SHALL automatically validate that no military system exists by
searching source and data for forbidden patterns (military, army, legion,
soldier, fort, barracks, weapon, enemy, invasion, combat, damageFromUnit).
Occurrences SHALL be allowed only in documentation that explicitly states these
systems do not exist. The validator SHALL run in CI and fail on violations.

#### Scenario: Validator passes on clean repo

- **WHEN** the validator scans source and data with no military references
- **THEN** it passes

#### Scenario: Validator fails on military reference

- **WHEN** a forbidden military term appears in source or data outside explicit non-existence documentation
- **THEN** the validator fails
