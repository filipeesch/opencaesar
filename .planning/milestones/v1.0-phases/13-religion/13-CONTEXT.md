# Phase 13 Context — Religion (RELI-01)

## Goal
Temples for the 5 gods, grand temples, coverage-driven favor, and festivals (spend denarii → favor/worship).

## What already exists (scaffolding from earlier phases)
- `src/sim/services.ts`: `GODS = ['jupiter','neptune','ceres','bacchus','mercury']`; `computeFavor(worship)` = 20 × worshipped-gods (clamped 100); `holdFestival` (pure, 1-god); `FESTIVAL_TIERS` (small/medium/large/provincial with cost, prepMonths, worshipBoost, favorBoost); `startFestival`/`tickFestival` (prep plan state machine).
- `src/sim/buildings.ts`: `temple` (3×3, cost 110, workers 1, category `religion`, spawns temple walkers).
- Walkers: temple walkers serve houses via `SERVICE_BY_WALKER.temple = 'religion'` → `house.services.religion` (generic flag).
- Finance: `festival` expense category exists in `FinCategory`.
- Advisor stub: `runner.ts:761` — `godWorship: this.buildings.some((b) => b.type === 'temple') ? { jupiter: 0.8 } : {}` — **hardcoded, not live**.

## Gaps to close
1. **Per-god identity**: temples have no god; walkers don't know their god; `godWorship` is a lie (always jupiter 0.8).
2. **Grand temples**: missing entirely (building, coverage factor).
3. **Live worship/favor**: `godWorship` must come from real per-god walker coverage; favor must include the worship contribution (currently `computeTargets` ignores religion beyond a +10 culture flag).
4. **Festivals are dead code**: `holdFestival`/`FESTIVAL_TIERS` exist but nothing calls them; no command, no treasury spend, no boost window, no determinism.

## Design decisions (live 5-tier sim)
- **Per-god access**: temple/grand_temple walkers carry `w.god`; a visit sets `house.godAccess[god] = serviceTTL` (a NEW per-god cooldown map on houses, decayed by `tickCivic` — same deterministic pattern as `services`). Coverage per god = fraction of houses with `godAccess[god] > 0`. This is the religion analog of Phase 12's civic coverage.
- **Worship**: `worshipOf(god) = min(1, godCoverage(god) × coverageFactor)` where temple = 1, grand_temple = 2 (data-driven). Houses near a grand temple count double toward the god's worship.
- **Aggregate religion coverage** keeps the existing `/5` formula over live godWorship.
- **Favor** (derived): `min(100, computeTargets(...).favor + computeFavor(godWorship) + festivalFavorBoost)`. No temples → identical to today (backwards compatible); each worshipped god adds up to +20.
- **Festivals**: `holdFestival(tierId)` command (replayable). Validates treasury ≥ cost; spends cost as `festival` expense; prep advance on the existing 40-tick month cadence (`tickFestival`); on ready, a boost window of `FESTIVAL_BOOST_WINDOW_TICKS` (480 = 1 year) during which every god's worship gets `+worshipBoost` (clamped 1) and favor gets `+favorBoost`. One festival at a time (a running plan/boost blocks a new one).
- **Gate-free**: religion does NOT gate housing tiers (TIER_CIVIC_GATES untouched — the 21-level model gates show/entertainment, not religion).
- **Additive & deterministic**: no `Math.random`/`Date.now`; new fields (`building.god`, `walker.god`, `house.godAccess`, festival plan/boost state) are deterministic; serialized only when present (golden fixtures untouched — the food city has no temples).

## Scope (3 waves)
- W1: per-god temples (god field on buildings/walkers/commands, `godAccess` + decay, live `godCoverage`/`godWorship`, favor wiring) + unit/integration tests.
- W2: grand temples (catalog entry, coverage factor 2, palette/art) + catalog test updates + integration coverage comparison.
- W3: festivals (command, prep pipeline on month cadence, boost window in derived, expense ledger) + determinism suite + full verification.

## Constraints (project-wide, verified each wave)
- Typecheck + full test suite green every wave; lint `--max-warnings 0`; `check:military` clean.
- Byte-identical `getStateJson()` across chunk sizes (determinism suite) with temples + festivals active.
- Goldens stay green WITHOUT regeneration (conditional serialization); verify no golden diff.
