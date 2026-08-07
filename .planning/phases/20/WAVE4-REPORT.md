# Wave 4 Report — Phase 20 (UI Redesign — Caesar III Sidebar & Advisors)

## Status: COMPLETE

Wave 4 delivered task 20-04-01 (sidebar inspectors): the building/walker inspector is now a CARD inside the sidebar inspector host — relocated out of the Phase-18 fixed bottom-center popup — with close × and Next/Prev cycling, fed read-only from the existing `getInspector(kind,id)` / `getWalkerInternals` seams. UI-RED-05 acceptance criteria met; sim core untouched; goldens byte-identical.

## Inspector card behavior (20-04-01)

- **Card in the sidebar host**: clicking a building or walker (via the preserved `emitInspect` → `hud-inspect` / `hud-walker-inspect` path — overlay click-through from Wave 3 untouched) mounts the card into `sidebar.inspectorHost` (`[data-testid="sidebar-inspector-host"]`). The card root keeps the legacy `building-popup` testid and the Phase-18 `.hud-popup` CSS classes so the management-ui/inspect spec generations resolve unchanged; `.sidebar-inspector-card` + host CSS switch it to static in-flow layout (no more fixed centered overlay).
- **Data is real, never fabricated**: the card body rows come from `getInspector(id,'building')` / `getInspector(id,'walker')` internals (`BuildingInstance`/`WalkerInstance` via the residence/production/storage/market/walker inspection projections) — the same enriched fields as Phase 18 (Level/Tier/Population/Food/Water/Labor + civic + class/age/employed; production inputs/outputs; storage reserved/in-transit; walker state/origin/path/carried/target). CR-01 disambiguation (`getInspector(id, kind)`) preserved everywhere — building vs walker id spaces.
- **Close × + Next/Prev cycling**: header × (`popup-close`) closes; `inspector-prev`/`inspector-next` cycle the same-kind entity list in stable id order (houses → houses, walkers of same type → walkers), with `inspector-nav-label` position `n/m` and boundary-disabled buttons. The cycling rules moved into the pure `navState(listLength, index)` helper in `src/game/ui/inspector.ts` (unit-locked: single-entity list disables both; first entry prev-disabled; last entry next-disabled; no-list/`other`-kind shows `—`).
- **Keyboard**: with the card open, `←` steps back / `→` steps forward through the selection list; `Escape` closes the card first (precedence drawer > inspector > build > pause). New e2e locks the full arrow + Escape flow on the card.

## Seams used (unchanged)

- `SimRunner.getInspector(id)` / `getInspector(id, 'walker')` / `getWalkerInternals` — read-only, zero diffs in `src/sim/*`.
- `emitInspect` click-through (MainScene) — untouched; overlay layer never takes input.
- Sidebar-driven selection (dispatch §3): advisor `open-inspector` / `locate` actions emit `hud-inspect` → renders into the sidebar card (existing wiring, now relocating output to the host).
- `getState()`/SaveData shape unchanged; no new sim getters.

## New module + test files

- `src/game/ui/inspector.ts` (new) — pure `buildInspectorCard(data)` builder + `navState()` cycling helper; zero innerHTML (all strings via `textContent`); node-env testable with the shared `el()` stub.
- `tests/unit/inspector.test.ts` (new, 12 tests) — card title/rows rendering, close × testid + aria-label, legacy testid/class contract, prev/next disabled states, nav label, hostile-string passthrough (UI-RED-08), navState boundary rules.
- `src/game/ui/sidebar.ts` — `inspectorHost` now carries `[data-testid="sidebar-inspector-host"]` (mount target for e2e).
- `src/game/scenes/HUDScene.ts` — popup host deleted; `renderInspectorShell` mounts the card + wires close/prev/next; building/walker rows refactored to `InspectorRow[]`; `popupEl` tracks the mounted card for `isInspectorOpen()`.
- `src/game/scenes/MainScene.ts` — key-router fix: `←`/`→` step the selection list by the actual key (the router's symmetric building↔walker card flip cannot encode direction; previously both arrows advanced forward).
- `index.html` — `.hud-sidebar .sidebar-inspector-host { pointer-events: auto }` + in-flow card overrides (static position, 32vh max height).
- `e2e/inspect.spec.ts` — all 7 existing assertions re-scoped to the sidebar-host card + new test: `←/→ and Escape drive the sidebar inspector card (key-router precedence)`.
- `tests/determinism/population-determinism.test.ts` — source-audit row grep updated `appendRow(body, …)` → `push(…)` (rows now collected into the card builder list; same labels + same live-cohort guard).

## Gates

- `npm run typecheck` — **clean**
- `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4 --bail 1` — **128 files / 1020 tests passed** (3 `[vitest-worker]: Timeout calling "onTaskUpdate"` RPC noise — not test failures; same baseline noise class as Waves 2-3)
- Goldens: `git status --porcelain tests/golden` — **empty** (byte-identical)
- `src/sim/` — **zero diff** (view-only honored)
- innerHTML — **0** (`grep -rn 'innerHTML' src/game index.html | wc -l` → `0`; no-innerhtml.test.ts green)
- e2e targeted specs (`inspect` 8 + `keyboard` 5 + `sidebar` 3 + `management-ui` 9): **25/25 passed** — including walker click-under-overlay (Wave 3 lock), popup-close/prev/next management-ui regressions, and the new arrow/ESC card test
- Pre-existing baseline flakes (boots/campaign/placement-population) untouched — not chased per dispatch §5
- No new npm deps; UPPERCASE labels still deferred to Wave 5 (dispatch constraint)

## Commits

- `8612f56` feat(20-04): sidebar inspector cards + close/Next cycling (20-04-01)
