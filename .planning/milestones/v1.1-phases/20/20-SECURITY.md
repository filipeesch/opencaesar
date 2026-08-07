---
phase: 20
status: SECURED
threats_verified: 7
threats_open: 0
asvs_level: 1
block_on: high
---

# Phase 20 — UI Redesign (Caesar III Sidebar & Advisors): Security Audit

## Summary

Security audit of Phase 20 implementation against the STRIDE register in `20-PLAN.md`
(7 threats: T-20-01..T-20-07). Verification performed at ASVS L1 (grep-level pattern
presence in cited files) plus targeted placement checks for the key-router precedence
stack and the sim-core invariant gates.

**Verdict: SECURED** — 7/7 threats verified closed. Zero `innerHTML`/`outerHTML`/
`insertAdjacentHTML` in `src/game/**` + `index.html`; key-router precedence stack with
form-control focus guard; options seam sanitized and disjoint from the save envelope;
tick-change render guard; per-service hue table view-only; `.uppercase` case-only CSS
(accepted risk); `src/sim` zero-diff with golden fixtures byte-identical.

No `## Threat Flags` section in 20-SUMMARY.md — no unregistered attack surface to log.

## Threat Verification

| Threat | Category | Severity | Disposition | Status | Evidence |
|--------|----------|----------|-------------|--------|----------|
| T-20-01 | Tampering (DOM builders / XSS) | high | mitigate | CLOSED | `grep -rn 'innerHTML\|outerHTML\|insertAdjacentHTML' src/game index.html` → **0 matches**; all sim-derived strings cross via `textContent` builders — `src/game/ui/dom.ts:65,92,164,225` (el/text/clear use textContent only); legacy sites replaced (HUDScene ×5, HomeScene ×3 per SUMMARY); lock test `tests/unit/no-innerhtml.test.ts` |
| T-20-02 | Tampering (key hijack) | medium | mitigate | CLOSED | Single precedence stack in `src/game/ui/keyboard.ts:104-109` (drawer > inspector > settings > overlay-bar > build > pause fall-through); focus guard `src/game/scenes/MainScene.ts:169` (INPUT/SELECT/TEXTAREA — router stops; BUTTON deliberately unguarded so ESC-cancel still works, :165-167); key-repeat guard `MainScene.ts:172`; back-compat W/F/R/C/D/X in `KEY_MAP` `keyboard.ts:30-35`; ESC cancel-build→toggle-pause regression locked in `tests/unit/keyboard.test.ts:78-123` (+ settings/overlay-bar precedence :100-123); `e2e/keyboard.spec.ts` green |
| T-20-03 | Tampering (options seam) | medium | mitigate | CLOSED | `src/game/options.ts:33` `sanitizeOptions`; `loadOptions` sanitizes on boot `options.ts:56-58`; writes confined to `rcb.options` key (`options.ts:14,65`), disjoint from save keys; sidebar settings drawer writes only via `loadOptions`/`saveOptions`/`applyOptions` `src/game/scenes/HUDScene.ts:481,543-580`; save envelope (`save.ts`) untouched |
| T-20-04 | DoS (render loop) | low | mitigate | CLOSED | Tick-change guard `src/game/scenes/HUDScene.ts:56,172-173` (`state.tick === lastTick` → skip); advisor panel renders only under guard + on open/tab-switch `HUDScene.ts:207-210,528-529,604-611` (IN-01: active host only); `renderLog` via textContent `HUDScene.ts:757` |
| T-20-05 | DoS (overlay paint) | low | mitigate | CLOSED | `SERVICE_HUES` table `src/game/ui/overlays.ts:17-22` (fire red, danger orange, collapse brown, crime purple, food green, water blue, desirability teal); `rampFor` caches 5-band ramp `overlays.ts:59`; paint reads table via `overlayHue` `src/game/scenes/MainScene.ts:372`; legends `HUDScene.ts:725,740`; unknown id fails loud `overlays.ts:66-68` (deviation: table landed in `ui/overlays.ts` not `palette.ts` — documented in SUMMARY, equivalent, test-locked) |
| T-20-06 | Elevation (UPPERCASE) | low | accept | CLOSED (accepted risk — see Accepted Risks) | `.uppercase` utility `index.html:794-796` (text-transform: uppercase; letter-spacing: 1px — single case place); DOM text stays canonical `src/game/ui/advisorDrawer.ts:47-50`, `topbar.ts:65`, `sidebar.ts:95-101`; golden wording cases `tests/unit/uppercase-labels.test.ts`; computed-style e2e `e2e/sidebar.spec.ts:111-130` |
| T-20-07 | Tampering (sim-core invariants) | critical | mitigate | CLOSED | `git diff --stat src/sim` → **empty**; `git status --porcelain src/sim` → **empty**; `git status --porcelain tests/golden` → **empty** (byte-identical fixtures); no wall-clock/random introduced: `Math.random` hits in HomeScene.ts:58,167 are pre-existing seed generator (absent from `git diff 61d2c8c..HEAD -- HomeScene.ts`); no `Date.now`/`new Date` in phase-20 diff; date derives from `SimState.tick` only `src/game/ui/topbar.ts:47-48`, `HUDScene.ts:1061-1063`; determinism/golden suites green (SUMMARY: 129 files / 1028 tests) |

### Accepted Risks

| Threat | Risk | Rationale |
|--------|------|-----------|
| T-20-06 | `.uppercase` CSS utility makes rendered labels visually UPPERCASE while DOM text stays as-authored | Case-only CSS transform; wording byte-identical to 18-UI-SPEC (golden cases lock it); accessibility (aria-label/DOM) sees canonical wording; no functional surface affected |

## Open Items

None — 0 blocking, 0 non-blocking. `threats_open: 0`.

## Notes

- ASVS level and `block_on` threshold not declared in `.planning/config.json`; defaults applied (L1, block_on: high). All threats closed regardless, so the gate outcome is threshold-independent.
- T-20-06 disposition is `accept` per PLAN.md; documented above in the accepted-risks log (no mitigation required — grep confirms the transform lives only in CSS and DOM wording is canonical).
- E2E 3 pre-existing flakes (boots/campaign/placement-population) reproduce identically on the wave-0 baseline per SUMMARY — unrelated to any threat surface.
