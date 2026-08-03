# Game Shell (Delta)

## ADDED Requirements

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
