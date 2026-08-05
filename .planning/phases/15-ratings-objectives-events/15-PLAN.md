---
phase: 15-ratings-objectives-events
plan: 15-plan
type: execute
wave: 0
depends_on: [14-PLAN]
files_modified:
  - src/sim/ratings.ts
  - src/sim/objectives.ts
  - src/sim/events.ts
  - src/sim/trade.ts
  - src/sim/runner.ts
  - src/sim/types.ts
  - src/sim/missions.ts
  - src/sim/advisors.ts
  - data/events.ts
  - data/missions.ts
  - data/validate.ts
  - data/balance.ts
  - tests/ratings.test.ts
  - tests/objectives.test.ts
  - tests/events.test.ts
  - tests/missions.test.ts
  - tests/runner-accessors.test.ts
  - tests/data-catalog.test.ts
  - tests/determinism/export-window-determinism.test.ts
  - tests/determinism/event-response-determinism.test.ts
autonomous: true
requirements: [RATE-01, RATE-02, RATE-03]

estimate:
  tokens: 210000
  raw_tokens: 140000
  tasks: 7
  confidence: med

must_haves:
  truths:
    - "RATE-01: getDerived() exposes a `decomposition` field with per-rating factor buckets and each rating stays clamped 0-100 (weighted sum of normalized factors, replacing the additive-caps placeholder in computeTargets); Prosperity's operating-balance factor never includes one-time construction cost — constructionSpend only lands in a separate construction bucket so expansion is not double-penalized."
    - "RATE-01: `constructionSpend` is a lifetime accumulator captured beside the build/route-opening treasury captures (placeBuilding + openTradeRoute) and re-derives byte-identically from replaying saveCommands."
    - "RATE-02: ObjectiveTracker accepts population/culture/prosperity/stability/favor/treasury/annualExports targets (each undefined = not required, default sustainChecks 3 months); sustain is counted only on the month cadence (tickCount % 40 === 0) and getObjectiveProgress is a pure read (no every-tick / double-count sustain bug)."
    - "RATE-02: the mission/completion path is unified on the sustained-period ObjectiveTracker — a mission wins only after all targets are held for the required period, shortfalls stay visible, and time-limit failure is preserved; annualExports is a trailing-360-tick window from live route exports identical across chunked ticks and save/load."
    - "RATE-03: the non-military event catalog expands to ~25 events (original 8 preserved with their schedule behavior), each optionally carrying `responses[]`; while an event is active its effects actually move live derived ratings (initial/sustain/final messaging preserved) and are removed at conclusion — never entered into getState() output."
    - "RATE-03: respondEvent(eventId, choiceId) is a replayable SaveCommand — a valid choice mutates the outcome (treasury cost via Treasury.addExpense, altered rating severity, or early conclusion); unknown/inactive event or unknown choice is rejected with no state change; run→respond→save→load yields byte-identical getStateJson()."
    - "Regression: golden fixtures, balance-parity, and military-absence gates stay green — getState() keeps its separate economy computeRatings path; any new BALANCE key gets a CONFIG.<key> consumer; the expanded catalog still validates (validateCatalogs() === [])."
  artifacts:
    - path: src/sim/ratings.ts
      provides: "weighted-sum-of-normalized-factors computeTargets (all four ratings), extended RatingDecomposition/decomposeRatings superseding the placeholder, clampRating preserved"
      min_lines: 120
    - path: src/sim/objectives.ts
      provides: "ObjectiveTarget/MetricSnapshot + favor/treasury/annualExports, ObjectiveTracker.update ok-chain extended, default sustainChecks 3"
      min_lines: 55
    - path: src/sim/events.ts
      provides: "pure resolveResponse(eventId, choiceId) + event effect helper; hash/pickEvent/applyEvent/eventDuration/eventSustainMsg/eventFinalMsg signatures preserved"
      min_lines: 85
    - path: src/sim/runner.ts
      provides: "DerivedSnapshot.decomposition + constructionSpend; constructionSpend accumulator at 1106/771; month-cadence objective update + pure getObjectiveProgress; annualExports window accessor; live event effects + respondEvent command; applyCommand respondEvent branch"
      min_lines: 80
    - path: src/sim/types.ts
      provides: "SaveCommand union branch { kind: 'respondEvent'; eventId: string; choiceId: string }"
      min_lines: 2
    - path: data/events.ts
      provides: "EventDef.responses field + ~25 non-military events (original 8 byte-identical)"
      min_lines: 180
    - path: data/missions.ts
      provides: "MissionDef targetFavor?/targetTreasury?/targetAnnualExports?/sustainChecks? (default 3)"
      min_lines: 10
    - path: data/validate.ts
      provides: "events responses validation (unique ids, non-empty labels, finite effects) + mission new-field checks"
      min_lines: 20
    - path: tests/objectives.test.ts
      provides: "sustain journey (2 consecutive passes → won, miss resets), treasury/favor/exports thresholds, default sustainChecks 3"
      min_lines: 60
    - path: tests/determinism/export-window-determinism.test.ts
      provides: "annualExports trailing-year identity across chunked ticks + save/load (chunkedRunJson pattern)"
      min_lines: 50
    - path: tests/determinism/event-response-determinism.test.ts
      provides: "respondEvent + constructionSpend + annualExports replay byte-identity + no-RNG/clock source audit"
      min_lines: 50
  key_links:
    - "tickDerivedSystems (runner.ts:428-434) → ObjectiveTracker.update: the month gate (tickCount % 40 === 0) and getObjectiveProgress-as-pure-read are the fix for the sustain double-count; the single most likely source of flaky determinism if missed."
    - "Event lifecycle block (runner.ts:281-300) → DerivedSnapshot ratings: event deltas must be live derived modifiers (removed at conclusion), never written into getState() (economy computeRatings path + goldens)."
    - "respondEvent → types.ts SaveCommand union + applyCommand exhaustive dispatch (runner.ts:2312-2339): both must change or typecheck fails; push-on-accept to saveCommands makes it replayable."
    - "constructionSpend → Treasury.addExpense('other', ...) capture sites (runner.ts:1106/771): lives only in DerivedSnapshot, keeps Prosperity's operating balance clean, and is replay-derivable."
    - "data/balance.ts new keys → CONFIG.<key> consumers in src/ (balance-parity.test.ts:44-51); weights kept module-local in ratings.ts avoid the gate entirely."
---

<objective>
Deliver Phase 15 — the four decomposable 0–100 city ratings (Culture, Prosperity, Civic Stability, Administrative Favor) with construction cost treated separately for Prosperity; sustained-period objectives/win conditions; and a deterministic seeded event engine with response choices that change outcomes.

Purpose: this is a **wiring phase over existing deterministic primitives**, not greenfield. `decomposeRatings`/`RatingDecomposition` exist in src/sim/ratings.ts but are imported nowhere; `ObjectiveTracker` sustained-period logic exists; the event engine (`hash`/`pickEvent`/`applyEvent` + an 8-event catalog + lifecycle block) exists but effects are computed and discarded. The phase rewires these seams: a live rating modifier from events, a month-cadence objective update, an `annualExports` rolling window, a `constructionSpend` accumulator, a `respondEvent` SaveCommand, and the ~25-event catalog — all while keeping `getState()` (economy `computeRatings`) and the golden fixtures byte-intact.
Output: extended sim-core (`ratings.ts`, `objectives.ts`, `events.ts`, `runner.ts`, `types.ts`, `trade.ts`), data catalogs (`events.ts`, `missions.ts`, `validate.ts`), advisors surface, and 3 new + 6 extended test files.
</objective>

<execution_context>
@/Users/filipe.esch/projects/pessoal/opencaesar/.opencode/gsd-core/workflows/execute-plan.md
@/Users/filipe.esch/projects/pessoal/opencaesar/.opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/15-ratings-objectives-events/15-CONTEXT.md
@.planning/phases/15-ratings-objectives-events/15-RESEARCH.md
@.planning/phases/15-ratings-objectives-events/15-PATTERNS.md
@.planning/phases/15-ratings-objectives-events/15-VALIDATION.md
@openspec/specs/ratings-objectives/spec.md
@openspec/specs/events/spec.md

# Prior plans: Phase 14 completed (14-SUMMARY.md) — governance/requests ship no direct dependency quota here; Phase 15 only depends on the sim surface being green.

# Sim-core seams (read before Wave 1-3 implementation):
@src/sim/ratings.ts
@src/sim/objectives.ts
@src/sim/events.ts
@src/sim/runner.ts
@src/sim/types.ts
@src/sim/trade.ts
@src/sim/missions.ts
@src/sim/advisors.ts
@data/events.ts
@data/missions.ts
@data/validate.ts
@data/balance.ts
@src/sim/config.ts
@src/sim/happiness.ts
</context>

# Execution order (waves are sequential; tasks within a wave run in listed order — shared files force sequential edits):

- **Wave 0** — validation test scaffolds (2 new unit/determinism files + 1 replay-determinism file; RED until their waves).
- **Wave 1 (RATE-01)** — ratings decomposition. 15-01-02 depends on 15-01-01's DerivedSnapshot.decomposition field (shared runner.ts + ratings.ts).
- **Wave 2 (RATE-02)** — objectives/win conditions. 15-02-02 (annualExports window + accessor) runs **before** 15-02-01 because 15-02-01 wires the accessor into the ObjectiveTracker snapshot; resolving BUG 1 (sustain double-count) belongs to 15-02-01.
- **Wave 3 (RATE-03)** — event responses. 15-03-01 (catalog + resolvers) runs before 15-03-02 (live effects + respondEvent command).

# Locked decisions honored (15-CONTEXT.md): D-01 full per-spec factor decomposition wired into DerivedSnapshot.decomposition; D-02 Prosperity treats construction cost separately via a constructionSpend accumulator; D-03 objectives extend to treasury/favor/annualExports, month-cadence sustain with default 3 months, annualExports trailing-360-tick window; D-04 ~25-event catalog + EventDef.responses + respondEvent SaveCommand with real (not merely logged) lifecycle effects. Deferred ideas: none.

<tasks>

<!-- ===================== WAVE 0 — validation test scaffolds ===================== -->

<task type="auto">
  <name>Task 15-00-01: Wave 0 — create validation test scaffolds (objectives, export-window, event-response determinism)</name>
  <files>tests/objectives.test.ts, tests/determinism/export-window-determinism.test.ts, tests/determinism/event-response-determinism.test.ts</files>
  <read_first>
    - tests/determinism/trade-determinism.test.ts (chunkedRunJson helper, lines 19-45)
    - tests/determinism/finance-determinism.test.ts (command determinism + source audit at 60-69)
    - tests/determinism/determinism.test.ts (save/load replay block 29-42)
    - tests/missions.test.ts (stateful tracker style)
    - src/sim/objectives.ts (ObjectiveTracker/MetricSnapshot)
  </read_first>
  <action>
    Create the three missing test files as RED scaffolds pinned to the target APIs (they will fail typecheck/tests until Waves 2-3 implement, which is expected and how the Nyquist gate tracks them):

    1. tests/objectives.test.ts. Vitest (import { describe, it, expect } from 'vitest'). Unit-tests ObjectiveTracker directly:
       - sustain journey: with sustainChecks 2, two consecutive update() passes where every target is met → { won: true, sustained: 2 }; then a single miss resets sustained to 0.
       - thresholds: treasury/favor/annualExports each enforced when set and skipped when undefined; MetricSnapshot carries population/culture/prosperity/stability/treasury/favor/annualExports.
       - default: constructing a tracker without sustainChecks falls back to 3 monthly checks.
       - progress() returns sustained/sustainChecks, clamped 0..1.
    2. tests/determinism/export-window-determinism.test.ts. Copy the chunkedRunJson(seed, chunk, total) shape from trade-determinism.test.ts; drive a production city (buildProductionCity via tests/helpers.ts) + openTradeRoute('massilia') + setTradeOrder('massilia', 'pottery', 'export_above_reserve', { reserve: 2 }), cross the tick-360 year boundary (total > 360), and assert byte-identical getStateJson() for chunks 1/7/50 across seeds [1, 7, 1337]; assert the annualExports trailing-year count exposed by getDerived() is identical across the chunked runs AND across a getSaveData()→SimRunner.fromSaveData() round-trip.
    3. tests/determinism/event-response-determinism.test.ts. Drive the sim to a (seed, tick) where pickEvent fires (use a seed/tick where an event activates), call a valid respondEvent choice, then run→getSaveData→fromSaveData→continue and assert getStateJson() byte-identity plus identical constructionSpend and annualExports; include the no Math.random/Date.now/new Date source audit over the new/changed src files (mirror finance-determinism.test.ts:60-69).

    These scaffolds intentionally reference APIs delivered later (treasury/favor/annualExports on MetricSnapshot, getDerived().annualExports/constructionSpend/decomposition, respondEvent). Do NOT write them against the current (unimplemented) surface — write against the Phase-15 target surface so the implementing tasks flip them green.
  </action>
  <verify>
    <human-check>Wave 0 is complete when all three files exist and target the Phase-15 APIs; the file's tests are expected RED until their implementing task. The implementing tasks (15-02-01, 15-02-02, 15-03-02) then run these files green.</human-check>
    <automated>Runs after each implementing task; structural gate for Wave 0 itself: test -f tests/objectives.test.ts && test -f tests/determinism/export-window-determinism.test.ts && test -f tests/determinism/event-response-determinism.test.ts</automated>
  </verify>
  <acceptance_criteria>tests/objectives.test.ts, tests/determinism/export-window-determinism.test.ts, and tests/determinism/event-response-determinism.test.ts exist, use the Phase-15 target APIs, and are picked up by the vitest include glob (tests/**/*.test.ts).</acceptance_criteria>
  <done>Three new test files exist targeting the Phase-15 APIs (RED until their implementing waves) and are discovered by the vitest config include glob.</done>
</task>

<!-- ===================== WAVE 1 (RATE-01) — ratings decomposition ===================== -->

<task type="tracer">
  <name>Task 15-01-01: Tracer — end-to-end decomposed Culture through DerivedSnapshot (one path)</name>
  <files>src/sim/ratings.ts, src/sim/runner.ts, src/sim/advisors.ts, src/sim/config.ts, data/balance.ts, tests/ratings.test.ts, tests/data-catalog.test.ts, tests/runner-accessors.test.ts</files>
  <read_first>
    - src/sim/ratings.ts (computeTargets additive caps 25-44, clampRating 59-61, RatingDecomposition 64-69, decomposeRatings 75-103)
    - src/sim/happiness.ts:19-30 (weighted-sum-of-normalized-factors clamped 0..100 — the pattern to copy)
    - src/sim/runner.ts:129-148 (DerivedSnapshot interface), :836-892 (derivedSnapshot body + getDerived)
    - src/sim/advisors.ts:110-126 (ratings dataset)
    - tests/ratings.test.ts:5-15 (bare.culture === 10 encodes the additive-caps formula), tests/data-catalog.test.ts:75-86 (imports decomposeRatings)
    - data/balance.ts + src/sim/config.ts (balance-parity constraint, tests/balance-parity.test.ts:44-51)
  </read_first>
  <behavior>
    - Test 1: computeTargets for stats with education/entertainment/religion/festivals coverage raises Culture above the former 10-point additive-caps baseline and the value is clamped 0..100.
    - Test 2: bare vs rich stats keep monotonicity — rich.culture > bare.culture, bare.culture >= 0.
    - Test 3 (e2e path): after 20 ticks, getDerived().decomposition exists and culture factors reflect the buildings present (religion/entertainment/education buckets nonzero when such buildings exist).
  </behavior>
  <action>
    Wire ONE decomposed-rating path end-to-end (tracer slice) per decision D-01 — proven for Culture before the horizontal expansion in 15-01-02:

    1. Replace the additive-caps body of computeTargets (src/sim/ratings.ts:25-44) for the CULTURE factor with a weighted sum of normalized factors — education coverage, entertainment coverage, religion worship, festival boost, and a coverage-penalty term — following the houseHappiness weighted-sum + clamp shape (src/sim/happiness.ts:19-30): normalize each factor 0..1, sum weighted contributions, clamp 0..100 via the existing clampRating. Weights live as module-local consts in ratings.ts (agent's discretion allows this; do NOT add keys to data/balance.ts unless each key also gets a CONFIG.<key> consumer in src/, because tests/balance-parity.test.ts:44-51 fails otherwise — module-local consts dodge that gate and are the low-risk default).
    2. Reconcile the placeholder decomposeRatings(s, constructionSpend) (src/sim/ratings.ts:75-103): keep the exported signature and the bucket fields tests/data-catalog.test.ts:77-86 rely on (culture.religion, prosperity.economy, prosperity.construction) while extending RatingDecomposition with the new Culture factor buckets (education, entertainment, festival, coveragePenalty) that feed the same weighted formula — the decomposition and the rating must be ONE computation, never a second recompute (anti-pattern P1).
    3. Add decomposition: RatingDecomposition to the DerivedSnapshot interface (src/sim/runner.ts:129-148) and compute it inside derivedSnapshot() in the SAME pass that builds the culture factor (:836-887). getDerived() (:890-892) then surfaces it automatically — no new accessor required.
    4. Update tests/ratings.test.ts: keep the clampRating/tickRatings tests; intentionally update the bare.culture === 10 assertion (line 8) to the new weighted expectation and add decomposition-bucket assertions. Update tests/data-catalog.test.ts:77-86 to the new decomposition values (keep culture.religion/prosperity.construction field names so the test stays coherent).
    5. This task carries the tracer's end-to-end check: a runner-accessors.test.ts assertion that after ticking, getDerived().decomposition is present and culture factors respond to placed religion/entertainment/education buildings (vertical slice: ratings.ts → balance weights → DerivedSnapshot → getDerived()).
    Network effects: no getState() change — getState() (:1223-1248) keeps its separate economy computeRatings path, so goldens stay untouched.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/ratings.test.ts tests/data-catalog.test.ts tests/runner-accessors.test.ts -x</automated>
  </verify>
  <acceptance_criteria>getDerived().decomposition.culture reflects education/entertainment/religion/festival inputs and stays 0..100; the additive-caps placeholder for Culture is replaced by the weighted sum; updated ratings/data-catalog/runner-accessors tests pass; goldens unchanged.</acceptance_criteria>
  <done>The decomposed Culture path is wired end-to-end (ratings.ts → DerivedSnapshot.decomposition → getDerived()) with a weighted-sum formula, updated tests green, and getState()/goldens untouched.</done>
</task>

<task type="auto" reversibility="reversible" rating="reversible">
  <name>Task 15-01-02: Full four-rating decomposition + constructionSpend separation</name>
  <files>src/sim/ratings.ts, src/sim/runner.ts, src/sim/advisors.ts, tests/runner-accessors.test.ts, tests/ratings.test.ts</files>
  <read_first>
    - src/sim/runner.ts derivedSnapshot() (:836-887) — existing factor inputs it already computes (serviceCoverage health/literacy/entertainment, godWorship, festivalBoost, fireRisk/collapseRisk/crime, employment, taxes, wages, treasury)
    - src/sim/runner.ts:1106 (placeBuilding addExpense('other', def.cost)) and :771 (openTradeRoute addExpense('other', cost)) — constructionSpend capture sites
    - src/sim/advisors.ts:110-126 (ratings dataset consumer)
    - src/sim/ratings.ts decomposeRatings(s, constructionSpend) signature (already takes constructionSpend — D-02)
    - src/sim/types.ts DerivedSnapshot consumer contract (SimState frozen)
  </read_first>
  <behavior>
    - Test 1: placing a costly building raises getDerived().constructionSpend by exactly the build cost, and does NOT depress the Prosperity operating-balance sub-factor (construction separated).
    - Test 2: getDerived().decomposition exposes buckets for all four ratings (Culture as in tracer; Prosperity housing/patricians/operating-balance/unemployment/wages/trade/stability/debt; Stability fire/homelessness/crime/protests/health/supply/employment/collapses/residential-stability; Favor requests/debt/gifts/objectives/tribute/salary/performance) and each stays 0..100.
  </behavior>
  <action>
    Expand the weighted decomposition to all four ratings per decision D-01 and add the constructionSpend separation per D-02:

    1. ratings.ts: extend the weighted-sum-of-normalized-factors formula to Prosperity (average housing level, patrician count, operating balance, unemployment, wages, trade, long-term stability, debt), Stability (fire history, homelessness, crime, protests, health, supply, employment, collapses, residential stability), and Favor (requests fulfilled/ignored, debt, gifts, objectives, tribute, salary, performance). Each factor normalized 0..1, weighted, clamped 0..100; keep the mapping monotone in each factor. Keep weights as module-local consts in ratings.ts (same balance-parity stance as 15-01-01).
    2. runner.ts derivedSnapshot(): feed the richer factor inputs the snapshot already computes (serviceCoverage, godWorship, festivalBoost — mirror the favor computation at :878 — fireRisk, collapseRisk, crime, employment.jobs/employed, taxes, wages, treasury) into the ratings recomposition; where a per-spec factor has no live source yet (e.g., patrician count, protests, tribute), pass a neutral/zero baseline and keep the factor defined so the bucket always renders.
    3. Prosperity construction separation (D-02): add private constructionSpend = 0 on the runner; increment beside the treasury build-cost captures at placeBuilding (:1106 addExpense('other', def.cost)) and openTradeRoute (:771 addExpense('other', cost)). Thread constructionSpend into decomposeRatings' constructionSpend param so it lands ONLY in the Prosperity construction bucket — never in the operating-balance factor (one-time build cost is not double-penalized). It is replay-derivable from saveCommands (build/route-open commands), so no SaveData schema change (Pattern 1).
    4. Add constructionSpend: number to DerivedSnapshot (`if surfaced` branch of D-01) and return it from derivedSnapshot().
    5. advisors.ts: extend the ratings advisor dataset (:116-125) to surface decomposition + constructionSpend as a pure transform of getDerived() — no second recompute.
    6. Extend tests/runner-accessors.test.ts (getDerived().decomposition for all four ratings; constructionSpend increases with a build and does not hit the Prosperity operating-balance factor) and tests/ratings.test.ts (Prosperity/Stability/Favor weighted expectations).
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/ratings.test.ts tests/runner-accessors.test.ts tests/data-catalog.test.ts -x</automated>
  </verify>
  <acceptance_criteria>All four ratings decompose via getDerived() into per-spec factor buckets and stay 0..100; constructionSpend is tracked, surfaced, and excluded from Prosperity's operating-balance factor; goldens + balance-parity + military gates green.</acceptance_criteria>
  <done>All four ratings decompose into per-spec buckets (0..100) via getDerived().decomposition; constructionSpend is accumulated and separated from Prosperity's operating balance; regression gates green.</done>
</task>

<!-- ===================== WAVE 2 (RATE-02) — objectives & win conditions ===================== -->

<!-- Runs BEFORE 15-02-01: 15-02-01 wires the annualExports accessor into the ObjectiveTracker snapshot; both touch runner.ts, so they are sequential. -->

<task type="auto">
  <name>Task 15-02-02: Rolling-360 annualExports window from live route exports</name>
  <files>src/sim/runner.ts, src/sim/trade.ts, tests/runner-accessors.test.ts, tests/determinism/export-window-determinism.test.ts</files>
  <read_first>
    - src/sim/trade.ts:167-189 (consumeQuota/usedPerGood, resetAnnualQuotas), :259-262 (applyPriceEvent)
    - src/sim/runner.ts:436-440 (tickTradeSystem year + resetAnnualQuotas call), :687-690 (dispatchTradeGood → consumeQuota), :484-504 (tradePrices map + ensureTradePriceState)
    - tests/determinism/export-window-determinism.test.ts (Wave 0 scaffold)
  </read_first>
  <behavior>
    - Test 1: with a pottery export order active, running past the tick-360 year boundary resets the quota but the rolling annualExports count (trailing 360 ticks) stays correct — identical across chunked runs (chunks 1/7/50) and a save/load round-trip (export-window-determinism.test.ts).
    - Test 2: getDerived() exposes annualExports as a number (aggregate loads over the trailing year).
  </behavior>
  <action>
    Build the trailing-360-tick annual-export window per decision D-03 (annualExports = loads exported over the trailing year, deterministic, no wall-clock):

    1. Derive the window from the existing per-good export tally: sum route.usedPerGood[good] across enabled routes (consumeQuota/usedPerGood — src/sim/trade.ts:167-171; every physical export hits consumeQuota at runner.ts:690/722). Because resetAnnualQuotas (:439, trade.ts:179-189) wipes usedPerGood on year change, snapshot the just-elapsed year's totals into a per-year bucket/ring keyed by Math.floor(tickCount / 360) immediately before the reset, so the trailing-year window survives the wipe (Pattern 4, research assumption A3 — never a lifetime accumulator).
    2. Expose the window as getDerived().annualExports (aggregate loads) as an additive field on DerivedSnapshot; keep it OUT of getState() so golden fixtures and the economy computeRatings path stay untouched.
    3. Keep it replay-money-clean: the window is computed from live trade state + tick, which fromSaveData reconstructs exactly — no SaveData schema change, no new command.
    4. Test wiring: this task flips the Wave 0 export-window-determinism.test.ts green; also assert annualExports presence in tests/runner-accessors.test.ts.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/determinism/export-window-determinism.test.ts tests/runner-accessors.test.ts -x</automated>
  </verify>
  <acceptance_criteria>annualExports measures the trailing-360-tick export total (pottery etc.) with the option to track per-good; identical across chunked ticks and save/load; resets deterministically by year; never uses wall-clock or touches getState().</acceptance_criteria>
  <done>annualExports is a deterministic trailing-360-tick window computed from live trade state, exposed via getDerived(), identical across chunked ticking and save/load.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 15-02-01: Sustained objectives — month-cadence tracker, treasury/favor/exports targets, mission unify</name>
  <files>src/sim/objectives.ts, src/sim/runner.ts, src/sim/missions.ts, data/missions.ts, data/validate.ts, tests/objectives.test.ts, tests/missions.test.ts, tests/runner-accessors.test.ts</files>
  <read_first>
    - src/sim/objectives.ts:8-43 (ObjectiveTarget/MetricSnapshot/ObjectiveTracker.update ok-chain)
    - src/sim/runner.ts:428-434 (tickDerivedSystems — every-tick update = BUG 1), :1043-1048 (getObjectiveProgress — re-update on read = BUG 1 double-count), :1050-1072 (tickMissionSystem instant-complete), :304/:319/:325 (existing month-cadence gates to mirror)
    - src/sim/missions.ts:24-59 (startMission/tickMission instant-win), data/missions.ts:5-40 (MissionDef)
    - data/validate.ts:129-133 (missions validation to extend)
    - tests/objectives.test.ts (Wave 0 scaffold), tests/missions.test.ts, tests/runner-accessors.test.ts:190-197 (objective integration)
  </read_first>
  <behavior>
    - Test 1: ObjectiveTracker with sustainChecks 3 — exactly 3 consecutive monthly passes yield won=true; a miss mid-journey resets sustained to 0.
    - Test 2: treasury/favor/annualExports thresholds enforced when defined, skipped when undefined.
    - Test 3: default sustainChecks === 3 when omitted.
    - Test 4 (runner, BUG 1): getObjectiveProgress() is a pure read — calling it repeatedly between month boundaries never advances sustained (no double-count); an objective with sustainChecks 3 wins only after 3 month boundaries (tickCount % 40 === 0), not 3 ticks.
    - Test 5 (mission): a mission wins only after all targets (incl. new treasury/favor/annualExports) are held for the sustain period; shortfalls stay visible; time-limit failure preserved.
  </behavior>
  <action>
    Extend and rewire the sustained win-condition path per decision D-03, fixing the two sustain bugs the research identified (BUG 1 at runner.ts:431-433 + :1046):

    1. src/sim/objectives.ts: add favor?, treasury?, annualExports? to ObjectiveTarget (:8-15) and treasury, favor, annualExports to MetricSnapshot (:17-22); append them to the ok-chain in ObjectiveTracker.update (:31-35) exactly like the existing four (undefined = not required). Add a module default of 3 for sustainChecks when the target omits it. Keep sustained as the only mutable member so progress() stays a pure projection.
    2. runner.ts tickDerivedSystems (:428-434): gate the objective update on the month cadence — if (this.tickCount % 40 === 0 && this.objective) — and pass treasury/favor/annualExports (annualExports from the 15-02-02 accessor) along with population/culture/prosperity/stability from the snapshot. This is what makes sustainChecks count months, not ticks (contrast the existing month gates at :304/:319/:325).
    3. runner.ts getObjectiveProgress (:1043-1048): make it a PURE read — store the last monthly { won, sustained } returned by the gated update and return that without calling this.objective.update() again. This eliminates the double-count on every read.
    4. Mission unify (D-03): extend data/missions.ts MissionDef (:5-21) with targetFavor?, targetTreasury?, targetAnnualExports?, sustainChecks? (default 3) — keep every existing MISSIONS/EXTRA_MISSIONS entry valid (their new fields are undefined → not required). Rewire tickMissionSystem (runner.ts:1050-1072) to drive the mission from a sustained ObjectiveTracker (built from the mission's MissionDef targets) on the month cadence so a mission completes ONLY after all targets are held for the sustain period; preserve the time-limit failure path; keep shortfalls visible (getMission reports not-yet-complete, not failed, while under threshold). missions.ts tickMission may be superseded by the tracker — keep the exports used by tests or update tests consistently.
    5. Extend data/validate.ts missions loop (:129-133): sustainChecks must be a positive integer when present; targetAnnualExports non-negative; new fields finite numbers.
    6. Test wiring: flip the Wave 0 tests/objectives.test.ts green; extend tests/missions.test.ts (sustain-period + new-field coverage, keeping time-limit/failure semantics) and tests/runner-accessors.test.ts (month-cadence sustain + pure-read getObjectiveProgress, mirroring :190-197).
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/objectives.test.ts tests/missions.test.ts tests/runner-accessors.test.ts tests/data-catalog.test.ts -x</automated>
  </verify>
  <acceptance_criteria>A mission/objective requires population, the four ratings, treasury, favor, and annual exports with targets held for the required sustain period (default 3 months) before victory; sustain counting is month-cadence and single-counted (getObjectiveProgress is a pure read); shortfalls remain visible; time-limit failure preserved; catalog validates cleanly.</acceptance_criteria>
  <done>Objectives/missions win only after all targets (incl. treasury/favor/annualExports) are held for the sustain period (default 3 months) on the month cadence; getObjectiveProgress is a pure single-counting read; catalog validates.</done>
</task>

<!-- ===================== WAVE 3 (RATE-03) — event responses ===================== -->

<task type="auto">
  <name>Task 15-03-01: ~25-event catalog with responses + validation</name>
  <files>data/events.ts, src/sim/events.ts, data/validate.ts, tests/events.test.ts, tests/data-catalog.test.ts</files>
  <read_first>
    - data/events.ts:7-25 (EventDef shape), :27-76 (existing 8 events — must stay byte-identical)
    - src/sim/events.ts:28-58 (pickEvent weighted roll, applyEvent), :60-75 (eventDuration/eventSustainMsg/eventFinalMsg signatures to preserve)
    - data/validate.ts:125-127 (events loop), :129-133 (missions loop)
    - data/requests.ts entryById (id-lookup/validation shape for response resolution)
    - scripts/check-military.mjs FORBIDDEN_TOKENS (DATA-03): military, army, legion, soldier, fort, barracks, weapon, enemy, invasion, combat, damageFromUnit
  </read_first>
  <behavior>
    - Test 1: EVENTS now has the full ~25 non-military types with cause, duration, effects, initial/update/final messages, severity.
    - Test 2: response resolution — a valid choiceId for an event returns the response object; an unknown choiceId returns undefined (pure helper).
    - Test 3: validateCatalogs() === [] still holds; response ids are unique per event, labels non-empty, effects finite.
  </behavior>
  <action>
    Expand the event catalog and add a deterministic response surface per decision D-04:

    1. data/events.ts: add responses?: EventResponse[] to EventDef, each response being { id, label, effect: { culture?, prosperity?, stability?, favor?, treasuryCost?, conclude?, severity? } }. Keep the existing 8 events (fire, collapse, earthquake, flood, pestilence, riot, good_harvest, festival) byte-identical — tests depend on their schedule behavior. Add the ~25 non-military spec events: drought, exceptional_harvest, agricultural_plague, flood, earthquake, fire, epidemic, regional_growth, price_fall, price_rise, congested_route, naval_delay, strike, spontaneous_festival, marble_discovery, fertility_reduction, special_merchant, urgent_request, donation, administrative_visit, regional_shortage, exceptional_demand, industrial_accident, collapse, well_contamination, heat_wave, severe_winter — each with cause, durationTicks, effect (ratings deltas; price_* via a priceModify field for Wave-3 wiring), message, sustainMsg, finalMsg, severity, and where the spec implies a player choice, a responses[] array. Event names MUST avoid the FORBIDDEN_TOKENS above (DATA-03 military-absence gate).
    2. src/sim/events.ts: add a pure response resolver — resolveResponse(eventId, choiceId): EventResponse | undefined — indexing EVENTS[eventId].responses by choice id (mirror data/requests.ts entryById); no mutation so the runner owns replay. Preserve hash/pickEvent/applyEvent/eventDuration/eventSustainMsg/eventFinalMsg signatures. Accept the totalWeight shift from adding ~17 events (nothing pins today's schedule; research P4) and add a pinned schedule test for one fixed seed+tick so the new expanded schedule is frozen for the future.
    3. data/validate.ts: under the events loop (after :126) validate responses — ids unique per event, non-empty labels, finite numeric effects, references resolve. Under the missions loop add sustainChecks = positive integer when present, targetAnnualExports ≥ 0.
    4. Extend tests/events.test.ts (resolveResponse valid/invalid; pinned pickEvent schedule) and tests/data-catalog.test.ts (~25 event keys, unique response ids across the catalog, validateCatalogs() === []).
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/data-catalog.test.ts tests/events.test.ts -x && npm run check:military</automated>
  </verify>
  <acceptance_criteria>The ~25-event non-military catalog validates cleanly (validateCatalogs() === []) with the original 8 events byte-identical; EventDef.responses resolves via a pure helper; military-absence gate green; pinned schedule test freezes the new expanded pickEvent output.</acceptance_criteria>
  <done>The ~25-event non-military catalog (original 8 preserved) with EventDef.responses validates cleanly; resolveResponse is pure; military gate and pinned schedule test green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 15-03-02: Live event effects + respondEvent SaveCommand</name>
  <files>src/sim/runner.ts, src/sim/types.ts, src/sim/trade.ts, src/sim/events.ts, tests/events.test.ts, tests/runner-accessors.test.ts, tests/determinism/event-response-determinism.test.ts</files>
  <read_first>
    - src/sim/runner.ts:281-300 (event lifecycle block — effects computed with hardcoded inputs then discarded = BUG 2), :1642 (activeEvent record), :1407-1428 (donateToGovernor full command lifecycle to copy), :2312-2339 (applyCommand exhaustive dispatch), :484-504 (tradePrices map)
    - src/sim/types.ts:75-86 (SaveCommand union), :88-100 (SaveData)
    - src/sim/trade.ts:259-262 (applyPriceEvent)
    - src/sim/events.ts (applyEvent/eventDuration/eventSustainMsg/eventFinalMsg + resolveResponse from 15-03-01)
    - tests/determinism/event-response-determinism.test.ts (Wave 0 scaffold), tests/events.test.ts, tests/runner-accessors.test.ts:117-125 (event lifecycle integration)
  </read_first>
  <behavior>
    - Test 1 (events): resolveResponse('drought', 'spend_now') returns that response with its treasuryCost; an unknown choiceId returns undefined.
    - Test 2 (runner): while an event is active, getDerived() ratings respond to the event's effect; after conclusion they return to baseline (modifier removed).
    - Test 3 (runner): respondEvent with a valid choice applies its treasury cost through the ledger and (for a conclude response) ends the event early; an unknown/inactive event or unknown choiceId is a no-op with no state change.
    - Test 4 (determinism): run → respond → save → load → getStateJson() byte-identical; constructionSpend/annualExports replay identical (event-response-determinism.test.ts).
  </behavior>
  <action>
    Make events actually affect the city and expose a replayable response command (decisions D-04; fixes BUG 2 at runner.ts:296):

    1. Live lifecycle effects (runner.ts:281-300): replace the hardcoded applyEvent input { culture: 10, prosperity: getState().ratings.prosperity, stability: 10, favor: 10 } (:296) with live DerivedSnapshot ratings; keep an active-event rating modifier applied as an offset inside derivedSnapshot() while activeEvent is non-null and removed at conclusion (initial effect at activation, sustain messaging at half-duration, final message on conclusion — all preserved). NEVER write event effects into getState() (:1223-1248, economy computeRatings + goldens — Pitfall 6/A1). price_rise/price_fall events adjust pricing via applyPriceEvent (trade.ts:259-262) on the runner's EXISTING trade price states (:484-504) only — a no-op when a city/good price state does not exist, so golden runs with no routes cannot shift treasury (Pitfall 8).
    2. respondEvent command surface (copy the donateToGovernor lifecycle runner.ts:1407-1428):
       - types.ts SaveCommand union (:75-86): add | { kind: 'respondEvent'; eventId: string; choiceId: string }. Adding the branch forces applyCommand to fail typecheck until the dispatch branch is added — that is the intended wiring gate.
       - runner.ts public respondEvent(eventId, choiceId): { ok: boolean; error?: string } — paused → enqueue; reject with no state change + commandLog entry ('no-active-event' / 'unknown-choice') when activeEvent is null, eventId !== activeEvent.id, or choiceId not in EVENTS[eventId].responses (ASVS V5 input validation, mirrors checkPlacement rejection). Accept: apply the choice effect — treasury cost via Treasury.addExpense('other'|'event', cost) with funds validation ('not-enough-money'); rating deltas folded into the active-event modifier (derived = null to recompute); conclude → activeEvent.remaining = 0 so the final message fires next tick. Record the choice into an eventResponseByEvent: Record<string,string> (construct-init) so the lifecycle shapes the post-response effect deterministically even when the event re-fires during replay. Push { kind: 'respondEvent', eventId, choiceId } to saveCommands + commandLog.
       - applyCommand (:2312-2339): add } else if (cmd.kind === 'respondEvent') { runner.respondEvent(cmd.eventId, cmd.choiceId); }.
       - Replay semantics (Pitfall 7): fromSaveData replays commands at tick 0 before ticking — the response is recorded into eventResponseByEvent and its treasury cost applied early; because the cost is ledger-commutative and the rating modifier is derived-only (not in getStateJson), run→save→load yields a byte-identical getStateJson() per the Wave 0 determinism scaffold. Follow the established donateToGovernor early-replay convention; do not add a SaveData schema change.
    3. Test wiring: flip the Wave 0 event-response-determinism.test.ts green; extend tests/events.test.ts (response resolution, early conclusion, treasury cost) and tests/runner-accessors.test.ts (respondEvent integration — valid mutates outcome, invalid is a no-op; events live-effect + baseline-after-conclusion). If any golden shifts, re-check that event effects stay derived-only (Pitfall 8/6).
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/events.test.ts tests/runner-accessors.test.ts tests/determinism/event-response-determinism.test.ts -x</automated>
  </verify>
  <acceptance_criteria>Active events move live derived ratings (initial/sustain/final lifecycle) and clear on conclusion; respondEvent is a replayable SaveCommand whose valid choice mutates outcome (treasury cost / severity / early conclusion) and whose invalid choices are rejected with no state change; run→respond→save→load is byte-identical; goldens untouched.</acceptance_criteria>
  <done>Active events apply real effects to live derived ratings and clear on conclusion; respondEvent is a replayable SaveCommand with validated choices and byte-identical save/load replay; goldens untouched.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Player action → sim core | respondEvent(eventId, choiceId) is untrusted input crossing into a deterministic single-player sim — the only new external-facing command surface this phase. |
| Data catalogs → load-time gate | data/events.ts + data/missions.ts are untrusted-as-checks inputs validated once at construction (`validateCatalogs`, runner.ts:208-211). |
| Expanded catalog → DATA-03 CI | event names cross the military-absence scanner (scripts/check-military.mjs) over src/ + data/. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-15-01 | Tampering | respondEvent (runner.ts) — unknown eventId / inactive event / unknown choiceId mutating state | high | mitigate | Reject with no-op + commandLog entry BEFORE any effect application (mirrors checkPlacement/donateToGovernor validation); only valid active-event choices reach effect application (V5, task 15-03-02). |
| T-15-02 | Tampering | data/events.ts expanded catalog — military content in new event names | medium | mitigate | Keep every new event name clear of FORBIDDEN_TOKENS (military/army/legion/soldier/fort/barracks/weapon/enemy/invasion/combat/damageFromUnit); CI gate `npm run check:military` must stay green (task 15-03-01). |
| T-15-03 | Tampering | data/events.ts + data/missions.ts — corrupt fields (responses referencing missing ids, non-finite effects, negative annualExports, bad sustainChecks) breaking determinism | medium | mitigate | Extend validateCatalogs() in data/validate.ts (events responses: unique ids, non-empty labels, finite effects; missions: positive-integer sustainChecks, non-negative targetAnnualExports); data-catalog.test.ts asserts validateCatalogs() === [] (tasks 15-02-01, 15-03-01). |
| T-15-04 | Tampering | respondEvent replay — a response that mutates outcome but is not a SaveCommand causes save→load divergence | high | mitigate | Model respondEvent as a SaveCommand kind end-to-end (types.ts union + applyCommand branch + push-on-accept) and lock with the Wave 0 event-response-determinism.test.ts (run→respond→save→load byte-identity; task 15-03-02). |
| T-15-05 | Tampering | getState() golden regression — event/rating effects leaking into the snapshot serialization | high | mitigate | Keep event rating modifiers + decomposition + constructionSpend + annualExports out of getState() (separate economy computeRatings path); goldens byte-intact enforced by tests/golden/golden.test.ts (tasks 15-01-01/02, 15-02-02, 15-03-02). |
| T-15-SC | Tampering | npm/pip/cargo installs | low | accept | Accepted: this phase installs no packages (research Package Legitimacy Audit N/A; zero-dependency sim-core convention); if a later phase adds one it re-enters the gate. |

## Mitigation Notes for ASVS Level 1
- V5 Input Validation is the only applicable control: respondEvent rejects unknown/inactive ids and unknown choices with no state change; catalogs are validated at load time and by data-catalog.test.ts.
- V2/V3/V4/V6 are N/A — local offline single-player deterministic sim with no identities, sessions, access control, or cryptographic use; `hash(seed, tick)` is deterministic mixing for simulation ordering, not a security primitive.
</threat_model>

<verification>
- After every task commit: run that task's `<automated>` command (all < 60s).
- After every wave: `cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` (full 105-file suite green; baseline 751 passing).
- After every wave: `npm run check:military` green; `git diff --stat tests/golden` empty (goldens untouched); `tests/balance-parity.test.ts` green (any new data/balance.ts key has a CONFIG.<key> consumer — the plan default keeps rating weights module-local to avoid the gate).
- Wave 3 close: full suite + military + typecheck all green before /gsd-verify-work.
- Determinism guarantees: `constructionSpend`, `annualExports`, active-event modifiers, and `respondEvent` records must all be replay-derivable from saveCommands + tickCount (fromSaveData contract) — asserted by the two Wave 0 determinism files.
</verification>

<success_criteria>
1. Ratings (Culture/Prosperity/Stability/Favor) decompose into per-spec sub-factors via getDerived().decomposition; each stays 0-100; Prosperity treats construction cost separately (constructionSpend lands only in the construction bucket, never the operating-balance factor).
2. Objectives/win conditions require targets sustained for the required period: the month-cadence ObjectiveTracker (default 3 months) with treasury/favor/annualExports support; missions win only when all targets are held; getObjectiveProgress is a pure read (no double-count); annualExports is a deterministic trailing-360-tick window.
3. Events are deterministic from seed and expose response choices that change outcomes: ~25-event catalog (original 8 preserved) with responses[], real (non-logged) lifecycle effects on live derived ratings, and a replayable respondEvent SaveCommand — all without touching getState() goldens, balance parity, or the military gate.
</success_criteria>

<output>
Create `.planning/phases/15-ratings-objectives-events/15-SUMMARY.md` when the phase is done and verified (per the execute-plan workflow / summary template).
</output>


