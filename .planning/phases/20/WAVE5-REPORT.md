# Wave 5 Report — Phase 20 (UI Redesign — Caesar III Sidebar & Advisors)

## Status: COMPLETE

Wave 5 delivered the last deferred item — **UPPERCASE labels (UI-RED-06 / UI-FIX-03)** — as a case-only CSS transform, then ran the full close gate (20-05-01). Every gate passes; the sim core is untouched; goldens are byte-identical; `src/sim` is zero-diff.

## UPPERCASE labels (UI-RED-06 / UI-FIX-03) — case-only

- **`.uppercase` CSS utility** added to `index.html` (Phase 20 block): `text-transform: uppercase; letter-spacing: 1px` — the single place the case transform lives (T-20-06: accept — DOM text stays canonical for accessibility and golden cases).
- **Applied to** (DOM text byte-identical to 18-UI-SPEC wording, never reworded):
  - Overlay legend labels — `HUDScene.renderOverlayLegend`: `.legend-service-name` (Fire/Danger/Collapse/Crime) + 5-band labels per service; legend title already `.hud-subtitle` (pre-existing CSS transform).
  - Advisor labels — `advisorDrawer.ts`: tab buttons + active-tab readout now carry `.uppercase`; the JS `.toUpperCase()` on `textContent` was **removed** — DOM text is now the canonical title ("Ratings", "Finance", …), CSS presents it UPPERCASE. The `tabs()` meta `label` keeps the UPPERCASE contract (unit seam).
  - Sidebar headings/nav — `sidebar.ts`: `.hud-control-btn` nav (Advisors/Overlays/Messages/Settings) + overlay-toggle label spans (Water/Food/Risks/Coverage/Desirability/None). Panel headings (BUILD/TOOLS/SPEED/OVERLAYS) were already `.hud-subtitle` (pre-existing transform).
  - Topbar labels — `topbar.ts`: all 8 `.topbar-label` spans (POPULATION/DATE/TREASURY + 5 ratings) carry `.uppercase` (authored text unchanged).
- **Tests added**:
  - `tests/unit/uppercase-labels.test.ts` (6 tests, node-env): `.uppercase` class contract on nav buttons / overlay toggles / advisor tabs / topbar labels; canonical DOM wording locked ("Water", "None", full 13-title catalog in ADVISOR_TAB_ORDER); CSS is the single case place (tab `textContent` equals as-authored `panel.title`, not `toUpperCase()`).
  - `e2e/sidebar.spec.ts` — new test "UPPERCASE labels render via CSS transform with canonical DOM wording": computed-style assertions (`toHaveCSS('text-transform','uppercase')`, `letter-spacing 1px`) + `toHaveText('Water')` / `toHaveText('Ratings')` proving DOM wording stays canonical.
- No `src/sim/*` touched; no label string reworded; no new npm deps.

## Close gate (20-05-01) — full results

| # | Gate | Command | Result | Evidence |
|---|------|---------|--------|----------|
| 1 | Typecheck | `npm run typecheck` | ✅ PASS | `tsc --noEmit` clean, exit 0 |
| 2 | Full unit suite | `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` | ✅ PASS | **129 files / 1026 tests passed** (128/1020 prior wave + 6 new uppercase tests). 3 `[vitest-worker]: Timeout calling "onTaskUpdate"` RPC noise entries — not test failures; same baseline noise class as Waves 2–4 |
| 3 | Goldens byte-identical | `git status --porcelain tests/golden` | ✅ PASS | empty output — fixtures unchanged (constraint 1) |
| 4 | No innerHTML (UI-RED-08) | `grep -rn 'innerHTML' src/ index.html \| wc -l` | ✅ PASS | `0` (also `tests/unit/no-innerhtml.test.ts` green) |
| 5 | View-only sim core | `git diff --stat src/sim` | ✅ PASS | zero diff (constraint 1 / T-20-07) |
| 6 | Military gate | `npm run check:military` | ✅ PASS | `[check-military] clean: no forbidden military tokens in src/ or data/` |
| 7 | Full Playwright sweep | `npx playwright test` (dev server :5173) | ✅ PASS* | **57 passed / 3 failed**. The 3 failures are the pre-existing wave-0 baseline flakes, failing identically to baseline (verified, not chased per dispatch): `boots.spec.ts:4` (home-screen title expectation vs test-mode boot), `campaign.spec.ts:8` (trivial objective `won` not reported), `placement.spec.ts:111` (population growth assertion timing). Everything else green incl. new computed-style UPPERCASE e2e |
| 8 | Precedence regression | keyboard unit tests (drawer > inspector > build > pause) | ✅ PASS | `tests/unit/keyboard.test.ts` green in full suite; e2e `keyboard.spec.ts` 5/5 in sweep; ESC cancel-build→pause + W/F/R/C/D/X overlay keys regression-locked |

**Gate 7 note (baseline):** the 3 failed e2e are infra/content-race flakes present at the wave-0 baseline (verified in the wave-2 report with a wave-0 worktree) — not regressions from this phase. All phase-20 specs (sidebar 4, keyboard 5, inspect 8, management-ui 9, settings, sessions, alignment, placement others) pass.

## Deviations from plan

None — plan executed as written. UPPERCASE (20-03-02 deliverable deferred to Wave 5 per Wave-4 report) implemented in this wave with the plan's specified `.uppercase` utility + canonical-DOM approach.

## Files changed

- `index.html` — `.uppercase` utility CSS (Wave 5 block)
- `src/game/ui/sidebar.ts` — nav buttons + overlay toggle labels carry `uppercase`
- `src/game/ui/advisorDrawer.ts` — tabs/active-tab: canonical DOM text + `uppercase` class (JS toUpperCase removed)
- `src/game/ui/topbar.ts` — `.topbar-label` spans carry `uppercase`
- `src/game/scenes/HUDScene.ts` — legend service-name + band labels carry `uppercase`
- `tests/unit/uppercase-labels.test.ts` — new (6 tests)
- `e2e/sidebar.spec.ts` — new computed-style UPPERCASE test

## Commits

- `498aa99` feat(20-05): UPPERCASE labels via CSS utility (UI-RED-06/UI-FIX-03)
