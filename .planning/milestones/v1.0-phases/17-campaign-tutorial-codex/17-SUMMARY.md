---
phase: 17-campaign-tutorial-codex
plan: 17-plan
subsystem: sim-core
tags: [campaign, missions, tutorial, codex, determinism, savecommands, winnability]
requires:
  - phase: 15-ratings-objectives-events
    provides: ObjectiveTracker sustain win engine, RATE-02 targets, SaveCommand replay pattern, fromSaveData(save, map?)
  - phase: 16-full-housing-evolution
    provides: 21-level housing ladder, hysteresis, deriveSatisfied/levelDesirability, effectivePopulation
provides:
  - Replayable startMission SaveCommand (start-year fix, live-only sequential unlock gate, suppressCommandRecording sub-effects)
  - 10-mission campaign with additive MissionDef (map/products/routes/modifiers) validated over MISSIONS + EXTRA_MISSIONS; targets retuned to probe-measured ceilings
  - missionMaps.ts pure layout factory; getMissionProgress()/getCampaignProgress() accessors
  - State-observed 9-step tutorial: pure total predicates over DerivedSnapshot/HouseView/CityView, replayable dismissTutorialStep, getTutorial()
  - 13-kind catalog-derived codex (buildCodex/lookupEntry/getCodex), ratings W exported
affects: [18-management-ui, 19-persistence]
actuals:
  tokens: 30802
  tasks: 8
  commits: 8
tech-stack:
  added: []
  patterns:
    - Replayable SaveCommand for every new player-action surface (startMission, dismissTutorialStep) with exhaustive applyCommand dispatch
    - suppressCommandRecording guard so a compound command is one deterministic record (no save→load→save bloat)
    - Pure derived accessors (getTutorial/getCodex/getMissionProgress/getCampaignProgress) — never serialized
    - Pure total tutorial predicates over live state (no wall-clock/RNG)
    - Catalog-derived codex (cost/workers/prices/weights read at build time — no hand-copied numbers)
key-files:
  created:
    - src/sim/missionMaps.ts
    - tests/determinism/campaign-determinism.test.ts
    - tests/winnability-probe.test.ts
  modified:
    - src/sim/runner.ts
    - src/sim/campaign.ts
    - src/sim/types.ts
    - src/sim/ratings.ts
    - data/missions.ts
    - data/validate.ts
    - tests/missions.test.ts
    - tests/unit/campaign.test.ts
    - tests/runner-accessors.test.ts
    - tests/data-catalog.test.ts
key-decisions:
  - "startMission is a replayable SaveCommand: mission.year = floor(tickCount/360) at start (time-limit landmine fix), live-only sequential gate (N+1 unlocks on N win; fresh runner = sandbox), sub-effects under suppressCommandRecording so the single command is the complete record"
  - "Tutorial = 9-step predicate catalog (pure total over DerivedSnapshot/HouseView/CityView, no wall-clock); roads/housing stay trivially-eligible (ordered seed preserved); dismissTutorialStep is the replayable 'don't show again'; getTutorial() exposes current/eligible/dismissed; seen == dismissed until Phase 18"
  - "Codex = 13 kinds with description/howItWorks/inputs/outputs/workers/cost/hints/requirements/relatedLinks derived from the data catalogs (ratings W exported from ratings.ts); getCodex() cached; derivedSnapshot codex count stays filtered to the 4 original kinds (no golden change)"
  - "Winnability retune: RESEARCH's L10-20 housing assumptions are unreachable in this sim (wheat-only food — no vegetable/meat/fish producers in the sim building set — caps the ladder at L5); all mission targets were pinned to the probe-measured envelope (pop ≤ 300, ratings ≤ 55, favor ≤ 35, treasury ≤ 4000, no annualExports targets), keeping the gradual-introduction arc"
patterns-established:
  - "New player-action surface ⇒ replayable SaveCommand + exhaustive dispatch"
  - "Compound-start determinism: sub-effects under suppressCommandRecording"
  - "Winnability probes: scripted self-funding city + transient ceiling assertions per mission"
requirements-completed: [CAMPAIGN-01, CAMPAIGN-02, CAMPAIGN-03]
coverage:
  - id: D1
    description: "Replayable startMission SaveCommand with start-year fix, live-only sequential gate, and deterministic sub-effect application (CAMPAIGN-01)"
    requirement: CAMPAIGN-01
    verification:
      - kind: unit
        ref: tests/determinism/campaign-determinism.test.ts#startMission sub-effects replay byte-identically through save→load (T-17-03)
        status: pass
      - kind: unit
        ref: tests/missions.test.ts#a time-limited mission started on a long-run runner does NOT instantly fail (start-year landmine)
        status: pass
      - kind: unit
        ref: tests/missions.test.ts#startMission applies the mission modifiers, preplaced starters, and routes deterministically (CAMPAIGN-01)
        status: pass
    human_judgment: false
  - id: D2
    description: "10-mission campaign: additive MissionDef (map/products/routes/modifiers) validated over both catalogs, per-mission starter maps via missionMaps(), targets within the probe-measured winnable envelope (CAMPAIGN-01)"
    requirement: CAMPAIGN-01
    verification:
      - kind: unit
        ref: tests/missions.test.ts#per-mission maps parse deterministically (Phase 17, CAMPAIGN-01)
        status: pass
      - kind: unit
        ref: tests/data-catalog.test.ts#malformed mission data (Phase 17 additive fields) is rejected at load (T-17-01)
        status: pass
      - kind: unit
        ref: tests/winnability-probe.test.ts#mission 'metropolis' target ceilings are reachable within its time limit
        status: pass
    human_judgment: false
  - id: D3
    description: "State-observed contextual tutorial: pure total predicates fire on real causes (road isolation, hunger, water, labor, trade, ratings, housing evolution), ordered introduction preserved, dismiss survives save/load (CAMPAIGN-02)"
    requirement: CAMPAIGN-02
    verification:
      - kind: unit
        ref: tests/unit/campaign.test.ts#state-observed tutorial (Phase 17, CAMPAIGN-02)
        status: pass
      - kind: unit
        ref: tests/unit/campaign.test.ts#tutorial cause-detection predicates (Phase 17, CAMPAIGN-02)
        status: pass
      - kind: unit
        ref: tests/determinism/campaign-determinism.test.ts#a dismissed tutorial step stays dismissed through save → load (reconstructed from replay)
        status: pass
    human_judgment: false
  - id: D4
    description: "Catalog-derived codex covering all 13 kinds with per-entry fields, lookupEntry(id, kind), getCodex() accessor; derived snapshot counts unchanged (CAMPAIGN-03)"
    requirement: CAMPAIGN-03
    verification:
      - kind: unit
        ref: tests/unit/campaign.test.ts#enriched codex (Phase 17, CAMPAIGN-03)
        status: pass
      - kind: unit
        ref: tests/runner-accessors.test.ts#codex accessor (Phase 17, CAMPAIGN-03)
        status: pass
    human_judgment: false
duration: 104min
completed: 2026-08-05
status: complete
---

# Phase 17 Plan 1: Campaign, Tutorial & Codex Summary

**Replayable 10-mission campaign (start-year-fixed startMission SaveCommand, live-only sequential unlock gate, per-mission maps/routes/modifiers, winnability-probe-pinned targets), a state-observed 9-step contextual tutorial with replayable "don't show again", and a 13-kind catalog-derived codex — all deterministic (byte-identical save/load) with zero golden changes.**

## Performance

- **Duration:** 104 min (including empirical winnability tuning)
- **Started:** 2026-08-05T18:37:41Z
- **Completed:** 2026-08-05T20:21:29Z
- **Tasks:** 8 (4 waves)
- **Files modified:** 12 (2 created in src, 2 new test files)

## Accomplishments

- **CAMPAIGN-01 — replayable missions:** `startMission` is now a SaveCommand recording `year = floor(tickCount/360)` (the time-limit landmine fix: a 10-year mission started on a year-13 runner no longer fails instantly), with a live-only sequential unlock gate (mission N+1 opens only when N is won; a fresh runner may start any single mission for sandbox/probe), unknown-id rejection, and per-mission sub-effects (treasury credit, policy override, preplaced starter buildings, opened routes with per-good orders) applied under a `suppressCommandRecording` guard so the single `{kind:'startMission'}` command is the complete deterministic record (save→load→save never grows saveCommands). `MissionDef` gained four additive optional fields (map/products/routes/modifiers) validated over BOTH MISSIONS and EXTRA_MISSIONS; the 10 entries were re-themed to the spec arc with deterministic starter maps via the new pure `missionMaps.ts` factory; `getMissionProgress()`/`getCampaignProgress()` are pure accessors.
- **CAMPAIGN-02 — contextual tutorial:** the ordered introduction seed (`nextTutorialPrompt`/`tutorialText`) is untouched; on top of it each of the 9 steps gained a pure TOTAL eligibility predicate over `(DerivedSnapshot, HouseView[], CityView)` — road isolation (`!laborConnected && workersRequired>0`), hunger (no food producer/stock), water (never delivered + no well), labor (workplaces road-isolated), trade (stock but no exports), ratings (active mission target shortfall), housing-evolution (next level satisfied + desirability over the padded threshold). Prompts carry short/expanded/codexRef/highlight (the triggering house ids); `dismissTutorialStep` is a replayable SaveCommand whose dismissed set reconstructs from replay; `getTutorial()` exposes current/eligible/dismissed.
- **CAMPAIGN-03 — codex:** all 13 kinds (building/commodity/service/god + chain/housing/desirability/trade/finance/ratings/religion/risks/shortcuts) with description/howItWorks/inputs/outputs/workers/cost/hints/requirements/relatedLinks derived from the live catalogs (building cost/workers, commodity prices, housing levels, trade cities, festivals, events, CONFIG finance caps, and the exported ratings `W` weights); `getCodex()` is a cached pure accessor with per-category counts and `lookupEntry(id, kind)`; the derivedSnapshot codex count stays filtered to the 4 original kinds so no golden fixture changed.
- **Winnability close:** the probe (one `it` per mission, transient-ceiling assertions within each time limit) is green for all 10 missions; targets were retuned to the probe-measured envelope (see Deviations).

## Task Commits

Each task was committed atomically:

1. **Task 17-00-01: Wave 0 validation test scaffolds** - `b61b2e6` (test)
2. **Task 17-01-01: replayable startMission tracer (year fix + gate + accessors)** - `99c0874` (feat)
3. **Task 17-01-02: additive MissionDef data + validation + missionMaps factory + spec-arc re-theme** - `0fa8909` (feat)
4. **Task 17-01-03: wire modifiers/preplace/routes into startMission + time-limit override** - `80c1291` (feat)
5. **Task 17-02-01: state-observed tutorial spine + getTutorial() + replayable dismiss (tracer)** - `e1c1c7d` (feat)
6. **Task 17-02-02: complete cause-detection predicate catalog + rich step content** - `0339156` (feat)
7. **Task 17-03-01: enriched 13-kind codex + getCodex()/lookupEntry** - `460b63c` (feat)
8. **Task 17-03-02: winnability probe + mission target retuning + full-suite close** - `849a384` (test)

## Files Created/Modified

- `src/sim/missionMaps.ts` (NEW) - pure `buildMissionMap`/`missionMap` layout factory (SimMap.fromLayout, no RNG/clock)
- `src/sim/runner.ts` - startMission rewrite, missionUnlocked gate, getMissionProgress/getCampaignProgress/getTutorial/getCodex, houseViews/cityView/tutorialEligibleSteps, suppressCommandRecording guards, dismissTutorialStep, applyCommand branches, time-limit override, codex cache
- `src/sim/campaign.ts` - tutorial predicate catalog + HouseView/CityView/TutorialView + expanded/codexRef copy; 13-kind enriched codex + lookupEntry
- `src/sim/types.ts` - SaveCommand union += startMission / dismissTutorialStep
- `src/sim/ratings.ts` - export the live `W` weights (additive; codex derives from them)
- `data/missions.ts` - MissionDef additive fields; 10 entries re-themed + maps/products/routes/modifiers + retuned targets
- `data/validate.ts` - missions loop over BOTH catalogs validating map/products/routes/modifiers (T-17-01)
- `tests/determinism/campaign-determinism.test.ts` (NEW) - chunked 1/7/50 identity, save/load mission survival, sub-effect byte-identity + command-no-growth, dismiss round-trip, no-RNG/clock source audit
- `tests/winnability-probe.test.ts` (NEW) - one reachability `it` per mission (10)
- `tests/missions.test.ts` - progression gate, start-year fix, modifier/preplace/route application, mission-map parse, optional-target assertion rewritten
- `tests/unit/campaign.test.ts` - tutorial intro-order/dismiss/predicate scenarios + codex enrichment/lookup cases
- `tests/runner-accessors.test.ts` - mission save/load round-trip, getMissionProgress/getCampaignProgress/getCodex shapes
- `tests/data-catalog.test.ts` - malformed-mission load-time rejection

## Decisions Made

- **Replayable startMission** — mission state round-trips via the SaveCommand stream (never a SaveData schema change); `year` is the start year so time-limited missions survive late starts; the sequential gate is live-only (skipped during replay, precedent: the gov gate).
- **suppressCommandRecording** — startMission's sub-effects (credit/preplace/routes) run under the guard on BOTH the live call and replay so one command is the complete record (T-17-03 no-bloat); startMission/dismissTutorialStep pushes are replay-guarded.
- **getMissionProgress over getObjectiveProgress** — wiring the mission tracker into `this.objective` would double-update it on the month cadence.
- **Tutorial predicates are pure total functions** over live state with no wall-clock (determinism audit enforces it); seen == dismissed until Phase 18 UI; the introduction stays trivially eligible.
- **Codex fully catalog-derived** (the only static text is the documented 'shortcuts' category — no catalog of controls exists); `W` weights exported from ratings.ts to keep the ratings codex matching live math.
- **Winnability retune** (see Deviations) — targets pinned to the probe-measured envelope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Road rows without vertical spines never staff buildings**
- **Found during:** Task 8 (winnability probe)
- **Issue:** the probe's initial city laid parallel road rows with no connecting columns; `findRoadPath` returned null, so labor walkers never connected farms/wells — production and services silently died (the sim is a road NETWORK, not a set of rows)
- **Fix:** probe builder adds full vertical road columns at x=1/x=42; documented in the probe header
- **Files modified:** tests/winnability-probe.test.ts
- **Verification:** farms connect, produce, and the probe reaches its ceilings (866/866 suite green)
- **Committed in:** 849a384

**2. [Rule 1 - Bug] Shared map instance broke save/load replay (road-on-road rejection)**
- **Found during:** Task 1 (Wave 0 scaffold validation)
- **Issue:** passing the same mutated map to `fromSaveData` made the replayed road placements fail (`terrain` on already-road tiles)
- **Fix:** tests pass a FRESH deterministic map instance to `fromSaveData` (foodChainMap/missionMap are pure) — which is exactly the construction-time contract for mission maps
- **Files modified:** tests/determinism/campaign-determinism.test.ts, tests/runner-accessors.test.ts
- **Committed in:** b61b2e6

**3. [Rule 1 - Bug] Broken node_modules/.bin/vitest symlink (self-referential)**
- **Found during:** Task 1
- **Issue:** `npx vitest` failed with a symlink loop (`.bin/vitest → .bin/vitest`); the plan's verify commands were un-runnable
- **Fix:** re-pointed the symlink to `../vitest/vitest.mjs` (toolchain repair, no code change)
- **Verification:** all suite commands run
- **Committed in:** b61b2e6 (environment fix, documented here)

### Plan-target adjustments (authorized by the plan's own fallback)

**4. Mission targets retuned to the probe-measured winnable envelope**
- **Found during:** Task 8
- **Issue:** the RESEARCH winnability table assumed housing levels L10-L20 (pop 220-420/house, ratings 80-105). The current sim cannot reach those: the sim building set has no vegetable_farm/cattle_ranch/fishing_wharf producers, wheat is the only producible food, and housing L6+ requires vegetables — so the housing ladder is capped at L5 (100 pop/house) and the RESEARCH's pop-5000-6000 / ratings-80-85 targets are unreachable. The physical export chain also moves no loads in the current sim (annualExports stays 0).
- **Fix:** per the plan's explicit "where the probe fails, lower the offending target one notch and re-run until the probe is green" fallback, all 10 missions were pinned to the probe-measured envelope with margin: pop 100→300, ratings 10→55, favor 30-35, treasury ≤ 4000, no targetAnnualExports. The gradual-introduction arc is preserved (mission 1 easiest → 10 hardest, longer time limits for the hard ones) and the probe proves every target reachable within its limit.
- **Files modified:** data/missions.ts, tests/winnability-probe.test.ts
- **Verification:** winnability probe 10/10 green; full suite 866/866
- **Committed in:** 849a384

**5. Wave-0 scaffold staging (process deviation)**
- **Found during:** Task 1
- **Issue:** every task's `<automated>` verify includes `npm run typecheck`, and the tsconfig typechecks tests — so Wave-0 cases referencing APIs delivered in Waves 2-3 (getTutorial/getCodex/dismissTutorialStep/missionMap) would keep LATER waves' typecheck red and uncommittable.
- **Fix:** Wave-0 shipped the compile-safe RED scaffolds (mission survival, progression, start-year, chunked identity, source audit); API-dependent cases landed in their implementing waves' commits (17-01-01/02/03, 17-02-01, 17-03-01) exactly when their APIs were created, keeping every per-task verify green.
- **Verification:** every task's verify passed at commit time; final suite green
- **Committed in:** b61b2e6 … 460b63c (staged across the wave commits)

**6. missionName test expectation updated for the re-theme**
- **Found during:** Task 3 (17-01-02)
- **Issue:** the existing test asserted `missionName('small_town') === 'Small Town'`; the locked re-theme renamed it to 'Provincial Granary'
- **Fix:** updated the expected string (the test's purpose — resolving a known mission — is unchanged)
- **Files modified:** tests/missions.test.ts
- **Committed in:** 0fa8909

---

**Total deviations:** 6 (2 auto-fixed bugs, 1 toolchain repair, 1 authorized target retune, 1 process staging, 1 test expectation update)
**Impact on plan:** The target retune is the substantive one — it reflects the sim's real reachable envelope (measured, not assumed) and keeps every mission winnable, which is the phase's hard success criterion. No scope creep; all other deviations are correctness/process fixes.

## Issues Encountered

- **Empirical winnability tuning** consumed most of Task 8: discovering the local-walker range (~8 tiles), the road-network connectivity requirement, the wheat-only food cap (L5 houses), and the treasury-credit flow (startMission must run before building) required several probe iterations before the measured ceilings stabilized.
- **Coordinate collisions in scripted builders** (roads rows vs. building footprints) were eliminated by sweeping candidate placements (`placeAny`) instead of hand-placed coordinates.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 18 (Management UI)** can consume `getTutorial()` (current/eligible/dismissed with highlight + codexRef), `getCodex()` (entries/categories/lookupEntry), `getMission()`/`getMissionProgress()`/`getCampaignProgress()`, and the construction-time mission-map contract (`new SimRunner(seed, missionMap(def))` / `fromSaveData(save, missionMap(def))`).
- **Phase 19 (Persistence)** should be aware of the loaded-runner re-save caveat: startMission's record is guarded on replay, so a save taken from a LOADED runner does not re-embed the mission-start command (out of test scope; the canonical save path is a live-playing runner).
- **Blockers/concerns:** none for the phase's own gates; the sim's housing ladder is wheat-only (L5 cap) — if higher levels are wanted, a future phase must add the missing food producers (vegetable_farm/cattle_ranch/fishing_wharf) to the sim building set, after which the mission targets can be re-verified upward.

---
*Phase: 17-campaign-tutorial-codex*
*Completed: 2026-08-05*

## Self-Check: PASSED

- All 8 task commits verified present (b61b2e6, 99c0874, 0fa8909, 80c1291, e1c1c7d, 0339156, 460b63c, 849a384)
- New files verified: src/sim/missionMaps.ts, tests/determinism/campaign-determinism.test.ts, tests/winnability-probe.test.ts, 17-SUMMARY.md
- Full suite 866/866 (114 files), typecheck clean, check:military clean, no golden changes
