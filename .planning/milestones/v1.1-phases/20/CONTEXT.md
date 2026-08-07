# Phase 20: UI Redesign — Caesar III Sidebar & Advisors — Context

**Gathered:** 2026-08-07
**Status:** Ready for planning
**Mode:** Smart discuss (FULL-AUTO — user auto-accepted all grey-area defaults, "Accept all and dont ask me again, just proceed")

## Phase Goal

Replace the current top-edge HUD (built in Phase 18, `src/game/scenes/HUDScene.ts` ~1177 lines) with a Caesar III-style **right sidebar** as the interaction hub — build panel, tools, speed controls — while keeping a minimal top status bar for population/date/treasury/ratings. Rebuild the 13-advisor panels and overlay system as sidebar-driven UI with keyboard-first navigation, per-service coverage hues, UPPERCASE labels, and XSS-safe DOM. View-only: **zero sim-core change, no getState()/SaveData shape change, goldens byte-identical.**

Covers UI-RED-01..08 + UI-FIX-01..03 (deferred findings from `18-UI-REVIEW.md`).

---

## Decisions (grey areas — auto-accepted defaults)

| # | Grey Area | Auto-Accepted Decision | Rationale |
|---|-----------|------------------------|-----------|
| 1 | HUD replacement strategy | **Right sidebar holds build panel + tools + speed; keep a minimal top status bar** (population, date, treasury, ratings). Caesar III renders population/date/treasury at the top; the sidebar is the interaction hub. | Matches Caesar III layout; keeps the always-visible data strip (existing stats column) as the top bar; all interactive controls move to the sidebar. |
| 2 | Advisor drawer layout | **Drawer overlays the right sidebar area** (slides over the sidebar, not replacing the build panel). A cycles advisors, ←/→ switches panels, Escape closes. | Overlay preserves map view (Caesar III advisors float over the map); keeps sidebar contents intact under the drawer; keyboard navigation per UI-RED-03/UI-RED-07. |
| 3 | Per-service coverage hues | **Single hue ramp per overlay service, derived from a small color table.** fire=red ramp, danger=orange, collapse=brown, crime=purple, food=green, water=blue, desirability=teal. Coverage overlay paints per-service hue instead of `max(health,literacy,entertainment)` single ramp. | Fixes 18-UI-REVIEW finding #2 — service identity is currently lost (`palette.ts` single `#1e3550→#a98fd1` ramp, `MainScene.ts` paints max). A small color table keeps ramps view-only and testable. |
| 4 | Keyboard bindings | **A cycles advisors (open drawer), ←/→ switches panels, Escape closes; plus B toggles build panel, 1-5 toggle overlays** (Caesar III-ish). | Fixes finding #1 (only ESC + W/F/R/C/D/X exist in `MainScene.ts:132-152`). Numeric 1-5 for overlays matches Caesar III's overlay palette convention. |
| 5 | UPPERCASE labels | **DOM/CSS `text-transform: uppercase` (+ `letter-spacing: 1px` per 18-UI-SPEC) for overlay legend + advisor labels; Phaser `textTransform` text style only where DOM isn't used.** | Fixes finding #3 — `.hud-control-btn`/`.advisor-tab`/`.overlay-toggle` currently render mixed-case with no text-transform. Case-only change, wording preserved. |
| 6 | Testing | **Keep existing e2e patterns (`e2e/*.spec.ts` at repo root — Playwright), add a keyboard/sidebar/overlay spec; vitest unit (node env, `tests/**/*.test.ts`) for composer wiring.** | NOTE: dispatch text said `tests/e2e/*.spec.ts`; actual repo layout is `e2e/*.spec.ts` (root) + `tests/**/*.test.ts` (vitest). Follow the real existing pattern. Pure advisor/inspection functions remain the unit-test targets. |
| 7 | Existing HUDScene | **Refactor `HUDScene.ts` into sidebar components** (SidebarScene or HUDScene layout change), keep `MainScene.ts` as the isometric container; remove decorative buttons; wire every control to a real runner getter/command. | HUDScene is one 1177-line DOM blob; sidebar split makes keyboard wiring and per-surface DOM testable. MainScene keeps overlay heatmap + camera + click-through ownership. |

### Requirement mapping (from REQUIREMENTS.md UI-RED-01..08 + UI-FIX-01..03)

| REQ | Decision/Work |
|-----|---------------|
| UI-RED-01 | Right sidebar (build panel, tools, speed) replaces top HUD controls; top status bar kept. |
| UI-RED-02 | 13 advisor panels open from sidebar; live sim data via runner getters, never fabricated. |
| UI-RED-03 | Advisor drawer syncs with sim tick (tick-change guard, same pattern as current drawer). |
| UI-RED-04 | 5 overlays toggle from sidebar; per-service hue ramps + legend; click-through to inspector. |
| UI-RED-05 | Building/walker inspectors from sidebar; real internals via `getInspector(kind,id)`/`getWalkerInternals`. |
| UI-RED-06 | Overlay/advisor labels UPPERCASE (Caesar III style). |
| UI-RED-07 | Keyboard-first: A cycles advisors, ←/→ switches panels, Escape closes, B build panel, 1-5 overlays. |
| UI-RED-08 | All DOM composed via `textContent`/`createElement`; no `innerHTML` (audit `index.html` inline CSS block + HUDScene). |
| UI-FIX-01 | Add missing A/←/→ bindings + empty states ("No messages yet", "Nothing highlighted", save-error body). |
| UI-FIX-02 | Per-service coverage hues from color table (`palette.ts`). |
| UI-FIX-03 | UPPERCASE + letter-spacing on `.hud-control-btn`/`.advisor-tab`/`.overlay-toggle`. |

---

## Assumptions

- **Advisors data sources stay unchanged:** `src/game/advisors.ts` `advisorPanels(source)` + `ADVISOR_TAB_ORDER` (13 ids) is the single source; sidebar panels consume it. `src/sim/runner.ts` getters (`getFinanceAdvisor`, `getTradeAdvisor`, `getProductionAdvisor`, `getLogisticsAdvisor`, `getEmployment`, `getGovernance`, `getRequests`, `getMission`, `getMissionProgress`, `getEvents`, `getFestival`, `getCivicStats`, `getCivilizationOverlay`, `getWaterOverlay`, `getDesirabilityOverlay`, `getInspector`, `getWalkerInternals`) are read-only seams — no shape change.
- **Options/shell state stays view-only:** `src/game/options.ts` (`rcb.options` localStorage, disjoint from save envelope) is untouched in shape; only UI application may change.
- **Overlay heatmap stays in MainScene:** depth-1 Graphics layer + camera guard + click-through `emitInspect` remain in `MainScene.ts`; sidebar only toggles which overlay is active via the existing `setOverlay` radio source of truth.
- **E2E pattern is `e2e/*.spec.ts` at repo root** (Playwright, `playwright.config.ts`, baseURL :5173), **not** `tests/e2e/`. Vitest unit pattern is `tests/**/*.test.ts` (node env). New tests follow the real layout.
- **CSS lives in `index.html` inline `<style>`** (Phase-18 block ~lines 218-431); sidebar CSS extends that block (or moves to a dedicated stylesheet if the executor prefers — discretion).
- **No new npm runtime deps** (Phaser 3.90 + sharp only); UI is DOM/Phaser-scene code.

## Constraints (locked)

1. **View-only redesign:** NO sim-core behavior change; `getState()`, `getStateJson()`, and SaveData shape unchanged; golden tests byte-identical. Any behavior change requires a new requirement + golden regeneration (out of scope).
2. **All UI text via `textContent`/`createElement`** — no `innerHTML` anywhere in HUD/sidebar code (UI-RED-08); audit includes toast/log/legend/popup strings.
3. **Keyboard bindings must not break existing ESC precedence** (cancel build mode → else toggle pause) and existing W/F/R/C/D/X overlay keys; new A/B/←/→/1-5/ESC are additive, with clear precedence rules (drawer > inspector > build mode > pause).
4. **UPPERCASE is case-only** — keep the exact wording from 18-UI-SPEC; do not reword labels.
5. **Per-service hues are view-only data** in `palette.ts`/color table; never imported by the sim.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| HUDScene 1177-line refactor drifts into sim-core changes | Med | High (golden break) | Constraint 1; keep `advisors.ts`/`runner.ts`/`save.ts` untouched; verify goldens after each wave |
| New global keyboard bindings (A/B/←/→/1-5) collide with Phaser camera/input or existing keys | Med | Med | Central key-router in MainScene; precedence table; e2e keyboard spec |
| Drawer-over-sidebar layout overlaps controls on small viewports | Low-Med | Low | Drawer width ≤ sidebar width; `max-height` + internal scroll (current drawer pattern) |
| Coverage per-service hue change breaks legend expectations / golden overlay snapshots | Med | Med | Keep 5-step ramp shape (5 bands), only hue base changes; legend labels updated in lockstep |
| Removing decorative buttons misses a real control (e.g. settings/save/restart from Phase 19) | Med | Med | Inventory every control in current HUDScene before cut; preserve Settings drawer + pause/save/restart |
| `innerHTML` audit misses a string (index.html inline CSS + HUDScene) | Low | High (XSS) | Grep `innerHTML`/`outerHTML` in src/game + index.html; add a no-innerHTML lint/test |

## Work Plan Sketch (waves)

- **Wave 0 — Inventory & spec:** Enumerate every control in `HUDScene.ts` (stats, build, policy, log, control bar, advisors drawer, overlay bar, legend, 5 inspectors, settings, toast, pause/save/restart). Map each to a runner getter/command. Define sidebar DOM structure + color table in `palette.ts`. Scaffold `e2e/sidebar.spec.ts` + `tests/` unit tests (RED).
- **Wave 1 — Sidebar + top bar:** New sidebar container (build panel, tools, speed, advisor button, overlay buttons); top status bar (population, date, treasury, ratings). Wire controls to existing runner seams. Remove top-HUD controls.
- **Wave 2 — Advisor drawer + keyboard:** Drawer overlays sidebar; A cycles advisors, ←/→ switch panels, Escape closes; B toggles build panel; 1-5 toggle overlays. Empty states (UI-FIX-01 copy).
- **Wave 3 — Overlays + hues + uppercase:** Per-service hue ramps from color table (UI-FIX-02); UPPERCASE + letter-spacing on labels (UI-FIX-03); click-through inspector preserved.
- **Wave 4 — Audit & verify:** `innerHTML` grep clean (UI-RED-08); goldens byte-identical (`npm run test:golden:update` NOT required — assert unchanged); `tsc --noEmit` clean; full `e2e/*.spec.ts` + vitest suites green.
