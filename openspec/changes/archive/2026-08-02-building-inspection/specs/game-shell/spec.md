## ADDED Requirements

### Requirement: Building detail popup

The game SHALL show a detail popup for the building under the pointer when the player clicks a building, and SHALL show nothing when clicking non-building terrain. The popup SHALL display per-building data appropriate to the building type, read from sim state, and SHALL close when the player clicks elsewhere, presses ESC, or activates a dismiss control.

#### Scenario: Clicking a house shows its status

- **WHEN** the player clicks a house building
- **THEN** a popup appears showing the house's tier/name, population capacity, food, water, and labor service status, and desirability

#### Scenario: Clicking a farm shows its stock

- **WHEN** the player clicks a farm building
- **THEN** the popup shows the farm's wheat stock, workers assigned/required, and active state

#### Scenario: Clicking empty terrain shows nothing

- **WHEN** the player clicks a tile that has no building
- **THEN** no popup appears, and an open popup closes

#### Scenario: Popup closes on ESC

- **WHEN** the player presses ESC while a popup is open
- **THEN** the popup closes
