# Phase 12 Wave 3 Summary — Accessor, Integration Tests, Determinism

**Status: Complete** · 2026-08-04 · HEAL-01 / EDUC-01 / ENTR-01

## What was built
- `src/sim/runner.ts` — `getCivicStats()` accessor: `{ coverage: { health, literacy, entertainment }, houses: [{ id, health, literacy, entertainment }] }` — the read path for UI/advisors over per-house civic state.

## Integration scenario (empirically tuned)
- A 24×24 all-fertile civic city: road rows y=0/3/5/7/9 with plaza road types on y=3/5/7, spine x=7, farm/granary/market, wells (0,6)/(14,6)/(16,8), 12 houses (4 at y=4, 8 at y=8), subsidy-funded clinic (6,6) + school (10,10), policy (0.10, 0.135).
- Findings that shaped the tests:
  - Desirability math: dirt roads contribute 0, plazas +4 each, fertile +40, food/water/labor +15 each, policy spread ×200 — a tier-3 (Domus, threshold 100) house needs ~110; only the fertile+plaza rows reach it.
  - **Solvency matters**: the desirability penalty for wage arrears is −100, so a wage-heavy policy (0.05/0.135) drains the treasury and pins evolution. (0.10, 0.135) is solvent (~1500+ by t=500).
  - **Water banding**: wells on the y=6 row never serve y=8 houses; a well at (16,8) does — without it the y=8 houses can't sustain evolution.
  - Evolution window is 60 ticks (`evolveWindowTicks`), devolve window 240 — reachable tiers are stable once sustained.

## Verification
- New `tests/integration/health-education-entertainment.test.ts` (13 tests):
  - clinic city health avg ≥ 40; no-clinic city all-health 0; no-venues city all civics 0
  - literacy ≥ 40 with school; entertainment ≥ 10 with theatre
  - live gate demo: clinic+school reach tier 3; school-only caps at tier 2 (health gate); clinic alone unlocks tier 3
  - hospital (avg health ≥ 40, staffed), amphitheatre (avg entertainment ≥ 10), colosseum (needs 4000 treasury), `getCivicStats()` shape
- New `tests/determinism/civic-determinism.test.ts` (5 tests): chunked (1/7/50) byte-identical `getStateJson()` and `getCivicStats()`, same-seed rerun, seeds 1/7/1337 runnable with civic walkers present, no-RNG/clock audit of housing/walkers/walkerProfiles.
- All probe files (`tests/_scan-civic*.test.ts`, `tests/_probe-*.test.ts`) deleted.
- Full suite: **687 passed / 98 files** (was 663/95 → +24/+3). Typecheck, lint, check:military, goldens all green.
