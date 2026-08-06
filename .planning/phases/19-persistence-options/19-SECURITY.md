---
phase: 19
slug: persistence-options
status: secured
audited: 2026-08-06
asvs_level: 1
threats_open: 0
block_on: high
---

# Phase 19 — Security Audit (Persistence & Options)

## Threat Register

| Threat ID | Category | Severity | Disposition | Evidence |
|-----------|----------|----------|-------------|----------|
| T-19-01 | Tampering (corrupt/hostile save) | high | mitigate | `migrateSave` typed `SaveCodecError`; `validateSave` full-union, never throws, typed `{ok:false,error,reason}`; CR-01 fix: `pendingCommands` validated with same rigor as `commands`. `loadSavedGame` read→parse→migrate→validate. Both entry points gated (HomeScene click-through only `{ok:true}`→start + textContent rejection; MainScene `validatedRunnerFromSave` defense-in-depth). `runner.ts:2662 fromSaveData` untouched. |
| T-19-02 | Tampering (DOM XSS) | high | mitigate | Load rejection via `loadBtn.textContent`; Settings drawer built entirely with `createElement`+`textContent`; e2e asserts zero page/console errors; grep confirms no variable-interpolated `innerHTML`. |
| T-19-03 | DoS (oversized/malformed save) | medium | mitigate | `validateSave` bounds commands/pendingCommands to arrays of known kinds; linear loops, no recursion; rejected saves never parsed on replay (JSON.parse in try/catch). |
| T-19-04 | Tampering (golden-byte/options-disjointness) | high | mitigate | `rcb.options` disjoint from `rcb.save`/quicksave/autosave keys; `applyOptions` touches view/shell only; `git status --porcelain tests/golden` empty; no getStateJson/SaveData shape change. |
| T-19-05 | Tampering (boot seams) | medium | mitigate | Options read before `new Phaser.Game`; graphicsQuality→RenderConfig mapping; `gameSpeedDefault` applied exactly once in `create()` (fresh+loaded) with positive-finite guard. |
| T-19-06 | Tampering (corrupt options) | low | mitigate | `loadOptions` try/catch → DEFAULT_OPTIONS; WR-01 fix: `sanitizeOptions` clamps audio to [0,1], whitelists textSize/graphicsQuality, coerces reducedMotion to boolean, requires gameSpeedDefault positive-finite. |
| T-19-SC | Tampering (packages) | low | accept | No packages installed this phase (package.json/lock diff empty); accepted disposition. |

## Accepted Risks

- **T-19-SC (supply chain):** no new dependencies were installed in Phase 19; the accept disposition documented in the plan register holds.

## Note (non-finding)

A huge-but-finite `mapSize` propagating into `fromSaveData` map generation is a pre-existing `fromSaveData` characteristic outside the declared T-19-03 scope; `fromSaveData` remains byte-identical. Recorded for traceability only.

## Verdict

**SECURED** — all 7 registered threats verified CLOSED with implementation evidence. `threats_open: 0`. No implementation files modified by the audit.
