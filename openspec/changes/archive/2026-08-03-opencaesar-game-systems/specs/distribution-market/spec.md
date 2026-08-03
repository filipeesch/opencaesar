# Market Distribution Specification

## Purpose

The distribution-market capability models how markets supply households: a
buyer walker fetches food from granaries and goods from warehouses, and a
seller walker distributes stock to houses it passes, renewing household
inventory. It covers internal market stock, supplier selection, distribution
priority, and per-market configuration.

## ADDED Requirements

### Requirement: Market staff

Each market SHALL have a buyer (destination walker) that looks up food in
granaries and goods in warehouses demanded by served houses, returns with
stock, and updates internal inventory; and a seller (wandering walker) that
travels neighborhoods, identifies demand, delivers food and goods, reduces
internal stock, renews household inventory, and returns when out of goods or
at its limit.

#### Scenario: Buyer stocks the market

- **WHEN** a market buyer finds demanded food in a granary or goods in a warehouse
- **THEN** it travels there, reserves and collects the load, and returns, raising the market's internal stock

#### Scenario: Seller delivers to houses

- **WHEN** a market seller passes a house that accepts items the seller carries
- **THEN** the house's inventory is renewed and the seller's stock decreases

#### Scenario: Empty seller returns

- **WHEN** a seller runs out of carried goods
- **THEN** it returns to the market

### Requirement: Internal market inventory

A market SHALL maintain a separate inventory: food per type, and pottery,
furniture, oil, and wine. The inspector SHALL show current amount, capacity,
recent consumption, houses served, most-requested product, current supplier,
buyer in transit, and seller in transit.

#### Scenario: Market inventory tracked per product

- **WHEN** a market is inspected
- **THEN** per-product current/capacity, served houses, recent consumption, and supplier are shown

### Requirement: Supplier selection

The buyer SHALL consult neighborhood demand, select the most urgent product,
find the nearest granary/warehouse that accepts withdrawal, reserve the load,
travel, collect, and return. The system SHALL avoid multiple buyers reserving
the same load.

#### Scenario: Buyer picks most urgent product

- **WHEN** a served house most urgently needs a specific food or good
- **THEN** the buyer prioritizes procuring that product

#### Scenario: Reservation prevents double-picking

- **WHEN** multiple buyers target the same storage
- **THEN** a load reserved by one buyer is not also reserved by another

### Requirement: Distribution priority

When passing a house, the seller SHALL check which products the house accepts,
check its own stock, deliver essential food first, then the good blocking
evolution, then top up reserves, and update telemetry.

#### Scenario: Essential food delivered first

- **WHEN** a seller passes a house short of essential food and other goods
- **THEN** essential food is delivered before other goods

#### Scenario: Evolution-blocking good prioritized

- **WHEN** a house is missing the good that blocks its evolution and the seller carries it
- **THEN** that good is delivered before completing other reserves

### Requirement: Market configuration

The system SHALL allow per-market: accept/refuse specific foods, accept/refuse
specific goods, purchase priority, target stock, maximum buyer radius, block
wine for plebeian districts, highlight the seller route, and select preferred
granary/warehouse.

#### Scenario: Market refuses a good

- **WHEN** a market is configured to refuse a specific good
- **THEN** the market does not procure or distribute that good

#### Scenario: Preferred supplier used

- **WHEN** a preferred granary is selected
- **THEN** the buyer prefers that granary when it holds the needed food
