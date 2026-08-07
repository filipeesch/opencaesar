---
phase: 20-ui-sidebar
plan: 20-plan
type: execute
status: planned
created: 2026-08-07
updated: 2026-08-07
milestone: v1.1 UI Redesign — Caesar III Sidebar
autonomous: true
requirements:
  - UI-RED-01 (sidebar hub replaces top HUD)
  - UI-RED-02 (advisor drawer, live data)
  - UI-RED-03 (keyboard-first navigation)
  - UI-RED-04 (per-service overlay hues + legends)
  - UI-RED-05 (sidebar inspectors)
  - UI-RED-06 (UPPERCASE labels)
  - UI-RED-07 (precedence-safe bindings)
  - UI-RED-08 (XSS-safe DOM: no innerHTML)
effort:
  tokens: 60000
  tasks: 10
  waves: 6
---

<objective>
Replace the current top-edge HUD (`src/game/scenes/HUDScene.ts`, ~1177 lines) with a Caesar III-style **right sidebar** as the interaction hub — build panel, tools, speed, advisor drawer, overlay toggles, inspectors — plus a minimal **top status bar** (Population, date, Treasury, ratings). Rebuild advisors, overlays, and inspectors as sidebar-driven surfaces with keyboard-first navigation (A / ← / → / Escape / B / 1-5), per-service overlay hues, and UPPERCASE labels — while keeping the sim core byte-identical: no `src/sim/*` change, no `getState()`/SaveData shape change, golden fixtures unchanged, and every DOM label/string routed through `textContent`/`createElement` (UI-RED-08: zero `innerHTML` in game UI + `index.html`).
</objective>

<execution_context>
## Constraints (locked from CONTEXT.md + code audit)

1. **View-only redesign.** ZERO changes to `src/sim/*`; `getState()`, `getStateJson()`, and SaveData shape unchanged; `tests/golden/*` fixtures byte-identical. All UI reads go through existing runner getters; the only writes are the existing commands (`setPolicy`, `setBuildMode`, `setPaused`, `setSpeed`).
2. **`src/game/advisors.ts` stays the single 13-advisor source.** `advisorPanels(source)` + `ADVISOR_TAB_ORDER` (ratings, finance, food, production-logistics, labor, trade, housing, demography, safety-risks, religion, governance, diplomacy, objectives) is consumed by the sidebar drawer, never duplicated.
3. **UPPERCASE is case-only (UI-RED-06 / UI-FIX-03).** Keep the exact wording from 18-UI-SPEC: stat labels `Population / Prosperity / Happiness / Treasury / Employed / Food / Culture / Stability / Favor / Water / Risk / Gov`; advisor titles `Ratings / Finance / Food / Production & Logistics / Labor / Trade / Housing / Demography / Safety & Risks / Religion / Governance / Diplomacy / Objectives`. No reworded labels.
4. **Per-service hues are view-only data** in `src/game/palette.ts` — fire=red, danger=orange, collapse=brown, crime=purple, food=green, water=blue, desirability=teal; each keeps the existing 5-step ramp shape (band 0..4). Never imported by the sim.
5. **Keyboard bindings are additive (UI-RED-07).** Preserve existing precedence: advisor drawer > inspector > build mode > pause. Existing ESC (cancel build mode → else toggle pause) and W/F/R/C/D/X overlay keys MUST keep working. New keys: `A` cycles advisors (opens drawer), `←`/`→` switch panels (drawer, or inspector when one is open), `Escape` closes drawer/inspector first (then falls through to existing behavior), `B` toggles build panel, `1`-`5` toggle overlays (water/food/coverage/desirability/risks order per existing overlay ids).
6. **XSS-safe DOM (UI-RED-08).** The refactor must ALSO replace the existing `innerHTML` sites in `HUDScene.ts` — the static stats/policy/log/overlay templates (~`:197`, `:253`, `:262`, `:471`) and the `renderLog` clear at `:791` (use `textContent = ''` / `replaceChildren()`). Audit covers `src/game/**` + `index.html` inline CSS (no script injection surface; labels/values only via textContent).
7. **Date in the top bar** derives from the sim's tick→year/month division (same rule as 18-UI-SPEC); no new serialized field.
8. **Tests keep existing patterns**: vitest node-env `tests/**/*.test.ts` (unit/integration/determinism/golden) + Playwright root `e2e/*.spec.ts` (`playwright.config.ts` webServer `:5173`). New files: `tests/unit/sidebar-*.test.ts`, `tests/unit/overlay-hues.test.ts`, `tests/unit/advisor-drawer.test.ts`, `e2e/sidebar.spec.ts`, `e2e/keyboard.spec.ts`.

## File inventory / seams

- `src/game/scenes/HUDScene.ts` (1177) — today owns: stats panel, build panel + category tabs, policy sliders, message log, control bar, speed row, pause button, overlay card. All of it relocates into the sidebar + top bar.
- `src/game/scenes/MainScene.ts` (780) — isometric container; camera wheel/drag; existing keyboard (ESC + W/F/R/C/D/X); owns `setOverlay`/`emitInspect`/`setBuildMode`/`setPaused`/`setSpeed`. The new central key-router lives here; sidebar surfaces subscribe to scene events.
- `src/game/advisors.ts` — `advisorPanels(source)` + `ADVISOR_TAB_ORDER` (13 ids) — the single advisor data seam (read-only).
- `src/game/palette.ts` — today `OVERLAY_RAMPS` (5-step hex ramps); add the per-service `SERVICE_HUES` color table + legend metadata.
- `src/game/options.ts` — persisted shell options (`rcb.options`, localStorage, disjoint from save envelope; `loadOptions`→`sanitizeOptions` on boot). Sidebar settings/tools write through this seam only.
- `index.html` — inline CSS for `.hud` etc.; sidebar layout CSS here (no new external stylesheet).
- Tests: `tests/unit/advisor-composer.test.ts`, `tests/unit/ui.test.ts`, `tests/unit/water-overlay.test.ts`, `tests/golden/*`, `tests/determinism/*`; `e2e/management-ui.spec.ts`, `e2e/inspect.spec.ts`, `e2e/helpers.ts`.

## Commands (gates)

- Typecheck: `npm run typecheck` (`tsc --noEmit`)
- Unit/integration/determinism/golden: `npm run test` (vitest run, node env)
- E2E: `npm run test:e2e` (Playwright, webServer `:5173`)
- XSS audit: `grep -rn 'innerHTML' src/game index.html | wc -l` → `0` (audit includes comments; use `grep -v '^#'` hygiene per file if needed)
- Golden guard: `git status --porcelain tests/golden` → empty
</execution_context>

<tasks>

<!-- ===================== WAVE 0 — INVENTORY & SPEC ===================== -->

<task id="20-00-01" type="scaffold" wave="0" depends_on="[]">
  <name>Wave 0 — Control inventory, sidebar spec, RED scaffolds</name>
  <files>
    - `.planning/phases/20/SPEC.md` (new: sidebar DOM tree + top-bar layout + key map + per-service hue table)
    - `tests/unit/sidebar-controls.test.ts` (new, RED)
    - `tests/unit/sidebar-layout.test.ts` (new, RED)
    - `tests/unit/overlay-hues.test.ts` (new, RED)
    - `tests/unit/advisor-drawer.test.ts` (new, RED)
    - `e2e/sidebar.spec.ts` (new, RED)
    - `e2e/keyboard.spec.ts` (new, RED)
  </files>
  <action>
    Enumerate EVERY control in `HUDScene.ts` and map it to its runner seam:
    stats panel → `getState()` + `getDerived()`; build panel/category tabs → `setBuildMode` + category list;
    policy sliders → `setPolicy`; message log → message getter seam; speed row → `setSpeed`;
    pause → `setPaused`; overlay card → existing overlay ids via `setOverlay`;
    advisors → `advisorPanels(runner)` + `ADVISOR_TAB_ORDER`; inspectors → `getInspector`/`getWalkerInternals`.
    Record which labels come from 18-UI-SPEC verbatim (constraint 3). Define the sidebar DOM tree
    (build panel + category tabs, tools/settings, speed, advisor drawer host, overlay toggle group,
    inspector card host) and the top status bar (Population, date via tick→year/month, Treasury, ratings).
    Extend `palette.ts` spec with the per-service hue table (constraint 4). Write the RED scaffolds
    (vitest + Playwright) asserting the new structure: sidebar exists, top bar exists, no `innerHTML`
    in the new DOM builder, per-service hues resolve, 13 advisor tabs in `ADVISOR_TAB_ORDER`.
  </action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/sidebar-controls.test.ts tests/unit/sidebar-layout.test.ts tests/unit/overlay-hues.test.ts tests/unit/advisor-drawer.test.ts -x</automated>
  </verify>
  <acceptance_criteria>
    SPEC.md records: full control→seam map (no orphan controls), sidebar DOM tree, top-bar fields,
    key map with precedence, hue table; RED test files exist and fail for the right reason (structure not yet built).
  </acceptance_criteria>
</task>

<!-- ===================== WAVE 1 — SIDEBAR + TOP BAR ===================== -->

<task id="20-01-01" type="tracer" wave="1" depends_on="[20-00-01]">
  <name>Wave 1 — Sidebar scaffold (build panel + tools + speed + overlay/advisory buttons)</name>
  <files>
    - `src/game/scenes/SidebarScene.ts` (new, or `HUDScene.ts` reorganized — decide in SPEC)
    - `src/game/scenes/MainScene.ts` (key-router hook + sidebar launch)
    - `index.html` (sidebar layout CSS)
  </files>
  <action>
    Build the right-sidebar container as the interaction hub, entirely with `createElement`/`textContent`
    (UI-RED-08 — no `innerHTML` even in static templates). Sections: build panel (category tabs + building grid),
    tools/settings (opens `rcb.options` seam), speed controls (`setSpeed`), pause (`setPaused`),
    advisor button (host for Wave 2), overlay toggle group (host for Wave 3). Wire every control to its
    existing runner seam from the Wave-0 map — no new sim getters. Keep the existing controls functional
    during the transition (sidebar + old HUD coexist until 20-01-02 removes the old top HUD).
  </action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/sidebar-controls.test.ts -x && npx playwright test e2e/sidebar.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    Sidebar renders at the right edge; build/tools/speed/advisor/overlay controls all dispatch to existing seams;
    new DOM builder passes the no-innerHTML unit assert; green e2e/sidebar.spec.ts.
  </acceptance_criteria>
</task>

<task id="20-01-02" type="expand" wave="1" depends_on="[20-01-01]">
  <name>Wave 1 — Top status bar + remove old top HUD + DOM safety sweep</name>
  <files>
    - `src/game/scenes/HUDScene.ts` (top bar rebuild + delete relocated controls)
    - `index.html` (top-bar CSS; remove `.hud` remnants)
  </files>
  <action>
    Build the minimal top status bar (Population, date via tick→year/month, Treasury, ratings) with
    `createElement`/`textContent`, labels verbatim from 18-UI-SPEC. After the Wave-0 map confirms every
    control relocated to the sidebar, delete the old top-HUD controls (stats panel, policy sliders block,
    message log chip, control bar, speed row, pause button, overlay card). DOM safety sweep: replace the
    remaining `innerHTML` template sites (`~:197`, `:253`, `:262`, `:471`) with builder helpers and the
    `renderLog` clear (`:791`) with `replaceChildren()`. Run the full no-innerHTML audit (constraint 6).
  </action>
  <verify>
    <automated>npm run typecheck && npm run test && npx playwright test e2e/sidebar.spec.ts && grep -rn 'innerHTML' src/game index.html | wc -l</automated>
  </verify>
  <acceptance_criteria>
    Top bar shows the 4 fields with verbatim labels; old top-HUD controls gone (no orphan seams);
    `grep -rn 'innerHTML' src/game index.html | wc -l` → `0`; sidebar e2e green; full vitest green.
  </acceptance_criteria>
</task>

<!-- ===================== WAVE 2 — ADVISOR DRAWER + KEYBOARD ===================== -->

<task id="20-02-01" type="expand" wave="2" depends_on="[20-01-02]">
  <name>Wave 2 — Advisor drawer (13 tabs, live data, tick-change re-render, empty states)</name>
  <files>
    - `src/game/scenes/SidebarScene.ts` (drawer host + tab strip + panel body)
    - `src/game/advisors.ts` (unchanged — read-only seam)
    - `tests/unit/advisor-drawer.test.ts` (RED → green)
    - `e2e/sidebar.spec.ts` (drawer cases)
  </files>
  <action>
    Advisor drawer overlays the sidebar: tab strip renders `ADVISOR_TAB_ORDER` (13 ids), titles verbatim
    from 18-UI-SPEC, UPPERCASE via CSS (constraint 3). Panel body pulls live data from
    `advisorPanels(runner)` — same data the old advisor surfaces used; re-render only when the sim tick
    changes (tick-change guard, not per-frame). Empty states use the 18-UI-SPEC wording:
    "No data yet" (empty panel), "No messages yet" (log), "Nothing highlighted" (no selection).
    No sim-side change; all data read-only through the existing seam.
  </action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/advisor-drawer.test.ts -x && npx playwright test e2e/sidebar.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    Drawer opens with 13 tabs in catalog order; panel body live-updates on tick change only;
    empty states render verbatim; `advisors.ts` has zero diffs.
  </acceptance_criteria>
</task>

<task id="20-02-02" type="expand" wave="2" depends_on="[20-02-01]">
  <name>Wave 2 — Keyboard-first navigation (A / ← / → / Escape / B / 1-5) + precedence</name>
  <files>
    - `src/game/scenes/MainScene.ts` (central key-router; existing ESC + W/F/R/C/D/X preserved)
    - `src/game/scenes/SidebarScene.ts` (focus + panel switching hooks)
    - `tests/unit/ui.test.ts` (key-router cases)
    - `e2e/keyboard.spec.ts` (RED → green)
  </files>
  <action>
    Add the additive key bindings (UI-RED-07) behind a central key-router in `MainScene.ts`:
    `A` cycles advisors (opens drawer), `←`/`→` switch panels (drawer, or inspector when one is open),
    `Escape` closes drawer/inspector first then falls through to existing ESC behavior
    (cancel build mode → else toggle pause), `B` toggles build panel, `1`-`5` toggle overlays.
    Precedence is enforced by a single guard: drawer > inspector > build mode > pause.
    Regression-lock the existing keys (ESC cancel-build→toggle-pause; W/F/R/C/D/X overlay keys)
    in `tests/unit/ui.test.ts` + `e2e/keyboard.spec.ts`.
  </action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/ui.test.ts -x && npx playwright test e2e/keyboard.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    All 7 new keys dispatch to the right surfaces; precedence guard passes for drawer/inspector/build/pause;
    existing ESC + W/F/R/C/D/X regression cases green; no key conflicts.
  </acceptance_criteria>
</task>

<!-- ===================== WAVE 3 — OVERLAY HUES + LEGENDS + UPPERCASE ===================== -->

<task id="20-03-01" type="expand" wave="3" depends_on="[20-02-02]">
  <name>Wave 3 — Per-service overlay hues + legends + click-through</name>
  <files>
    - `src/game/palette.ts` (add `SERVICE_HUES` color table + legend metadata)
    - `src/game/scenes/MainScene.ts` (overlay paint reads the table; click-through preserved)
    - `src/game/scenes/SidebarScene.ts` (overlay toggle group + legend rows)
    - `tests/unit/overlay-hues.test.ts` (RED → green)
    - `tests/unit/water-overlay.test.ts` (regression)
    - `e2e/management-ui.spec.ts` + `e2e/sidebar.spec.ts` (overlay cases)
  </files>
  <action>
    Per-service color table in `palette.ts` (fire=red, danger=orange, collapse=brown, crime=purple,
    food=green, water=blue, desirability=teal) — view-only, never imported by sim (constraint 4).
    Each service keeps the existing 5-step ramp shape (band 0..4); overlay paint in `MainScene.ts`
    reads the table via `setOverlay` ids. Legend rows render the service name + hue swatch (UPPERCASE,
    verbatim 18-UI-SPEC names). Click-through preserved: clicking a building/walker under an overlay
    still routes to `emitInspect` (Wave 4 consumes it).
  </action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/overlay-hues.test.ts tests/unit/water-overlay.test.ts -x && npx playwright test e2e/management-ui.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    7 services resolve to the locked hues; each ramp is 5 bands; overlay toggle group + legend render;
    click-through to `emitInspect` still works; water-overlay regression green.
  </acceptance_criteria>
</task>

<task id="20-03-02" type="expand" wave="3" depends_on="[20-03-01]">
  <name>Wave 3 — UPPERCASE labels + letter-spacing (UI-RED-06 / UI-FIX-03)</name>
  <files>
    - `index.html` (`.uppercase` utility: text-transform + letter-spacing 1px)
    - `src/game/scenes/SidebarScene.ts` + top bar (apply to overlay legend + advisor labels)
    - `tests/unit/ui.test.ts` (label-wording golden cases)
  </files>
  <action>
    Apply `text-transform: uppercase; letter-spacing: 1px` to overlay legend labels + advisor labels.
    Case-only change: every label string is byte-compared against the 18-UI-SPEC wording in
    `tests/unit/ui.test.ts` golden cases (stat labels + 13 advisor titles + overlay names) — no rewording
    (constraint 3). The CSS utility is the single place the case transform lives; the DOM text stays
    as-authored so accessibility (aria-label) and unit tests see the canonical wording.
  </action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/ui.test.ts -x && npx playwright test e2e/sidebar.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    Overlay legend + advisor labels render UPPERCASE with 1px letter-spacing; label-wording golden cases
    byte-match 18-UI-SPEC; no label reworded.
  </acceptance_criteria>
</task>

<!-- ===================== WAVE 4 — INSPECTORS ===================== -->

<task id="20-04-01" type="expand" wave="4" depends_on="[20-03-02]">
  <name>Wave 4 — Sidebar inspectors (building/walker cards, close × + Next/Prev cycling)</name>
  <files>
    - `src/game/scenes/SidebarScene.ts` (inspector card host)
    - `src/game/scenes/MainScene.ts` (selection routing via existing `emitInspect`/`getInspector`/`getWalkerInternals`)
    - `tests/unit/inspector.test.ts` (new — card data + cycling)
    - `e2e/inspect.spec.ts` (extend existing inspector spec to the sidebar host)
  </files>
  <action>
    Clicking a building/walker (via the preserved `emitInspect` path) opens an inspector card INSIDE the
    sidebar. Data comes read-only from `getInspector`/`getWalkerInternals` — no new sim getters, no
    sim-side change. Card: name/type/health/staffing/grounds (per existing fields), close `×`,
    Next/Prev cycling across the current selection list. When the card is open, `←`/`→` switch inspector
    entries (key-router precedence: drawer > inspector > build > pause), `Escape` closes the card first.
    Existing `e2e/inspect.spec.ts` assertions move to the sidebar host and stay green.
  </action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/inspector.test.ts -x && npx playwright test e2e/inspect.spec.ts e2e/keyboard.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    Inspector card opens in the sidebar from a building/walker click; data matches `getInspector`/
    `getWalkerInternals`; close × + Next/Prev cycle work; keyboard precedence holds; inspect e2e green.
  </acceptance_criteria>
</task>

<!-- ===================== WAVE 5 — AUDIT & VERIFY ===================== -->

<task id="20-05-01" type="verify" wave="5" depends_on="[20-04-01]">
  <name>Wave 5 — Close/verify: golden guard, no-innerHTML audit, full suites, precedence regression</name>
  <files>
    - `.planning/phases/20/SUMMARY.md` (new — final verification report)
  </files>
  <action>
    Full close gates:
    (1) `npm run typecheck` clean;
    (2) `npm run test` — full vitest (unit/integration/determinism/golden) green;
    (3) `git status --porcelain tests/golden` → empty (byte-identical save/load fixtures — constraint 1);
    (4) `npx playwright test` — full e2e green (sidebar, keyboard, inspect, management-ui);
    (5) `grep -rn 'innerHTML' src/game index.html | wc -l` → `0` (UI-RED-08 audit);
    (6) precedence regression — ESC cancel-build→toggle-pause and W/F/R/C/D/X overlay keys still work;
    (7) `git diff --stat src/sim` → empty (view-only constraint). Write SUMMARY.md recording every gate result.
  </action>
  <verify>
    <automated>npm run typecheck && npm run test && npx playwright test && grep -rn 'innerHTML' src/game index.html | wc -l && git status --porcelain tests/golden && git diff --stat src/sim</automated>
  </verify>
  <acceptance_criteria>
    All 7 gates pass together; SUMMARY.md reports each gate + the final sidebar/top-bar/advisors/overlays/
    inspectors/keyboard/UPPERCASE state; golden fixtures byte-identical; `src/sim` zero-diff.
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust boundaries

| Boundary | Description |
|----------|-------------|
| Sidebar UI → SimRunner | UI is read-only against the sim: all data via existing getters; the only writes are the existing commands (`setPolicy`, `setBuildMode`, `setPaused`, `setSpeed`). No new mutation path. |
| Sim-derived text → DOM | Every dynamic label/value crosses into the DOM via `textContent`/`createElement` builders. No `innerHTML` interpolation anywhere (`src/game/**` + `index.html`) — closes the XSS surface. |
| Options seam (`rcb.options`, localStorage) | Shell options are disjoint from the save envelope; `loadOptions`→`sanitizeOptions` on boot. Sidebar settings write through this seam only — never into SaveData. |
| Phaser input → key-router | Single precedence guard in `MainScene.ts`: drawer > inspector > build mode > pause. Existing ESC + W/F/R/C/D/X behavior preserved; new keys additive. |

## STRIDE register

| Threat ID | Category | Component | Severity | Disposition | Mitigation |
|-----------|----------|-----------|----------|-------------|------------|
| T-20-01 | Tampering | DOM builders in SidebarScene/top bar | high | mitigate | `textContent`/`createElement` only; no `innerHTML` (UI-RED-08); grep audit gate == 0 |
| T-20-02 | Tampering | Key-router in MainScene | medium | mitigate | Single precedence guard (drawer > inspector > build > pause); regression-locked ESC + overlay keys |
| T-20-03 | Tampering | Options seam (settings/tools) | medium | mitigate | Writes confined to `rcb.options` → `sanitizeOptions` on load; disjoint from save envelope |
| T-20-04 | DoS | Advisor tick-change re-render | low | mitigate | Re-render only on tick change, never per-frame; empty states guard render loops |
| T-20-05 | DoS | Overlay paint loop | low | mitigate | Per-service hue table read once per overlay switch; 5-band ramps cached in `palette.ts` |
| T-20-06 | Elevation | UPPERCASE CSS utility | low | accept | Case-only CSS transform; DOM text stays canonical (accessibility + unit golden cases see as-authored wording) |
| T-20-07 | Tampering | Sim-core invariants | critical | mitigate | View-only constraint: `git diff --stat src/sim` empty + golden fixtures byte-identical gates |
</threat_model>

<verification>
- `npm run typecheck` — clean at every wave.
- `npm run test` (vitest node env) — unit/integration/determinism/golden green; new `sidebar-controls`, `sidebar-layout`, `overlay-hues`, `advisor-drawer`, `inspector`, `ui` (key-router + label-wording golden) suites.
- `npm run test:e2e` (Playwright, `:5173`) — `sidebar.spec.ts`, `keyboard.spec.ts`, `inspect.spec.ts` (sidebar host), `management-ui.spec.ts` regression.
- `grep -rn 'innerHTML' src/game index.html | wc -l` → `0` (UI-RED-08).
- `git status --porcelain tests/golden` → empty (byte-identical fixtures).
- `git diff --stat src/sim` → empty (view-only).
- Precedence regression: ESC cancel-build→toggle-pause + W/F/R/C/D/X overlay keys green in `tests/unit/ui.test.ts` + `e2e/keyboard.spec.ts`.
</verification>

<success_criteria>
- Right sidebar renders as the interaction hub (build panel, tools, speed, advisor drawer, overlay group, inspector host) + minimal top status bar (Population, date, Treasury, ratings) — old top HUD removed with no orphan seams.
- Advisor drawer: 13 tabs in `ADVISOR_TAB_ORDER`, live data via `advisorPanels(runner)`, tick-change re-render, verbatim empty states.
- Keyboard: A / ← / → / Escape / B / 1-5 work with the locked precedence; existing ESC + overlay keys unaffected.
- Overlays: per-service hues (7 services × 5 bands), legend rows, click-through to `emitInspect` preserved.
- UPPERCASE labels: case-only via CSS; label strings byte-match 18-UI-SPEC.
- Inspectors: sidebar cards via `getInspector`/`getWalkerInternals`, close × + Next/Prev cycling.
- DOM safety: zero `innerHTML` in `src/game/**` + `index.html`.
- Sim-core invariants: `src/sim` zero-diff, golden fixtures byte-identical, save/load unchanged.
</success_criteria>

<output>
- `.planning/phases/20/SPEC.md` — control→seam inventory, sidebar/top-bar DOM spec, key map + precedence, per-service hue table (Wave 0 deliverable).
- `.planning/phases/20/SUMMARY.md` — close-gate report (Wave 5 deliverable).
- This `PLAN.md` records the wave/task breakdown, dependencies, gates, and acceptance criteria for the UI-RED-01..08 milestone.
</output>
