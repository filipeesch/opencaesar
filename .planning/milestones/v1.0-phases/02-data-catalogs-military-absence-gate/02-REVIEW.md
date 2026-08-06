---
phase: 02-data-catalogs-military-absence-gate
reviewed: 2026-08-03T11:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - data/validate.ts
  - src/sim/runner.ts
  - scripts/check-military.mjs
  - scripts/check-military.d.mts
  - package.json
  - .github/workflows/ci.yml
  - tests/catalog-load-guard.test.ts
  - tests/balance-parity.test.ts
  - tests/military-absence.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-08-03T11:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the three Phase-2 workstreams at standard depth with cross-file trace:
(1) the BALANCE catalog validation + one-time load-time hard-fail guard
(DATA-01), (2) the balance-catalog-to-behavior parity suite (DATA-02), and
(3) the standalone military-absence gate + CI step (DATA-03).

Verification commands all pass: `npm run typecheck` (clean), `npm test`
(286/286 across 46 files), `npm run check:military` (exit 0, clean), and
`npm run lint` (clean). The direct-entry guard in `check-military.mjs` was
probed: import does not trigger `main()`; a probe file under `src/` makes the
CLI exit 1 with the offender line; removing it restores exit 0. `pathToFileURL`
on the CLI entry resolves correctly from any cwd.

Two warning-level robustness gaps were found, both in test tools rather than
runtime sim code: the parity no-redeclaration regex false-positives on `===`,
and the military labeled-doc allowance branch is never exercised by any test or
by the current clean tree. No critical issues. No security vulnerabilities
identified (no injection surface, no secrets, no unsafe deserialization).

Out-of-scope observation: `tests/golden/golden.test.ts`, `tests/unit/tile.test.ts`,
and `tests/golden/fixtures/paused-commands-golden.json` carry uncommitted
working-tree changes that belong to Phase 1 (`git status` shows ` M`/`??`).
They are not listed in any Phase-2 SUMMARY `key-files` and were reviewed only
for regression impact — none found; they are flagged here as a workspace-state
note, not a Phase-2 defect.

## Warnings

### WR-01: Parity no-redeclaration regex false-positives on strict-equality (`===`) and destructuring

**File:** `tests/balance-parity.test.ts:48`
**Issue:** The no-redeclaration guard builds `new RegExp(\`\\b${key}\\s*=\`)`. The
regex is not anchored to an assignment — a literal `=` matches the first `=` of
`===`. Verified by probe: `CONFIG.desirabilityPolicyGain === 100` or a comment
like `// desirabilityPolicyGain = 200` both trip the guard and would fail CI
with a spurious "re-declared" error, despite neither being a declaration. It
also matches destructuring aliases (e.g. `const defaultMapSize = config.x`),
confusing the check's stated intent. Today the suite is green only because no
such code exists yet; the next consumer who writes a strict equality against a
CONFIG key breaks the gate for the wrong reason.
**Fix:** Require an assignment context that excludes `===`/`!==`, e.g.

```ts
const re = new RegExp(`\\b${key}\\s*(?!=)=`);
```

(or match `\\b${key}\\s*[:]?=` and assert the following char is not `=`). Optionally
strip `//`, `/* ... */` comments before matching to keep the gate honest about
actual declarations.

### WR-02: Military labeled-doc allowance (`--NO-MILITARY--`) is dead code in tests — D4 verification does not actually verify

**File:** `tests/military-absence.test.ts:44`
**Issue:** The scanner's skip branch — `!lines[i].includes('--NO-MILITARY--')`
in `scripts/check-military.mjs:63` — is never exercised. `grep -r --NO-MILITARY--
src data` returns 0 matches, so the clean-tree scans pass without ever taking the
skip path, and the test `allow --NO-MILITARY-- labeled lines and flag unlabeled
token lines` is tautological: it only asserts that the test's own string literal
contains the label (line 49) and that the token regex matches — it never feeds a
labeled line through `scanMilitarySources()`. A regression that deleted the
allowance (or inverted it to allow everything) would still pass every test and
the CI step. The SUMMARY claims D4 "honors the --NO-MILITARY-- labeled-doc
allowance" with status pass; that claim is not backed by an exercised assertion.
**Fix:** Unit-test the scan, not the literal. Temporarily create a file under
`src/` (or pass a constructed path) containing one labeled and one unlabeled
token line, run `scanMilitarySources()`, and assert the labeled line is excluded
and the unlabeled one reported — cleaning up afterward. For example:

```ts
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
const p = join(root, 'src', '__military_probe__.ts');
try {
  writeFileSync(p, `const a = 1; // army (--NO-MILITARY--)\nconst b = 2; // enemy\n`);
  const offenders = scanMilitarySources();
  expect(offenders.filter((o) => o.includes('army')).length).toBe(0);
  expect(offenders.some((o) => o.includes('enemy'))).toBe(true);
} finally {
  rmSync(p, { force: true });
}
```

## Info

### IN-01: Consumer-mapping check uses substring `includes`, allowing false confidence

**File:** `tests/balance-parity.test.ts:40`
**Issue:** `readFileSync(file,'utf8').includes(\`CONFIG.${key}\`)` matches substrings.
A hypothetical `CONFIG.defaultMapSize2` or `CONFIG.tickPerSecond2` would count as
a legitimate consumer of `defaultMapSize`/`tickPerSecond` (substring verified via
probe). No current key in CONFIG enables this (all keys are disjoint identifiers),
so it is latent, but the mapping proof is weaker than a word-boundary match.
**Fix:** Use a word-boundary regex instead of substring includes, e.g.
`new RegExp(\`CONFIG\\.${key}\\b\`)` (the `\b` after the key prevents prefix matches).

### IN-02: `catalogsValidated` memo skips re-validation for all later constructions

**File:** `src/sim/runner.ts:120`
**Issue:** The module-level `catalogsValidated` flag makes validation run exactly
once per process. This is an intentional, documented performance decision with
correct semantics for the current static `BALANCE` (`as const`) and data catalogs.
The caveat is silent: if a future refactor allows runtime mutation of catalog data
(e.g. config-dependent tuning), the second and subsequent `new SimRunner(...)`
constructions would never re-validate and the hard-fail guarantee silently
evaporates. Worth a one-line comment (or a WARNING in the code) documenting the
invariant that catalogs must remain immutable at runtime.
**Fix:** Add a comment next to the flag stating the immutability invariant, or
validate catalog *reference identity* once (fail if a catalog module instance
changed) rather than the boolean skip.

### IN-03: Hand-written `.d.mts` can drift from the `.mjs` surface

**File:** `scripts/check-military.d.mts:6`
**Issue:** The ambient declaration is a manual projection of
`scripts/check-military.mjs` (the declared `readonly string[]` for
`FORBIDDEN_TOKENS` is a widening of the actual mutable `const`, which is
subtype-safe, and no assertion links the two). No test verifies declaration
parity, so a future edit to the `.mjs` (new export, renamed function) could
silently desynchronize the type surface. Scope is tiny (2 exports) and currently
accurate, so risk is low.
**Fix:** Add a lightweight assertion in the vitest suite that the `.mjs` exports
match the declared names (e.g. `expect(Object.keys(await import(...)))` contains
`FORBIDDEN_TOKENS` and `scanMilitarySources`), or accept the drift risk
deliberately.

## Non-issues checked and cleared

- `validateBalance` correctly flags `NaN`/`Infinity`/negative/non-number values
  via `Number.isFinite` + `< 0`; `-0` and `0` pass as intended.
- `throwCatalogIssues` message format is consistent with the tests and
  deterministic; empty list no-ops correctly.
- The SimRunner guard throws *before* seed/state mutation, so a failed
  construction leaves no partial object; the memo is only set after a successful
  run, so repeated invalid constructions keep failing loudly.
- `check-military.mjs` token list is a hardcoded internal constant — no regex
  injection surface (no user input fed to `new RegExp`); `\b...\b` boundaries
  correctly reject plural/compound false positives (`soldiers`, `fortify`,
  `combatant`). `node_modules`/`test-results` are skipped.
- CI step placement (lint → typecheck → check:military → test) matches the plan
  and gates independently of the unit suite.
- `package.json` script is correctly named and ordered.

---

_Reviewed: 2026-08-03_
_Reviewer: gsd-code-reviewer agent_
_Depth: standard_
