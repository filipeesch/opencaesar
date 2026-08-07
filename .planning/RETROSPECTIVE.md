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

## Milestone: v1.1 — UI Redesign (Caesar III Sidebar & Advisors)

**Shipped:** 2026-08-07
**Phases:** 1 | **Plans:** 6 | **Sessions:** 2 (same day)

### What Was Built
- Caesar III-style right sidebar (build panel, tools, speed, overlays, settings) + minimal top status bar replacing the top HUD — every control wired to a real runner seam, 0 decorative
- 13-advisor drawer with live sim data under tick-change guard; keyboard-first A/←/→/Escape/B/1-5 with precedence chain and form-focus guard
- Per-service overlay color ramps (7 services) with 5-band legends, dominant-risk-service painting, click-through to inspectors; sidebar inspector cards with same-kind cycling
- UPPERCASE labels via case-only CSS utility; zero innerHTML across src/ + index.html — 1028 vitest + 28 e2e green, sim core byte-identical
- All three deferred Phase-18 UI-review fixes delivered (keyboard bindings, per-service hues, UPPERCASE)

### What Worked
- The node-safe `el()/clear()/text()` DOM builder (StubNode for node-env vitest) made every UI module unit-testable without Phaser or a DOM shim — biggest lever of the phase
- Key-router as a pure state machine (KeyRouter.handleKey) with precedence tests — keyboard precedence regressions caught in unit tests, not e2e
- Tick-change re-render guard prevented per-frame re-renders and render-loop issues from day one
- Per-wave gate discipline: wave reports + close-gate table (typecheck/suite/goldens/innerHTML/sim-diff/military/e2e/precedence) made the final verification a formality (8/8 PASS first try)
- Verify:post hooks (nyquist + security) ran clean — VALIDATION reconstructed from PLAN (no gaps), 7/7 threats SECURED

### What Was Inefficient
- Executor returned empty on 2 of 6 wave dispatches (wave 1 resume, wave 2) — resume-dispatch pattern needed; the empty-task_result signature is the top recurring cost
- SUMMARY.md was never committed by the executor — orchestrator reconstructed it post-hoc, which then made the verification "stale" (summary newer than VERIFICATION) and forced a full re-verify
- Integration checker flagged 2 copy-state warnings post-verification ("No messages yet", "Nothing highlighted" from the 18-UI-SPEC contract) — would have been caught earlier by a checklist item in the close gate
- 3 e2e baseline flakes (boots/campaign/placement) consume ~5 min of every full sweep — still not fixed, now recorded as tech debt

### Patterns Established
- Dispatch-file pattern (write *-DISPATCH.md, spawn with short prompt) is now the standard for phase ops
- Staleness rule learned the hard way: commit VERIFICATION.md LAST, after all docs (summary, validation, security), so `verification.status` stays "passed"
- Wave report → close-gate table → verification: the executor's gate table becomes the verifier's checklist (no re-derivation)
- Coverage-hue design decisions belong in SPEC with explicit "this replaces 18-UI-REVIEW finding #2" framing to avoid post-hoc integration warnings

### Key Lessons
1. Commit order matters for gates: SUMMARY/VALIDATION/SECURITY before VERIFICATION, or the transition gate goes stale
2. Empty-state copy contracts are easy to drop silently — add a "verbatim copy strings" grep to the close gate when the spec locks copy
3. Node-safe DOM builders make view layers fully unit-testable — worth the abstraction cost
4. A single-phase milestone can still carry cross-phase risk (18-UI-REVIEW findings deferred across v1.0); track them explicitly in REQUIREMENTS.md as UI-FIX-IDs
5. Integration checker adds value even for single-phase milestones (caught 2 real UX gaps)

### Cost Observations
- Model mix: 100% opencode local DeepSeek (all subagents inherit orchestrator model)
- Sessions: 2 (same-day milestone: start → complete)
- Notable: 34 commits, 48 files, +4778/-716; full milestone (discuss→plan→execute→review→fix→verify→hooks→audit→close) in one session chain

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 5 | 20 | Full autonomous GSD pipeline: discuss→plan→check→execute→review→fix→verify→audit→close |
| v1.1 | 2 | 1 | Node-safe DOM builder pattern; dispatch-file standard; VERIFICATION-committed-last gate hygiene |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 973 | golden byte-identity + chunked determinism (1/7/50) | all systems additive, goldens byte-unchanged since Phase 15 |
| v1.1 | 1028 (+28 e2e) | + no-innerHTML audit, keyboard precedence, per-service hue locks | view-only phase: sim core byte-identical, goldens untouched |
