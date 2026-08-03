# Finance Specification

## Purpose

The finance capability covers the city's money: revenues (taxes, exports,
rewards, donations, subsidies, positive events) and expenses (construction,
wages, imports, route opening, festivals, maintenance, interest, governor
salary, requests, emergency repairs, events), plus taxation, the treasury,
debt, and the governor's salary and personal account.

## ADDED Requirements

### Requirement: Revenue and expense tracking

The system SHALL track revenues: taxes, exports, administrative rewards,
governor donations, exceptional subsidies, and positive events; and expenses:
construction, wages, imports, route opening, festivals, optional maintenance,
interest, governor salary, requests, emergency repairs, and events.

#### Scenario: Revenues and expenses recorded

- **WHEN** any revenue or expense event occurs
- **THEN** it is recorded against the appropriate category for the current month and year

### Requirement: Taxation

Taxable income SHALL depend on residential level, each level having a tax
multiplier. A house SHALL pay only if occupied, recently visited by a tax
collector, registered, and not on an exemption. Tax collectors SHALL come from
the forum, senate, or optional tax office. The tax screen SHALL show rate,
registered population, coverage percentage, potential revenue, effective
revenue, loss from missing coverage, mood impact, and taxes by class and
district.

#### Scenario: Covered registered house pays tax

- **WHEN** an occupied, registered house is recently visited by a tax collector at a positive rate
- **THEN** it pays tax proportional to its level multiplier

#### Scenario: Uncovered house pays nothing

- **WHEN** a house is not recently visited by a collector
- **THEN** it contributes no tax and is counted toward coverage loss

### Requirement: Treasury and projection

The treasury SHALL always show balance, monthly change, annual projection,
debt, interest, minimum reserve, and alerts.

#### Scenario: Treasury reports its state

- **WHEN** the treasury updates monthly
- **THEN** balance, monthly change, annual projection, debt, interest, reserve, and alerts are available

### Requirement: Debt

When the balance goes negative the system SHALL apply interest, reduce
administrative favor, issue an alert, allow limited bailout, make new loans
progressively worse, and SHALL NOT end the game immediately. Persistent
deficit SHALL be able to cause defeat.

#### Scenario: Negative balance accrues debt

- **WHEN** the treasury balance goes negative
- **THEN** interest applies, favor reduces, an alert issues, and the game does not end immediately

#### Scenario: Persistent deficit can defeat

- **WHEN** a city remains in persistent deficit
- **THEN** defeat becomes possible per the configured rules

### Requirement: Governor salary and personal account

The player SHALL select a salary level (none, modest, standard, high,
extravagant) paid into an abstract personal account. The player SHALL be able
to donate personal money to the city, send gifts to the imperial
administration, and fund a festival. Gifts SHALL NOT be an unlimited way to
exploit favor.

#### Scenario: Salary paid to personal account

- **WHEN** the governor has a nonzero salary level
- **THEN** the salary is deducted from the treasury and credited to the personal account

#### Scenario: Personal donation to city

- **WHEN** the player donates personal money to the city
- **THEN** the treasury increases and the personal account decreases accordingly
