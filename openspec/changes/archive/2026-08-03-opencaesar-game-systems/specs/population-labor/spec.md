# Population and Labor Specification

## Purpose

The population-labor capability models population stored per residence (not as
thousands of individual agents), with age bands and social classes, migration
into and out of the city, homelessness, the urban labor force, labor access
via recruiter walkers, wages, and unemployment.

## ADDED Requirements

### Requirement: Per-residence population model

Population SHALL be stored per residence with: population, capacity, social
class, age distribution, employed/unemployed adults, children, elderly,
taxable income, food inventory, goods inventory, service access, desirability,
sentiment, crime risk, and health risk. Visual walkers SHALL be
representations of urban activity and SHALL NOT correspond one-to-one with
inhabitants.

#### Scenario: House stores aggregated population

- **WHEN** a populated house is inspected
- **THEN** it exposes an aggregated population count and age-band breakdown without individual agents

### Requirement: Age bands and workforce eligibility

The system SHALL track age bands: 0–5, 6–11, 12–15, 16–25, 26–40, 41–60, and
above 60. The 6–11 band SHALL require school; 12–15 SHALL require school or
academy per class; 16–60 SHALL be eligible for the workforce; patricians SHALL
NOT join the common workforce; children and the elderly SHALL NOT work.

#### Scenario: Adult plebeians join labor pool

- **WHEN** a plebeian house has residents aged 16–60
- **THEN** those adults are counted in the available labor pool

#### Scenario: Patricians excluded from labor

- **WHEN** a patrician house has working-age residents
- **THEN** those residents are not added to the common labor pool

### Requirement: Migration attractiveness

The system SHALL compute a migration attractiveness index from available
housing, wage comparison, food security, health, city mood, service quality,
employment availability, and prosperity, minus tax pressure, unemployment,
homelessness, disease, unrest, and repeated disasters. Immigration SHALL occur
when residential vacancies exist, attractiveness is positive, the city entry is
road-connected, there is no severe crisis, and immigration is not blocked.

#### Scenario: Attractive city attracts immigrants

- **WHEN** vacancies exist, attractiveness is positive, and the entry is road-connected
- **THEN** immigrant families arrive at the entry point and occupy vacant lots

#### Scenario: No vacancies blocks immigration

- **WHEN** there are no residential vacancies
- **THEN** no immigrants arrive

#### Scenario: Emigration on hardship

- **WHEN** houses devolve, taxes are excessive, wages are far below standard, food is lacking, or there is prolonged unemployment or disease
- **THEN** residents emigrate and families depart visibly at the exit point

### Requirement: Homelessness

When a house loses capacity, its residents SHALL look for another residence
with vacancy, prefer a similar-level home, accept lower homes if necessary,
and become homeless if none is found. Homelessness SHALL lower stability,
health, and attractiveness, and homeless people SHALL leave the city after a
configured period.

#### Scenario: Displaced residents relocate

- **WHEN** a house devolves and loses capacity
- **THEN** displaced residents first try to occupy vacancies in similar homes, then lower homes

#### Scenario: No vacancy creates homeless

- **WHEN** displaced residents find no vacancy
- **THEN** they become homeless and homelessness reduces stability and attractiveness

### Requirement: Labor force and sector priorities

The system SHALL compute the available labor force as plebeian adults aged
16–60 minus the temporarily incapacitated and the already employed. Patricians
SHALL not work. The Labor Advisor SHALL allow ordering sectors by drag and
drop, assigning priority 1–5, pinning minimum workers, pausing a sector,
restoring automatic priority, and previewing impact. When workers are scarce,
the system SHALL allocate first to higher-priority sectors.

#### Scenario: Scarce labor prioritized

- **WHEN** available workers are fewer than total required and sectors have different priorities
- **THEN** higher-priority sectors keep their workers and lower-priority sectors lose workers first

#### Scenario: Building efficiency scales with staffing

- **WHEN** `staffingRatio = workersAssigned / workersRequired`
- **THEN** production and activity scale continuously with the ratio, and 0% staffing is inactive

### Requirement: Wages and unemployment

The system SHALL allow adjusting the urban wage and SHALL compare it to a
reference imperial wage (much below / below / equal / above / much above).
The wage SHALL affect immigration attraction, mood, expenses, and worker
retention. The system SHALL report unemployment bands: 2–8% balanced, 9–14%
attention, 15–24% high, above 25% crisis, below 2% labor scarcity.

#### Scenario: Wage policy changes attraction

- **WHEN** the urban wage is raised relative to the imperial reference
- **THEN** migration attractiveness and worker retention rise, and expenses rise

#### Scenario: Unemployment reported by band

- **WHEN** unemployment crosses a band threshold
- **THEN** the labor reports reflect the corresponding band classification
