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

### Requirement: Overlay rendering

The game SHALL render sim overlays as semi-transparent tinting/heatmaps over
the tilemap, darkening irrelevant elements and highlighting the buildings and
walkers relevant to the active overlay, with a legend and click-through to the
inspector for a house. Camera controls SHALL remain active while an overlay is
shown.

#### Scenario: Overlay tints the map

- **WHEN** a sim overlay is active
- **THEN** relevant tiles/buildings are highlighted, others dimmed, a legend shows, and clicking a house opens its inspector


### Requirement: Walker and effects rendering

The game SHALL render sim walkers and transient effects (smoke, carts, goods
in yards, water in fountains, fire, cracks, birds, festival scenes) from sim
state each frame. The renderer SHALL NOT hold authoritative data.

#### Scenario: Walker renders from sim

- **WHEN** a sim has active walkers
- **THEN** corresponding walker sprites are rendered at their positions each frame

#### Scenario: Effects render from sim

- **WHEN** the sim reports an active effect (e.g., a fire)
- **THEN** the corresponding effect is rendered


### Requirement: Build menu from the data catalog

The build menu SHALL derive its categories and building entries from the
data-driven catalog. Each entry SHALL show icon, name, cost, size, workers,
maintenance, requirements, shortcut, and short description. Clicking an entry
SHALL activate placement mode with a ghost preview, footprint indication, road
access indicator, incompatible-terrain indicator, and a total cost readout
before placement, respecting Shift for repeat placement, right-click/Escape to
cancel, and being usable while paused.

#### Scenario: Menu derives from data

- **WHEN** the build menu opens
- **THEN** entries match the data catalog including cost, size, workers, and requirements

#### Scenario: Ghost preview shows validity

- **WHEN** placement mode is active
- **THEN** a green/red preview with footprint and road-access indication follows the pointer and total cost is shown


### Requirement: Full HUD from real sim state

The HUD SHALL show city name, month/year, treasury, monthly change,
population, residential vacancies, unemployment, months of food, speed, and
critical alerts, each with a detailed tooltip and navigation to the matching
screen, all fed from live sim state.

#### Scenario: HUD items navigate

- **WHEN** the player clicks a HUD item (treasury, population, unemployment, food, date, alert)
- **THEN** the matching screen or message opens


### Requirement: Camera and view options

The game SHALL support WASD/arrow panning, middle-button pan, optional
edge-panning, wheel and keyboard zoom, focus on the selected building, return
to the administrative center, clickable minimap, transparent-building view
mode, hide-trees, and hide-walkers options.

#### Scenario: Camera controls move the view

- **WHEN** the player uses pan/zoom/focus controls
- **THEN** the camera moves/zooms/focuses accordingly

#### Scenario: View toggles apply

- **WHEN** the player toggles hide-trees or hide-walkers
- **THEN** the corresponding elements stop rendering


### Requirement: Construction and demolition tools

Construction SHALL support click to place, click-and-drag for roads, aqueducts,
and plazas, Shift for repeated placement, and Alt to ignore snap. Demolition
SHALL support a single tool and an area tool, with confirmation for important
buildings, optional removal cost, and configurable partial refund; monuments
and administrative buildings SHALL never be removed accidentally without
confirmation. The game SHALL support undoing recent construction only while
paused and before the sim has consumed the result.

#### Scenario: Drag places a road

- **WHEN** the player click-drags over tiles in road mode
- **THEN** a road is placed along the dragged tiles with a total cost shown

#### Scenario: Important demolition confirms

- **WHEN** the player attempts to demolish an important or administrative building
- **THEN** a confirmation is required before removal

#### Scenario: Undo only while paused

- **WHEN** the player undoes a construction action while the sim is paused and before it is consumed
- **THEN** the action is undone; otherwise undo is unavailable
