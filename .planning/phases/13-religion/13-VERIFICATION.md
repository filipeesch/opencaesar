---
phase: 13-religion
status: passed
method: automated
completed: "2026-08-04"
---

# Phase 13 Verification — Religion (RELI-01)

## Success criteria (from REQUIREMENTS.md) — evidence in the live sim

| # | Criterion | Evidence |
|---|---|---|
| SC1 | Temples for the 5 gods | `GODS` accepted in `placeBuilding` (unit test `every GOD is accepted`); a Ceres temple produces `house.godAccess.ceres > 0` and live `godWorship.ceres > 0` (integration); worship is per-god — a Ceres temple leaves Neptune at 0 (integration `worship is per-god`) |
| SC1 | Coverage raises the god's worship | Worship = served-house share × coverage factor, computed live from walker coverage (unit + integration `temple walkers deliver per-god worship`); five temples of five gods → favor 100 (integration) |
| SC1 | Grand temples boost coverage | `grand_temple` catalog entry placeable (catalog test); grand-temple city worship > temple-only city worship (integration `grand temples boost worship`) |
| SC1 | Festivals spend denarii to raise favor | `holdFestival` spends the tier cost as a `festival` expense immediately (unit `spends the tier cost immediately`, integration `costs denarii from the treasury`); prep on month cadence; +worship on every god and +favor while the 12-month boost window runs (integration `raises worship and favor, then fades`); one festival at a time (unit) |
| SC2 | Backward compatibility | No temples → empty `godWorship`, religion 0, favor exactly the baseline (integration `no temples`); golden fixtures byte-identical without regeneration; `getStateJson()` serializes god/godAccess only when present |

## Determinism (must-have)
- Chunked runs 1/7/50 byte-identical for seeds 1/7/1337 with temples, a grand temple, and a full festival lifecycle in the run (determinism suite).
- Same-seed rerun identical; save→load replay byte-identical including the temple god and festival command (the replay bug this suite caught is fixed).
- Source audit: no `Math.random()`/`Date.now()`/`new Date()` in `services.ts`, `walkers.ts`, `housing.ts`, `data/religion.ts`.

## Phase gates
- `npm run typecheck` ✓ · full `npx vitest run` 716 passed / 101 files ✓ · `npm run lint` 0 warnings ✓ · `npm run check:military` clean ✓ · `git diff --stat tests/golden` empty ✓

## Commits
- `101ff25` feat(13): per-god temples, grand temples, live worship and favor (W1/W2)
- `5e8f91c` feat(13): festivals spend denarii for worship/favor boosts (W3)

## Notes / out of scope
- The 21-level model's religion-gated housing arrives in Phase 16; the 5-tier live model deliberately has no religion gate (TIER_CIVIC_GATES untouched).
- Festival boost honors all five gods (a festival is city-wide), not a single god.
