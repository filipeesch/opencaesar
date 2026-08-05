---
phase: 16
slug: full-housing-evolution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-05
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.7 |
| **Config file** | `vitest.config.ts` (`include: ['tests/**/*.test.ts']`, `environment: 'node'`, `testTimeout: 30000`) |
| **Quick run command** | `npx vitest run tests/unit/housing-evolution.test.ts tests/unit/housing.test.ts tests/unit/housing-level-bridge.test.ts tests/unit/housing-merge.test.ts tests/integration/housing-evolution-live.test.ts tests/determinism/housing-evolution-determinism.test.ts` |
| **Full suite command** | `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` |
| **Estimated runtime** | ~40 seconds (108 files / 782 tests baseline) |

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
| 16-01-01 | 01 | 1 | HOUS-01 | — | N/A (sim, no untrusted input) | integration | `npx vitest run tests/integration/housing-evolution-live.test.ts -x` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | HOUS-01 | — | N/A | unit | `npx vitest run tests/unit/housing-level-bridge.test.ts -x` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 2 | HOUS-02 | — | N/A | unit | `npx vitest run tests/unit/housing-evolution.test.ts tests/unit/housing.test.ts -x` | ✅ extend | ⬜ pending |
| 16-02-02 | 02 | 2 | HOUS-02 | — | N/A | unit | `npx vitest run tests/unit/housing-merge.test.ts -x` | ❌ W0 | ⬜ pending |
| 16-02-03 | 02 | 2 | HOUS-02 | — | N/A | determinism | `npx vitest run tests/determinism/housing-evolution-determinism.test.ts -x` | ❌ W0 | ⬜ pending |
| 16-03-01 | 03 | 3 | HOUS-01/02 | — | N/A | golden | `npm run test:golden:update` then full suite | ✅ regenerate | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/housing-level-bridge.test.ts` — level/tier/desirability bridge (HOUS-01)
- [ ] `tests/integration/housing-evolution-live.test.ts` — 21-level progression in a live city
- [ ] `tests/unit/housing-merge.test.ts` — merge block-fit + scan-order determinism (HOUS-02)
- [ ] `tests/determinism/housing-evolution-determinism.test.ts` — merge + evolution replay byte-identity

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
