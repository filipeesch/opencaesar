# Phase 12 Plan: Health, Education, Entertainment (3 waves)

## Goal

HEAL-01/EDUC-01/ENTR-01: walker-delivered health/literacy/entertainment with
house stats, real advisor coverage, and service-gated housing evolution.

## Wave 1 — Health (HEAL-01)

Tasks:
1. **Civic state + cooldown decay fix** (`src/sim/housing.ts`, `src/sim/walkers.ts`):
   - `HouseInstance.civic?: { health: number; literacy: number; entertainment: number }` (internal, never serialized).
   - `tickCivic(house)`: decay `house.services` cooldown map (keys −1, delete at ≤ 0); health rises +`CONFIG.civicRisePerTick` while `services.health` fresh, decays −`CONFIG.civicDecayPerTick` otherwise; clamp [0,100]. Called from `tickHousing`.
2. **Health gate**: `CONFIG.tierCivicGates = { 3: ['health'], 4: ['literacy'], 5: ['entertainment'] }` consumed in `decideEvolution`-style gate inside `tickHousing`'s evolve branch (evolve to tier N requires each gate service of N fresh). Behavior-neutral where gates' services never arrive.
3. **Real derived coverage** (`src/sim/runner.ts` `derivedSnapshot`): replace hardcoded 0.8 inputs (and the `clinic || 'fire_station'` typo) with live access fractions: doctorCoverage = fraction of houses with fresh `services.health`, educationCoverage = `services.literacy`, entertainmentCoverage = `services.entertainment`.
4. Balance keys `civicRisePerTick: 1`, `civicDecayPerTick: 0.5`, `tierCivicGates` (all consumed → parity green).

## Wave 2 — Education & Entertainment (EDUC-01, ENTR-01)

Tasks:
1. **Literacy**: same civic mechanics for `services.literacy` (teacher/librarian walkers already serve it).
2. **Entertainment venues**: add `hospital` (health), `amphitheatre`, `colosseum` (entertainment) to `src/sim/buildings.ts` BUILDINGS with data-catalog values (hospital 2x2/300/10; amphitheatre 4x4/900/20; colosseum 5x5/4000/60) + `spawnEveryTicks: CONFIG.marketSpawnEveryTicks`.
3. **Walker service mapping** (`src/sim/walkers.ts` SERVICE_BY_WALKER): add `hospital → health`, `amphitheatre → entertainment`, `colosseum → entertainment`.
4. **Game layer**: palette + buildingArt entries for hospital/amphitheatre/colosseum (distinct hues/rise).

## Wave 3 — Observability & Verification

Tasks:
1. **Accessor** `getCivicStats()`: `{ coverage: {health, literacy, entertainment}, houses: [{id, health, literacy, entertainment}] }` — pure live projection (additive API).
2. **Tests**:
   - `tests/unit/civic-services.test.ts`: cooldown decay, health rise/decay clamp, gate logic (unit-level).
   - `tests/integration/health-education-entertainment.test.ts`: clinic city → house health ≥ 40 vs no-clinic control < 40; school → literacy; theatre/amphitheatre/colosseum placeable, coverage > 0, tier-gate: evolution to tier 4 requires literacy, tier 5 requires entertainment.
   - `tests/determinism/civic-determinism.test.ts`: chunks 1/7/50 byte-identical with clinic+school+theatre city; same-seed rerun; no-RNG/clock audit of housing.ts/walkers.ts/runner civic paths.
   - Advisor coverage test: derivedSnapshot.services reflects live access fractions (not hardcoded).
3. **Verification**: typecheck, lint, full suite (goldens green — no serialized additions), `check:military`.

## Success criteria (from ROADMAP)

- SC1: Health walkers raise house health (clinic city ≫ no-clinic control).
- SC1: Education walkers raise literacy.
- SC2: Entertainment venues deliver show-based coverage; housing evolution advances (tier gates demonstrable).
- Determinism, no-military, goldens byte-identical.
