# Civil Safety Specification

## Purpose

The civil-safety capability covers fire risk and response, structural collapse
and inspection, and crime / civil order, all handled by non-military civil
workers: the urban brigade (fire), engineering posts (inspection), and the
urban watch (guards). There is no combat: guards protect, patrol, calm, and
assist but never attack citizens.

## ADDED Requirements

### Requirement: Fire risk and response

Each building SHALL have a fire risk that increases with time, flammable
material, lack of inspection, drought, proximity to industry, low water
coverage, and events, and decreases when a firefighter passes. On fire the
system SHALL show flames, evacuate residents, block operation, spread to
nearby buildings per configuration, allow brigade response, and destroy the
building if uncontrolled.

#### Scenario: Firefighter visit lowers risk

- **WHEN** a firefighter walker passes a building
- **THEN** its fire risk decreases and the fire is fought if active

#### Scenario: Uncontrolled fire destroys building

- **WHEN** a fire is not fought in time and reaches the destruction point
- **THEN** the building is destroyed and residents are displaced

#### Scenario: Fire spreads

- **WHEN** a fire is active and configured to spread
- **THEN** nearby flammable buildings may catch fire

### Requirement: Urban brigade

The urban brigade SHALL be a civil building responsible for fire prevention,
inspections, fire response, evacuation, and risk reduction. It SHALL have no
military function.

#### Scenario: Brigade sends firefighters

- **WHEN** the urban brigade is staffed and road-connected
- **THEN** it sends firefighter walkers that patrol and respond to fires

### Requirement: Structural collapse and inspection

Buildings SHALL age structurally. Engineers SHALL renew inspection. Without
coverage risk SHALL increase, cracks appear, a warning shows, and the building
may collapse. The engineering post SHALL send engineer walkers that reduce
collapse risk, register inspection, and identify critical buildings.

#### Scenario: Engineer visit reduces collapse risk

- **WHEN** an engineer walker passes a building
- **THEN** its collapse risk is reduced and inspection registered

#### Scenario: Uninspected building can collapse

- **WHEN** a building is uninspected so long that its collapse risk peaks
- **THEN** cracks appear, a warning shows, and the building may collapse

### Requirement: Crime and civil order

Crime SHALL depend on unemployment, poverty, taxes, lack of food, low
stability, low administrative coverage, inequality, and homelessness. Events
SHALL include theft at forum, theft at market, vandalism, protest, strike,
garden damage, and temporary road blocking. Urban guards SHALL patrol,
decrease risk, calm protests, recover part of stolen goods, and never attack
citizens.

#### Scenario: Guards reduce crime

- **WHEN** urban watch guards patrol an area
- **THEN** crime risk in that area decreases

#### Scenario: Guards calm a protest

- **WHEN** a guard reaches an active protest
- **THEN** the protest is calmed without combat

#### Scenario: No combat between guards and citizens

- **WHEN** a guard and citizen interact
- **THEN** no damage is inflicted on the citizen
