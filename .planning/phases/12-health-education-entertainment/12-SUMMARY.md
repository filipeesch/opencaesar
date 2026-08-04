# Phase 12 Summary — Health, Education & Entertainment

**Status: Complete** · 2026-08-04 · Requirements HEAL-01, EDUC-01, ENTR-01

## Goal
Deliver the health/education/entertainment civic chain: service buildings actually influence houses (health/literacy/entertainment stats), walker-delivered access flags have a real lifetime, the top housing tiers require civic services, and the new entertainment venues (hospital, amphitheatre, colosseum) are placeable and functional.

## What was delivered
1. **Civic stats per house** — `house.civic = { health, literacy, entertainment }` (0..100), internal-only. Rise +1/tick while the matching service access is fresh, decay −0.5/tick otherwise (`civicRisePerTick`/`civicDecayPerTick` in balance).
2. **Live service access** — the legacy `house.services` cooldown map now decays (−1/tick, removed at 0): walkers grant ~120-tick access windows, permanently-fresh flags are impossible.
3. **Tier gates** — `TIER_CIVIC_GATES {3: health, 4: literacy, 5: entertainment}` (tier indices): Domus requires fresh health, Villa requires fresh literacy. Unmet gates pin evolution; legacy tiers (Shack/Hovel/Insula) need no services, so every pre-Phase-12 scenario is behaviorally unchanged (golden snapshots verified identical).
4. **Advisor coverage from real data** — `derivedSnapshot` uses live `civicCoverage()` instead of hardcoded 0.8 stubs (also fixing a `clinic || 'fire_station'` typo).
5. **Venue catalog** — hospital (2×2/300/10), amphitheatre (4×4/900/20), colosseum (5×5/4000/60) with colors, art, and `SERVICE_BY_WALKER` mappings; each spawns its own service walker when staffed.
6. **`getCivicStats()`** — deterministic accessor for UI/advisor reads.

## Notable decisions
- **Gate placement at index 3+** (not Insula): gating Insula broke the legacy food-chain evolution (the golden city reaches Insula without services). Reverted after the full-suite caught it — legacy behavior is a hard constraint.
- **Tier-3 live demo requires solvency**: the −100 wage-arrears desirability penalty pins evolution in deficit cities; the demo city runs policy (0.10, 0.135) and stays solvent.
- **Road connectivity is the hidden driver**: amphitheatre/hospital walkers only serve houses on road-reachable bands (connectors at x=20, wells at y=8, venues adjacent to y=9 row).

## Verification
- New tests: `tests/unit/civic-services.test.ts` (6), `tests/integration/health-education-entertainment.test.ts` (13), `tests/determinism/civic-determinism.test.ts` (5); advisor-coverage test in `buildings-catalog.test.ts` now asserts real sim data.
- Full suite **687 passed / 98 files** (up from 663/95). Typecheck, eslint (0 warnings), `check:military`, and golden snapshots all green.
- Determinism: `getStateJson()` and `getCivicStats()` byte-identical across chunk sizes 1/7/50 for seeds 1/7/1337; no `Math.random`/`Date.now` in the civic chain.
