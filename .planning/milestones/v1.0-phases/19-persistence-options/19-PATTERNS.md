# Phase 19: Persistence & Options - Pattern Map

**Mapped:** 2026-08-06
**Files analyzed:** 15 (7 source NEW/MODIFY, 6 test/e2e, 1 CSS/config)
**Analogs found:** 15 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/sim/saveCodec.ts` (NEW — `SAVE_VERSION`, `migrateSave`, `validateSave`) | service (pure codec) | transform | `src/sim/ui.ts` (options codec) + `src/sim/advisors.ts` (pure projections) | exact |
| `src/game/save.ts` (add `loadSavedGame()`) | service (storage) | file-I/O (localStorage) | `src/game/save.ts` itself — `readSave`/`writeSave` + `StorageLike`/`SaveResult` | exact (self-extension) |
| `src/game/options.ts` (NEW — `OPTIONS_KEY`, `loadOptions`/`saveOptions`/`applyOptions`) | service (shell-state store) | file-I/O + request-response | `src/game/save.ts` (`StorageLike`, typed `SaveResult`, try/catch) | exact |
| `src/game/audio.ts` (NEW — thin mix seam, no assets) | utility | event-driven (dispatch) | `src/game/palette.ts` (module-level const/helpers) | role-match |
| `src/game/main.ts` (read options BEFORE `new Phaser.Game` → RenderConfig + body data-attrs) | config (bootstrap) | config | `src/game/main.ts` itself (`Phaser.Game` config, lines 13-21) | exact (self-extension) |
| `src/game/scenes/MainScene.ts` (save validation in `create()` + `setSpeed(gameSpeedDefault)` boot) | controller (Phaser scene) | streaming + request-response | `MainScene.ts` — `create()` runner construction (79-86) + `setSpeed` (315-318) | exact (self-extension) |
| `src/game/scenes/HomeScene.ts` (use `loadSavedGame()` typed result; surface error) | controller (DOM) | request-response | `HomeScene.ts` — `buildDom()` load section (84-101) + `loadSavedGame` (127-129) | exact (self-extension) |
| `src/game/scenes/HUDScene.ts` (Settings control-bar button + drawer) | controller (DOM overlay) | request-response | `HUDScene.ts` — control bar (262-280), `toggleAdvisorsDrawer`/`toggleOverlayBar` (508-528), `saveGame` (691-695), `game.events` on/off (475-497) | exact (self-extension) |
| `index.html` (body[data-text-size]/[data-reduced-motion] CSS seams) | config (styles) | static | `index.html` HUD CSS block (lines 7-545) | exact (self-extension) |
| `tests/unit/saveCodec.test.ts` (NEW) | test | n/a | `tests/unit/ui.test.ts:40-49` (options round-trip) + `tests/unit/save.test.ts` + `tests/determinism/determinism.test.ts:29-42` | exact |
| `tests/unit/options.test.ts` (NEW) | test | n/a | `tests/unit/save.test.ts` (memStore + `StorageLike` + `SaveResult`) + `tests/unit/ui.test.ts:40-49` | exact |
| `tests/unit/save.test.ts` (EXTEND — `loadSavedGame`) | test | n/a | `tests/unit/save.test.ts` itself | exact (self-extension) |
| `tests/unit/time.test.ts` (EXTEND — boot default speed) | test | n/a | `tests/unit/time.test.ts:32-36,92-106` (setSpeed) | exact (self-extension) |
| `tests/determinism/determinism.test.ts` (EXTEND — migrate/validate in round-trip) | test (determinism) | n/a | `tests/determinism/determinism.test.ts:29-42` (save/load round-trip) | exact (self-extension) |
| `e2e/settings.spec.ts` (NEW) | test (e2e) | n/a | `e2e/sessions.spec.ts` (save→restart→load flow) + `e2e/helpers.ts` (`?test&seed`, `__cityApi`) | exact |

## Pattern Assignments

### `src/sim/saveCodec.ts` (NEW — service, transform)

**Analog:** `src/sim/ui.ts` (options codec: `DEFAULT_OPTIONS`/`mergeOptions`/`serializeOptions`/`deserializeOptions`, lines 79-113) + `src/sim/advisors.ts` (pure projections over injected state).

**Why closest:** `saveCodec.ts` is a pure, browser-free, node-testable module exactly like `src/sim/ui.ts` — a typed schema + defaults + tolerant deserialize. `validateSave`'s typed-ok/error return mirrors the `PlacementResult`/`SaveResult` discriminated-union convention (`{ ok: true } | { ok: false; error: ... }` — `src/sim/types.ts:51`, `src/game/save.ts:29`). The deterministic N→N+1 migration chain copies the additive-projection style of `advisorsFrom` (`src/sim/advisors.ts:117-149`, conditionally-appended fields).

**Imports pattern** (`src/sim/ui.ts:1-10` + `src/sim/advisors.ts:1-26`):
```typescript
// Module header comment enum "Self-contained; the Phaser scenes read these models."
import type { SaveData, SaveCommand, BuildingType } from './types';
```

**Core — const + additive chain + pure functions** (`DEFAULT_OPTIONS`/serialize/deserialize precedent, `src/sim/ui.ts:88-113`):
```typescript
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

**Validation typed-error union** (mirrors `SaveResult = { ok: true } | { ok: false; error: 'read' | 'write' | 'parse' }` at `src/game/save.ts:29`):
```typescript
export type SaveValidationError =
  | 'invalid-version' | 'missing-field' | 'non-finite-seed'
  | 'non-finite-tick-count' | 'non-finite-map-size' | 'commands-not-array'
  | 'unknown-command-kind' | 'malformed-command';

export function validateSave(data: unknown):
  { ok: true; data: SaveData } | { ok: false; error: SaveValidationError; reason: string } { ... }
```

**SaveCommand kind check source** — the exhaustive `kind` dispatch the validator pre-empts (`src/sim/runner.ts:3255-3292`); accept only the union members (`src/sim/types.ts:75-99`: `place`, `setPolicy`, `demolish`, `requestRoyalSubsidy`, `takeLoan`, `repayLoan`, `holdFestival`, `setGovernorSalaryLevel`, `donateToGovernor`, `deliverGoods`, `payRequest`, `openTradeRoute`, `setTradeOrder`, `respondEvent`, `startMission`, `dismissTutorialStep`). The `applyCommand` `unknown command kind` raw throw (`runner.ts:3288-3290`) stays as a last-resort safety net — `validateSave` rejects BEFORE replay so it never fires on a corrupt save.

**Error class style** (typed, module-local — the project has no custom error hierarchy; keep one `SaveCodecError extends Error` with a `code` field, exported for `loadSavedGame` to map to a typed result).

**Deltas / constraints:**
- Pure — no `Math.random()`/`Date.now()`/`new Date()` (determinism rule).
- `getSaveData()`/`fromSaveData()` and every determinism/golden test stay untouched — migration/validation live only in this module + the save.ts load hook (keeps dozens of `fromSaveData` call sites unchanged, per Research).
- v1 stays current; `MIGRATIONS` is an empty map proven by tests (forwards-compat infra, CONTEXT discretion).

---

### `src/game/save.ts` (MODIFY — add `loadSavedGame()`)

**Analog:** `src/game/save.ts` itself (self-extension) — `readSave` (61-71), `writeSave` (74-81), `SaveResult` (29), `StorageLike` (11-15), `defaultStorage()` + `memoryStorage` (31-45).

**Why closest:** `loadSavedGame()` is the documented read-path replacement for `readSave`'s truthiness version check (`if (!parsed?.data?.version) return null;` at line 66 — Research Pitfall 1). It reuses the exact parse + typed `{ ok }` envelope already in this file.

**Storage + typed-result pattern to reuse verbatim** (`src/game/save.ts:10-15,29-45`):
```typescript
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export type SaveResult = { ok: true } | { ok: false; error: 'read' | 'write' | 'parse' };
function defaultStorage(): StorageLike {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch { /* fall through */ }
  return memoryStorage;
}
const memoryStore = new Map<string, string>();
const memoryStorage: StorageLike = { getItem: (k) => memoryStore.get(k) ?? null, setItem: (k, v) => void memoryStore.set(k, v), removeItem: (k) => void memoryStore.delete(k) };
```

**Read → parse structure** (copy `readSave`, `src/game/save.ts:61-71`):
```typescript
export function readSave(storage: StorageLike = defaultStorage()): SaveRecord | null {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveRecord;   // syntax errors → catch → null
    if (!parsed?.data?.version) return null;         // ← THIS is the guard to REPLACE on the load path
    return parsed;
  } catch { return null; }
}
```

**Delta:** `loadSavedGame(storage?)` → read envelope → `JSON.parse` (reuse the try/catch → `'parse'` typed error) → `migrateSave` (catch `SaveCodecError`, map to typed `ok:false`) → `validateSave` (return its `{ ok: false, error, reason }` shape) → `ok:true` with the migrated `SaveData`. Return type: `SaveRecord | { ok:false; error: 'read' | 'parse' | 'migrate' | 'validate'; reason?: string }` (or an additive union on `SaveResult`). Keep `readSave`/`listSaves` for home-screen META listing (tolerant); validate/migrate on the click-through only.

---

### `src/game/options.ts` (NEW — service, shell-state store)

**Analog:** `src/game/save.ts` (storage layering) + `src/sim/ui.ts` (`OptionsSchema` codec).

**Why closest:** options are shell state persisted under their own `localStorage` key, mirroring save.ts's `StorageLike`/typed-result/try-catch layering 1:1, and the value codec (`mergeOptions`/`serializeOptions`/`deserializeOptions`) already exists in ui.ts — the new module is wiring + an `applyOptions` dispatch. **Reuse `StorageLike` by importing it from `../game/save`** (already exported; Research "Don't Hand-Roll" says reuse, never reimplement).

**Persistence read/write pattern** (models `writeSave`, `src/game/save.ts:74-81` + `deserializeOptions`, `src/sim/ui.ts:105-113`):
```typescript
export const OPTIONS_KEY = 'rcb.options';

export function loadOptions(storage: StorageLike = defaultStorage()): OptionsSchema {
  try { return deserializeOptions(storage.getItem(OPTIONS_KEY)); } catch { return { ...DEFAULT_OPTIONS }; }
}
export function saveOptions(o: OptionsSchema, storage: StorageLike = defaultStorage()): SaveResult {
  try { storage.setItem(OPTIONS_KEY, serializeOptions(o)); return { ok: true }; }
  catch { return { ok: false, error: 'write' }; }   // SaveResult typed union from save.ts
}
```
(`serializeOptions`/`deserializeOptions`/`DEFAULT_OPTIONS`/`mergeOptions` imported from `src/sim/ui.ts:88-113` — already forward-compat: unknown future fields pass through `mergeOptions` = `{ ...DEFAULT_OPTIONS, ...raw }`.)

**`applyOptions` boot dispatch** (view/shell only — NEVER touches the sim; locked `rcb.options` ≠ `rcb.save` disjointness):
```typescript
export function applyOptions(o: OptionsSchema): void {
  document.body.dataset.textSize = o.textSize;
  document.body.dataset.reducedMotion = String(o.reducedMotion);
  setMusicVolume(o.audioMusic); setSfxVolume(o.audioSfx);   // audio.ts seam
  // gameSpeedDefault applied separately at MainScene boot (see below) — NOT here.
}
```

**Disjoint-keys rule** (`src/game/save.ts:8,102-103` — do not extend): keep `OPTIONS_KEY = 'rcb.options'` separate from `SAVE_KEY = 'rcb.save'`/`QUICKSAVE_KEY`/`AUTOSAVE_PREFIX`. Options never enter `SaveData`/`getStateJson`/`toBuildingState` (golden-byte guard, `tests/golden`).

---

### `src/game/audio.ts` (NEW — utility, event-driven dispatch)

**Analog:** `src/game/palette.ts` (module-level const + helpers imported by scenes) — closest structural match since there is zero sound code today (grep confirms); Phaser's `SoundManager` is global via `game.sound` (`phaser.d.ts:104901-104915`).

**Why closest:** thin module-level seam of pure-ish functions taking a `Phaser.Game`/`SoundManager`, returned values are app-side multipliers — same "view-only helpers imported by scenes" role as `palette.ts`.

**Pattern — module helper (mirror `tileTop` export style, `MainScene.ts:694-696`) + Phaser global volume surface (`phaser.d.ts:104901-104915`):**
```typescript
// this.sound.setVolume(v) — global only (no music-vs-sfx bus in Phaser; Pitfall 4).
// Per-bus mix is app-side: track audioMusic/audioSfx multipliers, then
// (sound as Phaser.Sound.BaseSound).setVolume(mix) at play time.
export function setMusicVolume(v: number, game: Phaser.Game): void { /* store; no-op until §48 audio */ }
export function setSfxVolume(v: number, game: Phaser.Game): void { /* store; no-op */ }
export function play(kind: 'music' | 'sfx', game: Phaser.Game): void { /* when assets land: sound.setVolume(store[kind]) */ }
```
**Delta:** NO assets fabricated (A2 — §48 full audio deferred v2); the deliverable is the persistent-multiplier store + seam signature so PERS-02's mix options are functional and testable.

---

### `src/game/main.ts` (MODIFY — options before Phaser.Game)

**Analog:** `src/game/main.ts` itself (self-extension), lines 1-21.

**Why closest:** the boot-time `new Phaser.Game({...})` is the only place `RenderConfig` can be set (context-creation-only — Research Pitfall 3, verified `phaser.d.ts:72768-72837`).

**Existing config to extend** (`src/game/main.ts:13-21`):
```typescript
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#2b1d0e',
  render: { preserveDrawingBuffer: true },
  scene: [BootScene, HomeScene, MainScene, HUDScene],
});
```

**Delta:** before the `new Phaser.Game`, `const options = loadOptions();` then map `graphicsQuality` → render: `low` → `{ preserveDrawingBuffer: true, antialias: false, roundPixels: true }`; `medium` → existing `{ preserveDrawingBuffer: true }`; `high` → `{ preserveDrawingBuffer: true, antialias: true }`. Apply `document.body.dataset.textSize`/`document.body.dataset.reducedMotion` (or defer both to `applyOptions` when scenes exist). Persisting is immediate; the quality takes effect on next boot — document in the settings UI (Pitfall 3).

---

### `src/game/scenes/MainScene.ts` (MODIFY — save validation + boot speed)

**Analog:** `MainScene.ts` itself — `create()` runner construction (79-86) + `setSpeed` (315-318).

**Why closest:** PERS-01 defense-in-depth runs `migrateSave`+`validateSave` before `SimRunner.fromSaveData` where the save enters; PERS-02 applies `gameSpeedDefault` once in `create()` after runner construction (both fresh-seed and loaded paths flow through `create()`).

**Runner construction site to guard** (`src/game/scenes/MainScene.ts:79-86`):
```typescript
create(): void {
  if (this.runtimeConfig) {
    this.runner =
      'save' in this.runtimeConfig
        ? SimRunner.fromSaveData(this.runtimeConfig.save)   // guard: validate/migrate BEFORE this
        : new SimRunner(this.runtimeConfig.seed, undefined, this.runtimeConfig.mapSize);
    this.runtimeConfig = null;
  }
  ...
```

**Speed setter + TimeSystem seam** (`src/game/scenes/MainScene.ts:315-318` + `src/sim/time.ts:61-66,79`):
```typescript
/** Select a simulation speed multiplier (0.5, 1, 2, 4, 8). */
setSpeed(speed: number): void {
  this.timeSystem.setSpeed(speed);
}
// time.ts: setSpeed throws RangeError on non-positive/non-finite (61-66)
export const SPEED_PRESETS = [0.5, 1, 2, 4, 8] as const;      // time.ts:79
```
**Delta:** in `create()`, `this.setSpeed(loadOptions().gameSpeedDefault)` once (both paths). The HUD speed buttons (`HUDScene.ts:377-387`) keep overriding the LIVE speed afterward — the boot default is injected once only (Pitfall 6; no per-tick re-apply). Guard the save branch with `validateSave` and reject/migrate before construction — the typed `ok:false` path mirrors the HomeScene error, never a silent load.

---

### `src/game/scenes/HomeScene.ts` (MODIFY — typed load + error surface)

**Analog:** `HomeScene.ts` itself — load section (84-101) + `loadSavedGame` (127-129).

**Why closest:** the only wired load path today is `listSaves()` → `scene.start('Main', { save })` unguarded. Replace with `loadSavedGame()` typed result.

**Current unguarded load path** (`src/game/scenes/HomeScene.ts:90-101,127-129`):
```typescript
const save = listSaves();
const loadBtn = document.createElement('button');
loadBtn.className = 'home-btn';
loadBtn.dataset.testid = 'load-game';
if (save) {
  loadBtn.textContent = `Resume city (seed ${save.meta.seed}, tick ${save.meta.tick})`;
  loadBtn.addEventListener('click', () => this.loadSavedGame(save.data));
} else {
  loadBtn.textContent = 'No saved game';
  loadBtn.disabled = true;
}
// ...
private loadSavedGame(save) { this.scene.start('Main', { save }); }
```

**Delta:** keep `listSaves()` for the meta label, but in the click handler call `loadSavedGame()` from `src/game/save.ts` (read→parse→migrate→validate). Only `{ ok: true }` reaches `scene.start('Main', { save: migrated })`. On `ok:false`, disable/hide the button or set `loadBtn.textContent = 'Save rejected: <reason>'` using `textContent` (never innerHTML interpolation — sim/storage-derived strings rule). DOM style copies `HomeScene.buildDom()` (24-121): `createElement`, `data-testid`, `.home-btn`.

---

### `src/game/scenes/HUDScene.ts` (MODIFY — Settings drawer)

**Analog:** `HUDScene.ts` Phase 18 drawer patterns — control bar (262-280), advisors drawer (283-312), `toggleAdvisorsDrawer`/`toggleOverlayBar` (508-528), `saveGame` (691-695), event bus on/off (475-497), textContent rule (739).

**Why closest:** the settings panel is a third draw-style surface (control-bar button + hidden drawer) exactly like Advisors/Overlays.

**Control-bar button slot** (add a 4th button, `src/game/scenes/HUDScene.ts:262-280`):
```typescript
const controlBar = document.createElement('div');
controlBar.className = 'hud-control-bar';
controlBar.dataset.testid = 'control-bar';
const advisorsBtn = ...advisorsBtn.dataset.testid = 'controls-advisors'; ...
controlBar.append(advisorsBtn, overlaysBtn, messagesBtn);   // append a settingsBtn too
```

**Drawer toggle pattern** (copy `toggleOverlayBar`, `src/game/scenes/HUDScene.ts:521-528`):
```typescript
private toggleOverlayBar(force?: boolean): void {
  this.overlayBarOpen = force ?? !this.overlayBarOpen;
  if (this.els.overlayBar) {
    this.els.overlayBar.style.display = this.overlayBarOpen ? 'block' : 'none';
  }
  this.game.events.emit('overlay-bar', this.overlayBarOpen);
}
```

**Game-events cleanup (WR-04)** — new bus listeners MUST be off()'d (`src/game/scenes/HUDScene.ts:475-497`):
```typescript
this.game.events.on('hud-toast', this.onHudToast);
// ... add settings listeners here if bus-driven
this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
  this.game.events.off('hud-toast', this.onHudToast);
  // ... off() every handler this instance registered
});
```

**Save + toast pattern** (copy the save flow, `src/game/scenes/HUDScene.ts:691-695`):
```typescript
private saveGame(): void {
  if (!this.main) return;
  const result = writeSave(this.main.getSaveData());
  this.showToast(result.ok ? 'Game saved' : 'Save failed');
}
// Settings Save button equivalent: saveOptions(o) + applyOptions(o) + showToast('Options saved')
```

**Settings controls (data-testid, RESEARCH §Code Examples):** `opt-graphics` (select low/medium/high), `opt-music`/`opt-sfx` (range 0..1), `opt-speed` (select from `SPEED_PRESETS`, `src/sim/time.ts:79`), `opt-text-size`, `opt-reduced-motion` (checkbox). All labels/options via `createElement`/`textContent` — **never innerHTML interpolation** (HUDScene.ts:739 comment, ASVS V5). Drawer values on open come from `loadOptions()`; the HUD speed row (`377-387`) is untouched.

---

### `index.html` (MODIFY — data-attr CSS seams)

**Analog:** `index.html` HUD CSS block (lines 7-545).

**Why closest:** text size / reduced-motion are pure CSS seams driven by `document.body.dataset.*` — the same inline `<style>` hosts all HUD classes already.

**Existing token block to extend (copy exact tokens):** umber `rgba(40,28,14,0.9)`, bronze border `#7a6234`, gold `#e8c46b` — e.g. `.hud-panel` at `index.html:44-50`, `.hud-subtitle` at 58-64.

**Suggested additions (RESEARCH §Code Examples — verbatim):**
```css
body[data-text-size="large"] .hud { font-size: 15px; }
body[data-text-size="small"] .hud { font-size: 11px; }
body[data-reduced-motion="true"] *:not(.hud-toast) {
  animation: none !important;
  transition: none !important;
}
/* + a .settings-drawer block copying .advisor-drawer (248-263) for the new drawer */
```

---

## Tests

### `tests/unit/saveCodec.test.ts` (NEW)

**Analog:** `tests/unit/ui.test.ts:40-49` (options round-trip) + `tests/unit/save.test.ts` (memStore + StorageLike) + `tests/determinism/determinism.test.ts:29-42` (round-trip recipe).

**Assertion style** (`tests/unit/ui.test.ts:41-49`, `tests/unit/save.test.ts:23-60`):
```typescript
import { describe, it, expect } from 'vitest';
import { migrateSave, validateSave, SAVE_VERSION } from '../../src/sim/saveCodec';
import { SimRunner } from '../../src/sim/runner';
// version bounds: version<1 / version>SAVE_VERSION → typed reject
// corrupt: non-finite seed/mapSize/tickCount, commands-not-array, unknown command kind → { ok:false, error }
// round-trip WITH codec in the loop:
const runner = new SimRunner(777); runner.placeBuilding('road', 3, 3); runner.setPolicy(0.1, 0.2);
for (let i = 0; i < 500; i++) runner.tick();
const original = runner.getStateJson();
const migrated = migrateSave(runner.getSaveData());
expect(validateSave(migrated).ok).toBe(true);
expect(SimRunner.fromSaveData(migrated as SaveData).getStateJson()).toBe(original);
```
**Delta cases (RESEARCH Validation Map):** migrate N→N+1 chain + current-version pass-through; `version > current` / `version < 1` typed reject; validate rejects non-finite seed/mapSize/tickCount, `commands` not array, unknown command kind, malformed command field — with NO raw throw.

### `tests/unit/options.test.ts` (NEW)

**Analog:** `tests/unit/save.test.ts` (`memStore()` StorageLike factory, lines 5-12) + `tests/unit/ui.test.ts:40-49`.

**memStore factory to copy verbatim** (`tests/unit/save.test.ts:5-12`):
```typescript
function memStore(): StorageLike {
  const store = new Map<string, string>();
  return { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: (k) => void store.delete(k) };
}
```
**Delta cases:** round-trip `saveOptions`→`loadOptions` under `rcb.options`; missing store → `DEFAULT_OPTIONS`; corrupt JSON → defaults (via `deserializeOptions` catch); forward-compat — `mergeOptions` preserves unknown future fields (RESEARCH PERS-02 map).

### `tests/unit/save.test.ts` (EXTEND — `loadSavedGame`)
Analog: self (memStore + `fakeSave` at 14-21). Add: invalid version / corrupt parse → `{ ok:false }` with typed reason; valid v1 save → `{ ok:true }` and data unchanged; migrated old save accepted.

### `tests/unit/time.test.ts` (EXTEND — boot default speed)
Analog: self (setSpeed tests at 32-36, 92-106). Assert `MainScene`-equivalent boot call `this.setSpeed(options.gameSpeedDefault)` → `timeSystem.speed` equals the default AND the boot default does not override a later `setSpeed(8)` (Pitfall 6).

### `tests/determinism/determinism.test.ts` (EXTEND)
Analog: self (round-trip at 29-42, quoted in saveCodec section). Insert `migrateSave` + `validateSave` into ONE existing byte-identity round-trip so the codec is exercised across systems while goldens stay untouched.

### `e2e/settings.spec.ts` (NEW)

**Analog:** `e2e/sessions.spec.ts:51-90` (save→restart→load, toast asserts, `page.reload`) + `e2e/helpers.ts` (`openGame` 29-32, `toastText` 102-107).

**Harness + assert style** (`e2e/helpers.ts:29-32`, `e2e/sessions.spec.ts:75-89`):
```typescript
export async function openGame(page: Page): Promise<void> {
  await page.goto('/?test&seed=1337', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__cityApi);
}
await page.getByTestId('save-button').click();          // → data-testid-driven
await page.waitForTimeout(200);
await expect(page.getByTestId('toast')).toContainText('Game saved');
```
**Delta flow (RESEARCH PERS-02 e2e):** open settings (`controls-settings`) → toggle an option (`opt-text-size` `large`, `opt-reduced-motion` check) → Save → toast `'Options saved'` → `page.reload()` → assert the option persists (drawer shows `large` / `body[data-text-size="large"]` still set). `page.on('pageerror')`/`console` error-capture convention from `e2e/placement.spec.ts` stays.

---

## Shared Patterns

### Storage abstraction + typed result (reuse `StorageLike`/`SaveResult` from save.ts)
**Source:** `src/game/save.ts:10-15,29,31-45`
**Apply to:** `src/game/options.ts`, `loadSavedGame()` in save.ts — import `StorageLike` from save.ts rather than reimplementing; unit-test with a `Map`-backed memStore (`tests/unit/save.test.ts:5-12`).

### Pure tolerant codec + defaults merge
**Source:** `src/sim/ui.ts:88-113` (`DEFAULT_OPTIONS`, `mergeOptions` = spread-merge, `deserializeOptions` try/catch → defaults)
**Apply to:** `saveCodec.ts` (typed validation, not tolerant parse), `options.ts` (uses ui.ts codec directly). Forward-compat via `{ ...DEFAULT, ...raw }`, never schema-dropping unknown fields.

### DOM createElement / textContent / data-testid (XSS-safe)
**Source:** `src/game/scenes/HUDScene.ts:183-313,739-767` ("sim-derived strings never hit innerHTML") + `src/game/scenes/HomeScene.ts:24-121`
**Apply to:** Settings drawer (HUDScene), Home load-error surface (HomeScene). `btn.dataset.testid = 'opt-*'` for e2e; `data-testid` on every interactive control (Phase 18 convention).

### game.events bus with off() cleanup (WR-04)
**Source:** `src/game/scenes/HUDScene.ts:475-497`
**Apply to:** any new drawer bus events; register each `on` with a matching `off` in the `SHUTDOWN` handler so scene restarts don't stack handlers.

### Drawer toggle (display + force param)
**Source:** `src/game/scenes/HUDScene.ts:508-528` (`toggleAdvisorsDrawer`/`toggleOverlayBar`)
**Apply to:** Settings panel — same `force ?? !open` + `style.display = open ? 'block' : 'none'` + optional `game.events.emit`.

### Determinism round-trip recipe
**Source:** `tests/determinism/determinism.test.ts:29-42`
**Apply to:** saveCodec unit test — build a `SimRunner`, tick, `getStateJson()`, then `migrateSave` + `validateSave` + `fromSaveData` → assert byte-identical `getStateJson()`.

### Golden-byte / byte-identity constraint
**Source:** `tests/golden/golden.test.ts` + locked decision (CONTEXT)
**Apply to:** options persistence and save migration — options never enter `SaveData`/`getStateJson`/`toBuildingState`; `getSaveData` (`runner.ts:2635-2649`) and `fromSaveData` (`2662-2678`) remain untouched.

### Phaser.Game config — read before construct
**Source:** `src/game/main.ts:13-21` + `phaser.d.ts:72768-72837` (RenderConfig context-creation-only)
**Apply to:** `main.ts` — `loadOptions()` before `new Phaser.Game`, map `graphicsQuality` → `render` booleans at boot only.

### Speed — one boot-time injection, HUD overrides
**Source:** `src/game/scenes/MainScene.ts:315-318` (`setSpeed`→`timeSystem.setSpeed`) + `src/sim/time.ts:61-66,79` (`SPEED_PRESETS`)
**Apply to:** `MainScene.create()` sets `gameSpeedDefault` once (both fresh + loaded); HUD speed buttons (`HUDScene.ts:377-387`) keep controlling live speed; never re-apply the default per tick (Pitfall 6).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/game/audio.ts` | utility | event-driven | No sound code exists anywhere in `src/` (grep-confirmed). Closest structural analog is `src/game/palette.ts` (module-level view helpers). Planner should use RESEARCH Pitfall 4 + `phaser.d.ts:104901-104915` (verified `game.sound.setVolume` is global-only) as the pattern source — per-bus multipliers are app-side. |

## Metadata

**Analog search scope:** `src/sim/` (`ui.ts`, `types.ts`, `runner.ts` getSaveData/fromSaveData/setSpeed/applyCommand sections, `time.ts`, `config.ts`, `advisors.ts`), `src/game/` (`save.ts`, `main.ts`, `advisors.ts`, `palette.ts`), `src/game/scenes/` (`MainScene.ts`, `HomeScene.ts`, `HUDScene.ts`), `index.html`, `tests/unit/` (`save.test.ts`, `ui.test.ts`, `time.test.ts`), `tests/determinism/determinism.test.ts`, `e2e/` (`sessions.spec.ts`, `helpers.ts`, `placement.spec.ts`), `.planning/phases/18-management-ui/18-PATTERNS.md`
**Files scanned:** ~30 (full reads of ui.ts, save.ts, main.ts, HomeScene.ts, types.ts, time.ts, index.html, phase-18 PATTERNS, and the test/e2e analogs; targeted reads of runner.ts ranges 225-264/2600-2709/3250-3309, MainScene.ts 30-129/300-339/650-719, HUDScene.ts 110-549/600-769, sim/advisors.ts 1-120)
**Pattern extraction date:** 2026-08-06
