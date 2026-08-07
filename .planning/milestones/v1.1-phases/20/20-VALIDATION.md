---
phase: 20
slug: 20-ui-sidebar
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-07
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Reconstructed from PLAN.md verification section (State B — no VALIDATION.md existed; phase planned with PLAN.md + SPEC.md).
> Audit run 2026-08-07: every requirement row verified green against the live codebase (gates re-run, not trusted from reports).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.7 (unit/integration/determinism/golden, node env) + Playwright 1.49 (e2e, webServer `:5173`) |
| **Config file** | `vitest.config.ts` (include `tests/**/*.test.ts`, environment node) + `playwright.config.ts` |
| **Quick run command** | `npm run typecheck && npx vitest run tests/unit/sidebar-controls.test.ts tests/unit/sidebar-layout.test.ts tests/unit/overlay-hues.test.ts tests/unit/advisor-drawer.test.ts tests/unit/keyboard.test.ts tests/unit/uppercase-labels.test.ts tests/unit/no-innerhtml.test.ts tests/unit/ui.test.ts tests/unit/inspector.test.ts` |
| **Full suite command** | `npm run typecheck && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4 && npx playwright test e2e/sidebar.spec.ts e2e/keyboard.spec.ts e2e/inspect.spec.ts e2e/management-ui.spec.ts` |
| **Estimated runtime** | ~90s vitest (129 files / 1028 tests) + ~50s Playwright (28 tests) |

> **Known infra artifact (pre-existing, documented in 20-VERIFICATION.md):** the full vitest run exits 1 with 2–3
> post-run worker RPC teardown timeouts (`[vitest-worker]: Timeout calling "onTaskUpdate"`) after ALL 129 files /
> 1028 tests have already passed. Reproduces on `--maxWorkers=4/2/1` and `--pool=forks`; counts vary between
> identical runs (3 → 2). Not a test failure — 1028/1028 green, verified 4× during this audit.

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck` + the affected spec(s)
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 140 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-00-01 | 20 | 0 | UI-RED-01, 02, 04, 06, 08 | T-20-01 | RED scaffolds: sidebar/topbar DOM contract, per-service hues, 13-tab drawer, no-innerHTML audit | unit + e2e | `npx vitest run tests/unit/sidebar-controls.test.ts tests/unit/sidebar-layout.test.ts tests/unit/overlay-hues.test.ts tests/unit/advisor-drawer.test.ts && npx playwright test e2e/sidebar.spec.ts e2e/keyboard.spec.ts` | ✅ | ✅ green |
| 20-01-01 | 20 | 1 | UI-RED-01 | T-20-03 | Sidebar hub (build panel, tools, speed, advisor button, overlay group) wires every control to an existing runner seam — no orphan controls | unit + e2e | `npx vitest run tests/unit/sidebar-controls.test.ts && npx playwright test e2e/sidebar.spec.ts` | ✅ | ✅ green |
| 20-01-02 | 20 | 1 | UI-RED-01, 08 | T-20-01 | Top status bar (population/date/treasury/ratings) with verbatim labels; old top-HUD removed; zero innerHTML in src/game + index.html | unit + e2e + audit | `npx vitest run tests/unit/sidebar-layout.test.ts tests/unit/no-innerhtml.test.ts && grep -rn 'innerHTML' src/game index.html | wc -l` | ✅ | ✅ green |
| 20-02-01 | 20 | 2 | UI-RED-02, 03 | T-20-04 | Advisor drawer: 13 tabs in ADVISOR_TAB_ORDER, live data via advisorPanels(runner), tick-change re-render, verbatim empty states | unit + e2e | `npx vitest run tests/unit/advisor-drawer.test.ts && npx playwright test e2e/sidebar.spec.ts` | ✅ | ✅ green |
| 20-02-02 | 20 | 2 | UI-RED-03, 07 + UI-FIX-01 | T-20-02 | Key router: A cycles advisors, ←/→ switch panels, Escape closes surfaces first, B build panel, 1-5 overlays; precedence drawer > inspector > settings > overlay-bar > build > pause; existing ESC/W/F/R/C/D/X regression-locked | unit + e2e | `npx vitest run tests/unit/keyboard.test.ts tests/unit/ui.test.ts && npx playwright test e2e/keyboard.spec.ts` | ✅ | ✅ green |
| 20-03-01 | 20 | 3 | UI-RED-04 + UI-FIX-02 | T-20-05 | Per-service hue table (fire red, danger orange, collapse brown, crime purple, food green, water blue, desirability teal), 5-band ramps, legends, click-through to emitInspect | unit + e2e | `npx vitest run tests/unit/overlay-hues.test.ts tests/unit/water-overlay.test.ts && npx playwright test e2e/management-ui.spec.ts` | ✅ | ✅ green |
| 20-03-02 | 20 | 3 | UI-RED-06 + UI-FIX-03 | T-20-06 | UPPERCASE via .uppercase CSS utility (text-transform + 1px letter-spacing); DOM text stays canonical 18-UI-SPEC wording | unit + e2e | `npx vitest run tests/unit/uppercase-labels.test.ts tests/unit/ui.test.ts && npx playwright test e2e/sidebar.spec.ts` | ✅ | ✅ green |
| 20-04-01 | 20 | 4 | UI-RED-05 | T-20-02 | Sidebar inspector cards via getInspector/getWalkerInternals, close × + Next/Prev same-kind cycling, ←/→ + Escape key-router precedence | unit + e2e | `npx vitest run tests/unit/inspector.test.ts tests/unit/inspector-id-collision.test.ts && npx playwright test e2e/inspect.spec.ts e2e/keyboard.spec.ts` | ✅ | ✅ green |
| 20-05-01 | 20 | 5 | UI-RED-01..08, UI-FIX-01..03 | T-20-07 | Close gates: typecheck, full vitest, full e2e, innerHTML grep = 0, goldens porcelain empty, src/sim zero-diff | full suite + audit | `npm run typecheck && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4 && npx playwright test && grep -rn 'innerHTML' src/game index.html | wc -l && git status --porcelain tests/golden && git diff --stat src/sim` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Requirement Verification Map

All 11 phase requirements mapped to green automated tests (verified 2026-08-07 — every command re-run in this audit):

| Requirement | Test File(s) | Automated Command | Status |
|-------------|--------------|-------------------|--------|
| UI-RED-01 — sidebar hub replaces top HUD | `tests/unit/sidebar-controls.test.ts` (7), `tests/unit/sidebar-layout.test.ts` (6), `e2e/sidebar.spec.ts` (4) | `npx vitest run tests/unit/sidebar-controls.test.ts tests/unit/sidebar-layout.test.ts && npx playwright test e2e/sidebar.spec.ts` | ✅ green |
| UI-RED-02 — advisor drawer, live data | `tests/unit/advisor-drawer.test.ts` (5), `e2e/sidebar.spec.ts` (3) | `npx vitest run tests/unit/advisor-drawer.test.ts && npx playwright test e2e/sidebar.spec.ts` | ✅ green |
| UI-RED-03 — keyboard-first navigation | `tests/unit/keyboard.test.ts` (10), `e2e/keyboard.spec.ts` (7) | `npx vitest run tests/unit/keyboard.test.ts && npx playwright test e2e/keyboard.spec.ts` | ✅ green |
| UI-RED-04 — per-service overlay hues + legends | `tests/unit/overlay-hues.test.ts` (8), `e2e/management-ui.spec.ts` (9) | `npx vitest run tests/unit/overlay-hues.test.ts && npx playwright test e2e/management-ui.spec.ts` | ✅ green |
| UI-RED-05 — sidebar inspectors | `tests/unit/inspector.test.ts` (12), `e2e/inspect.spec.ts` (8) | `npx vitest run tests/unit/inspector.test.ts && npx playwright test e2e/inspect.spec.ts` | ✅ green |
| UI-RED-06 — UPPERCASE labels | `tests/unit/uppercase-labels.test.ts` (6), `e2e/sidebar.spec.ts` (4) | `npx vitest run tests/unit/uppercase-labels.test.ts && npx playwright test e2e/sidebar.spec.ts` | ✅ green |
| UI-RED-07 — precedence-safe bindings | `tests/unit/keyboard.test.ts` (10), `e2e/keyboard.spec.ts` (7) | `npx vitest run tests/unit/keyboard.test.ts && npx playwright test e2e/keyboard.spec.ts` | ✅ green |
| UI-RED-08 — XSS-safe DOM: no innerHTML | `tests/unit/no-innerhtml.test.ts` (5) + grep audit | `npx vitest run tests/unit/no-innerhtml.test.ts && grep -rn 'innerHTML' src/game index.html | wc -l` | ✅ green |
| UI-FIX-01 — A/←/→ keyboard bindings applied | `tests/unit/keyboard.test.ts` (10), `e2e/keyboard.spec.ts` (7) | `npx vitest run tests/unit/keyboard.test.ts && npx playwright test e2e/keyboard.spec.ts` | ✅ green |
| UI-FIX-02 — per-service coverage hues | `tests/unit/overlay-hues.test.ts` (8), `e2e/management-ui.spec.ts` (9) | `npx vitest run tests/unit/overlay-hues.test.ts && npx playwright test e2e/management-ui.spec.ts` | ✅ green |
| UI-FIX-03 — UPPERCASE + letter-spacing | `tests/unit/uppercase-labels.test.ts` (6), `e2e/sidebar.spec.ts` (4) | `npx vitest run tests/unit/uppercase-labels.test.ts && npx playwright test e2e/sidebar.spec.ts` | ✅ green |

Audit-run evidence (2026-08-07): typecheck clean · vitest **129 files / 1028 tests green** (4× re-run, deterministic; post-run worker RPC teardown timeouts are the pre-existing infra artifact documented in 20-VERIFICATION.md) · Playwright **28/28 green** (sidebar 4, keyboard 7, inspect 8, management-ui 9) · `grep -rn 'innerHTML' src/game index.html` = **0** · `git status --porcelain tests/golden` = **empty** · `git diff --stat src/sim` = **empty**.

---

## Wave 0 Requirements

- [x] `tests/unit/sidebar-controls.test.ts` — sidebar hub + control→seam contract (UI-RED-01)
- [x] `tests/unit/sidebar-layout.test.ts` — top status bar fields + date derivation (UI-RED-01/02)
- [x] `tests/unit/overlay-hues.test.ts` — SERVICE_HUES table + 5-band ramps + risk resolution (UI-RED-04/UI-FIX-02)
- [x] `tests/unit/advisor-drawer.test.ts` — 13 tabs + runner feeds + open/close contract (UI-RED-02)
- [x] `tests/unit/keyboard.test.ts` — key map + precedence chain (UI-RED-03/07, UI-FIX-01)
- [x] `tests/unit/uppercase-labels.test.ts` — .uppercase class + canonical wording goldens (UI-RED-06/UI-FIX-03)
- [x] `tests/unit/no-innerhtml.test.ts` — source audit for innerHTML/outerHTML/insertAdjacentHTML (UI-RED-08)
- [x] `tests/unit/ui.test.ts` — key-router/label regression + legacy ui suites
- [x] `tests/unit/inspector.test.ts` — inspector card builder + cycling nav rules (UI-RED-05)
- [x] `e2e/sidebar.spec.ts` (4), `e2e/keyboard.spec.ts` (7), `e2e/inspect.spec.ts` (8), `e2e/management-ui.spec.ts` (9) — Playwright coverage

*Scaffolds committed in Wave 0 (a84c1d5); all RED → green during execution; no Wave 0 gaps.*

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 140s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-07
