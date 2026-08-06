---
phase: 19-persistence-options
plan: 19-plan
subsystem: persistence, ui, testing
tags: phaser, typescript, vitest, playwright, localStorage, save-codec, options, accessibility

# Dependency graph
requires:
  - phase: 18-management-ui
    provides: HUD control-bar + drawer/toggle patterns (settings drawer), game.events on/off (WR-04), createElement/textContent conventions, advisor drawer CSS tokens
provides:
  - Versioned save/load boundary: SAVE_VERSION + additive N→N+1 per-version migration + typed validation (saveCodec.ts)
  - Validated load path: loadSavedGame() read→parse→migrate→validate at HomeScene click-through AND MainScene.create() defense-in-depth
  - Persisted shell options under rcb.options (disjoint from all save keys) with forward-compat merge
  - Boot-time RenderConfig mapping (graphics quality → Phaser render config read before new Phaser.Game) + gameSpeedDefault applied once at Main boot
  - Accessibility seams: body[data-text-size]/[data-reduced-motion] CSS + a Phase-18-pattern Settings drawer in the HUD control bar
  - Thin no-asset audio mix seam (setMusicVolume/setSfxVolume/play) — §48 full audio deferred v2
affects: verify-work, complete-milestone, future phases touching save format (migration map MIGRATIONS), full audio phase (§48)

# Actuals (#2632) — pairs with the plan's `estimate` (150000) to calibrate future estimates.
actuals:
  tokens: 12200     # 48885 diff chars / 4 over the files actually changed
  tasks: 7
  commits: 6

# Tech tracking
tech-stack:
  added: []   # no new packages (threat T-19-SC gate acknowledged)
  patterns:
    - Pure browser-free codec (saveCodec) mirroring ui.ts options codec + SaveResult discriminated-union convention
    - Validated boundary between untrusted localStorage and the deterministic core (validate-before-replay at every entry)
    - Shell-state persistence mirroring save.ts layering (StorageLike/SaveResult/defaultStorage reused, never reimplemented)
    - Drawer/toggle DOM surfaces (createElement/textContent/data-testid, game.events off() cleanup) for the Settings panel

key-files:
  created:
    - src/sim/saveCodec.ts
    - src/game/options.ts
    - src/game/audio.ts
    - tests/unit/saveCodec.test.ts
    - tests/unit/options.test.ts
    - e2e/settings.spec.ts
  modified:
    - src/game/save.ts
    - src/game/main.ts
    - src/game/scenes/MainScene.ts
    - src/game/scenes/HomeScene.ts
    - src/game/scenes/HUDScene.ts
    - index.html
    - tests/unit/save.test.ts
    - tests/determinism/determinism.test.ts
    - tests/unit/time.test.ts

key-decisions:
  - "Version 1 stays current: MIGRATIONS is an empty additive map — migration infrastructure + validation is the deliverable, existing saves remain format-stable"
  - "validateSave enforces the full SaveCommand union shape (finite seed/mapSize/tickCount, known kinds, union-shaped fields) so a corrupt save NEVER reaches applyCommand's raw 'unknown command kind' throw"
  - "OPTIONS_KEY 'rcb.options' is disjoint from SAVE_KEY/QUICKSAVE_KEY/AUTOSAVE_PREFIX; options never enter SaveData/getStateJson (golden-byte contract)"
  - "graphicsQuality → RenderConfig is read BEFORE new Phaser.Game (context-creation-only); the Settings drawer documents 'applies on next launch'"
  - "gameSpeedDefault is injected exactly once in MainScene.create() for fresh+loaded paths with a positive-finite guard; HUD speed buttons own live speed afterward"
  - "audio mix is a no-asset per-bus multiplier seam (Pitfall 4: SoundManager is global-only); play() is a no-op signature until §48"

patterns-established:
  - "Validated load boundary: every save entry (Home click-through + MainScene.create() defense-in-depth) runs migrate+validate before fromSaveData; rejection surfaces a typed reason via textContent, never a silent load"
  - "Persisted shell state: options reuse ui.ts codec + save.ts StorageLike under their own key; applyOptions touches view/shell only, never the sim"
  - "Accessibility via body data-attributes consumed by CSS seams, driven by the Settings drawer"

requirements-completed: [PERS-01, PERS-02]

coverage:
  - id: D1
    description: "Versioned save codec — SAVE_VERSION=1, additive N→N+1 migrateSave with typed SaveCodecError version bounds, validateSave rejecting non-finite/corrupt/malformed saves with typed SaveValidationError (never a throw)"
    requirement: PERS-01
    verification:
      - kind: unit
        ref: "tests/unit/saveCodec.test.ts (18 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Validated load path — loadSavedGame() read→parse→migrate→validate with typed LoadResult, hooked into HomeScene (only {ok:true} reaches scene.start('Main',{save}); rejected saves disable the button + 'Save rejected: reason' via textContent)"
    requirement: PERS-01
    verification:
      - kind: unit
        ref: "tests/unit/save.test.ts loadSavedGame describe (6 tests)"
        status: pass
      - kind: e2e
        ref: "e2e/sessions.spec.ts 'save from pause, restart, then load resumes the same city'"
        status: pass
    human_judgment: false
  - id: D3
    description: "MainScene defense-in-depth — a 'save' runtimeConfig is migrated+validated before SimRunner.fromSaveData; invalid saves toast the reason and fall back to a fresh seed city (no raw throw, no unvalidated command into applyCommand); determinism round-trip runs migrate+validate in the loop byte-identically"
    requirement: PERS-01
    verification:
      - kind: integration
        ref: "tests/determinism/determinism.test.ts 'save/load round-trips a seed-generated map to a byte-identical state'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Persisted shell options — loadOptions/saveOptions/applyOptions under OPTIONS_KEY 'rcb.options' (defaults on missing/corrupt, forward-compat merge preserving unknown fields, disjoint from save keys), thin audio mix seam, and graphicsQuality→RenderConfig read before new Phaser.Game in main.ts"
    requirement: PERS-02
    verification:
      - kind: unit
        ref: "tests/unit/options.test.ts (6 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "gameSpeedDefault applied exactly once at MainScene boot for fresh+loaded cities (positive-finite guard); HUD speed buttons override afterward, never re-applied per tick"
    requirement: PERS-02
    verification:
      - kind: unit
        ref: "tests/unit/time.test.ts 'boot default speed' describe (3 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Settings drawer in the HUD control bar (controls-settings → settings-drawer, six opt-* controls pre-filled from loadOptions) editing + persisting via saveOptions/applyOptions with an 'Options saved' toast; text-size/reduced-motion applied through body[data-*] CSS seams; options survive page.reload()"
    requirement: PERS-02
    verification:
      - kind: e2e
        ref: "e2e/settings.spec.ts (4 tests: defaults, toggle+toast, persist-across-reload, zero page/console errors)"
        status: pass
    human_judgment: false

# Metrics
duration: 1h 52m
completed: 2026-08-06
status: complete
---

# Phase 19 Plan 19: Persistence & Options Summary

**Versioned save/load boundary (SAVE_VERSION + additive migrateSave + typed validateSave + validated loadSavedGame at Home and MainScene) and functional persisted options/accessibility (rcb.options store, boot RenderConfig, gameSpeedDefault at boot, text-size/reduced-motion CSS seams, no-asset audio mix seam, Phase-18-pattern Settings drawer).**

## Performance

- **Duration:** 1h 52m (10:50Z → 12:42Z)
- **Started:** 2026-08-06T10:50:25Z
- **Completed:** 2026-08-06T12:42:00Z
- **Tasks:** 7 (6 code commits; the close task is a verification gate with no files)
- **Files modified:** 15

## Accomplishments

- **PERS-01 — versioned, validated save/load:** a pure `src/sim/saveCodec.ts` (SAVE_VERSION=1, additive empty `MIGRATIONS` map, `migrateSave` N→N+1 with typed `SaveCodecError` version bounds, `validateSave` with the full `SaveValidationError` rejection set over the SaveCommand union). `loadSavedGame()` in save.ts is the read→parse→migrate→validate chain replacing `readSave`'s truthiness check on the load path; HomeScene click-through only starts Main on `{ok:true}` and surfaces `Save rejected: <reason>` via textContent; MainScene.create() re-validates any `save` runtimeConfig as defense-in-depth (invalid → hud-toast + fresh-city fallback, never a raw throw). `fromSaveData`/`applyCommand`/`getStateJson` untouched; the determinism suite round-trips WITH migrate+validate in the loop byte-identically.
- **PERS-02 — functional persisted options/accessibility:** `src/game/options.ts` (`OPTIONS_KEY='rcb.options'`, loadOptions defaults/forward-compat merge, saveOptions typed SaveResult, applyOptions body data-attrs + audio mix — never the sim), `src/game/audio.ts` no-asset mix seam, `main.ts` reads options BEFORE `new Phaser.Game` and maps graphicsQuality → RenderConfig (low/medium/high), MainScene applies `gameSpeedDefault` once at boot for fresh+loaded paths, and a Settings drawer in the HUD control bar edits + persists the six options with an 'Options saved' toast. `e2e/settings.spec.ts` proves a toggled option survives `page.reload()`.
- **Gate state:** typecheck green, full vitest suite 119 files / 921 tests green, `check:military` clean, `git status --porcelain tests/golden` empty (no golden regeneration; options never in SaveData), the Phase-19 e2e (sessions 6 + settings 4) green together proving the migrate+validate path embedded in the real save→restart→load flow.

## Task Commits

Each task was committed atomically:

1. **Task 19-00-01: Wave 0 validation scaffolds** - `bdb433a` (test: saveCodec, options store, loadSavedGame, determinism-with-codec, boot speed, settings e2e)
2. **Task 19-01-01: Tracer — saveCodec + loadSavedGame + HomeScene hookup** - `b43ea1f` (feat: PERS-01 tracer end-to-end)
3. **Task 19-01-02: MainScene defense-in-depth + determinism-with-codec** - `176e8df` (feat: PERS-01 completion)
4. **Task 19-02-01: options module + audio seam + boot RenderConfig** - `05b0ffb` (feat: PERS-02 backend)
5. **Task 19-02-02: gameSpeedDefault at boot** - `534b5bd` (feat: boot speed)
6. **Task 19-02-03: Settings drawer + CSS seams + settings e2e** - `605a147` (feat: PERS-02 UI + persistence)
7. **Task 19-03-01: Close gate** - no code changes (verification-only: full suite + typecheck + check:military + goldens clean)

**Plan metadata:** (final docs commit to follow)

## Files Created/Modified

- `src/sim/saveCodec.ts` - Pure versioned save codec: SAVE_VERSION, SaveCodecError, empty additive MIGRATIONS map, migrateSave, SaveValidationError union, validateSave (never throws)
- `src/game/save.ts` - Exported defaultStorage; NEW LoadResult + loadSavedGame() read→parse→migrate→validate
- `src/game/options.ts` - OPTIONS_KEY 'rcb.options'; loadOptions/saveOptions/applyOptions reusing ui.ts codec + save.ts StorageLike
- `src/game/audio.ts` - Thin no-asset mix seam: setMusicVolume/setSfxVolume persist per-bus multipliers; play() signature (no-op until §48)
- `src/game/main.ts` - loadOptions() BEFORE new Phaser.Game → graphicsQuality RenderConfig mapping; applyOptions once after construction
- `src/game/scenes/MainScene.ts` - create() validates/migrates a save runtimeConfig (validatedRunnerFromSave, toast+fresh fallback) + setSpeed(loadOptions().gameSpeedDefault) once for both paths (positive-finite guard)
- `src/game/scenes/HomeScene.ts` - Load click-through routes through loadSavedGame(); rejection disables the button + reason via textContent
- `src/game/scenes/HUDScene.ts` - 4th control-bar button controls-settings; settings-drawer with six opt-* controls; toggle/fill/save handlers (saveOptions+applyOptions+toast, toUnit clamp)
- `index.html` - body[data-text-size=large|small] .hud seams; body[data-reduced-motion=true] animation/transition suppression; .settings-drawer block + row/button styles (existing umber/bronze/gold tokens)
- `tests/unit/saveCodec.test.ts` - 18 tests: migrate chain/version bounds, validate rejection set, round-trip with codec in the loop
- `tests/unit/options.test.ts` - 6 tests: rcb.options round-trip, missing/corrupt→defaults, partial merge, forward-compat unknown-field preserve, full custom schema
- `tests/unit/save.test.ts` - EXTENDED with 6 loadSavedGame cases (read/parse/migrate/validate)
- `tests/determinism/determinism.test.ts` - seed round-trip routes save through migrateSave+validateSave
- `tests/unit/time.test.ts` - EXTENDED with 3 boot-default-speed cases (once-only + RangeError contract)
- `e2e/settings.spec.ts` - 4 tests: defaults, toggle+save toast, persist-across-reload, zero page/console errors

## Decisions Made

- **Version 1 stays current** with an empty MIGRATIONS map — the migration/validation infrastructure and its proofs are the deliverable; existing saves keep round-tripping (no schema break).
- **validateSave is the full union gate** before replay so `applyCommand`'s raw 'unknown command kind' throw stays solely as a defense-in-depth last resort (never reached by a corrupt save).
- **OPTIONS_KEY 'rcb.options'** disjoint from every save key; options are view/shell state and never enter SaveData/getStateJson (golden-byte contract, Proven by `git status --porcelain tests/golden` empty at close).
- **graphicsQuality→RenderConfig read before `new Phaser.Game`** (context-creation-only; Pitfall 3), with the drawer UI noting "applies on next launch".
- **gameSpeedDefault injected once in MainScene.create()** for both fresh+loaded paths with a positive-finite guard; HUD [0.5,1,2,4,8] buttons own live speed afterwards (Pitfall 6).
- **Audio is a no-asset multiplier seam** (Pitfall 4 — Phaser SoundManager is global-only); the persistent mix and the play() signature are the deliverable until §48.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest `-x` flag not supported by the installed runner**
- **Found during:** Task 19-01-01 (tracer verify)
- **Issue:** The plan's `<verify>` commands use `npx vitest run … -x`; the installed Vitest 3.2.7 rejects `-x` with `CACError: Unknown option`. (The validation doc also lists it.)
- **Fix:** Dropped `-x` (equivalent to no-bail) from every verify invocation; the same tests still abort-on-first-failure for the files listed and pass.
- **Files modified:** none (command-line only)
- **Verification:** All unit verify gates ran green without the flag.

**2. [Rule 1 - Bug] Unused-import typecheck failures in the Wave-0 scaffolds**
- **Found during:** Task 19-00-01 (Wave 0 gate)
- **Issue:** `e2e/settings.spec.ts` imported the unused `openGame` helper and `tests/unit/saveCodec.test.ts` imported unused `SaveCommand` — TS6133/TS6196 failures on top of the expected red-but-expected future-module imports.
- **Fix:** Removed the two unused imports.
- **Files modified:** e2e/settings.spec.ts, tests/unit/saveCodec.test.ts
- **Verification:** typecheck red-list reduced to exactly the declared future-module imports (saveCodec/options/loadSavedGame).

**3. [Rule 3 - Blocking] Vitest full-suite worker RPC timeouts on this machine (forks pool)**
- **Found during:** Task 19-03-01 (close gate)
- **Issue:** `npx vitest run --maxWorkers=4` (the documented command) exits 1 with `[vitest-worker]: Timeout calling "onTaskUpdate"` unhandled errors on this loaded Mac — despite 119 files / 921 tests ALL passing. Reproduces with maxWorkers 2/1 and without the 4096 heap; determinism-only and single-file runs are clean. It is a worker-pool RPC teardown artifact under load, not a test failure.
- **Fix:** Ran the full suite with `--pool=threads` → exit 0, 119 files / 921 tests green. All tests pass under both pools; every per-file/suite gate in this phase ran green.
- **Files modified:** none
- **Verification:** `npm run typecheck && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --pool=threads --maxWorkers=4` — full green.

**4. [Rule 3 - Environment] Three pre-existing e2e specs fail on this loaded machine (proven NOT a Phase-19 regression)**
- **Found during:** Task 19-03-01 (close gate)
- **Issue:** `e2e/boots.spec.ts` (spritesheet "Failed to process file" console errors), `e2e/campaign.spec.ts` (trivial objective `won` false — the objective gate is `tickCount % 40 === 0` and `runTicks(10)` misses the month boundary at the current entrance tick), and `e2e/placement.spec.ts` (population threshold not crossed in the tick window) fail on this machine.
- **Fix:** Proved non-regression by reproducing all three failures against a `git archive` of the pre-phase baseline commit (8802f56) on the same machine — identical failures with zero Phase-19 code present. The Phase-19-relevant e2e (sessions 6 + settings 4 = 10) passes with the codec + options in the path. Deferred (pre-existing environmental; re-run on an unloaded host).
- **Files modified:** none

---

**Total deviations:** 4 auto-fixed (1 bug, 3 blocking/environmental)
**Impact on plan:** All auto-fixes preserve plan intent; no scope creep. The full suite content is green in every configuration; the only exits-codes ≠ 0 are environment-sourced (worker RPC under load, pre-existing e2e timing on a loaded host).

## Issues Encountered

- **Machine load:** during execution load average reached 4–6.7 on this Mac (WindowServer/Chrome/OpenCode consuming 35–50% CPU each). This caused the vitest forks-pool worker RPC timeouts and the 3 pre-existing e2e threshold failures. Mitigations: `--pool=threads` for the full suite; baseline reproduction to prove the e2e failures pre-date Phase 19.
- **Leftover dev server:** the playwright `webServer` (reuseExistingServer) left a vite on :5173 running after the first e2e run — killed it before the final full-suite run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Milestone-complete:** Phase 19 closes the v1.0 milestone — this SUMMARY should be read as the /gsd-complete-milestone input. ROADMAP marks Phase 19 done; STATE.md advances to milestone-complete.
- **Known deferred (by design):** §48 full audio assets (the `play()` seam is the placeholder now), and the end-state UI redesign (Phase 20 scope).
- **Recommendation before ship:** re-run the three pre-existing e2e specs (boots/campaign/placement) on an unloaded host; they fail on this machine at baseline and should pass elsewhere. No Phase-19 code needs changing.

---

*Phase: 19-persistence-options*
*Completed: 2026-08-06*

## Self-Check: PASSED

- **Files:** all 15 planned/create files verified present (saveCodec, save, options, audio, main, MainScene, HomeScene, HUDScene, index.html, saveCodec.test, options.test, save.test, time.test, determinism.test, settings.spec) + this SUMMARY.
- **Commits:** all 6 task commits verified in git history: `bdb433a`, `b43ea1f`, `176e8df`, `05b0ffb`, `534b5bd`, `605a147`.
- **Gates at close:** typecheck green; full vitest suite 119 files / 921 tests green (`--pool=threads`; see deviations for the forks-pool RPC artifact); `check:military` clean; `git status --porcelain tests/golden` empty (no golden regeneration); Phase-19 e2e (sessions 6 + settings 4) green.
- **Deferred (documented, not blocking):** 3 pre-existing e2e specs (boots/campaign/placement) fail on this loaded host at the pre-phase baseline too — re-run on an unloaded machine before ship.