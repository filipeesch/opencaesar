---
phase: 18
slug: management-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-05
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.7 (unit/integration/determinism/golden/property) + Playwright 1.62.1 (e2e) |
| **Config file** | `vitest.config.ts` (node env, `include: ['tests/**/*.test.ts']`, `testTimeout: 30000`), `playwright.config.ts` (chromium, :5173, workers 1) |
| **Quick run command** | `npx vitest run tests/unit/advisors.test.ts tests/unit/water-overlay.test.ts tests/unit/advisor-composer.test.ts -x` |
| **Full suite command** | `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` (+ `npm run test:e2e` for browser flows) |
| **Estimated runtime** | ~50 seconds (114 files / 870 tests baseline) |

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
| 18-00-01 | 01 | 0 | UI-01..04 | — | N/A | e2e scaffold | `npx playwright test e2e/management-ui.spec.ts` | ❌ W0 | ⬜ pending |
| 18-01-01 | 01 | 1 | UI-01 | — | N/A | e2e + unit | `npm run test:unit -- tests/unit/advisor-composer.test.ts && npx playwright test e2e/management-ui.spec.ts` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 2 | UI-02 | — | N/A | unit | `npx vitest run tests/unit/advisor-composer.test.ts -x` | ❌ W0 | ⬜ pending |
| 18-03-01 | 03 | 3 | UI-03 | — | N/A | unit | `npx vitest run tests/unit/water-overlay.test.ts -x` | ❌ W0 | ⬜ pending |
| 18-03-02 | 03 | 3 | UI-03/04 | — | N/A | unit + e2e | `npx vitest run tests/unit/advisors.test.ts -x && npx playwright test e2e/management-ui.spec.ts` | ✅ extend | ⬜ pending |
| 18-04-01 | 04 | 4 | UI-04 | — | N/A | unit | `npx vitest run tests/unit/advisors.test.ts -x` | ✅ extend | ⬜ pending |
| 18-05-01 | 05 | 4 | UI-01..04 | — | N/A | full suite + military | `npm run typecheck && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4 && npm run check:military` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `e2e/management-ui.spec.ts` — new control bar, advisors drawer, overlay toggles, inspector open (UI-01..04)
- [ ] `tests/unit/advisor-composer.test.ts` — 13-advisor composer over live getters (UI-02)
- [ ] `tests/unit/water-overlay.test.ts` — `getWaterOverlay()` aggregates multiple wells; grids width×height (UI-03)
- [ ] Extend `tests/unit/advisors.test.ts` inspectors block — enriched pure inspections (UI-04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Playwright e2e runs with dev server | UI-01..04 | Needs the browser + dev server (`npm run dev` on :5173) | `npm run test:e2e` against the local server |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
