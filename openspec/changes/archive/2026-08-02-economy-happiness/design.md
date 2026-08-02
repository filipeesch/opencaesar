## Context

The economy was implemented and tested for correctness (determinism, invariants) but never tuned for **survival**. A trace exposed a death spiral: labor connections expire (`serviceCooldownTicks: 120`) faster than renewal walkers reach buildings, so farms/markets/wells sit unstaffed → no food → houses devolve → worker pool shrinks → worse churn. Meanwhile the wage bill (`wagePerWorkerPerTick: 2` × 10% policy) can outrun per-house taxes, draining the treasury to zero and stacking the unpaid-wages desirability penalty. Prosperity peaks then decays (35 → 28); employment collapses to 2/16.

## Goals / Non-Goals

**Goals:**
- A growing city stays solvent at default policy and keeps buildings staffed — no death spiral.
- Per-house Happiness (0–100) and a city Happiness rating, derived and exposed every tick.
- Balance proven by a parameter spike, not guesswork.

**Non-Goals:**
- New buildings, goods, or production chains.
- Per-worker pathfinding/perf work (A* is fine at 40×40).
- Culture/Peace-style ratings (only Happiness is added now).

## Decisions

### D1: Make labor connectivity durable to fix labor churn (not a cadence rebalance)
The original model dropped `laborConnected` when it decayed or when a labor walker despawned, which caused worker-requiring buildings to flicker out of staffing even with a large worker pool — the root cause of a city's food/market/well buildings sitting unstaffed. The fix makes connectivity **durable**: once a labor walker reaches a building it stays labor-connected (workers stay assigned) until the road network is severed (the sim never does this). `nearestBuildingNeedingLabor` therefore only targets buildings that are not yet connected. The pool still limits assignment each tick, and a building with no pool reaches it stays unstaffed. This is pinned by the labor unit tests and the regression suite. A cadence rebalance was considered and rejected: the low "assigned/total" ratio was a red herring (a small city has a labor surplus vs. few jobs); the real failure was the treasury crash, fixed in D3.

### D2: Prove the balance with a spike harness before locking numbers
Add a throwaway (then kept as a regression test) parameter sweep: run the canonical full-chain scenario across candidate configs and assert survivability — treasury stays positive, ≥ X% of workers assigned at tick N, houses hold tier over 3000 ticks. The sweep drives the chosen constants; the winning config becomes the regression's baseline. Alternative: tune by eye in the running game — rejected, non-reproducible.

### D3: Fix the wage/tax deficit by raising per-house taxes (the root cause)
The trace showed wages outrun taxes at the old tier values (`taxPerTick: [1,2,4,7,11]`), so the treasury bled to zero at default 10%/10% policy and prosperity decayed (28). The spike swept wage and tax curves: raising `taxPerTick` to `[5,7,9,11,13]` keeps the treasury healthy (1952 at tick 3000, wage 2) and prosperity at ~57 with no cadence change, and does not block evolution (houses still reach Insula/tier 2 on the default policy, since the wage−tax desirability spread is unaffected at equal rates). `wagePerWorkerPerTick` and `startingTreasury` are unchanged so the wage slider and starting capital retain their meaning.

### D4: Happiness = weighted blend of the signals a player can act on
Per house:
`happiness = 0..100` from food (0.25), water (0.20), labor (0.15), desirability-normalized (0.25), and wages-paid (0.15), summed with weights, clamped. Chosen so coverage dominates but policy (desirability, wages) meaningfully moves it — making happiness responsive to the player's levers. City rating = **population-weighted** average of house happiness, so empty slums don't dilute a happy core.

### D5: Happiness is derived, not stored
Compute in `computeRatings` (city) and in `toBuildingState` (per house) from the same cooldowns/desirability already in the snapshot — no new mutable instance state, no invalidation. Mirror of the desirability decision in `building-inspection` (D3).

### D6: Expose Happiness in HUD + popup
Add a `Happiness` stat to the HUD (`stat-happiness`) and include it in the house popup fields (consumed by `building-inspection`).

## Risks / Trade-offs

- [Rebalancing breaks golden files] → regenerate golden files intentionally; determinism contract unaffected (same seed+commands still deterministic).
- [Sweep finds "survivable" but unfun numbers] → assert a healthy revenue score / prosperity floor in the solvency regression, not just non-negative treasury.
- [Happiness weights arbitrary] → weights live in `CONFIG` and are tuned in the same spike; unit tests pin direction (well-served ↑, deprived ↓).
- [Cooldown rebalance overcompensates at small city sizes] → labor cadence was left unchanged per D1; only tax tiers moved, which is scale-invariant.

## Migration Plan

Constants + ratings shape change; no data migration. Rollback = revert config + economy/housing changes; happiness is additive and inert.

## Open Questions

- Should Happiness influence house evolution (beyond desirability)? Default: no — keep evolution logic untouched; happiness is informational this change.
