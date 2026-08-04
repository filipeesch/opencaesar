---
phase: 12-health-education-entertainment
status: in-progress
---

# Phase 12 Context: Health, Education, Entertainment

## Goal

HEAL-01: health services (doctors, clinics, hospitals) raising house health via
walkers. EDUC-01: education (schools, libraries) raising literacy via walkers.
ENTR-01: entertainment venues (theatre, amphitheatre, colosseum) with
show-based coverage advancing housing.

## Grey Areas (auto-accepted)

1. **State location**: house health/literacy/entertainment live in an internal
   `civic` object on `HouseInstance` (never serialized — the Phase 11 `safety`
   pattern), so goldens/SimState stay byte-identical. Observable via a new
   `getCivicStats()` accessor and via real advisor coverage.
2. **Mechanism**: the existing walker-delivered `house.services` flags are the
   access mechanism. Today they are dead state (never decayed, never read) —
   Phase 12 fixes the decay and consumes the flags. No new walker types are
   spawned (legacy building-named walkers from clinic/school/library/theatre/
   temple already exist and stay byte-identical).
3. **Health/literacy rates**: rise while the service flag is fresh (+1/tick),
   decay when stale (−0.5/tick), clamped 0..100. Empirically tuned in tests.
4. **"Show-based coverage"**: each entertainer walker visit refreshes the
   entertainment flag (a show); coverage % = fraction of houses with a fresh
   flag. No separate show-event state.
5. **Evolution gating**: data-driven `tierCivicGates` in `data/balance.ts`
   (`{3: ['health'], 4: ['literacy'], 5: ['entertainment']}`) — a house needs
   the gate service fresh to evolve past the tier, mirroring `HOUSING_LEVELS`
   service requirements. Access-based, so scenarios without civic buildings
   (goldens, food-chain) are behaviorally unchanged.
6. **Real advisor coverage**: replace the hardcoded 0.8 in
   `runner.derivedSnapshot` (including its `clinic || 'fire_station'` typo bug)
   with live per-house access fractions.
7. **New placeable buildings**: `hospital`, `amphitheatre`, `colosseum` added
   to the sim BUILDINGS catalog (they exist in `data/buildings.ts` but were not
   placeable) + palette/buildingArt entries; costs/footprints/workers match the
   data catalog.
8. **Determinism**: civic mechanics use only seeded state (no RNG, no clocks),
   matching the Phase 11 determinism contract.

## Constraints (inherited)

- Goldens byte-identical (no serialized additions); `SimState` frozen.
- Every new balance key consumed → parity test stays green.
- No military tokens; `npm run check:military` clean.
- All randomness seeded; `npm run test` green after each wave.
