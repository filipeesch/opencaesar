---
phase: 19-persistence-options
fixed_at: 2026-08-06T12:18:15Z
review_path: .planning/phases/19-persistence-options/19-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 19: Code Review Fix Report

**Fixed at:** 2026-08-06T12:18:15Z
**Source review:** .planning/phases/19-persistence-options/19-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 2
- Fixed: 2
- Skipped: 0

**Verification (per fix scope):**
- Targeted tests: `saveCodec.test.ts` (24), `options.test.ts` (8), `save.test.ts` (11), `time.test.ts` (16), `determinism.test.ts` (9) — all green.
- `npm run typecheck` (tsc --noEmit) — clean.
- Full suite: `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --pool=threads --maxWorkers=4` — 119 files / 929 tests green (921 baseline + 6 CR-01 + 2 WR-01 new cases).
- `npm run check:military` — clean (no forbidden tokens).
- Golden fixtures: `git status --porcelain tests/golden` empty — no change; `git diff HEAD~2 -- tests/golden` empty.
- Verification ran in the **main checkout** (`workflow.use_worktrees=false` — no worktree; edits/commits made directly on `main`).

## Fixed Issues

### CR-01: `validateSave` does not validate `pendingCommands` — corrupt save bypasses both gates and can reach applyCommand's raw throw after load

**Files modified:** `src/sim/saveCodec.ts`, `tests/unit/saveCodec.test.ts`
**Commit:** `9a56cdd`
**Applied fix:** `validateSave` (saveCodec.ts) now validates `pendingCommands` with the same rigor as `commands`: a non-array returns typed `'commands-not-array'`; every member is run through `validateCommand`, mapping failures to typed `'unknown-command-kind'` / `'malformed-command'` with a human-readable reason — never a raw throw. The field is optional, so `undefined` is accepted. `fromSaveData` (runner.ts:2662) was NOT edited — the fix belongs in the codec per the CRITICAL dispatch constraint. Added 6 unit cases pinning hostile `pendingCommands` (non-array, unknown kind, NaN member, non-object member) to typed `{ok:false}`.
**Logic-verification note:** reviewer-specified behavior implemented as written (reject non-array with `'commands-not-array'`, map `validateCommand` failures to their existing typed codes). `unknown-command-kind` and `malformed-command` semantics for pendingCommands mirror the commands loop exactly.

### WR-01: Persisted options values are merged into OptionsSchema without shape/range validation — malformed-but-parseable JSON bypasses the "defaults on corrupt" guarantee

**Files modified:** `src/game/options.ts`, `tests/unit/options.test.ts`
**Commit:** `c718f1c`
**Applied fix:** Added a `sanitizeOptions` shape/range pass in `loadOptions` at the persistence boundary (the reviewer's first suggested option). Per-field: `audioMusic`/`audioSfx` clamped to [0,1] (finite-guard, else default); `textSize` whitelisted to {small,normal,large} and `graphicsQuality` to {low,medium,high} (else DEFAULT); `reducedMotion` coerced to boolean (non-boolean → default); `gameSpeedDefault` required positive-finite (else default 1). Unknown future fields are preserved via a shallow-spread corrected field-by-field, so the forward-compat contract is unaffected. Unparseable JSON still returns all defaults (existing behavior). Added 2 unit cases (parseable-but-invalid → sanitized; out-of-range numerics clamped + valid enums pass through).

## Skipped Issues

None in scope (Critical + Warning findings all fixed). Info findings below were left out of scope per the dispatch ("Fix scope: Critical + Warning findings (CR-01, WR-01)"); the dispatch marks Info as optional. They remain documented in 19-REVIEW.md with skip markers:

- **IN-01** (HUD speed row not synced with non-default `gameSpeedDefault`) — requires a cross-scene (MainScene↔HUDScene) behavior change plus an e2e check; not a targeted code fix; out of mandated CR+WR scope.
- **IN-02** (text-size CSS seams only inside `.hud`) — cosmetic CSS-only change; out of mandated CR+WR scope; low functional impact.
- **IN-03** (`e2e/settings.spec.ts` beforeEach double navigation) — test-only cleanup on a currently passing spec; re-running e2e on this loaded host risks the pre-existing flaky specs (documented in SUMMARY deviations); out of mandated CR+WR scope.
- **IN-04** (Home load button permanently disabled after rejection) — needs a retry-affordance design decision, not a targeted code fix; out of mandated CR+WR scope.

---

_Fixed: 2026-08-06T12:18:15Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
