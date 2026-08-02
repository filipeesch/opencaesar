## Why

Players have no way to understand why a building behaves the way it does: a house that won't grow, a farm sitting idle, a granary at capacity all look identical on the map. The sim already tracks the data that explains these states, but nothing exposes it to the player. Clicking a building and seeing its current condition turns the game from opaque simulation into a readable city.

## What Changes

- Clicking a building on the map opens a **building detail popup** showing per-building data (different fields per type).
- The popup shows, per building type:
  - **House**: tier + name, population capacity, food/water/labor service status, desirability, and happiness (happiness arrives with the `economy-happiness` change; popup renders it once present).
  - **Farm**: wheat stock, workers assigned/required, active state.
  - **Granary**: wheat stock/capacity, workers, active state.
  - **Market / Well**: workers, active state.
  - **Road**: no popup (nothing to show).
- `SimState` buildings gain a **desirability** field (currently computed inside `tickHousing` and never exposed), so the popup can display it.
- Clicking empty terrain, clicking another building, pressing ESC, or clicking a dismiss control closes the popup.
- The popup is a pure view: it reads sim state and never mutates it.

## Capabilities

### New Capabilities
- `building-inspection`: click-to-inspect detail popup with per-building data, driven by sim state.

### Modified Capabilities
- `sim-core`: building state exposes desirability per house (new field on the house snapshot).

## Impact

- `src/sim/runner.ts` — `toBuildingState` adds `desirability` to the house snapshot.
- `src/sim/housing.ts` — desirability computation needs to be callable for a single house (reuse `desirabilityOf`).
- `src/game/scenes/MainScene.ts` — pointer handling: detect building under click, emit inspection event, manage popup lifecycle.
- `src/game/scenes/HUDScene.ts` — DOM popup panel rendering per-building fields.
- `src/sim/types.ts` — house state type gains `desirability`.
- Tests: sim unit test for desirability exposure; e2e test for open/close popup and per-building fields.
