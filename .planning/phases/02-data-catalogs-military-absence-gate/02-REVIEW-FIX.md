---
phase: 02-data-catalogs-military-absence-gate
fixed: 5
skipped: 0
findings_in_scope: 5
iteration: 1
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Findings in scope:** 5 (2 warning, 3 info)
**Fixed:** 5
**Skipped:** 0
**Status:** all_fixed

## Summary

Fixed all two warnings and all three info findings from `02-REVIEW.md`. No finding
was deferred. Every fix is backed by one or more unit tests, is deterministic
(framework-free sim, no randomness), and the full verification gate stays green:
`npm test` 289/289 (up from the 286 baseline — +3 new tests), `npm run typecheck`
clean, `npm run lint` clean, `npm run check:military` clean.

One judgment call: WR-01's prescribed regex `\b${key}\s*(?!=)=` places the negative
lookahead on the wrong side of the `=` — verified in Node that it never matches a
genuine `key = 20` assignment (the lookahead is tested at the position right before
the `=`, which is always the `=` itself), silently disabling the whole re-declaration
guard. Used `\b${key}\s*=(?!=)` instead (lookahead after the `=`): it still flags
real assignments while excluding `==`/`===`/`!==` and plain read references.

## Findings

| ID | Severity | Disposition | Commit |
|----|----------|-------------|--------|
| WR-01 | warning | fixed | `b6afef2` |
| WR-02 | warning | fixed | `8581a3e` |
| IN-01 | info | fixed | `38e23a4` |
| IN-02 | info | fixed | `8951531` |
| IN-03 | info | fixed | `5b1dbbc` |

## Fix details

### WR-01 — Parity no-redeclaration regex false-positives (fixed)

**Finding:** `tests/balance-parity.test.ts` built `new RegExp(\`\\b${key}\\s*=\`)`,
matching the first `=` of `===`/`!==` and plain references, tripping the
re-declaration guard on strict-equality reads and comments.

**Fix:** Extracted `redeclarationRe(key)` which returns `new RegExp(\`\\b${key}\\s*=(?!=)\`)`
and uses it in the guard. The negative lookahead is placed after the consumed `=`
(see summary for why the review's exact placement was not usable). Added a unit test
proving per-key behaviour: `key = 20` and `CONFIG.key = 20` are flagged; `===`, `!==`,
`==`, and `const x = key` are not.

**Verification:** `npx vitest run tests/balance-parity.test.ts` => 6 tests pass;
full suite green.

### WR-02 — Military labeled-doc allowance is dead code in tests (fixed)

**Finding:** The `--NO-MILITARY--` skip branch in `scripts/check-military.mjs:63`
was never exercised — the old test only asserted the test's own string literal,
so a regression in the allowance would pass unnoticed.

**Fix:** Replaced the tautological test with a real probe: writes
`src/__military_probe__.ts` containing one labeled line
(`// army (--NO-MILITARY--)`) and one unlabeled line (`// enemy`), runs
`scanMilitarySources()`, asserts the labeled line is excluded (0 `army` offenders)
and the unlabeled line is reported (an `enemy` offender exists), then removes the
probe in a `finally`. Also asserts `army`/`enemy` are genuine `FORBIDDEN_TOKENS`
so the probe exercises the real token list.

**Verification:** `npx vitest run tests/military-absence.test.ts` => 3 tests pass;
probe file confirmed removed after the run; `npm run check:military` clean.

### IN-01 — Consumer-mapping substring `includes` (fixed)

**Finding:** `readFileSync(...).includes(\`CONFIG.${key}\`)` matches substrings, so
a hypothetical `CONFIG.defaultMapSize2` would count as a consumer of
`defaultMapSize`.

**Fix:** Consumer check now uses `new RegExp(\`CONFIG\\.${key}\\b\`)` (word boundary
after the key). Added a unit test asserting `CONFIG.<key>` matches and
`CONFIG.<key>2` does not.

**Verification:** `npx vitest run tests/balance-parity.test.ts` => 7 tests pass;
all keys still resolve to real consumers.

### IN-02 — `catalogsValidated` memo immutability caveat (fixed)

**Finding:** `src/sim/runner.ts` module-level `catalogsValidated` skips re-validation
on later constructions; the caveat was silent.

**Fix:** Documented the invariant in the memo's doc comment: catalogs are validated
once per process, so `BALANCE` and all data catalogs must stay immutable at runtime.
Also corrected the stale "273-test" count in that comment.

**Verification:** `npm run typecheck` clean.

### IN-03 — Hand-written `.d.mts` drift (fixed)

**Finding:** No test linked `scripts/check-military.mjs`'s runtime surface to the
declared `.d.mts` names.

**Fix:** Added a parity test that imports the `.mjs` and asserts its export keys
contain `FORBIDDEN_TOKENS` and `scanMilitarySources`, and that the dynamically
imported values are reference-identical to the statically imported ones (so the
declared surface matches the runtime single source of truth).

**Verification:** `npx vitest run tests/military-absence.test.ts` => 4 tests pass.

## Verification

| Check | Before | After |
|-------|--------|-------|
| `npm test` | 286 passed | 289 passed (+3) |
| `npm run typecheck` | clean | clean |
| `npm run lint` | clean | clean |
| `npm run check:military` | exit 0 | exit 0 |

---

_Fixed: 2026-08-03_
_Fixer: gsd-code-fixer agent_
_Iteration: 1_
