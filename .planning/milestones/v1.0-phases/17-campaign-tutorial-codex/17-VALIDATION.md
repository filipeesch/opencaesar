---
phase: 17
slug: campaign-tutorial-codex
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-05
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.7 |
| **Config file** | `vitest.config.ts` (`include: ['tests/**/*.test.ts']`, `environment: 'node'`, `testTimeout: 30000`) |
| **Quick run command** | `npx vitest run tests/unit/campaign.test.ts tests/missions.test.ts tests/runner-accessors.test.ts -x` |
| **Full suite command** | `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` |
| **Estimated runtime** | ~45 seconds (112 files / 823 tests baseline) |

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
| 17-01-01 | 01 | 1 | CAMPAIGN-01 | — | N/A (sim, no untrusted input) | integration + determinism | `npx vitest run tests/missions.test.ts tests/runner-accessors.test.ts tests/determinism/campaign-determinism.test.ts -x` | ✅/❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | CAMPAIGN-01 | — | N/A | unit | `npx vitest run tests/missions.test.ts tests/data-catalog.test.ts -x` | ✅ extend | ⬜ pending |
| 17-02-01 | 02 | 2 | CAMPAIGN-02 | — | N/A | unit | `npx vitest run tests/unit/campaign.test.ts -x` | ✅ extend | ⬜ pending |
| 17-03-01 | 03 | 3 | CAMPAIGN-03 | — | N/A | unit | `npx vitest run tests/unit/campaign.test.ts tests/data-catalog.test.ts -x` | ✅ extend | ⬜ pending |
| 17-03-02 | 03 | 3 | CAMPAIGN-01/02/03 | — | N/A | full suite + military | `npm run typecheck && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4 && npm run check:military` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/determinism/campaign-determinism.test.ts` — mission start/save-load byte-identity + progression (CAMPAIGN-01)
- [ ] `tests/unit/campaign.test.ts` — tutorial cause-detection predicates + dismiss round-trip (CAMPAIGN-02) + codex coverage (CAMPAIGN-03)

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
