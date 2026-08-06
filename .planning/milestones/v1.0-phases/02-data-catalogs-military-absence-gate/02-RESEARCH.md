# Phase 2: Data Catalogs & Military-Absence Gate — Research

**Date:** 2026-08-03
**Researcher:** gsd-phase-researcher (inline, combined session)
**Baseline verified:** `npm run typecheck` clean; `npm run test` → **273 tests pass** across 44 files. Suite runs in ~2.5s, so per-task verification is cheap and the full suite can run after every task.

---

## 1. Existing Implementation Summary

### DATA-01 — validated external data catalogs (mostly as-built, two genuine gaps)

- Catalogs under `data/`: `commodities.ts`, `buildings.ts`, `housing.ts`, `walkers.ts`, `trade.ts`, `events.ts`, `missions.ts`, `localization.ts`, `balance.ts`, plus `validate.ts`.
- `validateCatalogs()` (`data/validate.ts:20-82`) already validates 8 catalogs:
  - buildings — footprint/cost/workers (`validate.ts:23-33`)
  - commodities — name + non-negative prices, ≥4 food types (`validate.ts:35-43`)
  - housing — non-negative capacity, strictly ascending levels (`validate.ts:45-53`)
  - walkers — id/name/service present (`validate.ts:55-59`)
  - trade — positive distance + non-empty buys (`validate.ts:61-65`)
  - events — non-empty message (`validate.ts:67-69`)
  - missions — positive targetPopulation (`validate.ts:71-75`)
  - localization — non-empty pt string table (`validate.ts:77-79`)
- **Gap A (GENUINE):** `validateCatalogs` does NOT import or validate `BALANCE`
  (`data/validate.ts:6-13` imports have no `balance.ts`). Corrupt balance data (NaN,
  Infinity, negatives) would pass load-time validation.
- **Gap B (GENUINE):** nothing calls `validateCatalogs()` at sim load time. It is only
  referenced in `tests/data-catalog.test.ts:49`. `SimRunner`'s constructor
  (`src/sim/runner.ts:113-131`) sets map/treasury from CONFIG without ever validating.
  DATA-01 "refuses to run on corrupt data" is unmet.

### DATA-02 — balance externalized from config (as-built, parity test missing)

- `data/balance.ts:7-80` defines `BALANCE` (29 numeric keys). `src/sim/config.ts:10-12`
  re-exports `CONFIG = { ...BALANCE }` so every consumer is unchanged.
- Verified consumption: every BALANCE key is used ONLY as `CONFIG.<key>` in `src/`:
  - src/sim/housing.ts:42 (desirabilityPolicyGain), :44-46 (desirabilityServiceBonus),
    :56 (desirabilityThresholdPerTier), :99/:111 (evolve/devolveWindowTicks)
  - src/sim/economy.ts:56 (wagePerWorkerPerTick), :105 (prosperityRevenueTarget)
  - src/sim/happiness.ts:21-25 (happiness*Weight)
  - src/sim/walkers.ts:111 (walkerLifetimeTicks), :227 (marketFetchAmount), :263 (walkerSpeedPerTick)
  - src/sim/buildings.ts:64/:75 (farm/prod + granaryCapacity), :86-154 (spawnEveryTicks)
  - src/sim/runner.ts:130 (startingTreasury), :612 (laborSpawnEveryTicks), :631 (serviceCooldownTicks),
    :680-682 (granaryCapacity/cartTransferPerTick), :696 (lowFoodWarnCooldownTicks), :783 (messageLogCapacity)
  - src/game/scenes/MainScene.ts:42,393 (ticksPerSecond — **game shell**, not src/sim)
- Existing DATA-02 test: `tests/data-catalog.test.ts:63-73` — `{...CONFIG} toEqual
  {...BALANCE}` identity + 3 sentinels. **Gap (GENUINE):** no per-constant →
  consuming-code mapping (the "catalog→behavior parity test" the decision requires), and
  no regression guard preventing a balance key from being re-declared as a raw literal in
  `src/`. Note `ticksPerSecond` is consumed outside src/sim → parity scan must cover
  `src/` (sim + game), not src/sim alone, or it will falsely fail on ticksPerSecond.
- `HOUSE_TIERS` (`src/sim/config.ts:22-27`) is a structural 5-tier table, not a balance
  constant in `data/balance.ts`; out of DATA-02 scope (deferred).

### DATA-03 — military gate exists as a unit test, NOT as an independent CI step

- `tests/military-absence.test.ts` — vitest gate: 11 forbidden tokens
  (`military, army, legion, soldier, fort, barracks, weapon, enemy, invasion, combat,
  damageFromUnit`), scans `src/` + `data/` recursively (`*.ts|tsx|js|cjs|mjs`, skipping
  node_modules + test-results), allow-lists any line containing `--NO-MILITARY--`.
- **Gap (GENUINE):** it only runs inside `npm test` (vitest). There is **no**
  `npm run check:military` script (`package.json:7-18`) and **no** explicit step in
  `.github/workflows/ci.yml` (quality job at ci.yml:17-20 runs lint/typecheck/test only).
  The gate cannot "fail loudly independent of unit tests"; if `npm test` were skipped or
  the vitest suite broke, the military gate would not run.
- The token list is defined once locally in the test; introducing a standalone script
  creates a second copy unless the test imports from the script (single source of truth).

---

## 2. Gaps vs Requirements

| Requirement | Status | Gap |
|-------------|--------|-----|
| DATA-01 all catalogs validated | ❌ partial | `validateCatalogs` covers 8 catalogs; **BALANCE not validated** (`data/validate.ts:6-13`) |
| DATA-01 refuses to run on corrupt data | ❌ missing | No load-time call; only test caller (`tests/data-catalog.test.ts:49`); SimRunner ctor (`src/sim/runner.ts:113-131`) never validates |
| DATA-02 externalized from config | ✅ as-built | All 29 keys consumed via `CONFIG.`; identity test exists |
| DATA-02 behavioral equivalence (golden) | ✅ as-built | Golden suite + identity test green |
| DATA-02 catalog→behavior parity test | ❌ missing | No per-key consumer-mapping / no-redeclaration regression test |
| DATA-03 dedicated gate | ❌ missing | No `check:military` script, no CI step; only inside `npm test` |
| DATA-03 src/+data/ scope + labeled-doc allowance | ✅ as-built | `tests/military-absence.test.ts` already implements it |

---

## 3. Open Questions (all RESOLVED)

| # | Question | Resolution |
|---|----------|------------|
| Q1 | Does `validateCatalogs` already cover every catalog incl. balance? | **RESOLVED:** No — BALANCE missing from `data/validate.ts` imports/loop. Add `validateBalance` + include it. |
| Q2 | Is validation wired at load time anywhere? | **RESOLVED:** No — only the test calls it. Add a one-time hard-fail guard in the SimRunner constructor. |
| Q3 | Do any hard-coded balance literals remain in src/sim? | **RESOLVED:** No — all 29 keys consumed only via `CONFIG.` (grep verified). `HOUSE_TIERS` is structural, out of scope. |
| Q4 | Where is `ticksPerSecond` consumed? | **RESOLVED:** Game shell only — `src/game/scenes/MainScene.ts:42,393`. Parity test must scan `src/`, not just src/sim. |
| Q5 | Is there an existing `check:military` script or CI step? | **RESOLVED:** No — create `scripts/check-military.mjs` + `package.json` script + ci.yml step. |
| Q6 | Actual baseline test count? | **RESOLVED:** 273 tests / 44 files (~2.5s). Older "126"/"253" references are stale. |
| Q7 | Will the load-time guard slow the 273-test suite? | **RESOLVED:** No — guard validates once per process (module-level memo), catalogs are small; suite stays ~2.5s. |
| Q8 | Do golden tests already lock balance behavior? | **RESOLVED:** Yes — a balance change breaks `tests/golden/golden.test.ts`. Parity test complements it; no golden regen expected. |

---

## 4. Validation Architecture

Applies — see `02-VALIDATION.md` (created). The Vitest suite is fast (~2.5s full, <1s
targeted), so per-task sampling at `npm run typecheck` + the task's `<automated>` vitest
command is fine; the full suite runs after each plan wave. The military gate's standalone
script (`node scripts/check-military.mjs`) is verified separately in plan 02-03 but also
sampled through CI semantics (`npm run check:military`, exit-code based).
