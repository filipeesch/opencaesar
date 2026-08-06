# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — OpenCaesar

**Shipped:** 2026-08-06
**Phases:** 20 | **Plans:** 34 | **Sessions:** 5

### What Was Built
- Deterministic city-sim core: time system, data catalogs, road graph, water, agriculture, production, warehouses, markets, external trade, finance — all with physical goods logistics and golden determinism
- Civic systems: civil safety, health/education/entertainment, religion, governance, ratings/objectives/events, 21-level housing evolution with merging
- Campaign (10 missions), contextual tutorial, catalog-derived codex, management UI (13 advisors, overlays, inspectors), versioned save/load + persisted options
- Milestone-audit gap closure: per-residence population, migration, labor sectors, wage policy (POP-01..04) — 59/59 REQ-IDs wired, 973 tests

### What Worked
- Golden determinism as the single invariant: byte-identical save/load made every cross-phase integration provable
- The %40 month-cadence + internal-only-state pattern (never serialized) let new systems (residents, migration) land with zero SaveData growth
- Atomic per-task commits with gsd-tools; code-review → fixer → verifier loop caught real regressions every phase (e.g., palatine sector loss, respondEvent replay clamp)
- Plan-checker gate caught unreachable math before execution (level-20 housing desirability cap)

### What Was Inefficient
- Executor subagents interrupted mid-phase 3 times (16, 18, 19.1) — resume dispatches were needed; worktree isolation was a hidden footgun (fixed via `use_worktrees: false`)
- Subagent model frontmatter (anthropic models) broke the runtime — had to strip `model:` from all 34 agent files
- Long subagent prompts broke the Task tool's JSON serialization — workaround: write dispatch files first
- Stray Phase 20 (INSERTED — ui-redesign) leaked from another project's ROADMAP merge; `phase.complete 19` reported `is_last_phase: False` because of it
- 8x-speed and winnability-probe tests hit vitest worker RPC timeouts — infra noise, but cost reruns

### Patterns Established
- Golden-safe wiring: internal-only HouseInstance fields + DerivedSnapshot report fields + inspector seams (never `toBuildingState`/`getState()`)
- Replayable SaveCommand for every player action surface (union + exhaustive applyCommand + validateCommand before fromSaveData)
- Plan-checker loop: fix BLOCKERs before execution; per-wave typecheck-sequencing notes for scaffold-first plans
- Milestone audit → gap-closure phase (19.1) before complete-milestone — caught the orphaned population module

### Key Lessons
1. Always verify golden byte-identity after any new sim wiring — `git status --porcelain tests/golden` is the cheapest regression check
2. Pinned-sector reserve semantics must live at the runner level, not the pure function (the "surplus fills all" invariant needs it)
3. When an agent returns empty, spot-check git log + working tree before re-dispatching
4. Advisory UI findings (keyboard bindings, hues, labels) survive milestones — schedule them explicitly into UI phases or they defer forever
5. Keep ROADMAP imports from other projects out — decimal-phase inserts are better than foreign phase numbers

### Cost Observations
- Model mix: 100% opencode local DeepSeek (all subagents inherit orchestrator model after frontmatter strip)
- Sessions: 5
- Notable: full 20-phase milestone executed autonomously; 294 commits; 34k LOC (src + tests)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 5 | 20 | Full autonomous GSD pipeline: discuss→plan→check→execute→review→fix→verify→audit→close |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 973 | golden byte-identity + chunked determinism (1/7/50) | all systems additive, goldens byte-unchanged since Phase 15 |
