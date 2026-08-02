## Why

The economy stalls instead of growing. A test-driven trace showed prosperity peaking then decaying (tick 101 → 35, treasury 539; tick 601 → 28, treasury 2, only 2/16 workers assigned) — buildings oscillate between staffed and unstaffed because labor connections expire faster than they renew, and wages structurally outrun taxes so the treasury bleeds to zero. Players also have no human-facing signal about citizen well-being beyond a single prosperity number.

## What Changes

- **Fix the labor churn**: labor connections currently last `serviceCooldownTicks` (120) and are renewed by walkers that spawn only every `laborSpawnEveryTicks` (60) per house, so most buildings are unstaffed most of the time. Rebalance the cadence so staffed buildings stay connected while their labor walker is actively roaming, and connections renew reliably.
- **Fix the wage/tax deficit**: at default 10%/10%, wages (`2 denarii/worker/tick` × pool) structurally outrun house taxes (1..11 denarii/house/tick), draining the treasury to zero and triggering the unpaid-wages desirability penalty. Rebalance `wagePerWorkerPerTick`, per-tier taxes, and/or starting treasury so a growing city remains solvent and recovers from temporary deficits.
- **Add per-house Happiness (0–100)**: a satisfaction score per house from food, water, labor coverage, desirability, and wage payment. Exposed in `SimState`.
- **Add a city Happiness rating**: a third rating beside Population and Prosperity, shown in the HUD.
- **Expose happiness in the building popup** (consumed by the `building-inspection` change).

## Capabilities

### New Capabilities
- `happiness`: per-house happiness score and city Happiness rating, derived from coverage, desirability, and wage payment.

### Modified Capabilities
- `sim-core`: economy balance (labor connection cadence, wage/tax curve) and ratings shape (Happiness added to `Ratings`).

## Impact

- `src/sim/config.ts` — rebalanced constants (labor cadence, wage, tax tiers, starting treasury) after a parameter spike.
- `src/sim/economy.ts` — ratings computation adds Happiness; possible wage/tax helpers change.
- `src/sim/housing.ts` — per-house happiness computation; labor-connection persistence semantics.
- `src/sim/runner.ts` — labor tick wiring, happiness in `SimState`.
- `src/sim/walkers.ts` — labor walker connection renewal behavior.
- `src/game/scenes/HUDScene.ts` — Happiness rating stat.
- `src/sim/types.ts` — `Ratings.happiness`, `BuildingState.house.happiness`.
- Tests: balance spike harness (parameter sweeps), unit tests for labor persistence + happiness, updated golden files (economy numbers change).
