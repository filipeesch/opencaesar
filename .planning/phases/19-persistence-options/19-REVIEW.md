---
phase: 19-persistence-options
reviewed: 2026-08-06T13:10:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
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
findings:
  critical: 1
  warning: 1
  info: 4
  total: 6
status: fixes_applied
---

# Phase 19: Code Review Report

**Reviewed:** 2026-08-06T13:10:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** fixes_applied

## Summary

Reviewed all 15 source/test files changed by the Phase-19 commits (`bdb433a`…`605a147`) against the PLAN's PERS-01/PERS-02 contracts at standard depth.

Confirmed sound:
- **`fromSaveData` (runner.ts:2662) untouched** — `git diff bdb433a^..605a147 -- src/sim/runner.ts` is empty; applyCommand's raw throw (runner.ts:3290) remains the last-resort net exactly as required.
- **Golden fixtures untouched** — `git diff ... -- tests/golden` is empty; the determinism round-trip (migrateSave + validateSave in the loop) passes; `migrateSave`/`validateSave` are pure (no Math.random/Date.now); options never enter SaveData/getStateJson.
- **saveCodec quality**: `migrateSave` typings and version bounds match the plan; `validateCommand` covers every member of the SaveCommand union (verified against runner.ts command producers and the BuildingType ↔ BUILDINGS key set — no false rejections of legitimate saves).
- **loadSavedGame()** implements read→parse→migrate→validate with a typed LoadResult; both gates (HomeScene click-through + MainScene defense-in-depth) are inserted BEFORE fromSaveData; invalid saves are surfaced via `textContent` (no innerHTML interpolation anywhere in the new code — verified).
- **Determinism assertions**: no Math.random/Date.now introduced in any sim path; unit suites (saveCodec 18, save 11, options 6) pass.

Two findings are substantive: one BLOCKER — `validateSave` omits `pendingCommands`, leaving a corruption/hostile-input path that reaches `applyCommand`'s raw `unknown command kind` throw or NaN propagation after load (the exact T-19-01 scenario the phase claims to close) — and one WARNING on unsanitized persisted options values flowing into the DOM/settings drawer.

## Critical Issues

### CR-01: `validateSave` does not validate `pendingCommands` — corrupt save bypasses both gates and can reach applyCommand's raw throw after load

**Status:** fixed (`9a56cdd`)

**File:** `src/sim/saveCodec.ts:183-198`
**Issue:** `validateSave` validates only `s.commands`; the `pendingCommands` field of SaveData (types.ts:108, written by getSaveData at runner.ts:2644-2646 and re-enqueued verbatim by `fromSaveData` at runner.ts:2673-2675) is completely ignored. `fromSaveData` is unchanged (correct), so its `runner.enqueue({ ...c })` re-queues whatever `pendingCommands` contained, and the next tick — i.e., the first resume after load — drains them through `applyCommand` (runner.ts:292). A hostile or bit-corrupted save shaped as:
```json
{ "version": 1, "seed": 1, "mapSize": 40, "commands": [], "tickCount": 0, "paused": true, "pendingCommands": [ { "kind": "bogus" } ] }
```
passes `validateSave` `{ok:true}` and both gates, then throws the raw `unknown command kind: bogus` error (runner.ts:3290) on unpause — the exact crash T-19-01 set out to eliminate ("a corrupt save NEVER reaches applyCommand's raw 'unknown command kind' throw"). Similarly a `pendingCommands` entry with a non-finite `x`/`y`/`amount`/`qty` (e.g. `{kind:'place', type:'road', x:NaN, y:0}`) would propagate NaN into the deterministic core after load, contradicting the "never a silent misload on a NaN" guarantee. This is a real, reachable gap in the phase's primary deliverable, not a theoretical concern: `pendingCommands` is user-controlled via localStorage and is never shape-checked anywhere on the load path.

**Fix:** In `validateSave`, after the `commands` array check, treat `pendingCommands` with the same rigor — reject a non-array, and run `validateCommand(cmd)` on every member, mapping failures to a typed `SaveValidationError` (reuse `'malformed-command'` / `'unknown-command-kind'` rather than adding a new enum member, to keep `loadSavedGame`'s `'validate'` mapping unchanged):
```ts
if (s.pendingCommands !== undefined) {
  if (!Array.isArray(s.pendingCommands)) {
    return { ok: false, error: 'commands-not-array', reason: 'pendingCommands must be an array' };
  }
  for (const cmd of s.pendingCommands) {
    const err = validateCommand(cmd);
    if (err) {
      const kind = (cmd as { kind?: unknown } | null)?.kind;
      return { ok: false, error: err, reason: `malformed pending command: ${kind === undefined ? 'non-object' : String(kind)}` };
    }
  }
}
```
Add a `validateSave` unit case pinning a hostile `pendingCommands` (unknown kind and NaN member) to `{ok:false}`. (Note: with the fix, `drainPendingCommands`' applyCommand throw stays unreachable from the load path — the release valve remains solely for in-process bugs.)

## Warnings

### WR-01: Persisted options values are merged into OptionsSchema without shape/range validation — malformed-but-parseable JSON bypasses the "defaults on corrupt" guarantee

**Status:** fixed (`c718f1c`)

**File:** `src/game/options.ts:23-29, 48-52` (also `src/sim/ui.ts:105-112` — pre-existing, newly wired to a persisted store + DOM by this phase)
**Issue:** `loadOptions`/`deserializeOptions` only fall back to defaults when the stored JSON is missing or fails to parse. Parseable-but-invalid values merge straight through `mergeOptions` (`{...DEFAULT_OPTIONS, ...raw}`): a hand-edited or hostile `rcb.options` of `{"textSize":"gigantic"}` or `{"audioMusic":7,"reducedMotion":"yes"}` survives, is copied verbatim into `document.body.dataset.textSize` / `.dataset.reducedMotion` (options.ts:49-50), and pre-fills the settings drawer — `opt-text-size` becomes a blank/unselectable select and `audioMusic` is persisted at 7 (clamped only at save time in the drawer, never at load). The threat model's T-19-06 mitigation only guards the `gameSpeedDefault` crash path (the MainScene positive-finite check); the rest of the schema is unguarded. Not a crash/XSS, but it makes the claimed "corrupt → defaults" behavior (options.test.ts case 3) only cover unparseable JSON and lets junk reach the DOM and the persisted mix.

**Fix:** Add a shape/range pass where the options cross the persistence boundary. Either sanitize in `loadOptions` (clamp `audioMusic`/`audioSfx` to [0,1], whitelist `textSize` ∈ {small,normal,large} and `graphicsQuality` ∈ {low,medium,high}, coerce `reducedMotion` to boolean, require `gameSpeedDefault` positive-finite) or in `applyOptions`:
```ts
export function applyOptions(o: OptionsSchema): void {
  const textSize = ['small', 'normal', 'large'].includes(o.textSize) ? o.textSize : DEFAULT_OPTIONS.textSize;
  const quality = ['low', 'medium', 'high'].includes(o.graphicsQuality) ? o.graphicsQuality : DEFAULT_OPTIONS.graphicsQuality;
  const rm = typeof o.reducedMotion === 'boolean' ? o.reducedMotion : Boolean(o.reducedMotion);
  document.body.dataset.textSize = textSize;
  document.body.dataset.reducedMotion = String(rm);
  setMusicVolume(clamp01(o.audioMusic));
  setSfxVolume(clamp01(o.audioSfx));
}
```
Add an options.test.ts case: a parseable-but-invalid stored value returns sanitized defaults.

## Info

### IN-01: HUD speed row not synchronized with a non-default `gameSpeedDefault`

**Status:** skipped (out of mandated CR+WR fix scope — cross-scene logic change with e2e re-run risk)

**File:** `src/game/scenes/MainScene.ts:92-100`
**Issue:** When `gameSpeedDefault` is persisted as 2 (or 0.5/4/8), the sim boots at that speed but the HUD `[0.5,1,2,4,8]` speed buttons still render 1x as the active choice until the user clicks one — the visible speed indicator contradicts the actual sim speed.
**Fix:** After the boot-speed injection, emit/derive the active preset into the speed row (or have the HUD read `loadOptions().gameSpeedDefault` when initializing its button state).

### IN-02: text-size CSS seams only apply inside `.hud`; the settings/advisor drawers are unaffected

**Status:** skipped (cosmetic CSS — out of mandated CR+WR fix scope; low functional impact)

**File:** `index.html:266-270` (`body[data-text-size='large'|'small'] .hud`)
**Issue:** The settings, advisors, and overlay drawers are appended to `document.body` (HUDScene.ts:490 and peers), outside the `.hud` subtree, so the `large`/`small` text-size option rescales the HUD but not the very drawer that exposes the setting.
**Fix:** Extend the selectors to the drawer containers (e.g. `body[data-text-size='large'] .hud, body[data-text-size='large'] .settings-drawer`).

### IN-03: `e2e/settings.spec.ts` `beforeEach` navigates twice

**Status:** skipped (test-only cleanup — passing e2e; re-run risk on loaded host; out of mandated CR+WR scope)

**File:** `e2e/settings.spec.ts:18-25`
**Issue:** Each test's `beforeEach` does `page.goto(...)` then `removeItem('rcb.options')` then `page.reload(...)` — the first `goto` fully boots the app (with whatever options were present) purely to be re-navigated. The ordering makes the test's intent (clean-options-at-boot) harder to read.
**Fix:** Single navigation — clear the key first, then boot (options are read from localStorage at module load, so clearing must precede the goto):
```ts
await page.goto('/?test&seed=1337', { waitUntil: 'domcontentloaded' });
// can't clear before the tab exists, but this first load is only to get a
// context — remove, then do the real boot:
await page.evaluate(() => window.localStorage.removeItem('rcb.options'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__cityApi);
```
At minimum, drop the initial `page.goto(...)` before the `removeItem` block to make the intended boot-time-clean-load explicit.

### IN-04: Home load button is permanently disabled after one rejection, with no retry path

**Status:** skipped (out of mandated CR+WR fix scope — needs retry affordance design, not a targeted code fix)

**File:** `src/game/scenes/HomeScene.ts:145-151`
**Issue:** On `{ok:false}` the Load button is disabled and left that way for the session. If a later valid save is written (e.g., an autosave overwrites rcb.save while the player is on Home), there is no way to retry without a full reload. The rejection surfacing itself (textContent, `Save rejected: reason`) is correct.
**Fix:** Re-check `listSaves()` on a small interval/Home refresh and re-enable the button when a valid record appears, or add a manual "re-check" affordance.

---

_Reviewed: 2026-08-06T13:10:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
