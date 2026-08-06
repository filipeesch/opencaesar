# Phase 19: Persistence & Options - Research

**Researched:** 2026-08-06
**Domain:** Versioned save/load (migration + validation + deterministic reload) and functional persisted options/accessibility over a deterministic Phaser 3 + vanilla TS sim
**Confidence:** HIGH (in-repo verification); MEDIUM for the two external Phaser API claims (cross-checked against installed typings this session)

## Summary

Phase 19 delivers the final v1.0 capabilities: **PERS-01** (versioned save/load with migration + validation + deterministic reload) and **PERS-02** (functional, persisted graphics/audio/gameplay/accessibility options with a settings UI). Investigation of the existing implementation shows the **deterministic reload half is already proven** — `getSaveData()`/`fromSaveData()` round-trip across every system (missions, events, objectives, tutorial, government, religion, production, housing, paused queues) and dozens of determinism suites assert byte-identical `getStateJson()` (`tests/determinism/*`, `tests/integration/*`, `tests/unit/*`). What is genuinely **MISSING for PERS-01** is the *infrastructure*: there is **no version check, no migration chain, and no validation** anywhere on the load path. `fromSaveData` replays `save.commands` with zero guards (`[VERIFIED: src/sim/runner.ts:2662-2678]`); `readSave` only truthiness-checks `parsed?.data?.version` (`[VERIFIED: src/game/save.ts:66]`). A corrupt or unknown-version save today either throws a raw `unknown command kind` error from `applyCommand` or silently misbehaves (NaN seed/tickCount).

For **PERS-02**, `OptionsSchema`/`DEFAULT_OPTIONS`/`mergeOptions`/`serializeOptions`/`deserializeOptions` in `src/sim/ui.ts` **exist and are unit-tested but are wired NOWHERE** — the grep across `src/` returns zero consumers outside `ui.ts` itself. There is no localStorage key for options, no renderer-quality control, **no audio at all** (zero sound code in the game), `gameSpeedDefault` is unused (HUD hardcodes `[0.5, 1, 2, 4, 8]` and never sets a boot speed), and there are no text-size or reduced-motion hooks. So PERS-02 is essentially greenfield wiring: a persistence module (separate localStorage key), application seams in the Phaser shell, and a settings panel in the HUD following the Phase 18 drawer/toggle patterns.

**Primary recommendation:** (PERS-01) add a pure, node-testable `src/sim/saveCodec.ts` with `SAVE_VERSION`, an additive N→N+1 `migrateSave` chain, and `validateSave` returning a typed error; hook it into a new `loadSavedGame()` in `src/game/save.ts` and into `MainScene.create()` (defense-in-depth) so `HomeScene` load and any test/e2e save entry validate+migrate before `fromSaveData`. Keep version **1 as current** (no schema break — existing saves stay valid; the migration map is infrastructure proven by tests). (PERS-02) add `src/game/options.ts` (persist under `rcb.options`, load-at-boot with defaults-merge, an `applyOptions()` dispatch), read options **before** `new Phaser.Game` in `main.ts` to map `graphicsQuality` → `RenderConfig` (load-time only — verified constraint), wire `gameSpeedDefault` → `MainScene.setSpeed` at boot, text-size/reduced-motion via `document.body` data attributes + `index.html` CSS seams, audio via a thin `src/game/audio.ts` mix seam (no assets — full audio §48 is deferred v2), and a Settings panel in the HUD control bar (data-testid, textContent DOM, Phase 18 drawer pattern). No new npm packages.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Versioned Save/Load (PERS-01):** SaveData gains a checked version; saves round-trip deterministically with migration (older versions migrate forward) and validation (corrupt/unknown-version saves are rejected with a clear error, not a silent load).
- Migration is additive and deterministic: a `migrateSave(save): SaveData` pure function upgrades version N → N+1, and loading runs the migration chain to the current version before `fromSaveData`. Current version 1 stays valid (no schema break for existing saves).
- Validation: `validateSave(save)` checks structure (seed/mapSize/tickCount/commands arrays, version bounds, command kinds) and returns a typed error on corruption; loading refuses invalid saves and surfaces the reason (storage `read`/`parse` errors already exist in save.ts).
- Deterministic reload is preserved byte-identically: `fromSaveData` replays commands at tick 0, and every system already round-trips (missions/events/objectives/tutorial/options decisions are SaveCommands or replay-derived — no state lost).
- **Options & Accessibility (PERS-02):** Options (graphics quality, audio music/SFX mix, default game speed, text size, reduced motion) are functional AND persisted — the `OptionsSchema`/`serialize`/`deserialize`/`mergeOptions` in `src/sim/ui.ts` are wired to: (a) a persisted store (localStorage, alongside the save envelope), (b) applied effects in the running game (graphics quality → renderers; audio mix → volume; game speed → default speed; text size → HUD; reduced motion → animations/overlays), (c) loaded on boot and mergeable with defaults for forward-compat.
- Accessibility surfaces wired: reduced motion suppresses non-essential animation; text size scales HUD text; a settings/options UI (domiciled in the HUD, consistent with Phase 18 patterns) edits + persists the options.
- Options are view/shell state — persisted separately from the sim SaveData (different key; not part of SimState byte-identity). Options changes never touch the deterministic sim.

### the agent's Discretion
- Exact `migrateSave` steps for version 1 → current (likely no-op upgrade map initially, since v1 is current — the infrastructure + validation is the deliverable, with migration tests proving forwards-compat).
- Layout/toggles of the settings/options UI panel.
- How graphics quality / text size manifest concretely in the Phaser scene + HUD (within existing art constraints — no pixel-perfect work).
- Settings storage key(s) and structure beyond the base options (if any wallet/audio preferences beyond the schema).

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERS-01 | Versioned save/load migration covering all systems with validation and deterministic reload | Deterministic reload already proven by existing determinism suites (verified below). Gap = pure `migrateSave`/`validateSave` + load-path hook (HomeScene + MainScene.fromSaveData entry) + version const. Migration is additive N→N+1; v1 stays current. |
| PERS-02 | Options and accessibility (graphics, audio, gameplay, accessibility) | `OptionsSchema` exists (ui.ts:79-95) and round-trip unit test exists (tests/unit/ui.test.ts:40-49); wiring is absent: no persistence key, no application seams. Deliver = options module + boot application + HUD settings panel + audio mix seam + CSS text-size/reduced-motion seams. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Save envelope version/migration/validation | API / Backend (sim core) | — | Pure `migrateSave`/`validateSave` operate on the sim-typed `SaveData`; keep in `src/sim/` (node-testable, no browser) like `ui.ts`. |
| Save persistence (localStorage read/write, slots) | Browser / Client | — | `src/game/save.ts` already owns the `StorageLike` abstraction, keys, metadata envelope. |
| Options persistence (shell state) | Browser / Client | — | New `src/game/options.ts` mirrors save.ts layering (pure `ui.ts` codec + storage); never touches sim byte-identity. |
| Options application — graphics quality (Renderer) | Browser / Client (Phaser shell) | — | `RenderConfig` is fixed at Game construction (`main.ts`) — must read options before `new Phaser.Game`. |
| Options application — game speed (TimeSystem) | Browser / Client | API / Backend (sim/time) | `TimeSystem.setSpeed` is the sim's scheduler but owned by the view (`MainScene`); default speed is shell state injected at boot. |
| Options application — audio mix | Browser / Client (Phaser) | — | `game.sound.setVolume` is global; per-bus mix is app-side (no audio assets this phase — §48 deferred). |
| Options application — text size / reduced motion | Browser / Client | — | HUD is DOM (`index.html` CSS); apply via `document.body` data-attributes + CSS seams. |
| Settings UI panel (HUD) | Browser / Client | — | Phase 18 drawer/toggle pattern: DOM `createElement`/`textContent`, data-testid, `game.events` bus with off() cleanup. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Phaser | 3.90.0 | Game shell, renderer (`RenderConfig`), scene system, sound manager | Existing engine — `npm ls` confirms 3.90.0 [VERIFIED]. `main.ts` constructs the Game; `game.sound` is the audio seam. |
| Vanilla TS DOM (no library) | — | Settings panel, options wiring | Existing `HUDScene.buildDom()` pattern (`document.createElement`, textContent, data-testid) [VERIFIED]. |
| TypeScript | 5.9.3 | Types: `SaveData`, `OptionsSchema`, `SaveCommand` | `tsc --noEmit` typecheck + `vitest` node-env tests [VERIFIED: vitest.config.ts]. |
| Vitest | 3.2.7 | Unit/integration/determinism/golden tests | Existing suite; pure codec + options modules are node-testable [VERIFIED]. |
| Playwright | 1.62.1 | e2e via `?test&seed=1337` + `__cityApi` + data-testid | `e2e/sessions.spec.ts` already covers save-from-pause → load-resumes-city [VERIFIED]. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | No new npm dependencies for this phase | Migration/validation/options are small pure functions; a schema/runtime-validation library (zod/ajv) would be the first new dependency — not warranted (see Don't Hand-Roll). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-built `validateSave`/`migrateSave` | zod/ajv JSON-schema runtime validation | **Rejected** — project has zero runtime-validation deps; the checks needed (kind union membership, finite numbers) are trivial TS predicates; adding a dep is disproportionate. |
| Adding `version` checks inside `fromSaveData` only | A dedicated pure codec (`saveCodec.ts`) + load-path hook | `fromSaveData` is the hot replay path for every determinism test (dozens of call sites); centralizing migration/validation in one pure module keeps those tests untouched and makes the codec directly unit-testable. |
| Storing options inside `SaveData` | Separate `rcb.options` localStorage key | Locked decision (CONTEXT): options are shell state, never part of SimState byte-identity. |
| Applying graphics quality at runtime | Read options at boot before `new Phaser.Game` | `RenderConfig.antialias/pixelArt/roundPixels` take effect at WebGL context creation — runtime change requires a game/canvas restart [VERIFIED: phaser.d.ts:72768-72837]. |

**Installation:**
```bash
# No new packages — this phase only uses existing dependencies.
npm install   # if node_modules is stale; phaser@3.90.0, typescript@5.9.3 already present
```

**Version verification:** `npm ls` confirms phaser 3.90.0, @playwright/test 1.62.1, typescript 5.9.3, vitest 3.2.7, vite 6.4.3 on node 20.20.1/npm 10.8.2 [VERIFIED this session].

## Package Legitimacy Audit

> **No external packages are installed by this phase.** Migration/validation/options are pure in-repo functions; no registry changes, so the Package Legitimacy Gate has nothing to audit.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | N/A | No new packages — gate not triggered |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                            ┌──────────────────────────────────────────────┐
   boot (index.html → main.ts)                                             │
      │ reads OPTIONS (rcb.options) synchronously                         │
      ▼                                                                    │
 ┌──────────────────────────┐      fit map graphicsQuality→RenderConfig   │
 │ new Phaser.Game({...})    │   (load-time only — antialias/pixelArt/     │
 │  render:{preserveDrawing..}│    roundPixels fixed at context creation)  │
 └───────┬───────────────────┘                                             │
         ▼                                                                 │
 ┌────────────────────────────────────────────────────────────────────┐   │
 │ Scenes: Boot → Home → Main (Phaser view) + HUD (DOM overlay)          │
 │  Main: runner=SimRunner|fromSaveData(save) ; setSpeed(gameSpeedDefault)│
 │  HUD:  control bar ► Settings drawer (edits OptionsSchema)             │
 │        textContent/data-testid; boot sets body[data-text-size]         │
 │        + body[data-reduced-motion]; audio.ts mix seam (no assets)     │
 └──────┬───────────────────────────────────▲──────────────────────────────┘
        │ getSaveData/save.ts write         │ loadSavedGame()  (READ path)
        ▼                                   │  read → parse → migrate → validate
 ┌────────────────────────────────────────┐┌ └─┐
 │ localStorage:                          ││     │ invalid/unknown → typed error
 │  rcb.save / rcb.quicksave /            ││     ▼ (reject, no silent load)
 │  rcb.autosave.N   (PERS-01 envelope)   ││  fromSaveData (replay @tick0,
 │  rcb.options      (PERS-02 shell)      ││  byte-identical SimState)
 └────────────────────────────────────────┘               │
                                                          ▼
                                      src/sim/saveCodec.ts (pure, node-testable)
                                       SAVE_VERSION const | migrateSave (N→N+1
                                       additive chain) | validateSave (typed error)
```

The primary use case — *save → restart → load → same city* — flows: pause overlay `save-button` → `writeSave(main.getSaveData())` (`HUDScene.saveGame`, HUDScene.ts:691-695) → home `load-game` → `loadSavedGame()` (NEW: read→parse→migrate→validate) → `MainScene.create()` → `fromSaveData` replays `saveCommands` at tick 0 and ticks to `tickCount`, restoring `pendingCommands`/`paused` (runner.ts:2662-2678) → identical `getStateJson()` (proven by existing determinism suites).

### Recommended Project Structure
```
src/
├── sim/
│   ├── saveCodec.ts      # NEW — SAVE_VERSION, migrateSave(), validateSave() (pure, node-testable)
│   └── ui.ts             # options Schema/merge/serialize/deserialize — unchanged, stays pure
├── game/
│   ├── save.ts           # + loadSavedGame() (read→parse→migrate→validate typed result)
│   ├── options.ts        # NEW — OPTIONS_KEY='rcb.options', loadOptions/saveOptions/applyOptions
│   ├── audio.ts          # NEW (thin) — setMusicVolume/setSfxVolume/play(kind) mix seam, no assets
│   ├── main.ts           # read options BEFORE new Phaser.Game → RenderConfig + body data-attrs
│   ├── scenes/
│   │   ├── MainScene.ts  # create(): validate save; setSpeed(options.gameSpeedDefault) at boot
│   │   └── HUDScene.ts   # + Settings control-bar button + drawer (Phase 18 pattern)
│   └── scenes/HomeScene.ts # load: use loadSavedGame() typed result; surface error
index.html                 # + body[data-text-size=…] / body[data-reduced-motion=true] CSS
tests/
├── unit/saveCodec.test.ts    # NEW — migrate/validate (version bounds, corrupt command, NaN)
├── unit/options.test.ts # NEW — localStorage round-trip, defaults merge, corrupt→defaults
└── unit/save.test.ts         # extend — loadSavedGame rejects invalid, migrates old
e2e/settings.spec.ts          # NEW — settings panel e2e (data-testid), save/load with validation
```

### Pattern 1: Additive migration chain (N → N+1)
**What:** `SaveData` version upgrades are small pure steps; loading applies the chain `v→v+1→…→current`. v1 is current so the map is empty today (infrastructure proven by tests).
**When to use:** every future schema change; never a rewrite of the loader.
**Example (recommended skeleton):**
```typescript
// Source: recommendation (in-repo pattern) — additive, deterministic, pure.
export const SAVE_VERSION = 1 as const;

// Indexed by from-version; each step upgrades exactly one version. A future v2
// schema change adds: MIGRATIONS[1] = (s) => ({ ...s, version: 2 } as SaveDataV2).
const MIGRATIONS: Record<number, (save: unknown) => unknown> = {};

export function migrateSave(data: unknown): SaveData {
  const v = (data as { version?: unknown })?.version;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    throw new SaveCodecError('migrate-invalid-version');
  }
  let current = data as Record<string, unknown>;
  while ((current.version as number) < SAVE_VERSION) {
    const step = MIGRATIONS[current.version as number];
    if (!step) throw new SaveCodecError('migrate-not-supported');
    current = step(current) as Record<string, unknown>;
  }
  if ((current.version as number) > SAVE_VERSION) {
    throw new SaveCodecError('save-version-too-new');
  }
  return current as unknown as SaveData;
}
```

### Pattern 2: Validation-on-read with typed error
**What:** validate structure *before* replay — a corrupt save never reaches `fromSaveData`/`applyCommand`.
**When to use:** at every boundary that accepts external JSON (HomeScene load, `loadSavedGame`, MainScene `save` entry).
**Example (recommended skeleton):**
```typescript
// Source: recommendation (in-repo pattern) — mirrors PlacementResult's ok/error style.
export type SaveValidationError =
  | 'invalid-version' | 'missing-field' | 'non-finite-seed'
  | 'non-finite-tick-count' | 'non-finite-map-size' | 'commands-not-array'
  | 'unknown-command-kind' | 'malformed-command';

export function validateSave(data: unknown):
  { ok: true; data: SaveData } | { ok: false; error: SaveValidationError; reason: string } {
  // seed/mapSize/tickCount finite numbers; commands is an Array;
  // every command has a known `kind` in the SaveCommand union with numeric/string
  // fields shaped per the union; version === SAVE_VERSION (after migration).
  // Unknown kind → typed error (pre-empts applyCommand's raw throw, runner.ts:3288-3290).
}
```

### Pattern 3: Options as persisted shell state with a boot-time apply dispatch
**What:** options live outside the sim, persist under their own key, and `applyOptions()` touches only the view/shell (renderer config, speed, DOM attributes, audio mix).
**When to use:** every settings change + at boot.
**Example (recommended skeleton):**
```typescript
// Source: recommendation — models the existing save.ts layering and ui.ts codec.
export const OPTIONS_KEY = 'rcb.options';

export function loadOptions(storage: StorageLike = defaultStorage()): OptionsSchema {
  try { return deserializeOptions(storage.getItem(OPTIONS_KEY)); } catch { return { ...DEFAULT_OPTIONS }; }
}
export function saveOptions(o: OptionsSchema, storage: StorageLike = defaultStorage()): SaveResult {
  try { storage.setItem(OPTIONS_KEY, serializeOptions(o)); return { ok: true }; }
  catch { return { ok: false, error: 'write' }; }
}
// Called at boot after the Game/Scene shells exist; options never touch the sim.
export function applyOptions(o: OptionsSchema): void {
  document.body.dataset.textSize = o.textSize;
  document.body.dataset.reducedMotion = String(o.reducedMotion);
  setMusicVolume(o.audioMusic); setSfxVolume(o.audioSfx); // audio.ts mix seam
  speedDefault = o.gameSpeedDefault;                       // MainScene.setSpeed at boot
}
```

### Anti-Patterns to Avoid
- **Truthiness version check as validation:** `if (!parsed?.data?.version)` accepts *any* truthy value — it rejects nothing structurally. Replace with `validateSave` (see Pitfall 1).
- **Writing options into `SaveData` / `SimState`:** breaks byte-identity and re-enters the sim; locked decision keeps them in a separate key.
- **`Date.now()`/`Math.random()`/`new Date()` in sim paths:** `savedAt: Date.now()` in `getSaveData()` is fine (metadata, not replayed) [VERIFIED: runner.ts:2642], but any new sim-path timestamp would break determinism.
- **Adding non-additive migration:** a vN save must remain loadable after every upgrade; each N→N+1 step is additive (`{...save, version: N+1, newOptionalField}`), never a rename/drop of existing fields.
- **innerHTML interpolation in the settings panel:** follow Phase 18's `createElement`/`textContent` (HUDScene.ts:739+ comment "sim-derived strings never hit innerHTML").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Replay/restore of sim state | A full state dump in `SaveData` | Existing `saveCommands` replay (`fromSaveData`) + `migrateSave`/`validateSave` | The command-log reconstruction is already proven byte-identical across all systems; duplicating it as a snapshot would fork the state formats. |
| Runtime schema validation library | Add zod/ajv | Small typed predicates in `saveCodec.ts` | The checks (kind-membership, finite numbers, arrays) are trivial; zero new deps. |
| localStorage plumbing | Reimplement storage abstraction per module | `StorageLike` interface + `defaultStorage()` from `src/game/save.ts` (save.ts:10-45) | Already unit-testable with a `Map`-backed memory store — reuse it for options. |
| Deterministic RNG for replay | Reimplement | `mulberry32(seed)` in `SimRunner` (runner.ts:242) | Replay correctness depends on sharing the constructor's RNG stream (runner.ts:2663-2665). |
| JSON serialization of saves/options | Custom binary/versioned serializers | `JSON.stringify`/`JSON.parse` (existing envelope + `serializeOptions`) | Plain-JSON is the in-repo convention; migration handles version drift. |

**Key insight:** the deterministic machinery is the hard part and it already exists — the phase's risk is *unguarded boundaries* (unvalidated `fromSaveData`, unwired options), not missing fundamentals. Every deliverable is a small pure addition plus wiring to seams that already exist.

## Common Pitfalls

### Pitfall 1: `readSave`'s version check is a truthiness test, not validation
**What goes wrong:** `if (!parsed?.data?.version) return null;` (`[VERIFIED: src/game/save.ts:66]`) returns the save as long as *some* truthy `data.version` exists — `{version: 99}` or `{version: 'hi'}` passes and is handed to `fromSaveData`.
**Why it happens:** the guard predates versioning; it only distinguishes "has envelope" from "no envelope".
**How to avoid:** route all reads through `loadSavedGame()`: `JSON.parse` → `migrateSave` (version bounds) → `validateSave` → typed `LoadResult`. Keep `readSave`/`listSaves` for the home-screen *listing* (meta-only: seed/tick/version), and validate+migrate on the click-through.
**Warning signs:** a plan that considers the existing `readSave` guard "validation".

### Pitfall 2: `fromSaveData` has zero guards today — corrupt saves throw raw or silently misbehave
**What goes wrong:** an unknown command kind hits `applyCommand`'s exhaustive branch and throws `unknown command kind` (runner.ts:3288-3290); a non-finite `seed`/`mapSize`/`tickCount` (e.g. string from a hand-edited save) flows into `new SimRunner(save.seed, map, save.mapSize)`/`while (runner.tickCount < save.tickCount)` and misbehaves silently.
**Why it happens:** `SaveData` is compile-time typed but JSON is unchecked at runtime; `fromSaveData` (runner.ts:2662-2678) never inspects values before use.
**How to avoid:** `validateSave` runs before `fromSaveData` at the scene boundary; `applyCommand`'s raw throw stays as a last-resort safety net.
**Warning signs:** a test asserting `fromSaveData(corruptSave)` returns *without* throwing — it should reject with a typed reason.

### Pitfall 3: `RenderConfig` is fixed at WebGL-context creation — quality cannot change at runtime
**What goes wrong:** trying to toggle antialias/pixelArt mid-session silently does nothing (the fields are `readonly` on the renderer after creation).
**Why it happens:** documented contract: `antialias` is applied when the context is created; "Setting this value does not impact any subsequent textures" `[VERIFIED: node_modules/phaser/types/phaser.d.ts:72773-72776]`.
**How to avoid:** read options *before* `new Phaser.Game` in `main.ts` and map `graphicsQuality` → RenderConfig (low: `antialias:false, roundPixels:true`; medium: defaults; high: `antialias:true`). Changing the option persists it; applying the new quality takes effect on next boot — document this in the settings UI.
**Warning signs:** a settings handler that toggles `game.renderer.antialias` expecting an immediate visual change.

### Pitfall 4: Phaser has no built-in "music vs sfx" bus
**What goes wrong:** `game.sound.setVolume(v)` is a single global volume for all active sounds — you cannot get separate music/SFX from the engine alone.
**Why it happens:** the SoundManager exposes only `setMute`/`setVolume`/`mute`/`volume` `[VERIFIED: node_modules/phaser/types/phaser.d.ts:104901-104915]`; per-sound `setVolume` is on each `Sound` object.
**How to avoid:** track `audioMusic`/`audioSfx` multipliers app-side and apply per-sound on play via a thin `src/game/audio.ts` seam (`play('sfx', …)` sets `sound.volume = audioSfx`; `play('music', …)` uses `audioMusic`). The game has **zero audio today** (grep confirms no sound code in `src/`), so the deliverable is the persistent values + the mix seam; full audio §48 is deferred v2 — do not fabricate assets.
**Warning signs:** a plan that calls `this.sound.setVolume(audioMusic)` expecting music-only volume control.

### Pitfall 5: Options byte-identity — never flow options into the sim
**What goes wrong:** merging options into `SaveData` or a `getState()` field breaks golden/byte-identity determinism suites and violates the locked "separate key, shell state" decision.
**Why it happens:** convenience when both already live in `localStorage`.
**How to avoid:** keep `OPTIONS_KEY = 'rcb.options'` and `SAVE_KEY = 'rcb.save'` disjoint; `applyOptions` touches view/shell objects only. `getSaveData`/`getStateJson` stay untouched.
**Warning signs:** a plan diff touching `getStateJson`/`toBuildingState` or adding an `options?` field to `SaveData`.

### Pitfall 6: Speed is applied at three different levels — keep the default at boot only
**What goes wrong:** `gameSpeedDefault` hooked into every tick or fighting the HUD `speed-*` buttons produces jumpy/non-deterministic-feeling speed.
**Why it happens:** TimeSystem has one `speed` field (time.ts:35,61-66) and the HUD hardcodes `[0.5, 1, 2, 4, 8]` (`[VERIFIED: src/game/scenes/HUDScene.ts:377-387]`, matching `SPEED_PRESETS` in time.ts:79).
**How to avoid:** apply `gameSpeedDefault` once in `MainScene.create()` via `this.setSpeed(options.gameSpeedDefault)`; the HUD buttons continue to override the *live* speed thereafter (SpeedMultiplier values from SPEED_PRESETS).
**Warning signs:** a settings handler calling `setSpeed` on every slider `input` event, or the boot default re-applying over a user-selected speed on tick.

### Pitfall 7: The quickload/autosave slot APIs exist but are NOT wired to the running game
**What goes wrong:** assuming the game already supports autosave/quicksave quickload — it doesn't. `writeQuickSave`/`readQuickSave`/`writeAutosave`/`listAutosaves` (`save.ts:102-143`) are exported and unit-tested (`tests/unit/governor.test.ts:33-46`) but never called from any scene; the only wired saves are the pause-overlay `writeSave` (HUDScene.ts:693) and home `listSaves`→load (HomeScene.ts:90-96).
**Why it happens:** the slot layer landed in a prior task (12.2) ahead of its UI.
**How to avoid:** treat autosave/quicksave UI **out of scope for PERS-01's locked decisions** (which cover version/migration/validation/reload, not the slot UI) unless the planner expands scope; if wired, run the same `loadSavedGame()` (migrate+validate) path for each slot rather than raw `readQuickSave`.
**Warning signs:** a plan task "wire quicksave button" that skips validation on `readQuickSave`.

## Runtime State Inventory

> This is a feature/migration-capability phase, not a rename/refactor of runtime identifiers. The existing persisted saves remain **format-stable** (v1 stays current — no data migration of existing records). Audit for completeness:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `localStorage` keys `rcb.save` (SAVE_KEY, save.ts:8), `rcb.quicksave` (QUICKSAVE_KEY, save.ts:102), `rcb.autosave.` (AUTOSAVE_PREFIX, save.ts:103). Existing user saves are **all version 1** — format-compatible with the new codec; no data migration. | None — v1 remains valid. Code adds migrate/validate gate (code edit). |
| Live service config | None — local single-player, no external services/UI config. | None |
| OS-registered state | None — browser-local only. | None |
| Secrets/env vars | None — no keys reference a renamed identifier. | None |
| Build artifacts | None — no renamed package/artifact. | None |

## Code Examples

All in-repo examples verified this session; skeletons are recommended additions matching in-repo style.

### Existing: save → load through HomeScene (PERS-01 read-path hook point)
```typescript
// Source: src/game/scenes/HomeScene.ts:90-96 (verified) + save.ts:61-71.
const save = listSaves();                       // meta-only listing (tolerant)
if (save) {
  loadBtn.textContent = `Resume city (seed ${save.meta.seed}, tick ${save.meta.tick})`;
  loadBtn.addEventListener('click', () => this.loadSavedGame(save.data)); // OK today, unguarded
}
// loadSavedGame currently just: this.scene.start('Main', { save });  (HomeScene.ts:127-129)
// Recommended: loadSavedGame() in save.ts returns { ok, data|error } after
// parse → migrate → validate; only ok saves reach scene.start('Main', { save }).
```

### Existing: determinism round-trip recipe to extend with migration/validation (PERS-01 test harness)
```typescript
// Source: tests/determinism/determinism.test.ts:29-42 + tests/runner-accessors.test.ts:174-196.
const runner = new SimRunner(777);
runner.placeBuilding('road', 3, 3);
runner.setPolicy(0.1, 0.2);
for (let i = 0; i < 500; i++) runner.tick();
const original = runner.getStateJson();
const migrated = migrateSave(runner.getSaveData());        // NEW: v1 → current (no-op today)
expect(validateSave(migrated).ok).toBe(true);              // NEW
const loaded = SimRunner.fromSaveData(migrated);           // unchanged replay path
expect(loaded.getStateJson()).toBe(original);
```

### Existing: exhaustive command-kind guard that validateSave should pre-empt
```typescript
// Source: src/sim/runner.ts:3288-3290 (verified verbatim).
} else {
  const exhaustive: never = cmd;
  throw new Error(`unknown command kind: ${(exhaustive as { kind: string }).kind}`);
}
```

### RenderConfig mapping (PERS-02 graphics quality) — verified option surface
```typescript
// Source: node_modules/phaser/types/phaser.d.ts:72768-72837 (verified verbatim fields).
// low  → { antialias: false, roundPixels: true }  (crisper, cheaper)
// medium → (defaults)                              (today: preserveDrawingBuffer:true)
// high → { antialias: true }
// READ BEFORE `new Phaser.Game` in main.ts (context-creation-only; see Pitfall 3).
```

### SoundManager global volume (PERS-02 audio seam) — verified surface
```typescript
// Source: node_modules/phaser/types/phaser.d.ts:104901-104915 (verified verbatim).
// this.sound.setMute(value)  — mutes all sounds
// this.sound.setVolume(value) — "Sets the volume of this Sound Manager" (global)
// per-sound: (sound as Phaser.Sound.BaseSound).setVolume(mix)  — per-bus mix app-side
```

### OptionsSchema + defaults (PERS-02) — quoted verbatim
```typescript
// Source: src/sim/ui.ts:79-95 (verified verbatim — the persistence target).
export interface OptionsSchema {
  graphicsQuality: 'low' | 'medium' | 'high';
  audioMusic: number; // 0..1
  audioSfx: number; // 0..1
  gameSpeedDefault: number;
  textSize: 'small' | 'normal' | 'large';
  reducedMotion: boolean;
}
export const DEFAULT_OPTIONS: OptionsSchema = {
  graphicsQuality: 'medium',
  audioMusic: 0.6,
  audioSfx: 0.8,
  gameSpeedDefault: 1,
  textSize: 'normal',
  reducedMotion: false,
};
```

### HUD settings-panel slot (PERS-02 UI) — follow the control-bar/drawer pattern
```typescript
// Source: existing Phase 18 pattern — control bar (HUDScene.ts:262-280) + advisor drawer
// (283-312): DOM createElement, data-testid, display toggling, game.events with off() cleanup.
// NEW: 'Settings' control button → settings drawer with:
//   graphics select (data-testid="opt-graphics", low/medium/high),
//   music/sfx sliders (opt-music, opt-sfx, 0..1),
//   default-speed select (opt-speed, from SPEED_PRESETS),
//   text size select (opt-text-size), reduced-motion checkbox (opt-reduced-motion),
//   Save button → saveOptions() + applyOptions() + toast.
// All labels/values via textContent (never innerHTML interpolation).
```

### text-size / reduced-motion CSS seams (index.html)
```css
/* Recommended additions to index.html's inline <style> — data-attr driven. */
body[data-text-size="large"] .hud { font-size: 15px; }
body[data-text-size="small"] .hud { font-size: 11px; }
body[data-reduced-motion="true"] *:not(.hud-toast) {
  animation: none !important;
  transition: none !important;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Version is a literal `version: 1` with no runtime guard (types.ts:103, runner.ts:2637) | `SAVE_VERSION` const + additive migration chain + `validateSave` gate | This phase | Unknown/corrupt/older saves now rejected or migrated with a typed reason instead of a raw throw / silent misbehavior. |
| `readSave` truthiness version check (save.ts:66) | `loadSavedGame()` = parse → migrate → validate → typed `LoadResult` | This phase | Only validated, current-version saves reach `fromSaveData`. |
| Options schema exists but is dead code (ui.ts:79-113, one round-trip unit test) | Persisted under `rcb.options`, applied at boot + via settings panel | This phase | Graphics/audio/speed/text/accessibility options become functional and persisted (PERS-02). |
| Single manual save wired (pause overlay + home load) | (slot APIs exist, unwired) — decision point this phase | This phase | Quickload/autosave UI remains out of PERS-01's locked scope unless planner expands (Pitfall 7). |

**Deprecated/outdated:**
- Relying on `SaveData.version`'s type literal as the sole version guard — it is compile-time only; the new `SAVE_VERSION`/`migrateSave`/`validateSave` are the runtime surface.
- Any plan text citing "options already persisted" — they are not; `src/sim/ui.ts` options have zero runtime consumers today.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Version 1 stays current; the migration map is an empty/I/O infra (no-op chain) with forward-compat proven by tests | Summary / Pattern 1 | Low — CONTEXT already recommends this ("likely no-op upgrade map initially"). If a v2 lands this phase, the map gains a real step. |
| A2 | Audio options deliverable = persisted values + `src/game/audio.ts` mix seam only (no sound assets); §48 full audio is deferred v2 | Pitfall 4 | Low — REQUIREMENTS v2 explicitly defers "Full audio §48". If a stakeholder expects audible sound this phase, scope grows. |
| A3 | Reduced-motion suppresses *future* non-essential animation; today the game has no tweens/CSS transitions (only walker interpolation which is essential rendering) — deliverable is a wired flag + CSS seam | Pitfall/intro | Low — verified no Phaser tweens in `src/game`. If a stakeholder expects visible motion suppression on an actual animation, there is none to suppress yet. |
| A4 | Graphics-quality changes require a boot to apply (RenderConfig is context-creation-only) | Pitfall 3 | MEDIUM — verified against installed Phaser typings. If runtime quality switching is required, it needs a full scene/game restart flavor that is more invasive. |
| A5 | Settings storage key `rcb.options` (alongside `rcb.save`) | Architecture Patterns | Low — CONTEXT leaves the key to discretion; any unused `rcb.*` key works. |
| A6 | Autosave/quicksave UI is OUT of PERS-01 scope (slot APIs stay unwired) | Pitfall 7 | MEDIUM — the game-sessions spec (openspec/specs/game-sessions/spec.md:80-94) lists autosave+quicksave+quickload as a requirement. If the planner includes it, each slot must route through the same migrate+validate path. |

## Open Questions

> All four questions are RESOLVED — the plan (19-PLAN.md) implements the recommendations below.

1. **Should validation/migration failures surface in the Home UI, and how?** *(RESOLVED — disable load + reason text, no modal; plan 19-01-01/02)*
   - What we know: `loadSavedGame()` will return a typed reason (read/parse/migrate/validate).
   - What's unclear: whether the home screen disables Load with a message, or shows a toast explaining "corrupt save rejected" vs silently disabling.
   - Recommendation: disable the load button when the save fails validation and show the reason text on the button/tooltip; keep it simple — no modal.

2. **Is the autosave/quicksave quickload UI in scope?** *(RESOLVED — OUT of scope; plan keeps slot UI unwired)*
   - What we know: spec requires it; CONTEXT's locked decisions do not mention slot UI; the APIs exist and are unit-tested but unwired (Pitfall 7).
   - What's unclear: whether "versioned save/load for all systems" implies the slot UI.
   - Recommendation: keep it out unless the planner expands scope; if included, route every slot read through `loadSavedGame()`.

3. **How literal should "graphics quality → renderers" be, given only-build-time RenderConfig?** *(RESOLVED — RenderConfig booleans at boot + optional canvas CSS toggle; plan 19-02-01)*
   - What we know: RenderConfig is fixed at context creation (Pitfall 3).
   - What's unclear: whether "high/medium/low" should also toggle CSS `image-rendering` or sprite resolution selection (art.ts already selects per-zoom resolutions).
   - Recommendation: map to RenderConfig booleans at boot; optionally add a canvas CSS `image-rendering` toggle for low — confirm visual acceptance at verify.

4. **Does `gameSpeedDefault` apply to a fresh city AND a loaded city?** *(RESOLVED — both; plan 19-02-02)*
   - What we know: `MainScene.create()` runs for both paths (runtimeConfig save vs seed).
   - What's unclear: none really — apply in `create()` after runner construction for both. Intent confirmed; no user decision needed beyond A5 key naming.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | dev/test toolchain | ✓ | 20.20.1 | — |
| npm | installs | ✓ | 10.8.2 | — |
| TypeScript | typecheck | ✓ | 5.9.3 | — |
| Vitest | unit/integration/determinism/golden | ✓ | 3.2.7 | — |
| Playwright (chromium) | e2e | ✓ | 1.62.1 | `npx playwright test` |
| Vite dev server | e2e webServer + dev | ✓ | 6.4.3 | `vite build` preview |
| Phaser | runtime engine | ✓ | 3.90.0 | — |

**Missing dependencies with no fallback:** none — all tooling verified present.
**Missing dependencies with fallback:** none.

## Validation Architecture

> `.planning/config.json` has no `workflow.nyquist_validation` key → treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.7 (unit/integration/determinism/golden/property) + Playwright 1.62.1 (e2e) |
| Config file | `vitest.config.ts` (node env, `tests/**/*.test.ts`), `playwright.config.ts` (chromium, :5173, workers 1) |
| Quick run command | `npm run test:unit -- tests/unit/saveCodec.test.ts` (new, <30s) |
| Full suite command | `npm test` (`vitest run`) + `npm run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERS-01 | `migrateSave` upgrades N→N+1 chain; current version passes through; `version > current` / `version < 1` rejected (typed error) | unit | `npm run test:unit -- tests/unit/saveCodec.test.ts::migrate` | ❌ Wave 0 |
| PERS-01 | `validateSave` rejects: non-finite seed/mapSize/tickCount, `commands` not array, unknown command kind, malformed command field (no raw throw) | unit | same file `::validate` | ❌ Wave 0 |
| PERS-01 | `loadSavedGame()` read→parse→migrate→validate; corrupt JSON / unknown version / invalid data → typed `ok:false`; valid v1 → `ok:true` | unit | extend `tests/unit/save.test.ts` | ✅ extend |
| PERS-01 | Save → load round-trips byte-identically WITH migrate/validate in the loop, across systems (missions/events/objectives/tutorial/options decisions) | determinism (existing pattern) | `npm run test:unit -- tests/determinism` (extend one suite to call migrateSave/validateSave first) | ✅ extend |
| PERS-02 | Options persist to `rcb.options` and round-trip; missing/corrupt stored value → defaults merge; forward-compat (unknown future fields preserved via merge) | unit | `npm run test:unit -- tests/unit/options.test.ts` (new) | ❌ Wave 0 |
| PERS-02 | Settings panel e2e: toggle option → toast → reload page → option still applied (localStorage survives) | e2e | `npx playwright test e2e/settings.spec.ts` (new) | ❌ Wave 0 |
| PERS-02 | `gameSpeedDefault` applied at boot (MainScene.create → timeSystem.speed), HUD speed buttons still override live speed | unit (TimeSystem) + e2e | extend `tests/unit/time.test.ts` + settings.spec.ts | ✅ extend |
| Guard | No `getStateJson()` change from any PERS work; options never enter SaveData | determinism/golden | `npm run test:unit -- tests/golden tests/determinism` | ✅ |

### Sampling Rate
- **Per task commit:** `npm run typecheck && npm run test:unit -- tests/unit/saveCodec.test.ts tests/unit/options.test.ts`
- **Per wave merge:** `npm test` (full vitest) + `npm run test:e2e` (browser)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/saveCodec.test.ts` — migrate/validate (version bounds, corrupt command, NaN)
- [ ] `tests/unit/options.test.ts` — rcb.options persistence, defaults merge, corrupt→defaults
- [ ] `e2e/settings.spec.ts` — settings panel + persist-across-reload
- [ ] Extend `tests/unit/save.test.ts` (loadSavedGame) and `tests/unit/time.test.ts` (boot default speed)

## Security Domain

> `security_enforcement` key absent → treated as enabled. Local single-player, non-network game; the boundary is untrusted `localStorage` JSON entering the deterministic sim.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — no accounts, local-only |
| V3 Session Management | no | N/A — no sessions/network |
| V4 Access Control | no | N/A — single actor, local state |
| V5 Input Validation | yes | **The untrusted-input boundary is `fromSaveData`/save.ts reads.** `validateSave` rejects malformed/unknown-version JSON with a typed error before replay — pre-empting `applyCommand`'s raw throw (runner.ts:3288-3290) and NaN propagation. Player commands already validate in the runner (setPolicy clamps, PlacementResult). |
| V6 Cryptography | no | N/A — no secrets; local save via JSON localStorage (`src/game/save.ts`) |

### Known Threat Patterns for {stack}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Corrupt/hostile localStorage save injected into the sim (unknown command kind, non-finite fields, oversized arrays) | Tampering / DoS | `migrateSave` + `validateSave` before any `fromSaveData` call (HomeScene + MainScene defense-in-depth); typed rejection surfaced to the UI, never a silent load. |
| DOM injection via `innerHTML` interpolation in the new settings panel | Tampering | `createElement`/`textContent` for all dynamic labels/values (Phase 18 convention: "sim-derived strings never hit innerHTML" HUDScene.ts:739); static HTML only in templates. |

## Sources

### Primary (HIGH confidence — in-repo files read this session; verbatim quotes beside every discrete value)
- `src/sim/types.ts:101-113` — `SaveData` interface (`version: 1` literal, seed/mapSize/commands/pendingCommands?/paused?/tickCount/savedAt) and `SaveCommand` union (75-99, incl. `startMission`/`dismissTutorialStep`)
- `src/sim/runner.ts:2635-2649` — `getSaveData()` (version 1, `savedAt: Date.now()`), `:2662-2678` — `fromSaveData` (replay at tick 0, pendingCommands re-enqueue, paused restore, no version check); `:238-250` — constructor `(seed, map?, mapSize?)` regenerating the seed map; `:3255-3292` — `applyCommand` with exhaustive `unknown command kind` throw
- `src/game/save.ts:8,66,102-103` — `SAVE_KEY='rcb.save'`, `if (!parsed?.data?.version) return null`, `QUICKSAVE_KEY='rcb.quicksave'`, `AUTOSAVE_PREFIX='rcb.autosave.'`; full slot API (105-143)
- `src/game/scenes/HomeScene.ts:90-96,127-129` — the only wired load path (`listSaves` → `scene.start('Main',{save})`, unguarded)
- `src/game/scenes/HUDScene.ts:262-312` (control bar + drawer pattern), `:377-387` (hardcoded `[0.5,1,2,4,8]` speed buttons), `:691-695` (`saveGame` → `writeSave`), `:739` (textContent rule)
- `src/game/scenes/MainScene.ts:64-84` (runtimeConfig seed|save), `:315-318` (`setSpeed`→TimeSystem), `:660-684` (`__cityApi`)
- `src/game/main.ts:13-21` — Phaser Game config with `render: { preserveDrawingBuffer: true }` (no quality control)
- `src/sim/ui.ts:79-113` — `OptionsSchema`/`DEFAULT_OPTIONS`/`mergeOptions`/`serializeOptions`/`deserializeOptions` (verbatim)
- `src/sim/time.ts:35,61-66,79` — TimeSystem.speed/setSpeed; `SPEED_PRESETS = [0.5,1,2,4,8]`
- `src/sim/config.ts` + `data/balance.ts:9,13` — `defaultMapSize: 40`, `ticksPerSecond: 4`
- `tests/unit/save.test.ts`, `tests/unit/ui.test.ts:40-49`, `tests/unit/governor.test.ts:33-46`, `tests/determinism/determinism.test.ts:29-42`, `tests/runner-accessors.test.ts:174-196`, `tests/unit/campaign.test.ts:111-119` — existing coverage boundaries
- `e2e/sessions.spec.ts:51-90` — save-from-pause → restart → load-resumes-city e2e precedent; `e2e/helpers.ts:29-32` — `?test&seed=1337` + `__cityApi`
- `node_modules/phaser/types/phaser.d.ts:72768-72837` — RenderConfig (antialias/pixelArt/roundPixels … context-creation-only, verified verbatim); `:104901-104915` — SoundManager setMute/setVolume (global, verified verbatim)
- `openspec/specs/game-sessions/spec.md:80-94,97-121` — autosave/quicksave/quickload + versioning/migration/validation spec; `openspec/specs/ui-management/spec.md:122-133` — options/accessibility spec
- `vitest.config.ts`, `playwright.config.ts`, `package.json` — toolchain

### Secondary (MEDIUM confidence)
- `19-CONTEXT.md` / `19-RESEARCH-DISPATCH.md` — locked decisions and investigation brief
- `18-PATTERNS.md` / `18-UI-REVIEW.md` — Phase 18 DOM/drawer/data-testid conventions + UI-review findings (uppercase rule, textContent rule)

### Tertiary (LOW confidence)
- None beyond the tagged `[ASSUMED]` claims in the Assumptions Log (A1-A6). Overrides noted: web-search seam unavailable (no BRAVE_API_KEY) — external Phaser claims verified against installed typings instead (authoritative shipped types).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; phaser/typescript/vitest/playwright verified via `npm ls` this session
- Architecture: HIGH — every integration point (save.ts, fromSaveData, ui.ts options, HUD patterns, RenderConfig site) verified in source with verbatim quotes
- Pitfalls: HIGH for the in-repo ground truth (unguarded fromSaveData, truthiness check, dead options); MEDIUM for the two external Phaser API claims (verified against installed typings but cross-checked as MEDIUM by the classify-confidence seam)

**Research date:** 2026-08-06
**Valid until:** ~2026-09-06 (30 days — stack is stable; no version drift expected within the phase)
