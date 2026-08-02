# Game Shell Specification

## Purpose

The game shell is the Phaser browser view: it renders the sim map as an
isometric tilemap, provides the build/placement UI, HUD status panel, build
menu with categories, policy sliders, advisor message log, and boots with zero
required art assets via a procedural placeholder fallback.

## Requirements

### Requirement: Isometric tilemap rendering

The game SHALL render the sim map as a Phaser isometric tilemap (orientation ISOMETRIC), mapping sim tile types to terrain sprites. The renderer SHALL read sim state each frame and SHALL NOT hold authoritative game data.

#### Scenario: Map renders at boot

- **WHEN** the game boots with a sim map
- **THEN** the tilemap displays terrain tiles matching sim state

#### Scenario: Sim change reflects visually

- **WHEN** a building is placed in the sim
- **THEN** the corresponding building sprite appears on the map in the next rendered frame

### Requirement: Building placement UI

The game SHALL let the player select a building type from the build menu, see a ghost preview following the pointer with valid/invalid tint, and click to place. Placement SHALL issue a command to the sim and respect its validation result (invalid placements SHALL show an error message).

#### Scenario: Place road via UI

- **WHEN** the player selects road, moves the pointer over a free tile, and clicks
- **THEN** the sim receives a road placement command and a road tile renders

#### Scenario: Invalid placement rejected

- **WHEN** the player clicks an invalid location for the selected building
- **THEN** no building is placed, the ghost shows invalid tint, and a message explains the error

### Requirement: HUD status panel

The game SHALL display a HUD with: population, treasury (denarii), Population rating, Prosperity rating, and current tax/wage rates. The HUD SHALL update from sim state each frame.

#### Scenario: HUD reflects sim state

- **WHEN** population changes in the sim
- **THEN** the HUD population value updates to match

### Requirement: Build menu and categories

The game SHALL provide a build menu organizing buildings by category (roads, housing, food, water, infrastructure). Selecting a category SHALL show its buildings; each building SHALL show a name and cost.

#### Scenario: Select building from menu

- **WHEN** the player opens the food category and selects the farm
- **THEN** placement mode activates with a farm ghost preview

### Requirement: Policy sliders

The game SHALL provide sliders for tax rate and wage rate that issue `setPolicy` commands to the sim, and SHALL display the current values.

#### Scenario: Adjust tax rate

- **WHEN** the player moves the tax slider
- **THEN** the sim receives the new tax rate and the HUD reflects it

### Requirement: Advisor message log

The game SHALL surface sim messages (building inactive due to labor shortage, house evolved, low food supply) in a message log UI, and SHALL not corrupt sim state when displaying them.

#### Scenario: Message appears on event

- **WHEN** the sim emits a message (e.g. building inactive)
- **THEN** the message appears in the log

### Requirement: Boot with placeholder assets

The game SHALL boot and run with zero art assets using procedural placeholder graphics (Phaser Graphics or flat-color sprites) when sprite sheets are absent, so development and CI never block on art.

#### Scenario: Boot without sprite sheets

- **WHEN** the game loads with no art assets present
- **THEN** it renders placeholder-colored tiles and buildings and remains playable
