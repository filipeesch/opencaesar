## 1. Balance spike

- [x] 1.1 Build a spike harness (script or throwaway vitest) that runs the canonical full-chain scenario across candidate configs and reports treasury, assigned workers, and house tiers over 3000 ticks
- [x] 1.2 Sweep labor cadence (`laborSpawnEveryTicks`, `serviceCooldownTicks`, `walkerLifetimeTicks`) and wage/tax curve (`wagePerWorkerPerTick`, `taxPerTick`, `startingTreasury`)
- [x] 1.3 Choose the winning config satisfying: treasury stays positive at tick 3000, ≥80% workers assigned at tick 3000, houses hold/grow tier over the run
- [x] 1.4 Apply the chosen constants to `src/sim/config.ts`

## 2. Per-house happiness

- [x] 2.1 Add `happiness` to the house snapshot type in `src/sim/types.ts`
- [x] 2.2 Implement `happinessOf(...)` in a new `src/sim/happiness.ts` (weighted blend of food/water/labor coverage, desirability, wages-paid; 0..100)
- [x] 2.3 Wire per-house happiness into `toBuildingState` (runner.ts)
- [x] 2.4 Add unit tests: well-served house high happiness, deprived house low, recomputes on coverage change

## 3. City Happiness rating

- [x] 3.1 Add `happiness: number` to `Ratings` in `src/sim/types.ts`
- [x] 3.2 Compute population-weighted city happiness in `computeRatings` (economy.ts)
- [x] 3.3 Add unit tests: rating rises with served houses, falls with hardship
- [x] 3.4 Add `Happiness` stat to HUD (`stat-happiness`)

## 4. Labor persistence rebalance

- [x] 4.1 Adjust labor connection decay/renewal per the spike — spike showed labor already staffs all buildings, so cadence was left unchanged (see design D1)
- [x] 4.2 Add a unit test: a connected building stays staffed and never loses its labor connection on a fixed cooldown or walker despawn
- [x] 4.3 Add a solvency regression test: full-chain scenario at default policy keeps treasury positive and workers assigned over 3000 ticks

## 5. Verification

- [x] 5.1 Regenerate golden files (`npm run test:golden:update`) for changed economy numbers
- [x] 5.2 Run full gate: `npm run typecheck`, `npm run lint`, `npm test`, `npx playwright test`
- [x] 5.3 Extend the e2e full-chain test to assert the Happiness rating moves with the economy
