---
phase: 12-health-education-entertainment
status: passed
method: automated
completed: "2026-08-04"
---

# Phase 12 Verification Report — Health, Education & Entertainment

**Phase: 12 · Status: PASSED** · 2026-08-04

## Validation criteria (from 12-VALIDATION.md) → evidence

| Criteria | Result | Evidence |
|---|---|---|
| SC1: Health services raise house health | ✅ | `health-education-entertainment.test.ts` — clinic city avg health ≥ 40 at t=500; no-clinic control: max health == 0 |
| SC1: Health decays without service | ✅ | unit `civic-services.test.ts` — rise +1 while fresh, decay −0.5 while stale; clamp [0,100] |
| SC1: Education raises literacy | ✅ | integration — school city avg literacy ≥ 40 at t=500 |
| SC1: Cooldown map decays (no permanent flags) | ✅ | unit — `services` entries drop to expired at TTL end; integration controls show flags are not sticky (civic stats fall without visits) |
| SC2: Entertainment venues placeable | ✅ | hospital, amphitheatre, colosseum all place in live sims; colosseum refuses below 4000 denarii (not-enough-money) and places after two loans |
| SC2: Show-based coverage | ✅ | amphitheatre staffed (20/20 workers) → `amphitheatre` walkers observed → avg entertainment ≥ 10; theatre city avg entertainment ≥ 10 |
| SC2: Entertainment advances housing (gate) | ✅ | `TIER_CIVIC_GATES` gates evolution: clinic+school city reaches tier 3; school-only city caps at tier 2; unit tests prove Domus (health) and Villa (literacy) gates evolve-vs-pin |

## Full-suite gates
- **687 tests passed / 98 files** (baseline 663/95 → +24/+3). ✓
- `npm run typecheck` (tsc --noEmit) — clean. ✓
- `npm run lint` (eslint --max-warnings 0) — clean. ✓
- `npm run check:military` — clean (no military tokens). ✓
- Golden snapshots — green; regeneration produced byte-identical fixtures (state projection excludes `house.civic`; gate placement at index 3+ keeps the legacy food-chain evolution intact). ✓

## Determinism
- `getStateJson()` byte-identical across chunk sizes 1/7/50 for seeds 1, 7, 1337 (460 ticks, active clinic/school/theatre walkers, decaying service flags, moving civics). ✓
- `getCivicStats()` chunk-independent. ✓
- Same-seed rerun identical; different seeds runnable with civic walkers present. ✓
- Source audit: no `Math.random()` / `Date.now()` / `new Date()` in `housing.ts`, `walkers.ts`, `walkerProfiles.ts`. ✓

## Risks / notes
- The entertainment gate (key 5) is unreachable in the 5-tier live model (evolution caps at Villa index 4); it mirrors the 21-level data model and is covered by the data-mapping unit test.
- Villa (index 4) itself needs desirability ≥ 150 (fertile 40 + 2 plazas 8 + services 45 + policy ≤ 100) — practically requires a very high wage policy; the live integration demo targets Domus (tier 3), which is robustly reachable.
