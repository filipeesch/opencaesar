---
phase: 19
slug: persistence-options
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-06
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.7 (unit/integration/determinism/golden/property) + Playwright 1.62.1 (e2e) |
| **Config file** | `vitest.config.ts` (node env, `include: ['tests/**/*.test.ts']`, `testTimeout: 30000`), `playwright.config.ts` (chromium, :5173, workers 1) |
| **Quick run command** | `npx vitest run tests/unit/saveCodec.test.ts tests/unit/save.test.ts tests/unit/options.test.ts -x` |
| **Full suite command** | `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` |
| **Estimated runtime** | ~50 seconds (117 files / 889 tests baseline) |

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
| 19-00-01 | 01 | 0 | PERS-01/02 | — | N/A | unit scaffolds | `test -f tests/unit/saveCodec.test.ts && test -f tests/unit/options.test.ts && npm run typecheck` | ❌ W0 | ⬜ pending |
| 19-01-01 | 01 | 1 | PERS-01 | — | N/A | unit | `npx vitest run tests/unit/saveCodec.test.ts -x` | ❌ W0 → flip | ⬜ pending |
| 19-01-02 | 01 | 1 | PERS-01 | — | N/A | unit + determinism | `npx vitest run tests/unit/save.test.ts tests/determinism -x` | ✅ extend | ⬜ pending |
| 19-02-01 | 02 | 2 | PERS-02 | — | N/A | unit | `npx vitest run tests/unit/options.test.ts -x` | ❌ W0 → flip | ⬜ pending |
| 19-02-02 | 02 | 2 | PERS-02 | — | N/A | e2e + unit | `npx vitest run tests/unit/ui.test.ts -x && npx playwright test e2e/settings.spec.ts` | ✅/❌ | ⬜ pending |
| 19-03-01 | 03 | 3 | PERS-01/02 | — | N/A | full suite + military | `npm run typecheck && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4 && npm run check:military` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/saveCodec.test.ts` — migrateSave chain + validateSave rejection cases (PERS-01)
- [ ] `tests/unit/options.test.ts` — serialize/deserialize/merge/persistence round-trip + defaults (PERS-02)
- [ ] Extend `tests/unit/save.test.ts` — loadSavedGame read→parse→migrate→validate
- [ ] Extend a determinism suite — round-trip WITH migrate/validate in the loop
- [ ] Extend `tests/unit/ui.test.ts` / new `e2e/settings.spec.ts` — settings panel + persistence (PERS-02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Settings panel e2e | PERS-02 | Needs the browser + dev server (`npm run dev` on :5173) | `npx playwright test e2e/settings.spec.ts` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
