# Phase 17: Campaign, Tutorial & Codex - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous, user accepted all recommended answers)

<domain>
## Phase Boundary

Deliver a 10-mission campaign (winnable in sequence, introducing systems
gradually), a contextual tutorial that observes the real sim state and explains
actual blocking causes, and an in-game codex that explains every building,
good, service, and god with related links. Covers CAMPAIGN-01 (10 missions),
CAMPAIGN-02 (contextual tutorial), CAMPAIGN-03 (codex).

</domain>

<decisions>
## Implementation Decisions

### Campaign Missions (CAMPAIGN-01)
- The 10 missions follow the spec's gradual-introduction arc: (1) riverside foundations, (2) provincial granary, (3) clay and fire, (4) trade roads, (5) water for all, (6) city of scholars, (7) favors of the gods, (8) southern port, (9) city of patricians, (10) provincial capital.
- Each mission SHALL define its map (start layout via layout string / pre-placed buildings), objectives (sustained targets via the existing ObjectiveTracker: population/ratings/favor/treasury/annualExports + sustainChecks default 3 months), products (goods chain emphasis), routes (open trade routes/quotas), and modifiers (starting treasury, time limits, optional difficulty knobs) — loaded deterministically when the mission is selected.
- Existing `MISSIONS`/`EXTRA_MISSIONS` (data/missions.ts, 10 entries) are the base: extend `MissionDef` additively with optional map/products/routes/modifiers fields; every existing entry stays valid (new fields undefined → no change).
- Mission completion already runs through the sustained `ObjectiveTracker` (runner tickMissionSystem, RATE-02); campaign progression unlocks mission N+1 only when mission N is won (sequential playability); the campaign is winnable end-to-end (success criterion 1).

### Contextual Tutorial (CAMPAIGN-02)
- Tutorial steps are triggered by OBSERVED sim state, not a rigid sequence: e.g., player built houses but no immigrants → check road-to-entry, vacancies, attractiveness → explain the ACTUAL blocking cause (road absent, no vacancies, low attractiveness).
- Each step carries short text + expanded explanation + a codex entry reference; the sim exposes a `tutorialState` derived view (which steps are eligible, which seen/dismissed) so the UI can render highlight/short text/expanded/show-where/don't-show-again.
- `nextTutorialPrompt`/`tutorialText` (campaign.ts) stay the seed for the step catalog; add cause-detection predicates (pure functions over DerivedSnapshot/BuildingState) per step; steps are deterministic from state (no wall-clock).
- "Don't show again" is a player preference persisted in saveCommands (replayable) OR a deterministic derived flag per save — pick the replayable SaveCommand form so replays stay byte-identical.
- Tutorial does NOT force a rigid sequence after the introduction (spec).

### Codex (CAMPAIGN-03)
- The codex covers buildings, products (commodities), chains (production chains), services, housing (levels/tiers), walkers, desirability, trade, finance, ratings, religion, risks, and shortcuts.
- Each entry: description, how it works, inputs, outputs, workers, cost, hints, requirements, and related links (entry ids cross-linked).
- `buildCodex()` (campaign.ts) already enumerates buildings/commodities/walkers/gods — extend entries with the per-entry fields (description/blurb, howItWorks, inputs/outputs/workers/cost from the data catalogs, requirements, relatedLinks) and add the missing categories (chains, housing, desirability, trade, finance, ratings, religion, risks, shortcuts).
- Exposed via a `getCodex()` accessor (deterministic, derived from data catalogs); a searchable entry lookup by id/kind.

### the agent's Discretion
- Exact mission map layouts for the 10 missions (small deterministic layouts introducing each system).
- Per-mission products/routes/modifiers tuning (starting treasury, quotas, time limits) — must remain winnable and deterministic.
- Which tutorial steps exist beyond the spec example (immigration-blocked) — pick the highest-value state checks that have live data (e.g., no food/water, no labor, low desirability).
- Codex entry content wording (short descriptions) — derived from existing catalog names/blurbs where possible.
- Where tutorial/codex views are surfaced (sim-derived `getTutorial()`/`getCodex()` accessors consumed by the UI later in Phase 18).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `data/missions.ts`: `MISSIONS` (4) + `EXTRA_MISSIONS` (6) = 10 missions, `MissionDef` with targetPopulation/Culture/Prosperity/Stability/Favor/Treasury/AnnualExports, sustainChecks, startingDenarii, timeLimitYears.
- `src/sim/missions.ts`: `MissionState`, `startMission`, `tickMission`, `campaignMissions()` (10), `missionName`.
- `src/sim/runner.ts`: `startMission(id)` (~2102), `getMission()` (~2106), `tickMissionSystem` (~1509) unified on the sustained ObjectiveTracker (RATE-02); `getDerived()`, `getState()`.
- `src/sim/campaign.ts`: `buildCodex()` (buildings/commodities/walkers/gods entries with kind/id/name/blurb), `TutorialStepId`, `nextTutorialPrompt(seen)`, `tutorialText(step)`.
- `src/sim/objectives.ts`: `ObjectiveTracker`, `ObjectiveTarget` (population/culture/prosperity/stability/favor/treasury/annualExports + sustainChecks).
- Data catalogs: `data/buildings.ts` (cost/workers/inputs), `data/commodities.ts`, `data/walkers.ts`, `data/housing.ts`, `data/events.ts`, `data/requests.ts`, `data/religion.ts`, `data/trade.ts`.
- Tests: `tests/unit/campaign.test.ts` (codex/tutorial), `tests/missions.test.ts`, `tests/runner-accessors.test.ts`.

### Established Patterns
- Deterministic-only sim: no Math.random()/Date.now()/new Date() in sim paths; SimState/getStateJson() byte-identical replay; additive-only API changes; goldens untouched.
- Month cadence tickCount % 40 === 0; year = floor(tick/360); ledger resets at tick 360.
- New player-action surfaces are replayable SaveCommands; derived views (getDerived/getCivicStats/getGovernance) are pure functions over live state.
- Data-driven catalogs with validation; balance-parity CONFIG.<key> rule (prefer module-local).
- Mission completion via sustained ObjectiveTracker (RATE-02) — victories only after targets held for the sustain period.

### Integration Points
- `MissionDef` (data/missions.ts) — add optional map/products/routes/modifiers.
- `startMission` (runner ~2102) — load per-mission map/products/routes on selection; campaign progression gating (mission N+1 unlocks on N win).
- `campaign.ts` — extend codex entries + tutorial step catalog with cause-detection predicates.
- Runner derived view — `getTutorial()` / `getCodex()` accessors + tutorial state in getState/getDerived.
- `SaveCommand` — "don't show again" tutorial preference (replayable).

</code_context>

<specifics>
## Specific Ideas

- Success criteria to honor: (1) the 10 missions are playable and winnable in sequence; (2) tutorial prompts appear contextually as the player encounters systems; (3) the codex explains every building, good, service, and god.
- Spec example for the tutorial: houses built but no immigrants → check road to entry, vacancies, attractiveness → explain the REAL cause.
- Codex entries carry description, how it works, inputs, outputs, workers, cost, hints, requirements, related links.
- The 10-mission arc maps to systems already implemented (roads/housing/water/food in earlier phases; trade, religion, health/education, desirability/villas, ratings/objectives/events in recent phases).

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>
