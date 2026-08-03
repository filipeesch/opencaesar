# External Trade Specification

## Purpose

The trade capability handles commerce with outside cities through a regional
map: opening land and sea routes, land caravans and merchant ships visiting
the city, a commercial wharf, per-commodity trade orders, annual quotas,
prices, and the reservation rules that govern exports and imports.

## Requirements
### Requirement: Regional map

The system SHALL provide a Regional/Empire map screen showing the player's
city, trading cities, regional roads, sea routes, commodity icons, opening
cost, annual capacity, distance, estimated time, and route state. Each trading
city SHALL define: goodsBought, goodsSold, annualQuotaPerGood, landOrSea,
routeOpeningCost, merchantFrequency, priceModifiers, relationship, and events.

#### Scenario: Regional map lists cities

- **WHEN** the player opens the Regional map
- **THEN** it shows the player city and all trading cities with route, cost, and quota info

### Requirement: Route opening

To open a route the player SHALL select a city, view products, prices and
quotas, pay the opening cost, and confirm. An opened route SHALL not obligate
trade; the player still configures products.

#### Scenario: Open a route

- **WHEN** the player pays the opening cost and confirms a city
- **THEN** the route becomes active and the city appears in the trading view

#### Scenario: Opened route requires no trade

- **WHEN** a route is opened but no products are configured
- **THEN** no trade occurs on that route until configured

### Requirement: Land caravan

A caravan SHALL enter at the regional point, follow roads, visit the
Commercial Center or warehouses, buy exports, deliver imports, respect
capacity, and leave the map. Initial capacity SHALL be 8 loads. If no valid
road exists the caravan SHALL wait a limited period, show a message, leave
without trading, and the route SHALL remain open.

#### Scenario: Caravan trades land route

- **WHEN** a land caravan reaches the city over roads with configured exports/imports
- **THEN** it delivers imports, collects exports up to its capacity, and departs

#### Scenario: No road blocks caravan

- **WHEN** no valid road exists from the entry point
- **THEN** the caravan waits briefly, shows a message, and departs without trading

### Requirement: Merchant ship and commercial wharf

A merchant ship SHALL enter by river or sea, head to a wharf, not pass under
low bridges, wait for a berth, unload imports, request exports, have wharf
workers fetch loads from warehouses, and depart on completion or timeout.
Initial capacity SHALL be 16 loads. The wharf SHALL show current ship, queue,
capacity, workers, requested goods, received/pending loads, source warehouse,
sea route, wait time, and river obstructions.

#### Scenario: Ship loads and unloads at wharf

- **WHEN** a merchant ship reaches a wharf with a free berth
- **THEN** it unloads imports and wharf workers fetch requested export loads until departure

#### Scenario: Wharf reports pending loads

- **WHEN** requested export loads are not yet available at the wharf
- **THEN** the wharf reports pending loads and the ship waits until timeout or completion

### Requirement: Trade orders

For each commodity the player SHALL set one of: do not trade, export all,
export above a reserve, import up to a target, stockpile (forbid export and
distribution), or allow priority consumption (reserve for homes/workshops
before export).

#### Scenario: Export above reserve

- **WHEN** a commodity is set to export above 12 loads
- **THEN** only stock above 12 loads is offered for export

#### Scenario: Import up to target

- **WHEN** a commodity is set to import up to 16 loads
- **THEN** imports occur until 16 loads are stored, then stop

### Requirement: Annual quotas

Each route SHALL have annual per-commodity quotas. The UI SHALL display
consumed/limit (e.g., pottery exported 12/15). When a quota is reached the
system SHALL suspend transactions for that commodity, keep others, show the
next reset, and reset at the start of the year.

#### Scenario: Quota reached suspends trade

- **WHEN** a commodity reaches its annual quota
- **THEN** further transactions for that commodity are suspended until the yearly reset

#### Scenario: Quota display

- **WHEN** a route is active
- **THEN** consumed/annual quota is shown for each traded commodity

### Requirement: Prices

Each product SHALL have import and export prices, history, trend, price
difference, and available routes. Import SHALL cost more than exporting the
same product to prevent trivial arbitrage. Events SHALL be able to modify
prices temporarily.

#### Scenario: Import price exceeds export price

- **WHEN** a product is both imported and exported
- **THEN** its import price is higher than its export price

#### Scenario: Event changes prices

- **WHEN** a price event is active
- **THEN** relevant prices are temporarily modified and shown as such

### Requirement: Reserve and transaction rules

An export SHALL occur only when goods exist, are not reserved, the export
threshold is met, quota is available, the merchant has capacity, and the
warehouse is reachable. An import SHALL occur only when stock is below the
target, quota is available, the treasury has money, storage exists, and a
warehouse accepts the product.

#### Scenario: Export gating

- **WHEN** goods are reserved, below threshold, or quota is exhausted
- **THEN** no export occurs for that commodity

#### Scenario: Import gating

- **WHEN** stock is at or above target, quota is exhausted, the treasury cannot pay, or no warehouse accepts the product
- **THEN** no import occurs
