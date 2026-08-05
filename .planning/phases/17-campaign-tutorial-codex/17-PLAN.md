---
phase: 17-campaign-tutorial-codex
plan: 17-plan
type: execute
wave: 0
depends_on: [15-PLAN, 16-PLAN]
files_modified:
  - data/missions.ts
  - data/validate.ts
  - src/sim/types.ts
  - src/sim/runner.ts
  - src/sim/campaign.ts
  - src/sim/missionMaps.ts
  - tests/determinism/campaign-determinism.test.ts
  - tests/winnability-probe.test.ts
  - tests/unit/campaign.test.ts
  - tests/missions.test.ts
  - tests/runner-accessors.test.ts
  - tests/data-catalog.test.ts
autonomous: true
requirements: [CAMPAIGN-01, CAMPAIGN-02, CAMPAIGN-03]

estimate:
  tokens: 135000
  raw_tokens: 135000
  tasks: 8
  confidence: low

must_haves:
  truths:
    - "CAMPAIGN-01: the 10 missions follow the spec arc (riverside foundations → provincial capital, re-using the existing ids tutorial/small_town/thriving_city/grand_city + the 6 EXTRA_MISSIONS in campaignMissions() order); every mission defines its scope — map (terrain layout string + preplaced starter buildings), objectives (sustained ObjectiveTracker targets incl. favor/treasury/annualExports), products (goods-chain emphasis), routes (open city ids + per-good orders/quotas) and modifiers (starting treasury credit, policy, time limit) — additively on MissionDef so an all-undefined mission stays valid; the map/products/routes/modifier data is validated at load time for BOTH MISSIONS and EXTRA_MISSIONS."
    - "CAMPAIGN-01: mission start is a replayable SaveCommand — startMission(id) pushes {kind:'startMission'} and its whole effect (state + modifiers + preplaced buildings + opened routes) reconstructs byte-identically through getSaveData()/fromSaveData(save, missionMap), so an in-mission save/load keeps getMission() and mission progress; the time-limit failure (year − mission.year > timeLimitYears in tickMissionSystem) counts from mission START — mission.year = Math.floor(tickCount/360) at start, never 0 — so a time-limited mission started on an already-ticked runner does not instantly fail."
    - "CAMPAIGN-01: campaign progression is sequential — mission N+1 (next in campaignMissions() order) unlocks only after mission N is won via the sustained ObjectiveTracker on the month cadence; a running/incomplete mission blocks a different mission id, a fresh runner may start any single mission (sandbox), and the gate is enforced only on live calls (skipped during replay, precedent: placeBuilding's gov gate) so replayed sequences reconstruct exactly."
    - "CAMPAIGN-02: tutorial steps are triggered by OBSERVED state, not a rigid sequence — each step's eligibility is a pure total function over DerivedSnapshot + per-house live state (laborConnected, workersRequired, level, desirability, food/water/labor cooldowns, services, godAccess, foodInventory), total over empty cities, with NO Math.random/Date.now/new Date; the introduction steps (roads/housing/water) stay trivially-eligible in the fixed ordered seed (nextTutorialPrompt unchanged), and after the introduction only state-triggered cause steps appear."
    - "CAMPAIGN-02: a step is shown with short text + expanded explanation + a codex entry reference + show-where highlight (the building ids that triggered it); 'don't show again' is a replayable {kind:'dismissTutorialStep'} SaveCommand whose dismissed set reconstructs from replayed commands, so a dismissed step does not re-eligibilize across save/load; the sim exposes getTutorial() (current, eligible, dismissed) as a pure derived accessor for Phase 18's UI."
    - "CAMPAIGN-03: the codex covers every category — buildings, products, chains, services, housing, walkers, desirability, trade, finance, ratings, religion, risks, shortcuts — with per-entry description, howItWorks, inputs, outputs, workers, cost, hints, requirements, and relatedLinks, derived from the data catalogs (buildings/commodities/walkers/housing/gods/trade/religion/events + ratings weights) rather than hand-copied copy; getCodex() exposes the entry list plus a searchable lookup by id/kind; derivedSnapshot's codex count stays filtered to the four original kinds."
    - "Winnability + gates: every mission's targets sit inside the verified mechanic ceilings (ratings ≤ 85 only on the final mission with a long limit, annualExports ≤ 100, favor ≤ 80, treasury ≤ 15k) and the winnability probe test scripts each mission's city (reusing buildFoodCity/buildProductionCity and the mission's own map) and asserts each target ceiling is reachable within timeLimitYears — mission 10 eased to 80/80/80 if the 85/85/85 probe fails; the full suite (unit/integration/determinism/golden/property), typecheck, and check:military gate are green, with no golden fixture regeneration (missions/tutorial/codex never enter SimState/goldens)."
  artifacts:
    - path: data/missions.ts
      provides: "MissionDef additive fields map?/products?/routes?/modifiers?; 10 entries rethemed to the spec arc (ids kept) with per-mission map layout strings, products, routes (massilia/caralis/londinium/tarraco), modifiers (startingTreasuryCredit, policy, timeLimit), and targets tuned to verified ceilings"
      min_lines: 60
    - path: data/validate.ts
      provides: "missions validation loop extended over MISSIONS AND EXTRA_MISSIONS: map width/height positive ints + layout grid shape + legend chars ⊆ TileType, products ⊆ COMMODITIES, routes[].cityId ∈ TRADE_CITIES + finite quotas, modifiers finite; existing target checks preserved"
      min_lines: 25
    - path: src/sim/missionMaps.ts
      provides: "pure layout factory missionMap(def) → SimMap | null parsing MissionMapDef.layout string via SimMap.fromLayout (deterministic, no RNG), mirroring tests/helpers.ts layout builders"
      min_lines: 40
    - path: src/sim/types.ts
      provides: "SaveCommand union += {kind:'startMission'; id:string} and {kind:'dismissTutorialStep'; step:string}; CodexKind/CodexEntry and TutorialStep shapes stay in campaign.ts (no SaveData schema change)"
      min_lines: 4
    - path: src/sim/campaign.ts
      provides: "enriched CodexEntry (9 new kinds + description/howItWorks/inputs/outputs/workers/cost/hints/requirements/relatedLinks) built from catalogs; tutorial step catalog with pure cause-detection predicates over DerivedSnapshot + house views; nextTutorialPrompt/tutorialText kept as the ordered seed"
      min_lines: 220
    - path: src/sim/runner.ts
      provides: "startMission rewrite (year = floor(tickCount/360), sequential gate skipped during replay, suppressCommandRecording-guarded modifiers/preplace/routes, SaveCommand push), dismissTutorialStep, getTutorial()/getCodex()/getCampaignProgress()/getMissionProgress() derived accessors, applyCommand branches for the two new kinds"
      min_lines: 90
    - path: tests/determinism/campaign-determinism.test.ts
      provides: "startMission + dismissTutorialStep replay byte-identity (chunked 1/7/50 mirror of finance-determinism + save/load from event-response-determinism) and the no-Math.random/Date source audit over campaign.ts/missionMaps.ts"
      min_lines: 70
    - path: tests/winnability-probe.test.ts
      provides: "one it() per mission (10): build the mission city (helpers + mission map), startMission(id), tick to timeLimitYears*360, assert every target ceiling is reachable at least transiently; explicitly pins missions 4/8/10"
      min_lines: 90
    - path: tests/unit/campaign.test.ts
      provides: "codex field completeness + per-category presence + lookup(id,kind) + catalog-equality (farm cost === BUILDINGS.farm.cost); tutorial predicate scenario runners + empty-city totality; dismissTutorialStep save/load round-trip"
      min_lines: 120
    - path: tests/missions.test.ts
      provides: "progression gate (N+1 blocked until N complete, then allowed), start-year fix (time-limited mission on a 3000+ tick runner not instantly failed), map/modifiers/routes applied on start, save/load mission survival; optional-target assertion rewritten to allow present targets"
      min_lines: 90
    - path: tests/runner-accessors.test.ts
      provides: "getTutorial()/getCodex() shaped returns, getMissionProgress()/getCampaignProgress(), mission save/load round-trip with missionMap via fromSaveData(save, map)"
      min_lines: 50
  key_links:
    - "startMission (runner) → tickMissionSystem (runner:1509): the year=0 landmine — startMission must record mission.year = Math.floor(tickCount/360) or any time-limited mission started on an already-ticked runner fails at the next month gate; verified by the start-year regression test (17-01-01)."
    - "startMission → applyCommand replay: if mission sub-effects (modifiers/preplaced buildings/routes) run through command-recording public methods on BOTH the live call and replay, saveCommands self-duplicate and grow on every save→load→save cycle — sub-effects must run under a suppressCommandRecording guard so the single {kind:'startMission'} command is the complete deterministic record; the sequential gate must be skipped during replay (precedent runner.ts:1565 `!this.replaying && gov`)."
    - "startMission → SaveCommand union (types.ts:75-89): without the command, mission state lives only in the runner-private `this.mission` and is lost on save/load (SimState/SaveData carry no mission) — the command kind + exhaustive applyCommand branch (runner.ts:2814-2847) make it lossless and a forgotten kind a compile error."
    - "campaign.ts tutorial predicates → DerivedSnapshot (runner.ts:1314-1330) + BuildingState.house (types.ts:120-140): predicates must be pure total functions (guard empty houses — RESEARCH DoS threat T-17-05) over live state only, never wall-clock; the runner builds the per-house predicate input from BuildingInstance (laborConnected/workersRequired live on the building, not the house sub-object)."
    - "dismissTutorialStep → dismissed set: the runner-private dismissed set must be reconstructed purely from replayed {kind:'dismissTutorialStep'} commands so getTutorial() is deterministic from state + commands — never serialized into SaveData."
    - "buildCodex → data catalogs: every enriched field maps to an existing catalog field (buildings cost/workers/produces/consumes/footprint/spawns/required*, commodities category/storage/prices/houseGood/tradable, walkers service/spawnedBy, housing requires/requiresGoods/desirability, GODS, TRADE_CITIES, FESTIVAL_TIERS, events, ratings weights) or is omitted — hand-copied copy rots when catalogs move; derivedSnapshot().codex (runner.ts:1312,1325) must keep the four-kind count filter so the golden/fixture surface is untouched."
    - "data/missions.ts new fields → data/validate.ts: the missions loop currently only iterates MISSIONS (validate.ts:171) — map/products/routes/modifiers must be validated for BOTH MISSIONS and EXTRA_MISSIONS (cross-catalog id checks: products ⊆ COMMODITIES, routes[].cityId ∈ TRADE_CITIES like the trade loop validate.ts:126-130) or a bad mission crashes at construction."
---

<objective>
Deliver Phase 17 — turn the 10 already-defined mission entries into a real, sequential, fully-winnable campaign (CAMPAIGN-01), replace the hardcoded ordered tutorial with a state-observing contextual tutorial that explains the real causes over live sim data (CAMPAIGN-02), and enrich the count-only codex into a full data-derived encyclopedia covering every category with per-entry fields and links (CAMPAIGN-03).

Purpose: this is a **code-only wiring + data extension** phase over existing tested primitives — the win engine (`tickMissionSystem` → sustained `ObjectiveTracker`, month cadence) is DONE; the real work is (a) making `startMission` replayable and correct (it is a stub today: no map loading, no modifiers/routes, no progression gating, hardcoded `year: 0`, and it is NOT a SaveCommand so mission state is lost on save/load), (b) writing pure cause-detection tutorial predicates over the verified live state surface (`DerivedSnapshot` + `BuildingState.house` + `laborConnected`), and (c) enriching `buildCodex()` from the data catalogs plus the nine missing categories. The high-risk items are the time-limit landmine (mission.year must be the start year), the replay determinism of startMission's sub-effects, and per-mission target tuning inside verified mechanic ceilings (winnability probe).
Output: extended `MissionDef` + validated mission data, `startMission`/`dismissTutorialStep` SaveCommands with exhaustive dispatch, `getTutorial()`/`getCodex()`/`getCampaignProgress()`/`getMissionProgress()` derived accessors, the enriched codex + tutorial predicate catalog, a new `missionMaps.ts` layout factory, and 2 new test files + 3 extended test files (incl. the winnability probe).
</objective>

<execution_context>
@/Users/filipe.esch/projects/pessoal/opencaesar/.opencode/gsd-core/workflows/execute-plan.md
@/Users/filipe.esch/projects/pessoal/opencaesar/.opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/17-campaign-tutorial-codex/17-CONTEXT.md
@.planning/phases/17-campaign-tutorial-codex/17-RESEARCH.md
@.planning/phases/17-campaign-tutorial-codex/17-PATTERNS.md
@.planning/phases/17-campaign-tutorial-codex/17-VALIDATION.md

# Sim-core seams (read before implementing the matching wave):
@src/sim/runner.ts
@src/sim/types.ts
@src/sim/campaign.ts
@src/sim/missions.ts
@src/sim/objectives.ts
@src/sim/map.ts
@src/sim/finance.ts
@data/missions.ts
@data/validate.ts
@data/trade.ts
@data/commodities.ts
@data/buildings.ts
@data/walkers.ts
@data/housing.ts
@data/religion.ts
@data/events.ts

# Tests (read before editing the matching wave scaffolds):
@tests/missions.test.ts
@tests/runner-accessors.test.ts
@tests/unit/campaign.test.ts
@tests/helpers.ts
@tests/determinism/finance-determinism.test.ts
@tests/determinism/event-response-determinism.test.ts
@tests/data-catalog.test.ts
</context>

# Execution order (waves are sequential; tasks within a wave run in listed order — shared files force sequential edits):

- **Wave 0** — validation test scaffolds: NEW `tests/determinism/campaign-determinism.test.ts` (startMission + dismissTutorialStep replay byte-identity) and NEW `tests/winnability-probe.test.ts` is deferred to Wave 3 (it needs the FINAL tuned mission targets — dispatch explicitly places it last; coverage is still full). Extend `tests/unit/campaign.test.ts` (tutorial predicate scenarios + codex coverage + dismiss round-trip), `tests/missions.test.ts` (progression gate, start-year fix, map/modifier application, save/load survival), and `tests/runner-accessors.test.ts` (getTutorial/getCodex/getMissionProgress/getCampaignProgress + mission save/load round-trip). Extensions and the new determinism file are RED until their implementing waves (write them against the target API surface).
- **Wave 1 (CAMPAIGN-01)** — missions. 17-01-01 (tracer) first: `startMission` becomes a replayable SaveCommand recording the start year (fixes the year=0 landmine) with the sequential gate, and the campaign-determinism + missions/runner-accessors scaffolds flip green (start→save→load byte-identity + gate + mission survival). 17-01-02 adds the additive `MissionDef` fields (map/products/routes/modifiers), re-themes the 10 entries to the spec arc, extends `data/validate.ts` over BOTH catalogs, and creates `src/sim/missionMaps.ts`. 17-01-03 wires startMission to apply per-mission modifiers/preplacements/routes and adds `getCampaignProgress()`.
- **Wave 2 (CAMPAIGN-02)** — contextual tutorial. 17-02-01 (tracer) adds the predicate-based step catalog + `dismissTutorialStep` SaveCommand + `getTutorial()` accessor — one full path (state → prompt → dismiss → save/load → still dismissed) — and flips the tutorial scaffolds. 17-02-02 completes the cause-detection predicates (food/labor/trade/rating/housing-evolution/immigration-blocked) with rich step content (short/expanded/codexRef/highlight) and empty-city totality.
- **Wave 3 (CAMPAIGN-03)** — codex + winnability close. 17-03-01 enriches `buildCodex()` entries and adds the nine missing categories (chains/housing/desirability/trade/finance/ratings/religion/risks/shortcuts) plus `getCodex()`/`lookupEntry`. 17-03-02 creates the winnability probe test, retunes mission targets to verified ceilings (ease #10), and closes with full suite + typecheck + military green.

# Locked decisions honored (17-CONTEXT.md §§Campaign Missions / Contextual Tutorial / Codex + RESEARCH):
- The 10 missions follow the spec's gradual-introduction arc; re-theme `name`/`description` to the arc, NEVER rename ids (`tutorial`/`small_town`/`thriving_city`/`grand_city` are referenced by existing tests and campaignMissions()).
- `MissionDef` extends additively with optional `map`/`products`/`routes`/`modifiers`; all-undefined = existing behavior unchanged.
- Mission completion runs through the existing sustained `ObjectiveTracker` (tickMissionSystem, month cadence) — do NOT build a second win loop; campaign progression unlocks N+1 only on N win.
- Tutorial steps are triggered by OBSERVED state via pure predicates over DerivedSnapshot/BuildingState — deterministic from state, no wall-clock; `nextTutorialPrompt`/`tutorialText` stay the ordered-introduction seed; no rigid sequence after the introduction.
- "Don't show again" is the replayable `dismissTutorialStep` SaveCommand (byte-identical replays) — the only persisted tutorial preference this phase.
- The codex covers all twelve categories with the eight per-entry fields; content is derived from catalogs (never hand-copied), exposed via `getCodex()` with id/kind lookup.
- Deferred ideas: none — discussion stayed in phase scope.

# Multi-source coverage audit (all COVERED):
- GOAL: 10-mission sequential winnable campaign → Wave 1 (missions + gates) + Wave 3 (probe + retuning); contextual tutorial → Wave 2; codex for every building/good/service/god → Wave 3.
- REQ CAMPAIGN-01 (10-mission framework): Waves 0-1 (MissionDef + validate + replayable startMission + maps + gates). REQ CAMPAIGN-02 (contextual tutorial): Wave 0 + Wave 2 (predicates + dismiss + accessor). REQ CAMPAIGN-03 (codex): Wave 0 + Wave 3 (enrich + categories + lookup). Every CAMP-01/02/03 requirement ID appears in the frontmatter `requirements` of this plan.
- RESEARCH: additive MissionDef + additive SaveCommand kinds + exhaustive dispatch (W1), construction-time mission maps + fromSaveData(save, map) contract (W1), year-fix landmine (17-01-01), progression gate (17-01-01/03), tutorial predicates over verified live data + dead-code netMigration warning (W2), codex derived from catalogs + missing categories (W3), winnability ceilings + probe (W3), determinism source audit + ft chunked 1/7/50 mirror (W0/W1), no SaveData schema change (all).
- CONTEXT: every locked decision has a task (traced to D-NN-equivalent decision text in the task actions above); discretion areas (mission layout strings + tuning, extra tutorial steps, codex wording, accessor shapes) are resolved concretely in the task actions.
- Exclusions checked: no deferred ideas; no items scoped to other phases (UI rendering → Phase 18).

<tasks>

<!-- ===================== WAVE 0 — validation test scaffolds ===================== -->

<task type="auto">
  <name>Task 17-00-01: Wave 0 — create/extend validation test scaffolds (campaign determinism, missions, tutorial, codex, accessors)</name>
  <files>tests/determinism/campaign-determinism.test.ts, tests/unit/campaign.test.ts, tests/missions.test.ts, tests/runner-accessors.test.ts</files>
  <read_first>
    - tests/determinism/finance-determinism.test.ts:20-70 (chunkedRunJson 1/7/50 helper + end-of-file source audit block — the exact shape to mirror)
    - tests/determinism/event-response-determinism.test.ts:50-69 (run→respond→save→load→continue byte-identity — the SaveCommand replay template) and :204-213 (source-audit header style)
    - tests/unit/campaign.test.ts (32 lines — the two describes + nextTutorialPrompt/tutorialText assertion block to extend)
    - tests/missions.test.ts:32-69 (RATE-02 sustained-tracker describe + the `MissionDef carries the new optional targets` assertion at :61-69 that MUST be rewritten to allow advanced targets)
    - tests/runner-accessors.test.ts:34-41 (startMission/getMission), :131-140 (mission tick), :156-179 (save/load round-trip), :182-192 (getDerived accessor shape)
    - tests/helpers.ts:26-111 (foodChainMap/buildFoodCity/productionChainMap/buildProductionCity — the scenario builders the scaffolds reuse)
  </read_first>
  <action>
    Create the validation scaffolds as RED tests pinned to the Phase-17 target APIs (they fail until Waves 1-3 implement the features — expected, and how the Nyquist gate tracks them). Write against the TARGET surface, not today's surface.

    1. NEW tests/determinism/campaign-determinism.test.ts (REQ CAMPAIGN-01 + CAMPAIGN-02). Copy the chunked-run helper from finance-determinism.test.ts:20-33 and the run→save→load contract from event-response-determinism.test.ts. Assert: (a) a city where startMission runs, ticks past at least one month gate, saves, and reloads with the same mission map (SimRunner.fromSaveData(save, missionMap)) continues to a byte-identical getStateJson() — call `getMission()` and `getMissionProgress()` on both and assert identical id/started/complete/failed/year and progress; (b) the same city run with chunk sizes 1/7/50 yields byte-identical getStateJson(); (c) after `dismissTutorialStep(step)`, save → load keeps the step dismissed (it does not re-eligibilize) — call the target getTutorial() shape; (d) the end-of-file source-audit block (mirroring finance-determinism.test.ts:60-69) over the fixed list `src/sim/campaign.ts, src/sim/missionMaps.ts` asserting no Math.random()/Date.now()/new Date() invocations, and (e) over `src/sim/runner.ts` asserting the only Date.now occurrence is the `savedAt: Date.now()` line in getSaveData (search the string 'savedAt: Date.now' and assert at least one occurrence, and /Date\.now\s*\(/ has exactly one match).
    2. EXTEND tests/unit/campaign.test.ts (REQ CAMPAIGN-02 + CAMPAIGN-03), keeping the existing codex/tutorial describes green. Add: (a) codex describe — every CodexEntry carries the enriched fields (description, howItWorks, and the ones its kind must carry: buildings → cost/workers, commodities → inputs undefined but outputs[] as needed, all → relatedLinks optional), one entry per added category kind exists (chain/housing/desirability/trade/finance/ratings/religion/risks/shortcuts), a farm building entry's cost equals BUILDINGS.farm.cost, a lookup helper resolves by (id, kind) and returns undefined for a missing id; (b) tutorial describe — new scenario runners: an isolated house (no road) makes the road-isolation predicate true while the same city with a connected house makes it false, an empty city never throws (predicates total), a satisfied house does not fire the no-food predicate; (c) dismiss describe — after the target `dismissTutorialStep` API, save → load keeps the step dismissed. Write these against target exports (e.g. the predicate/catalog functions campaign.ts will export and the getTutorial()/getCodex() accessors the runner will expose).
    3. EXTEND tests/missions.test.ts (REQ CAMPAIGN-01). Add: (a) progression gate — after 'tutorial' completes (simulate by winning via the sustained tracker on a city that meets targets, or mark the live mission complete on the in-test runner), startMission('small_town') is allowed and startMission('thriving_city') is rejected (skipping ahead); (b) start-year fix — tick a runner past 3000 ticks on the production map, then startMission('thriving_city') (timeLimitYears 10) and with a city that does NOT meet targets, assert after ticks that pass a month gate `!failed` (today `mission.year=0` makes 8−0>10 false... no, 8−0=8 not >10 — use a time limit small enough OR start at year > timeLimit, e.g. tick to ~5000 ticks = year 13, start a 10-year mission, assert not instantly failed at the next month gate); (c) modifiers/map application — after startMission on a def with modifiers, assert the treasury credit was applied and the pre-placed starter buildings exist; (d) REWRITE the existing `MissionDef carries the new optional targets...` block (:61-69) so `targetFavor/targetTreasury/targetAnnualExports/sustainChecks` are asserted as `undefined OR a finite non-negative number` (the tuning waves add them), keeping the population>0 assertion.
    4. EXTEND tests/runner-accessors.test.ts (REQ CAMPAIGN-01/02/03). Add: (a) getTutorial() and getCodex() return shaped values after ticking (mirror the getDerived test at :182-192); (b) mission save/load round-trip — start a mission, tick past a month gate, save, load with the mission map, assert getMission() and getMissionProgress() survive; (c) getCampaignProgress() returns { current, nextUnlocked } shaped values.
    These scaffolds intentionally reference APIs delivered later (startMission SaveCommand semantics, enriched CodexEntry, dismissTutorialStep, getTutorial/getMissionProgress/getCampaignProgress, missionMaps). They are expected RED until their implementing tasks.
  </action>
  <verify>
    <human-check>Wave 0 is complete when all four files exist/extend and target the Phase-17 APIs; the new/extended cases are expected RED until the implementing tasks flip them green.</human-check>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && test -f tests/determinism/campaign-determinism.test.ts && npm run typecheck</automated>
  </verify>
  <acceptance_criteria>tests/determinism/campaign-determinism.test.ts exists and is discovered by the vitest include glob; tests/unit/campaign.test.ts, tests/missions.test.ts and tests/runner-accessors.test.ts carry the new Phase-17 target-surface cases (RED until their waves); typecheck still passes on the written test code (the scaffolds compile against the target surface they declare).</acceptance_criteria>
  <done>The four test files carry the Phase-17 target-surface scaffolds (campaign determinism NEW; campaign/missions/runner-accessors extended), are vitest-discovered, typecheck-clean, and are RED only where their implementing waves have not yet landed.</done>
</task>

<!-- ===================== WAVE 1 (CAMPAIGN-01) — missions ===================== -->

<task type="tracer">
  <name>Task 17-01-01: Tracer — replayable startMission with start-year fix + sequential gate (one campaign path end-to-end)</name>
  <files>src/sim/types.ts, src/sim/runner.ts, tests/missions.test.ts, tests/runner-accessors.test.ts, tests/determinism/campaign-determinism.test.ts</files>
  <read_first>
    - src/sim/runner.ts:2102-2108 (the startMission stub to replace — hardcoded `year: 0`, `missionTracker = null`), :2120-2122 (private mission/missionTracker), :1509-1549 (tickMissionSystem month-cadence win eval + time-limit check `year - this.mission.year > def.timeLimitYears` at :1519-1523)
    - src/sim/runner.ts:939-988 (openTradeRoute/setTradeOrder — the SaveCommand issuance + commandLog pattern to copy for startMission), :2186-2208 (getCommandLog/getSaveData), :2221-2237 (fromSaveData replay loop — the gate must be skipped during replay)
    - src/sim/runner.ts:2814-2847 (applyCommand exhaustive dispatch — add the two new branches)
    - src/sim/types.ts:75-89 (SaveCommand union — append the two new kinds), :212-219 (MissionState)
    - src/sim/missions.ts:66-69 (campaignMissions() — the canonical 10-mission order the gate uses)
    - src/sim/runner.ts:1563-1568 (the `!this.replaying && gov` gate precedent for skipping gates during replay)
  </read_first>
  <behavior>
    - Test 1: startMission('thriving_city') on a runner already ticked past year 13 does NOT leave the mission failed at the next month gate when targets fall short — mission.year equals floor(tickCount/360) at start (missions.test.ts start-year describe; RED before this task).
    - Test 2: while 'tutorial' is active and incomplete, startMission('small_town') is rejected (gate); after 'tutorial' is won (mission.complete true), startMission('small_town') is allowed and startMission('thriving_city') is still rejected (sequential) (missions.test.ts progression describe).
    - Test 3: run → startMission → tick past a month gate → save → reload (same map) continues with a byte-identical getStateJson() and getMission()/getMissionProgress() survive (campaign-determinism.test.ts; runner-accessors save/load describe).
  </behavior>
  <action>
    Make mission start replayable and correct (decision CAMPAIGN-01, RESEARCH Pitfall 1+2) — the thinnest end-to-end campaign path proven before the data/wiring expansion:

    1. src/sim/types.ts SaveCommand union (:75-89): append `| { kind: 'startMission'; id: string }` and `| { kind: 'dismissTutorialStep'; step: string }` AFTER `respondEvent`. Do NOT touch SaveData/SaveState — mission state round-trips through command replay only.
    2. src/sim/runner.ts startMission (replace :2102-2105): signature `startMission(id: string): { ok: boolean; error?: string }`. Body:
       - Gate (LIVE calls only): `if (!this.replaying && !this.missionUnlocked(id)) return { ok: false, error: 'locked' }` — where missionUnlocked(id) is true when (no active mission — fresh/sandbox) OR (active mission complete AND id equals the next mission in campaignMissions() order after the current) OR (id equals the active mission id — restart/no-op). This encodes "mission N+1 unlocks only when N is won" (sequential playability); the existing tests calling startMission('tutorial') on a fresh runner stay green, and a fresh runner may start any single mission (sandbox/the winnability probe). IMPORTANT: the gate is skipped during replay (trust your own recorded stream — exact precedent is the gov gate at :1563-1568 `if (!this.replaying && gov && ...)`), otherwise a replayed startMission(N) is blocked because N-1's completion only happens during the post-replay month-gate ticks.
       - Reject an unknown id the way tickMissionSystem does (def lookup MISSIONS[id] ?? EXTRA_MISSIONS[id]; unknown → { ok: false, error: 'unknown-mission' }).
       - Set `this.mission = { id, started: true, complete: false, failed: false, year: Math.floor(this.tickCount / 360), objective: id }` — the year fix (never 0) so the time-limit check at :1519-1523 counts from mission START, not runner construction.
       - `this.missionTracker = null` (fresh ObjectiveTracker per mission — tickMissionSystem lazily rebuilds it on the first month gate).
       - Push `this.commandLog.push({ tick: this.tickCount, command: 'startMission ' + id, result: 'ok' })` and `this.saveCommands.push({ kind: 'startMission', id })` — the single deterministic replay record for the whole mission start.
       - Return { ok: true }.
       - (Sub-effects — modifiers/preplacements/routes — arrive in 17-01-03; this task installs the record + gate + year fix + tracker reset only, so the tracer flips the determinism/save-load/gate/year scaffolds.)
    3. src/sim/runner.ts applyCommand (:2814-2847): add `else if (cmd.kind === 'startMission') { runner.startMission(cmd.id); }` and `else if (cmd.kind === 'dismissTutorialStep') { runner.dismissTutorialStep(cmd.step); }` BEFORE the `else` — the exhaustive `never` branch makes a forgotten kind a compile error (dismissTutorialStep lands in Wave 2; add the branch now so the type union is exhaustive, and implement the method body in 17-02-01 — for THIS task it may be a warm body that records the dismissed step in a new private set `dismissedTutorialSteps: Set<string>` initialized empty, which is what 17-02-01 completes; keeping the branch now is required for typecheck against the widened union).
    4. src/sim/runner.ts: add `getCampaignProgress(): { current: MissionState | null; nextUnlocked: string | null }` — derived from `this.mission` + campaignMissions(): nextUnlocked = 'tutorial' when no mission, campaignMissions()[orderIndex+1] when current.complete, current.id when failed (retry), current.id when in-progress (same-id no-op). Purely derived; never serialized. Add `getMissionProgress(): { won: boolean; progress: number; sustained: number; sustainChecks: number } | null` reading `this.missionTracker` (NOT `this.objective` — wiring the mission tracker into `this.objective` would double-update it on the month cadence through BOTH tickMissionSystem:1538 and tickDerivedSystems:592, halving the sustain period — see the getObjectiveProgress trap).
    5. Flip green: the campaign-determinism start/save-load/chunked cases, the runtime suffix of tests/missions.test.ts (start-year + progression) and the runner-accessors mission save/load round-trip (using a plain map — the mission-map param is 17-01-03). Leave the modifier/map-application cases RED until 17-01-03.
    Discretion resolved here (per CONTEXT §the agent's Discretion): the sequential gate allows a fresh-runner first mission of any id (sandbox + probe), then enforces strict next-in-order; mission progress is exposed via a NEW getMissionProgress() rather than reusing getObjectiveProgress (the double-update trap).
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/missions.test.ts tests/runner-accessors.test.ts tests/determinism/campaign-determinism.test.ts -x</automated>
  </verify>
  <acceptance_criteria>startMission records mission.year = floor(tickCount/360) so a time-limited mission started on a long-run runner does not instantly fail; the SaveCommand is pushed and getSaveData()/fromSaveData() preserves getMission()/getMissionProgress(); the sequential gate blocks N+1 until N is complete and is skipped during replay; the two new SaveCommand kinds are in the union and dispatched exhaustively; campaign determinism + gate + start-year + save/load scaffolds pass.</acceptance_criteria>
  <done>The one campaign path is wired end-to-end — startMission is a replayable SaveCommand with the start-year fix, sequential unlock gate (live-only), deterministic save/load survival, and getMissionProgress()/getCampaignProgress() accessors — and the Wave-0 mission/determinism scaffolds are green.</done>
</task>

<task type="auto">
  <name>Task 17-01-02: MissionDef additive data (map/products/routes/modifiers) + validation + missionMaps factory + spec-arc re-theme</name>
  <files>data/missions.ts, data/validate.ts, src/sim/missionMaps.ts, tests/missions.test.ts, tests/data-catalog.test.ts</files>
  <read_first>
    - data/missions.ts:5-29 (MissionDef to extend additively after timeLimitYears), :31-80 (the 10 entries to re-theme — keep ids tutorial/small_town/thriving_city/grand_city + the 6 EXTRA ids)
    - data/validate.ts:171-186 (the missions loop — currently iterates MISSIONS ONLY; mirror for EXTRA_MISSIONS), :126-130 (the trade cross-catalog id-check pattern), :6-14 (imports to extend: EXTRA_MISSIONS, COMMODITIES, TRADE_CITIES)
    - src/sim/map.ts:39-47 (SimMap.fromLayout(width, height, layout) — the missionMap factory target) and tests/helpers.ts:26-35 (the layout-builder pattern)
    - data/commodities.ts:7-21 (CommodityDef for the products⊆COMMODITIES check), data/trade.ts:44-88 (TRADE_CITIES massilia/caralis/londinium/tarraco — the routes[].cityId universe)
    - 17-RESEARCH.md Per-Mission Winnability table (the target ceilings each mission's map/products/routes/modifiers must enable) and 17-CONTEXT.md §Campaign Missions
  </read_first>
  <behavior>
    - Test 1: every mission (MISSIONS AND EXTRA_MISSIONS) with a map field parses — layout rows count == height and each row length == width, all chars in the legend ∪ {'.','e'}; missionMap(def) returns a SimMap with those terrain tiles (missions.test.ts / data-catalog.test.ts).
    - Test 2: a malformed mission (route city id not in TRADE_CITIES, product not in COMMODITIES, negative modifier) makes validateCatalogs() non-empty (data-catalog.test.ts); all well-formed missions keep validateCatalogs() === [].
    - Test 3: the re-themed entries still satisfy campaignMissions() === the 10 spec-arc ids in order and every existing entry with the new fields undefined behaves as before.
  </behavior>
  <action>
    Extend the mission data model per CONTEXT §Campaign Missions, additively and validated (RESEARCH don't-hand-roll / DATA-01):

    1. data/missions.ts MissionDef — add FOUR optional fields after `timeLimitYears?`:
       - `map?: { width: number; height: number; layout: string; legend: Record<string, import('../src/sim/types').TileType>; preplace?: { type: string; x: number; y: number; god?: string }[] }` — `layout` is row-major newline-joined: exactly `height` rows, each exactly `width` characters; every char is a `legend` key or the implicit-earth char '.'; `preplace` lists starter buildings (type = building type id, coordinates in-bounds, optional god for temples).
       - `products?: string[]` — commodity ids the mission emphasizes (goods-chain fluency: e.g. thriving_city adds ['clay','pottery','timber','furniture','olives','oil','grapes','wine']).
       - `routes?: { cityId: string; quota?: number; order?: import('../src/sim/trade').TradeOrderMode; good?: string }[]` — trade routes to open on start (quota = annual quota, good+order = a per-good order to set; good omitted → no order meaning).
       - `modifiers?: { startingTreasuryCredit?: number; startingPolicy?: { taxRate?: number; wageRate?: number }; timeLimitYears?: number }` — applied on start (credit additively on top of the running treasury; policy override; optional per-mission time-limit override).
       Re-theme the 10 entries' `name`/`description` to the spec arc (1 riverside foundations, 2 provincial granary, 3 clay and fire, 4 trade roads, 5 water for all, 6 city of scholars, 7 favors of the gods, 8 southern port, 9 city of patricians, 10 provincial capital) mapped 1:1 onto the existing ids per the RESEARCH winnability table; KEEP every id and every existing target field; add the new optional fields per the table notes (e.g. port_city gains targetFavor 60-80; a trade mission gains targetAnnualExports ≤ 100; each mission gains a small deterministic `map` (pick a size ≤ 40×40 fitting its systems — small early maps) with legend + layout + preplace for the starter road/house/well/farm). No military tokens anywhere in names/descriptions (check-military gate).
    2. data/validate.ts missions loop (:171-186) — extend in place: (a) iterate BOTH MISSIONS AND EXTRA_MISSIONS (currently only MISSIONS — import EXTRA_MISSIONS at :12); (b) keep the existing target/sustainChecks checks; (c) add: map → width/height positive integers, layout rows == height, every row length == width, every non-'.' char is a legend key, every legend value is a valid TileType union member, preplace entries reference a known building type and stay in-bounds; products → each id ⊆ COMMODITIES; routes → each cityId ∈ TRADE_CITIES and quota (when present) a finite non-negative number; modifiers → every numeric field finite non-negative (timeLimitYears positive). Same `{ catalog: 'missions', message }` style as the trade loop.
    3. Create src/sim/missionMaps.ts — `export function missionMap(def: Pick<MissionDef,'map'>): SimMap | null` and `export function buildMissionMap(layout, legend, width, height): SimMap` — parse `layout` rows and call `SimMap.fromLayout(width, height, (x,y) => legend[char] ?? (char === '.' ? undefined : undefined))` (implicit '.' = earth → undefined = default earth). Pure, deterministic, no RNG/clock, tests/helpers.ts layout-builder style. Sizes come from the def (≤ 40×40).
    4. Flip green: the map-parse + malformed-mission validation cases in the Wave-0 scaffolds (missions.test.ts data describe + data-catalog.test.ts). Leave the apply-on-start cases RED until 17-01-03.
    Discretion resolved here: layout string format (row-major, '.' = earth, legend), the concrete per-mission map/products/routes/modifiers values (small deterministic layouts introducing each system — agent's discretion bounded by the winnability ceilings), and re-theme wording (from catalog names/arc).
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/missions.test.ts tests/data-catalog.test.ts -x</automated>
  </verify>
  <acceptance_criteria>MissionDef carries the four additive optional fields; all 10 entries are re-themed to the spec arc with ids unchanged and the new fields populated within the winnability ceilings; validateCatalogs() validates map/products/routes/modifiers over BOTH MISSIONS and EXTRA_MISSIONS (malformed data rejected, well-formed clean); missionMap() parses layouts deterministically; the mapping/validation scaffolds are green.</acceptance_criteria>
  <done>The mission data model is extended and load-time validated over both catalogs, the 10 entries follow the spec arc with concrete maps/products/routes/modifiers, missionMaps.ts parses layouts into SimMaps, and the Wave-0 mission-data scaffolds pass.</done>
</task>

<task type="auto">
  <name>Task 17-01-03: Wire per-mission map/modifiers/preplacements/routes into startMission + campaign progress</name>
  <files>src/sim/runner.ts, src/sim/missionMaps.ts, src/sim/types.ts, tests/missions.test.ts, tests/runner-accessors.test.ts</files>
  <read_first>
    - src/sim/runner.ts:2102-2108 (the startMission body installed in 17-01-01 — begin the sub-effects), :939-988 (openTradeRoute/setTradeOrder bodies — the mutation logic to run under suppression), :1553-1625 (placeBuilding — the placement mutation to run under suppression)
    - src/sim/missionMaps.ts (17-01-02 missionMap factory), data/missions.ts (the new optional fields' semantics)
    - src/sim/runner.ts:2221-2237 (fromSaveData(save, map?) docstring — the construction-time mission-map contract to document on getTutorial/getCodex/game-level callers)
    - 17-RESEARCH.md Pattern 2 (construction-time terrain + replayable pre-placements) and Assumption A4 (readonly map — startMission CANNOT mutate terrain; the caller passes missionMap to new SimRunner/fromSaveData)
  </read_first>
  <behavior>
    - Test 1: startMission on a mission with modifiers applies the startingTreasuryCredit to the treasury (additively, deterministic), applies any startingPolicy, preplaces the starter buildings (they exist in getState at the def coordinates), and opens the mission routes (getTradeRoutes() enabled + the per-good order set) — missions.test.ts modifier-application describe (RED before this task).
    - Test 2: a save taken after such a startMission replay with fromSaveData(save, missionMap) reproduces the exact same treasury/buildings/routes state — campaign-determinism chunked/save-load identity holds WITH the sub-effects, and a save→load→save cycle does not grow saveCommands (no self-duplicated place/openTradeRoute/startMission records).
    - Test 3: getCampaignProgress() surfaces nextUnlocked = the mission after the current one once it is complete (runner-accessors.test.ts).
  </behavior>
  <action>
    Complete startMission's sub-effects per CONTEXT §Campaign Missions ("map, objectives, products, routes, and modifiers loaded deterministically when the mission is selected") — without a determinism landmine:

    1. src/sim/runner.ts — add a private field `private suppressCommandRecording = false`. Guard the command-recording push sites in placeBuilding (:1622-1623), openTradeRoute (:957,961) and setTradeOrder (:983,986) with `if (!this.suppressCommandRecording) { ...push commandLog + saveCommands... }` (state mutations stay unconditional). This is the single fix that keeps replay byte-identical: startMission's sub-effects run under the flag on BOTH the live call AND replay, so the one {kind:'startMission'} command is the complete record and save→load→save never duplicates commands (RESEARCH Pitfall 2 / command-bloat).
    2. src/sim/runner.ts startMission (extend the 17-01-01 body, after mission state + before the return, all inside `this.suppressCommandRecording = true; try { ... } finally { this.suppressCommandRecording = false; }`):
       - modifiers: `if (def.modifiers)`: startingTreasuryCredit → `this.treasuryAccount.addRevenue('other', credit)` (additive credit on top of the current treasury — startingDenarii semantics per RESEARCH A5, never a reset); startingPolicy → apply setPolicy-equivalent; timeLimitYears → used by tickMissionSystem via def (the field override is read from def.modifiers.timeLimitYears ?? def.timeLimitYears in tickMissionSystem — see 4).
       - map.preplace: for each preplace entry call `this.placeBuilding(type as BuildingType, x, y, god ? { god } : undefined)` under the flag (reuses all placement validation + treasury charge + occupiedTiles; no per-place record).
       - routes: for each route call openTradeRoute(cityId) and (when good+order present) setTradeOrder(cityId, good, order, { ... }) under the flag.
       - Do NOT construct or mutate terrain in startMission — the map is readonly (A4); the CONTRACT (documented in the startMission + getSaveData docstrings): callers construct the runner with `new SimRunner(seed, missionMap(def))` and load with `SimRunner.fromSaveData(save, missionMap(def))` so terrain round-trips; Phase 18's UI and the winnability probe follow it.
    3. src/sim/runner.ts — modify the time-limit read in tickMissionSystem (:1519-1523) to honor the per-mission override: `const limitYears = def.modifiers?.timeLimitYears ?? def.timeLimitYears;` and compare against that.
    4. src/sim/runner.ts — getCampaignProgress() from 17-01-01 already returns { current, nextUnlocked }; if the executor added nextUnlocked only after complete, keep as specced (next = campaignMissions()[idx+1] on complete; retry/current id otherwise).
    5. Flip green: the modifier/map/routes application cases in missions.test.ts and the sub-effects save/load + command-no-growth case in the determinism file; confirm the Wave-0 runner-accessors round-trip passes with missionMap(def).
    Discretion resolved here: exact per-mission modifiers/products/routes values are data (17-01-02), the apply order is empirically unbounded by the flag guard — any order is deterministic.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/missions.test.ts tests/runner-accessors.test.ts tests/determinism/campaign-determinism.test.ts -x</automated>
  </verify>
  <acceptance_criteria>startMission applies modifiers (treasury credit + policy), preplaced starter buildings, and mission routes under the suppressCommandRecording guard; tickMissionSystem honors the per-mission time-limit override; start→save→load→save reproduces byte-identical state WITHOUT growing saveCommands; getCampaignProgress() exposes the next unlocked mission; the Wave-1 mission scaffolds are all green.</acceptance_criteria>
  <done>startMission's full effect (modifiers + preplacements + routes) is applied deterministically and replay-safely, the per-mission time limit is honored, the construction-time mission-map contract is documented, getCampaignProgress() works, and the mission application + determinism suites are green.</done>
</task>

<!-- ===================== WAVE 2 (CAMPAIGN-02) — contextual tutorial ===================== -->

<task type="tracer">
  <name>Task 17-02-01: Tracer — state-triggered tutorial prompt + replayable dismissTutorialStep (one path end-to-end)</name>
  <files>src/sim/campaign.ts, src/sim/runner.ts, src/sim/types.ts, tests/unit/campaign.test.ts, tests/determinism/campaign-determinism.test.ts</files>
  <read_first>
    - src/sim/campaign.ts:38-62 (TutorialStepId union, TUTORIAL_TEXT, nextTutorialPrompt/tutorialText — the ordered-introduction seed to KEEP), :13-36 (CodexEntry + buildCodex shape for the codexRef contract)
    - src/sim/runner.ts:585-603 (tickDerivedSystems — where the derived snapshot is computed; the tutorial view derives here), :1334-1336 (getDerived cached-read), :1354-1373 (getCivicStats — the pure derived-accessor shape getTutorial() mirrors)
    - src/sim/runner.ts:2746-2787 (toBuildingState — the per-house live state: level, desirability, food/water/laborCooldown, services, godAccess; laborConnected/workersRequired are on the BuildingState, NOT the house sub-object — the runner must build a house view that includes them)
    - src/sim/runner.ts:2814-2847 (applyCommand — the dismissTutorialStep branch was added in 17-01-01; this task completes its method body), types.ts:75-89 (the dismiss kind already in the union)
    - 17-RESEARCH.md Pattern 3 (predicate shape + the verified live-data mapping) and Pitfall 4 (netMigration is dead code — the tutorial speaks housing-evolution language, never vacancy)
  </read_first>
  <behavior>
    - Test 1: on a fresh runner with no buildings, getTutorial().current is the first introduction step ('roads'); after dismissing 'roads', current is the next introduction step ('housing') — ordered introduction preserved (campaign.test.ts, RED before this task).
    - Test 2: a city with houses that have NO food (no foodCooldown) and no food buildings surfaces the no-food step as eligible/current; the same city with a fed house does NOT (campaign.test.ts tutorial describe).
    - Test 3: dismissTutorialStep('food') → save → load → getTutorial() no longer lists 'food' (dismissed set reconstructed from replay; determinism file).
  </behavior>
  <action>
    Build the tutorial's deterministic spine (decision CAMPAIGN-02, RESEARCH no-wall-clock) — the thinnest full path from observed state to a prompt that survives dismissal and replay:

    1. src/sim/campaign.ts — keep `TutorialStepId`, `TUTORIAL_TEXT`, `nextTutorialPrompt(seen)` and `tutorialText(step)` EXACTLY as they are (the ordered-introduction seed; the existing unit tests at campaign.test.ts:23-31 stay green). ADD the predicate catalog + prompt shapes:
       - `export interface HouseView { id: number; level: number; laborConnected: boolean; workersRequired: number; desirability: number; foodCooldown: number; waterCooldown: number; laborCooldown: number; services: Record<string, number> | undefined; godAccess: Record<string, number> | undefined; foodInventory: Record<string, number> | undefined; }` — the pure predicate input abstraction (the runner builds it from live buildings).
       - `export interface TutorialPrompt { step: TutorialStepId; shortText: string; expandedText: string; codexRef: string; highlight: number[]; }` — short text from TUTORIAL_TEXT, expanded explanation, a codex entry reference (id string), and the building ids that triggered the step (the 'show-where' data for Phase 18).
       - `export interface TutorialEligibility { eligible: (derived: import('../runner').DerivedSnapshot, houses: readonly HouseView[]) => boolean; }` per step, stored in `export const TUTORIAL_ELIGIBILITY: Record<TutorialStepId, TutorialEligibility>`. For Wave-2 tracer install THREE: roads/housing = `() => true` (trivially-eligible introduction, preserving the ordered seed), and water = `(d, houses) => houses.length > 0 && houses.every(h => h.waterCooldown <= 0)` + no well/fountain placed (derive from houses/services or a `waterTiles`/`godAccess` proxy — use the cleanest available live signal). The remaining steps land in 17-02-02; until then their eligibility is `() => false` (safe placeholder that does not fire — architectural gap-free: the predicate chain is the final shape, only the functions are still conservative).
       - `export function nextTutorialCurrent(seen: Set<string>, dismissed: Set<string> | undefined, eligibleSteps: TutorialStepId[]): TutorialStepId | null` — first catalog-order step (the fixed intro order roads→housing→water→food→labor→trade→rating→housing-evolution→immigration-blocked) that is eligible AND not dismissed; the runner supplies the eligibility per step by evaluating the catalog. Keep it a pure function (the runner passes the computed eligible set).
    2. src/sim/runner.ts — add `private initializedTutorialSteps = false` not needed — instead evaluate the catalog lazily: `private tutorialEligibleSteps(): TutorialStepId[]` returns the catalog-order step ids whose `TUTORIAL_ELIGIBILITY[step].eligible(this.derived ?? this.derivedSnapshot(), this.houseViews())` is true. `private houseViews(): HouseView[]` maps `this.buildings.filter(b => b.house)` into HouseView (reading b.laborConnected, b.workersRequired, b.house!.level/foodCooldown/waterCooldown/laborCooldown/desirability/services/godAccess/foodInventory, b.id). Both pure reads — deterministic from state, never wall-clock, never mutated on read.
    3. src/sim/runner.ts — add `private dismissedTutorialSteps = new Set<string>()`; implement `dismissTutorialStep(step: string): { ok: boolean }` — validate the step is a TutorialStepId, push commandLog `dismissTutorialStep <step>` + `saveCommands.push({ kind: 'dismissTutorialStep', step })`, add to the set, return simple result. Replay reconstructs the set by replaying the commands (no SaveData change).
    4. src/sim/runner.ts — `getTutorial(): TutorialView` where `TutorialView = { current: TutorialPrompt | null; eligible: TutorialPrompt[]; dismissed: string[] }` (also expose `seen` = the dismissed list — the only persistent 'seen' marker this phase; transient session 'seen' tracking is Phase-18 UI state, documented in the docstring). Build `TutorialPrompt` per eligible step with `highlight` = the house ids that made that step's predicate true (for cause steps; intro steps highlight []). `current` = nextTutorialCurrent-compatible first eligible not-dismissed step. Pure derived accessor — never serialized, computed on read from state + dismissed set.
    5. applyCommand's dismissTutorialStep branch (added 17-01-01) now routes into the real method; verify byte-identity of a dismissed step through save/load in the determinism file.
    6. Flip green: the tutorial intro-order + dismiss-round-trip cases in campaign.test.ts and the determinism dismissal case. Leave the cause-scenario cases (no-food etc.) RED until 17-02-02 fills the remaining predicates.
    Discretion resolved here: the intro steps stay trivially eligible (ordered seed preserved), every non-introduction step installed with a conservative `() => false` until 17-02-02 (gap-free predicate chain), and 'seen' = dismissed for this phase (documented Phase-18 UI handoff).
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/unit/campaign.test.ts tests/determinism/campaign-determinism.test.ts -x</automated>
  </verify>
  <acceptance_criteria>campaign.ts exports the predicate catalog + HouseView + TutorialPrompt + ordered-current resolver with the existing nextTutorialPrompt/tutorialText untouched; the runner exposes getTutorial() returning { current, eligible, dismissed } computed purely from state; dismissTutorialStep is a replayable SaveCommand whose dismissed set survives save/load; the intro-order + dismissal scaffolds are green.</acceptance_criteria>
  <done>The contextual-tutorial spine is wired end-to-end — a state-observed step resolves to a prompt with highlight, a replayable dismiss persists across save/load, getTutorial() is a pure derived accessor, and the ordered introduction seed is preserved.</done>
</task>

<task type="auto">
  <name>Task 17-02-02: Complete cause-detection predicate catalog + rich step content (short/expanded/codexRef/highlight)</name>
  <files>src/sim/campaign.ts, src/sim/runner.ts, tests/unit/campaign.test.ts</files>
  <read_first>
    - src/sim/campaign.ts (17-02-01 catalog + TUTORIAL_TEXT — the step text seed to enrich)
    - src/sim/runner.ts:1314-1330 (DerivedSnapshot fields the predicates read: population, employment, services, godWorship, water, fireRisk, collapseRisk, crime, treasury, annualExports, government), :2746-2787 (house live state)
    - src/sim/housingLive.ts (deriveSatisfied/requirementsMet vocabulary + a threshold for the evolution-plateau predicate)
    - 17-RESEARCH.md Pattern 3 + Pitfall 4 (the verified cause map: road isolation → laborConnected false; growth plateau → level below what requirements+desirability support; low attractiveness → per-house desirability; no food/water/labor → cooldowns never set), Open Question 4 (the concrete step set)
  </read_first>
  <behavior>
    - Test 1: a house with laborConnected === false and workersRequired > 0 fires the road-isolation ('immigration-blocked') predicate while the connected city does not (campaign.test.ts scenario describe).
    - Test 2: a house whose level is stuck below what its desirability + satisfied requirements could support fires the 'housing-evolution' predicate — and the language is evolution (level/desirability), never vacancy (campaign.test.ts).
    - Test 3: every predicate is a total function — an empty city (no houses) and a city with only non-house buildings never throw and never fire the cause steps (edge-case describe).
  </behavior>
  <action>
    Fill out the full cause-detection catalog per RESEARCH Pitfall 4 / Open Q4, with rich per-step content (decision CAMPAIGN-02):

    1. src/sim/campaign.ts — extend `TUTORIAL_ELIGIBILITY` (17-02-01 placeholders → real pure predicates over `(derived, houses)`). Each is a TOTAL function (guard `houses.length === 0` → false) with no Math.random/Date.now/new Date:
       - food: houses exist && no house has foodCooldown > 0 (no food delivered) && the city has no farm/orchard/vegetable_farm/cattle_ranch/fishing_wharf AND no granary/market with food stock (use `derived` + a buildings-driven proxy the runner passes, or a `hasFoodProducer` flag on the input — the runner supplies what the predicate needs from live state; keep the predicate pure over its args).
       - labor: some building with workersRequired > 0 has laborConnected === false (staffable but road/labor-isolated).
       - trade: an enabled mission is active OR the city produces surplus — use the live signal `derived.annualExports === 0` while storage exists with stock (proxy via houses? use a runner-supplied `storageLoads` number on the HouseView-independent input — extend the predicate input to a small `CityView { hasStorageStock: boolean; annualExports: number; missionActive: boolean }` that the runner builds; predicates stay pure total functions over (derived, houses, city)).
       - rating: a mission is active AND at least one of population/culture/prosperity/stability/favor is below its mission target (the win-condition explainer); the runner passes the active mission targets in `city.missionTargets`.
       - housing-evolution: some house where requirementsMet(level+1) holds and desirability is near the next level's padded threshold but the level is not advancing (the player needs more satisfied ticks/services) — explain growth via evolution language ("improve desirability and services to evolve homes"), NEVER vacancy/netMigration (dead code).
       - immigration-blocked (the spec example): some house with laborConnected === false && workersRequired > 0 → explain the REAL cause: road isolation (no road network reaching the home, so walkers cannot deliver food/water/labor). Decide predicate ORDER so the constructor precedes the no-food/no-water steps (priority: labor/road first, then water/food, then evolution).
       - water/food are already installable: water = houses exist && every house waterCooldown <= 0 (no clean water delivered) && no well/fountain placed.
       Add `TUTORIAL_EXPANDED: Record<TutorialStepId, string>` (expanded explanation per step) and `TUTORIAL_CODEX_REF: Record<TutorialStepId, string>` (the codex entry id each step links to — building categories for food/water/labor, 'housing-evolution' → a housing/desirability codex entry, etc.). Build TutorialPrompt in the runner with `highlight` = the house ids that fired the predicate.
    2. src/sim/runner.ts — extend the predicate input: `private cityView(): CityView` building the CityView (hasStorageStock from granary/warehouse stock sums, annualExports from the derived snapshot, missionActive + missionTargets from `this.mission` + MISSIONS/EXTRA_MISSIONS defs, hasFoodProducer from the buildings list). Feed it to every predicate as the third arg. The HouseView + CityView types live in campaign.ts (pure), the runner only maps live state into them.
    3. tests: flip green the no-food / road-isolation / evolution-plateau / empty-city scenario describes in tests/unit/campaign.test.ts; keep the determinism source-audit green (campaign.ts must contain no Math.random/Date.now/new Date).
    Discretion resolved here: the concrete step set is RESEARCH Open Q4's list (roads/housing/water/food/labor/trade/rating + housing-evolution + immigration-blocked); predicate order is constructor-first; text wording derives from catalog names where possible.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/unit/campaign.test.ts -x</automated>
  </verify>
  <acceptance_criteria>All nine tutorial steps have pure total eligibility predicates over live state; prompts carry short/expanded/codexRef/highlight; an empty city never throws; the no-food/road-isolation/evolution/empty-city scenario scaffolds are green; no wall-clock/RNG in campaign.ts.</acceptance_criteria>
  <done>The full cause-detection predicate catalog fires on real state with rich step content and highlight building ids; every edge case (empty city) is total; the tutorial suite and determinism source-audit are green.</done>
</task>

<!-- ===================== WAVE 3 (CAMPAIGN-03) — codex + winnability close ===================== -->

<task type="auto">
  <name>Task 17-03-01: Enrich codex entries + add the nine missing categories + getCodex()/lookupEntry</name>
  <files>src/sim/campaign.ts, src/sim/runner.ts, tests/unit/campaign.test.ts, tests/runner-accessors.test.ts</files>
  <read_first>
    - src/sim/campaign.ts:13-36 (CodexEntry union + buildCodex loops to enrich), :38-62 (campaign.ts overall — tutorial + codex coexist)
    - data/buildings.ts:24-52 (BuildingDef fields: cost, workers, produces, consumes, footprint, requiresRoad, spawns, serviceRadius, storageCapacity, requiredPopulation), data/commodities.ts:7-21 (category/storage/durabilityMonths/baseImportPrice/baseExportPrice/houseGood/tradable), data/walkers.ts:5-12 (service/spawnedBy), data/housing.ts:7-24 (requires/requiresGoods/desirability/capacity per level), data/trade.ts:44-88 (TRADE_CITIES), data/religion.ts (FESTIVAL_TIERS/favor fields), data/events.ts (risk/event catalog), src/sim/services.ts:34 (GODS), src/sim/ratings.ts:89-94 (the W weighting + computeTargets/computeFavor — the ratings-codex source)
    - src/sim/runner.ts:1312,1325 (derivedSnapshot calls buildCodex() per snapshot — cache it via getCodex() so enrichment does not make every snapshot rebuild the entire enriched codex), :1334-1336 (getDerived cached-read idiom)
  </read_first>
  <behavior>
    - Test 1: buildCodex() returns an entry with kind 'building' and id 'farm' whose cost equals BUILDINGS.farm.cost, workers equals BUILDINGS.farm.workers, and outputs/inputs reflect the catalog produces/consumes (campaign.test.ts codex-coverage describe).
    - Test 2: at least one entry exists for each of the nine new kinds (chain/housing/desirability/trade/finance/ratings/religion/risks/shortcuts) AND the four original kinds all present (campaign.test.ts).
    - Test 3: lookupEntry(entries, 'farm', 'building') resolves the farm entry and returns undefined for a missing (id, kind) pair; getCodex() on a runner returns { entries, categories, lookup } wired to the same data (campaign.test.ts + runner-accessors).
  </behavior>
  <action>
    Enrich the codex and add the missing categories per CONTEXT §Codex — derived from catalogs only (RESEARCH no-hand-roll):

    1. src/sim/campaign.ts — widen `CodexEntry`:
       - `kind: 'building'|'commodity'|'service'|'god'|'chain'|'housing'|'desirability'|'trade'|'finance'|'ratings'|'religion'|'risks'|'shortcuts'`.
       - Add the per-entry fields: `description?`, `howItWorks?`, `inputs?: string[]`, `outputs?: string[]`, `workers?: number`, `cost?: number`, `hints?: string[]`, `requirements?: string[]`, `relatedLinks?: string[]`.
       - Keep `id`/`name`/`blurb` (blurb = short text).
    2. Enrich the four existing buildCodex loops:
       - building: fill cost/workers from BuildingDef.cost/workers, outputs from produces, inputs from consumes, requirements from (footprint size, requiresRoad, storageCapacity, spawns, serviceRadius, requiredPopulation when present), howItWorks from category + footprint + produces/consumes wording, relatedLinks to the commodities it produces/consumes and to the housing levels it serves.
       - commodity: fill category, durabilityMonths→description hint, baseImportPrice/baseExportPrice/houseGood/tradable into howItWorks/hints, relatedLinks to its producing buildings (reverse produce scan) + consuming workshops/levels.
       - service/walker: fill service + spawnedBy, relatedLinks to the spawned buildings + a housing entry.
       - god: fill from GODS + the FESTIVAL_TIERS favor info (relatedLink to festival/favor + temples).
       - If a field has NO catalog source (e.g. 'hints' wording), compose it deterministically from existing names (e.g. `Blurb: <name>`), never invent numeric facts.
    3. Add the nine missing categories (each a function building Catalog-derived entries — pure, no RNG):
       - chains: for each workshop/extractor join produces/consumes (e.g. clay_pit→pottery→market, timber_yard→furniture, olives→oil, grapes→wine, iron→tools, farm/orchard/vegetable/cattle/fishing→foods) — one entry per product chain.
       - housing: one entry per HOUSING_LEVELS tier group (or per HOUSING tier via tierOfLevel) populated from requires/requiresGoods/desirability/capacity + the level footprint ladder.
       - desirability: entries for the level desirability thresholds (from data/housing) + services that raise it (wells/fountains/ornament/religion — from the building categories that deliver desirable factors).
       - trade: one entry per TRADE_CITIES (buys/sells/quotas/landOrSea/priceModifier) plus a 'trade' overview entry.
       - finance: treasury mechanics (royal subsidy cap from CONFIG.royalSubsidyCap, loan max/interest from CONFIG/balance, tax/wage floors) — read from the catalogs; numeric facts must match live config.
       - ratings: one entry per rating (culture/prosperity/stability/favor) explaining the factor decomposition from the ratings W weights and computeTargets inputs (catalog-derived — must match live math, RESEARCH don't-hand-roll 'ratings/favor math for codex').
       - religion: one entry per god + a festivals entry (FESTIVAL_TIERS tiers/costs/favorBoost).
       - risks: one entry per event type in data/events.ts explaining triggers + the derived risk factors (fire/collapse/crime).
       - shortcuts: a single 'shortcuts' entry describing the game controls (STATIC descriptive text — the one category with no catalog source; document this explicit no-hand-roll exception in a comment because the spec requires the category).
    4. src/sim/runner.ts — add `getCodex(): { entries: CodexEntry[]; categories: Record<string, number>; lookupEntry: (id: string, kind?: CodexKind) => CodexEntry | undefined }` — cache the built codex once (module-level or runner-level memo so derivedSnapshot()'s per-snapshot codex work stays cheap; keep `buildCodex()` pure). `lookupEntry(id, kind)` scans entries by id (and optional kind — id is unique per the catalogs). In derivedSnapshot (:1312,1325), keep the codex COUNT filtered to the four original kinds (buildings/commodities/services/gods) so the golden/derived surface is untouched — reuse the cached codex for the count.
    5. Flip green: the codex field-completeness/category-presence/catalog-equality/lookup cases in the Wave-0 codex describe + the runner-accessors getCodex() case.
    Discretion resolved here: entry wording derives from existing names/blurbs; category entry sets are the RESEARCH-listed ones; the single 'shortcuts' exception is documented.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && npx vitest run tests/unit/campaign.test.ts tests/runner-accessors.test.ts -x</automated>
  </verify>
  <acceptance_criteria>buildCodex() emits enriched entries for buildings/commodities/services/gods whose fields match the catalogs and entries for all nine new kinds; getCodex() exposes entries + per-category counts + lookupEntry(id, kind); derivedSnapshot codex counts stay the four-kind filter; the codex coverage/lookup scaffolds are green and no golden regenerated.</acceptance_criteria>
  <done>The codex covers all twelve categories with catalog-derived per-entry fields and phase-ready lookup, exposed via getCodex(), with the derived snapshot count surface untouched and no golden changes.</done>
</task>

<!-- ===================== WAVE 3 close — winnability probe + retune ===================== -->

<task type="auto">
  <name>Task 17-03-02: Winnability probe test + mission target retuning to verified ceilings + full-suite/military close</name>
  <files>tests/winnability-probe.test.ts, data/missions.ts, tests/missions.test.ts, tests/unit/campaign.test.ts, tests/runner-accessors.test.ts</files>
  <read_first>
    - tests/helpers.ts:37-111 (buildFoodCity/buildProductionCity — the probe reuses them on the mission's own map), tests/runner-accessors.test.ts:298-352 (scripted event-wiring city harness style)
    - data/missions.ts (the 10 entries' targets to retune), 17-RESEARCH.md Per-Mission Winnability table + Global ceilings (ratings ≤ 85 only on the final long-limit mission, annualExports ≤ 100, favor ≤ 80, treasury ≤ 15k, population within the 40×40 level-capacity fits)
    - src/sim/runner.ts (startMission gate is a fresh-runner-any-first-mission — the probe can start any single mission on a fresh runner, per 17-01-01)
  </read_first>
  <behavior>
    - Test 1: for each of the 10 missions, a fresh runner on that mission's map with the helper-built city meets every target ceiling (population/ratings/favor/treasury/annualExports) TRANSIENTLY within timeLimitYears*360 ticks — one `it` per mission, explicitly asserting missions 4 (grand_city), 8 (cultural_center) and 10 (metropolis) (winnability-probe.test.ts).
    - Test 2: mission 10 (metropolis) targets are eased to 80/80/80 (or a 30-year limit) if the 85/85/85 probe fails — the mission remains the hardest but is winnable inside its limit (data/missions.ts tuning + probe green).
    - Test 3: after retuning, the rewritten Wave-0 target assertion still holds — every target is a finite non-negative number when present (tests/missions.test.ts) and the full suite + typecheck + check:military are green together.
  </behavior>
  <action>
    De-risk winnability and close the phase (decision CAMPAIGN-01 success criterion 1 + RESEARCH Pitfall 3/Open Q2):

    1. Create tests/winnability-probe.test.ts — one describe 'winnability probe', one `it` per mission (10). For mission id in campaignMissions(): construct `const def = MISSIONS[id] ?? EXTRA_MISSIONS[id]`; `const map = missionMap(def) ?? productionChainMap()`; `const r = new SimRunner(seed, map)`; build the mission city by reusing buildFoodCity/buildProductionCity on the map and adding the mission's preplace starter buildings (via r.placeBuilding for each preplace entry, throw on failure); `r.startMission(id)`; then tick to `(def.modifiers?.timeLimitYears ?? def.timeLimitYears ?? 30) * 360`; at the end (and tracked max over ticks) assert every present target ceiling is reached at least transiently — population/ratings/favor/treasury/annualExports via r.getDerived(). Prefer a small seed set (e.g. seeds [1, 7]) per mission so the suite stays fast; keep the assertion on the CEILING (reachability), not the 3-month sustain (research: "assert the ceiling first — winnability of the ceiling, not the sustain"). Mission-city builders: reuse helpers; when a mission's map already preplaces key buildings, the probe must not double-place (place only the mission's preplace onto the helper city, or build on the mission map alone — pick per mission so placement stays valid).
    2. data/missions.ts retuning (Wave 1 set the arc/flavor; this closes winnability): honor the verified ceilings — per-mission targets from the RESEARCH table, mission 10 (metropolis) eased to 80/80/80 (or timeLimitYears 30 — try 80/80/80 first), annualExports targets ≤ 100, favor ≤ 80, treasury ≤ 15k; where the probe fails, lower the offending target one notch and re-run until the probe is green for all 10 while keeping the gradual-introduction arc (mission 1 easiest → 10 hardest). Keep ids and startingDenarii semantics; adjust modifiers.startingTreasuryCredit if a mission needs a higher start.
    3. Re-run the full affected suites (tests/missions.test.ts rewritten target assertion from Wave 0 must hold) + the full suite + typecheck + check:military as the phase close gate. Confirm no Math.random/Date.now/new Date in the new sim/data paths (the determinism source-audit from 17-00-01 already gates campaign.ts/missionMaps.ts — extend the runner audit message if needed, but the only Date.now remains savedAt). Confirm no golden regeneration (missions/tutorial/codex never enter getState()/golden fixtures — getState() at runner.ts:1701 carries no mission/codex/tutorial fields).
    Discretion resolved here: exact retuned numbers are empirical (probe-driven) within the pinned ceilings, and the probe seed set is small for runtime.
  </action>
  <verify>
    <automated>cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4 && npm run check:military</automated>
  </verify>
  <acceptance_criteria>tests/winnability-probe.test.ts asserts all 10 mission target ceilings (explicitly 4/8/10) are reachable within each mission's time limit on the mission map; mission 10 retuned to 80/80/80 or 30y as the probe dictates; every target stays a finite non-negative number when present; full suite (unit+integration+determinism+golden+property), typecheck and check:military green together; no golden fixture changed.</acceptance_criteria>
  <done>The winnability probe proves every mission reachable within its time limit (missions 4/8/10 explicit), targets are retuned inside the verified ceilings, and the full suite + typecheck + military gate close Phase 17 green with no golden changes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Data catalogs → load-time gate | data/missions.ts (new map/products/routes/modifiers fields on 10 missions) is untrusted-as-checks input validated once at construction (validateCatalogs(); data/validate.ts missions loop, extended over MISSIONS + EXTRA_MISSIONS). |
| Save file → applyCommand | a tampered save's Unknown SaveCommand kind or a malformed startMission/dismissTutorialStep is rejected by the exhaustive dispatch at replay — replay fails loudly, never silently corrupts. |
| Runner tick → mission/tutorial state | the new startMission sub-effects and the dismissed-tutorial set must be replay-derivable from saveCommands + tickCount; a self-recording sub-effect or wall-clock predicate breaks byte-identity. |
| Live player call → startMission gate | the sequential unlock gate is LIVE-ONLY (skipped during replay); an unskipped gate would block a replayed startMission(N) because N-1's completion happens only during post-replay month ticks. |
| getStateJson → golden fixtures | mission/tutorial/codex stay runner-private or derived — they must NOT enter getState()/goldens (no golden regeneration). |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-17-01 | Tampering | data/missions.ts map/products/routes/modifiers malformed (out-of-bounds layout, unknown commodity/city id, NaN modifier) crashing the sim | high | mitigate | data/validate.ts missions loop extended over MISSIONS AND EXTRA_MISSIONS (layout grid shape + legend ⊆ TileType, products ⊆ COMMODITIES, routes[].cityId ∈ TRADE_CITIES, finite modifiers) enforced at construction via validateCatalogs(); data-catalog tests assert validateCatalogs() === [] (17-01-02). |
| T-17-02 | Tampering | unknown SaveCommand kind (incl. a forged startMission/dismissTutorialStep shape) injected via a save file | medium | mitigate | exhaustive applyCommand `else { const exhaustive: never = cmd; }` throws on unknown kinds (runner.ts:2843-2846); the two new kinds are union members validated at dispatch (17-01-01/17-02-01). |
| T-17-03 | Tampering | startMission sub-effects (treasury credit/preplaced buildings/routes) self-recording → saveCommands duplicates and exponential growth on save→load→save cycles | high | mitigate | suppressCommandRecording guard around the sub-effect calls so the single {kind:'startMission'} command is the complete deterministic record; verified by the determinism no-growth case (17-01-03). |
| T-17-04 | Integrity | time-limit landmine — mission.year hardcoded 0 makes a time-limited mission started on an already-ticked runner fail at the next month gate | high | mitigate | startMission records year = Math.floor(tickCount/360); regression test starts a 10-year mission on a >year-13 runner and asserts not instantly failed (17-01-01). |
| T-17-05 | DoS | tutorial predicates throw on edge state (empty city, no houses) or read wall-clock → crash or non-deterministic guidance | medium | mitigate | every predicate is a pure TOTAL function over (derived, houses, city) guarding empty arrays; empty-city edge-case describe (17-02-02); source-audit forbids Math.random/Date.now/new Date in campaign.ts/missionMaps.ts (17-00-01). |
| T-17-06 | Tampering | non-determinism in new sim paths (Math.random/Date.now/new Date in campaign.ts/runner.ts/missionMaps.ts) breaking byte-identical replay | high | mitigate | determinism byte-identity (chunked 1/7/50 + save/load) for startMission + dismissTutorialStep (17-00-01/17-01-01) and the source-audit over campaign.ts/missionMaps.ts + the runner's single savedAt Date.now (17-00-01). |
| T-17-07 | Tampering | unwinnable targets (ratings ≥ 85, annualExports > 100, favor > 80) stall the campaign at mission N — success criterion 1 fails | medium | mitigate | winnability probe test (one it per mission, targets reachable within timeLimitYears) + pinned ceiling retuning incl. mission 10 → 80/80/80 (17-03-02). |
| T-17-08 | Information Disclosure | codex/ratings content contradicting live math (a 'codex lies' hazard for the single-player game) | medium | mitigate | codex fields derived from catalogs only (building cost/workers, commodity prices, ratings W weights, housing requires) — never hand-copied numbers; the single 'shortcuts' static-text exception is documented (17-03-01). |
| T-17-SC | Tampering | npm/pip/cargo installs | low | accept | Accepted: this phase installs no packages (RESEARCH Package Legitimacy Audit: none); if a later phase adds one it re-enters the gate. |

## Mitigation Notes for ASVS Level 1
- V5 Input Validation is the only applicable control: mission data (map/products/routes/modifiers) is validated at load time (both catalogs) and by data-catalog tests; exhaustive applyCommand rejects unknown SaveCommand kinds; placement of preplaced mission buildings reuses the existing placement gates (coordinate validation).
- V2/V3/V4/V6 are N/A — local offline single-player deterministic sim with no identities, sessions, access control, or crypto; the phase's real 'security' property is deterministic state integrity (byte-identical replay), enforced by the Wave-0 determinism suite + the no-RNG/clock source audit.
</threat_model>

<verification>
- After every task commit: run that task's `<automated>` command (all < 60s except the Wave-3 full-suite close). Wave-0's gate is `test -f` for the new determinism file plus typecheck (the scaffolds are expected RED).
- After every wave: `cd /Users/filipe.esch/projects/pessoal/opencaesar && npm run typecheck && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` — full suite green EXCEPT the declared-RED scaffolds at that point: after Wave 1 the modifier/map-application cases, the full tutorial cause-scenario cases and the codex category/lookup cases + the winnability probe are knowingly RED (each implementing task flips its targets); after Wave 2 only the codex + winnability scaffolds remain RED; after Wave 3 everything is green.
- After every wave: `npm run check:military` green (mission names/descriptions + tutorial/codex copy carry no military tokens).
- Wave 3 close: full suite + typecheck + military all green before /gsd-verify-work; confirm no golden fixture changed (mission/tutorial/codex never enter getState()).
- Determinism guarantees: startMission's whole effect and the dismissed-tutorial set must reconstruct from saveCommands + tickCount (fromSaveData contract) — the only new SaveCommand kinds are startMission/dismissTutorialStep; no SaveData schema change; the only Date.now allowed anywhere is getSaveData's savedAt.
</verification>

<success_criteria>
1. CAMPAIGN-01: the 10 missions are playable and winnable in sequence — each defines map/objectives/products/routes/modifiers (additive MissionDef, validated over both catalogs), mission start is a replayable SaveCommand that fixes the start-year landmine and survives save/load byte-identically, and mission N+1 unlocks only when N is won (sequential gate live-only); the winnability probe proves every mission's targets reachable within its time limit (mission 10 within an 80/80/80-or-30y ceiling).
2. CAMPAIGN-02: tutorial prompts appear contextually as the player encounters systems — each step is triggered by a pure total predicate over live DerivedSnapshot/per-house state (no wall-clock), carries short/expanded/codex-ref/show-where highlight, the ordered introduction seed is preserved, and 'don't show again' is a replayable dismissTutorialStep command that survives save/load; getTutorial() is a pure derived accessor.
3. CAMPAIGN-03: the codex explains every building, good, service, and god plus the nine additional categories, with per-entry description/howItWorks/inputs/outputs/workers/cost/hints/requirements/relatedLinks derived from the data catalogs and exposed via getCodex() + lookupEntry(id, kind).
4. Gates: full suite (unit/integration/determinism/golden/property) + typecheck + check:military green; no new SaveData schema fields; no golden regeneration; no Math.random/Date.now/new Date in the new sim/data paths (only getSaveData's savedAt).
</success_criteria>

<output>
Create `.planning/phases/17-campaign-tutorial-codex/17-SUMMARY.md` when the phase is done and verified (per the execute-plan workflow / summary template).
</output>
