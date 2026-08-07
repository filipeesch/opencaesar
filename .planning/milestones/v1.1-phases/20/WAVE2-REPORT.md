# Wave 2 Report — Phase 20 (UI Redesign — Caesar III Sidebar & Advisors)

## Status: COMPLETE

Wave 2 delivered the advisor-drawer live-tick re-render (20-02-01) and the keyboard-first navigation e2e (20-02-02), plus fixes for two wave-1 e2e regressions (settings-drawer startup overlay, policy % labels, build-mode ESC precedence, compact topbar CSS).

## Wave 2 deliverables

### 20-02-01 — Advisor drawer (13 tabs, live data, tick-change re-render, empty states)
- `HUDScene.update()` re-renders the drawer's active panel under the tick-change guard (`state.tick === lastTick` skip — identical-tick frames never re-render). `renderAdvisor(runner)` rebuilds every panel from `advisorPanels(runner)` (the locked `src/game/advisors.ts` seam, **zero diffs**) via `textContent` (DOM safety per UI-RED-08).
- Empty states verbatim: "No data yet" / "The city is still growing…" for `noData` panels.
- 13 tabs in `ADVISOR_TAB_ORDER` (ratings → objectives), UPPERCASE labels, `selectAdvisor` reveals exactly one panel.
- New e2e (`e2e/sidebar.spec.ts`): builds a working city (roads/farm/granary/market/well/houses, wages 100%), opens the drawer via `A`, selects Finance, reads the Balance row, runs ticks with the drawer open, asserts the balance changed — proving live re-render with no stale values after pause/resume/speed change.

### 20-02-02 — Keyboard-first navigation (A / ← / → / Escape / B / 1-5) + precedence
- `e2e/keyboard.spec.ts` 5/5 green: A cycles advisors (opens drawer), ←/→ switch tabs, Escape closes drawer first then falls through to build cancel, B toggles build panel (consumed by drawer while open), 1 toggles water overlay + existing W back-compat.
- Regression-locked in `tests/unit/keyboard.test.ts` (9 tests) + `tests/unit/ui.test.ts`: ESC cancel-build → toggle-pause; W/F/R/C/D/X overlay keys; precedence drawer > inspector > build > pause.
- `MainScene.ts`: build-mode engagement persisted (`buildModeEngaged`) so B then Escape closes the panel instead of falling through to pause (SPEC §3).

## Wave-1 regression fixes (found + fixed in Wave 2)

1. **Settings-drawer startup overlay** — wave-1 `sidebar.ts` built the settings drawer without initial `display: none` (wave-0 HUDScene had hidden it). The fixed-position overlay (`pointer-events: auto`, mid-screen x≈430-850) swallowed pan drags (alignment.spec) and wheel events (management-ui wheel-zoom). Fix: `settingsDrawer.style.display = 'none'` at build; toggle opens it. alignment 4/4 + management-ui green after fix.
2. **Policy % labels** — legacy placement.spec expects `policy-tax-value`/`policy-wage-value` showing the live policy; now synced from sim state on every tick change and immediately on slider input.
3. **Build-mode ESC precedence** — see 20-02-02.
4. **Compact topbar CSS** — the taller wave-1 topbar (flex-wrap, 12px) pushed the nav row into the legacy drag e2e's endpoint (1030,115); rewrote to block layout (11px, 6px 10px padding, pointer-events none) preserving the transparent band (nav bottom 110, build panel top 118). Sidebar panels get surgical pointer-events opt-in (speed row / advisor button / action / overlay groups only).

## Gates
- `npm run typecheck` — clean
- `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4 --bail 1` — **127 files / 1004 tests passed** (3 `[vitest-worker]: Timeout calling "onTaskUpdate"` RPC noise — not test failures)
- Goldens: `git status --porcelain tests/golden` — **empty** (byte-identical)
- `src/sim/` — zero diff (view-only honored); `src/game/advisors.ts` — zero diff
- innerHTML — 0 (no-innerhtml.test.ts green)

## e2e suite (vite dev server + Playwright chromium, 1 worker)
- **53 passed / 3 failed** — failures are pre-existing at the wave-0 baseline (verified in a wave-0 worktree with its own dev server, port 5199):
  - `boots.spec.ts` — `getByText('Roman City Builder')` not visible (home-screen title expectation; test mode boots straight into the map)
  - `campaign.spec.ts` — trivial objective `won` not reported after setObjective/runTicks
  - `placement.spec.ts:111` — HUD population not > 80 after 2000 ticks (house evolution timing)
  - Per dispatch §4 these are documented, not chased: same 3 fail at wave-0 `e2472f3`.

## Commits
- `1844569` fix(20-02): wave-1 regressions — settings drawer overlay, policy labels, build-mode precedence
- `81e43fd` test(20-02): advisor drawer live-tick re-render e2e (20-02-01)
