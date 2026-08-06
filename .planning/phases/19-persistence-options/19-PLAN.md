---
phase: 19-persistence-options
plan: 19-plan
type: execute
wave: 0
depends_on: [18-PLAN]
files_modified:
  - src/sim/saveCodec.ts
  - src/game/save.ts
  - src/game/options.ts
  - src/game/audio.ts
  - src/game/main.ts
  - src/game/scenes/MainScene.ts
  - src/game/scenes/HomeScene.ts
  - src/game/scenes/HUDScene.ts
  - index.html
  - tests/unit/saveCodec.test.ts
  - tests/unit/options.test.ts
  - tests/unit/save.test.ts
  - tests/unit/time.test.ts
  - tests/determinism/determinism.test.ts
  - e2e/settings.spec.ts
autonomous: true
requirements: [PERS-01, PERS-02]

estimate:
  tokens: 150000
  raw_tokens: 150000
  tasks: 7
  confidence: low

must_haves:
  truths:
    - "PERS-01: an existing/corrupt/unknown-version save is EITHER migrated additively to the current version and loads deterministically (fromSaveData replays at tick 0 to the identical getStateJson), OR rejected with a clear typed reason (read/parse/migrate/validate) surfaced in the Home UI — never a raw 'unknown command kind' throw from applyCommand and never a silent misload on a NaN seed/tickCount/mapSize."
    - "PERS-01: the load path runs read → parse → migrate → validate BEFORE any replay — loadSavedGame() in src/game/save.ts is the HomeScene read hook, and MainScene.create() re-validates a save runtimeConfig as defense-in-depth before SimRunner.fromSaveData; version 1 stays current (existing saves remain valid, no schema break), and the migration/validation loop is embedded in the determinism suite so byte-identical reload is proven with the codec in flight."
    - "PERS-02: options are persisted shell state under the rcb.options localStorage key (disjoint from rcb.save), load at boot merged with defaults forward-compat (unknown future fields preserved), and graphics quality maps to Phaser RenderConfig at Game construction in main.ts (low → antialias:false+roundPixels:true, medium → today's defaults, high → antialias:true) — a quality change is persisted and applies on next boot (context-creation-only)."
    - "PERS-02: gameSpeedDefault is applied exactly once in MainScene.create() for BOTH fresh-seed and loaded cities via setSpeed(loadOptions().gameSpeedDefault); the HUD [0.5,1,2,4,8] speed buttons still override the live speed afterward and the default is never re-applied per tick."
    - "PERS-02: text-size (small/normal/large) and reduced-motion apply through document.body data-attributes + index.html CSS seams (body[data-text-size=...], body[data-reduced-motion=...]); audio music/SFX mixes are persisted and applied through the thin src/game/audio.ts seam (no fabricated assets — §48 full audio deferred v2); a Settings drawer in the HUD control bar edits + persists the options (saveOptions + applyOptions + toast)."
    - "Volatile metadata only: no getState()/SaveData/getStateJson() shape change from any PERS work — options never enter SaveData or the byte-identity, goldens are untouched, and the phase closes with the full suite + typecheck + check:military green together."
  artifacts:
    - path: src/sim/saveCodec.ts
      provides: "NEW pure node-testable codec: SAVE_VERSION = 1 as const; class SaveCodecError extends Error with code field ('migrate-invalid-version'|'migrate-not-supported'|'save-version-too-new'); const MIGRATIONS: Record<number,(save:unknown)=>unknown> = {} (additive N→N+1 steps, empty today since v1 is current); migrateSave(data): SaveData (version type/integer/bounds check, else SaveCodecError; walks MIGRATIONS[version] to SAVE_VERSION; rejects version &gt; SAVE_VERSION); type SaveValidationError = 'invalid-version'|'missing-field'|'non-finite-seed'|'non-finite-tick-count'|'non-finite-map-size'|'commands-not-array'|'unknown-command-kind'|'malformed-command'; validateSave(data): {ok:true;data:SaveData}|{ok:false;error:SaveValidationError;reason:string} (finite seed/mapSize/tickCount, commands Array, every command kind in the SaveCommand union with well-formed fields, typed result never throws)"
      min_lines: 90
    - path: src/game/save.ts
      provides: "MODIFY — add export type LoadResult = {ok:true;data:SaveData}|{ok:false;error:'read'|'parse'|'migrate'|'validate';reason?:string}; loadSavedGame(storage?): LoadResult (read envelope → JSON.parse with 'parse' typed error → migrateSave catching SaveCodecError as 'migrate' → validateSave passthrough → {ok:true,data} only when valid); export the existing defaultStorage() so options.ts reuses it; readSave/listSaves stay meta-listing (tolerant) — the click-through is the validated path"
      min_lines: 45
    - path: src/game/options.ts
      provides: "NEW shell-state store mirroring save.ts layering: OPTIONS_KEY = 'rcb.options'; loadOptions(storage?): OptionsSchema (deserializeOptions under the key, defaults on missing/corrupt, forward-compat merge); saveOptions(o, storage?): SaveResult (serializeOptions into rcb.options, typed 'write' on failure); applyOptions(o): void (document.body.dataset.textSize/data-reducedMotion + setMusicVolume/setSfxVolume via the audio seam — never touches the sim; gameSpeedDefault applied separately at MainScene boot)"
      min_lines: 55
    - path: src/game/audio.ts
      provides: "NEW thin mix seam, no assets (A2/§48 deferred v2): setMusicVolume(v)/setSfxVolume(v) store app-side per-bus multipliers; play(kind,'music'|'sfx',game) sets the sound volume to the stored mix at play time — seam signature is the deliverable, no audio files fabricated"
      min_lines: 25
    - path: src/game/main.ts
      provides: "MODIFY — read loadOptions() BEFORE the Phaser.Game constructor and map graphicsQuality → the existing render: {preserveDrawingBuffer:true} config (low adds antialias:false+roundPixels:true; high adds antialias:true) — RenderConfig is context-creation-only; set body[data-text-size]/[data-reduced-motion] + audio mix via applyOptions() once scenes exist"
      min_lines: 25
    - path: src/game/scenes/MainScene.ts
      provides: "MODIFY — create() guards the 'save' branch (defense-in-depth): migrate/validate the incoming save before SimRunner.fromSaveData; on ok:false emit a hud-toast with the reason and fall back to a fresh seed city (never a raw throw); then setSpeed(loadOptions().gameSpeedDefault) exactly once for both fresh + loaded paths (HUD speed buttons override after)"
      min_lines: 30
    - path: src/game/scenes/HomeScene.ts
      provides: "MODIFY — the load click routes through loadSavedGame(): only {ok:true} reaches scene.start('Main',{save}); on {ok:false} the load button is disabled and labelled 'Save rejected: reason' via textContent (never innerHTML) instead of the seed/tick meta label"
      min_lines: 25
    - path: src/game/scenes/HUDScene.ts
      provides: "MODIFY — 4th control-bar button controls-settings toggling a settings drawer (data-testid settings-drawer) with opt-graphics/opt-music/opt-sfx/opt-speed/opt-text-size/opt-reduced-motion controls + settings-save button (saveOptions+applyOptions+toast 'Options saved'); Phase-18 drawer/toggle pattern, every dynamic value via textContent, event-bus handlers off()'d in SHUTDOWN"
      min_lines: 110
    - path: index.html
      provides: "MODIFY — CSS seams body[data-text-size='large'] .hud {font-size:15px}, body[data-text-size='small'] .hud {font-size:11px}, body[data-reduced-motion='true'] *:not(.hud-toast){animation/transition:none!important}, and a .settings-drawer block copying .advisor-drawer tokens (umber/bronze/gold)"
      min_lines: 25
    - path: tests/unit/saveCodec.test.ts
      provides: "NEW (Wave 0) — migrateSave chain/pass-through/version-bounds (version&lt;1 or &gt;SAVE_VERSION typed SaveCodecError), validateSave rejection set (non-finite seed/mapSize/tickCount, commands-not-array, unknown-command-kind, malformed-command, invalid-version) with NO raw throw, and the round-trip-with-codec recipe (migrateSave+validateSave+fromSaveData → byte-identical getStateJson)"
      min_lines: 80
    - path: tests/unit/options.test.ts
      provides: "NEW (Wave 0) — rcb.options saveOptions→loadOptions round-trip for DEFAULT_OPTIONS and a full custom schema, missing-store → defaults, corrupt JSON → defaults, partial stored value → defaults merge (forward-compat, unknown fields preserved), via a Map-backed memStore StorageLike"
      min_lines: 55
    - path: tests/unit/save.test.ts
      provides: "EXTENDED (Wave 0) — loadSavedGame block: no save → ok:false 'read', corrupt JSON → 'parse', valid v1 (writeSave+loadSavedGame) → ok:true with data unchanged, version-0 → 'migrate', structurally-invalid v1 → 'validate' with reason"
      min_lines: 40
    - path: tests/determinism/determinism.test.ts
      provides: "EXTENDED (Wave 0) — the existing seed-generated save/load byte-identity round-trip routes getSaveData() through migrateSave + validateSave before fromSaveData so the codec is exercised across systems while goldens stay untouched"
      min_lines: 12
    - path: tests/unit/time.test.ts
      provides: "EXTENDED (Wave 0) — boot default speed: setSpeed(options.gameSpeedDefault) → timeSystem.speed equals the default AND a later explicit setSpeed(8) wins (default is once-only, never per-tick)"
      min_lines: 15
    - path: e2e/settings.spec.ts
      provides: "NEW (Wave 0) — open settings (controls-settings) → toggle opt-text-size/opt-reduced-motion → settings-save → toast 'Options saved' → page.reload() → option persists (drawer value + body[data-text-size]/[data-reduced-motion]); pageerror/console errors asserted empty (Phase-18 convention)"
      min_lines: 50
  key_links:
    - "loadSavedGame() ↔ saveCodec (read→parse→migrate→validate) ↔ fromSaveData: the migration/validation gate MUST sit between the storage read and SimRunner.fromSaveData at BOTH the HomeScene click-through and MainScene.create() defense-in-depth — a bypass re-opens the raw 'unknown command kind' throw (runner.ts applyCommand) or NaN misbehavior; verified by saveCodec.test.ts + the extended save.test.ts + determinism round-trip (19-01-01/02)."
    - "options.ts ↔ ui.ts codec + save.ts storage: loadOptions/saveOptions reuse deserializeOptions/mergeOptions/serializeOptions/DEFAULT_OPTIONS and the StorageLike/SaveResult + exported defaultStorage from save.ts — never a hand-rolled storage layer; OPTIONS_KEY 'rcb.options' stays disjoint from SAVE_KEY/QUICKSAVE_KEY/AUTOSAVE_PREFIX (19-02-01)."
    - "main.ts ↔ options.ts: graphicsQuality→RenderConfig is read BEFORE new Phaser.Game (context-creation-only, research Pitfall 3) — a runtime antialias toggle is a silent no-op; the settings UI must say a quality change applies on next boot (19-02-01)."
    - "MainScene ↔ options.ts ↔ time.ts: gameSpeedDefault → this.setSpeed() exactly once in create() for both fresh+loaded paths; the HUD [0.5,1,2,4,8] buttons (HUDScene) override live speed afterward; never re-apply per tick (research Pitfall 6); setSpeed RangeError guard (time.ts:61-66) honored (19-02-02)."
    - "applyOptions ↔ index.html CSS: document.body[data-text-size]/[data-reduced-motion] set by applyOptions are consumed by the CSS seams; the settings drawer (HUDScene) edits via saveOptions/applyOptions and e2e/settings.spec.ts proves the option survives a reload (19-02-02/03)."
    - "Options ↔ golden-byte: options NEVER enter SaveData/getStateJson/toBuildingState — applyOptions touches view/shell only; the close wave asserts git status --porcelain tests/golden empty and the determinism/golden suites green (T-19-04; 19-03-01)."
---
<objective>
Deliver Phase 19 — the FINAL v1.0 milestone phase — versioned save/load for every sim system with migration + validation + byte-identical deterministic reload (PERS-01), and functional, persisted options/accessibility for graphics, audio, gameplay and accessibility (PERS-02).

Purpose: the deterministic reload half of PERS-01 is already proven — getSaveData()/fromSaveData() round-trip every system (missions, events, objectives, tutorial, government, religion, production, housing, paused queues) and dozens of determinism suites assert byte-identical getStateJson(). What is genuinely MISSING is the infrastructure: no version check, no migration chain, no validation anywhere on the load path — fromSaveData replays save.commands with zero guards (runner.ts:2662-2678) so a corrupt save throws a raw 'unknown command kind' error or silently misbehaves on a NaN seed/tickCount, and readSave only truthiness-checks parsed?.data?.version (save.ts:66). Similarly PERS-02's OptionsSchema/DEFAULT_OPTIONS/mergeOptions/serializeOptions/deserializeOptions exist in src/sim/ui.ts (unit-tested) but are wired NOWHERE — no localStorage key, no renderer-quality control, no audio, gameSpeedDefault unused (HUD hardcodes [0.5,1,2,4,8]), no text-size/reduced-motion hooks. This phase turns the proven core into a guarded boundary: add the pure saveCodec (SAVE_VERSION + additive N→N+1 migrateSave + validateSave with typed errors), a validated loadSavedGame() hooked into HomeScene + MainScene, and a shell-state options module (rcb.options) applied at boot (RenderConfig before new Phaser.Game) + via a Phase-18-style Settings drawer, with a thin audio mix seam (no fabricated assets — §48 deferred v2). Constraints honored: options NEVER enter SaveData/getStateJson (golden-byte); version 1 stays current (existing saves stay valid); no new packages; additive-only migration.
Output: src/sim/saveCodec.ts, loadSavedGame() in src/game/save.ts, src/game/options.ts + src/game/audio.ts, RenderConfig mapping + applyOptions in src/game/main.ts, create() validation + boot speed in MainScene.ts, typed load + rejection surface in HomeScene.ts, Settings drawer in HUDScene.ts, CSS seams in index.html, NEW tests/unit/saveCodec.test.ts + tests/unit/options.test.ts + e2e/settings.spec.ts, EXTENDED tests/unit/save.test.ts + tests/determinism/determinism.test.ts + tests/unit/time.test.ts, and the close gate (full suite + typecheck + check:military green, no golden regeneration).
</objective>

<execution_context>
@/Users/filipe.esch/projects/pessoal/opencaesar/.opencode/gsd-core/workflows/execute-plan.md
@/Users/filipe.esch/projects/pessoal/opencaesar/.opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/19-persistence-options/19-CONTEXT.md
@.planning/phases/19-persistence-options/19-RESEARCH.md
@.planning/phases/19-persistence-options/19-PATTERNS.md
@.planning/phases/19-persistence-options/19-VALIDATION.md

# PERS-01 seams (read before Wave 1):
@src/sim/saveCodec.ts (target — new; model on src/sim/ui.ts options codec + src/sim/advisors.ts pure projections)
@src/sim/types.ts
@src/sim/runner.ts
@src/game/save.ts

# PERS-02 seams (read before Wave 2):
@src/sim/ui.ts
@src/game/options.ts (target — new; model on save.ts layering)
@src/game/audio.ts (target — new)
@src/game/main.ts
@src/game/scenes/MainScene.ts
@src/game/scenes/HomeScene.ts
@src/game/scenes/HUDScene.ts
@index.html

# Tests (read before editing the matching wave scaffolds):
@tests/unit/save.test.ts
@tests/unit/ui.test.ts
@tests/unit/time.test.ts
@tests/determinism/determinism.test.ts
@e2e/helpers.ts
@e2e/sessions.spec.ts
</context>

# Execution order (waves are sequential; tasks within a wave run in listed order — shared files force sequential edits):

- **Wave 0** — validation test scaffolds: NEW `tests/unit/saveCodec.test.ts` (migrateSave chain + validateSave rejection), NEW `tests/unit/options.test.ts` (rcb.options persistence + defaults + forward-compat), EXTEND `tests/unit/save.test.ts` (loadSavedGame read→parse→migrate→validate), EXTEND `tests/determinism/determinism.test.ts` (round-trip WITH migrate/validate in the loop), EXTEND `tests/unit/time.test.ts` (boot default speed), NEW `e2e/settings.spec.ts` (settings panel + persist-across-reload). The new/extended cases are RED until their implementing waves land (write them against the TARGET API surface).
- **Wave 1 (PERS-01)** — versioned save/load. 19-01-01 (tracer) FIRST: the pure `src/sim/saveCodec.ts` (SAVE_VERSION + additive migrateSave + validateSave typed errors) + `loadSavedGame()` in save.ts + the HomeScene load click-through routes through it (only `{ok:true}` reaches `scene.start('Main',{save})`) — the thinnest read→parse→migrate→validate→fromSaveData slice end-to-end, flipping `saveCodec.test.ts` + the `loadSavedGame` block in `save.test.ts` green and keeping the sessions save→load e2e green. 19-01-02 completes PERS-01 with the MainScene.create() defense-in-depth validation on a `save` runtimeConfig, the HomeScene corrupt-save rejection surface (disabled button + reason text), and the determinism-suite round-trip extended to run migrate+validate in the loop.
- **Wave 2 (PERS-02)** — options/accessibility. 19-02-01 creates `src/game/options.ts` (OPTIONS_KEY 'rcb.options', loadOptions/saveOptions/applyOptions reusing ui.ts codec + save.ts StorageLike) + the thin `src/game/audio.ts` mix seam + reads options BEFORE `new Phaser.Game` in main.ts mapping graphicsQuality → RenderConfig, flipping `options.test.ts` green. 19-02-02 applies `gameSpeedDefault` once in MainScene.create() for both fresh+loaded paths (HUD buttons override after) and extends `time.test.ts`. 19-02-03 adds the Settings drawer to the HUD control bar (Phase-18 drawer/toggle pattern, textContent, data-testid) + the index.html body[data-text-size]/[data-reduced-motion] CSS seams, flipping `e2e/settings.spec.ts` green.
- **Wave 4 (close)** — 19-03-01 runs the full suite + typecheck + check:military green with no golden regeneration and the migrate+validate load path proven end-to-end as the phase gate.
- **Typecheck sequencing note:** the Wave-0 scaffolds and the Wave-1 gates reference APIs that land later (`src/game/options` → 19-02-01; RenderConfig/body data-attrs → 19-02-01; settings drawer data-testids → 19-02-03). Consequently `npm run typecheck` is RED at Waves 0-1 by design (the new test files import modules that do not exist yet). Executor MUST handle this: for Wave 0 keep the gate to file-existence + `npm run typecheck` documented as red-but-expected (the scaffolds parse via targeted vitest runs on compiled-on-the-fly; add `@ts-expect-error`/type-only stubs only if a scaffold cannot parse); per-wave gates FLIP typecheck green once their imported modules exist (Wave 2 after 19-02-01/19-02-02, Wave 3 after the drawer). The FINAL Wave-4 gate is authoritative (full typecheck green).

# Locked decisions honored (19-CONTEXT.md + 19-RESEARCH.md):
- PERS-01: SaveData gains a checked version; saves round-trip deterministically with migration (older versions migrate forward additively N→N+1) and validation (corrupt/unknown-version saves are rejected with a clear typed error, NOT a silent load) — `saveCodec.ts` + `loadSavedGame()` hooked into HomeScene + MainScene.create() defense-in-depth; version 1 stays current (existing saves valid, no schema break, empty migration map proven by tests).
- PERS-01: deterministic reload is preserved byte-identically — options decisions/missions/events/objectives/tutorial are SaveCommands or replay-derived; `fromSaveData` (runner.ts:2662-2678) is NOT modified; the codec runs BEFORE replay only.
- PERS-02: OptionsSchema/mergeOptions/serializeOptions/deserializeOptions (ui.ts) are wired to (a) a persisted store (localStorage 'rcb.options' alongside the save envelope), (b) applied effects (graphics → RenderConfig at boot; audio mix → app-side multipliers via audio.ts; gameSpeedDefault → MainScene boot; textSize/reducedMotion → body[data-*] + CSS), (c) loaded on boot and merged with defaults forward-compat.
- PERS-02: the Settings UI is domiciled in the HUD following Phase-18 drawer/toggle patterns (control-bar button, data-testid, createElement/textContent — sim-derived strings never hit innerHTML); reduced motion suppresses non-essential animation and text size scales HUD text.
- Options are view/shell state — persisted separately from the sim SaveData (different key, never part of SimState byte-identity); options changes never touch the deterministic sim.
- the agent's Discretion (resolved concretely in each task): migrateSave v1→current is a no-op map today (infrastructure + validation is the deliverable); settings drawer layout/toggles; graphics-text-size manifestations (documented "applies on next boot" for quality); OPTIONS_KEY naming ('rcb.options', alongside save.ts keys).

# Multi-source coverage audit (all COVERED):
- GOAL (versioned save/load with migration + validation + deterministic reload; functional persisted graphics/audio/gameplay/accessibility options) → Wave 1 (PERS-01 migration/validation/reload) + Wave 2 (PERS-02 persistence/application/settings UI) + Wave 4 (close gate proof).
- REQ PERS-01 (versioned save/load migration covering all systems with validation and deterministic reload) → 19-01-01 (saveCodec + loadSavedGame + HomeScene hookup) + 19-01-02 (MainScene defense-in-depth + rejection surface + determinism-with-codec). REQ PERS-02 (options and accessibility: graphics, audio, gameplay, accessibility) → 19-02-01 (options module + boot RenderConfig + audio seam) + 19-02-02 (gameSpeedDefault boot) + 19-02-03 (Settings drawer + text-size/reduced-motion CSS + persistence e2e). Every PERS-01..02 ID appears in this plan's frontmatter `requirements`.
- RESEARCH: SAVE_VERSION/migrate/validate missing → 19-01-01; truthiness version check (save.ts:66) → 19-01-01/02 loadSavedGame; fromSaveData zero guards / raw throw (runner.ts:3288-3290) → 19-01-01/02 validate-before-replay; RenderConfig context-creation-only (Pitfall 3) → 19-02-01 (read before new Phaser.Game); SoundManager global-only (Pitfall 4) → 19-02-01 audio.ts mix seam; options byte-identity (Pitfall 5) → goldens + T-19-04 + 19-03-01; speed boot-only (Pitfall 6) → 19-02-02; options dead code (ui.ts) → 19-02-01/03; slot APIs (Pitfall 7) — autosave/quicksave UI explicitly OUT of PERS-01 locked scope (A6) → no task.
- CONTEXT: every locked decision above has a task (traced in the task actions); discretion areas (drawer layout, opt-* testids, key naming, no-op migration map) are resolved concretely.
- Exclusions checked: no deferred ideas in CONTEXT (the section is explicitly empty); items scoped to other phases (full audio assets §48, end-state UI redesign Phase 20) are out of scope here.

<tasks>

<!-- ===================== WAVE 0 — validation test scaffolds ===================== -->

<task type="auto">
  <name>Task 19-00-01: Wave 0 — create/extend validation test scaffolds (saveCodec, options store, loadSavedGame, determinism-with-codec, boot speed, settings e2e)</name>
  <files>tests/unit/saveCodec.test.ts, tests/unit/options.test.ts, tests/unit/save.test.ts, tests/determinism/determinism.test.ts, tests/unit/time.test.ts, e2e/settings.spec.ts</files>
  <read_first>
    - tests/unit/save.test.ts:5-21 (memStore StorageLike factory + fakeSave: version 1 / seed 42 / mapSize 40 / commands [] / tickCount 123 / savedAt 1000) and :23-61 (the write/read/makeRecord assertion style to reuse and EXTEND for loadSavedGame)
    - tests/unit/ui.test.ts:40-49 (options round-trip with defaults merge — the shape options.test.ts mirrors against the target store module)
    - tests/determinism/determinism.test.ts:29-42 (the seed-generated save/load byte-identity round-trip to EXTEND with migrateSave/validateSave in the loop)
    - tests/unit/time.test.ts:32-36,92-106 (setSpeed behavior — the boot-default-speed extension target)
    - e2e/sessions.spec.ts:51-90 (save-from-pause → restart → load-resumes-city harness + toast asserts) and e2e/helpers.ts:7-21 (Window.__cityApi declaration), :29-32 (openGame '/?test&seed=1337'), :102-107 (toastText)
    - 19-RESEARCH.md Validation Architecture (Wave 0 Gaps + Phase Requirements → Test Map) and 19-VALIDATION.md (Per-Task Verification Map 19-00-01 and the full-suite command)
  </read_first>
  <action>
    Create the validation scaffolds as RED tests pinned to the Phase-19 target APIs (they fail until Waves 1-2 implement the features — expected, and how the Nyquist gate tracks them). Write against the TARGET surface, not today's surface.

    1. NEW tests/unit/saveCodec.test.ts (REQ PERS-01). Target import: { migrateSave, validateSave, SAVE_VERSION } from '../../src/sim/saveCodec'; import { SimRunner } from '../../src/sim/runner'; import { SaveCodecError } from '../../src/sim/saveCodec'; import type { SaveData, SaveCommand } from '../../src/sim/types'. Cases: (a) migrate — a valid v1 SaveData (build via new SimRunner(42).getSaveData()) passes through migrateSave unchanged and returns version === SAVE_VERSION; migrateSave(version &lt; 1, e.g. {version:0} or {version:'hi'}) throws SaveCodecError with code 'migrate-invalid-version'; migrateSave(version &gt; SAVE_VERSION, e.g. {version:2}) throws SaveCodecError with code 'save-version-too-new'; migrateSave is pure (no Math.random/Date.now — determinism rule). (b) validate — a valid SaveData (runner.getSaveData()) → {ok:true}; each corrupt case returns a TYPED {ok:false,error} (never a throw): seed NaN / string → 'non-finite-seed'; tickCount NaN → 'non-finite-tick-count'; mapSize NaN → 'non-finite-map-size'; version mismatch → 'invalid-version'; commands not an Array (e.g. {} or 'x') → 'commands-not-array'; an unknown kind ({kind:'bogus'}) → 'unknown-command-kind'; a malformed known command ({kind:'setPolicy'} missing taxRate/wageRate, or {kind:'place'} missing x/y/type, or {kind:'takeLoan'} with non-finite amount) → 'malformed-command'. For each corrupt case assert error.type is the exact union member. (c) round-trip WITH the codec in the loop (mirror research test harness): new SimRunner(777); placeBuilding('road',3,3)/('road',3,4)/('house',3,5); setPolicy(0.1,0.2); tick 500; const original = runner.getStateJson(); const migrated = migrateSave(runner.getSaveData()); expect(validateSave(migrated).ok).toBe(true); const loaded = SimRunner.fromSaveData(migrated as SaveData); expect(loaded.getStateJson()).toBe(original).
    2. NEW tests/unit/options.test.ts (REQ PERS-02). Target import: { loadOptions, saveOptions, OPTIONS_KEY } from '../../src/game/options'; import { DEFAULT_OPTIONS, type OptionsSchema } from '../../src/sim/ui'; import type { StorageLike } from '../../src/game/save'. Reuse a local memStore() (Map-backed StorageLike factory from save.test.ts:5-12). Cases: (a) saveOptions(DEFAULT_OPTIONS, store) → {ok:true} and store.getItem(OPTIONS_KEY) === 'rcb.options' payload; loadOptions(store) equals DEFAULT_OPTIONS (round-trip). (b) missing key → loadOptions returns DEFAULT_OPTIONS. (c) corrupted JSON under the key → loadOptions returns DEFAULT_OPTIONS (deserializeOptions catch). (d) partial stored value ({ textSize:'large' }) → loadOptions merges with defaults (textSize large, audioMusic stays 0.6, reducedMotion false). (e) forward-compat — a stored object carrying an extra unknown field ({...DEFAULT_OPTIONS, someFutureField: 7}) round-trips through saveOptions/loadOptions preserving the unknown field at the data level (mergeOptions spread semantics). (f) a full custom schema (graphicsQuality high, audioMusic 0.2, audioSfx 0.5, gameSpeedDefault 2, textSize large, reducedMotion true) round-trips exactly.
    3. EXTEND tests/unit/save.test.ts (REQ PERS-01) — add a loadSavedGame describe. Import { loadSavedGame } from '../../src/game/save'. Cases: (a) empty store → {ok:false,error:'read'}; (b) corrupt JSON under SAVE_KEY ('{not valid json') → {ok:false,error:'parse'}; (c) writeSave(fakeSave) then loadSavedGame → {ok:true} with data.seed 42 and data.tickCount 123 (data unchanged); (d) a stored record whose data.version is 0 (hand-set) → {ok:false,error:'migrate'} with a reason string; (e) a stored record with version 1 but structurally invalid (commands: 'x' or seed: NaN via an object cast) → {ok:false,error:'validate'} with the SaveValidationError reason. Keep the existing write/read/makeRecord asserts intact (they are the meta-listening surface that stays tolerant).
    4. EXTEND tests/determinism/determinism.test.ts (REQ PERS-01) — in the existing 'save/load round-trips a seed-generated map to a byte-identical state' case (:29-42): after `const original = runner.getStateJson();` insert `const migrated = migrateSave(runner.getSaveData()); expect(validateSave(migrated).ok).toBe(true);` and change `SimRunner.fromSaveData(runner.getSaveData())` to `SimRunner.fromSaveData(migrated as SaveData)` so the codec is exercised in the byte-identity round-trip across systems (map gen + roads + policy + ticks). Add the two imports at the top. No other determinism suite is modified.
    5. EXTEND tests/unit/time.test.ts (REQ PERS-02) — add a boot-default-speed describe: (a) const ts = new TimeSystem(100); ts.setSpeed(gameSpeedDefault = 2 from OptionsSchema semantics); expect(ts.speed).toBe(2); (b) after applying a boot default, a later explicit ts.setSpeed(8) wins — expect(ts.speed).toBe(8) — proving the default is applied once and never re-applied per tick (Pitfall 6); (c) ts.setSpeed(0) or ts.setSpeed(NaN) still throws RangeError (existing contract preserved).
    6. NEW e2e/settings.spec.ts (REQ PERS-02). Import { openGame } from './helpers'. Capture page.on('pageerror')/page.on('console') into an errors array asserted toEqual([]) at the end (placement.spec.ts precedent). Cases: (a) control-bar button controls-settings exists and clicking it reveals the drawer (data-testid "settings-drawer") with the five controls (opt-graphics, opt-music, opt-sfx, opt-speed, opt-text-size, opt-reduced-motion); (b) toggle opt-text-size to 'large' and check opt-reduced-motion, click settings-save (data-testid), expect toastText contains 'Options saved'; (c) persistence — page.reload(), reopen the drawer, and assert opt-text-size still shows 'large', opt-reduced-motion still checked, and document.body has data-text-size="large" + data-reduced-motion="true"; defaults fallback — with a clean storage the drawer shows medium/0.6/0.8/1/normal/false. These are the TARGET Phase-19 data-testids and rcb.options behaviour — RED until 19-02-01/02/03 implement them.
    These scaffolds intentionally reference APIs delivered later (migrateSave/validateSave/SAVE_VERSION/SaveCodecError, loadSavedGame, loadOptions/saveOptions/applyOptions/OPTIONS_KEY, controls-settings/settings-drawer/opt-*/settings-save testids, body[data-text-size]/[data-reduced-motion]). They are expected RED until the implementing tasks flip them green.
  </action>
  <verify>
    <human-check>Wave 0 is complete when the six files exist/extend against the Phase-19 target APIs; the new/extended cases are expected RED (their implementing modules land in Waves 1-2) and full `npm run typecheck` is red-but-expected for the same reason (see typecheck sequencing note above).</human-check>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && test -f tests/unit/saveCodec.test.ts && test -f tests/unit/options.test.ts && test -f e2e/settings.spec.ts && grep -q "loadSavedGame" tests/unit/save.test.ts && grep -q "migrateSave" tests/determinism/determinism.test.ts && grep -q "gameSpeedDefault" tests/unit/time.test.ts</automated>
  </verify>
  <acceptance_criteria>tests/unit/saveCodec.test.ts, tests/unit/options.test.ts and e2e/settings.spec.ts exist and are discovered by the vitest/playwright include globs; tests/unit/save.test.ts carries the loadSavedGame target-surface cases; tests/determinism/determinism.test.ts routes the seed round-trip through migrateSave+validateSave; tests/unit/time.test.ts carries the boot-default-speed cases; every case pins the target API surface and is RED where its implementing wave has not landed.</acceptance_criteria>
  <done>The Wave-0 scaffolds exist/extend against the Phase-19 APIs (saveCodec, options store, loadSavedGame, determinism-with-codec, boot speed, settings e2e), are discovered by the runners, and are RED only where their implementing waves have not yet landed.</done>
</task>

<!-- ===================== WAVE 1 (PERS-01) — versioned save/load ===================== -->

<task type="tracer">
  <name>Task 19-01-01: Tracer — saveCodec (SAVE_VERSION + additive migrateSave + validateSave) + loadSavedGame() + HomeScene validated load click-through (one PERS-01 path end-to-end)</name>
  <files>src/sim/saveCodec.ts, src/game/save.ts, src/game/scenes/HomeScene.ts, tests/unit/saveCodec.test.ts, tests/unit/save.test.ts</files>
  <read_first>
    - src/sim/ui.ts:79-113 (OptionsSchema/DEFAULT_OPTIONS/mergeOptions/serializeOptions/deserializeOptions — the pure-codec precedent saveCodec.ts mirrors)
    - src/sim/advisors.ts:117-149 (advisorsFrom — additive/conditional-field projection style for the migration chain)
    - src/sim/types.ts:74-99 (the SaveCommand union — the exhaustive kind set validateSave pre-empts), :101-113 (SaveData envelope: version/seed/mapSize/commands/pendingCommands?/paused?/tickCount/savedAt)
    - src/sim/runner.ts:2635-2649 (getSaveData — writes version 1), :2662-2678 (fromSaveData — replays save.commands at tick 0 with ZERO guards; MUST NOT be modified), :3288-3290 (applyCommand's raw 'unknown command kind' throw — the last-resort net validateSave pre-empts)
    - src/game/save.ts:10-15 (StorageLike), :29 (SaveResult discriminated union), :40-45 (memoryStorage/defaultStorage), :60-71 (readSave + its truthiness version check at :66 — the guard to REPLACE on the load path), :74-81 (writeSave)
    - src/game/scenes/HomeScene.ts:84-101 (the load section: listSaves meta label + unguarded loadBtn click → this.loadSavedGame(save.data)), :127-129 (private loadSavedGame — the unguarded scene.start to replace)
    - 19-PATTERNS.md saveCodec.ts + save.ts + HomeScene.ts sections (edit-at-rate-of-change guidance), 19-RESEARCH.md Pattern 1 + 2 + Pitfall 1 + 2
  </read_first>
  <behavior>
    - Test 1: migrateSave(v1 SaveData) passes through unchanged; version&lt;1 / version&gt;SAVE_VERSION throw typed SaveCodecError; validateSave rejects the corrupt cases (non-finite, commands-not-array, unknown kind, malformed) with typed {ok:false} — NO raw throw (saveCodec.test.ts).
    - Test 2: loadSavedGame() = read→parse→migrate→validate; a valid v1 writeSave→loadSavedGame returns {ok:true} with data intact; corrupt/migrate/validate failures return {ok:false, error, reason} (extended save.test.ts).
    - Test 3: HomeScene load click-through routes through loadSavedGame() — only an ok save reaches scene.start('Main',{save}); the sessions e2e 'load resumes the same city' stays green with the codec in the path.
  </behavior>
  <action>
    Build the PERS-01 tracer slice — the pure save codec + the validated read path + the HomeScene hookup, proven end-to-end (decision PERS-01). This is production code for keeps; the migration map is empty today (v1 current) but the infrastructure must be test-proven and additive-ready:

    1. NEW src/sim/saveCodec.ts (pure, browser-free, node-testable; import type { SaveData, SaveCommand } from './types'). Export:
       - `export const SAVE_VERSION = 1 as const;`
       - `export class SaveCodecError extends Error { constructor(public readonly code: 'migrate-invalid-version' | 'migrate-not-supported' | 'save-version-too-new', message?: string) { super(message ?? code); this.name = 'SaveCodecError'; } }` — typed, module-local, exported for loadSavedGame to map to a typed result.
       - `const MIGRATIONS: Record<number, (save: unknown) => unknown> = {};` — the additive N→N+1 chain, indexed by from-version. TODAY empty (v1 is current). Add a header comment: a future v2 schema change adds `MIGRATIONS[1] = (s) => ({ ...s, version: 2 } as SaveDataV2)` and bumps SAVE_VERSION — each step must be additive (spread + new optional fields), never rename/drop existing fields.
       - `export function migrateSave(data: unknown): SaveData` — per RESEARCH Pattern 1: read `(data as {version?: unknown}).version`; if typeof !== 'number' || !Number.isInteger(v) || v &lt; 1 throw new SaveCodecError('migrate-invalid-version'); let current = data as Record&lt;string,unknown&gt;; while (current.version as number) &lt; SAVE_VERSION { const step = MIGRATIONS[current.version as number]; if (!step) throw new SaveCodecError('migrate-not-supported'); current = step(current) as Record&lt;string,unknown&gt;; } if ((current.version as number) &gt; SAVE_VERSION) throw new SaveCodecError('save-version-too-new'); return current as unknown as SaveData.
       - `export type SaveValidationError = 'invalid-version' | 'missing-field' | 'non-finite-seed' | 'non-finite-tick-count' | 'non-finite-map-size' | 'commands-not-array' | 'unknown-command-kind' | 'malformed-command';`
       - `export function validateSave(data: unknown): { ok: true; data: SaveData } | { ok: false; error: SaveValidationError; reason: string }` — validate BEFORE any replay (RESEARCH Pattern 2; mirrors the PlacementResult/SaveResult discriminated-union convention):
         - version: a number === SAVE_VERSION and integer, else 'invalid-version'.
         - seed/mapSize/tickCount: typeof 'number' && Number.isFinite, else their specific nonzero codes; absent fields → 'missing-field'.
         - commands: Array.isArray, else 'commands-not-array'.
         - every command: plain object with a `kind` in the SaveCommand union — place/setPolicy/demolish/requestRoyalSubsidy/takeLoan/repayLoan/holdFestival/setGovernorSalaryLevel/donateToGovernor/deliverGoods/payRequest/openTradeRoute/setTradeOrder/respondEvent/startMission/dismissTutorialStep. Unknown kind → 'unknown-command-kind'. For each known kind check the union-shaped fields: place → finite x/y numbers + a type in BuildingType; setPolicy → finite taxRate/wageRate; demolish → finite x/y; takeLoan/repayLoan/donateToGovernor/payRequest → finite amount (or requestId string for payRequest); holdFestival → string tierId; setGovernorSalaryLevel → finite level; deliverGoods → string requestId/good + finite qty; openTradeRoute → string cityId; setTradeOrder → string cityId/good + reserve/target finite when present; respondEvent → string eventId/choiceId; startMission → string id + finite year; dismissTutorialStep → string step. Missing/invalid member → 'malformed-command'.
         - NEVER throws — always a typed {ok:false,error,reason} with a human-readable reason string the Home UI can surface.
       - Do NOT touch runner.ts/fromSaveData (the dozens of determinism call sites stay identical); applyCommand's raw throw (runner.ts:3288-3290) remains untouched as the last-resort safety net.
    2. MODIFY src/game/save.ts: add
       - `export type LoadResult = { ok: true; data: SaveData } | { ok: false; error: 'read' | 'parse' | 'migrate' | 'validate'; reason?: string };`
       - `export function loadSavedGame(storage: StorageLike = defaultStorage()): LoadResult` — read storage.getItem(SAVE_KEY); null/missing → {ok:false,'read'}; JSON.parse in try/catch → {ok:false,'parse'}; call migrateSave(parsed.data) in try/catch — on SaveCodecError return {ok:false,'migrate',reason:e.message}; then validateSave(migrated) — {ok:false,'validate',reason} on failure, else {ok:true,data:migrated}. This REPLACES the readSave truthiness behavior on the loading path (research Pitfall 1). Keep readSave/listSaves as the tolerant meta-listing surface (home-screen label uses the meta only; validation happens on click-through).
    3. MODIFY src/game/scenes/HomeScene.ts: in buildDom()'s load section (:84-101), keep listSaves() ONLY to decide whether a load candidate exists at all, but change the click handler and the private loadSavedGame (:127-129):
       - `private loadSavedGame(): void { const res = loadSavedGame(); if (res.ok) { this.scene.start('Main', { save: res.data }); } else { this.showLoadError(res); } }` (import loadSavedGame from '../save').
       - On {ok:false}: set `loadBtn.disabled = true` and `loadBtn.textContent = 'Save rejected: ' + (res.reason ?? res.error)` via textContent — sim/storage-derived strings never hit innerHTML (HomeScene buildDom already uses createElement/textContent; keep the DOM pattern).
       - The load button should call `this.loadSavedGame()` (no argument) and the current `loadSavedGame(save.data)` signature is removed/replaced.
    4. Flip green tests/unit/saveCodec.test.ts and the loadSavedGame block in tests/unit/save.test.ts. The sessions e2e save→load flow ('load resumes the same city') MUST stay green — that is the tracer's end-to-end proof that the codec sits in the real Home→Main load path without breaking determinism.
    Discretion resolved here (CONTEXT §the agent's Discretion): no-op migration map today (empty MIGRATIONS, v1 current) + the migration/validation infrastructure + tests proving forwards-compat; typed reason strings are human-readable short phrases ('unknown command kind: name', 'seed must be a finite number', 'commands must be an array').
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npx vitest run tests/unit/saveCodec.test.ts tests/unit/save.test.ts -x && npx playwright test e2e/sessions.spec.ts -g "load resumes the same city"</automated>
  </verify>
  <acceptance_criteria>src/sim/saveCodec.ts exports SAVE_VERSION=1, SaveCodecError (typed code), migrateSave (additive N→N+1, version-bounds rejects), and validateSave (typed SaveValidationError result, never throws: non-finite seed/tickCount/mapSize, commands-not-array, unknown-command-kind, malformed-command); loadSavedGame() in save.ts returns the typed LoadResult read→parse→migrate→validate; HomeScene routes the load click-through through loadSavedGame() (ok → scene.start('Main',{save}), failure → disabled button + 'Save rejected: reason' via textContent, never innerHTML); saveCodec.test.ts + the loadSavedGame block in save.test.ts pass; the sessions e2e load flow stays green; typecheck green except the declared-red Wave-0 scaffolds.</acceptance_criteria>
  <done>PERS-01's tracer is live: a corrupt/unknown-version save is rejected with a typed reason (or migrated additively) before replay, the HomeScene load path is validated end-to-end, the determinism round-trip still holds, and the codec infrastructure is test-proven and additive-ready.</done>
  <reversibility rating="reversible">The save codec is additive and version 1 stays current — existing saves remain valid and reverting/editing the empty MIGRATIONS map loses nothing (no data migration of existing records).</reversibility>
</task>

<task type="auto">
  <name>Task 19-01-02: MainScene defense-in-depth validation + HomeScene corrupt-save rejection surface + determinism round-trip WITH the codec in the loop</name>
  <files>src/game/scenes/MainScene.ts, src/game/scenes/HomeScene.ts, tests/determinism/determinism.test.ts</files>
  <read_first>
    - src/game/scenes/MainScene.ts:34 (runtimeConfig type), :64-72 (init — sets {save: data.save}), :79-86 (create — the 'save' in runtimeConfig branch that calls SimRunner.fromSaveData unguarded; the branch to guard), :315-318 (setSpeed — reused in Wave 2 for the boot default)
    - src/game/scenes/HomeScene.ts:84-101 (loadBtn DOM + attrs set in buildDom), :127-129 (the private loadSavedGame — this task finishes the {ok:false} surface started in 19-01-01 if it was stubbed)
    - tests/determinism/determinism.test.ts:29-42 (the round-trip case extended in Wave 0 with migrateSave/validateSave — this task flips it green; :1-4 imports)
    - 19-RESEARCH.md Pitfall 2 (fromSaveData zero guards / corrupt save must not reach replay) + Pattern 2 (validation-on-read at every boundary — HomeScene + MainScene defense-in-depth)
  </read_first>
  <behavior>
    - Test 1: MainScene.create() on a `save` runtimeConfig runs migrate/validate FIRST; a valid migrated save constructs via SimRunner.fromSaveData as today; an invalid save emits a hud-toast 'Save rejected: reason' and falls back to a fresh seed city — never a raw throw (covered by unit/e2e; determinism round-trip governs the valid path).
    - Test 2: HomeScene load button, on loadSavedGame() {ok:false}, is disabled with 'Save rejected: reason' textContent (extended save.test.ts + HomeScene behaviour).
    - Test 3: the extended determinism round-trip (migrateSave+validateSave in the loop) passes — byte-identical replay holds WITH the codec, across map gen + roads + policy + 500 ticks.
  </behavior>
  <action>
    Complete PERS-01 with boundary defense-in-depth and the codec-in-loop determinism proof (decision PERS-01):

    1. MODIFY src/game/scenes/MainScene.ts create() (:79-86): before the `'save' in this.runtimeConfig ? SimRunner.fromSaveData(this.runtimeConfig.save)` branch, run the codec on the incoming save:
       - try { const migrated = migrateSave(this.runtimeConfig.save as unknown); const checked = validateSave(migrated); } catching SaveCodecError / reading the validate result.
       - If valid ({ok:true}): construct `SimRunner.fromSaveData(checked.data)` exactly as today (the migrated, validated SaveData).
       - If invalid ({ok:false}) or migrate throws: this.game.events.emit('hud-toast', `Save rejected: ${reason ?? error}`) and fall back to a fresh city via `new SimRunner(seedFromUrl(), undefined, CONFIG.defaultMapSize)` (same seam the no-save path uses at MainScene.ts:76-77/84) — the scene never crashes and no unvalidated command ever reaches applyCommand. Import { migrateSave, validateSave } from '../../sim/saveCodec'; this is defense-in-depth over the HomeScene gate (a save can enter MainScene from any future path — ?save= URL, dev e2e, future slot quickload).
       - Do NOT modify toBuildingState/getStateJson/fromSaveData; fromSaveData stays the single replay engine.
    2. MODIFY src/game/scenes/HomeScene.ts (complete the 19-01-01 rejection surface if it was minimal): when loadSavedGame() returns {ok:false} at click time, ensure the button is `loadBtn.disabled = true` and `loadBtn.textContent = 'Save rejected: ' + (res.reason ?? res.error)` (textContent — sim/storage-derived strings never hit innerHTML). Assert both paths in the Home UI: an ok save resumes (sessions e2e), a rejected save disables the button with the reason visible.
    3. MODIFY tests/determinism/determinism.test.ts (already extended in Wave 0): flip the codec-in-loop round-trip green (the imports + migrateSave/validateSave calls added in 19-00-01 compile and pass now that saveCodec.ts exists). No other determinism/golden suite changes; the golden fixtures must stay untouched.
    Discretion resolved here: the fresh-city fallback on an invalid save (a toast + new city) is the concrete no-crash behavior; CONFIG.defaultMapSize is the same default the no-save path uses.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npx vitest run tests/determinism/determinism.test.ts tests/unit/saveCodec.test.ts tests/unit/save.test.ts -x</automated>
  </verify>
  <acceptance_criteria>MainScene.create() validates/migrates a `save` runtimeConfig before SimRunner.fromSaveData (valid → replay; invalid → hud-toast reason + fresh seed fallback, no raw throw, no unvalidated command into applyCommand); HomeScene disables the load button and surfaces 'Save rejected: reason' via textContent on {ok:false}; the determinism round-trip WITH migrate+validate passes byte-identically; fromSaveData/getStateJson/applyCommand untouched; no golden change.</acceptance_criteria>
  <done>PERS-01 is complete: every save entry (HomeScene click-through + MainScene.create() defense-in-depth) is authenticated by migrate+validate before replay, corrupt saves are rejected with a typed reason surfaced in the UI (never a silent load / raw throw), and the determinism suite proves byte-identical reload WITH the codec in the loop.</done>
</task>

<!-- ===================== WAVE 2 (PERS-02) — options & accessibility ===================== -->

<task type="auto">
  <name>Task 19-02-01: Options module (rcb.options store) + thin audio mix seam + boot-time RenderConfig mapping read before new Phaser.Game</name>
  <files>src/game/options.ts, src/game/audio.ts, src/game/save.ts, src/game/main.ts, tests/unit/options.test.ts</files>
  <read_first>
    - src/sim/ui.ts:79-113 (OptionsSchema/DEFAULT_OPTIONS/mergeOptions/serializeOptions/deserializeOptions — the codec to WIRE; deserializeOptions already defaults on null/corrupt and merges forward-compat)
    - src/game/save.ts:10-15 (StorageLike), :29 (SaveResult — the typed result union options.ts reuses), :31-45 (defaultStorage()/memoryStorage — make defaultStorage EXPORTED so options.ts reuses it, don't reimplement), :74-81 (writeSave try/catch pattern to mirror)
    - src/game/main.ts:13-21 (the Phaser.Game constructor with render: {preserveDrawingBuffer:true} — the ONLY place RenderConfig can be set; must read options BEFORE construction)
    - node_modules/phaser/types/phaser.d.ts:72768-72837 (RenderConfig — antialias/pixelArt/roundPixels applied at context creation, context-creation-only) and :104901-104915 (SoundManager setMute/setVolume global-only — per-bus mix is app-side)
    - 19-RESEARCH.md Pattern 3 (options as persisted shell state with a boot-time apply dispatch), Pitfall 3 (RenderConfig context-creation-only), Pitfall 4 (SoundManager global-only), Pitfall 5 (options never in SaveData/getStateJson), Architectual Responsibility Map (Browser/Client tiers)
  </read_first>
  <behavior>
    - Test 1: saveOptions/loadOptions round-trip under the 'rcb.options' key via a Map-backed memStore; missing/corrupt store → DEFAULT_OPTIONS; partial stored value merges with defaults; unknown future fields preserved (options.test.ts).
    - Test 2: OPTIONS_KEY 'rcb.options' is disjoint from SAVE_KEY 'rcb.save' — the two stores coexist and options never enter SaveData/getStateJson (asserted via the golden-byte contract in 19-03-01).
    - Test 3: main.ts maps graphicsQuality → RenderConfig booleans from loadOptions() BEFORE new Phaser.Game (low → antialias:false+roundPixels:true; high → antialias:true); applyOptions sets body[data-text-size]/[data-reduced-motion] + the audio mix.
  </behavior>
  <action>
    Wire PERS-02's persistence + boot application (decision PERS-02; the options schema already exists in ui.ts — this task makes it functional):
    1. MODIFY src/game/save.ts: make `defaultStorage()` exported (`export function defaultStorage(): StorageLike`) so the options layer reuses it (research 'Don't Hand-Roll': reuse StorageLike/SaveResult/defaultStorage, never reimplement).
    2. NEW src/game/options.ts (Browser/Client shell state, mirrors save.ts layering; import { DEFAULT_OPTIONS, deserializeOptions, mergeOptions, serializeOptions, type OptionsSchema } from '../sim/ui' and type { StorageLike, SaveResult } + defaultStorage from './save'):
       - `export const OPTIONS_KEY = 'rcb.options';`
       - `export function loadOptions(storage: StorageLike = defaultStorage()): OptionsSchema { try { return deserializeOptions(storage.getItem(OPTIONS_KEY)); } catch { return { ...DEFAULT_OPTIONS }; } }` — deserializeOptions already returns defaults on null/corrupt and merges unknown future fields (forward-compat).
       - `export function saveOptions(o: OptionsSchema, storage: StorageLike = defaultStorage()): SaveResult { try { storage.setItem(OPTIONS_KEY, serializeOptions(o)); return { ok: true }; } catch { return { ok: false, error: 'write' }; } }`
       - `export function applyOptions(o: OptionsSchema): void { document.body.dataset.textSize = o.textSize; document.body.dataset.reducedMotion = String(o.reducedMotion); setMusicVolume(o.audioMusic); setSfxVolume(o.audioSfx); }` — touches view/shell ONLY (body data-attrs + the audio seam); NEVER the sim. gameSpeedDefault is applied separately at MainScene boot (19-02-02), NOT here (Pitfall 6 — the boot default must be applied once at scene create, not in a generic apply dispatch).
    3. NEW src/game/audio.ts (thin mix seam; no assets — A2/§48 full audio deferred v2): module-level `const mix = { music: 0.6, sfx: 0.8 };`; `export function setMusicVolume(v: number): void { mix.music = v; }`; `export function setSfxVolume(v: number): void { mix.sfx = v; }` (store the per-bus multipliers; Phaser's SoundManager is global-only — per-sound volume is app-side at play time); `export function play(kind: 'music' | 'sfx', game: Phaser.Game): void { /* doc comment: when §48 assets land, game.sound.add(...) then (s as Phaser.Sound.BaseSound).setVolume(mix[kind]); today no-op seam */ }` — the persistent multipliers + seam signature ARE the PERS-02 deliverable (Pitfall 4).
    4. MODIFY src/game/main.ts: at the TOP of the module, `const options = loadOptions();` (before the `new Phaser.Game` at :13) and map graphicsQuality → the existing render config:
       - low → `render: { preserveDrawingBuffer: true, antialias: false, roundPixels: true }`
       - medium → `render: { preserveDrawingBuffer: true }` (unchanged today's default)
       - high → `render: { preserveDrawingBuffer: true, antialias: true }`
       Keep width/height/backgroundColor/scene identical. After the Game is constructed (document.body exists at module load in the browser entry), call applyOptions(options) once to set the body[data-text-size]/[data-reduced-motion] attrs + the audio mix. A quality change PERSISTS immediately but APPLIES at the next boot (context-creation-only — RESEARCH Pitfall 3); the settings UI must say so (19-02-03).
    5. Flip green tests/unit/options.test.ts (the rcb.options round-trip + defaults + forward-compat cases scaffolded in 19-00-01). Confirm `options.test.ts`, `save.test.ts` and the determinism suites pass together; `npm run typecheck` is now green for the option-store modules (the 19-02-03 drawer testids are the only remaining red).
    Discretion resolved here (CONTEXT): OPTIONS_KEY='rcb.options' (disjoint from rcb.save/rcb.quicksave/rcb.autosave.* per the runtime-state inventory); applyOptions is the single shell dispatch (body attrs + audio), distinct from the MainScene boot-speed injection.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/unit/options.test.ts tests/unit/ui.test.ts tests/unit/save.test.ts -x</automated>
  </verify>
  <acceptance_criteria>src/game/options.ts exports OPTIONS_KEY='rcb.options', loadOptions (defaults+merge on missing/corrupt/partial), saveOptions (typed SaveResult), applyOptions (body data-attrs + audio mix, never the sim); src/game/audio.ts exports setMusicVolume/setSfxVolume/play as a persistent no-asset mix seam; main.ts reads options BEFORE new Phaser.Game and maps graphicsQuality → RenderConfig (low/medium/high); defaultStorage is exported from save.ts and reused; options.test.ts passes; options never enter SaveData/getStateJson (golden-byte contract intact).</acceptance_criteria>
  <done>PERS-02's backend half is wired: options persist under rcb.options (disjoint from saves, forward-compat merge), apply on boot (RenderConfig at construction + body data-attrs + audio mix seam) without ever touching the deterministic sim.</done>
  <reversibility rating="reversible">Options persist under a brand-new rcb.options key completely separate from the save envelope; removing/reverting the module only discards shell preferences, never the sim state or a save.</reversibility>
</task>

<task type="auto">
  <name>Task 19-02-02: gameSpeedDefault applied once at MainScene boot (fresh + loaded) with HUD overrides preserved + boot-speed test</name>
  <files>src/game/scenes/MainScene.ts, src/game/scenes/HUDScene.ts, tests/unit/time.test.ts</files>
  <read_first>
    - src/game/scenes/MainScene.ts:79-86 (create() — runs for BOTH fresh-seed and loaded paths; the single place to apply gameSpeedDefault once after runner construction), :315-318 (setSpeed → timeSystem.setSpeed)
    - src/sim/time.ts:35 (TimeSystem.speed), :61-66 (setSpeed RangeError on non-positive/non-finite — gameSpeedDefault from SPEED_PRESETS is always valid but guard defensively), :79 (SPEED_PRESETS = [0.5,1,2,4,8])
    - src/game/scenes/HUDScene.ts:377-387 (the hardcoded [0.5,1,2,4,8] speed buttons that continue to override the LIVE speed afterward — Pitfall 6: never re-apply the default per tick)
    - tests/unit/time.test.ts:32-36,92-106 (setSpeed tests — the boot-default-speed extension target from 19-00-01)
    - 19-RESEARCH.md Pitfall 6 (speed applied at three levels — the default at boot only) + 19-PATTERNS.md 'Speed — one boot-time injection, HUD overrides'
  </read_first>
  <behavior>
    - Test 1: MainScene.create() calls setSpeed(loadOptions().gameSpeedDefault) exactly once for both fresh-seed and loaded cities → timeSystem.speed equals the option default (extended time.test.ts boot-default case).
    - Test 2: a later explicit HUD setSpeed(8) overrides — the boot default is never re-applied per tick (Pitfall 6), asserted against the TimeSystem contract.
  </behavior>
  <action>
    Wire the gameplay option (decision PERS-02, gameSpeedDefault): apply it once at boot so a persisted default speed is functional for both a fresh city and a loaded city, without fighting the HUD's live speed controls:
    1. MODIFY src/game/scenes/MainScene.ts create(): after the runner construction block (:79-86) and before the rest of create() builds the scene, call `this.setSpeed(loadOptions().gameSpeedDefault)` — this runs for BOTH the fresh-seed path and the loaded path (create() is the shared entry; the runtimeConfig is consumed first). Guard defensively: only call setSpeed when the value is a positive finite number (SPEED_PRESETS member) so a hand-edited options value cannot trigger the time.ts:61-66 RangeError. Import { loadOptions } from '../options'.
       - Do NOT re-apply the default on tick, on pause/resume, or on any subsequent event — the HUD speed buttons (HUDScene.ts:377-387) own the LIVE speed after boot (Pitfall 6). No change to HUDScene needed for this task beyond confirming the existing buttons are untouched.
    2. MODIFY tests/unit/time.test.ts: flip green the boot-default-speed cases scaffolded in 19-00-01: (a) setSpeed(2) from a gameSpeedDefault-like value → ts.speed === 2; (b) after a boot-default-style setSpeed(1), an explicit later setSpeed(8) wins (ts.speed === 8) — the once-only contract; (c) setSpeed(0)/setSpeed(NaN) still throw RangeError (existing contract preserved).
    3. Confirm MainScene still constructs for both paths (the unit suites that build runners/scenes stay green) and the golden/determinism suites are untouched (speed is view shell state, not sim state).
    Discretion resolved here: the boot default is injected in MainScene.create() for both paths (research Open Question 4 — no fresh-vs-loaded difference); a defensive positive-finite guard prevents a corrupted options value from taking down boot.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/unit/time.test.ts -x</automated>
  </verify>
  <acceptance_criteria>MainScene.create() applies setSpeed(loadOptions().gameSpeedDefault) exactly once for BOTH fresh-seed and loaded paths (defensive finite check); the HUD [0.5,1,2,4,8] buttons still override the live speed afterward and the default is never re-applied per tick; time.test.ts boot-default cases pass; RangeError contract preserved.</acceptance_criteria>
  <done>The gameSpeedDefault option is functional: a persisted default speed boots the sim at that speed for a fresh city AND a loaded city, while the HUD speed controls keep full control of live speed.</done>
  <reversibility rating="reversible">The boot default is a single one-time injection in create(); editing or removing it does not change sim determinism/goldens (speed is view-shell state).</reversibility>
</task>

<task type="auto">
  <name>Task 19-02-03: Settings drawer (control-bar button + opt-* controls editing+persisting) + text-size/reduced-motion CSS seams + settings e2e green</name>
  <files>src/game/scenes/HUDScene.ts, index.html, e2e/settings.spec.ts</files>
  <read_first>
    - src/game/scenes/HUDScene.ts:262-280 (the control-bar buttons — add a 4th Settings button to this row), :283-312 (the advisors drawer frame pattern to copy for the settings drawer), :371-406 (speed row + pause overlay + toast; the draw conventions), :475-497 (game.events on()/off() — WR-04 cleanup in SHUTDOWN for any new listeners), :508-528 (toggleAdvisorsDrawer/toggleOverlayBar — the force??!open + display block/none + game.events.emit pattern to mirror for the settings drawer), :691-695 (saveGame → writeSave + showToast('Game saved') — the save+toast pattern the settings Save button mirrors), :739 (the textContent rule — sim-derived strings never hit innerHTML)
    - index.html (the HUD CSS block :7-545: .advisor-drawer, token umber rgba(40,28,14,0.9) / bronze #7a6234 / gold #e8c46b — the .settings-drawer block copies these tokens; add the two data-attribute seams below)
    - src/sim/time.ts:79 (SPEED_PRESETS — the default-speed select options)
    - src/game/options.ts (from 19-02-01: loadOptions/saveOptions/applyOptions/OPTIONS_KEY) — the drawer's data source and save target
    - e2e/settings.spec.ts (the toggle→save→reload→persist cases scaffolded in 19-00-01) and e2e/helpers.ts:102-107 (toastText)
    - 19-RESEARCH.md Code Examples (HUD settings-panel slot: opt-graphics/opt-music/opt-sfx/opt-speed/opt-text-size/opt-reduced-motion + 'Options saved' toast) + text-size/reduced-motion CSS seams + 19-PATTERNS.md HUDScene.ts section + Shared Patterns (DOM createElement/textContent/data-testid; drawer toggle; game.events off() cleanup)
  </read_first>
  <behavior>
    - Test 1: controls-settings opens the settings drawer with the six opt-* controls (graphics/quality select, music+sfx sliders, default-speed select, text-size select, reduced-motion checkbox) pre-filled from loadOptions() (e2e settings.spec.ts).
    - Test 2: settings-save calls saveOptions() + applyOptions() and shows the 'Options saved' toast; after page.reload() the drawer still shows the persisted values AND document.body carries data-text-size/data-reduced-motion (e2e).
    - Test 3: all drawer labels/values rendered via createElement/textContent (sim-derived strings never hit innerHTML); no new game.events listeners leak across scene restarts (off() in SHUTDOWN).
  </behavior>
  <action>
    Ship the Settings UI and the CSS accessibility seams (decision PERS-02's UI + accessibility surfaces), following the Phase-18 drawer/toggle patterns exactly:
    1. MODIFY index.html: add the two accessibility seams + the settings drawer panel:
       - `body[data-text-size="large"] .hud { font-size: 15px; }` and `body[data-text-size="small"] .hud { font-size: 11px; }`
       - `body[data-reduced-motion="true"] *:not(.hud-toast) { animation: none !important; transition: none !important; }` (non-essential animation suppression; the walker interpolation is essential rendering and untouched — A3)
       - a `.settings-drawer` block copying `.advisor-drawer`'s styling (bottom-center overlay panel, umber background rgba(40,28,14,0.9), bronze border #7a6234, gold accents #e8c46b), plus row/label/input rules and a `.hud-settings-row` for the controls — all reusing the existing tokens, no new palette.
    2. MODIFY src/game/scenes/HUDScene.ts:
       - buildDom() control bar (:262-280): add a 4th button `Settings` (className 'hud-control-btn', data-testid 'controls-settings', textContent 'Settings') appended after messagesBtn in controlBar.append(...); click → this.toggleSettingsDrawer().
       - Build the settings drawer element (data-testid 'settings-drawer', className 'settings-drawer', style.display 'none') following the overlayBar/advisorsDrawer frame pattern (:283-312): a heading 'Settings' + six controls, all createElement + textContent (NEVER innerHTML interpolation — the drawer edits persisted shell strings): graphics select (data-testid opt-graphics, options low/medium/high), music slider (opt-music, 0..1 step 0.1), sfx slider (opt-sfx), default-speed select (opt-speed, options from SPEED_PRESETS [0.5,1,2,4,8] imported from '../../sim/time'), text-size select (opt-text-size, small/normal/large), reduced-motion checkbox (opt-reduced-motion), and a Save button (data-testid settings-save, textContent 'Save'). A short helper note under the graphics row via textContent: 'Graphics quality applies on next launch' (Pitfall 3 — RenderConfig is boot-time).
       - toggleSettingsDrawer(force?: boolean): mirror toggleOverlayBar (:521-528) — `this.settingsOpen = force ?? !this.settingsOpen;` + display block/none + optional this.game.events.emit('settings-open', this.settingsOpen). Register this.els.settingsDrawer / control button in the els map.
       - On open, pre-fill each control from loadOptions(); on settings-save, build an OptionsSchema from the control values, call saveOptions(o) (typed SaveResult — on {ok:false} toast 'Save failed'), applyOptions(o) (sets body data-attrs + audio mix immediately), and showToast('Options saved') — mirroring saveGame(:691-695). If any new gameplay.events listeners are registered, add symmetric off() in the SHUTDOWN handler (:475-497, WR-04).
       - Do NOT touch the HUD speed-row buttons (:377-387) or any other existing control — the settings drawer is additive.
    3. Flip green e2e/settings.spec.ts (the toggle→toast→reload→persist cases scaffolded in 19-00-01): controls-settings opens the drawer; toggling opt-text-size='large' + opt-reduced-motion and clicking settings-save toasts 'Options saved'; page.reload() → drawer shows 'large'/checked AND document.body has data-text-size="large"/data-reduced-motion="true"; clean-storage defaults show medium/0.6/0.8/1/normal/false; pageerror/console errors array is empty at the end.
    Discretion resolved here (CONTEXT): the drawer is a bottom-center overlay panel opened by the 4th control-bar button (Phase-18 pattern); six controls matching the OptionsSchema exactly; the opt-* data-testids from RESEARCH §Code Examples; a 'applies on next launch' note for graphics (documented restart behavior — A4/Pitfall 3).
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/unit/ui.test.ts tests/unit/options.test.ts -x && npx playwright test e2e/settings.spec.ts</automated>
  </verify>
  <acceptance_criteria>controls-settings opens a settings drawer (data-testid settings-drawer) with the six opt-* controls pre-filled from loadOptions(); settings-save persists via saveOptions + applies via applyOptions (body data-attrs + audio mix) with an 'Options saved' toast; after page.reload() the persisted values survive (drawer + body[data-text-size]/[data-reduced-motion]); all labels/values via textContent (never innerHTML); new bus listeners off()'d in SHUTDOWN; e2e/settings.spec.ts passes with zero page errors; ui.test.ts + options.test.ts stay green.</acceptance_criteria>
  <done>PERS-02 is complete: options are functional AND persisted through a Phase-18-pattern Settings drawer, text-size/reduced-motion apply via body[data-*] CSS seams, and e2e proves a toggled option survives a page reload.</done>
</task>

<!-- ===================== WAVE 3 (close) — phase gate ===================== -->

<task type="auto">
  <name>Task 19-03-01: Full suite + typecheck + check:military green with no golden regeneration + migrate/validate load path proven end-to-end (phase close gate)</name>
  <files>none</files>
  <read_first>
    - package.json scripts (test = vitest run; test:unit = unit/integration/determinism/golden/property; typecheck = tsc --noEmit; test:e2e = playwright test; check:military = node scripts/check-military.mjs)
    - 19-VALIDATION.md (Phase Requirements → Test Map + Sign-Off; 19-03-01: Req guard 'No getStateJson change from PERS work; options never in SaveData')
    - 19-RESEARCH.md Pitfall 5 (options byte-identity — options never enter SaveData/getStateJson) + Runtime State Inventory (existing saves remain format-stable; v1 current)
  </read_first>
  <behavior>
    - Test 1: full vitest suite green (unit + integration + determinism + golden + property) with no golden fixture regeneration.
    - Test 2: typecheck green (tsc --noEmit) and check:military green (no military tokens introduced in the new save/options/UI code).
    - Test 3: the e2e suites (settings + sessions + the pre-existing specs) green together against the dev server — proving the migrate+validate path is embedded in the real save→restart→load flow end-to-end.
  </behavior>
  <action>
    Close the phase (success criteria 1-2 + the golden-byte contract). Run the full command set and confirm no golden regeneration:
    1. cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck
    2. NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4  (the 19-VALIDATION.md full-suite command; covers unit/integration/determinism/golden/property)
    3. npm run check:military
    4. npx playwright test  (e2e — dev server via playwright webServer; settings + sessions + the pre-existing specs)
    5. Confirm no golden fixture changed: the work was additive codec + shell-state options + view-only UI — `git status --porcelain tests/golden` must be empty, and the golden/determinism suites pass WITHOUT GOLDEN_UPDATE=1 (options never enter SaveData/getStateJson — Pitfall 5/T-19-04).
    6. Confirm the migrate+validate load path end-to-end: the sessions e2e save→restart→load flow passes WITH the codec in the load path (regression), and the extended determinism round-trip (migrateSave+validateSave in the loop) proves byte-identical reload across systems.
    If any gate is red, fix the offending source (never regenerate goldens unless the change INTENTIONALLY alters serialized state — none of Phase 19 does) and re-run until all four are green together.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4 && npm run check:military && git status --porcelain tests/golden</automated>
  </verify>
  <acceptance_criteria>typecheck, the full vitest suite (unit/integration/determinism/golden/property), check:military, and the e2e suites (settings + sessions + pre-existing) are all green together; `git status --porcelain tests/golden` shows no fixture diffs (no golden regeneration); the migrate+validate load path is proven end-to-end (sessions + determinism round-trip); options never enter SaveData/getStateJson.</acceptance_criteria>
  <done>Phase 19 closes with the full suite + typecheck + check:military green and zero golden changes, proving versioned save/load (migration + validation + deterministic reload) and functional, persisted options/accessibility over the deterministic sim with the golden-byte contract intact — finishing the v1.0 milestone.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| localStorage (rcb.save / rcb.quicksave / rcb.autosave.N) → SimRunner | Untrusted JSON crosses into the deterministic sim: readSave truthiness-checks version only (save.ts:66) and fromSaveData replays save.commands with zero guards (runner.ts:2662-2678) — a corrupt/hostile save would throw a raw 'unknown command kind' or propagate a NaN seed/tickCount. |
| localStorage (rcb.options) → DOM / boot | Options are shell state persisted under their own key; their string values (textSize/reducedMotion) and any reject reasons are rendered into the DOM. |
| Settings drawer + Home load-error UI → document | Option labels/values and save-reject reasons built into the DOM during Phase 19 work. |
| main.ts boot → Phaser RenderConfig | graphicsQuality is mapped into the Game constructor render config — this read must happen BEFORE `new Phaser.Game`, tied to options at load time only. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-19-01 | Tampering | corrupt/hostile localStorage save injected into the sim (unknown command kind, non-finite seed/mapSize/tickCount, commands-not-array, oversized/malformed commands) | high | mitigate | validateSave (typed SaveValidationError) + migrateSave run BEFORE any fromSaveData at BOTH boundaries — loadSavedGame() at the HomeScene click-through AND MainScene.create() defense-in-depth (19-01-01/02); rejections surface 'Save rejected: reason' and never reach replay; applyCommand's raw throw stays as a last-resort net (validated/guarded). ASVS V5. |
| T-19-02 | Tampering | DOM injection via innerHTML interpolation in the new settings drawer or Home load-error surface (localStorage-derived strings rendered as HTML) | high | mitigate | every dynamic label/value/reason created via document.createElement + textContent (Phase-18 convention 'sim-derived strings never hit innerHTML' HUDScene.ts:739); static HTML only in templates; e2e captures pageerror/console and asserts empty (19-02-03, 19-01-01). ASVS V5. |
| T-19-03 | DoS | an oversized or deeply-nested commands array / malformed command structure causing runaway parse or replay cost on load | medium | mitigate | validateSave bounds commands to an Array of known kinds and rejects malformed members before replay; saveCodec operations are linear in command count with no unbounded recursion; a rejected save is returned as a typed {ok:false} and never parsed on replay (19-01-01/02). ASVS V5. |
| T-19-04 | Tampering (logic) | options merged into SaveData/getStateJson/toBuildingState (or SAVE/OPTIONS keys collided) breaking golden byte-identity and the sim determinism contract | high | mitigate | OPTIONS_KEY 'rcb.options' stays disjoint from SAVE_KEY/QUICKSAVE_KEY/AUTOSAVE_PREFIX; applyOptions touches view/shell only; the close gate runs tests/golden + tests/determinism and asserts `git status --porcelain tests/golden` empty (19-02-01, 19-03-01). |
| T-19-05 | Tampering (logic) | settings applied at the wrong seam — RenderConfig toggled at runtime (context-creation-only, silent no-op) or gameSpeedDefault re-applied per tick fighting the HUD speed controls | medium | mitigate | graphicsQuality → RenderConfig mapped in main.ts BEFORE new Phaser.Game only; the settings UI notes 'applies on next launch'; gameSpeedDefault injected once in MainScene.create() (both paths) with the HUD [0.5,1,2,4,8] buttons owning live speed afterward (Pitfall 3/6; 19-02-01/02). |
| T-19-06 | Tampering (logic) | corrupted rcb.options JSON (or a hostile value) reaching boot path and throwing at Game construction or at setSpeed | low | mitigate | deserializeOptions try/catch → DEFAULT_OPTIONS (corrupt → defaults, never a parse throw); the MainScene boot speed is guarded by a positive-finite check so a hand-edited options value cannot trigger time.ts setSpeed RangeError (19-02-01/02). ASVS V5. |
| T-19-SC | Tampering | npm/pip/cargo installs | low | accept | Accepted: this phase installs no packages (19-RESEARCH Package Legitimacy Audit: none — gate not triggered); if a later phase adds one it re-enters the gate. |

## Mitigation Notes for ASVS Level 1
- V5 Input Validation is the key control: the untrusted-input boundary is localStorage JSON entering the sim — validateSave/migrateSave reject malformed/unknown-version saves with a typed error before any replay (T-19-01/03), and localStorage-derived strings reach the DOM only via textContent (T-19-02). Player commands already validate in the runner (setPolicy clamps, PlacementResult).
- V2/V3/V4/V6 are N/A — local offline single-player deterministic sim with no accounts, sessions, access control, or crypto.
</threat_model>

<verification>
- After every task commit: run that task's `<automated>` command. Wave 0's gate is the file-existence + target-surface grep check (the new/extended scaffolds are expected RED and full typecheck is red-but-expected until their implementing modules land — see the typecheck sequencing note above). E2e verify commands use `npx playwright test <file> -g "<pattern>"` (dev server auto-starts via playwright webServer); where a full e2e run is impractical in the execution harness, the pure-function unit tests (saveCodec, options store, loadSavedGame, boot-speed TimeSystem) remain the hard gate and e2e is best-effort with this documented fallback.
- After every wave touching sim (Wave 1): `npm run typecheck` + `npx vitest run tests/determinism/determinism.test.ts tests/unit/saveCodec.test.ts tests/unit/save.test.ts -x` — the codec sits on the load path and the byte-identity round-trip holds WITH it; no golden fixture may change.
- After every wave touching DOM/bootstrap (Wave 2/3): `npm run typecheck` + `npx vitest run tests/unit/options.test.ts tests/unit/ui.test.ts tests/unit/time.test.ts -x` + `npx playwright test e2e/settings.spec.ts` — settings persist across reload and options never enter the sim.
- After every wave: `npm run check:military` green (new save/options/UI copy carries no military tokens — flag any false-positive tokens with the existing doc-mention labelling).
- Wave 3 close: typecheck + full vitest + check:military + full e2e all green together before /gsd-verify-work; `git status --porcelain tests/golden` empty (no golden regeneration); the sessions e2e save→restart→load flow passes WITH the migrate+validate codec in the path.
</verification>

<success_criteria>
1. PERS-01: saves round-trip deterministically with migration and validation — SAVE_VERSION + additive N→N+1 migrateSave + typed validateSave sit on the load path (loadSavedGame() at HomeScene + MainScene.create() defense-in-depth); version 1 stays current (existing saves valid, no schema break); corrupt/unknown-version saves are rejected with a clear typed reason surfaced in the Home UI (never a raw 'unknown command kind' throw, never a silent misload on NaN); the determinism suite proves byte-identical reload WITH the codec in the loop.
2. PERS-02: graphics/audio/gameplay/accessibility options are functional and persisted — options persist under rcb.options (disjoint from saves, forward-compat defaults merge); graphics quality maps to Phaser RenderConfig at boot (read before new Phaser.Game); gameSpeedDefault applies once at MainScene boot for both fresh + loaded cities (HUD buttons override after); text-size/reduced-motion apply via body[data-*] + CSS seams; audio music/SFX mixes persist and apply through the thin audio.ts seam; the Settings drawer (HUD control bar, Phase-18 pattern) edits + persists with an 'Options saved' toast.
3. Options are view/shell state — never in SaveData/getStateJson/toBuildingState; no getState()/SaveData shape change and no golden regeneration anywhere in the phase; existing saves remain format-stable (v1 current).
4. Gates: full suite (unit/integration/determinism/golden/property) + typecheck + check:military + e2e green together; `git status --porcelain tests/golden` empty; the migrate+validate load path proven end-to-end (sessions + settings e2e green).
</success_criteria>

<output>
Create `.planning/phases/19-persistence-options/19-SUMMARY.md` when the phase is done and verified (per the execute-plan workflow / summary template). This closes the v1.0 milestone — the SUMMARY should note the milestone-complete status for the /gsd-complete-milestone flow.
</output>


