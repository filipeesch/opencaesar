# Phase 17: Campaign, Tutorial & Codex - Research

**Researched:** 2026-08-05
**Domain:** Campaign missions, contextual tutorial, codex — deterministic sim extensions (TypeScript)
**Confidence:** HIGH (implementation-state facts), MEDIUM (winnability estimates)

## Summary

Phase 17 is a **code-only extension of the existing sim-core** — no new npm packages, no UI (Phase 18), no map format changes. Three deliverables map to three requirements (CAMPAIGN-01/02/03, `CAMP-01/02/03` in REQUIREMENTS.md): a 10-mission sequential campaign, a state-observing contextual tutorial, and a data-catalog-derived codex.

**What exists today (verified by reading the code):** The 10 mission *definitions* exist in `data/missions.ts` (`MISSIONS` 4 + `EXTRA_MISSIONS` 6), but they carry **no map, products, routes, or modifiers fields** — `MissionDef` has only targets/`sustainChecks`/`startingDenarii`/`timeLimitYears` [VERIFIED: data/missions.ts:5-29]. The win path is fully wired: `tickMissionSystem` ([VERIFIED: src/sim/runner.ts:1509-1549]) drives the sustained `ObjectiveTracker` on the month cadence (`tickCount % 40`), supporting population/ratings/favor/treasury/annualExports targets and time-limit failure. But `startMission` ([VERIFIED: src/sim/runner.ts:2102-2108]) is a **stub**: it only sets `this.mission = { id, started: true, complete: false, failed: false, year: 0, objective: id }` — it does not load a map, apply `startingDenarii`, open routes, set quotas, or gate progression. **There is no campaign progression/unlock logic anywhere** (grep confirms). The codex (`buildCodex`, [VERIFIED: src/sim/campaign.ts:21-36]) emits only `{kind, id, name, blurb}` entries from catalogs — no description/howItWorks/inputs/outputs/workers/cost/requirements/relatedLinks — and is consumed only as a **count** in `derivedSnapshot()` ([VERIFIED: src/sim/runner.ts:1325]). The tutorial ([VERIFIED: src/sim/campaign.ts:38-62]) is a hardcoded ordered sequence (`nextTutorialPrompt(seen)` with a fixed `order` array) with **no state observation, no cause detection, no UI wiring** — nothing in `src/game/` references it. `src/sim/missions.ts` (`startMission`/`tickMission`/`missionName`) is **legacy/dead** — the runner does not import it (only tests do).

**What is missing (the phase's actual work):** (1) extend `MissionDef` additively with `map`/`products`/`routes`/`modifiers`; (2) make mission start replayable (a `startMission` SaveCommand — currently mission state is lost on save/load because `SimState`/`SaveData` carry no mission [VERIFIED: src/sim/types.ts:75-103, src/sim/runner.ts:1701-1727, 2194-2208]); (3) fix the **time-limit landmine**: `startMission` hardcodes `year: 0`, so starting a mission on an already-ticked runner instantly fails any time-limited mission (`year - this.mission.year > def.timeLimitYears` at [VERIFIED: src/sim/runner.ts:1519-1523]); (4) add progression gating (mission N+1 unlocks on N win); (5) re-theme/retune the 10 existing entries to the spec arc (CONTEXT names them riverside foundations → provincial capital) and tune targets to verified-achievable ceilings; (6) extend the codex entries + add missing categories; (7) add cause-detection tutorial predicates over live state (`DerivedSnapshot` + `getState().buildings[].house` — all needed live data exists: food/water/labor cooldowns, per-house desirability, per-building `laborConnected`, derived coverage/employment/godWorship [VERIFIED: src/sim/runner.ts:133-160, 2747-2768]); (8) a replayable "don't show again" tutorial preference.

**Primary recommendation:** Build the campaign as **additive sim-core + data** exactly along the established patterns: extend `MissionDef` with optional fields (all-undefined = existing entries unchanged), add two new SaveCommand kinds (`startMission`, `dismissTutorialStep`) with exhaustive `applyCommand` dispatch [VERIFIED: src/sim/runner.ts:2814-2847], drive progression gating inside `startMission`, record `mission.year = floor(tickCount/360)` at start, and expose `getTutorial()`/`getCodex()` as pure derived accessors for Phase 18's UI. Keep every mission winnable: per-mission targets must stay inside the verified mechanics ceilings (population capacity, ratings weights, annual-export window, treasury income) — see the per-mission winnability table in Architecture Patterns.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAMPAIGN-01 / CAMP-01 | 10-mission campaign framework: missions define map, objectives, products, routes, modifiers; sequential progression; winnable end-to-end | MissionDef extension points (data/missions.ts:5-29), runner startMission/tickMissionSystem (runner.ts:2102-2108, 1509-1549), SaveCommand replay pattern (types.ts:75-89, runner.ts:2814-2847), SimMap.fromLayout (map.ts:39-47), per-mission winnability table below |
| CAMPAIGN-02 / CAMP-02 | Contextual tutorial: observe real state, explain real causes, highlight/short/expanded/show-where/don't-show-again, no rigid sequence | Tutorial step seed (campaign.ts:38-62), live state surface (DerivedSnapshot runner.ts:133-160 + BuildingState.house runner.ts:2747-2768), replayable dismiss preference via new SaveCommand, predicate patterns in Code Examples |
| CAMPAIGN-03 / CAMP-03 | Codex: entries for buildings/products/chains/services/housing/walkers/desirability/trade/finance/ratings/religion/risks/shortcuts, each with description/howItWorks/inputs/outputs/workers/cost/hints/requirements/relatedLinks | buildCodex seed (campaign.ts:13-36), data catalog fields (buildings.ts:24-52, commodities.ts:8-21, walkers.ts:5-12, housing.ts:7-24), getCodex() accessor pattern |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- The 10 missions follow the spec's gradual-introduction arc: (1) riverside foundations, (2) provincial granary, (3) clay and fire, (4) trade roads, (5) water for all, (6) city of scholars, (7) favors of the gods, (8) southern port, (9) city of patricians, (10) provincial capital.
- Each mission SHALL define its map (start layout via layout string / pre-placed buildings), objectives (sustained targets via the existing ObjectiveTracker: population/ratings/favor/treasury/annualExports + sustainChecks default 3 months), products (goods chain emphasis), routes (open trade routes/quotas), and modifiers (starting treasury, time limits, optional difficulty knobs) — loaded deterministically when the mission is selected.
- Existing `MISSIONS`/`EXTRA_MISSIONS` (data/missions.ts, 10 entries) are the base: extend `MissionDef` additively with optional map/products/routes/modifiers fields; every existing entry stays valid (new fields undefined → no change).
- Mission completion already runs through the sustained `ObjectiveTracker` (runner tickMissionSystem, RATE-02); campaign progression unlocks mission N+1 only when mission N is won (sequential playability); the campaign is winnable end-to-end (success criterion 1).
- Tutorial steps are triggered by OBSERVED sim state, not a rigid sequence: e.g., player built houses but no immigrants → check road-to-entry, vacancies, attractiveness → explain the ACTUAL blocking cause.
- Each step carries short text + expanded explanation + a codex entry reference; the sim exposes a `tutorialState` derived view (which steps are eligible, which seen/dismissed) so the UI can render highlight/short text/expanded/show-where/don't-show-again.
- `nextTutorialPrompt`/`tutorialText` (campaign.ts) stay the seed for the step catalog; add cause-detection predicates (pure functions over DerivedSnapshot/BuildingState) per step; steps are deterministic from state (no wall-clock).
- "Don't show again" is a player preference persisted in saveCommands (replayable) OR a deterministic derived flag per save — pick the replayable SaveCommand form so replays stay byte-identical.
- Tutorial does NOT force a rigid sequence after the introduction (spec).
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

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mission definitions (map/products/routes/modifiers data) | Data catalogs (`data/missions.ts`) | — | All game data is catalog-driven with validation (DATA-01); targets already live in `MissionDef` |
| Mission start / progression gating / win evaluation | API / sim-core (`runner.ts` + `objectives.ts`) | — | `tickMissionSystem` already owns win evaluation on the month cadence; start/progression must sit beside it |
| Mission replay/save-load | sim-core `SaveCommand` layer (`types.ts` + `applyCommand`) | — | Determinism requires mission start to be a replayable command; map comes from construction-time `SimMap` |
| Mission map layout | Construction-time terrain (`SimMap.fromLayout`) + replayable pre-placed buildings | — | Maps are immutable after construction (`map` is `readonly`); per-mission terrain must be passed in at `new SimRunner` |
| Tutorial cause detection | Pure predicates over derived views (sim-core, `campaign.ts`-style) | — | CONTEXT locks: "pure functions over DerivedSnapshot/BuildingState", deterministic from state |
| Tutorial seen/dismissed persistence | SaveCommand (sim-core) | — | CONTEXT locks: replayable SaveCommand form for byte-identical replays |
| Tutorial/codex UI rendering | Browser / Client (Phase 18, OUT OF SCOPE here) | — | Phase 17 exposes `getTutorial()`/`getCodex()` accessors; rendering is Phase 18 |
| Codex content | Data catalogs (derived, not hand-written copy) | — | CONTEXT: "derived from data catalogs"; every entry field maps to an existing catalog field |

## Standard Stack

**This is a code-only phase: zero new npm packages.** The "stack" is the project's own established sim-core patterns. There is nothing to install.

### Core (internal patterns — the only stack that matters here)
| Pattern | Location | Purpose | Why Standard |
|---------|----------|---------|--------------|
| `ObjectiveTracker` / `ObjectiveTarget` | `src/sim/objectives.ts:13-73` | Sustained win-condition evaluation (default 3-month sustain, month cadence) | RATE-02 locked; `tickMissionSystem` already uses it — missions must keep flowing through it |
| `SaveCommand` union + exhaustive `applyCommand` | `src/sim/types.ts:75-89`, `src/sim/runner.ts:2814-2847` | Replayable player actions; adding a kind fails typecheck at dispatch | Determinism convention: every new player-action surface is a replayable SaveCommand |
| `SaveData` + `fromSaveData(save, map?)` | `src/sim/types.ts:92-103`, `src/sim/runner.ts:2221-2237` | Deterministic save/load via command replay; optional map for custom-terrain cities | Mission maps round-trip by passing the mission map to `fromSaveData` |
| `SimMap.fromLayout(width, height, layout)` | `src/sim/map.ts:39-47` | Deterministic terrain construction from a layout function/string | Mission "map" field implementation |
| `buildCodex()` + catalog iteration | `src/sim/campaign.ts:21-36` | Codex built from `BUILDINGS`/`COMMODITIES`/`WALKERS`/`GODS` catalogs | CAMPAIGN-03 seed; extend entries, keep derivation |
| `validateCatalogs()` / missions loop | `data/validate.ts:171-188` | Catalog validation gates (DATA-01); every new MissionDef field needs validation | New `map/products/routes/modifiers` fields must be validated here |
| Derived accessor convention | `getDerived()`, `getCivicStats()`, `getTradeAdvisor()` | Pure functions over live state, never serialized | `getTutorial()`/`getCodex()` must follow the same convention |

### Supporting
| Pattern | Location | Purpose | When to Use |
|---------|----------|---------|-------------|
| `DerivedSnapshot` | `src/sim/runner.ts:133-160` | Live metrics (population, ratings, employment, services, godWorship, water, annualExports, government) | Tutorial predicate inputs |
| `BuildingState.house` | `src/sim/runner.ts:2747-2768` | Per-house level/cooldowns/services/desirability/happiness | Tutorial cause detection + codex housing entries |
| `desirabilityOf` / `levelDesirability` | `src/sim/housing.ts:60-103`, `src/sim/housingLive.ts:76-84` | 0-200 desirability and its 1-30 normalizer | "Low attractiveness" tutorial predicate + codex desirability entry |
| `tickMissionSystem` | `src/sim/runner.ts:1509-1549` | Month-cadence mission evaluation | Do NOT duplicate — extend in place |
| `HOUSING_LEVELS` / `HOUSING_LIVE_STATS` | `data/housing.ts:26-52`, `src/sim/housingLive.ts:60-66` | 21-level housing ladder (levels 0-20) | Codex housing category + winnability ceilings |
| Production/walker catalogs | `data/buildings.ts`, `data/walkers.ts` | produces/consumes/workers/cost/spawns fields | Codex building entries' inputs/outputs/workers/cost |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Replayable `startMission` SaveCommand + construction-time mission map | Store mission/map in `SaveData` schema fields | SaveData schema change touches `fromSaveData`, `src/game/save.ts`, and every golden save fixture; SaveCommand keeps `version: 1` and the replay path unchanged. Precedent: Phase 15-16 added SaveCommands (`openTradeRoute`, `setTradeOrder`, `respondEvent`) and found "no-new-command" assumptions wrong — commands are the blessed path |
| Fix `mission.year` at start | Reset the whole runner per mission (fresh city) | Resetting mid-run breaks determinism conventions and the "build on previous city" arc; recording the start year is a one-line deterministic fix |
| Hand-written codex copy | Derive entries from catalogs | CONTEXT locks catalog-derived; hand-copy rots when catalogs change (Phase 15/16 moved data multiple times) |
| Wall-clock tutorial timing | Pure state predicates | CONTEXT locks deterministic-from-state; wall-clock breaks byte-identical replay |

**Installation:** none.
```bash
# No new dependencies. Verify with:
npm run typecheck && npx vitest run tests/unit/campaign.test.ts tests/missions.test.ts -x
```

**Version verification:** not applicable (no packages added). Toolchain present: Node v20.20.1, npm 10.8.2, vitest 3.2.7 (node_modules, package.json `^3.0.0`).

## Package Legitimacy Audit

No external packages are installed by this phase — the Package Legitimacy Gate is **not triggered** (code/config-only changes; all dependencies already in package.json: phaser, sharp, vitest, typescript, fast-check, eslint, playwright).

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                        ┌────────────────────────────────────────────┐
                        │            data/missions.ts                 │
                        │  MissionDef + map/products/routes/modifiers │
                        └──────────────┬─────────────────────────────┘
                                       │ validated by data/validate.ts (missions loop)
                                       ▼
┌─────────────┐   startMission(id)   ┌──────────────────────────────────────────────┐
│  Player/UI  │ ───────────────────▶ │  SimRunner.startMission (SaveCommand)          │
│  (Phase 18) │                      │  • gate: id == nextUnlocked(campaignProgress) │
└─────────────┘                      │  • mission.year = floor(tickCount/360)  ★FIX  │
        ▲                            │  • apply modifiers: treasury credit, policy    │
        │                            │  • pre-place map buildings (replayable place  │
        │                            │    commands), open routes, set quotas          │
        │                            └──────────────┬───────────────────────────────┘
        │                                           │ tick (month cadence % 40)
        │                            ┌──────────────▼───────────────────────────────┐
        │                            │ tickMissionSystem → ObjectiveTracker.update  │
        │                            │ win ⇒ mission.complete;  unlock N+1          │
        │                            └──────────────┬───────────────────────────────┘
        │                                           │
        ▼                            ┌──────────────▼───────────────────────────────┐
┌───────────────────┐    getTutorial()│  getCodex()  (pure derived accessors)        │
│  Phase 18 UI      │ ◀──────────────┤  tutorialState: eligible/seen/dismissed       │
│  highlight/show-  │                │  cause predicates over DerivedSnapshot +      │
│  where/dismiss    │ ◀──────────────┤  BuildingState.house (no wall-clock)          │
└───────────────────┘                └──────────────────────────────────────────────┘
        ▲   SaveCommand replay path:
        │   {kind:'startMission'} {kind:'dismissTutorialStep'} → applyCommand
        └── saveCommands[] ──▶ getSaveData() ──▶ fromSaveData(save, missionMap)
```

Entry points: `startMission(id)` (campaign progression), `getTutorial()`/`getCodex()` (UI reads). Processing: mission evaluation on the month cadence through the existing tracker; tutorial/codex are pure derivations from state. Decision points: unlock gate in `startMission`; cause-detection predicate chain per tutorial step; time-limit failure check in `tickMissionSystem`. External boundary: none beyond the existing data catalogs.

### Recommended Project Structure (all additive — no restructuring)

```
data/missions.ts          # extend MissionDef (map/products/routes/modifiers) + retheme 10 entries
data/validate.ts          # extend missions validation loop (new fields)
src/sim/campaign.ts       # extend CodexEntry fields + categories; tutorial step catalog + predicates
src/sim/missions.ts       # either update (progression order) or leave as legacy; runner is authoritative
src/sim/runner.ts         # startMission (map/modifiers/progression + SaveCommand), getTutorial(), getCodex(),
                          #   dismissTutorialStep, mission state into getSaveData replay (via SaveCommand)
src/sim/types.ts          # SaveCommand union: + {kind:'startMission'; id:string} + {kind:'dismissTutorialStep'; step:string}
src/sim/missionMaps.ts    # [new, optional] per-mission layout builders (SimMap.fromLayout) — or inline in data/missions.ts
tests/missions.test.ts    # extend: progression gating, map/modifier application, time-limit start-year fix
tests/unit/campaign.test.ts  # extend: codex entry fields + categories; tutorial predicates + dismiss
tests/runner-accessors.test.ts # extend: mission save/load round-trip, getTutorial/getCodex accessors
tests/determinism/…       # NEW tests/campaign-determinism.test.ts: mission + tutorial dismiss replay byte-identity
```

### Pattern 1: Mission state as a replayable SaveCommand
**What:** `startMission(id)` pushes `{kind:'startMission', id}` to `saveCommands` and mutates mission state; replay calls the same path. `missionTracker` is derived purely from `tickCount` + mission state, so it reconstructs identically on replay (same reason `respondEvent`/`openTradeRoute` work).
**When to use:** every new player-action surface in this phase (mission start, tutorial dismiss).
**Example (existing precedent, verbatim — `openTradeRoute`, [VERIFIED: src/sim/runner.ts:1000-1007]):**
```typescript
this.commandLog.push({ tick: this.tickCount, command: `openTradeRoute ${cityId}`, result: 'ok' });
// RATE-02: route openings are replayed as SaveCommands so a save/load
// round-trip reconstructs the exact trade state (and the annualExports
// window that derives from it).
this.saveCommands.push({ kind: 'openTradeRoute', cityId });
```
Dispatch side must be extended in `applyCommand`; the exhaustive `else` branch makes a forgotten kind a compile error ([VERIFIED: src/sim/runner.ts:2843-2846]):
```typescript
} else {
  const exhaustive: never = cmd;
  throw new Error(`unknown command kind: ${(exhaustive as { kind: string }).kind}`);
}
```

### Pattern 2: Mission map via construction-time terrain + replayable pre-placements
**What:** terrain (fertile patches for farms, water for wharf/port, rocks for quarries) is passed to `new SimRunner(seed, SimMap.fromLayout(...))` — the map is `readonly` after construction ([VERIFIED: src/sim/runner.ts:238-251]). Pre-placed buildings (starter road/house/well) are issued as ordinary `place` SaveCommands inside `startMission`, so save/load replays them automatically.
**When to use:** every mission that needs a fixed start layout (all 10 per CONTEXT decision "loaded deterministically when the mission is selected").
**Save/load:** `SimRunner.fromSaveData(save, map)` already accepts the map param ([VERIFIED: src/sim/runner.ts:2217-2237]) — the game-level caller (Phase 18/19) must pass the mission's map; document this contract in the accessor docstring.

### Pattern 3: Tutorial cause-detection predicates (pure, over live state)
**What:** each step = `{ stepId, eligible(derived, buildings), title, shortText, expandedText, codexRef }`. `eligible` is a pure function; the runner computes `tutorialState` in `tickDerivedSystems()` alongside the derived snapshot. `nextTutorialPrompt` becomes: first not-seen, not-dismissed step whose predicate is true (introduction steps that are trivially true keep the existing ordered seed).
**When to use:** all tutorial steps; no wall-clock anywhere.
**Example — the spec's immigration-blocked scenario, expressed with verified live data:**
```typescript
// Road-to-entry: houses require road adjacency at placement, so the real
// blocker is NETWORK isolation — labor walkers can't reach the house.
const roadBlocked = houses.some((h) => !h.laborConnected && h.workersRequired > 0);
// Vacancies: population == capacity by design (capacity is live); growth is
// evolution — a house stuck below the level needed to house the demand.
const levelStuck = houses.some((h) => h.level < expectedLevel);
// Attractiveness: per-house desirability (0-200) + the migration pull formula.
const lowDesirability = houses.some((h) => h.desirability < MIN_ATTRACTIVE);
```
`laborConnected` is set when a labor walker reaches the building ([VERIFIED: src/sim/walkers.ts:723-728]); per-house `desirability`/`foodCooldown`/`waterCooldown`/`laborCooldown`/`services`/`level` are all in `BuildingState.house` ([VERIFIED: src/sim/runner.ts:2747-2768]); `DerivedSnapshot.employment/services/godWorship/water` cover the rest ([VERIFIED: src/sim/runner.ts:133-160]).

### Pattern 4: Codex entries derived from catalogs, extended additively
**What:** extend `CodexEntry` (`kind` gains `chain|housing|desirability|trade|finance|ratings|religion|risks|shortcuts`; fields gain `description|howItWorks|inputs|outputs|workers|cost|hints|requirements|relatedLinks`), and fill per-entry fields from existing catalog data:
- buildings: `cost`, `workers`, `produces`/`consumes`, `footprint`, `spawns`, `serviceRadius`, `storageCapacity`, `requiredPopulation`/`requiredRating` ([VERIFIED: data/buildings.ts:24-52])
- commodities: `category`, `storage`, `durabilityMonths`, `baseImportPrice`/`baseExportPrice`, `houseGood`, `tradable` ([VERIFIED: data/commodities.ts:8-21])
- services/walkers: `service`, `spawnedBy` ([VERIFIED: data/walkers.ts:5-12])
- gods: `GODS` list ([VERIFIED: src/sim/services.ts:34])
- housing: `HOUSING_LEVELS` per-level name/capacity/requires/requiresGoods/desirability ([VERIFIED: data/housing.ts:7-24])
- chains: join `produces`/`consumes` across raw→workshop→market; ratings: the `W` weights + `computeTargets` ([VERIFIED: src/sim/ratings.ts:89-94, 285-292])
**When to use:** the whole CAMPAIGN-03 scope. Keep `buildCodex()` a pure function of catalogs; add `getCodex()` on the runner as a cached pure accessor (same convention as `getDerived`).

### Per-Mission Winnability Assessment (existing entries, current targets — HIGH/MEDIUM confidence analysis over verified mechanics)

| # (spec arc) | Existing id | Current targets | Feasibility | Notes / recommended tuning |
|---|---|---|---|---|
| 1 riverside foundations | `tutorial` | pop 100, 10/10/10, 500 dn. | HIGH — trivially winnable | 5 level-1 houses (20 pop each [VERIFIED: data/housing.ts:32]) + well + farm/market; culture base 10 alone meets target ([VERIFIED: ratings.ts:90]) |
| 2 provincial granary | `small_town` | pop 500, 30/30/30, 2000 dn. | HIGH | 25 L1 houses or ~9 L3 (60 cap); granary+farms+market bootstrap tested city (tests/helpers `buildFoodCity`) |
| 3 clay and fire | `thriving_city` | pop 2000, 60/60/60, 5000 dn., 10 y | MEDIUM-HIGH | 10 L10 houses (220 cap); needs clay→pottery, timber→furniture, olives→oil, grapes→wine chains + civic; culture 60 = ~edu 0.8+ent 0.6+rel 0.6 (weights [VERIFIED: ratings.ts:90]); 3600 ticks is enough |
| 4 trade roads | `grand_city` | pop 5000, 80/80/80, 10k dn., 20 y | MEDIUM | Culture 80 needs near-full civic coverage + festival (max 105 [VERIFIED: ratings.ts:90]); prosperity 80 needs avg tier ~3.2, treasury ≥ 2000 (operatingBalance factor [VERIFIED: ratings.ts:91, runner.ts:1276]); 7200 ticks OK |
| 5 water for all | `fishing_village` | pop 300, 20/20/20, 1500 dn. | HIGH | Water-specific: wells/fountains coverage + fish wharf needs water-adjacent placement; easy targets |
| 6 city of scholars | `market_town` | pop 900, 40/40/40, 3000 dn., 8 y | HIGH | 2880 ticks; school/library + theatre push culture to 40 easily (30 edu + 10 base = 40 with full school coverage) |
| 7 favors of the gods | `port_city` | pop 3000, 60/60/60, 6000 dn., 12 y | MEDIUM-HIGH | **Add targetFavor 60-80**: favor = min(100, 30 base (tax 0) + worship ≤ 100 (5 gods × 20 [VERIFIED: src/sim/services.ts:40-42])) — 2-3 gods at full coverage clears 60; 12 years OK |
| 8 southern port | `cultural_center` | pop 4000, 80/50/60, 8000 dn., 15 y | MEDIUM | Culture 80 demanding (as #4); prosperity 50 easy; sea trade (caralis/londinium ships, capacity 16 [VERIFIED: transport.ts:9-10]) + wharf access required for flavor |
| 9 city of patricians | `religious_hub` | pop 4500, 70/60/70, 9000 dn., 18 y | MEDIUM | Stability 70 needs supply (granary full: supplyLevelFactor = stock/capacity [VERIFIED: runner.ts:1053-1060]), employment, fire coverage; desirability/villa ladder: L12+ tier 3 = patricianShare ([VERIFIED: runner.ts:1035-1041], tierOfLevel floor(level/4)) |
| 10 provincial capital | `metropolis` | pop 6000, 85/85/85, 12k dn., 25 y | **LOW-MEDIUM — hardest** | All three ratings in the cap region (max culture 105, prosperity 110, stability 96.4 [VERIFIED: ratings.ts:89-94]); needs avg tier ~4 (ALL houses L16+, senate), full employment, full granary stock, festival during sustain, 3+ gods; 6000 pop = 15 L20 houses (420 cap) or 4 merged 4×4 blocks (1680 each, HOUS-02 [VERIFIED: housingLive.ts:100-107]); recommend easing to 80/80/80 or 30 y — gate behind a scripted winnability probe test |

**Global ceilings to respect when tuning (all VERIFIED):**
- Population: level capacity × houses; L20 = 420 ([VERIFIED: data/housing.ts:51]); 40×40 default map ([VERIFIED: data/balance.ts:9]) fits any target ≤ ~6000 with room to spare.
- Ratings: culture ≤ 105 max, prosperity ≤ 110, stability ≤ 96.4, favor ≤ 100 — targets ≥ 85 require near-max simultaneous factors; sustained 3-month hold makes the 85-90 region fragile to events (fire/earthquake dip stability via `eventMod` [VERIFIED: runner.ts:1298-1302]).
- annualExports: trailing-360-tick window [VERIFIED: runner.ts:223-229]; realistic cap ~50-150 loads/yr (4 routes: massilia 7 goods × quota 12 × ~2.25 arrivals/yr × cap 8, caralis 6 × 15 × 1.64 × 16, londinium 5 × 30 × 1.2 × 16, tarraco 3 × 40 × 0.86 × 8; stock-limited). **Targets ≤ 100 safe; 150 hard; > 200 unreachable.**
- Treasury: verified income math — a 2000-pop L10 city nets ~+36k dn./yr after wages (tax floor LEVEL_TAX_PER_WORKER 5×workers [VERIFIED: housingLive.ts:43-55]); targets ≤ 15k trivially winnable, ≤ 25k needs years.
- Favor: ≤ 100 max ([VERIFIED: services.ts:40-42]); 60-80 comfortable with 2-4 gods + festival (FESTIVAL_BOOST_WINDOW_TICKS 480 [VERIFIED: data/religion.ts:23]).

### Anti-Patterns to Avoid
- **Hardcoding `year: 0` in `startMission`** — instantly fails time-limited missions started on a runner that already ticked N years (`year - this.mission.year > def.timeLimitYears`, [VERIFIED: runner.ts:1519-1523]). Record `mission.year = Math.floor(this.tickCount / 360)` at start.
- **Mission state outside the replay path** — mission lost on save/load today because `SimState` has no mission field and `startMission` isn't a SaveCommand; keep every mission mutation replayable.
- **Wall-clock tutorial triggers** — breaks byte-identical replay; predicates only.
- **Favor/trade targets from the spec arc blindly** — verify against the ceilings above; e.g. annualExports > 200 is unwinnable.
- **Adding fields to `SaveData` instead of new SaveCommand kinds** — schema change ripples into `src/game/save.ts`, golden fixtures, and `fromSaveData`; commands are additive and the exhaustive dispatch typechecks.
- **Renaming mission ids** — `tutorial`/`small_town`/`thriving_city`/`grand_city` are referenced by tests ([VERIFIED: tests/missions.test.ts:9-25, tests/runner-accessors.test.ts:34-41]) and `campaignMissions()` order ([VERIFIED: src/sim/missions.ts:66-69]); keep ids, re-theme `name`/`description` to the spec arc.
- **Hand-writing codex copy** — derive; catalogs are the source of truth and validated.
- **Military tokens in mission names/text** — `check-military` gate forbids `military/army/legion/soldier/fort/barracks/weapon/enemy/invasion/combat/damageFromUnit` in `src/` and `data/` ([VERIFIED: scripts/check-military.mjs:2-12]); arc names are clean.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Win evaluation / sustain logic | A second mission-completion loop | Existing `ObjectiveTracker` via `tickMissionSystem` ([VERIFIED: runner.ts:1509-1549]) | RATE-02 locked; month cadence + pure `getObjectiveProgress` read; a parallel path would double-count or drift |
| Save/load of new player actions | Custom serialization in `SaveData` | New SaveCommand kinds + exhaustive `applyCommand` | Deterministic replay is a core value; commands are additive and typechecked |
| Mission terrain maps | Runtime map mutation | `SimMap.fromLayout` at construction + `fromSaveData(save, map)` | Map is `readonly`; mutation would break the RNG/terrain identity |
| Ratings/favor math for codex | Hardcoded explanations | Read the verified `W` weights and `computeTargets`/`computeFavor` code | Explanations must match live math or the codex lies |
| Immigrants/attractiveness model | A new migration mechanic | Existing per-house desirability + evolution ladder + `laborConnected` | `netMigration` exists ([VERIFIED: population.ts:63-68]) but is **dead code** — population == capacity by design; tutorial should explain the real growth path (evolution), not a fiction |

**Key insight:** this phase is 90% *wiring and data*, 10% *new logic*. The win engine, determinism layer, catalogs, and live state surface all already exist and are tested. The highest-risk work is the campaign progression/time-limit integration and target tuning — not new mechanics.

## Common Pitfalls

### Pitfall 1: Time-limit instant-fail on sequential missions
**What goes wrong:** start mission N+1 at year 6 in the same runner; `mission.year = 0` → `6 - 0 > timeLimitYears` → mission fails on the next month gate without ever being playable.
**Why it happens:** `startMission` hardcodes `year: 0` ([VERIFIED: runner.ts:2102-2108]) while the failure check compares against `Math.floor(this.tickCount / 360)` ([VERIFIED: runner.ts:1519]).
**How to avoid:** set `year: Math.floor(this.tickCount / 360)` at start; unit-test starting a time-limited mission after 3000+ ticks.
**Warning signs:** `getMission().failed === true` immediately after `startMission` on a long-run runner.

### Pitfall 2: Mission state silently lost on save/load
**What goes wrong:** save mid-mission, load → `getMission()` is null; the campaign "forgets" progress and the tracker resets.
**Why it happens:** mission is runner-private ([VERIFIED: runner.ts:2120-2122]), absent from `SimState` ([VERIFIED: runner.ts:1701-1727]) and `SaveData` ([VERIFIED: types.ts:92-103]); `startMission` is not a command.
**How to avoid:** `startMission` pushes a SaveCommand; `applyCommand` dispatches it; add a round-trip test asserting `getMission()` and `getObjectiveProgress()` survive.
**Warning signs:** save/load determinism tests pass but mission assertions fail on reload.

### Pitfall 3: Unwinnable targets (esp. annualExports, 85+ ratings)
**What goes wrong:** a mission can never complete; campaign stalls at mission N; success criterion 1 fails.
**Why it happens:** spec-arc missions tempt targets (e.g. annualExports 200, culture 90) above verified ceilings (see winnability table).
**How to avoid:** keep annualExports ≤ 100 (realistic 50-150), ratings ≤ 85 only on the final mission with a long time limit, favor ≤ 80; add a **winnability probe test** that scripts each mission's city (helpers exist: `buildFoodCity`, `buildProductionCity`) and asserts the targets are reachable in the time limit.
**Warning signs:** sustain counters repeatedly reset at the month gate on an otherwise healthy city.

### Pitfall 4: Tutorial sequence that doesn't reflect reality
**What goes wrong:** the spec's "houses built but no immigrants → check road/vacancy/attractiveness" can't be implemented literally: population == level capacity instantly; there is no vacancy mechanic.
**Why it happens:** `netMigration` is dead code ([VERIFIED: population.ts:63-68]); the sim grows by housing evolution.
**How to avoid:** map the spec scenario onto real observables — road-to-entry = network isolation (`laborConnected === false`), vacancies = level/capacity plateau, attractiveness = per-house `desirability` + food/water/labor cooldowns. Explain the *real* blocker with verified data.
**Warning signs:** tutorial text mentions mechanics that don't exist in code.

### Pitfall 5: Non-determinism sneaking in
**What goes wrong:** byte-identical replay breaks; golden tests fail; phase gate blocks.
**Why it happens:** `Date.now()`/`Math.random()`/`new Date()` in new paths; iteration over `Object.values` of maps with insertion-order assumptions (fine here, but keep catalog-order iteration); tutorial predicates reading wall-clock.
**How to avoid:** the sim's only permitted clock is `savedAt: Date.now()` in `getSaveData` ([VERIFIED: runner.ts:2201]); everything else derives from `tickCount` + state; run the determinism suites.
**Warning signs:** `tests/determinism/*` failing after adding code.

### Pitfall 6: Codex/catalog drift
**What goes wrong:** codex says a building costs X but the catalog changed; data/validate rejects new mission fields.
**Why it happens:** hand-copied entries; new MissionDef fields not added to the validate missions loop ([VERIFIED: data/validate.ts:171-188]).
**How to avoid:** derive codex fields from catalogs only; validate every new mission field (map bounds, route city ids, product ids, finite modifiers); keep `catalog-load-guard`/`data-catalog` tests green.
**Warning signs:** `validateCatalogs()` throwing on boot.

## Code Examples

Verified patterns from the existing codebase (read this session):

### 1. Mission win evaluation (extend in place, do not duplicate) — [VERIFIED: src/sim/runner.ts:1509-1549]
```typescript
private tickMissionSystem(): void {
  if (!this.mission || this.mission.complete || this.mission.failed) return;
  const def = MISSIONS[this.mission.id] ?? EXTRA_MISSIONS[this.mission.id];
  if (!def) {
    this.mission.failed = true;
    return;
  }
  const year = Math.floor(this.tickCount / 360);
  if (def.timeLimitYears && year - this.mission.year > def.timeLimitYears) {
    this.mission.failed = true;
    return;
  }
  if (!this.missionTracker) {
    this.missionTracker = new ObjectiveTracker({
      population: def.targetPopulation,
      culture: def.targetCulture,
      prosperity: def.targetProsperity,
      stability: def.targetStability,
      favor: def.targetFavor,
      treasury: def.targetTreasury,
      annualExports: def.targetAnnualExports,
      sustainChecks: def.sustainChecks ?? 3,
    });
  }
  if (this.tickCount % 40 === 0) {
    const d = this.derived ?? this.derivedSnapshot();
    const r = this.missionTracker.update({
      population: d.population,
      culture: d.culture,
      prosperity: d.prosperity,
      stability: d.stability,
      favor: d.favor,
      treasury: d.treasury,
      annualExports: d.annualExports,
    });
    if (r.won) this.mission.complete = true;
  }
}
```

### 2. MissionDef — additive extension point (fields stay optional; existing entries unchanged) — [VERIFIED: data/missions.ts:5-29]
```typescript
export interface MissionDef {
  id: string;
  name: string;
  description: string;
  /** Target population to achieve. */
  targetPopulation: number;
  /** Target culture rating. */
  targetCulture: number;
  /** Target prosperity rating. */
  targetProsperity: number;
  /** Target stability rating. */
  targetStability: number;
  targetFavor?: number;
  targetTreasury?: number;
  targetAnnualExports?: number;
  /** Months the targets must be held consecutively (default 3). */
  sustainChecks?: number;
  /** Starting treasury (denarii). */
  startingDenarii: number;
  /** Time limit in years, if any. */
  timeLimitYears?: number;
}
```
New optional fields to add (per CONTEXT decision): `map?` (layout), `products?` (goods-chain emphasis), `routes?` (open route city ids + quotas), `modifiers?` (difficulty knobs).

### 3. SaveCommand union — add new kinds additively — [VERIFIED: src/sim/types.ts:75-89]
```typescript
export type SaveCommand =
  | { kind: 'place'; type: BuildingType; x: number; y: number; god?: string }
  | { kind: 'setPolicy'; taxRate: number; wageRate: number }
  | { kind: 'demolish'; x: number; y: number }
  | { kind: 'requestRoyalSubsidy' }
  | { kind: 'takeLoan'; amount: number }
  | { kind: 'repayLoan'; amount: number }
  | { kind: 'holdFestival'; tierId: string }
  | { kind: 'setGovernorSalaryLevel'; level: number }
  | { kind: 'donateToGovernor'; amount: number }
  | { kind: 'deliverGoods'; requestId: string; good: string; qty: number }
  | { kind: 'payRequest'; requestId: string; amount: number }
  | { kind: 'openTradeRoute'; cityId: string }
  | { kind: 'setTradeOrder'; cityId: string; good: string; mode: import('./trade').TradeOrderMode; reserve?: number; target?: number }
  | { kind: 'respondEvent'; eventId: string; choiceId: string; tick?: number };
```
Add: `| { kind: 'startMission'; id: string } | { kind: 'dismissTutorialStep'; step: string }`.

### 4. fromSaveData with an optional map (mission terrain round-trip contract) — [VERIFIED: src/sim/runner.ts:2221-2237]
```typescript
static fromSaveData(save: SaveData, map?: SimMap): SimRunner {
  const runner = new SimRunner(save.seed, map, save.mapSize);
  runner.replaying = true;
  for (const c of save.commands) applyCommand(runner, c);
  runner.replaying = false;
  while (runner.tickCount < save.tickCount) runner.tick();
  if (save.pendingCommands && save.pendingCommands.length > 0) {
    for (const c of save.pendingCommands) runner.enqueue({ ...c });
  }
  runner.paused = save.paused ?? false;
  return runner;
}
```

### 5. Per-house live state available to tutorial predicates — [VERIFIED: src/sim/runner.ts:2747-2768]
```typescript
const h: NonNullable<BuildingState['house']> = {
  tier: b.house!.tier,
  tierName: HOUSE_TIERS[b.house!.tier].name,
  level: lvl,
  levelName: housingLevelName(lvl),
  populationCapacity: effectivePopulation(b),
  foodCooldown: b.house!.foodCooldown,
  waterCooldown: b.house!.waterCooldown,
  laborCooldown: b.house!.laborCooldown,
  services: b.house!.services ? { ...b.house!.services } : undefined,
  desirability: input.desirability,
  happiness: houseHappiness(input),
};
```

### 6. Derived metrics available to tutorial/codex — [VERIFIED: src/sim/runner.ts:133-160]
```typescript
export interface DerivedSnapshot {
  population: number;
  culture: number;
  prosperity: number;
  stability: number;
  favor: number;
  employment: { jobs: number; employed: number };
  services: { health: number; literacy: number; entertainment: number; religion: number };
  godWorship: Record<string, number>;
  water: { coveredTiles: number; totalTiles: number };
  fireRisk: number;
  collapseRisk: number;
  crime: number;
  treasury: number;
  taxes: number;
  wages: number;
  codex: { buildings: number; goods: number; services: number; gods: number };
  government: string[];
  decomposition: RatingDecomposition;
  constructionSpend: number;
  annualExports: number;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Instant-win `tickMission` (missions.ts) | Sustained `ObjectiveTracker` in `tickMissionSystem` (runner) | Phase 15 (RATE-02) | Missions win only after targets held for sustainChecks months; `missions.ts` legacy functions now dead (tests-only) |
| No trade save/load | `openTradeRoute`/`setTradeOrder` SaveCommands | Phase 15 (RATE-02) | Precedent for this phase's `startMission`/`dismissTutorialStep` commands |
| Hardcoded housing tiers | 21-level catalog + live stats (HOUS-01/HOUS-02) | Phase 16 | Level capacity is the population model; tutorial "vacancies" must speak evolution language |
| `buildCodex` count-only entries | Full codex (this phase) | Phase 17 | `derivedSnapshot().codex` counts stay; entries gain rich fields + categories |
| Ordered tutorial sequence | State-observed predicates (this phase) | Phase 17 | `nextTutorialPrompt` stays the seed; eligibility becomes state-driven |

**Deprecated/outdated:**
- `src/sim/missions.ts` `startMission`/`tickMission`/`missionName`: superseded by the runner's tracker path; update or leave as-is, but the runner must not call them (it doesn't today).
- `netMigration`/`Residence` in `src/sim/population.ts`: dead code — do not wire into the tutorial narrative.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Keeping existing mission **ids** and re-theming names/descriptions to the spec arc is acceptable (CONTEXT's arc names map 1:1 to the existing 10 entries) | Architecture Patterns | If ids must match the spec names, tests referencing `tutorial`/`thriving_city` break and `campaignMissions()[0]` assertions change — planner must add a rename task |
| A2 | Winnability estimates (ratings ceilings, export caps, treasury income) are analysis over verified mechanics, not play-tested numbers | Winnability table | A mission tuned near a ceiling (esp. #4 culture 80, #10 85/85/85) could be unwinnable in practice; mitigate with a scripted winnability probe test before locking targets |
| A3 | The tutorial dismiss preference should be a per-step `dismissTutorialStep` SaveCommand (CONTEXT offered two options: SaveCommand OR deterministic derived flag) | Patterns | CONTEXT says "pick the replayable SaveCommand form" — low risk |
| A4 | Mission maps are terrain-only via `SimMap.fromLayout` with pre-placed buildings as replayable `place` commands; game-level save/load (Phase 19) will pass the mission map to `fromSaveData` | Patterns | If the mission must be selectable mid-run on an existing city (no reconstruction), terrain switching is impossible (readonly map) — the planner should design startMission to construct/reconfigure rather than mutate terrain |
| A5 | `startingDenarii` is currently **not applied anywhere** (grep: only the data field exists); applying it as a treasury credit on mission start is new behavior | Architecture Patterns | If a mission is started on a fresh runner, the constructor already grants `CONFIG.startingTreasury` (1000 [VERIFIED: data/balance.ts:11]) — the mission credit must be additive and replayable; flag to user if missions should reset the treasury instead |
| A6 | Phase 18 (Management UI) will consume `getTutorial()`/`getCodex()`; this phase only exposes the accessors | Summary | If UI work is pulled into Phase 17, scope grows — keep accessor-only |
| A7 | `sustainChecks` semantics: 3 months at month cadence; missions use the default 3 unless overridden | Winnability table | Matches [VERIFIED: data/missions.ts:23-24] and Phase 15 tests — low risk |

## Open Questions

1. **Mission progression across saves:** should winning mission N persist `campaignProgress` (next unlocked id) in save data, or is "unlocked = won in this session" enough?
   - What we know: no progression state exists anywhere; `startMission` is the only gate point; SaveCommands replay deterministically.
   - What's unclear: whether a reloaded save mid-mission N should still allow starting N+1 (requires the wins to be derivable from replay — they are: mission.complete is derived from the tracker, but the unlock *state* needs its own command or derivation).
   - Recommendation: derive unlock from replayed mission wins (scan for `startMission` commands whose tracker reached complete) OR record `{kind:'missionWon', id}`; simplest deterministic option: gate on "previous mission complete" derived at start time from replayed state.

2. **Per-mission treasury reset:** does starting a mission grant `startingDenarii` on top of the current treasury, or reset to it?
   - What we know: `startingDenarii` exists in data but is unused; `CONFIG.startingTreasury` (1000) applies at construction only.
   - Recommendation: additive credit via a replayable treasury command (or reuse the ledger); confirm with the user in discuss — CONTEXT lists "starting treasury" as a modifier, implying per-mission grants.

3. **Mission map size:** the 10 layouts need a fixed size — 40×40 default, smaller (e.g. 24×24) for early missions, or per-mission?
   - Recommendation: per-mission `map.width/height` in the layout data; small early maps teach systems faster. Planner should define the 10 layouts explicitly (agent's discretion, but the runner must be constructed with the right size).

4. **Tutorial step set beyond the spec example:** which concrete steps? Recommendation (all with verified live data): roads-network-isolated, no-food, no-water, no-labor, low-desirability, housing-evolution-stuck, trade-quota, ratings-explainer, festival/favor, request-event. Confirm count/priority in discuss.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | typecheck, vitest | ✓ | v20.20.1 | — |
| npm | scripts | ✓ | 10.8.2 | — |
| vitest | all tests | ✓ | 3.2.7 (node_modules; package.json `^3.0.0`) | — |
| TypeScript | `npm run typecheck` | ✓ | ^5.7.0 (package.json) | — |
| eslint | `npm run lint` | ✓ | ^9.17.0 (package.json) | — |
| Phaser/sharp | game shell (untouched by this phase) | ✓ | package.json | — |

**Missing dependencies with no fallback:** none — this phase is code/config-only.

## Validation Architecture

> `.planning/config.json` absent → `workflow.nyquist_validation` treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.7 |
| Config file | none (vitest defaults; suite paths in package.json scripts) |
| Quick run command | `npx vitest run tests/unit/campaign.test.ts tests/missions.test.ts tests/runner-accessors.test.ts -x` |
| Full suite command | `npm run test:unit` (tests/unit, integration, determinism, golden, property) + `npm run typecheck` + `npm run check:military` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAMPAIGN-01 | 10 missions playable/winnable in sequence; progression gating; map/modifiers applied; time-limit starts at mission start | unit + integration + determinism | `npx vitest run tests/missions.test.ts tests/runner-accessors.test.ts tests/determinism/campaign-determinism.test.ts -x` | ❌ extend missions.test.ts + runner-accessors.test.ts; ❌ NEW campaign-determinism.test.ts |
| CAMPAIGN-02 | tutorial steps trigger on observed state; cause detection correct; dismiss persists across save/load | unit | `npx vitest run tests/unit/campaign.test.ts -x` | ❌ extend tests/unit/campaign.test.ts (predicates + dismiss round-trip) |
| CAMPAIGN-03 | codex covers all catalogs; entry fields populated from data; lookup by id/kind | unit | `npx vitest run tests/unit/campaign.test.ts -x` | ❌ extend tests/unit/campaign.test.ts |

### Sampling Rate
- **Per task commit:** `npm run typecheck && npx vitest run tests/unit/campaign.test.ts tests/missions.test.ts tests/runner-accessors.test.ts -x`
- **Per wave merge:** `npm run test:unit`
- **Phase gate:** full suite green + `npm run check:military` before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/campaign.test.ts` — extend: codex entry field completeness, tutorial predicate behavior, dismiss preference replay
- [ ] `tests/missions.test.ts` — extend: progression unlock gating, mission start-year fix (time-limited mission started at year 5+), map/modifier application
- [ ] `tests/runner-accessors.test.ts` — extend: `getTutorial()`/`getCodex()` accessors; mission save/load round-trip
- [ ] `tests/determinism/campaign-determinism.test.ts` — NEW: startMission + dismissTutorialStep replay byte-identity (mirror finance-determinism.test.ts style)
- [ ] Winnability probe test — NEW: script each mission's target city (reuse `buildFoodCity`/`buildProductionCity` helpers) and assert targets reachable within `timeLimitYears`

## Security Domain

> `.planning/config.json` absent → `security_enforcement` treated as enabled.

No new external input surface: this phase adds sim-core logic and data only (no network, no auth, no persistence format change, no new CLI). The relevant controls are the existing deterministic-input and catalog-integrity guarantees.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no user accounts |
| V3 Session Management | no | no sessions |
| V4 Access Control | no | no multi-user |
| V5 Input Validation | yes | `data/validate.ts` catalog validation (DATA-01) — extend missions loop for new fields; exhaustive `applyCommand` dispatch rejects unknown SaveCommand kinds ([VERIFIED: runner.ts:2843-2846]); placement gates already validate coordinates |
| V6 Cryptography | no | no crypto |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed mission data (map out of bounds, bad product/route ids) crashing the sim | Tampering | `validateCatalogs()` at runner construction ([VERIFIED: runner.ts:231-235]) + extended missions loop |
| Unknown SaveCommand kind injected via save file | Tampering | Exhaustive `applyCommand` throws on unknown kind — replay of a tampered save fails loudly, never silently corrupts |
| Tutorial predicates throwing on edge state (no houses, no buildings) | DoS | Predicates must be total functions over `DerivedSnapshot`/`BuildingState` (guard empty arrays); covered by property-test style edge cases |

## Sources

### Primary (HIGH confidence — files read this session, verbatim quotes in-line)
- `data/missions.ts` (MissionDef + 10 entries) — Read tool, full file
- `src/sim/runner.ts` (tickMissionSystem, startMission/getMission, getState, getSaveData, fromSaveData, applyCommand, DerivedSnapshot, toBuildingState, tickExportCounts, constructor, tick) — Read tool, lines 133-160, 222-271, 1290-1589, 1690-1764, 2090-2249, 2740-2864
- `src/sim/campaign.ts` (CodexEntry, buildCodex, TutorialStepId, TUTORIAL_TEXT, nextTutorialPrompt, tutorialText) — Read tool, full file
- `src/sim/objectives.ts` (ObjectiveTarget, ObjectiveTracker) — Read tool, full file
- `src/sim/missions.ts` (campaignMissions, legacy startMission/tickMission) — Read tool, full file
- `src/sim/types.ts` (SaveCommand union, SaveData) — Read tool, lines 75-120
- `src/sim/housing.ts` (desirabilityOf) — Read tool, lines 58-102
- `src/sim/housingLive.ts` (LEVEL_TAX_PER_WORKER, effectivePopulation) — Read tool, lines 1-120
- `src/sim/population.ts` (netMigration dead code) — Read tool, lines 55-70
- `src/sim/walkers.ts` (laborConnected assignment) — Read tool, lines 715-728
- `src/sim/ratings.ts` (W weights, computeTargets) — Read tool, lines 84-97, 285-292
- `src/sim/transport.ts` (CARAVAN_CAPACITY/SHIP_CAPACITY) — Read tool, lines 1-14
- `src/sim/services.ts` (GODS, computeFavor) — Read tool + bash grep, lines 34, 40-42
- `data/buildings.ts`, `data/commodities.ts`, `data/walkers.ts`, `data/housing.ts`, `data/religion.ts`, `data/trade.ts`, `data/requests.ts`, `data/events.ts`, `data/balance.ts`, `data/validate.ts` — Read tool (housing/buildings/commodities/walkers/validate/balance) + bash (religion/trade/requests/events)
- `src/sim/map.ts` (fromLayout/generate), `src/sim/pathfind.ts` — bash read
- `tests/missions.test.ts`, `tests/unit/campaign.test.ts`, `tests/runner-accessors.test.ts`, `tests/helpers.ts`, `tests/determinism/determinism.test.ts` — Read tool
- `scripts/check-military.mjs` (FORBIDDEN_TOKENS) — bash read
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `17-CONTEXT.md`, `openspec/specs/campaign/spec.md` — Read tool
- `.planning/phases/15-ratings-objectives-events/15-PLAN.md` (Phase 15 mission-unify plan) — bash grep

### Secondary (MEDIUM confidence)
- Per-mission winnability analysis — derived from the verified mechanics above (flagged ASSUMED in the Assumptions Log)
- No web sources used; no external packages involved

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every pattern cited is existing, tested code read this session
- Architecture: HIGH — integration points pinned to verified line ranges; remaining choices are CONTEXT-locked
- Pitfalls: HIGH — the two worst landmines (time-limit `year: 0`, mission save/load loss) are confirmed by reading the code
- Winnability: MEDIUM — analysis over verified mechanics, not play-tested; probe test recommended

**Research date:** 2026-08-05
**Valid until:** 2026-09-04 (stable sim-core; catalogs rarely move after Phase 16)
