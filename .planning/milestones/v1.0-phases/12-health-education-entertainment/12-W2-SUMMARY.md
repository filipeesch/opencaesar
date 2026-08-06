# Phase 12 Wave 2 Summary — Entertainment Venue Catalog

**Status: Complete** · 2026-08-04 · ENTR-01

## What was built
- `src/sim/types.ts` — `BuildingType` extended with `'hospital' | 'amphitheatre' | 'colosseum'`.
- `src/sim/buildings.ts` — three new entries:
  - `hospital` — 2×2, cost 300, workers 10, category `health`
  - `amphitheatre` — 4×4, cost 900, workers 20, category `entertainment`
  - `colosseum` — 5×5, cost 4000, workers 60, category `entertainment`
  - all use `spawnEveryTicks: CONFIG.marketSpawnEveryTicks` (like clinic/school/theatre) so they spawn their own service walkers when staffed.
- `src/sim/walkers.ts` — `SERVICE_BY_WALKER`: `hospital → health`, `amphitheatre → entertainment`, `colosseum → entertainment`.
- `src/game/palette.ts` — `BUILDING_COLORS` += hospital `0xd94f4f`, amphitheatre `0xb06ad1`, colosseum `0x9a4fd1`.
- `src/game/buildingArt.ts` — `RISE` += hospital 18, amphitheatre 22, colosseum 30.

## Empirical findings (probe-driven)
- **Road access is mandatory**: 4×4 venues need a 3-row free band and a connector between road rows — a first amphitheatre attempt sat on a road-isolated row (labor walkers never reached it → `active: false` → zero walkers → zero entertainment). Fixed with spine connectors `(20,10),(20,11)`.
- **Hospital needs a 15-worker pool** (10 staff + food chain) — 12-house cities leave it understaffed and inactive; 15 houses staff it fully.
- **Colosseum is a prestige purchase**: 4000 denarii exceeds a first-year budget (1000 + 500 subsidy + 2000 loan max = 3500) — needs two loans (`loanMaxAmount` is a per-call limit).

## Verification
- Covered by `tests/integration/health-education-entertainment.test.ts` (13 tests): staffed hospital delivers health (avg ≥ 40), staffed amphitheatre delivers entertainment (avg ≥ 10), colosseum refuses placement below 4000 and succeeds after two loans, BUILDINGS catalog entries defined.
