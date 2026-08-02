## ADDED Requirements

### Requirement: Home screen

The game SHALL start at a home screen instead of dropping directly into a city. The home screen SHALL offer New Game, Load Game, and a brief how-to-play note. New Game SHALL let the player start a city with a chosen seed and map size (with a sensible random default), and SHALL clear any previously running game.

#### Scenario: Home screen shows at launch

- **WHEN** the game loads
- **THEN** the home screen is shown with New Game, Load Game, and how-to-play options

#### Scenario: New Game starts a city

- **WHEN** the player enters a seed and starts a new game
- **THEN** a city is generated from that seed and the player lands in gameplay

#### Scenario: No saves, Load disabled

- **WHEN** the player has no saved games
- **THEN** Load Game is disabled or shows an empty list

### Requirement: Pause overlay

The game SHALL open a pause overlay when the player presses ESC during gameplay (and no build mode is active) or clicks a pause control. While the overlay is open the sim tick clock SHALL be paused. The overlay SHALL offer Resume, Save, and Restart. Restart SHALL discard the running game and return to the home screen.

#### Scenario: ESC pauses the game

- **WHEN** the player presses ESC during gameplay with no build mode active
- **THEN** the pause overlay opens and the sim stops advancing

#### Scenario: ESC with build mode cancels instead

- **WHEN** the player presses ESC while build mode is active
- **THEN** build mode is cancelled and no pause overlay opens

#### Scenario: Resume continues the sim

- **WHEN** the player selects Resume from the pause overlay
- **THEN** the overlay closes and the sim resumes advancing

#### Scenario: Restart returns home

- **WHEN** the player selects Restart from the pause overlay
- **THEN** the running game is discarded and the home screen is shown

### Requirement: Save game

The game SHALL let the player save the current game to persistent local storage from the pause overlay. A save SHALL capture enough data to resume the exact same deterministic simulation. Saving SHALL confirm success (or surface failure, e.g. storage full).

#### Scenario: Save persists the session

- **WHEN** the player saves from the pause overlay
- **THEN** the save is written to local storage and the player is told it succeeded

### Requirement: Load game

The home screen SHALL list available saves and let the player resume one. Loading SHALL reproduce the saved simulation state deterministically (same seed, map, commands, and tick count → same state).

#### Scenario: Load resumes a saved city

- **WHEN** the player selects a save from the home screen
- **THEN** the game resumes at the saved tick with the saved city

#### Scenario: Loaded game is deterministic

- **WHEN** a saved game is loaded
- **THEN** its simulation state equals what a fresh replay of the save's seed + command sequence would produce
