# Phase 19: Persistence & Options - Context

**Gathered:** 2026-08-06
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous, user accepted all recommended answers)

<domain>
## Phase Boundary

Deliver versioned save/load for all systems (migration + validation + deterministic
reload) and functional, persisted options/accessibility (graphics, audio, gameplay,
accessibility). Covers PERS-01, PERS-02 — the final phase of the v1.0 milestone.

</domain>

<decisions>
## Implementation Decisions

### Versioned Save/Load (PERS-01)
- SaveData gains a checked version; saves round-trip deterministically with migration (older versions migrate forward) and validation (corrupt/unknown-version saves are rejected with a clear error, not a silent load).
- Migration is additive and deterministic: a `migrateSave(save): SaveData` pure function upgrades version N → N+1, and loading runs the migration chain to the current version before `fromSaveData`. Current version 1 stays valid (no schema break for existing saves).
- Validation: `validateSave(save)` checks structure (seed/mapSize/tickCount/commands arrays, version bounds, command kinds) and returns a typed error on corruption; loading refuses invalid saves and surfaces the reason (storage `read`/`parse` errors already exist in save.ts).
- Deterministic reload is preserved byte-identically: `fromSaveData` replays commands at tick 0, and every system already round-trips (missions/events/objectives/tutorial/options decisions are SaveCommands or replay-derived — no state lost).

### Options & Accessibility (PERS-02)
- Options (graphics quality, audio music/SFX mix, default game speed, text size, reduced motion) are functional AND persisted — the `OptionsSchema`/`serialize`/`deserialize`/`mergeOptions` in `src/sim/ui.ts` are wired to: (a) a persisted store (localStorage, alongside the save envelope), (b) applied effects in the running game (graphics quality → renderers; audio mix → volume; game speed → default speed; text size → HUD; reduced motion → animations/overlays), (c) loaded on boot and mergeable with defaults for forward-compat.
- Accessibility surfaces wired: reduced motion suppresses non-essential animation; text size scales HUD text; a settings/options UI (domiciled in the HUD, consistent with Phase 18 patterns) edits + persists the options.
- Options are view/shell state — persisted separately from the sim SaveData (different key; not part of SimState byte-identity). Options changes never touch the deterministic sim.

### the agent's Discretion
- Exact `migrateSave` steps for version 1 → current (likely no-op upgrade map initially, since v1 is current — the infrastructure + validation is the deliverable, with migration tests proving forwards-compat).
- Layout/toggles of the settings/options UI panel.
- How graphics quality / text size manifest concretely in the Phaser scene + HUD (within existing art constraints — no pixel-perfect work).
- Settings storage key(s) and structure beyond the base options (if any wallet/audio preferences beyond the schema).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/sim/types.ts`: `SaveData` interface (`version: 1`, seed, mapSize, commands, pendingCommands?, paused?, tickCount, savedAt) — the envelope to version/migrate/validate.
- `src/sim/runner.ts`: `getSaveData()` (~2635, version 1), `fromSaveData(save, map?)` (~2662, replays commands + regenerates seed map), `SimState` byte-identity convention.
- `src/game/save.ts`: localStorage persistence (`SAVE_KEY = 'rcb.save'`), `SaveRecord`/`SaveMeta`, `makeRecord`/`readSave`/`writeSave`/`deleteSave`/`listSaves`, quick-save slots, typed errors (`read`/`write`/`parse`).
- `src/sim/ui.ts`: `OptionsSchema` (graphicsQuality/audioMusic/audioSfx/gameSpeedDefault/textSize/reducedMotion), `DEFAULT_OPTIONS`, `mergeOptions`, `serializeOptions`, `deserializeOptions` — the options store to wire + persist.
- Phase 18 HUD patterns (control bar, DOM panels, data-testid, tick guard) for the settings/options UI.
- Tests: `tests/unit/save.test.ts`? (check), determinism suites, sessions e2e (save/load/pause).

### Established Patterns
- Deterministic-only sim: no Math.random()/Date.now()/new Date() in sim paths; SimState/getStateJson() byte-identical replay; additive-only API changes; goldens untouched.
- SaveCommands + replay-derived state (missions/events/objectives/tutorial/options decisions) — no SaveData schema growth needed for those systems.
- UI view-only; DOM panels via createElement/textContent (XSS-safe, data-testid); e2e via Playwright `?test&seed` + `__cityApi`.
- Balance-parity CONFIG.<key> rule (prefer module-local for new constants).

### Integration Points
- `SaveData` (types.ts) + `getSaveData`/`fromSaveData` (runner.ts) — version check, migration chain, validation.
- `save.ts` — validation on read, version stamping on write, migration hook.
- `ui.ts` options — persistence (localStorage key), boot-time load, application (renderer/speed/HUD/audio), settings UI in the HUD.
- Running game application points: Phaser renderer quality, audio volumes, default game speed, HUD text size + reduced-motion flag.

</code_context>

<specifics>
## Specific Ideas

- Success criteria: (1) saves round-trip deterministically with migration and validation; (2) graphics/audio/gameplay/accessibility options are functional and persisted.
- Existing SaveData is version 1 and every system already round-trips — the deliverable is the version/migration/validation infrastructure + options persistence/application, proven by migration + round-trip + options-persistence tests.
- Options are separate shell state (own localStorage key), never part of SimState byte-identity.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>
