## ADDED Requirements

### Requirement: ESC precedence

The game SHALL handle the ESC key with precedence: when build mode is active, ESC SHALL cancel build mode; otherwise ESC SHALL toggle the pause overlay.

#### Scenario: ESC cancels build mode first

- **WHEN** the player is in build mode and presses ESC
- **THEN** build mode is cancelled and the pause overlay does not open

#### Scenario: ESC opens pause otherwise

- **WHEN** the player is not in build mode and presses ESC
- **THEN** the pause overlay opens

### Requirement: Pausable sim clock

The game shell SHALL be able to pause the sim tick clock from the UI (e.g. pause overlay), such that no sim ticks advance while paused, and SHALL resume the same clock without losing ticks.

#### Scenario: Clock halts while paused

- **WHEN** the game is paused
- **THEN** the sim state does not advance across real time

#### Scenario: Clock resumes after unpause

- **WHEN** the game is unpaused
- **THEN** sim ticks resume from where they stopped
