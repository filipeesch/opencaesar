---
phase: 1
slug: time-deterministic-core
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/unit/time.test.ts tests/unit/paused-queue.test.ts tests/unit/tile.test.ts` |
| **Full suite command** | `npm run test` (vitest run — 43 files, 253 tests) |
| **Estimated runtime** | ~3 seconds (full suite); <1s (quick set) |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck` + the task's `<automated>` verify command (targeted vitest file)
- **After every plan wave:** Run `npm run test` + `npm run typecheck` (full suite, golden + determinism included)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | CORE-01 | T-01-01 / — | N/A (determinism doc) | unit + determinism | `npx vitest run tests/unit/time.test.ts && npx vitest run tests/determinism/determinism.test.ts` | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | CORE-01 | T-01-02 / — | N/A | unit | `npx vitest run tests/unit/time.test.ts && npx vitest run tests/determinism/determinism.test.ts` | ✅ | ⬜ pending |
| 01-02-01 | 02 | 1 | CORE-02 | T-01-03 / — | N/A | unit + type | `npm run typecheck && npx vitest run tests/unit/paused-queue.test.ts` | ✅ / ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | CORE-02 | T-01-03 / — | N/A | unit + determinism | `npx vitest run tests/unit/paused-queue.test.ts && npx vitest run tests/determinism/determinism.test.ts` | ✅ / ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | CORE-03 | T-01-04 / — | N/A | unit | `npx vitest run tests/unit/tile.test.ts && npx vitest run tests/runner-accessors.test.ts` | ✅ | ⬜ pending |
| 01-03-02 | 03 | 2 | CORE-03 | T-01-05 / — | N/A | golden + determinism | `npm run test:golden:update && npm run test && npm run typecheck` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. `W0` marks the new fixture/test files (created by the task itself).*

---

## Wave 0 Requirements

- [ ] `tests/unit/paused-queue.test.ts` — created by plan 01-02 task 1/2 (CORE-02 pipeline coverage)
- [ ] `tests/golden/fixtures/paused-commands-golden.json` — created by plan 01-03 task 2 via `npm run test:golden:update`

*Existing infrastructure (vitest, `tests/helpers.ts`, golden runner, determinism suite) covers the rest.*

---

## Manual-Only Verifications

All phase behaviors have automated verification — the sim core is framework-free and fully unit-testable; pause/speed wiring is additionally covered by E2E (`e2e/acceptance.spec.ts`).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
