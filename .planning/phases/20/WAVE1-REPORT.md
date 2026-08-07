# Wave 1 Report — Phase 20 (UI Redesign — Caesar III Sidebar & Advisors)

## Status: COMPLETE

Wave 1 delivered the sidebar + top bar + advisor drawer + key router, replacing the old top HUD per SPEC.md.

## Modules created (src/game/ui/)
- `dom.ts` — node-safe DOM builder (`el()`/`clear()`/`text()`); StubNode for node-env vitest; real HTMLElement in browser (e2e-assertable). No innerHTML path.
- `topbar.ts` — `buildTopBarDom(state, derived)`: population, date (year=floor(tick/360), month=floor((tick%360)/40)+1), treasury, 5 ratings. Seams metadata exposed for tests.
- `sidebar.ts` — `buildSidebarDom(state, derived)`: nav (Advisors/Overlays/Messages/Settings), build panel (13 categories + 17 building buttons from BUILDINGS), tools panel (tax/wage policy sliders), speed row (0.5-8x), advisor button, overlay group (pause/resume/save/restart), inspector/log/toast hosts. Seam metadata per control.
- `advisorDrawer.ts` — 13 advisor tabs in ADVISOR_TAB_ORDER, tick-change re-render support, verbatim empty states.
- `keyboard.ts` — KeyRouter: A cycles advisors, ←/→ switch panels, Escape closes surfaces first (drawer > inspector > build > pause), B toggles build panel, 1-5 toggle overlays; existing ESC/W/F/R/C/D/X regression-locked.
- `overlays.ts` — per-service hue table (fire=red, danger=orange, collapse=brown, crime=purple, food=green, water=blue, desirability=teal) + overlay group builder.

## Refactor
- `HUDScene.ts` 1177 → mounted via new ui modules; old top HUD replaced by minimal top status bar. All controls wired to existing runner seams (0 decorative).
- `HomeScene.ts` + `MainScene.ts` touched: key router integration, overlay/mount points.

## innerHTML: 8 → 0
All 8 assignment sites replaced with createElement/textContent builders (HUDScene.ts:197,253,262,471,791 + HomeScene.ts:47,62,114). `grep -rn innerHTML src/ index.html` = 0. `no-innerhtml.test.ts` green.

## Gates
- `npm run typecheck` — clean
- `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` — **127 files / 1004 tests passed** (baseline 973 + 31 new)
- `npm run check:military` — clean
- Goldens: `git status --porcelain tests/golden` — **empty** (byte-identical)
- `src/sim/` — zero diff (view-only honored)

## Commits
- `f215ca9` feat(20): Caesar III sidebar + top bar + advisor drawer + key router (wave 1)

## Remaining waves
- Wave 2: advisor drawer live-tick re-render polish + keyboard e2e (RED scaffolds already green at unit level)
- Wave 3: overlay hues & legends + click-through
- Wave 4: inspector cards in sidebar (getInspector/getWalkerInternals, close/Next)
- Wave 5: UPPERCASE labels + close gates (e2e, precedence regression, final audit)
