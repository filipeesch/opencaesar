# Campaign, Tutorial, and Codex Specification

## Purpose

The campaign capability provides an original 10-mission campaign that
introduces systems gradually, a contextual tutorial that observes the real
game state to explain actual causes, and an in-game codex encyclopedia.

## Requirements
### Requirement: Campaign missions

The campaign SHALL provide original missions without war, introducing systems
gradually: (1) riverside foundations (road, housing, well, immigration, jobs);
(2) provincial granary (farming, granary, market, distribution); (3) clay and
fire (clay, pottery, storage, housing evolution); (4) trade roads (land route,
export, import, quotas); (5) water for all (reservoir, aqueduct, fountain,
bath, health); (6) city of scholars (school, library, academy, culture); (7)
favors of the gods (temples, festivals, favor); (8) southern port (navigation,
wharf, sea trade, logistics congestion); (9) city of patricians (desirability,
villas, palaces, luxury goods, advanced taxation); (10) provincial capital
(dominion over all systems). Each mission SHALL define its map, objectives,
products, routes, and modifiers.

#### Scenario: Mission defines its scope

- **WHEN** a campaign mission is selected
- **THEN** its map, objectives, introduced systems, products, routes, and modifiers are loaded

#### Scenario: Gradual introduction

- **WHEN** missions advance
- **THEN** later missions assume and build on systems introduced earlier

### Requirement: Contextual tutorial

The tutorial SHALL observe the actual state and explain real causes. If the
player built houses but no immigrants arrive, it SHALL check road to entry,
vacancies, and attractiveness, then explain the real cause. Tutorials SHALL
have visual highlight, short text, expanded explanation, a "show where" button,
a "don't show again" button, and a related codex entry, and SHALL NOT force a
rigid sequence after the introduction.

#### Scenario: Tutorial explains real cause

- **WHEN** the player has houses but no immigrants and the road-to-entry/vacancy/attractiveness check runs
- **THEN** the tutorial explains the actual blocking cause

#### Scenario: Tutorial actionable

- **WHEN** a tutorial step is shown
- **THEN** it provides short text, expanded explanation, a show-where button, and a don't-show-again option

### Requirement: Codex

The game SHALL provide an in-game encyclopedia with entries for buildings,
products, chains, services, housing, walkers, desirability, trade, finance,
ratings, religion, risks, and shortcuts. Each entry SHALL contain description,
how it works, inputs, outputs, workers, cost, hints, requirements, and related
links.

#### Scenario: Codex entry complete

- **WHEN** a codex entry is opened
- **THEN** it shows description, operation, inputs/outputs, workers, cost, hints, requirements, and related links
