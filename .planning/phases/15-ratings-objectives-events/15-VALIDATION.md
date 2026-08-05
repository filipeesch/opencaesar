---
phase: 15
slug: ratings-objectives-events
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-05
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.7 |
| **Config file** | `vitest.config.ts` (`include: ['tests/**/*.test.ts']`, `environment: 'node'`, `testTimeout: 30000`) |
| **Quick run command** | `npx vitest run tests/ratings.test.ts tests/objectives.test.ts tests/events.test.ts tests/missions.test.ts tests/runner-accessors.test.ts tests/data-catalog.test.ts -x` |
| **Full suite command** | `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` |
| **Estimated runtime** | ~36 seconds (751 tests / 105 files baseline) |

---

## Sampling Rate

- **After every task commit:** Run quick command above
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | RATE-01 | — | N/A (sim, no untrusted input) | unit | `npx vitest run tests/ratings.test.ts -x` | ✅ extend | ⬜ pending |
| 15-01-02 | 01 | 1 | RATE-01 | — | N/A | integration | `npx vitest run tests/runner-accessors.test.ts -x` | ✅ extend | ⬜ pending |
| 15-02-01 | 02 | 2 | RATE-02 | — | N/A | unit | `npx vitest run tests/objectives.test.ts -x` | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 2 | RATE-02 | — | N/A | determinism | `npx vitest run tests/determinism/export-window-determinism.test.ts -x` | ❌ W0 | ⬜ pending |
| 15-03-01 | 03 | 3 | RATE-03 | — | N/A | unit | `npx vitest run tests/events.test.ts tests/data-catalog.test.ts -x` | ✅ extend | ⬜ pending |
| 15-03-02 | 03 | 3 | RATE-03 | — | N/A | integration | `npx vitest run tests/runner-accessors.test.ts -x` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/objectives.test.ts` — sustained-period + treasury/favor/exports targets (RATE-02)
- [ ] `tests/determinism/export-window-determinism.test.ts` — annual exports window determinism (RATE-02)
- [ ] Frame `tests/events.test.ts` responses coverage (RATE-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
