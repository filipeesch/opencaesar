You are the GSD Planner for Phase 16: "Full Housing Evolution" in OpenCaesar, a TypeScript deterministic city sim at /Users/filipe.esch/projects/pessoal/opencaesar.

<planning_context>
**Phase:** 16
**Mode:** standard

<files_to_read>
- /Users/filipe.esch/projects/pessoal/opencaesar/.planning/STATE.md (Project State)
- /Users/filipe.esch/projects/pessoal/opencaesar/.planning/ROADMAP.md (Roadmap)
- /Users/filipe.esch/projects/pessoal/opencaesar/.planning/REQUIREMENTS.md (Requirements)
- /Users/filipe.esch/projects/pessoal/opencaesar/.planning/phases/16-full-housing-evolution/16-CONTEXT.md (USER DECISIONS)
- /Users/filipe.esch/projects/pessoal/opencaesar/.planning/phases/16-full-housing-evolution/16-RESEARCH.md (Technical Research)
- /Users/filipe.esch/projects/pessoal/opencaesar/.planning/phases/16-full-housing-evolution/16-PATTERNS.md (Pattern Map)
- /Users/filipe.esch/projects/pessoal/opencaesar/openspec/specs/desirability/spec.md (if exists)
</files_to_read>

**Phase requirement IDs (every ID MUST appear in a plan's `requirements` field):** HOUS-01, HOUS-02

**Project instructions:** Read ./AGENTS.md or ./.claude/CLAUDE.md if either exists — follow project-specific guidelines.
</planning_context>

<downstream_consumer>
Output consumed by /gsd-execute-phase. Plans need:
- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format with read_first and acceptance_criteria fields (MANDATORY on every task)
- Verification criteria
- must_haves for goal-backward verification
- <threat_model> block (security enforcement active, ASVS level 1; sim-only project, most threats N/A — note explicitly)
- Wave 0 test gaps from VALIDATION.md
- Tracer-first: lead with one production-quality end-to-end tracer slice verified before expansion tasks
</downstream_consumer>

**TRACER_MODE:** true
**REVERSIBILITY_GATES:** true
**MVP_MODE:** false
**WALKING_SKELETON:** false
**Granularity:** standard

<phase_context>
Goal: 21-level housing progression with cumulative requirements, hysteresis, and merging. Depends on Phases 5, 8, 12, 13.

Success criteria (must be TRUE):
1. Houses evolve only when ALL cumulative goods/services/religion/desirability are met for the minimum period.
2. Houses devolve after tolerance loss; hysteresis prevents oscillation.
3. Compatible adjacent houses merge into larger lots when blocks allow.

KEY RESEARCH FINDINGS to honor (16-RESEARCH.md + 16-PATTERNS.md):
- The 21-level engine ALREADY EXISTS but is unwired: HOUSING_LEVELS (data/housing.ts 0-20), decideEvolution + DEFAULT_HYSTERESIS (housingEvolution.ts). tickHousing (housing.ts) still runs legacy 5-tier; house.tier read unguarded by 8+ consumers (economy.ts:21/52/73/95, advisors.ts:582, runner.ts:918/927/1594/2637).
- The bridge mismatches on 5 axes: desirability 1-20 catalog vs 0-200 live desirabilityOf; requires building-type keys (well/market/fountain) vs live wellness keys (health/literacy/religion/entertainment); requiresGoods non-food with no per-house delivery path (tools houseGood:false); HOUSING_LEVELS lacks workers + tax is taxPerCapita/month; no footprint field for merging.
- Recommended: add house.level (0-20) as source of truth via decideEvolution; keep house.tier as derived 0-4 bucket for ratings/patricians; scalar economy via additive HOUSING_LIVE_STATS 21-entry table (template: economy.ts pure-bridge pattern); normalize desirability 0-200 → 1-20; assemble satisfied[] via deterministic deriveSatisfied per-house; merge runs like tickSafety on %40 cadence, fixed scan order, NO new SaveCommand (replay re-derives merges byte-identically).
- Golden fixtures SHIFT (mechanic change): food-chain golden pins tier:2 Insula, desirability:75, exact house-evolved ticks 143/149/161/203/209/221/251/311; must regenerate via npm run test:golden:update and update 5-tier-timing unit tests (housing.test.ts, civic-services, bankruptcy, health-ed-ent, economy).
- Pattern mapper named analogs: housingLive.ts → economy.ts; housingMerge.ts → placement.ts (isOccupied predicate + n×n loop) + runner.ts:2730 footprintsTouch; merge counting like tickSafety.
- Determinism: no RNG/clock; counters from tick history; month cadence %40; goldens regenerate INTENTIONALLY (mechanic change), never silently.
</phase_context>

<plan_shape>
Create PLAN.md at /Users/filipe.esch/projects/pessoal/opencaesar/.planning/phases/16-full-housing-evolution/16-PLAN.md with 3 waves aligned to requirements:
- Wave 0: validation test scaffolds — tests/unit/housing-level-bridge.test.ts, tests/integration/housing-evolution-live.test.ts, tests/unit/housing-merge.test.ts, tests/determinism/housing-evolution-determinism.test.ts (RED until implementing waves).
- Wave 1 (HOUS-01): bridge + level wiring — housingLive.ts (HOUSING_LIVE_STATS 21-entry, tierOfLevel, levelDesirability normalization 0-200→1-20, deriveSatisfied); extend house state with level/satisfiedTicks/unsatisfiedTicks; wire decideEvolution into tickHousing/runner; route economy/tax/population/workers/ratings consumers through the bridge; keep house.tier derived.
- Wave 2 (HOUS-02): hysteresis counters wiring + deterministic merge step (housingMerge.ts pure helpers: blockFits, mergeCandidate; runner %40 merge step with fixed scan order; house-merged message; evicted tile freed; population combined; only up to level 20).
- Wave 3: golden regeneration + test updates — regenerate goldens via npm run test:golden:update; update housing.test.ts/civic-services/bankruptcy/health-ed-ent/economy timing asserts; extend data/validate.ts housing block (footprint monotonicity + requiresGoods ⊆ FOOD_TYPES ∪ houseGood), resolve tools mismatch.
Wave ordering: Wave 1 before 2 (merge depends on level wiring), Wave 3 last (goldens regenerate after mechanics final).

Write the final PLAN.md using the Write tool. Do NOT return the PLAN.md content in your reply.
</plan_shape>

Conclude your reply with: ## PLAN COMPLETE
