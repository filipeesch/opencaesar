# Events Specification

## Purpose

The events capability covers non-military random events driven by a
deterministic schedule based on the seed, each with a cause, duration, effects,
initial/update/final messages, severity, and optional response options.

## ADDED Requirements

### Requirement: Event catalog

The system SHALL support non-military events: drought, exceptional harvest,
agricultural plague, flood, earthquake, fire, epidemic, regional population
growth, price fall, price rise, temporarily congested route, naval delay,
strike, spontaneous festival, marble discovery, fertility reduction, special
merchant, urgent request, donation, administrative visit, regional shortage,
exceptional product demand, industrial accident, collapse, well contamination,
heat wave, and severe winter (if the campaign uses climate).

#### Scenario: Event catalog available

- **WHEN** events are defined in data
- **THEN** they include cause, duration, effects, and messages

### Requirement: Event lifecycle

Each event SHALL have a cause, duration, effects, initial message, update
message, final message, and severity, plus response options when applicable.
Events SHALL be scheduled deterministically from the seed.

#### Scenario: Event runs its lifecycle

- **WHEN** an event becomes active
- **THEN** it shows an initial message, applies effects for its duration with updates, and a final message on conclusion

#### Scenario: Deterministic scheduling

- **WHEN** the same seed and state is replayed
- **THEN** the same events activate at the same times

### Requirement: Event responses

When an event offers response options, the player SHALL be able to choose a
response that changes the outcome.

#### Scenario: Response changes outcome

- **WHEN** a player selects an available event response
- **THEN** the event outcome reflects the choice per its data
