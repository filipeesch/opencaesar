You are the plan-phase for Phase 20 of milestone v1.1 (UI Redesign — Caesar III Sidebar & Advisors) in OpenCaesar at /Users/filipe.esch/projects/pessoal/opencaesar.

## Required reading
- .planning/ROADMAP.md (Phase 20 section), .planning/phases/20/CONTEXT.md, .planning/REQUIREMENTS.md, .planning/PROJECT.md
- .opencode/gsd-core/references/tdd.md, checkpoints.md
- Glance at src/game/ structure: src/game/advisors.ts (13-advisor composer, ADVISOR_TAB_ORDER), src/game/scenes/HUDScene.ts (1177 lines — refactor target), MainScene.ts (isometric container), src/game/options.ts, src/game/ui/ if any, tests layout (e2e/*.spec.ts Playwright root + tests/**/*.test.ts vitest).

## Phase 20 scope (11 requirements)
UI-RED-01..08 + UI-FIX-01..03. View-only UI redesign; NO sim-core change; goldens byte-identical; no innerHTML.

## Task
Create .planning/phases/20/PLAN.md with a detailed plan: task breakdown with IDs (20-01-01, ...), waves (Wave 0 scaffolds/tests, Wave 1 sidebar, Wave 2 advisor drawer + keyboard, Wave 3 overlays hues/legends, Wave 4 inspectors + UPPERCASE, Wave 5 close/verify), dependencies, test commands per task, acceptance criteria. Follow the plan template conventions. Write files immediately, commit:
node "$HOME/.config/opencode/gsd-core/bin/gsd-tools.cjs" query commit "docs(20): create phase 20 plan" --files .planning/phases/20/PLAN.md
Return "## PLAN COMPLETE" + summary (tasks, waves).
