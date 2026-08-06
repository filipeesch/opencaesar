---
phase: 19-persistence-options
verified: 2026-08-06T13:30:00Z
status: passed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 19: Persistence & Options Verification Report

**Phase Goal (ROADMAP):** Versioned save/load for all systems and options/accessibility.
**Verified:** 2026-08-06T13:30:00Z
**Status:** passed
**Score:** 6/6 must-haves verified (behaviorally)
**Re-verification:** No — initial verification.

## Goal Achievement

The phase goal is observably true in the codebase. Success criteria from ROADMAP:

1. **Saves round-trip deterministically with migration and validation.** `src/sim/saveCodec.ts` (SAVE_VERSION=1, additive empty MIGRATIONS, typed migrateSave, full-union validateSave incl. the CR-01 `pendingCommands` gate) sits between the storage read and `SimRunner.fromSaveData` at BOTH the HomeScene click-through and MainScene.create() defense-in-depth. The determinism suite routes the save through migrate+validate in the loop and asserts byte-identical `getStateJson()`. All verified independently (unit + e2e, run below).
2. **Graphics/audio/gameplay/accessibility options are functional and persisted.** `src/game/options.ts` (OPTIONS_KEY `rcb.options`, disjoint from save keys, forward-compat merge, WR-01 sanitize), boot RenderConfig mapping read before `new Phaser.Game`, `gameSpeedDefault` applied once at MainScene boot, body[data-text-size]/[data-reduced-motion] CSS seams, thin audio mix seam, and a Phase-18-pattern Settings drawer that edits + persists with an 'Options saved' toast. `e2e/settings.spec.ts` proves a toggled option survives `page.reload()`.

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | PERS-01: existing/corrupt/unknown-version saves are migrated additively (v1 current, empty MIGRATIONS) or rejected with a typed reason — never a raw 'unknown command kind' throw, never a silent NaN misload | ✓ VERIFIED | `validateSave` (saveCodec.ts) returns typed `{ok:false,error,reason}` for non-finite seed/mapSize/tickCount, non-array commands, unknown kind, malformed command (union-covered), and now hostile `pendingCommands` (CR-01) — never throws. `saveCodec.test.ts` (24 tests) incl. 'never throws' + hostile-pendingCommands cases. Round-trip WITH codec in loop byte-identical. |
| 2 | PERS-01: load path runs read→parse→migrate→validate BEFORE replay at HomeScene click-through AND MainScene.create() defense-in-depth; version 1 stays current; determinism suite embeds the migration/validation loop | ✓ VERIFIED | `loadSavedGame()` (save.ts:117-140) implements the chain with typed LoadResult; HomeScene routes only `{ok:true}` to `scene.start('Main',{save})` and surfaces 'Save rejected: reason' via textContent; MainScene.validatedRunnerFromSave re-validates before `fromSaveData`, toasts + fresh-seed fallback. save.test.ts (11 tests incl. 5 loadSavedGame cases) + e2e 'save from pause, restart, load resumes' passes. fromSaveData (runner.ts:2662) NOT edited (git diff empty). |
| 3 | PERS-02: options persisted under rcb.options (disjoint from rcb.save), load forward-compat merged with defaults (unknown future fields preserved), graphicsQuality maps to Phaser RenderConfig at Game construction in main.ts (context-creation-only) | ✓ VERIFIED | options.ts (8 tests: round-trip, defaults, corrupt→defaults, partial merge, forward-compat unknown-field preserve, sanitize WR-01). main.ts calls `loadOptions()` BEFORE `new Phaser.Game` and maps low→antialias:false+roundPixels:true / high→antialias:true / medium→defaults. Test asserts options store never touches 'rcb.save'. |
| 4 | PERS-02: gameSpeedDefault applied exactly once in MainScene.create() for both fresh+loaded via setSpeed(loadOptions().gameSpeedDefault); HUD [0.5,1,2,4,8] buttons override afterward; never re-applied per tick | ✓ VERIFIED | MainScene.create() (lines 89-98) applies boot speed once with a positive-finite guard; HUD speed buttons (HUDScene.ts:459-466) call setSpeed after. time.test.ts boot-default-speed cases (16 tests total): default applied, later explicit setSpeed(8) wins (once-only semantics). |
| 5 | PERS-02: text-size/small-normal-large + reduced-motion applied via body data-attrs + index.html CSS seams; audio music/SFX mixes persisted + applied via audio.ts seam; Settings drawer (controls-settings) edits + persists with 'Options saved' toast | ✓ VERIFIED | applyOptions sets body[data-text-size]/[data-reduced-motion] + setMusicVolume/setSfxVolume (audio.ts mix seam). index.html CSS seams at lines 266-319. HUDScene settings drawer (six opt-* controls, pre-filled from loadOptions, settings-save → saveOptions+applyOptions+toast). e2e/settings.spec.ts (4 tests, all pass): defaults, toggle+toast, **persist-across-reload**, zero page/console errors. |
| 6 | Volatile metadata: no SaveData/getStateJson shape change, options NEVER in SaveData/getStateJson, goldens untouched, phase closes with full suite + typecheck + check:military green | ✓ VERIFIED | `git diff bdb433a^..605a147 -- src/sim/types.ts` empty; `git diff … -- tests/golden` empty; `git status --porcelain tests/golden` clean; options.ts/audio.ts are view/shell-only (never imported by sim core). Ran full vitest 119 files/929 tests green, `npm run typecheck` clean, `check:military` clean. |

**Score:** 6/6 truths verified; 0 present-but-behavior-unverified.

### Deferred Items

None. The only deferred work (full audio assets §48, end-state UI redesign Phase 20) is out of the success criteria and documented in the SUMMARY; the four REVIEW info findings (IN-01..IN-04) are cosmetic/out-of-mandated-scope and documented in 19-REVIEW.md — none block the phase goal.

### Required Artifacts

All 15 artifacts from the PLAN (gsd-tools `verify.artifacts`: **15/15 passed**):

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/sim/saveCodec.ts` | Pure codec: SAVE_VERSION, SaveCodecError, MIGRATIONS, migrateSave, SaveValidationError, validateSave | ✓ VERIFIED | 224 lines; full union validation incl. pendingCommands (CR-01); no Math.random/Date.now |
| `src/game/save.ts` | LoadResult + loadSavedGame read→parse→migrate→validate; export defaultStorage | ✓ VERIFIED | 187 lines; typed LoadResult; readSave/listSaves stay tolerant meta-listing |
| `src/game/options.ts` | OPTIONS_KEY rcb.options; load/save/applyOptions reusing ui.ts codec + save.ts StorageLike; sanitizeOptions (WR-01) | ✓ VERIFIED | 86 lines; defaults/forward-compat/sanitize; never touches sim |
| `src/game/audio.ts` | Thin no-asset mix seam setMusicVolume/setSfxVolume/play | ✓ VERIFIED | 30 lines; per-bus multipliers; play() no-op until §48 |
| `src/game/main.ts` | loadOptions() BEFORE new Phaser.Game; graphicsQuality→RenderConfig; applyOptions once | ✓ VERIFIED | 42 lines; render config context-creation-only |
| `src/game/scenes/MainScene.ts` | create() validates/migrates save (defense-in-depth); gameSpeedDefault once | ✓ VERIFIED | validatedRunnerFromSave + boot speed with finite guard |
| `src/game/scenes/HomeScene.ts` | Load click-through via loadSavedGame(); rejection disables + reason textContent | ✓ VERIFIED | Only {ok:true} starts Main; 'Save rejected:' via textContent |
| `src/game/scenes/HUDScene.ts` | 4th control-bar button controls-settings; settings-drawer with six opt-* controls; save+toast; off() cleanup | ✓ VERIFIED | Full drawer build, fillSettingsControls, saveSettings (saveOptions+applyOptions+toast); SHUTDOWN off() |
| `index.html` | body[data-text-size]/[data-reduced-motion] CSS seams + .settings-drawer block | ✓ VERIFIED | Seams at lines 266-319 |
| `tests/unit/saveCodec.test.ts` | 24 tests (migrate + validate + pendingCommands + codec-in-loop) | ✓ VERIFIED | Pass (24/24) |
| `tests/unit/options.test.ts` | 8 tests (round-trip, defaults, corrupt, merge, forward-compat, sanitize) | ✓ VERIFIED | Pass (8/8) |
| `tests/unit/save.test.ts` | Extended with 5 loadSavedGame cases | ✓ VERIFIED | Pass (11/11) |
| `tests/determinism/determinism.test.ts` | Seed round-trip routes through migrateSave+validateSave | ✓ VERIFIED | Pass (9/9); byte-identical |
| `tests/unit/time.test.ts` | Extended boot-default-speed cases (default applied; explicit setSpeed wins) | ✓ VERIFIED | Pass (16/16) |
| `e2e/settings.spec.ts` | 4 settings tests incl. persist-across-reload | ✓ VERIFIED | Pass (4/4) |

### Key Link Verification

gsd-tools reports the PLAN's key_links as prose (0 structured), so links verified manually:

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| loadSavedGame() | saveCodec | read→parse→migrate→validate | WIRED | save.ts imports migrateSave/SaveCodecError/validateSave |
| HomeScene/MainScene | fromSaveData | validated entry gates inserted before replay | WIRED | HomeScene.loadSavedGame → scene.start; MainScene.validatedRunnerFromSave → SimRunner.fromSaveData |
| options.ts | ui.ts codec + save.ts storage | deserialize/merge/serialize/DEFAULT_OPTIONS + StorageLike/SaveResult/defaultStorage | WIRED | Reuses existing layers; OPTIONS_KEY disjoint from SAVE_KEY/QUICKSAVE_KEY/AUTOSAVE_PREFIX |
| main.ts | options.ts | loadOptions() BEFORE new Phaser.Game → RenderConfig | WIRED | graphicsQuality ternary maps to render config; drawer notes applies-on-next-launch |
| MainScene | options.ts ↔ time.ts | gameSpeedDefault → setSpeed once | WIRED | create() calls setSpeed(loadOptions().gameSpeedDefault) once; HUD speed buttons override later |
| applyOptions | index.html CSS | body[data-text-size]/[data-reduced-motion] seams | WIRED | e2e proves body attrs set + persist across reload |
| options | SaveData/getStateJson | golden-byte invariant | WIRED | options never enter sim state; goldens clean |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Settings drawer (HUDScene) | opt-* control values | `loadOptions()` ← localStorage rcb.options | Yes (persisted; e2e proves toggled value survives reload and re-populates drawer + body attrs) | ✓ FLOWING |
| Home load button | label + enabled state | `listSaves()` + `loadSavedGame()` | Yes (real save meta from rcb.save; rejection reason from codec) | ✓ FLOWING |
| SimRunner at boot / after load | seed / save state | MainScene runtimeConfig (new seed or validated save) | Yes (byte-identical replay proven) | ✓ FLOWING |

### Behavioral Spot-Checks (all executed in this verification)

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Codec: migrate pass-through + version bounds + rejections never throw | `npx vitest run saveCodec.test.ts` | 24/24 pass | ✓ PASS |
| Options store: round-trip/defaults/corrupt/merge/forward-compat/sanitize | `npx vitest run options.test.ts` | 8/8 pass | ✓ PASS |
| Load path: read→parse→migrate→validate, typed failures | `npx vitest run save.test.ts` | 11/11 pass | ✓ PASS |
| Boot default speed once (+ RangeError contract preserved) | `npx vitest run time.test.ts` | 16/16 pass | ✓ PASS |
| Determinism byte-identity with codec in loop | `npx vitest run determinism.test.ts` | 9/9 pass | ✓ PASS |
| Full suite green | `NODE_OPTIONS=…4096 npx vitest run --pool=threads --maxWorkers=4` | 119 files / 929 tests pass | ✓ PASS |
| Typecheck clean | `npm run typecheck` | exit 0 | ✓ PASS |
| Military check | `npm run check:military` | clean | ✓ PASS |
| e2e: save→restart→load resumes (codec in real flow) + settings persist across reload | `npx playwright test e2e/sessions.spec.ts e2e/settings.spec.ts` | 10/10 pass | ✓ PASS |
| Golden fixtures unchanged | `git status --porcelain tests/golden` · `git diff … -- tests/golden` | empty / empty | ✓ PASS |

### Probe Execution

Step 7c: **SKIPPED** — no `scripts/*/tests/probe-*.sh` conventions exist for this phase (it is a game-feature phase whose gates are the test suites above, all executed). No phase-declared probe scripts.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| PERS-01 | 19-PLAN | Versioned save/load migration covering all systems with validation and deterministic reload | ✓ SATISFIED | saveCodec.ts + loadSavedGame + dual gates + determinism codec-in-loop; unit (24+11) + e2e (sessions) all green |
| PERS-02 | 19-PLAN | Options and accessibility (graphics, audio, gameplay, accessibility) | ✓ SATISFIED | options.ts + audio.ts + boot RenderConfig + gameSpeedDefault + CSS seams + Settings drawer; options (8) + time (3 boot-speed) + settings e2e (4) green |

No orphaned requirements for Phase 19 (both PERS-01/PERS-02 claimed and both satisfied).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No TBD/FIXME/XXX debt markers in any phase-created/modified source or test file | ℹ️ None | Clean |
| — | — | innerHTML usage in HUDScene/HomeScene is static templates only (no localStorage/options/sim-derived interpolation); load-rejection reason, toasts, advisor/settings values via textContent | ℹ️ None | No XSS path |
| — | — | No Math.random/Date.now/new Date in any phase-changed sim/options/audio chain (grep verified, comment-only line about the determinism rule) | ℹ️ None | Byte-identity preserved |
| — | — | `git diff bdb433a^..605a147` shows types.ts and runner.ts untouched; goldens clean | ℹ️ None | No shape/behavior regression |

Known INFO findings (IN-01..IN-04 from 19-REVIEW.md) are documented, out-of-mandated-fix-scope, and non-blocking to the phase goal: HUD speed row indicator not synced to a non-default boot default; text-size CSS seams scoped to `.hud`; settings e2e beforeEach double nav; Home load button no retry affordance after one rejection. These are cosmetic/UX polish, not goal failures.

### Human Verification Required

No items. Every behavior-dependent truth is exercised by a passing behavioral test executed in this verification:

- Corrupt-save rejection (typed, never throws, incl. hostile pendingCommands) → saveCodec.test.ts (never-throws suites).
- Byte-identical reload with the codec in flight → determinism.test.ts + saveCodec round-trip.
- Validated load chain routing → save.test.ts + e2e sessions save→load→resume.
- Options persistence across reload → e2e settings 'persist across a page reload' (real browser, real localStorage).
- Boot-speed once-only invariant → time.test.ts (default applied, explicit setSpeed(8) wins).

No PRESENT_BEHAVIOR_UNVERIFIED truths at close.

### Gaps Summary

No gaps. All six must-have truths verified with behavioral evidence; 15/15 artifacts substantive and wired; key links connected; full suite (929), typecheck, check:military, goldens all clean; the three pre-existing e2e specs (boots/campaign/placement) reproduce on the pre-Phase-19 baseline per the documented baseline reproduction and were explicitly out of scope for penalization in this verification contract.

---

_Verified: 2026-08-06T13:30:00Z_
_Verifier: the agent (gsd-verifier)_
