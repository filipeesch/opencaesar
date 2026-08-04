# Phase 15: Ratings, Objectives, Events - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous, user accepted all recommended answers)

<domain>
## Phase Boundary

Deliver four decomposable city ratings (Culture, Prosperity, Civic Stability,
Administrative Favor) each 0–100; campaign objectives / win conditions that
must be sustained for a defined period (default 3 months); and a deterministic
event engine with response choices that change outcomes. Covers RATE-01,
RATE-02, RATE-03.

</domain>

<decisions>
## Implementation Decisions

### Rating Decomposition (RATE-01)
- Full per-spec factor decomposition: Culture from education, entertainment, religion, festivals, coverage penalties; Prosperity from housing level, patricians, operating balance, unemployment, wages, trade, stability, debt; Stability from fire, homelessness, crime, protests, health, supply, employment, collapses, residential stability; Favor from requests, debt, gifts, objectives, tribute, salary, performance.
- Decomposition is wired into `DerivedSnapshot` as a `decomposition` field so `getDerived()` exposes sub-factors to the UI/advisor (not a separate recompute).
- Prosperity treats construction cost separately: track a `constructionSpend` rolling accumulator (sum of build costs) and exclude it from the operating-balance factor used for Prosperity (one-time build cost not double-penalized).
- Factors combine via weighted sum of normalized factors, clamped 0–100 (replacing the current additive-caps placeholder in `computeTargets`).

### Objectives & Win Conditions (RATE-02)
- Extend `ObjectiveTarget` and `MetricSnapshot` to include `treasury` and `annualExports` (plus `favor`) so a mission can require population 5000, Culture 60, Prosperity 55, Stability 70, Favor 50, treasury 10000, annual pottery exports 20 loads.
- Sustain checks run on the month cadence (`tickCount % 40 === 0`); `sustainChecks` is expressed in months, default 3 (the "three months" from the spec).
- `annualExports` is a rolling 360-tick window: cumulative exported loads (e.g., pottery) over the trailing year, derived from live trade route exports (`result.exports`), no wall-clock — resets/measures deterministically by year.
- Mission/completion path (`tickMissionSystem` + `setObjective`/`getObjectiveProgress`) unifies on the sustained-period `ObjectiveTracker` so a victory only occurs when all targets are held for the required period, and shortfalls remain visible.

### Event Responses (RATE-03)
- Expand the event catalog to the full spec set (~25 non-military event types: drought, exceptional harvest, agricultural plague, flood, earthquake, fire, epidemic, regional population growth, price fall, price rise, congested route, naval delay, strike, spontaneous festival, marble discovery, fertility reduction, special merchant, urgent request, donation, administrative visit, regional shortage, exceptional product demand, industrial accident, collapse, well contamination, heat wave, severe winter) with cause, duration, effects, initial/update/final messages, severity.
- Add a `responses` field to `EventDef`: an array of response options each with an id, label, and effect (e.g., spend denarii now vs. accept a ratings penalty) that changes the event outcome per the spec.
- Add `respondEvent(eventId, choiceId)` command surface on the runner; a chosen response mutates the outcome (effects/costs applied, early conclusion or altered severity).
- All event effects are actually applied to live city metrics during the event lifecycle (not merely logged): initial effect at activation, sustain messaging mid-lifecycle, final message on conclusion; responses recorded deterministically and replayed via saveCommands.

### the agent's Discretion
- Exact factor weights/normalization formulas (kept balanced, deterministic, and monotone in the factors).
- Catalog balance numbers (weights, effect magnitudes, durations) for the expanded event set.
- Exact roll-up of construction spend (per-build accumulator reset cadence if a window, or lifetime) — as long as Prosperity excludes one-time construction cost from operating balance.
- How `decomposeRatings` placeholder is reconciled with the new weighted decomposition (may supersede it).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/sim/ratings.ts`: `Ratings`, `CityStats`, `computeTargets`, `tickRatings`, `clampRating`, `RatingDecomposition`, `decomposeRatings(s, constructionSpend)` already exist (placeholder decomposition, currently unused in the live sim except tests).
- `src/sim/objectives.ts`: `ObjectiveTarget`, `MetricSnapshot`, `ObjectiveTracker` with sustained-period logic already implemented (population/culture/prosperity/stability + sustainChecks) — needs treasury/favor/exports extension.
- `src/sim/events.ts`: `hash(seed,tick)`, `pickEvent`, `applyEvent`, `eventDuration`, `eventSustainMsg`, `eventFinalMsg` — deterministic engine already exists; effects are computed but currently discarded (only logged).
- `data/events.ts`: `EventDef` (id/name/severity/weight/effect/damages/message/durationTicks/sustainMsg/finalMsg) with 8 events — lacks `responses` and most of the ~25-event catalog.
- `src/sim/runner.ts`: `derivedSnapshot()` (~line 836), `getDerived()`, `setObjective`, `getObjectiveProgress`, `tickMissionSystem`, event lifecycle block (~281-305), `logEvent`, `getEvents()`, `resetAnnualQuotas`/trade exports (`route.exportProceeds`, `result.exports`), `treasuryAccount.addExpense` at build sites (~771, ~1106).
- `src/sim/missions.ts` + `data/missions.ts`: 10-mission campaign (`MISSIONS` + `EXTRA_MISSIONS`), `MissionDef` with targetPopulation/Culture/Prosperity/Stability — lacks treasury/exports/favor and sustain period.
- `src/sim/advisor`/`advisors.ts`: advisor views that consume `derivedSnapshot` (can surface decomposition).

### Established Patterns
- Deterministic-only sim: no `Math.random()`/`Date.now()`/`new Date()` in sim paths; `SimState`/`getStateJson()` byte-identical on replay; additive-only API changes; goldens untouched. `fromSaveData` replays saveCommands at tick 0 with `replaying` gate.
- Month cadence `tickCount % 40 === 0`; year = `Math.floor(tickCount / 360)`. Ledger resets at tick 360 — treasury asserts sample within one year.
- Commands recorded in `commandLog` and `saveCommands` for replay; new state fields must serialize and replay.

### Integration Points
- `DerivedSnapshot` (`src/sim/runner.ts:836`) — add `decomposition` (and constructionSpend if surfaced) fields.
- Runner event lifecycle block — apply real effects during duration and route responses through `respondEvent`.
- `setObjective`/`getObjectiveProgress`/`tickMissionSystem` — extend targets and enforce sustain period.
- `data/events.ts` — expand catalog + `responses`; `src/sim/events.ts` — response logic.
- `advisors.ts` views — expose decomposition and objective/event status.

</code_context>

<specifics>
## Specific Ideas

- Spec examples to honor: mission example "population 5000, Culture 60, Prosperity 55, Stability 70, Favor 50, treasury 10000, annual pottery exports 20 loads"; "default three months" sustain; events like drought/earthquake/fire with response choices that change the outcome.
- Current 8-event catalog (fire, collapse, earthquake, flood, pestilence, riot, good_harvest, festival) must be preserved with its deterministic schedule behavior (tests depend on it).
- `getEvents()` and event log already surface events to the UI; keep that path intact while adding real effects.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>
