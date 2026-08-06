---
phase: 04-water-system
reviewed: 2026-08-03T13:46:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - src/sim/advisors.ts
  - src/sim/water.ts
  - tests/unit/advisors.test.ts
  - tests/unit/aqueduct-flow.test.ts
  - tests/unit/baths.test.ts
  - tests/unit/fountain.test.ts
  - tests/unit/reservoir.test.ts
  - tests/unit/water.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-08-03T13:46:00Z
**Depth:** deep (standard per-file + cross-module trace of water.ts ↔ advisors.ts ↔ test call-chains and type contracts)
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the Phase 4 "Water System" changes: the WATR-01 well desirability penalty and WATR-02 reservoir storage surface in `src/sim/water.ts`, the WATR-03 aqueduct flow-propagation tests, the WATR-04 fountain `supplied && staffed` gate, the WATR-05 bath wiring (`resolveBaths`/`assignBathEffects`), and the WATR-06 `waterOverlayData()` advisor projection plus their unit tests.

**Determinism:** confirmed — `src/sim/water.ts` and `src/sim/advisors.ts` contain no `Math.random`/`Date`/`Date.now`/`performance.now` (grep: no match); `computeFlow`'s stack-based reachability is order-independent (only set membership matters) and the WATR-03 tests lock repeat-call deep equality. No seeded-RNG change was needed.

**Radius/coverage vs `[y][x]` indexing:** consistent everywhere. `WaterSystem.compute`, `computeBathCoverage`, and `waterOverlayData` all use `grid[y][x]` with keys `y * 100000 + x` matching `AqueductSystem.key`. The one `[x][y]` vs `[y][x]` assertion bug from the 04-02 plan was correctly auto-fixed in `tests/unit/advisors.test.ts` (`aqueductPresent[2][3]`/`aqueductFlow[2][3]` for tile (3,2)) and the implementation needs no change. Manhattan `dist <= radius` is inclusive and matches test expectations (distance-2 covered, distance-4 off).

**Double-count / placement:** no active double-count exists in this phase — none of the new surfaces (`TileWater.desirability`, `assignBathEffects` wellness/desirability, `waterConsumed`) are wired into the live sim yet (per 04-03 decision 5, visual integration is Phase 18; the housing water cooldown path is untouched). However, three separate `desirability` and two `wellness` surfaces now share names with incompatible accumulation semantics and no defined merge — a latent double-count/sign-confusion risk at integration (WR-02).

**Pure projection:** `waterOverlayData` paints only from injected model state; no fabricated values found.

**Safety/military:** no new safety or military tokens introduced (only pre-existing "safety, trade" list in the `advisors.ts` header comment, unchanged). `npm run check:military` clean.

Not reviewed in depth (out of phase scope): the working tree also contains uncommitted building-asset/rendering changes (`src/game/art.ts`, `scenes/BootScene.ts`, `scenes/MainScene.ts`, deleted `public/assets/house.png`/`terrain.png`, `game-specs/`, `scripts/resize-buildings.mjs`) which appear to belong to an unrelated stream — none are listed in the 04-0X SUMMARY key-files. These were not reviewed; consider scoping them into their own phase.

## Warnings

### WR-01: `waterOverlayData` reservoir footprint paint has no bounds check

**File:** `src/sim/advisors.ts:117-125`
**Issue:** The reservoir-paint loop writes `reservoirFilled[y][x]` / `reservoirLevel[y][x]` for `y` in `[r.y, r.y + r.size)` and `x` in `[r.x, r.x + r.size)` with no clamping against `width`/`height`. A `ReservoirState` whose footprint overhangs the map edge (e.g. `x: 4, size: 3, width: 5`, or any `y + size > height`) either silently extends a row into a sparse/hole-ridden array (x-overhang) or throws `TypeError: Cannot set properties of undefined` when `y + size > height` (row index out of range, since `reservoirFilled[y]` is undefined). The risk exists because `computeReservoirStates`/`reservoirTouchesMapWater` quite reasonably accept arbitrary `ReservoirDef` positions and only the overlay paint indexes arrays. `computeReservoirStates` itself is safe (pure Set lookup), so this is confined to the advisor layer.
**Fix:**
```ts
for (let y = r.y; y < Math.min(r.y + r.size, height); y++) {
  for (let x = r.x; x < Math.min(r.x + r.size, width); x++) {
    reservoirFilled[y][x] = 1;
    reservoirLevel[y][x] = r.level;
  }
}
```

### WR-02: Coalesced `desirability`/`wellness` surfaces with conflicting accumulation semantics

**File:** `src/sim/water.ts:87-100`, `src/sim/water.ts:421-443`, `src/sim/advisors.ts:137`
**Issue:** This phase introduces three `desirability` values and two `wellness` values that will have to be merged by Phase 18, but their semantics are incompatible and no single test exercises a tile that carries all of them:
- `TileWater.desirability` (water.ts:32,95-96) — a signed delta, **accumulative** per overlapping source (well −4, fountain +4; two wells on a tile → −8).
- `assignBathEffects`/`computeBathCoverage.desirability` (water.ts:438) — **non-accumulative** (`Math.max(..., 4)` → two overlapping baths still yield 4), unsigned 0..4.
- `housing`/`happiness` desirability (`src/sim/housing.ts:18`, `Tile.desirability`) — an independent 0..200 rating.
- `WaterSystem.cell.wellness` (water.ts:107) — 0.5 per well, 1 per fountain, added; bath `wellness` grid (water.ts:437) — `Math.max(..., 1)`.

Because the well/fountain surface accumulates while the bath surface caps at 4, a tile covered by a bath, a fountain, and a well can be reported `+4 (bath)`, `+(4−4)=0 (water model)`, and `0.5+1` / `1` wellness — with no defined summation or precedence. If a Phase 18 wiring naively sums "bath desirability grid" and "water desirability grid" into sim desirability, the bonus/penalty double-counts or cancels inconsistently. Today nothing consumes them, so this is latent, but the naming collision plus asymmetric accumulation is a real bug trap.
**Fix:** Define and document a single per-tile desirability/wellness composition function (e.g. `composeTileDesirability(waterDelta, bathBonus)`) that fixes whether accumulation is additive or capped, add a combined-tile test, and rename at least one of the surfaces (e.g. `bathDesirability` vs `TileWater.desirability`) to avoid implicit merge.

### WR-03: Pre-existing flaky test interaction between military-absence and balance-parity tests

**File:** `tests/military-absence.test.ts:45-57`, `tests/balance-parity.test.ts:34,60-67`
**Issue:** Not caused by this phase, but surfaced during verification and affects `npm run test` reliability. `military-absence.test.ts` temporarily writes `src/__military_probe__.ts` (then `rmSync`s it in `finally`), while `balance-parity.test.ts`'s `sourceFiles()` enumerates `src/**/*.ts` and later `readFileSync`s each captured path. When the two files run concurrently under vitest, the probe path is captured in the probe's write window, then read after deletion → `ENOENT`. Observed: run 1 = 2 failed (`Tests 2 failed | 339 passed (341)`), run 2 (same tree, no changes) = 341/341 passed. Flaky.
**Fix:** Either run these two files non-concurrently (serial `--runInBand`-style sequencing), or have `balance-parity` snapshot the remaining probe path with an existence check (`[ -f ]` filter before `readFileSync`), or move the probe outside `src/` (e.g. a temp dir the scanners also cover via explicit path).

## Info

### IN-01: Magic numbers in `computeBathCoverage`

**File:** `src/sim/water.ts:437-438`
**Issue:** Hardcoded `1` (wellness) and `4` (desirability) inline; `4` numerically collides with `FOUNTAIN_DESIRABILITY_BONUS`/`WELL_DESIRABILITY_PENALTY` (and `ROAD_TYPES` plaza desirability `4`), inviting readers to assume they are the same constant when they are not.
**Fix:** Export `BATH_WELLNESS_BONUS = 1` and `BATH_DESIRABILITY_BONUS = 4` module consts and reference them.

### IN-02: Unreachable `grand` water class mapping

**File:** `src/sim/advisors.ts:92`, `src/sim/water.ts:13`
**Issue:** `WATER_CLASS_VALUE` maps `grand: 3`, but `WaterSystem.compute` never assigns `'grand'` (only `none`/`basic`/`clean`), so the mapping is dead and a tile can never read 3. Harmless but suggests a missing producer.
**Fix:** Either wire an eventual "grand water" upgrade (aqueduct-served residences) or drop the dead key until then.

### IN-03: No validation of negative radius / negative water cost on resolvers

**File:** `src/sim/water.ts:137-145`, `src/sim/water.ts:395-404`
**Issue:** `resolveFountainActivity` and `resolveBaths` accept any `radius`/`waterCostPerTick`. A negative `waterCostPerTick` reduces `waterConsumed` (an active bath could *add* water), and a negative radius produces an active-but-effectless bath that still consumes water. Caller-controlled inputs, so defensively clamp or document.
**Fix:** `waterConsumed += Math.max(0, def.waterCostPerTick ?? BATH_DEFAULT_WATER_COST)` and treat `radius < 0` as 0 (or validate at the def boundary).

## Verification (actual counts)

- `npm run typecheck` → **clean** (exit 0, no diagnostics).
- `npm run lint` → **clean** (exit 0, `eslint src --max-warnings 0`, no warnings/errors).
- `npm run test` → **flaky**; full water-suite green both runs.
  - Run 1: **2 failed | 339 passed (341)** — both failures in `tests/balance-parity.test.ts` via `ENOENT .../src/__military_probe__.ts` (WR-03 race).
  - Run 2: **56 passed (56) files, 341 passed (341)**.
  - Spot: reservoir 6, aqueduct-flow 5, fountain 4, baths 5, water 11, advisors 4 → 35/35 green.
- `npm run check:military` → **clean** ("no forbidden military tokens in src/ or data/").

---

_Reviewed: 2026-08-03T13:46:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
