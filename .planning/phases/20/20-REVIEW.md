---
phase: 20
status: needs-fix
reviewed: 2026-08-07T00:00:00Z
findings: 11
severity:
  critical: 0
  warning: 5
  info: 6
---

# Phase 20: Code Review Report (UI Redesign — Sidebar & Advisors)

## Summary

Reviewed the 11 phase-20 source files (git diff `61d2c8c..HEAD`): the six new `src/game/ui/` builders (`dom.ts`, `topbar.ts`, `sidebar.ts`, `advisorDrawer.ts`, `keyboard.ts`, `overlays.ts`, `inspector.ts`), the heavily refactored `HUDScene.ts`, the key-router integration in `MainScene.ts`, `HomeScene.ts` innerHTML removal, and `palette.ts`. Cross-checked against the unit tests (`keyboard`, `advisor-drawer`, `inspector`, `sidebar-*`, `overlay-hues`, `uppercase-labels`, `no-innerhtml`) and the e2e specs (`sidebar`, `keyboard`, `inspect`, `management-ui`, `sessions`, `boots`, `placement`, `acceptance`, `settings`).

**Constraints verified as satisfied:** no `src/sim/` changes (view-only phase holds); zero `innerHTML`/`outerHTML`/`insertAdjacentHTML` in `src/game/` (UI-RED-08 holds — all sim-derived strings cross via `textContent`, including toast, log, advisor rows, and the load-error path); all panel data comes from the live runner composer (`advisorPanels`) or `getInspector`/`getWalkerInternals` — nothing fabricated; no `Math.random`/`Date.now`/`new Date` in the new ui/scene code (date derives from `state.tick`); per-service overlay ramps and the `.uppercase` CSS-only transform are correctly implemented; `game.events` handlers are registered as bound fields and `off()`-ed on scene shutdown (WR-04 cleanup is correct in both scenes — no restart doubling).

**Key concerns:** the new keyboard router (the phase's largest new surface) has no focus guard and fires into form controls; the build-category filter lost its "All" reset; the first `B` press is a visible no-op; walker inspector cards never refresh; and the settings drawer / overlay bar are absent from the router's Escape precedence stack.

## Findings

| ID | Severity | Location | Summary |
|----|----------|----------|---------|
| WR-01 | WARNING | `src/game/scenes/MainScene.ts:159-209` | Key router fires into focused form controls (sliders/selects) |
| WR-02 | WARNING | `src/game/ui/sidebar.ts:23-26`, `HUDScene.ts:366-372` | Category filter has no way back to "All" (regression) |
| WR-03 | WARNING | `src/game/scenes/HUDScene.ts:80,236-241` | First `B` press is a visible no-op (toggle asymmetry) |
| WR-04 | WARNING | `src/game/scenes/HUDScene.ts:117-137,736-754` | Walker inspector card never refreshes and never auto-closes |
| WR-05 | WARNING | `src/game/ui/keyboard.ts:92-98`, `MainScene.ts:165-174` | Escape pauses the game while the settings drawer / overlay bar is open |
| IN-01 | INFO | `HUDScene.ts:198-202` | Full 13-panel drawer + inspector card rebuilt every tick (churn; no leak) |
| IN-02 | INFO | `HUDScene.ts:322,476,485` | Dead code: `els.pop` never read; `advisor-open`/`overlay-bar` events have no listeners |
| IN-03 | INFO | `tests/unit/inspector.test.ts:53`, `dom.ts:108-110` | Stub `setAttribute`→`dataset` divergence: `dataset.disabled` only exists in stubs |
| IN-04 | INFO | `HUDScene.ts:540-543` | `selectAdvisor` sets `activeAdvisor` before the drawer validates the id |
| IN-05 | INFO | `MainScene.ts:341` | Redundant condition `if (!v \|\| v === 0)` |
| IN-06 | INFO | `MainScene.ts:159` | No `ev.repeat` guard — holding A/←/→/Escape cycles rapidly |

---

### WR-01: Key router fires into focused form controls

**Location:** `src/game/scenes/MainScene.ts:159-209` (keydown handler), `src/game/ui/keyboard.ts:62-123`

**Description:** Phaser 3.90's `KeyboardManager.onKeyDown` (verified in `node_modules/phaser/src/input/keyboard/KeyboardManager.js:186-210`) attaches to `window` and does **not** filter by `event.target`. The new router binds A/←/→/B/1-5 plus W/F/R/C/D/X with no check for focus in an `input`/`select`/`textarea`. The sidebar and settings drawer are full of keyboard-interactive controls (policy `range` sliders, `opt-music`/`opt-sfx` sliders, graphics/speed/text-size `select`s, reduced-motion checkbox).

**Consequence:** while the inspector card is open, arrow-keying the tax/wage slider (the natural way to fine-tune a range input) also steps the inspector to the next/previous entity (`MainScene.ts:183-188`). With the advisor drawer open, arrows cycle advisor tabs while the user adjusts a slider; letter keys pressed while a `<select>` has focus (e.g., settings drawer) toggle overlays/build panel. The phase's own dispatch flagged "focus/input fields" as a target — this is the miss.

**Suggested fix:**
```ts
kb?.on('keydown', (ev: KeyboardEvent) => {
  const t = ev.target as HTMLElement | null;
  if (t && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(t.tagName)) return;
  // ... existing routing
});
```

---

### WR-02: Category filter has no way back to "All"

**Location:** `src/game/ui/sidebar.ts:23-26` (`BUILD_CATEGORIES`), `src/game/scenes/HUDScene.ts:366-372` (category click wiring)

**Description:** The Phase-18 build panel rendered an explicit "All" tab (`dataset.cat='all'`, active by default); the new sidebar's `BUILD_CATEGORIES` contains only the 13 categories. `filterGrid()` (`HUDScene.ts:457-463`) still supports `'all'` as the default, but once a user clicks any category tab there is no control that sets `activeCategory` back to `'all'` — clicking the same category again just re-applies it.

**Consequence:** after one category click the 17-building grid is permanently filtered for the rest of the session; the player can never restore the full catalog without restarting. Regression vs. the old "All" button.

**Suggested fix:** add an `'all'` tab to `BUILD_CATEGORIES` (or append a dedicated "All" button in `buildSidebarDom`) and include it in `sidebar-category-tabs`; re-clicking the active category could also reset to `'all'` as an alternative.

---

### WR-03: First `B` press is a visible no-op

**Location:** `src/game/scenes/HUDScene.ts:80` (`buildPanelOpen = true`), `MainScene.ts:192-198`, `HUDScene.ts:236-241`

**Description:** The build panel is visible by default (`buildPanelOpen = true`, no `display:none` on `sidebar-build-panel`). The router's B toggle flips `buildModeEngaged` (`MainScene.ts:192-194`), but `setBuildPanelOpen(true)` sets `style.display = ''` — already visible. So the first B press changes internal state only; the panel only hides on the **second** B press (and re-shows on the third). The e2e (`keyboard.spec.ts:50-51`) passes trivially because it asserts "visible after B" against an already-visible panel.

**Consequence:** the primary documented keyboard shortcut ("B toggles the build panel", SPEC §3) appears dead on first press — a UX bug the spec locks as a toggle.

**Suggested fix:** derive the initial visibility from `buildModeEngaged` (start `false` and hide the panel at build, or start `buildPanelOpen = false` and set `display:none` in `buildSidebarDom`), so every B press produces a visible change.

---

### WR-04: Walker inspector card never refreshes and never auto-closes

**Location:** `src/game/scenes/HUDScene.ts:117-137` (`onHudWalkerInspect`), `736-754` (`renderWalkerInspector`), `202` (per-tick refresh only for `inspectId !== null`)

**Description:** Building popups are re-rendered every tick from live state (`update()` line 202), but walker cards set `this.inspectId = null` (line 121), so the tick guard's `if (this.inspectId !== null)` branch never touches them. The walker card shows the snapshot captured at open time: state/position/path-length rows go stale immediately (walkers move every tick), the card never reflects the walker dying, and it never closes on its own. Building and walker inspectors are the same UX surface but have opposite freshness behavior.

**Consequence:** misleading data in the walker inspector ("Path Length: 3" for a walker that has walked across the map, or a card for a dead walker) — the exact "stale re-render" class the dispatch asked to check.

**Suggested fix:** track walker popups with a separate flag (e.g., `inspectWalkerId: number | null`), re-resolve `getWalkerInternals`/`getInspector(id, 'walker')` under the tick guard, re-render if the entity still exists, and `closePopup()` when `getInspector` returns null (walker gone).

---

### WR-05: Escape pauses the game while the settings drawer or overlay bar is open

**Location:** `src/game/ui/keyboard.ts:92-98` (close-surface precedence), `src/game/scenes/MainScene.ts:165-174` (RouterCtx only carries the *advisor* drawer)

**Description:** The router's surface stack is drawer(advisor) > inspector > build > pause. The settings drawer and overlay bar — both interactive surfaces living in the same new sidebar, toggled by nav buttons (`HUDScene.ts:480-497`) — are not part of the ctx, so with the settings drawer open, Escape falls through the empty stack to `r.pause.paused = !r.pause.paused` and **pauses the game**, leaving the settings drawer open under the pause overlay. The user must click Resume, then Escape again to actually dismiss settings.

**Consequence:** Escape never closes the surface the user is looking at; it triggers an unrelated pause — a direct hole in the phase's own "precedence guard (single router)" design.

**Suggested fix:** extend `RouterCtx`/`RouterResult` with the settings-drawer and overlay-bar open flags (query `HUDScene` for them) and add them to the Escape precedence chain above pause, e.g. `drawer > inspector > settings > overlay-bar > build > pause`.

---

### IN-01: Full drawer + inspector card rebuilt every tick while open

**Location:** `src/game/scenes/HUDScene.ts:198-200, 202`

**Description:** Under the tick guard, an open drawer re-renders **all 13** panel hosts (each `advisorPanels(runner)` call re-composes all 13 panels) and an open building popup rebuilds its entire card including nav buttons and listeners. Verified: no memory leak (old nodes/listeners are GC'd via `textContent = ''`/`replaceChildren()`), but per-tick full-tree churn also resets any user scroll position in long advisor panels. Consider rendering only the active panel.

---

### IN-02: Dead code — `els.pop`, `advisor-open`, `overlay-bar` events

**Location:** `src/game/scenes/HUDScene.ts:322, 476, 485`

**Description:** `this.els.pop` is assigned in `collectEls` but never read (refresh goes through `topBar.valueNodes`). `toggleAdvisorsDrawer` emits `'advisor-open'` and `toggleOverlayBar` emits `'overlay-bar'` on `game.events` with no subscribers anywhere in `src/` or tests. Remove the dead field and the two emits (or document them as an e2e hook).

---

### IN-03: Stub `setAttribute`→`dataset` divergence masks a test/real-DOM gap

**Location:** `src/game/ui/dom.ts:108-110`, `tests/unit/inspector.test.ts:53, 59, 65`

**Description:** `StubNode.setAttribute` stores into `dataset`, so `inspector.test.ts` asserts `prev.dataset.disabled` — which is **never true in a real browser** (real `dataset` only reflects `data-*` attributes; the `disabled` attribute lives elsewhere). The tests pass on stubs but assert a property that does not exist in the shipped DOM. The real button still works (attribute disables it), so this is a contract divergence, not a functional bug — but the stub should mirror the browser (e.g., store attributes separately) or the test should assert the attribute.

---

### IN-04: `activeAdvisor` set before drawer validation

**Location:** `src/game/scenes/HUDScene.ts:540-543`

**Description:** `selectAdvisor(id)` writes `this.activeAdvisor = id` before `advisorDrawer.selectAdvisor(id)` can reject an unknown id (`byId.has` guard, `advisorDrawer.ts:89`). `activeAdvisorId()` then feeds the router's ctx; an invalid id self-heals only because `stepTab` falls back to `ADVISOR_TAB_ORDER[0]`. Validate first:
```ts
private selectAdvisor(id: string): void {
  if (this.advisorDrawer?.activeTab() !== undefined && !this.advisorDrawer.tabs().some((t) => t.id === id)) return;
  ...
}
```

---

### IN-05: Redundant condition in overlay render

**Location:** `src/game/scenes/MainScene.ts:341` — `if (!v || v === 0) continue;` — `!v` already covers `v === 0` (and NaN). Simplify to `if (!v) continue;`.

---

### IN-06: No key-repeat guard

**Location:** `src/game/scenes/MainScene.ts:159`

**Description:** `ev.repeat` is not checked; holding A cycles advisor tabs at key-repeat rate, holding ←/→ flips cards, holding Escape toggles pause on/off (the OLD `keydown-ESC` handler had the same pause flicker, but A/←/→ are new to this phase). Add `if (ev.repeat) return;` at the top of the handler.

---

_Reviewed: 2026-08-07_
_Reviewer: gsd-code-reviewer (deep)_
_Depth: deep_
