# Phase 12 Wave 1 Summary — Civic Wellness Core

**Status: Complete** · 2026-08-04 · HEAL-01 / EDUC-01 / ENTR-01

## What was built
- `src/sim/walkers.ts` — `HouseInstance.civic?: HouseCivicState` (`{ health, literacy, entertainment }`, 0..100). Internal-only state, never serialized (matches the Phase 11 safety pattern).
- `src/sim/housing.ts` — `tickCivic()`: the legacy `house.services` walker-delivered cooldown map now actually **decays** (−1/tick, entries removed at ≤ 0); civics rise while the matching service is fresh (`CONFIG.civicRisePerTick`), decay otherwise (`CONFIG.civicDecayPerTick`), clamped to [0, 100]. Wired into `tickHousing` (called per house per tick).
- `src/sim/housing.ts` — `civicGateSatisfied()`: a house evolving into a gated tier index must have fresh service access (`TIER_CIVIC_GATES` from `data/housing.ts`). Unmet gate pins `evolveCounter` at 0 instead of incrementing.
- `data/housing.ts` — `TIER_CIVIC_GATES`: `{ 3: ['health'], 4: ['literacy'], 5: ['entertainment'] }` — Domus needs health, Villa needs literacy, entertainment mirrors the 21-level model's top requirement (unreachable in the 5-tier live model).
- `data/balance.ts` — `civicRisePerTick: 1`, `civicDecayPerTick: 0.5`.
- `src/sim/runner.ts` — `derivedSnapshot` now computes advisor coverage from live data via a private `civicCoverage(service)` helper (fraction of houses with a fresh flag), replacing the hardcoded 0.8 stubs — which also fixed a latent `clinic || 'fire_station'` copy-paste bug in the old stub.

## Key decisions
- **Gate keys are tier *indices*** (target of the evolve): the check runs `gate[house.tier + 1]`, so key 3 gates entry into Domus. A first pass mapped gates onto Insula (index 2) — that broke the legacy food-chain golden (houses reach Insula without any services). Reverted to index 3+; legacy tiers need no services, preserving all pre-Phase-12 behavior.
- `tickCivic` is a no-op for houses with no service flags, so legacy scenarios are behaviorally unchanged (the services map simply stays empty).

## Verification
- New `tests/unit/civic-services.test.ts` (6 tests): cooldown-map decay + expiry, rise/decay/clamp, gate mapping data, Domus/Villa gate evolve-vs-control unit cases.
- Advisor coverage test in `tests/integration/buildings-catalog.test.ts` rewritten to assert real sim-derived coverage (8 houses + clinic/school/temple/theatre, all four services > 0 and ≤ 1).
- Full suite green, typecheck/lint/military clean, goldens green (no regeneration needed).
