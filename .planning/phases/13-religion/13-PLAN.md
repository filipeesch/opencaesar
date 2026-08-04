# Phase 13 Plan — Religion (RELI-01)

## Goal
Temples for the 5 gods + grand temples + coverage-driven favor + festivals, live and deterministic.

## Wave 1 — Per-god temples & live godWorship
**Goal**: every temple has a god; walkers deliver per-god access; worship/favor derive from real coverage.

### Tasks
1. `src/sim/types.ts` — `BuildingType += 'grand_temple'`; `SaveCommand.place` gains optional `god?: string`; add `Command += { kind: 'holdFestival'; tierId: string }`; `SaveCommand += { kind: 'holdFestival'; tierId: string }`.
2. `src/sim/walkers.ts` — `BuildingInstance.god?: string`; `WalkerInstance.god?: string`; `house.godAccess: Record<string, number>`; SERVICE_BY_WALKER unchanged for temple; `serviceHousesAround` gains a god-aware path: temple/grand_temple walkers set `house.godAccess[god] = profile.serviceTTL` (not the generic `services.religion` — worship must stay per-god).
3. `src/sim/housing.ts` — `tickCivic` also decays `house.godAccess` (−1/tick, delete at ≤ 0).
4. `data/religion.ts` — new catalog: `TEMPLE_COVERAGE_FACTOR = 1`, `GRAND_TEMPLE_COVERAGE_FACTOR = 2`, `FESTIVAL_BOOST_WINDOW_TICKS = 480`, `MONTH_TICKS = 40`.
5. `src/sim/runner.ts`:
   - `placeBuilding(type, x, y, options?: { god?: string })`: when type is `temple`/`grand_temple`, require `god` ∈ GODS (error `invalid-god`); store `building.god`; save-command `{ kind: 'place', type, x, y, god }`. Non-religious types ignore the option.
   - `tickSpawns`: temple/grand_temple walkers carry `god: b.god`.
   - `godCoverage(god)` — fraction of houses with `godAccess[god] > 0`; `worshipOf(god) = min(1, godCoverage × factor)` (factor per temple type, `GRAND_TEMPLE_COVERAGE_FACTOR` applied in W2).
   - `derivedSnapshot`: replace the `{ jupiter: 0.8 }` stub with live `godWorship` (only gods with temples); religion = existing /5 aggregate; `favor = min(100, targets.favor + computeFavor(godWorship) + festivalFavorBoost(0 in W1))`.
   - `toBuildingState` += `god` (when set) and `house.godAccess` (when present); `toWalkerState` += `god`.
6. `tests/unit/religion.test.ts` — godAccess decay/expiry; coverage fraction math; worship clamp; favor aggregation (no favor without temples — computeTargets baseline preserved).
7. `tests/integration/religion.test.ts` — city with a Ceres temple: `house.godAccess.ceres` appears, `getDerived().services.godWorship.ceres > 0`, aggregate religion > 0, favor > no-temple control; no-temple control: empty godWorship, favor == baseline.

## Wave 2 — Grand temples
**Goal**: grand temples as the premium religious building.
### Tasks
1. `src/sim/buildings.ts` — `grand_temple`: 4×4, cost 900, workers 10, category religion, `spawnEveryTicks: CONFIG.marketSpawnEveryTicks`.
2. `src/sim/runner.ts` — `worshipOf` applies `GRAND_TEMPLE_COVERAGE_FACTOR` for grand-temple-served houses.
3. `src/game/palette.ts` — `grand_temple` 0x8a5a2b; `src/game/buildingArt.ts` — RISE += grand_temple 22.
4. `tests/integration/buildings-catalog.test.ts` — ALL_TYPES += `grand_temple`; SPOTS entry; the religion coverage test gains a grand-temple city variant (higher worship than temple-only city).
5. Integration test: grand-temple city worship > temple city worship (factor 2 demonstrated).

## Wave 3 — Festivals
**Goal**: festivals spend denarii and deliver time-boxed worship/favor boosts.
### Tasks
1. `src/sim/runner.ts`:
   - `holdFestival(tierId)`: validate tier exists; treasury ≥ cost (error `not-enough-money`); no festival plan/boost active (error `festival-in-progress`); spend cost (`festival` expense); `plan = startFestival(tierId)`.
   - Month cadence hook (existing `tickCount % 40 === 0` style): advance `plan` via `tickFestival`; on ready → `boost = { tier, remaining: FESTIVAL_BOOST_WINDOW_TICKS }`; decrement boost monthly; clear at 0.
   - `derivedSnapshot`: while boost active — every god's worship `+worshipBoost` (clamped 1), favor `+favorBoost`; gate `festivalFavorBoost(0)` in W1 becomes live.
   - `applyCommand` exhaustive dispatch for `holdFestival` (typecheck-enforced).
2. `tests/unit/religion.test.ts` — holdFestival validation (bad tier, no funds, in-progress), prep advance on month ticks, boost window expiry, expense category `festival`.
3. `tests/determinism/religion-determinism.test.ts` — temple + festival city, chunks 1/7/50 byte-identical `getStateJson()` (seeds 1/7/1337); same-seed rerun; no-RNG/clock audit of `religion.ts`, `services.ts`, `walkers.ts`, `housing.ts`.

## Verification loop (after each wave)
- `npm run typecheck && npx vitest run` (full suite green)
- `npm run lint` (0 warnings), `npm run check:military`
- Golden fixtures unchanged (`git diff --stat tests/golden` empty)
- Final wave: delete probe files, full suite + docs + commits (`feat(13)`, docs(13)), ROADMAP/STATE update, push.
