You are executing Plan 17 of Phase 17 (campaign-tutorial-codex) in OpenCaesar at /Users/filipe.esch/projects/pessoal/opencaesar.

<objective>
Execute plan 17 of phase 17-campaign-tutorial-codex. Commit each task atomically. Create SUMMARY.md. Update STATE.md and ROADMAP.md with plan progress.
</objective>

<sequential_execution>
You are running as a SEQUENTIAL executor agent on the main working tree. Use normal git commits (with hooks). Do NOT use --no-verify.
REQUIRED ORDER: Write SUMMARY.md → commit → only then any narration. No text between Write and commit.
</sequential_execution>

<execution_context>
@/Users/filipe.esch/projects/pessoal/opencaesar/.opencode/gsd-core/workflows/execute-plan.md
@/Users/filipe.esch/projects/pessoal/opencaesar/.opencode/gsd-core/templates/summary.md
@/Users/filipe.esch/projects/pessoal/opencaesar/.opencode/gsd-core/references/checkpoints.md
@/Users/filipe.esch/projects/pessoal/opencaesar/.opencode/gsd-core/references/tdd.md
</execution_context>

<files_to_read>
Read these files at execution start using the Read tool. Resolve repo root first: PROJECT_ROOT=$(git rev-parse --show-toplevel)
- ${PROJECT_ROOT}/.planning/phases/17-campaign-tutorial-codex/17-PLAN.md (Plan)
- ${PROJECT_ROOT}/.planning/PROJECT.md (Project context)
- ${PROJECT_ROOT}/.planning/STATE.md (State)
- ${PROJECT_ROOT}/.planning/config.json (Config, if exists)
- ${PROJECT_ROOT}/.planning/phases/17-campaign-tutorial-codex/17-CONTEXT.md (User decisions)
- ${PROJECT_ROOT}/.planning/phases/17-campaign-tutorial-codex/17-RESEARCH.md (Research)
- ${PROJECT_ROOT}/.planning/phases/17-campaign-tutorial-codex/17-PATTERNS.md (Pattern map)
- ${PROJECT_ROOT}/AGENTS.md (Project instructions, if exists)
- ${PROJECT_ROOT}/.claude/skills/ or ${PROJECT_ROOT}/.agents/skills/ (Project skills, if exists)
</files_to_read>

<project_rules>
- This is a TypeScript city sim at repo root /Users/filipe.esch/projects/pessoal/opencaesar.
- Full suite command: NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4
- Determinism is critical: NO Math.random()/Date.now()/new Date() in sim paths under src/sim and src/game (runner.ts has pre-existing savedAt: Date.now() at save time — NOT a violation). SimState/getStateJson() byte-identical on replay. Goldens NOT touched this phase (mission/tutorial/codex stay out of getState()).
- Month cadence tickCount % 40 === 0. Year = Math.floor(tickCount / 360). Ledger resets at tick 360.
- Balance-parity: new data/balance.ts constants need CONFIG.<key> consumer or tests/unit/balance-parity.test.ts fails — PREFER module-local constants; NEVER add keys to data/balance.ts for this phase unless they have a CONFIG consumer.
- Military: npm run check:military. Catalog validation: validateCatalogs() === [].
- Wave-close gate: per <verify><automated> per task. Wave-0 scaffolds are RED until their waves; the wave-close full suite gate EXCLUDES the pending Wave-0 scaffolds until Waves flip them.
- ADDITIVE-ONLY API changes.

CRITICAL plan decisions (from the plan-checker-approved plan):
- startMission landmine: set mission.year = Math.floor(tickCount / 360) at start (NOT 0), so a time-limited mission started on a ticked runner does not instantly fail. This is critical for the sequential campaign.
- Missions are replayable SaveCommands (types.ts SaveCommand union + exhaustive applyCommand dispatch + saveCommands.push). The start gate is live-only (!this.replaying && previousWon) so replay is safe; NO SaveData schema change; mission state round-trips via command replay.
- Progression gating: mission N+1 unlocks only when N is won (sequential playability) — getCampaignProgress().
- Winnability: mission 10 targets eased to 80/80/80 (within verified ceilings: culture 105/prosperity 110/stability 96.4/favor 100, annualExports 50-150). Add a winnability probe test for all 10 missions (esp. 4/8/10).
- Additive MissionDef extension (map/products/routes/modifiers) — undefined = existing entries unchanged; validation over MISSIONS AND EXTRA_MISSIONS in data/validate.ts.
- Per-mission map: construction-time contract — callers pass missionMap(def) to new SimRunner/fromSaveData; per-mission width/height ≤ 40×40.
- Command self-record suppression: a suppressCommandRecording guard prevents save→load→save command duplication; per-mission modifiers/preplacements under that guard.
- Use getMissionProgress() (NOT getObjectiveProgress — would double-update the mission tracker on the month cadence).
- Tutorial: cause-detection predicates are pure total functions over DerivedSnapshot/BuildingState (deterministic, no wall-clock); 9-step set; immigration-blocked → laborConnected===false && workersRequired>0 speaking housing-evolution language; dismissTutorialStep is a replayable SaveCommand; getTutorial() derived accessor (template getCivicStats/getGovernance).
- Codex: buildCodex entries enriched strictly from data catalogs (description/howItWorks/inputs/outputs/workers/cost/requirements/relatedLinks); add 9 missing categories (chains/housing/desirability/trade/finance/ratings/religion/risks/shortcuts); getCodex()/lookupEntry accessor; keep derivedSnapshot codex counts filtered to the 4 existing kinds (buildings/commodities/services/gods).
- decideEvolution in housingEvolution.ts must NOT be edited.

Follow the plan file's task XML precisely: each task has read_first/action/verify/acceptance_criteria/done. Commit each task atomically with repo-convention messages (feat(17): ..., fix(17): ..., test(17): ..., docs(17): ...). After all tasks, update STATE.md and ROADMAP.md plan progress, write SUMMARY.md, and commit it.
</project_rules>

<success_criteria>
- [ ] All 8 tasks executed
- [ ] Each task committed individually
- [ ] All 4 waves completed in order
- [ ] SUMMARY.md created and committed
- [ ] STATE.md updated with position and decisions
- [ ] ROADMAP.md updated with plan progress
</success_criteria>
