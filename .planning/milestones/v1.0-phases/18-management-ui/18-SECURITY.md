---
phase: 18
slug: management-ui
status: secured
audited: 2026-08-06
asvs_level: 1
threats_open: 0
block_on: high
---

# Phase 18 — Security Audit (Management UI)

## Threat Register

| Threat ID | Category | Severity | Disposition | Evidence |
|-----------|----------|----------|-------------|----------|
| T-18-01 | Tampering (DOM injection) | high | mitigate | No `innerHTML` interpolation of sim data; all new surfaces use `createElement`+`textContent` (renderAdvisor, renderOverlayLegend, renderInspectorShell, renderWalkerInspector, renderPopup). Pre-existing `stats/policy/overlay.innerHTML` unchanged; base `popup.innerHTML` replaced with textContent-backed shell. e2e no-decorative + zero-page-errors gate. |
| T-18-02 | Tampering (view recomputes sim) | high | mitigate | All values flow from runner getters / pure projections; composer reads only getters, overlay consumes pure grids, inspectors feed `getInspector`+`*Inspection` projections. Provenance forced by advisor-composer.test.ts. |
| T-18-03 | Tampering (golden-byte / serialized growth) | high | mitigate | `getInspector(id, kind)` + `getWalkerInternals()` are read-only seams; `toBuildingState`/`toWalkerState` untouched; `BuildingState`/`WalkerState` not grown; `git status --porcelain tests/golden` empty. |
| T-18-04 | DoS (overlay hijacks camera/click) | medium | mitigate | `overlayGfx.setDepth(1)` below building depths, no `setInteractive` — cannot intercept events; pointer/wheel handlers byte-identical to base; e2e "camera wheel-zoom keeps working while overlay active". |
| T-18-05 | Tampering (water % divergence) | medium | mitigate | `getWaterOverlay()` + `derivedSnapshot()` share `liveWaterSources()` — all well/fountain sources aggregated, fountain→fountainCoverage; water-overlay tests 6/6. |
| T-18-06 | Tampering (fabricated/string-keyed advisor) | medium | mitigate | Composer maps by actual getter names; single `advisorsFrom(snapshot)`; advisor-composer tests assert 13 panels, live value tracing, empty-city totality. |
| T-18-07 | Tampering (non-determinism in new getters) | high | mitigate | Zero `Math.random`/`Date.now`/`new Date` added in src/ (runner.ts:2642 is pre-existing getSaveData); getWaterOverlay/getInspector/getDesirabilityOverlay are pure read-only functions; determinism/golden suites green. |
| T-18-SC | Tampering (supply chain) | low | accept | No packages installed this phase (no package.json/lock diff since base); accepted risk recorded. |

## Accepted Risks

- **T-18-SC (supply chain):** no new dependencies were installed in Phase 18; the accept disposition documented in the plan register holds.

## Informational Flag

- `SimRunner.getDesirabilityOverlay()` (added as the WR-05 fix) is a new read-only deterministic getter not explicitly named in the register. It falls within the T-18-07 (pure/deterministic new getters) and T-18-02 (getter-fed view) mitigation classes — informational only, not a blocker.

## Verdict

**SECURED** — all 8 registered threats verified CLOSED with implementation evidence. `threats_open: 0`, `block_on: high`. No implementation files modified by the audit.
