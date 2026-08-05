# Phase 15: Ratings, Objectives, Events - Research

**Researched:** 2026-08-05
**Domain:** deterministic city-sim ratings computation, sustained win conditions, and seeded event engine (TypeScript/Vitest, OpenCaesar)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Rating Decomposition (RATE-01)**
  - Full per-spec factor decomposition: Culture from education, entertainment, religion, festivals, coverage penalties; Prosperity from housing level, patricians, operating balance, unemployment, wages, trade, stability, debt; Stability from fire, homelessness, crime, protests, health, supply, employment, collapses, residential stability; Favor from requests, debt, gifts, objectives, tribute, salary, performance.
  - Decomposition is wired into `DerivedSnapshot` as a `decomposition` field so `getDerived()` exposes sub-factors to the UI/advisor (not a separate recompute).
  - Prosperity treats construction cost separately: track a `constructionSpend` rolling accumulator (sum of build costs) and exclude it from the operating-balance factor used for Prosperity (one-time build cost not double-penalized).
  - Factors combine via weighted sum of normalized factors, clamped 0–100 (replacing the current additive-caps placeholder in `computeTargets`).
- **Objectives & Win Conditions (RATE-02)**
  - Extend `ObjectiveTarget` and `MetricSnapshot` to include `treasury` and `annualExports` (plus `favor`) so a mission can require population 5000, Culture 60, Prosperity 55, Stability 70, Favor 50, treasury 10000, annual pottery exports 20 loads.
  - Sustain checks run on the month cadence (`tickCount % 40 === 0`); `sustainChecks` is expressed in months, default 3 (the "three months" from the spec).
  - `annualExports` is a rolling 360-tick window: cumulative exported loads (e.g., pottery) over the trailing year, derived from live trade route exports (`result.exports`), no wall-clock — resets/measures deterministically by year.
  - Mission/completion path (`tickMissionSystem` + `setObjective`/`getObjectiveProgress`) unifies on the sustained-period `ObjectiveTracker` so a victory only occurs when all targets are held for the required period, and shortfalls remain visible.
- **Event Responses (RATE-03)**
  - Expand the event catalog to the full spec set (~25 non-military event types: drought, exceptional harvest, agricultural plague, flood, earthquake, fire, epidemic, regional population growth, price fall, price rise, congested route, naval delay, strike, spontaneous festival, marble discovery, fertility reduction, special merchant, urgent request, donation, administrative visit, regional shortage, exceptional product demand, industrial accident, collapse, well contamination, heat wave, severe winter) with cause, duration, effects, initial/update/final messages, severity.
  - Add a `responses` field to `EventDef`: an array of response options each with an id, label, and effect (e.g., spend denarii now vs. accept a ratings penalty) that changes the event outcome per the spec.
  - Add `respondEvent(eventId, choiceId)` command surface on the runner; a chosen response mutates the outcome (effects/costs applied, early conclusion or altered severity).
  - All event effects are actually applied to live city metrics during the event lifecycle (not merely logged): initial effect at activation, sustain messaging mid-lifecycle, final message on conclusion; responses recorded deterministically and replayed via saveCommands.

### the agent's Discretion
- Exact factor weights/normalization formulas (kept balanced, deterministic, and monotone in the factors).
- Catalog balance numbers (weights, effect magnitudes, durations) for the expanded event set.
- Exact roll-up of construction spend (per-build accumulator reset cadence if a window, or lifetime) — as long as Prosperity excludes one-time construction cost from operating balance.
- How `decomposeRatings` placeholder is reconciled with the new weighted decomposition (may supersede it).

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.

</user_constraints>

## Summary

Phase 15 builds three already-partially-sketched subsystems in `src/sim/`: (1) four decomposable ratings (Culture/Prosperity/Stability/Favor) with a working decomposition seam, (2) sustained-period objectives/win conditions with an existing `ObjectiveTracker`, and (3) a deterministic event engine with an existing 8-event catalog and lifecycle loop. The codebase audit shows **significant scaffolding already exists but is not wired into the live sim**: `decomposeRatings`/`RatingDecomposition` are exported from `src/sim/ratings.ts` but imported nowhere; `applyEvent` effects are computed then discarded (only the message is logged); `ObjectiveTracker` is updated every tick (not on the 40-tick month cadence) and re-updated on every `getObjectiveProgress()` read (double-counting); missions complete instantly on a single check with no sustain period; and there is no `respondEvent` command surface, no treasury/favor/annualExports objective metrics, and no `constructionSpend` accumulator anywhere.

The plan should treat this as a **wiring phase over existing deterministic primitives**, not greenfield. Every new state value (`constructionSpend`, `annualExports`, active-event rating modifier, event response record) must be replay-derivable from `saveCommands` + `tickCount` (the `fromSaveData` contract at `src/sim/runner.ts:1724-1740`), and any new player command must be added to the `SaveCommand` union (`src/sim/types.ts:75-86`) plus the exhaustive `applyCommand` dispatch (`runner.ts:2312-2339`). Goldens are safe: `getState()` (`runner.ts:1223-1248`) uses the economy `computeRatings` path and serializes no safety/event state, so the event-catalog expansion and rating-formula rewrite do **not** change golden fixtures, provided the implementer keeps event effects and decomposition out of `getState()`'s output.

**Primary recommendation:** Rewire the three subsystems at their existing seams — `derivedSnapshot()`/`getDerived()` for decomposition (RATE-01), `ObjectiveTracker` + a new monthly `annualExports` window for win conditions (RATE-02), and a new `respondEvent` command + actual effect application for events (RATE-03) — all guarded by the existing determinism and catalog-validation tests. Do not install any new npm packages.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RATE-01 | Four city ratings (Culture, Prosperity, Stability, Favor) with decomposition and separate construction-cost treatment for Prosperity | Decomposition seam exists (`ratings.ts:64-103`) but unwired; `DerivedSnapshot` (`runner.ts:129-148`) lacks `decomposition`; `constructionSpend` must be accumulated at `placeBuilding` (`runner.ts:1106`) and `openTradeRoute` (`runner.ts:771`); must keep the `computeTargets`/`tickRatings`/`clampRating` API consumed by `runner.ts:20`, `advisors.ts:8,111`, and `tests/ratings.test.ts` |
| RATE-02 | Objectives and win conditions (targets sustained for a required period) | `ObjectiveTracker` (`objectives.ts:24-43`) exists but is updated every tick + re-updated on reads (`runner.ts:431-433,1046`); `ObjectiveTarget`/`MetricSnapshot` lack treasury/favor/annualExports; mission path (`missions.ts:51-58`) has no sustain period; `route.usedPerGood` + `resetAnnualQuotas` (`trade.ts:167-189`) give the deterministic per-year export tally to build the window on |
| RATE-03 | Non-military event engine with catalog (deterministic schedule, lifecycle, responses) | `hash`/`pickEvent`/`applyEvent` (`events.ts:19-58`) + 8-event catalog (`data/events.ts:27-76`) + lifecycle block (`runner.ts:281-300`) exist; effects are discarded (line 296); no `responses` on `EventDef`; no `respondEvent`; `applyPriceEvent` (`trade.ts:259-262`) exists ready for price-rise/fall events; `respondEvent` must be a `SaveCommand` kind (`types.ts:75-86`, `runner.ts:2312-2339`) |

## Project Constraints (from AGENTS.md)

`./AGENTS.md` does **not** exist in the working directory — no additional project-level directives beyond what is already encoded in `.planning/REQUIREMENTS.md`, the `game-specs/` design docs, and the CI gates (military-absence scanner `scripts/check-military.mjs`, catalog validation `data/validate.ts`, balance-parity test `tests/balance-parity.test.ts`, golden fixtures).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rating factor decomposition | API / Backend (sim core) | UI / Client (HUD + advisors display) | `derivedSnapshot()`/`getDerived()` already compute ratings in the sim core; the UI (`HUDScene.ts:58-67`) only renders them. Decomposition belongs in the sim core so the advisor and any future UI share one source of truth. |
| Construction-cost separation for Prosperity | API / Backend (sim core) | — | Build cost entry points are sim-core (`placeBuilding`, `openTradeRoute` → `treasuryAccount.addExpense`). The accumulator must live beside them; Prosperity consumes it. |
| Sustained win-condition evaluation | API / Backend (sim core) | — | `ObjectiveTracker` + month-cadence `tickDerivedSystems` own the evaluation; the UI only reads `getObjectiveProgress()`/`getMission()`. Periodicity (40-tick month) is a sim-core invariant. |
| Annual-exports measurement | API / Backend (sim core + trade module) | — | Export events happen in `dispatchTradeGood` (`runner.ts:687-690`); `trade.ts` owns `usedPerGood`/quotas. The rolling window derives from live trade state — never wall-clock. |
| Deterministic event scheduling + lifecycle | API / Backend (sim core) | — | `pickEvent(seed, tick)` + `activeEvent` tracking in `tick()` keep scheduling in the sim core; event catalog lives in `data/events.ts` (DATA-01). |
| Event response command surface | API / Backend (sim core) | UI / Client | `respondEvent` mutates outcome + records a `SaveCommand` for replay; the UI gives the player the choice. The command contract lives in the runner. |

## Standard Stack

This phase is a **pure in-repo code change**: it installs no new npm packages. The "stack" is the existing, already-tested sim modules plus the repo's established toolchain. Reuse these; do not add alternatives.

### Core (existing internal modules to extend — no external libraries)
| Module | Version (repo state) | Purpose | Why Standard |
|--------|----------------------|---------|--------------|
| `src/sim/ratings.ts` | present | `computeTargets`, `tickRatings`, `clampRating`, `RatingDecomposition`, `decomposeRatings` | The designated ratings home; `decomposeRatings(s, constructionSpend)` already has the construction param |
| `src/sim/objectives.ts` | present | `ObjectiveTarget`, `MetricSnapshot`, `ObjectiveTracker` (sustained-period) | The designated sustained win-condition logic; extend, don't rebuild |
| `src/sim/events.ts` | present | `hash(seed,tick)`, `pickEvent`, `applyEvent`, `eventDuration`, `eventSustainMsg`, `eventFinalMsg` | Deterministic seeded engine already proven by `events.test.ts` |
| `src/sim/trade.ts` | present | `TradeRouteState.usedPerGood`, `consumeQuota`, `resetAnnualQuotas`, `applyPriceEvent`, `exportAllowed` | The deterministic export-load tally (`usedPerGood`) the `annualExports` window builds on; `applyPriceEvent` ready for price-rise/fall events |
| `src/sim/finance.ts` | present | `Treasury.addExpense(cat, amount)` | Build-cost capture and event "spend now" responses route through the existing ledger (`FinCategory` union below); never hand-roll treasury math |
| `src/sim/runner.ts` | present | `derivedSnapshot` (836), `setObjective` (1039), `getObjectiveProgress` (1043), `tickMissionSystem` (1050), event block (281), `applyCommand` (2312) | The only public sim surface; new commands must extend `SaveCommand` + `applyCommand` |
| `data/events.ts`, `data/missions.ts` | present | `EventDef`, `EVENTS`, `MissionDef`, `MISSIONS`, `EXTRA_MISSIONS` | DATA-01 external catalogs; validation lives in `data/validate.ts` |

### Supporting toolchain (already installed — no action)
| Tool | Version | Purpose |
|------|---------|---------|
| TypeScript | `^5.7.0` per `package.json` (npx resolves 6.0.2) | typing the sim |
| Vitest | `3.2.7` (`vitest.config.ts`: `include: ['tests/**/*.test.ts']`, `environment: 'node'`) | unit/integration/determinism/golden tests |
| `scripts/check-military.mjs` | present | DATA-03 gate — expanded event names must avoid `FORBIDDEN_TOKENS` (`military, army, legion, soldier, fort, barracks, weapon, enemy, invasion, combat, damageFromUnit`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending existing `ratings.ts`/`objectives.ts` | New standalone modules | Unnecessary churn; existing tests (`ratings.test.ts`, `missions.test.ts`, `data-catalog.test.ts:75-86`) already exercise the current symbols |
| External formula/validation library (e.g. zod) | Plain TS + `data/validate.ts` | The repo's pattern is hand-written catalog validation (`data/validate.ts`); adding zod would be the first external dep and break the zero-dependency sim-core convention [ASSUMED] |
| `Math.random`-based events | Existing `hash(seed,tick)` | Forbidden: the determinism audit tests `tests/determinism/trade-determinism.test.ts:60-69` scan sources for `Math.random()/Date.now()/new Date()` |

### Installation
```bash
# None. Phase 15 adds no external dependencies. Do not run npm install.
```

### Version verification
Not applicable — no new packages. Existing toolchain verified this session: `node v20.20.1`, `npm 10.8.2`, `vitest 3.2.7`, TypeScript `^5.7.0`.

## Package Legitimacy Audit

> Gate **not triggered**: this phase installs no external packages (verified by the fact all subsystems are in-repo and the zero-dependency sim-core convention). Table intentionally left to `N/A` rather than fabricated.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — (no packages) | — | — | — | — | — | N/A — no installs this phase |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
*No `npm install`/`pip`/`cargo` step appears in any proposed task; if the planner encounters one it is a scope violation.*

## Architecture Patterns

### System Architecture Diagram

Ratings/objectives/events all flow through `SimRunner.tick()` → `tickDerivedSystems()` → `derivedSnapshot()` → `getDerived()`, with events scheduled inside `tick()` and win-conditions evaluated on the month cadence:

```
 Player actions (place/demolish/policy/trade-order/respondEvent ...)
        │  recorded as SaveCommand (replayable)   ▼
   ┌────▼────────────────────────── SimRunner.tick() ────────────────────┐
   │  tick  → economy/production/housing/walkers                        │
   │  Events block (281-300):                                            │
   │     activeEvent countdown → finalMsg; month pickEvent(seed,tick)    │
   │     → applyEvent (currently only logged  →  RATE-03: apply to live) │
   │  Festival / governor / requests (month cadence)                     │
   │  tickMissionSystem (1050)  ──unify onto──► ObjectiveTracker (RATE-02)│
   │  tickDerivedSystems (428) ► derivedSnapshot() ► getDerived()         │
   │        ▲ computedTargets(ratings.ts)  ──+decomposition+ eventΔ── RATE-01/03
   │        │      treasury ▲ favor ▲ annualExports (new) ▼                │
   │  getState() (1223): economy computeRatings path — SEPARATE, goldens  │
   └──────────────────────────────────────────────────────────────────────┘
   DerivedSnapshot.culture/prosperity/stability/favor → HUDScene (58-67)
   DerivedSnapshot.decomposition  → advisor/UI (NEW, RATE-01)
   getObjectiveProgress/getMission/getEvents → MainScene.exposeTestApi (510-513)
```

Trace RATE-01 use case: `placeBuilding("theatre",...)` → cost `addExpense('other', cost)` (fires `constructionSpend` accumulator) → `tickDerivedSystems` → `derivedSnapshot()` computes education/entertainment factors, rolls up Culture with a weighted sum, attaches `decomposition` → `getDerived().decomposition.culture.education` surfaces to the advisor. Trace RATE-02: month boundary → `ObjectiveTracker.update({population, culture, prosperity, stability, favor, treasury, annualExports})` sustaining counter → `getObjectiveProgress()` reports `won` only after `sustainChecks` consecutive monthly passes. Trace RATE-03: month boundary → `pickEvent(seed,tick)` → active event applies rating/treasury/price effects to live state + logs messages → player calls `respondEvent(id,choiceId)` → recorded as SaveCommand, mutates outcome (early conclusion / altered severity / treasury cost).

### Recommended Project Structure (additive — no reorg)
```
src/sim/                  # keep flat; extend existing files only
├── ratings.ts            # weighted decomposition + new factor inputs + constructionSpend param
├── objectives.ts         # + treasury/favor/annualExports targets + sustain-per-month
├── events.ts             # + response resolution helpers (respond/applyChoice)
├── trade.ts              # (optional) helper to sum usedPerGood → annualExports window
├── runner.ts             # wire decomposition, month-cadence objective, respondEvent + SaveCommand
data/
├── events.ts             # expand to ~25 events + responses[] on EventDef
├── missions.ts           # + treasury/favor/exports/sustain fields on MissionDef
├── validate.ts           # validate responses (ids unique, effects well-typed), new mission fields
data/balance.ts           # any new rating/event weights (DATA-02) — MUST pair with CONFIG consumer
tests/
├── ratings.test.ts       # update to new formula expectations
├── objectives.test.ts    # NEW: sustain-counting, treasury/favor/exports checks
├── events.test.ts        # EXTEND: responses, response effects
├── missions.test.ts      # EXTEND: sustain + new fields
├── runner-accessors.test.ts # EXTEND: respondEvent wiring, decomposition surface
├── data-catalog.test.ts  # EXTEND: catalog integrity for ~25 events + responses
└── determinism/          # NEW: constructionSpend/annualExports/respondEvent replay determinism
```

### Pattern 1: Replay-derivable accumulator (constructionSpend / annualExports)
**What:** New state that must survive save→load without a schema change. `SaveData` (`types.ts:88-100`) only stores `commands` + `tickCount`; `fromSaveData` replays commands then ticks (`runner.ts:1724-1740`). Any field accumulated deterministically from those two inputs reconstructs exactly.
**When to use:** every new phase-15 state field that is not a player action.
**Example:** build cost already flows through `placeBuilding` and `openTradeRoute`:
```typescript
// Source: src/sim/runner.ts:1106 and :771 (verbatim)
this.treasuryAccount.addExpense('other', def.cost);            // line 1106
this.treasuryAccount.addExpense('other', cost);                // line 771
// Add next to each: this.constructionSpend += <cost>;  → re-derives on save replay
```
Determinism tests must assert: `SimRunner.fromSaveData(r.getSaveData()).getStateJson()` equals the straight run with the new field included in (or excluded from) that JSON.

### Pattern 2: Sustained-period win condition (RATE-02)
**What:** ObjectiveTracker already implements the counter (see `objectives.ts:30-39` quoted below) — the phase only extends the metric set and fixes the cadence.
**When to use:** any objective/mission that must be held for N months.
**Example (existing, verbatim — `src/sim/objectives.ts:30-39`):**
```typescript
update(s: MetricSnapshot): { won: boolean; sustained: number } {
  const ok =
    (this.target.population === undefined || s.population >= this.target.population) &&
    (this.target.culture === undefined || s.culture >= this.target.culture) &&
    (this.target.prosperity === undefined || s.prosperity >= this.target.prosperity) &&
    (this.target.stability === undefined || s.stability >= this.target.stability);
  if (ok) this.sustained += 1;
  else this.sustained = 0;
  return { won: this.sustained >= this.target.sustainChecks, sustained: this.sustained };
}
```
Add `treasury`, `favor`, `annualExports` predicates the same way (undefined = not required), then gate the caller on the month cadence (see pitfalls P2/P3).

### Pattern 3: New command surface (respondEvent)
**What:** A player action must (a) dispatch deterministically, (b) be rejected without state change when invalid, (c) serialize for replay. The repo pattern for this is `SaveCommand` + `applyCommand` + `getSaveData`.
**When to use:** `respondEvent(eventId, choiceId)` — and only this one new command in this phase.
**Example — the three places every command touches** (verbatim file regions):
```typescript
// types.ts:75-86 union — add branch
| { kind: 'respondEvent'; eventId: string; choiceId: string }
// runner.ts applyCommand exhaustive dispatch (2312-2339) — add branch
} else if (cmd.kind === 'respondEvent') {
  runner.respondEvent(cmd.eventId, cmd.choiceId);
}
// the method pushes the same command shape it accepts:
this.saveCommands.push({ kind: 'respondEvent', eventId, choiceId });  // pattern per runner.ts:1426
```
Validation contract: reject unknown `eventId` (must equal `activeEvent.id`) and unknown `choiceId` (must exist in `EVENTS[eventId].responses`) with a no-op result — mirroring `checkPlacement` rejection semantics.

### Pattern 4: Rolling-360 annualExports window
**What:** `annualExports` must equal loads exported over the trailing year, deterministic and reset on the tick-year boundary.
**When to use:** any export-count objective metric.
**Mechanism (verified building block):** physical exports call `consumeQuota(route, good, qty)` (`runner.ts:690`) which increments `route.usedPerGood[good]` (`trade.ts:167-171`); `resetAnnualQuotas(routes, year)` clears it when the tick-based year changes (`trade.ts:179-189`, year = `Math.floor(tickCount / 360)` per `runner.ts:437`). To keep a trailing-year count across the reset, snapshot `usedPerGood` totals into a `lastYearExports`/bucket field just before reset (or accumulate into a per-year ring keyed by `Math.floor(tick / 360)`).

### Anti-Patterns to Avoid
- **Recomputing decomposition separately**: `deriveSnapshot` must return `decomposition` in the same computation (locked decision); a second recompute diverges and duplicates work.
- **Updating `ObjectiveTracker` more than once per month**: `tickDerivedSystems` (every tick) and `getObjectiveProgress` (every read) both call `update()` today — this double-counts and counts ticks, not months (see P2/P3).
- **Writing event effects into `getState()`**: that would mutate goldens and conflate the derived and snapshot rating paths; keep effects in `DerivedSnapshot` (+ treasury only through explicit response commands).
- **Adding balance constants without the CONFIG consumer**: `tests/balance-parity.test.ts` requires every new `data/balance.ts` key to be read as `CONFIG.<key>` in `src/` (see P5).
- **Hand-rolling the ledger**: route event "spend denarii now" through `Treasury.addExpense('other' | <cat>, amount)`, never a raw `balance -=`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deterministic event scheduling | New PRNG/date-based scheduler | `events.ts hash(seed,tick)` + `pickEvent` weighted roll [VERIFIED: src/sim/events.ts:19-36] | Repo-wide determinism (no `Math.random`/`Date.now` — audited by `tests/determinism/trade-determinism.test.ts:60-69`); rewrite would break `events.test.ts` and replay |
| Sustained win-condition counting | A custom month counter per mission | Existing `ObjectiveTracker` (`objectives.ts:24-43`) | It already implements consecutive-check sustain/progress; extend metrics, pin cadence |
| Treasury/expense bookkeeping | Raw balance arithmetic | `Treasury.addExpense/addRevenue` (`finance.ts:15-43`) | Categorized ledger, zero-balance clamp, rollYear reset — used by every existing system |
| Annual export load accounting | A hand-rolled wall-clock tally | `route.usedPerGood` + `consumeQuota`/`resetAnnualQuotas` (`trade.ts:167-189`) | Existing deterministic per-year per-good load counting, tick-based |
| Trade price modifiers for events | New price logic | `applyPriceEvent(state, delta, at)` (`trade.ts:259-262`) | Exists and is unit-tested (`tests/unit/trade-prices.test.ts:76`); pure multiplier, no history pollution |
| Catalog validation | Ad-hoc asserts at use sites | `data/validate.ts validateCatalogs()` | Load-time gate (`runner.ts:208-211`) + `data-catalog.test.ts`; extended for responses |

**Key insight:** every requested capability already has a deterministic primitive in-repo. The expensive failure mode is layering a *second* mechanism (new counters, new RNG, new ledger math) on top of the existing ones instead of wiring into them.

## Common Pitfalls

### Pitfall 1: Event effects stay "logged but not applied" (the exact current bug RATE-03 must fix)
**What goes wrong:** Events appear in `getEvents()` but change nothing the player can feel — objectives/missions/ratings ignore them.
**Why it happens:** `runner.ts:296` calls `applyEvent(ev, { culture: 10, prosperity: this.getState().ratings.prosperity, stability: 10, favor: 10 })` with hardcoded 10s and discards the result.
**How to avoid:** Apply event deltas as a live multiplier/offset on the `DerivedSnapshot` ratings (and any listed `treasury`/`priceModifier` effects), removed at conclusion. Keep `getState()` untouched (see P6).
**Warning signs:** `getEvents()` grows while `getDerived()` ratings never respond to an active `earthquake`/`festival`.

### Pitfall 2: `ObjectiveTracker.update` runs every tick instead of monthly
**What goes wrong:** `sustainChecks: 3` is satisfied after 3 *ticks* (days), not 3 *months* — a "three-month" objective wins in a few game-days [VERIFIED: runner.ts:431-433 calls `this.objective.update(...)` every tick].
**Why it happens:** `tickDerivedSystems()` runs every `tick()` step with no `% 40` gate.
**How to avoid:** Wrap the update in `if (this.tickCount % 40 === 0 && this.objective)` (contrast `runner.ts:304`, `:319`, `:325` which already gate month-cadence work).
**Warning signs:** an objective with `sustainChecks: 90` completes in 90 ticks, or `getObjectiveProgress().progress` jumps 1/3 per day.

### Pitfall 3: `getObjectiveProgress()` double-counts sustain
**What goes wrong:** `tickDerivedSystems` updates the tracker every tick, and `getObjectiveProgress` (`runner.ts:1046`) calls `this.objective.update(...)` again — combined with main-loop reads this advances `sustained` 2× (and per-tick reads advance it spuriously).
**Why it happens:** the reader mutates the tracker instead of being a pure projection.
**How to avoid:** Make `getObjectiveProgress` a pure read (store the latest `{won, sustained}` from the monthly update, or compute ratio without mutating). This is the single most likely source of flaky/new determinism failures this phase.
**Warning signs:** same script yields different `won` timing depending on how often the caller polls.

### Pitfall 4: Catalog expansion silently changes which event fires at a (seed, tick)
**What goes wrong:** `pickEvent` uses `hash(seed,tick) % totalWeight`; adding ~17 events changes `totalWeight` so a given (seed, tick) may now pick a different event than today's 8.
**Why it happens:** weighted-roll arithmetic is order+sum sensitive (`events.ts:28-36`).
**How to avoid:** Accept the change (nothing asserts a fixed schedule; `events.test.ts:9-15` only checks determinism + message non-empty, `runner-accessors.test.ts:117-125` only `length > 0`), and add a test that pins the new expanded schedule for one fixed seed+tick for the future. `applyEvent('earthquake'|'good_harvest', ...)` unit expectations in `events.test.ts:17-25` are catalog-independent and stay valid.
**Warning signs:** none today — this is a forward-compatibility guard, not a current break.

### Pitfall 5: New balance constants break `balance-parity.test.ts`
**What goes wrong:** adding rating weights/event magnitudes to `data/balance.ts` without a `CONFIG.<key>` reader in `src/` fails `every BALANCE key is consumed as CONFIG.<key> outside the re-export` (`tests/balance-parity.test.ts:44-51`).
**Why it happens:** DATA-02 parity test enforces both directions (key-set equality + consumption).
**How to avoid:** For any externalized constant, add it to `data/balance.ts` AND read it as `CONFIG.<key>` inside `src/sim/ratings.ts`/`events.ts`/`runner.ts`. Simpler alternative for purely-internal tuning: keep it as a local const in the module and never add to BALANCE.
**Warning signs:** CI fails `tests/balance-parity.test.ts` after "a tiny constant" is added.

### Pitfall 6: Touching `getState()` output changes goldens
**What goes wrong:** regressing the `food-chain-golden.json`/`paused-commands-golden.json` fixtures by folding event/rating effects or new walkers into `getState()`.
**Why it happens:** `getState()` (`runner.ts:1223-1248`) returns `buildings` (no safety/event fields), `ratings` from **economy `computeRatings`** (a separate path from `derivedSnapshot`), and `messages` — events write only to `eventLog` (`logEvent`, `runner.ts:2242-2247`).
**How to avoid:** Keep event effects and decomposition in `DerivedSnapshot`/`getDerived()`, never in `getState()`; do not spawn new walker types from events; treasury effects only via explicit `respondEvent` commands (goldens never invoke them). Verified by reading the goldens this session (`ratings: {population, prosperity, happiness}` only; buildings exclude `safety`).
**Warning signs:** `npm test` local `tests/golden/golden.test.ts` fails without touching the fixtures.

### Pitfall 7: `respondEvent` not replayable
**What goes wrong:** a response that mutates outcome but isn't a `SaveCommand` causes save→load divergence: the replayed run regains the pre-response state.
**Why it happens:** `fromSaveData` reconstructs only from `commands` + ticks; anything not in `saveCommands` vanishes on load.
**How to avoid:** Model `respondEvent` as a `SaveCommand` kind end-to-end (`types.ts` union + `applyCommand` branch + push on accept), like `donateToGovernor` (`runner.ts:1426`). Add a determinism test: run → respond → save → load → compare `getStateJson()` + objective/event outcome.

### Pitfall 8: Events that drain treasury on spawn (not on response) would break replay determinism of goldens
**What goes wrong:** if an auto-firing event costs denarii, golden treasuries change.
**Why it happens:** goldens tick 1200 with `pickEvent` elected events; a treasury effect without a player command would alter `treasury` in `getState()`.
**How to avoid:** Default event effects are ratings/price modifiers (derived-only); denarii costs belong on user-chosen responses only.
**Warning signs:** a golden test diff shows only `treasury` changing.

## Code Examples

### Example 1: Wiring decomposition into `DerivedSnapshot` (RATE-01)
**Source:** pattern mirrors `runner.ts:836-887` (verbatim core below) — add a `decomposition` field to the interface (`runner.ts:129-148`) and compute it in the snapshot.
```typescript
// src/sim/ratings.ts:75-78 — the seam already takes constructionSpend (verbatim)
export function decomposeRatings(
  s: CityStats,
  constructionSpend: number,
): RatingDecomposition {
```
`DerivedSnapshot` currently exposes scalars (`runner.ts:129-148` verbatim): `culture: number; prosperity: number; stability: number; favor: number;`. Add:
```typescript
decomposition: RatingDecomposition;   // proposed additive field
constructionSpend: number;            // proposed additive field (locked decision "if surfaced")
```

### Example 2: Month-cadence objective update (RATE-02)
**Source:** `runner.ts:428-434` (verbatim, current every-tick wiring) — gate on the month and add the new metrics.
```typescript
private tickDerivedSystems(): void {
  const snapshot = this.derivedSnapshot();
  this.derived = snapshot;
  if (this.objective) {
    this.objective.update({ population: snapshot.population, culture: snapshot.culture, prosperity: snapshot.prosperity, stability: snapshot.stability });
  }
}
```

### Example 3: Existing event lifecycle block to preserve + extend (RATE-03)
**Source:** `runner.ts:281-300` (verbatim).
```typescript
if (this.activeEvent) { this.activeEvent.remaining -= 1; ... }
if (!this.activeEvent && this.tickCount % 40 === 0) {
  const ev = pickEvent(this.seed, this.tickCount);
  if (ev) {
    const result = applyEvent(ev, { culture: 10, prosperity: this.getState().ratings.prosperity, stability: 10, favor: 10 });
    this.logEvent('event', `${result.name}: ${result.message}`, result.severity);
    this.activeEvent = { id: ev, remaining: eventDuration(ev), total: eventDuration(ev) };
  }
}
```

### Example 4: Export-load tally building block for `annualExports`
**Source:** `trade.ts:167-171` + `runner.ts:689-690` (verbatim).
```typescript
export function consumeQuota(route: TradeRouteState, good: string, amount: number): void {
  route.usedPerGood = route.usedPerGood ?? {};
  route.usedPerGood[good] = (route.usedPerGood[good] ?? 0) + amount;
  route.usedQuota = (route.usedQuota ?? 0) + amount;
}
// runner.ts:690 — every physical export increment:  consumeQuota(route, good, qty);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ratings as placeholder additive-caps from boolean coverage flags (`computeTargets`, ratings.ts:25-44) | Weighted sum of fully-decomposed normalized factors, clamped 0–100, exposed via `DerivedSnapshot.decomposition` | Phase 15 | Advisor/UI can show exactly what moves each rating (RATE-01) |
| `decomposeRatings` exported but dead code (grep: imported only in `tests/data-catalog.test.ts`, never in src/) | Wired into `derivedSnapshot()`/`getDerived()` | Phase 15 | Single source of truth for factor values |
| Objectives/missions complete instantly on one check (missions.ts:51-58) or at tick cadence (ObjectTracker.update every tick) | Sustained target held for N month-boundary checks (`tickCount % 40 === 0`), default 3 months | Phase 15 | Victory means "held", matching spec "default three months" |
| Event effects computed and discarded (only logged) | Effects applied to live derived metrics during lifecycle; responses mutate outcome | Phase 15 | Events are gameplay, not flavor text (RATE-03) |
| 8-event catalog, no price/trade linkage | ~25-event catalog with `responses`, price modifiers via `applyPriceEvent` | Phase 15 | Full spec event set |
| Build cost `addExpense('other', cost)` with no rating linkage | `constructionSpend` accumulator excluded from Prosperity's operating balance | Phase 15 | No double-penalizing expansion |

**Deprecated/outdated:**
- `decomposeRatings` placeholder signature may be superseded by the weighted decomposition (agent's discretion); if superseded, update `tests/data-catalog.test.ts:75-86` which imports it.
- `ratings.test.ts` expectations (`bare.culture === 10`, line 8) encode the additive-caps formula; the new weighted formula must keep or intentionally update these assertions.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Event effects should surface through `DerivedSnapshot` ratings rather than `getState()` | Code Examples / Pitfall 6 | If instead the team wants events to directly mutate the economy `computeRatings` inputs or treasury, goldens and save-replay surface change (bigger blast radius) |
| A2 | New rating/event balance constants belong in `data/balance.ts` (data-driven DATA-02) rather than module-local consts | Pitfall 5 | Only a convention choice; module-local consts dodge the parity test but diverge from the "balance constants externalized" rule |
| A3 | `annualExports` keeps a trailing-year snapshot across `resetAnnualQuotas` (a per-year ring keyed by `Math.floor(tick/360)`) | Pattern 4 | The locked decision says "resets/measures deterministically by year" — a lifetime accumulator would violate the trailing-year semantics |
| A4 | `constructionSpend` is a simple lifetime accumulator of `addExpense('other', cost)` at build/route-open sites | Pattern 1 | Agent's discretion explicitly allows a window; lifetime is simplest and replay-derivable |
| A5 | No new external packages (zod, PRNG libs, etc.) | Package Legitimacy Audit | If a future phase needs validation/RNG beyond what exists, re-audit then; none is needed now |

## Open Questions

1. **Should event effects reach `getState()` for player-visible "real" changes, or is `DerivedSnapshot` enough?**
   - What we know: `getState()` uses economy `computeRatings` (separate), goldens depend on it, and events currently never reach it.
   - What's unclear: whether "applied to live city metrics" (CONTEXT) permits derived-only or requires economic/treasury mutation.
   - Recommendation: derived-only for ratings; treasury only through explicit responses. Confirm with user during discuss if "real" means economic.

2. **`annualExports` — precisely which goods and load sources count?**
   - What we know: specimen says "annual pottery exports 20 loads"; the physical path counts `route.usedPerGood[good]`; the legacy abstract-ledger path counts `result.exports` (`runner.ts:461`).
   - What's unclear: whether the window sums only physical orders-routes or also legacy wheat-ledger exports, and whether "loads" = quota-consumed units.
   - Recommendation: sum `usedPerGood[good]` across enabled routes for the target good (all types), trailing 360 ticks.

3. **What happens to a player response after the event already concluded?**
   - What we know: none of this exists yet; the validation contract is proposed to reject unknown/inactive event ids.
   - What's unclear: whether a stale `respondEvent` should be a silent no-op or an error surfaced to the UI.
   - Recommendation: reject (no state change) mirroring `checkPlacement`, and log to commandLog.

## Environment Availability

> Included — the phase runs against the repo's own sim + test tooling (no external services).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/typecheck/tests | ✓ | v20.20.1 | — |
| npm | tooling | ✓ | 10.8.2 | — |
| TypeScript | `npm run build`/`typecheck` | ✓ | ^5.7.0 (npx resolves 6.0.2) | — |
| Vitest | `npm test` | ✓ | 3.2.7 | — |
| `scripts/check-military.mjs` | DATA-03 gate | ✓ | present | — |
| Playwright | e2e (not required by this phase) | ✓ | present | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

> `workflow.nyquist_validation`: `.planning/config.json` does not exist at the repo root — key absent ⇒ treated as **enabled**.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.7 |
| Config file | `vitest.config.ts` (`include: ['tests/**/*.test.ts']`, `environment: 'node'`, `testTimeout: 30000`) |
| Quick run command | `npx vitest run tests/ratings.test.ts tests/objectives.test.ts tests/events.test.ts tests/missions.test.ts tests/runner-accessors.test.ts tests/data-catalog.test.ts -x` |
| Full suite command | `npm test` (baseline this session: 105 files / 751 passing) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RATE-01 | Weighted decomposed ratings clamped 0–100 | unit | `npx vitest run tests/ratings.test.ts -x` | ✅ (extend) |
| RATE-01 | `DerivedSnapshot.decomposition` + `constructionSpend` surfaced by `getDerived()` | integration | `npx vitest run tests/runner-accessors.test.ts -x` | ✅ (extend) |
| RATE-02 | Sustain counting on month cadence, default 3 months | unit | `npx vitest run tests/objectives.test.ts -x` | ❌ Wave 0 (new) |
| RATE-02 | treasury/favor/annualExports targets + no-win-shows-shortfall | unit/integration | `npx vitest run tests/objectives.test.ts tests/runner-accessors.test.ts -x` | ❌ / ✅ |
| RATE-02 | annualExports trailing-year determinism across reset | determinism | `npx vitest run tests/determinism/export-window-determinism.test.ts -x` | ❌ Wave 0 (new) |
| RATE-03 | ~25-event catalog + `responses` validate cleanly | unit | `npx vitest run tests/data-catalog.test.ts -x` | ✅ (extend) |
| RATE-03 | Lifecycle applies real effects; respondEvent changes outcome | integration | `npx vitest run tests/events.test.ts tests/runner-accessors.test.ts -x` | ✅ (extend) |
| RATE-03 | `respondEvent` save→load replay determinism | determinism | `npx vitest run tests/determinism/event-response-determinism.test.ts -x` | ❌ Wave 0 (new) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/<affected>.test.ts -x`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green (`npm test`) + `npm run check:military` + `npm run typecheck` before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/objectives.test.ts` — NEW: covers sustain journey (2 consecutive monthly passes → won; one miss resets), treasury/favor/annualExports thresholds, default `sustainChecks: 3`
- [ ] `tests/determinism/export-window-determinism.test.ts` — NEW: annualExports window identical across chunked ticks and save/load
- [ ] `tests/determinism/event-response-determinism.test.ts` — NEW: respondEvent + constructionSpend replay byte-identical
- [ ] Extend `tests/events.test.ts` — response resolution (valid/invalid choice, early conclusion, treasury cost)
- [ ] Extend `tests/data-catalog.test.ts` — ~25-event catalog + responses validation
- *(Existing `tests/ratings.test.ts`, `tests/missions.test.ts`, `tests/runner-accessors.test.ts`, `tests/balance-parity.test.ts`, `tests/military-absence.test.ts` all currently green and must stay green)*

## Security Domain

> `security_enforcement`: `.planning/config.json` absent ⇒ enabled. This is a **local, offline, deterministic simulation** with no network, no user identity, and no persisted PII — the threat surface is minimal and concentrated on command input validation and the DATA-03 content gate.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — no identities/sessions in a local sim |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a — single-player local state |
| V5 Input Validation | yes | `respondEvent(eventId, choiceId)` must reject unknown ids/choices with no state change (mirror `checkPlacement`); new catalog fields validated in `data/validate.ts` (`validateCatalogs` runs once at construction, `runner.ts:208-211`); extended event/mission fields get the same load-time gate |
| V6 Cryptography | no | n/a — `hash(seed,tick)` (`events.ts:19-25`) is deterministic mixing for simulation ordering, not a security primitive; do not misuse as crypto |

### Known Threat Patterns for {stack}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Invalid `respondEvent` (unknown eventId / choiceId) mutating state | Tampering | Reject with no-op + `commandLog` entry, before any effect application |
| Military content slipping into expanded event catalog | Tampering | DATA-03 `scripts/check-military.mjs` scan over `src/` + `data/`; new event names must avoid `FORBIDDEN_TOKENS` (`military army legion soldier fort barracks weapon enemy invasion combat damageFromUnit`) |
| Corrupt catalog (e.g. responses referencing missing ids, non-finite weights) breaking determinism | Tampering | Extend `validateCatalogs()` in `data/validate.ts` (models the existing events check at `data/validate.ts:125-127`); `data-catalog.test.ts` asserts `validateCatalogs()` returns `[]` |
| Replay divergence from a non-`SaveCommand` response | Tampering | `respondEvent` must be a `SaveCommand` kind + `applyCommand` branch + determinism test (Pitfall 7) |

## Sources

### Primary (HIGH confidence — read with Read tool this session)
- `src/sim/ratings.ts` (lines 25-44, 59-103) — `computeTargets` placeholder, `clampRating`, `RatingDecomposition`, `decomposeRatings(s, constructionSpend)`
- `src/sim/objectives.ts` (lines 8-43) — `ObjectiveTarget`, `MetricSnapshot`, `ObjectiveTracker` verbatim
- `src/sim/events.ts` (lines 19-75) — `hash`, `pickEvent`, `applyEvent`, duration/sustain/final message helpers; `src/sim/runner.ts` event lifecycle (lines 281-300)
- `src/sim/types.ts` (lines 75-100, 199-204, 237-253) — `SaveCommand` union, `SaveData`, `EventRecord`, `SimState`; `src/sim/runner.ts` (129-148, 836-892, 1038-1072, 1724-1740, 2242-2247, 2312-2339)
- `src/sim/trade.ts` (lines 9-40, 167-189, 259-262) — `usedPerGood`, `consumeQuota`, `resetAnnualQuotas`, `applyPriceEvent`; `src/sim/runner.ts` (436-485, 630-728) physical export path
- `src/sim/finance.ts` (lines 8-43) — `FinCategory` + `Treasury`
- `data/events.ts` (lines 5-80), `data/missions.ts` (lines 5-72), `data/validate.ts` (lines 125-133), `data/balance.ts` + `src/sim/config.ts`
- Tests: `tests/ratings.test.ts`, `tests/events.test.ts`, `tests/missions.test.ts`, `tests/runner-accessors.test.ts`, `tests/data-catalog.test.ts`, `tests/balance-parity.test.ts`, `tests/determinism/trade-determinism.test.ts`, `tests/determinism/determinism.test.ts`, `tests/golden/golden.test.ts` (fixtures read via JSON)
- Repository context: `openspec/specs/ratings-objectives/spec.md`, `openspec/specs/events/spec.md`, `15-CONTEXT.md`, `.planning/REQUIREMENTS.md`

### Secondary (MEDIUM confidence)
- Grep audits this session confirming absence: `respondEvent`, `responses`, `annualExports`, `constructionSpend` (except ratings param), `decomposeRatings` import (only in ratings.ts itself + data-catalog test)
- Baseline test run this session: `npx vitest run` → 105 files / 751 passing

### Tertiary (LOW confidence)
- Design choices proposed as recommendations (event-effect channel, window construction, accumulator lifetime) — tagged `[ASSUMED]` in this document and are within "the agent's Discretion"

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — purely the existing in-repo modules, all read with `Read` this session; no external deps introduced
- Architecture: HIGH — wiring points pinned to exact line ranges (`runner.ts:836`, `:1039`, `:281`, `:2312`)
- Pitfalls: HIGH for the five determinism/parity/golden risks (verified against `getState()`/`balance-parity`/`fromSaveData`), MEDIUM for schedule-expansion and response-validation edge cases

**Research date:** 2026-08-05
**Valid until:** 2026-09-05 (stable codebase; deterministic-sim conventions rarely churn)
