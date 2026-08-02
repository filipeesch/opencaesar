## MODIFIED Requirements

### Requirement: Labor pool

#### Scenario: Connected building stays staffed

- **WHEN** a building has received a labor walker and is labor-connected
- **THEN** it remains labor-connected and keeps its workers assigned across ticks, rather than dropping the connection merely because a walker cooldown or the walker's lifetime expired

#### Scenario: Unconnected building needs a labor walker

- **WHEN** a worker-requiring building has not yet been reached by a labor walker
- **THEN** it stays disconnected and unstaffed until a labor walker reaches it

### Requirement: Economy — taxes and treasury

#### Scenario: Growing city stays solvent

- **WHEN** a city grows houses and employs workers at default policy rates
- **THEN** the treasury does not structurally bleed to zero from wages exceeding taxes

#### Scenario: Treasury recovers from temporary deficit

- **WHEN** the treasury hits zero and wages go unpaid briefly
- **THEN** the city can recover as taxes resume and the unpaid-wage penalty clears

### Requirement: Ratings — population and prosperity

#### Scenario: Ratings include happiness

- **WHEN** the sim computes ratings
- **THEN** the ratings include a Happiness value alongside Population and Prosperity
