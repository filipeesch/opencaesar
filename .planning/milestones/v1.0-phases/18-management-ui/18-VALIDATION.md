---
phase: 18
slug: management-ui
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-05
nyquist_audited: 2026-08-06
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.7 (unit/integration/determinism/golden/property) + Playwright 1.62.1 (e2e) |
| **Config file** | `vitest.config.ts` (node env, `include: ['tests/**/*.test.ts']`, `testTimeout: 30000`), `playwright.config.ts` (chromium, :5173, workers 1) |
| **Quick run command** | `npx vitest run tests/unit/advisors.test.ts tests/unit/water-overlay.test.ts tests/unit/advisor-composer.test.ts --bail 1` |
| **Full suite command** | `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` (+ `npm run test:e2e` for browser flows) |
| **Estimated runtime** | ~80 seconds (117 files / 889 tests post-phase; auditor re-run green)

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
| 18-00-01 | 01 | 0 | UI-01..04 | — | N/A | e2e scaffold | `npx playwright test e2e/management-ui.spec.ts` | ✅ | ✅ green |
| 18-01-01 | 01 | 1 | UI-01 | — | N/A | e2e + unit | `npm run test:unit -- tests/unit/advisor-composer.test.ts && npx playwright test e2e/management-ui.spec.ts` | ✅ | ✅ green |
| 18-02-01 | 02 | 2 | UI-02 | — | N/A | unit | `npx vitest run tests/unit/advisor-composer.test.ts --bail 1` | ✅ | ✅ green |
| 18-03-01 | 03 | 3 | UI-03 | — | N/A | unit | `npx vitest run tests/unit/water-overlay.test.ts --bail 1` | ✅ | ✅ green |
| 18-03-02 | 03 | 3 | UI-03/04 | — | N/A | unit + e2e | `npx vitest run tests/unit/advisors.test.ts --bail 1 && npx playwright test e2e/management-ui.spec.ts` | ✅ extend | ✅ green |
| 18-04-01 | 04 | 4 | UI-04 | — | N/A | unit | `npx vitest run tests/unit/advisors.test.ts tests/unit/inspector-id-collision.test.ts --bail 1` | ✅ extend | ✅ green |
| 18-05-01 | 05 | 4 | UI-01..04 | — | N/A | full suite + military | `npm run typecheck && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4 && npm run check:military` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Auditor note (2026-08-06):** the `-x` flag in the original commands is not supported by this repo's vitest 3.2.7 (unknown option) — corrected to `--bail 1` in the map above; the corrected commands are what was re-run and confirmed green. The full-suite run surfaces 2 `Timeout calling "onTaskUpdate"` vitest worker-RPC infra errors with 0 test failures (117 files / 889 tests passed) — the same documented artifact in 18-SUMMARY; not a validation gap.

---

## Wave 0 Requirements

- [x] `e2e/management-ui.spec.ts` — new control bar, advisors drawer, overlay toggles, inspector open (UI-01..04)
- [x] `tests/unit/advisor-composer.test.ts` — 13-advisor composer over live getters (UI-02)
- [x] `tests/unit/water-overlay.test.ts` — `getWaterOverlay()` aggregates multiple wells; grids width×height (UI-03)
- [x] Extend `tests/unit/advisors.test.ts` inspectors block — enriched pure inspections (UI-04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Playwright e2e runs with dev server | UI-01..04 | Needs the browser + dev server (`npm run dev` on :5173) | `npm run test:e2e` against the local server |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s (bounded by suite runtime, not feedback loop)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-06 — all 7 tasks `.planning/phases/18-management-ui/18-VALIDATION.md` map rows green; `-x`→`--bail 1` command correction applied (see auditor note); golden/determinism byte-identical.

### Re-audit evidence (2026-08-06)

| Task | Command | Result |
|------|---------|--------|
| 18-00-01 / 18-01-01 (e2e) | `npx playwright test e2e/management-ui.spec.ts` | 7/7 passed |
| 18-02-01 | `npx vitest run tests/unit/advisor-composer.test.ts --bail 1` | 5/5 passed |
| 18-03-01 | `npx vitest run tests/unit/water-overlay.test.ts --bail 1` | 6/6 passed |
| 18-03-02 / 18-04-01 | `npx vitest run tests/unit/advisors.test.ts tests/unit/inspector-id-collision.test.ts --bail 1` | 21/21 + 5/5 passed |
| 18-04-01 (e2e) | `npx playwright test e2e/inspect.spec.ts` | 7/7 passed |
| 18-05-01 | `npm run typecheck && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4 && npm run check:military` | typecheck 0, 117 files / 889 tests passed, military clean |
| Golden contract | `git status --porcelain tests/golden` + `npx vitest run tests/golden tests/determinism` | empty diff; 76/76 passed |
