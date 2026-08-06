---
phase: 2
slug: data-catalogs-military-absence-gate
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` (node env, `tests/**/*.test.ts`) |
| **Quick run command** | `npm run typecheck && npx vitest run tests/data-catalog.test.ts tests/catalog-load-guard.test.ts` |
| **Full suite command** | `npm run test` (vitest run — 44 files, 273 tests) |
| **Estimated runtime** | ~3 seconds (full suite); <1s (quick set) |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck` + the task's `<automated>` verify command (targeted vitest file and/or `node scripts/check-military.mjs`)
- **After every plan wave:** Run `npm run test` + `npm run typecheck` (full suite, golden + determinism included)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~3 seconds (the military script adds <1s and is exit-code sampled alongside the suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 02-01 | 1 | DATA-01 | T-02-01 / — | N/A | unit + type | `npm run typecheck && npx vitest run tests/data-catalog.test.ts && npx vitest run tests/catalog-load-guard.test.ts` | ✅ / ❌ W0 | ⬜ pending |
| 02-01-02 | 02-01 | 1 | DATA-01 | T-02-02 / — | N/A | unit + type | `npm run typecheck && npx vitest run tests/catalog-load-guard.test.ts && npx vitest run tests/determinism/determinism.test.ts && npx vitest run tests/runner-accessors.test.ts` | ✅ / ❌ W0 | ⬜ pending |
| 02-02-01 | 02-02 | 2 | DATA-02 | T-02-03 / — | N/A | unit + type | `npm run typecheck && npx vitest run tests/balance-parity.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02-02 | 2 | DATA-02 | T-02-03 / — | N/A | unit + golden | `npm run typecheck && npx vitest run tests/balance-parity.test.ts && npx vitest run tests/golden` | ❌ W0 | ⬜ pending |
| 02-03-01 | 02-03 | 3 | DATA-03 | T-02-04 / — | N/A | script (CLI exit code) | `node scripts/check-military.mjs` (expect exit 0, summary on stdout) | ❌ W0 | ⬜ pending |
| 02-03-02 | 02-03 | 3 | DATA-03 | T-02-04 / — | N/A | script + unit + type | `npm run check:military && npm run typecheck && npm test` | ❌ W0 / refactor | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. `W0` marks the new fixture/test files (created by the task itself).*

---

## Wave 0 Requirements

- [ ] `tests/catalog-load-guard.test.ts` — created by plan 02-01 (validateBalance + throwCatalogIssues + SimRunner guard coverage)
- [ ] `tests/balance-parity.test.ts` — created by plan 02-02 (per-key consumer mapping + no-redeclaration regression)
- [ ] `scripts/check-military.mjs` — created by plan 02-03 (standalone scanner, exported tokens/scan + CLI main)

*Existing infrastructure (vitest, `tests/helpers.ts`, golden suite, `scripts/export-art.mjs` pattern, existing catalogs) covers the rest.*

---

## Manual-Only Verifications

All phase behaviors have automated verification: catalog validation and the load-time guard
are unit-testable, the parity test is a deterministic source-scan, and the military gate is
an exit-code-checked standalone script plus its CI wiring (CI itself is validated by reading
the committed `.github/workflows/ci.yml` step in review; the script's behavior is proven by
execution).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
