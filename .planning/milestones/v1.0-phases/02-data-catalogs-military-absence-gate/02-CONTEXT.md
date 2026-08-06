# Phase 2: Data Catalogs & Military-Absence Gate - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous batch acceptance, THIS is the record)

<domain>
## Phase Boundary

Externalize balance into validated data catalogs and add the no-military CI gate.
Every building/commodity/housing/walker/trade/event/mission/localization/**balance**
definition must live in an external, validated data catalog (`data/*.ts`); the sim must
refuse to run on corrupt catalog data; balance constants re-exported as `CONFIG` must
stay behaviorally equivalent to the catalog (parity verified); and CI must fail loudly
on any forbidden military token in `src/` and `data/` independent of the unit-test
suite. Requirements: DATA-01, DATA-02, DATA-03.
</domain>

<decisions>
## Implementation Decisions

### Treatment of Existing Implementation (baseline scout)
- Verify-as-built + gap-fill. `data/validate.ts` `validateCatalogs()` already exists and
  covers building/commodity/housing/walker/trade/event/mission/localization catalogs
  (data/validate.ts:20-82) — do NOT rewrite it. Only close the two genuine DATA-01 gaps:
  BALANCE is not covered by `validateCatalogs()`, and nothing calls it at sim load time.
- Baseline confirmed: `npm run typecheck` clean; `npm run test` → **273 tests pass**
  (44 files, ~2.5s). The military gate already exists as a vitest test
  (tests/military-absence.test.ts) — the work is adding the standalone script + CI step,
  not inventing the token list.

### 1. DATA-01: validateCatalogs covers all catalogs + load-time hard-fail
- Extend `validateCatalogs()` (data/validate.ts) to also validate the BALANCE catalog
  (import from data/balance.ts, flag non-finite/negative/missing values).
- Add a load-time hard-fail guard so the sim **refuses to run on corrupt data**:
  SimRunner (src/sim/runner.ts) calls the validator once at construction and throws on
  any issue. Because the catalogs are valid today, all 273 existing tests stay green.
- Since `validateCatalogs` already covers every other catalog, the DATA-01 "coverage" task
  is a balance-coverage + guard task, not a from-scratch validation rewrite.

### 2. DATA-02: audit + catalog→behavior parity test (realistic)
- Audit `data/balance.ts` import sites in src to confirm no hard-coded balance literals
  remain. Verified: all 29 balance keys are consumed ONLY via `CONFIG.<key>` in `src/`
  (e.g. src/sim/housing.ts:42, src/sim/economy.ts:56, src/sim/walkers.ts:111); the
  existing identity test (tests/data-catalog.test.ts:63-73) passes.
- Add a catalog→behavior parity test **mapping each externalized balance constant to its
  consuming code**: for every BALANCE key, assert `CONFIG.<key>` is referenced by at least
  one file under `src/` (excluding the `src/sim/config.ts` re-export). Note
  `ticksPerSecond` is consumed by the game shell (src/game/scenes/MainScene.ts:42), not
  src/sim — so the parity scan covers `src/` (sim + game), not src/sim alone.
- Add a no-redeclaration regression: no `src/` file (other than `src/sim/config.ts`)
  declares/assigns a balance key (`\b<key>\s*=`), proving externalized constants are never
  re-created in code.

### 3. DATA-03: dedicated npm script + explicit CI step (independent of unit tests)
- Add `npm run check:military` — a standalone Node scanner (`scripts/check-military.mjs`)
  over `src/` and `data/` only, same FORBIDDEN_TOKENS as today, honoring the
  `--NO-MILITARY--` labeled-doc allowance, exiting non-zero on any violation.
- Add an explicit `npm run check:military` step to the `quality` job of
  .github/workflows/ci.yml (independent of `npm test`), so the gate fails loudly even if
  the unit-test suite were skipped/broken.
- Refactor tests/military-absence.test.ts to import the token list + scan from the shared
  script (single source of truth) instead of a duplicated local constant.

### Claude's Discretion
Exact validation rules inside `validateBalance`, the guard's error message format, and the
parity test's implementation details are left to the planner/executor so long as the three
decisions above hold.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `data/validate.ts:20-82` — `validateCatalogs(): CatalogIssue[]`; currently validates 8
  catalogs (buildings, commodities, housing, walkers, trade, events, missions,
  localization) and returns an empty array when all pass. BALANCE is NOT imported.
- `data/balance.ts:7-80` — `BALANCE` const with 29 tunable keys (map sizing, treasury,
  walker timings, service cooldown, housing evolution, food, economy, happiness,
  messages). All values are numbers; header asks consumers to read through CONFIG.
- `src/sim/config.ts:10-12` — `export const CONFIG = { ...BALANCE }`; every sim/game
  consumer reads the externalized values through CONFIG (home of the old hard-coded
  constants, now a re-export shim).
- `tests/data-catalog.test.ts:63-73` — existing DATA-02 identity test
  (`{...CONFIG} toEqual {...BALANCE}` + 3 sentinel values).
- `tests/military-absence.test.ts` — existing vitest military gate (11 tokens,
  src/+data/ scan, `--NO-MILITARY--` line allowance).
- `.github/workflows/ci.yml:7-20` — `quality` job: npm ci → lint → typecheck → test.
- Golden determinism suite (`tests/golden/golden.test.ts`) — any balance value change
  would break a golden, giving built-in behavioral-equivalence coverage.

### Established Patterns
- Sim core is framework-free and unit-testable under Vitest (node env, `tests/**/*.test.ts`).
- Standalone scripts live in `scripts/*.mjs` (plain Node, no build) — see
  `scripts/export-art.mjs`.
- Tests import catalogs directly from `data/*.ts` and sim modules from `src/sim/*.ts`.
- All balance values are consumed via dotted `CONFIG.` references, never raw literals.

### Integration Points
- `SimRunner` constructor (src/sim/runner.ts:113-131) — where the load-time validation
  guard hooks in; also game shell construction sites (src/game/scenes/MainScene.ts:67,75).
- `npm test` (vitest run) and `npm run typecheck` — the fast verification loop (~2.5s).
</code_context>

<specifics>
## Specific Ideas

The accepted decisions (1-3 above) fully define scope. Nothing further required from the
user — this phase is a verify-as-built + gap-fill batch with a new standalone CI gate.
</specifics>

<deferred>
## Deferred Ideas

- `HOUSE_TIERS` (src/sim/config.ts:22-27) is a structural 5-tier table (population /
  workers / taxPerTick), not a tunable balance constant and not part of `data/balance.ts` —
  out of DATA-02 scope this phase.
- Military gate deliberately scans only `src/` and `data/` (decision 3); docs, `e2e/`,
  and `tests/` mention military terms only via `--NO-MILITARY--` and are not scanned.
- Deep shape/cross-reference validation of catalogs (e.g. every commodity in a trade
  city's buys/sells exists in COMMODITIES) is a future hardening idea, not required now.
</deferred>
