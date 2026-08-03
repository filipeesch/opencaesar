# Game Sessions (Delta)

## ADDED Requirements

### Requirement: Autosave and quicksave

The system SHALL support a rotating autosave, a quicksave, and a quickload in
addition to manual saves. Saving SHALL capture all simulation systems so the
exact deterministic state can be resumed.

#### Scenario: Autosave rotates

- **WHEN** autosave triggers repeatedly
- **THEN** old autosaves are rotated out and the latest is retained

#### Scenario: Quicksave and quickload

- **WHEN** the player quicksaves and later quickloads
- **THEN** the game resumes the exact quicksaved state

### Requirement: Save schema versioning and migration

Save data SHALL include a schema version. On load, saves from older schema
versions SHALL be migrated, with a backup before migrating, validation, and
recovery of a corrupted save when possible.

#### Scenario: Older save migrates

- **WHEN** a save with an older schema version is loaded
- **THEN** it is migrated to the current schema with a backup and validates successfully

#### Scenario: Corrupted save recovers when possible

- **WHEN** a save is corrupted
- **THEN** the system attempts recovery and reports success or failure rather than crashing

### Requirement: Deterministic reload

After load the simulation SHALL remain deterministic: replays of the same
save reproduce the same subsequent state.

#### Scenario: Loaded run stays deterministic

- **WHEN** a save is loaded and the sim continues for N ticks
- **THEN** a fresh replay from the same saved state produces identical results
