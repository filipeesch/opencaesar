You are executing Wave 0 of Phase 20 (UI Redesign — Caesar III Sidebar & Advisors) in OpenCaesar at /Users/filipe.esch/projects/pessoal/opencaesar.

## Phase 20 scope
View-only UI redesign. NO src/sim/ changes, no getState()/SaveData shape change, goldens byte-identical, no innerHTML (UI-RED-08).

## Wave 0 — Task 20-00-01: Inventory & spec + test scaffolds
1. **Control→seam inventory**: Read src/game/scenes/HUDScene.ts (1177 lines), MainScene.ts, advisors.ts, options.ts, palette.ts. Produce a table mapping every current HUD control (build panel buttons, tools, speed, pause/save/restart, advisor button, overlay toggles, inspectors) to its existing runner seam (e.g., SimRunner build/demolish/setPolicy/startMission/respondEvent/getInspector/getWalkerInternals/getDerived/options). Note any decorative (non-wired) buttons to remove/replace.
2. **DOM spec**: Write .planning/phases/20/SPEC.md — the target sidebar layout (right sidebar = build panel + tools + speed + advisor drawer + overlay toggles; minimal top status bar = population/date/treasury/ratings), keyboard map (A cycles advisors, ←/→ switch panels, Escape closes, B toggles build panel, 1-5 toggle overlays — additive to existing ESC/W/F/R/C/D/X), and per-service hue table (fire=red, danger=orange, collapse=brown, crime=purple, food=green, water=blue, desirability=teal).
3. **RED scaffolds**: Create test files that fail until implemented:
   - tests/unit/sidebar-controls.test.ts — asserts sidebar renders build/tools/speed controls, every control calls a real runner seam (no decorative), DOM via textContent/createElement.
   - tests/unit/sidebar-layout.test.ts — asserts top status bar shows population/date/treasury/ratings from getDerived().
   - tests/unit/overlay-hues.test.ts — asserts per-service hue table exists and each overlay uses its own ramp.
   - tests/unit/advisor-drawer.test.ts — asserts 13 advisors in ADVISOR_TAB_ORDER, tick-change re-render, empty states verbatim.
   - tests/unit/keyboard.test.ts — asserts A/←/→/Escape/B/1-5 bindings with precedence drawer > inspector > build > pause; existing keys regression-locked.
   - e2e/sidebar.spec.ts + e2e/keyboard.spec.ts — Playwright specs (follow e2e/management-ui.spec.ts patterns).
   Also a tests/unit/no-innerhtml.test.ts that scans src/game for innerHTML and fails if found (UI-RED-08).
4. Run: npm run typecheck + NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4 --bail 1. RED tests must fail (prove they're real). Do NOT fix src yet — Wave 0 is inventory + RED.
5. Commit atomically: node "$HOME/.config/opencode/gsd-core/bin/gsd-tools.cjs" query commit "test(20): red scaffolds + sidebar spec (wave 0)" --files .planning/phases/20/SPEC.md tests/unit/sidebar-controls.test.ts tests/unit/sidebar-layout.test.ts tests/unit/overlay-hues.test.ts tests/unit/advisor-drawer.test.ts tests/unit/keyboard.test.ts tests/unit/no-innerhtml.test.ts e2e/sidebar.spec.ts e2e/keyboard.spec.ts
6. Update .planning/STATE.md progress (append Wave 0 done).

Return "## WAVE 0 COMPLETE" + inventory summary (control count, decorative count, innerHTML sites found) + RED test failures list.
