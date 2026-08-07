# Wave 3 Report — Phase 20 (UI Redesign — Caesar III Sidebar & Advisors)

## Status: COMPLETE

Wave 3 delivered per-service overlay color ramps for ALL overlays (20-03-01) and the click-through e2e locks (20-03-02 per dispatch; UPPERCASE labels are deferred to Wave 5 by dispatch constraint). The `risks` overlay now paints each tile with its DOMINANT service's own ramp instead of a single merged hue — 18-UI-REVIEW finding #2 (service identity lost in `max()` + one shared ramp) is fixed.

## Wave 3 deliverables

### 20-03-01 — Per-service overlay hues + legends (UI-FIX-02, SPEC §4)
- **Heatmap paint (`MainScene.renderOverlay`)** now reads `overlayHue(id, band)` from `src/game/ui/overlays.ts` for every overlay — the Phase-18 `OVERLAY_RAMPS` table in `palette.ts` is deleted (dead after the swap; `hexToPhaser` kept):
  - `water` = blue ramp (`#2b7cc4` base) · `food` = green (`#6fcf5f`) · `coverage` = teal (`#2aa4a4`) · `desirability` = teal (`#2aa4a4`)
  - `risks` = per-tile dominant service resolution: `dominantRiskService(fire, danger, collapse, crime, x, y)` picks the max of the four `getCivilizationOverlay()` grids, ties resolved to priority order fire > danger > collapse > crime; the tile then paints with THAT service's ramp (fire=red, danger=orange, collapse=brown, crime=purple). Service identity survives the merge; zero cells still unpainted.
- **Legend (`HUDScene.renderOverlayLegend`)** swatches now come from `overlayHue(id, band)` (the service's own ramp). The risks legend renders one row per service (`legend-service-{fire|danger|collapse|crime}`, each a 5-swatch ramp + name) mirroring the per-tile paint; other overlays keep the 5 band-label rows (None→Source / 0 days→Plenty / …) with per-service swatches. New CSS: `.legend-service-row`, `.legend-service-name`, `.legend-ramp` in `index.html`.
- **`ui/overlays.ts`**: added `RISK_SERVICES` (ordered id+label metadata, reused by paint priority AND legend) and the pure `dominantRiskService` resolver (unit-tested, no Phaser dependency).
- **Unit tests** (`tests/unit/overlay-hues.test.ts`, 15 tests): + `rampFor` parity with `overlayHue`, `RISK_SERVICES` order/labels, dominant-risk resolution incl. fire>danger tie-break, per-service band-4 hue locks. `water-overlay.test.ts` regression untouched and green (sim seam unchanged).

### 20-03-02 — Click-through preserved + locked (UI-RED-04, T-18-04)
- No source change needed: the depth-1 overlay Graphics never takes input, so the `emitInspect` path (building → `hud-inspect`, walker → `hud-walker-inspect`) was already intact. Wave 3 LOCKS it in e2e:
- `e2e/management-ui.spec.ts`:
  - UI-03 extended: water legend asserts 5 band rows / 5 swatches + heading; existing well-click-under-overlay assertion kept.
  - New: risks overlay legend lists all four service ramps (4 rows × 5 swatches).
  - New: walker click-through with an overlay active — builds the proven walker city, activates water overlay, retry-clicks a live walker tile until the walker inspector opens (`/Walker/`).

## Gates
- `npm run typecheck` — clean
- `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4 --bail 1` — **127 files / 1008 tests passed** (2 `[vitest-worker]: Timeout calling "onTaskUpdate"` RPC noise — not test failures; same baseline noise class as Wave 2's 3)
- Goldens: `git status --porcelain tests/golden` — **empty** (byte-identical)
- `src/sim/` — zero diff (view-only honored); `src/game/advisors.ts` — zero diff
- innerHTML — 0 (`grep -rn 'innerHTML' src/game index.html | wc -l` → `0`; no-innerhtml.test.ts green)
- No new npm deps; hues remain view-only in `ui/overlays.ts` (never imported by sim)

## e2e suite (vite dev server + Playwright chromium, 1 worker)
- Targeted wave-3 specs (`management-ui` + `sidebar` + `keyboard`): **17/17 passed** (incl. 2 new tests)
- Full-suite sweep: see below — expected to match the Wave-2 baseline (boots / campaign / placement-population flakes are pre-existing, not chased per dispatch §4).

## Commits
- `b3e3d27` feat(20-03): per-service overlay ramps + legends (UI-FIX-02)
- `40efd59` test(20-03): e2e overlay legend + click-through locks (UI-03/T-18-04)
