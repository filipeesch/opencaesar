You are the smart-discuss step for Phase 20 of milestone v1.1 (UI Redesign — Caesar III Sidebar & Advisors) in OpenCaesar at /Users/filipe.esch/projects/pessoal/opencaesar.

## Context
- Milestone: v1.1 UI Redesign. Roadmap Phase 20 covers 11 requirements: UI-RED-01..08 + UI-FIX-01..03.
- v1.0 shipped a management UI: src/game/advisors.ts (13-advisor composer), src/game/scenes/HUDScene.ts, MainScene.ts, src/game/options.ts. Sim core deterministic, goldens byte-identical. View-only redesign: NO sim-core change, no getState()/SaveData shape change.
- User is FULL-AUTO: "Accept all and dont ask me again, just proceed." Do not ask questions. Auto-answer every grey area with the best default, and record the decisions.

## Grey areas to resolve (propose + auto-accept defaults)
1. **HUD replacement strategy**: Replace top HUD entirely with a right sidebar, or keep a slim top bar for population/date/treasury? → Default: right sidebar holds build panel + tools + speed; keep a minimal top status bar (population, date, treasury, ratings) since Caesar III shows those at top; sidebar is the interaction hub.
2. **Advisor drawer layout**: 13 advisors in a right-drawer that slides over the sidebar or replaces build panel? → Default: drawer overlays the right sidebar area; A cycles, ←/→ switches, Escape closes.
3. **Per-service coverage hues**: define color ramps per overlay service (fire=red ramp, danger=orange, collapse=brown, crime=purple, food=green, water=blue, desirability=teal) using the existing overlay data getters. → Default: single hue ramp per service, derived from a small color table.
4. **Keyboard bindings**: A cycles advisors, ←/→ switches panels, Escape closes; also 1-5 for overlays? → Default: A/←/→/Escape per requirements; plus B toggles build panel, 1-5 toggle overlays (Caesar III-ish).
5. **UPPERCASE labels**: apply text-transform uppercase to overlay legend + advisor labels. In Phaser use style textTransform; in DOM use CSS class. → Default: DOM/CSS `text-transform: uppercase` for legend/labels; Phaser text style where DOM isn't used.
6. **Testing**: Playwright e2e for keyboard/sidebar flows; vitest unit for composer wiring. → Default: keep existing e2e patterns (tests/e2e/*.spec.ts), add keyboard/sidebar spec.
7. **Existing HUDScene**: refactor vs replace? → Default: refactor HUDScene into sidebar components (SidebarScene or MainScene layout change), keep MainScene as container; remove decorative buttons, wire every control to a real runner getter/command.

## Output
Write `.planning/phases/20/CONTEXT.md` with: phase goal, decisions (table of the above with the auto-accepted answer + rationale), assumptions, constraints (view-only, golden byte-identity), risks, and a work plan sketch. Commit with gsd-tools:
node "$HOME/.config/opencode/gsd-core/bin/gsd-tools.cjs" query commit "docs(20): phase context & grey-area decisions" --files .planning/phases/20/CONTEXT.md
Return "## DISCUSS COMPLETE" + a short summary of decisions.
