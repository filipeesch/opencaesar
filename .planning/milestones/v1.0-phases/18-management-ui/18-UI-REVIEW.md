# Phase 18 — UI Review

**Audited:** 2026-08-06
**Baseline:** 18-UI-SPEC.md (design contract, draft) + openspec/specs/ui-management/spec.md
**Screenshots:** captured — `.planning/ui-reviews/18-v2-20260806-094233/{desktop,mobile,tablet,advisors-drawer,overlay-water}.png`. Note: the first capture ran against a **foreign dev server** (Railyn on :3000) and was discarded; the phase's own Vite server (5173) was booted for the capture used here. Auditor model cannot render images (no vision), so all scoring is static-analysis + live DOM probe driven. A human/vision pass on the PNGs is recommended.

**Live evidence gathered** (probe on `?test&seed=1337`):
- Control bar renders exactly `Advisors / Overlays / Messages`; all three dispatch real handlers (drawer open, overlay bar open, log `.active` class) — **no decorative buttons** (also e2e-gated).
- Advisors drawer opens with **13 tabs, exactly 1 active**; default tab = Ratings; live Ratings values render.
- Overlay bar = **6 toggles** (5 overlays + None); toggling Water shows the legend instantly with **5 legend rows**.
- Finance advisor renders live Balance/Monthly Result/Debt/Interest + `Open Codex` action button.
- Zero page errors during the whole session.
- Unit gates pass on replay: `advisor-composer.test.ts` (5) + `water-overlay.test.ts` (6).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 2/4 | 3 locked empty/error copy states missing ("No messages yet", "Nothing highlighted", save-error body) |
| 2. Visuals | 3/4 | Strong hierarchy; advisor tab labels shortened vs inventory; locked UPPERCASE copy-case not applied to tabs/control/overlay labels |
| 3. Color | 3/4 | 4/5 ramps match spec exactly; coverage overlay collapses per-service hues into one ramp; food variety glyphs not rendered |
| 4. Typography | 3/4 | 400/700 discipline held; 11px introduced below the declared 12px minimum; copy-case rule unmet |
| 5. Spacing | 3/4 | New panels follow 12px/4px tokens well; control-bar button < 28px target; legacy 10px padding retained |
| 6. Experience Design | 2/4 | Locked `A` drawer + `←/→` inspector keyboard bindings missing; log/overlay empty states absent; strengths: live-disabled builds, tick guard, click-through |

**Overall: 16/24**

---

## Top 3 Priority Fixes

1. **Missing locked keyboard bindings + empty states** — UI-SPEC Accessibility locks `A` (open Advisors drawer) and `←`/`→` (inspector prev/next), yet only ESC + W/F/R/C/D/X exist (`MainScene.ts:132-152`); `renderLog` renders a blank list when empty and no "Nothing highlighted" overlay state exists. **User impact:** advertised keyboard affordances and "nothing here" feedback silently absent. **Fix:** bind `keydown-A` → `hud events emit('controls-advisors')` (or a drawer-open event) in MainScene; bind arrow keys to `inspector-prev/next` when `building-popup` is visible; add the locked placeholder `<li>` in `renderLog` and a "Nothing highlighted" block in `renderOverlayLegend`.
2. **Coverage overlay loses per-service color identity** — `palette.ts:52` defines a single blue→purple ramp and `MainScene.ts:246-249` paints `max(health,literacy,entertainment)`, so the player cannot see *which* service is deficient. UI-SPEC Color locks per-service hues (health `#59c4ee`, literacy `#6aa5d6`, entertainment `#cf6fd1`). **User impact:** the Coverage overlay tells you "some coverage is low" but never which service. **Fix:** emit 3 per-hue grids (or a 3-channel cell values) and draw per-service hue; label the legend with service names.
3. **Locked UPPERCASE copy-case not applied to new control labels** — UI-SPEC Typography locks "control labels in UPPERCASE with letter-spacing 1px", but advisor tabs (`advisorTitle`), control-bar (`Advisors/Overlays/Messages`), and overlay toggles render mixed-case, and no `text-transform` is set on `.hud-control-btn`/`.advisor-tab`/`.overlay-toggle`. **User impact:** new surfaces read differently from the established `.hud-subtitle` convention; inconsistent case across the same control family. **Fix:** add `text-transform: uppercase; letter-spacing: 1px` to those three rules (keep the wording; case-only change).

---

## Detailed Findings

### Pillar 1: Copywriting (2/4)

**Met:** empty-city advisor copy matches the contract verbatim — heading `No data yet` + body *"The city is still growing. Advance the simulation, then open this advisor again."* (`HUDScene.ts:565-569`). Build buttons `{Name} ({cost})` (`HUDScene.ts:241`). Advisor action labels `Open Inspector` / `Locate` / `Open Overlay` / `Open Codex` match UI-02 actions. Placement errors reuse `describeError` (`MainScene.ts:458`).

**WARNING — message-log empty state missing.** UI-SPEC Copywriting requires `No messages yet` as a placeholder line instead of an empty `<ul>`. `HUDScene.renderLog` (`:663-673`) clears the list and appends only real entries — an empty log renders nothing. Grep confirms the string does not exist anywhere.

**WARNING — overlay zero-match state missing.** UI-SPEC Copywriting requires heading `Nothing highlighted` + body when no tiles match, with the legend still rendering. The legend does render, but the empty message is never emitted (`MainScene.renderOverlay`, `HUDScene.renderOverlayLegend`).

**WARNING — save-error body missing.** UI-SPEC error state (save) specifies `Save failed` + *"Your progress was not saved. Try again."* The implementation fires only the single-line toast `Save failed` (`HUDScene.ts:694`); the guidance body is absent.

**WARNING — advisor tab labels shortened from the inventory.** `advisorTitle` (`HUDScene.ts:1014-1023`) renders `Production` for `production-logistics` and `Safety` for `safety-risks`, whereas UI-SPEC Advisors Inventory titles those panels `Production & Logistics` and `Safety & Risks`. Tab space constraints justify shortening, but the contract's canonical panel names are not preserved anywhere on the surface (no `title` tooltip).

### Pillar 2: Visuals (3/4)

**Met:** clear focal point preserved — persistent Stats column right + transient bottom-center drawer/overlay; gold `<b>` value emphasis and `.hud-subtitle` overlines give a coherent hierarchy; overlay heatmap diamonds render below building depth (`MainScene.ts:127`, depth 1); legend is a proper `.hud-subtitle`-style panel bottom-right.

**WARNING — locked UPPERCASE copy-case not applied to controls/tabs/overlay toggles** (see Top Fix 3). `Advisors / Overlays / Messages`, `Ratings / Finance / …`, and `Water / Food / …` are all mixed-case; UI-SPEC locks UPPERCASE + letter-spacing for "panel/chip headings and control labels."

**MINOR — advisor drawer/overlay bar headings reuse `.hud-subtitle` ("Advisors", "Overlays") but the buttons inside are visually lighter than the panel heading, flattening the heading hierarchy.** `.drawerHead` and `.overlayHead` use the muted-gold subtitle token while active controls turn gold — the active control can outshine the section heading. Consider a stronger panel heading token.

**MINOR — `hud-popup .row b` sets `font-weight: normal` (`index.html:193-196`), so inspector values (gold but not bold) look weightier than footer content in other panels; acceptable, but inconsistent with `.hud-stat b` (bold).**

### Pillar 3: Color (3/4)

**Met / exact:** `OVERLAY_RAMPS` in `palette.ts:48-54` reproduces the UI-SPEC water, food, risks, and desirability ramps **character-for-character**. Water legend maps band 4 to `Source` and bands 0-3 to None/Basic/Clean/Grand — a sensible reading of the 0/1/2/3 class scale with a 5-band ramp. Accent gold stays on the reserved list (titles, active tab/toggle, stat values, popup border) — no accent overuse.

**WARNING — Coverage overlay collapses per-service hue to a single ramp.** UI-SPEC locks per-service hue ramps (health `#59c4ee`, literacy `#6aa5d6`, entertainment `#cf6fd1`). Implementation ships one `#1e3550→#a98fd1` ramp (`palette.ts:52`) and paints `max(health, literacy, entertainment)` (`MainScene.ts:249`). Service identity is lost on the heatmap; legend bands are generic `0-20%…80-100%` (`OVERLAY_LABELS.coverage`).

**WARNING — Food overlay renders supply only; variety glyph band absent.** `foodOverlayGrids` computes a `variety` grid (`sim/advisors.ts:641-679`) and UI-SPEC calls for variety to appear as a glyph band (`◉ ◐ ○ ● ·`) on houses, but `MainScene.ts:221-226` paints only `supplyDays`. The variety band computed by the advisor is never drawn.

**MINOR — desirability ramp 0-band (`#2b1d0e`) is visually identical to the page background** (`index.html:13`), so low-desirability tiles are indistinguishable from "no signal" until band 1. Acceptable given the spec locked the ramp.

### Pillar 4: Typography (3/4)

**Met:** weights stay at 400/700 (no 600 anywhere); `13px` stat/inspector values and `20px` title retained; frozen legacy sizes (15/34) untouched; line-heights 1.4/1.5 used.

**WARNING — 11px introduced below the declared minimum.** The declared scale is 12/13/14/20 (+ frozen 15/34). New work adds `11px` for `.overlay-toggle .shortcut` (`index.html:304`) and `.inspector-nav-label` (`index.html:428`). It is tiny but purpose-built for badges; still, it is outside the token set and has no spec sanction.

**WARNING — locked UPPERCASE letter-spacing rule unmet on new controls** (Top Fix 3). Only `.hud-subtitle` and `.inspector-nav-label` carry `text-transform/letter-spacing`; the new tab/control/overlay labels do not.

**MINOR — inspector close `×` is 16px** (`index.html:181`) — a fourth stray size in the popup layer (11/13/16). Harmless, but the nested new-inspector typography is drifting from a single scale.

### Pillar 5: Spacing (3/4)

**Met:** new panels pad `8px 12px` (12px horizontal normalized — matches the contract); control-bar gap 8px; build grid and overlay-toggles gap 4px (xs token); `.advisor-tab` and `.overlay-toggle` set `min-height: 32px` exactly; drawer `max-height: 40vh` with scroll; legend rows at 4px gaps.

**WARNING — control-bar button below the 28px target.** UI-SPEC declares control-bar button min-height **28px**; `.hud-control-btn` (`index.html:224-234`) is `padding: 6px 4px` + 12px font ≈ **26px** and sets no explicit min-height. A 2px shortfall in the most-clicked nav control.

**MINOR — legacy `10px` padding survives in the popup.** `.hud-popup` pads `10px 12px` (`index.html:160`) — the contract normalized horizontal padding to 12px for *new* work, but the inspector popup is a phase-18 surface and still keeps the 10px vertical (off the 4px scale) alongside the new 12px horizontal.

**MINOR — arbitrary bottom offsets for the new surfaces (drawer `bottom:132px`, overlay bar `bottom:64px`, legend `right:280px`)** are hand-tuned against the HUD column/toast rather than the declared spacing scale; functionally fine, but not derived from tokens.

### Pillar 6: Experience Design (2/4)

**Met:** tick-change guard drives every HUD surface (`HUDScene.ts:126`), so stale ticks never re-render (contract's "tick-stale" contract honored, no spinner needed). Build buttons live-disable on treasury (`:175-181`) — the flagship UX win. Inspector `Next/Prev` disable at ends (`:901-902`). Popup closes on pause, build-mode entry, and ESC (`:67,106,132-143`). Click-through on overlay tiles reuses `emitInspect` and e2e-proves camera wheel/drag stays intact. `pointer-events` handling on `hud-popup` (the pre-existing close-× bug) is correctly fixed.

**WARNING — locked keyboard bindings `A` and `←/→` are not implemented.** MainScene binds ESC + W/F/R/C/D/X only (`MainScene.ts:132-152`); UI-SPEC Accessibility locks `A` → open Advisors drawer and `←/→` → inspector prev/next. Neither binding exists (grep-clean).

**WARNING — message-log and overlay empty states absent** (see Pillar 1): an empty log shows nothing, a zero-tile overlay shows only the legend with no explanation. The contract's UI-Considerations table marks both as "covered" — they are not.

**MINOR — no click-outside-to-close on the inspector popup.** UI-SPEC lists click-outside/element-gone as a close trigger (`18-UI-SPEC.md:59`); the popup closes on pause/build-mode/ESC only. The clicking-away cleanup gesture promised by the contract is not implemented.

**MINOR — default advisor tab ignores the critical-alert heuristic.** UI-SPEC says default to the advisor matching the newest critical alert, else Ratings; `buildDom` always calls `selectAdvisor('ratings')` (`HUDScene.ts:446`). The Ratings fallback holds, but the alert-directed default branch is never reached (no `state.messages` scan).

---

## Registry Safety

No third-party component registry: Tool is `none` — Phaser 3 + hand-built DOM (`18-UI-SPEC.md` line 298-300), confirmed `components.json` absent (`NO_SHADCN`). `n/a`.

---

## Files Audited

- `src/game/advisors.ts` — 13-advisor pure composer, `advisorPanels` / `ADVISOR_TAB_ORDER` (new)
- `src/game/scenes/HUDScene.ts` — control bar, drawer, overlay bar + legend, 5 inspectors, build-disabled
- `src/game/scenes/MainScene.ts` — overlay heatmap layer, keyboard, click-through, camera guard
- `src/game/palette.ts` — `OVERLAY_RAMPS` + `hexToPhaser`
- `src/sim/advisors.ts` — enriched `*Inspection` projections + `foodOverlayGrids` variety
- `src/sim/runner.ts` — `getWaterOverlay()`, `getDesirabilityOverlay()`, `getInspector(id,kind)` seam
- `index.html` — phase-18 CSS block (lines 218-431)
- `openspec/specs/ui-management/spec.md`
- Tests: `tests/unit/advisor-composer.test.ts`, `tests/unit/water-overlay.test.ts`, `e2e/management-ui.spec.ts`, `e2e/inspect.spec.ts`
- Live DOM probe against `?test&seed=1337` (captured in this review)

---

## Verdict

The Phase 18 Management UI is **functionally complete and live-wired**: every control has a real handler, the 13-advisor drawer reads real runner getters under the tick guard, overlays render real heatmaps with legends and click-through, and inspectors are enriched through the read-only `getInspector` seam — with zero golden regressions and unit gates green on replay. The dominant risk of this phase (decorative buttons, fabricated data in WR-02/WR-06) is genuinely resolved.

The gaps are **contract-fidelity, not functionality**: a handful of locked copy strings and keyboard bindings from UI-SPEC were never implemented, and the Coverage overlay was collapsed from the locked per-service hue design to a single decay ramp. These are low-effort, high-contract-value fixes (Top 3 above) that would lift the review from 16/24 into the low-20s. This audit is advisory and non-blocking; recommend a human vision pass on the captured PNGs and Phase 19 pick up the three priority fixes alongside its options/accessibility work.
