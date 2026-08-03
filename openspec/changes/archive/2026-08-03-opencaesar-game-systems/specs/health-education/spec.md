# Health and Education Specification

## Purpose

The health-education capability covers health buildings (barber, clinic,
hospital, and public baths reused for health) and education buildings (school,
library, academy), their service walkers, and the distinction between global
capacity and local coverage.

## ADDED Requirements

### Requirement: Health buildings

The barber SHALL provide a basic hygiene service via a wandering walker for
intermediate houses. A clinic SHALL provide local care via a doctor walker,
reduce disease risk, and be required by intermediate houses. A hospital SHALL
have regional capacity, treat outbreaks, serve a large population, be required
by rich districts, and consume more workers.

#### Scenario: Barber serves hygiene

- **WHEN** a staffed barber is road-connected in a neighborhood
- **THEN** it sends a wandering walker providing hygiene service to houses passed

#### Scenario: Clinic reduces disease risk

- **WHEN** a staffed clinic sends a doctor who passes a house
- **THEN** the house's disease risk is reduced via health service

#### Scenario: Hospital treats outbreaks

- **WHEN** a staffed hospital is present with capacity
- **THEN** it contributes to treating outbreaks across its region

### Requirement: City health

City health SHALL be computed from food variety, clean water access, bath,
clinic, hospital, density, pollution, abstract sewage/hygiene, fatal
occurrences (non-graphic), and epidemic events. Health states SHALL be
excellent, good, fair, concerning, poor, and epidemic.

#### Scenario: Health state derived from factors

- **WHEN** the sim computes health
- **THEN** a state from excellent through epidemic is derived from the health factors

#### Scenario: Outbreak reduces workforce

- **WHEN** an outbreak is active
- **THEN** workers may decrease, mortality may increase, migration may reduce, and hospital demand rises

### Requirement: Education buildings

The school SHALL serve children via a teacher walker, have limited capacity,
a small nearby noise penalty, and be required by evolving houses. The library
SHALL serve adults and youth via a librarian, increase culture and
desirability, and serve a large population. The academy SHALL serve
higher-class teens, increase culture and prosperity, be required by advanced
villas, and have limited capacity and high cost.

#### Scenario: School serves children

- **WHEN** a staffed school sends a teacher who passes a house with school-age children
- **THEN** those children are counted as schooled

#### Scenario: Library raises culture

- **WHEN** a staffed library sends a librarian who reaches housing
- **THEN** culture and desirability from the library are applied

#### Scenario: Academy for advanced villas

- **WHEN** an academy is staffed and reaches higher-class teens
- **THEN** it contributes the academy requirement for advanced villas

### Requirement: Capacity vs. coverage

The system SHALL distinguish global capacity from local coverage. A city may
have enough seats yet a specific house still not receive the walker. The UI
SHALL show both metrics separately.

#### Scenario: Capacity without local coverage

- **WHEN** a school has global capacity but its walker does not reach a particular house
- **THEN** the house reports no local school coverage even though global capacity exists
