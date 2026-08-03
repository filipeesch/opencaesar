---
phase: 02-data-catalogs-military-absence-gate
verified: 2026-08-03T10:52:00Z
status: passed
score: 12/12 must-haves verified
behavior_unverified: 0
---

# Phase 2: Data Catalogs & Military-Absence Gate Verification Report

**Phase Goal:** Externalize balance into validated data catalogs and add the no-military CI gate. (ROADMAP.md — DATA-01, DATA-02, DATA-03)
**Verified:** 2026-08-03T10:52:00Z
**Status:** passed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every building/commodity/housing/walker/trade/event/mission/localization/balance definition lives in a validated external data catalog under `data/` (DATA-01) | ✓ VERIFIED | 10 catalog files under `data/` (buildings, commodities, housing, walkers, trade, events, missions, localization, balance, validate); `validateCatalogs()` (data/validate.ts:49) imports and validates all 9 source catalogs |
| 2 | `validateCatalogs()` covers every catalog including BALANCE and returns an empty issue list on the current data | ✓ VERIFIED | `data/validate.ts:14` imports BALANCE; `issues.push(...validateBalance(BALANCE))` inside validateCatalogs; `tests/data-catalog.test.ts#all catalogs pass load-time validation` and `tests/catalog-load-guard.test.ts#validateCatalogs stays clean on the real catalogs` pass (equal `[]`) |
| 3 | SimRunner refuses to construct when `validateCatalogs()` reports issues (load-time hard-fail guard, DATA-01) | ✓ VERIFIED | `src/sim/runner.ts:113-118` — one-time guard `throwCatalogIssues(validateCatalogs())` at top of constructor; `tests/catalog-load-guard.test.ts` behaviorally asserts a throw with 'Data catalog validation failed' + '[balance]', and that `new SimRunner(1)` / `new SimRunner(2, undefined, 10)` succeed on valid catalogs |
| 4 | CONFIG (src/sim/config.ts) is an exact value-identical re-export of data/balance.ts (key-set and value equality hold) | ✓ VERIFIED | `src/sim/config.ts:12` `export const CONFIG = { ...BALANCE }`; `tests/balance-parity.test.ts` blocks 1-2 (`Object.keys` deep-equal and `{...CONFIG}` toEqual `{...BALANCE}`) pass |
| 5 | Every key in BALANCE is consumed in `src/` via `CONFIG.<key>`, mapping each externalized balance constant to its consuming code | ✓ VERIFIED | `tests/balance-parity.test.ts#every BALANCE key is consumed as CONFIG.<key> outside the re-export` passes for all 29 keys; independently confirmed via rg — every key has ≥1 `CONFIG.<key>` consumer outside `src/sim/config.ts` (incl. `ticksPerSecond` in `src/game/scenes/MainScene.ts`) |
| 6 | No balance key is re-declared or hard-coded as a numeric literal in `src/` outside `data/` and the src/sim/config.ts re-export | ✓ VERIFIED | `tests/balance-parity.test.ts#no src/ file outside the re-export re-declares or re-assigns a balance key` passes (`\b<key>\s*=` regex over all src/ files, skipping config.ts) |
| 7 | Golden determinism tests stay green (behavioral equivalence of externalized constants remains observable) | ✓ VERIFIED | `tests/golden/golden.test.ts` — 2 tests pass in the full run; full suite green |
| 8 | `npm run check:military` runs a standalone scanner over src/ and data/ only and exits non-zero when a forbidden military token appears on any line not carrying the `--NO-MILITARY--` label | ✓ VERIFIED | Negative probe: transient `src/__military_probe__.ts` containing unlabeled "combat" → `node scripts/check-military.mjs` prints `src/__military_probe__.ts:1 (combat)` and exits 1; probe removed afterwards |
| 9 | `npm run check:military` exits 0 on the current clean tree | ✓ VERIFIED | `npm run check:military` → exit 0, prints clean summary |
| 10 | CI (.github/workflows/ci.yml quality job) includes an explicit `npm run check:military` step independent of the unit-test suite | ✓ VERIFIED | `.github/workflows/ci.yml:20` `- run: npm run check:military` between `npm run typecheck` (:19) and `npm test` (:21) |
| 11 | The military gate scans only src/ and data/ (not tests/, e2e/, or docs/) and honors the `--NO-MILITARY--` labeled-doc allowance | ✓ VERIFIED | `scripts/check-military.mjs:55` — `[...collectSourceFiles(join(root, 'src')), ...collectSourceFiles(join(root, 'data'))]` only; line 84 `!lines[i].includes('--NO-MILITARY--')`; `tests/military-absence.test.ts` labeled-line allowance test passes |
| 12 | The FORBIDDEN_TOKENS list has a single source of truth shared by the script and the vitest gate | ✓ VERIFIED | `scripts/check-military.mjs:18` exports FORBIDDEN_TOKENS (11 tokens) + `scanMilitarySources`; `tests/military-absence.test.ts:5` imports both — no duplicated local constant remains |

**Score:** 12/12 truths verified (0 present-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `data/validate.ts` | `validateBalance()` + `throwCatalogIssues()` + balance-aware `validateCatalogs()` | ✓ EXISTS + SUBSTANTIVE | 3 exported functions + CatalogIssue interface; balance loop wired into validateCatalogs |
| `src/sim/runner.ts` | one-time load-time guard in constructor | ✓ EXISTS + SUBSTANTIVE | `catalogsValidated` memo + guard at runner.ts:113-127 |
| `tests/catalog-load-guard.test.ts` | validateBalance + throwCatalogIssues + SimRunner guard tests | ✓ EXISTS + SUBSTANTIVE | 7 tests, all green |
| `tests/balance-parity.test.ts` | key/value identity + per-key consumer mapping + no-redeclaration regression | ✓ EXISTS + SUBSTANTIVE | 5 tests, all green |
| `scripts/check-military.mjs` | exported tokens/scan + guarded main() CLI | ✓ EXISTS + SUBSTANTIVE | exit 0 clean / exit 1 on probe; direct-entry guard at :83 |
| `scripts/check-military.d.mts` | TS surface for the .mjs import | ✓ EXISTS + SUBSTANTIVE | allows strict-ts typecheck of the shared import |
| `package.json` | `check:military` script | ✓ EXISTS + SUBSTANTIVE | `"check:military": "node scripts/check-military.mjs"` |
| `.github/workflows/ci.yml` | explicit `npm run check:military` quality step | ✓ EXISTS + SUBSTANTIVE | line 20 |

**Artifacts:** 8/8 verified

### Key Link Verification

No explicit `key_links` block exists in any plan's must_haves; wiring was verified structurally + behaviorally:

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `data/balance.ts` | `validateCatalogs()` | `import { BALANCE }` + `validateBalance(BALANCE)` | ✓ WIRED | data/validate.ts:14, :85 |
| `validateCatalogs()` | `SimRunner` constructor | `throwCatalogIssues(validateCatalogs())` guarded call | ✓ WIRED | runner.ts:115-118 |
| `data/balance.ts` | `CONFIG` | `export const CONFIG = { ...BALANCE }` | ✓ WIRED | src/sim/config.ts:12 |
| `CONFIG` | consuming sim/game code | `CONFIG.<key>` references | ✓ WIRED | parity test block 2 proves every key consumed |
| `scripts/check-military.mjs` | CI | `npm run check:military` step | ✓ WIRED | ci.yml:20 |
| `scripts/check-military.mjs` | vitest gate | `import { FORBIDDEN_TOKENS, scanMilitarySources }` | ✓ WIRED | military-absence.test.ts:5 |

**Wiring:** 6/6 connections verified

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| DATA-01: All building/commodity/housing/walker/trade/event/mission/localization definitions live in validated external data catalogs | ✓ SATISFIED | - |
| DATA-02: Balance constants are externalized from config with verified behavioral equivalence (golden tests) | ✓ SATISFIED | - |
| DATA-03: A CI validator rejects any military token in src/ and data/, allowing only labeled doc mentions | ✓ SATISFIED | - |

**Coverage:** 3/3 requirements satisfied

### Decision Coverage

CONTEXT.md carries 3 implementation decisions; all three appear in the shipped artifacts:

1. DATA-01 validateCatalogs covers all catalogs + load-time hard-fail → implemented in 02-01 (validateBalance + throwCatalogIssues + constructor guard).
2. DATA-02 parity test mapping each balance constant to consuming code + no-redeclaration regression → implemented in 02-02 (scan covers src/ incl. game shell).
3. DATA-03 dedicated npm script + explicit CI step + shared token source → implemented in 02-03.

`gsd-tools check.decision-coverage-verify` skipped (no annotations it recognizes in CONTEXT.md's `<decisions>` block) — non-blocking per workflow; manual review confirms all decisions honored.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| - | - | none | - | - |

**Anti-patterns:** 0 found (0 blockers, 0 warnings). No TODO/FIXME/placeholder/empty-return/log-only patterns in the phase's new/modified files.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|----------------|---------|
| tests/catalog-load-guard.test.ts | DATA-01 | 7 | 0 | No | Value + Behavioral (throw path exercised) | PASS |
| tests/balance-parity.test.ts | DATA-02 | 5 | 0 | No | Value (deep equal) + source-scan absence | PASS |
| tests/military-absence.test.ts | DATA-03 | 3 | 0 | No | Behavioral / absence | PASS |

**Disabled tests on requirements:** 0 → not a blocker
**Circular patterns detected:** 0 → not a blocker. The parity/gate tests are deterministic source-scans whose expected values (empty offender list) are not generated by the system under test.
**Insufficient assertions:** 0 → warning-free. Requirement-linked tests use value-level and behavioral assertions.

## Human Verification

N/A — Infrastructure/foundation phase with no user-facing elements.
All acceptance criteria are verifiable programmatically; every behavior-dependent truth (load-time guard throw, CLI exit codes, parity identity, scan absence) is exercised by a passing test or a directly-executed command.

## Gaps Summary

**No gaps found.** Phase goal achieved. Ready to proceed to Phase 3 (Road Graph & Walker Categories).

- No deferred items — every gap check resolved to verified.
- Fix plans: none required (status `passed`).

## Verification Metadata

**Verification approach:** Goal-backward (derived from phase goal)
**Must-haves source:** PLAN.md frontmatter (02-01, 02-02, 02-03)
**Automated checks:** `npm run test` → **286/286 passed** (46 files); `npm run typecheck` → pass; `npm run check:military` → exit 0; `npx vitest run tests/golden` → 2 passed; negative-path probe → exit 1 + offender report
**Human checks required:** 0
**Total verification time:** ~3 min

---
*Verified: 2026-08-03T10:52:00Z*
*Verifier: the agent (subagent)*
