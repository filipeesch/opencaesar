---
phase: 6
slug: production-manufacturing
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` (node env, `tests/**/*.test.ts`) |
| **Quick run command** | `npm run typecheck && npx vitest run tests/unit/production.test.ts tests/unit/extraction.test.ts` |
| **Full suite command** | `npm run test` (vitest run — 57 files, 424 tests at baseline) |
| **Estimated runtime** | ~3 seconds (full suite); <1s (quick set) |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck` + the task's `<automated>` verify command (targeted vitest file and/or the full suite where the task's verify lists it)
- **After every plan wave:** Run `npm run test` + `npm run typecheck` (full suite, golden + determinism + property included)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~3 seconds (full suite); <1s (targeted)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 06-01 | 1 | PROD-01 | T-06-01 / — | N/A (deposit gate) | unit + full | `npm run typecheck && npx vitest run tests/unit/extraction.test.ts && npm run test` | ❌ W0 | ⬜ pending |
| 06-01-02 | 06-01 | 1 | PROD-02 | T-06-02 / T-06-03 | N/A | unit + type | `npm run typecheck && npx vitest run tests/unit/production-pipeline.test.ts && npx vitest run tests/unit/production.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-03 | 06-01 | 1 | PROD-02 | T-06-04 / — | N/A | unit + full | `npm run typecheck && npx vitest run tests/unit/workshop-blocked.test.ts && npm run test` | ❌ W0 | ⬜ pending |
| 06-02-01 | 06-02 | 2 | PROD-01, PROD-02 | T-06-05 / — | N/A | integration + type | `npm run typecheck && npx vitest run tests/integration/production-chain.test.ts && npx vitest run tests/unit/production.test.ts tests/unit/logistics.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-02 | 06-02 | 2 | PROD-02 | T-06-06 / — | N/A | unit + type | `npm run typecheck && npx vitest run tests/unit/advisors.test.ts` | ✅ mod | ⬜ pending |
| 06-03-01 | 06-03 | 3 | PROD-02 (determinism) | T-06-07 / — | N/A | determinism + type | `npm run typecheck && npx vitest run tests/determinism/production-chain-determinism.test.ts && npx vitest run tests/determinism/determinism.test.ts` | ❌ W0 | ⬜ pending |
| 06-03-02 | 06-03 | 3 | PROD-01, PROD-02 | T-06-01 / T-06-05 | N/A | integration + full | `npm run typecheck && npx vitest run tests/integration/production-runner.test.ts && npm run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. `W0` marks the new fixture/test files (created by the task itself); `mod` marks pre-existing files extended in-place by the task.*

---

## Wave 0 Requirements

- [ ] `tests/unit/extraction.test.ts` — created by plan 06-01 task 1 (deposit gate: satisfiesDeposit/canExtract for the four sites)
- [ ] `tests/unit/production-pipeline.test.ts` — created by plan 06-01 task 2 (porterDestination validity incl. warehouse fallback; full multi-step pipeline)
- [ ] `tests/unit/workshop-blocked.test.ts` — created by plan 06-01 task 3 (missing_input / output_full / blocked / no-destination no-loss)
- [ ] `tests/integration/production-chain.test.ts` — created by plan 06-02 task 1 (runner tickProduction: extraction→workshop→porter→warehouse, deposit off-site blocked)
- [ ] `tests/determinism/production-chain-determinism.test.ts` — created by plan 06-03 task 1 (chunked 1/7/50 same-seed identity)
- [ ] `tests/integration/production-runner.test.ts` — created by plan 06-03 task 2 (end-to-end acceptance: deposit enforcement, pipeline, bottleneck no-loss, full suite)

*Existing files extended in-place (not W0): `tests/helpers.ts` (productionChainMap + buildProductionCity by 06-02-01), `tests/unit/advisors.test.ts` (production advisor by 06-02-02), plus the source files each task modifies. No framework, fixture, or helper install needed.*

---

## Manual-Only Verifications

All phase behaviors have automated verification: the deposit gate, destination
validity (workshop > warehouse > blocked), the multi-step pipeline stock-rise, the
blocked-state no-loss contract, the SimRunner extraction/workshop stepping, the
SimState-derived production advisor rows, and the chunked-tick determinism of the
production chain are all vitest assertions. The RNG/clock-free audit of
`src/sim/production.ts` is a source read whose conclusion is enforced by the
determinism test; no manual step.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
