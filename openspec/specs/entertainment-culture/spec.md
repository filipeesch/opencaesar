# Entertainment and Culture Specification

## Purpose

The entertainment-culture capability covers non-combative entertainment:
training schools (actor company, music school, athletics guild, racing
stables), venues (theatre, auditorium, civic amphitheatre, civic arena,
hippodrome), coverage scoring for houses, and festivals.

## Requirements
### Requirement: Training and venues

Training schools SHALL send compatible performers to venues: actors to a
theatre, musicians to an auditorium, athletes to an arena, and racing teams to
a hippodrome. Venues SHALL require workers, road access, a compatible performer,
capacity, and time between shows, and SHALL send a coverage walker onto the
streets.

#### Scenario: Actor company feeds theatre

- **WHEN** an actor company is staffed and road-connected to a theatre
- **THEN** actors are sent and the theatre sends a coverage walker serving nearby houses

#### Scenario: Venue idle without performer

- **WHEN** a venue has workers and road but no compatible performer
- **THEN** it does not send coverage

### Requirement: Entertainment coverage scoring

Each house SHALL accumulate entertainment points by type. Merely building a
venue SHALL not suffice; it must function, receive performers, send coverage,
and have capacity. Ten identical buildings SHALL NOT fully replace cultural
variety; variety across types SHALL matter for higher tiers.

#### Scenario: Points require functioning venue

- **WHEN** a venue is built but not staffed or without performers
- **THEN** nearby houses gain no entertainment points from it

#### Scenario: Variety valued over repetition

- **WHEN** housing requires high entertainment
- **THEN** variety across entertainment types raises the score more than repeated identical venues

### Requirement: Festivals

Festival types SHALL be small, medium, large, and provincial. They SHALL cost
money, optional wine, preparation, and optionally workers. Effects SHALL
include mood, religion, culture, local trade, temporary productivity, and
temporary desirability. The festival screen SHALL show last held, honored
deity, cost, duration, expected bonus, and preparation time.

#### Scenario: Festival raises mood and culture

- **WHEN** a festival completes
- **THEN** city mood, religion, culture, local trade, productivity, and desirability receive their temporary bonuses

#### Scenario: Festival honors a deity

- **WHEN** a festival is held for a chosen deity
- **THEN** that deity's favor is affected and the honored deity is recorded
