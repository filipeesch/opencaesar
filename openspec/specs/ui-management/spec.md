# Management UI Specification

## Purpose

The ui-management capability covers the management interfaces that reflect
real simulation state: the main HUD, build menu, contextual inspector panels,
the 13 advisor screens, city overlays, and the message/alert log, plus options
and accessibility. Every listed control SHALL be wired to a real sim-backed
action; no central button SHALL be decorative.

## Requirements
### Requirement: HUD and build menu

The main screen SHALL have a top bar (city name, month/year, treasury, monthly
change, population, residential vacancies, unemployment, months of food,
speed, critical alerts) with detailed tooltips, a build menu organized into
categories, a control bar (pause, speeds, undo, demolish, overlays, advisors,
regional map, messages, objectives, minimap, options), and a contextual panel
that does not fully cover the map. Clicks on HUD items SHALL open the relevant
screen.

#### Scenario: HUD reflects sim state

- **WHEN** population, treasury, hunger, or alerts change
- **THEN** the HUD values update and tooltips show detail

#### Scenario: HUD click opens screen

- **WHEN** the player clicks the treasury item
- **THEN** the Finance advisor opens

#### Scenario: Build menu by category

- **WHEN** the player opens a build category
- **THEN** each item shows icon, name, cost, size, workers, maintenance, requirements, shortcut, and short description

### Requirement: Inspectors

The contextual panel SHALL support pinning, comparing two buildings,
resizing, collapsing, and navigating to similar/previous/next buildings.
Residence inspectors SHALL show header, evolution, services, goods,
environment, and controls. Productive building inspectors SHALL show name,
state, workers, efficiency, road access, labor access, input, output,
capacity, progress, cycles per month, porters, in-transit load, destination,
distance, risk, current order, and stop reason, with standardized states.
Storage inspectors SHALL show visual slots and per-product stored/reserved/in-
transit/capacity/order. Market inspectors SHALL show staff, served houses,
stock, demand, supplier, and buyer/seller status. Walker inspectors SHALL show
function, origin, type, state, destination, load, path, steps remaining,
distance, services provided, houses served, time to return, and wait reason,
with follow-camera and route buttons.

#### Scenario: Residence inspector decomposes state

- **WHEN** a house is inspected
- **THEN** header, evolution readiness, per-service access, per-good stock, environment, and controls are shown

#### Scenario: Production inspector shows stop reason

- **WHEN** a productive building is inspected
- **THEN** its standardized state and explicit stop reason are shown

#### Scenario: Walker inspector details a walker

- **WHEN** a walker is clicked
- **THEN** its origin, state, destination, path, load, and services are shown with follow and route buttons

### Requirement: Advisors

The system SHALL provide advisor screens: Chief, Population, Labor, Finance,
Commerce, Production/Logistics, Health, Education, Entertainment, Religion,
Ratings, and Administrative. Each SHALL show current indicators, trend,
comparison, alerts, explanation, actions, map links, filters, and history. No
advisor SHALL be military.

#### Scenario: Advisor shows real data

- **WHEN** the Labor advisor is opened
- **THEN** it shows sectors with employed/required/deficit/priority/effciency and controls that affect the sim

#### Scenario: Chief advisor ranks problems

- **WHEN** the Chief advisor is opened
- **THEN** it classifies problems as critical/urgent/attention/stable/excellent and each message is clickable

#### Scenario: No military advisor

- **WHEN** advisor tabs are listed
- **THEN** no military advisor exists

### Requirement: Overlays

Each overlay SHALL darken irrelevant elements, highlight buildings of the
system, show corresponding walkers, show columns/heatmaps on houses, have a
legend, allow clicking a house, and keep camera controls. Overlays SHALL cover
infrastructure, housing, risks, labor, food, goods, services, and economy.

#### Scenario: Overlay highlights system

- **WHEN** an overlay is activated
- **THEN** relevant buildings and houses are highlighted with a legend, others dimmed, and a house can be clicked for its inspector

### Requirement: Messages and alerts

Messages SHALL have severity (informative, success, attention, urgent,
critical) and categories (population, food, commerce, production, finance,
labor, health, risk, religion, objectives, administration, tutorial). Each
message SHALL have date, title, body, icon, severity, location, related
building, suggested action, locate button, open-advisor button, read state,
and category mute option. Repeated messages SHALL be grouped to avoid spam.

#### Scenario: Message grouped by repetition

- **WHEN** several buildings share the same failure
- **THEN** a single aggregated message (e.g., "5 pottery workshops lack clay") is shown instead of many

#### Scenario: Message locates its cause

- **WHEN** a message is clicked
- **THEN** it offers a locate button and open-advisor button

### Requirement: Options and accessibility

The system SHALL provide options for graphics, audio (music, ambient, effects,
interface, voices, alerts separately), gameplay, and accessibility (text scale,
high contrast, color-blind palettes, symbols beyond color, reduced motion,
captions, tooltip reading, full remapping, keyboard UI navigation, auto-pause
on panels, reduced speed, highlight building entrances).

#### Scenario: Accessibility options apply

- **WHEN** accessibility options are changed
- **THEN** they take effect on the UI (e.g., text scale, high contrast)
