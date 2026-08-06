# Phase 13 Summary — Religion (RELI-01)

## Delivered
- **Per-god temples**: temples and grand temples carry a god (`placeBuilding(type, x, y, { god })`, defaults to `jupiter`, validated against `GODS` — unknown gods are rejected with `invalid-god` with no expense). The god persists on the building and in the replayable `place` save-command, so saves round-trip exactly.
- **Per-god coverage**: temple walkers carry their god and set `house.godAccess[god]` on adjacent houses (a TTL map, same deterministic pattern as service flags); `tickCivic` decays it. Worship per god = share of houses with fresh access × coverage factor (temple 1, grand temple 2).
- **Live worship & favor**: the hardcoded `{ jupiter: 0.8 }` advisor stub is gone. `getDerived()` exposes per-god `godWorship` (empty without temples), aggregate religion coverage is the 5-god average of live worship, and favor = `targets.favor + 20 × worshipped gods` (clamped 100) — backward compatible: no temples → favor unchanged.
- **Grand temples**: catalog entry (4×4, 900 denarii, 10 workers, religion category), palette + art, coverage factor 2, spawned walkers carry the god.
- **Festivals**: `holdFestival(tierId)` replayable command (small/medium/large/provincial). Validates tier, funds, and one-at-a-time; spends the cost as a `festival` ledger expense; preps on the 40-tick month cadence; then a 12-month boost window raises every god's worship (+tier boost, clamped 1) and favor (+tier boost). `getFestival()` exposes prep/boost status.

## Fixes found by the new tests
- `applyCommand` dropped `cmd.god` on save/load replay (temples reloaded as jupiter) — the save→load determinism test caught it; god now replays exactly.

## Test delta
- New: `tests/unit/religion.test.ts` (godAccess decay, worship/favor aggregation, placement validation, festival lifecycle — 13 tests), `tests/integration/religion.test.ts` (coverage, isolation, grand-temple factor, festivals — 9 tests), `tests/determinism/religion-determinism.test.ts` (chunked 1/7/50 byte-identical with temples + grand temple + festival, save/load replay, RNG/clock audit — 5 tests).
- Updated: `tests/integration/buildings-catalog.test.ts` (grand_temple in ALL_TYPES/SPOTS).
- Full suite: **716 passed / 101 files** (was 703/100 at the phase start — +13/+1). Typecheck, lint (0 warnings), and `check:military` all green. Golden fixtures untouched (new state serialized only when present).
