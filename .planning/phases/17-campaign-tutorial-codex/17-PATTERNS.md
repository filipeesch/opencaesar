# Phase 17: Campaign, Tutorial & Codex — Pattern Map

**Mapped:** 2026-08-05
**Files analyzed:** 11 (8 modified, 3 new)
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `data/missions.ts` | config (data catalog) | static data (read at start) | `data/missions.ts` (itself; extra optional fields added Phase 15) | exact |
| `data/validate.ts` | middleware (validation) | validation gate | `data/validate.ts` missions loop 171-186 (Phase 15 RATE-02 additions) | exact |
| `src/sim/types.ts` | model (type defs) | request-response (SaveCommand) | `src/sim/types.ts` SaveCommand union 75-89 | exact |
| `src/sim/campaign.ts` | service (pure derivation) | transform + event-driven (state predicates) | `src/sim/campaign.ts` (itself: `buildCodex`/`TUTORIAL_TEXT`) | exact |
| `src/sim/missionMaps.ts` (NEW) | utility (layout factory) | construction-time transform | `tests/helpers.ts` `foodChainMap()`/`productionChainMap()` (lines 26-77) + `src/sim/map.ts:39-47` | role-match |
| `src/sim/runner.ts` | controller/core | command dispatch + event-driven + derived accessor | `src/sim/runner.ts` internal: `openTradeRoute` 939-963, `tickMissionSystem` 1509-1549, `getCivicStats` 1354-1373, `getGovernance` 1912-1935, `applyCommand` 2814-2847 | exact |
| `tests/unit/campaign.test.ts` | test | transform/assert | `tests/unit/campaign.test.ts` (itself, 32 lines) | exact |
| `tests/missions.test.ts` | test | scripted scenario | `tests/missions.test.ts` (itself) + `tests/runner-accessors.test.ts` objective tests 354-403 | exact |
| `tests/runner-accessors.test.ts` | test | accessor/round-trip | `tests/runner-accessors.test.ts` (itself: accessors 34-41, save/load 156-179) | exact |
| `tests/determinism/campaign-determinism.test.ts` (NEW) | test (determinism) | event-driven (SaveCommand replay) | `tests/determinism/event-response-determinism.test.ts` (whole file) + `finance-determinism.test.ts` chunked identity | exact |
| `tests/winnability-probe.test.ts` (NEW) | test (probe) | batch/scripted scenario | `tests/runner-accessors.test.ts` event-wiring city scripts (298-352) + `tests/helpers.ts` builders | role-match |

---

## Pattern Assignments

### `data/missions.ts` (config, static data)

**Analog:** `data/missions.ts` (self) — `MissionDef` already gained optional `targetFavor?`/`targetTreasury?`/`targetAnnualExports?`/`sustainChecks?`/`timeLimitYears?` additively in Phase 15 (RATE-02) and every existing entry stayed valid. `map/products/routes/modifiers` follow the exact same additive-optional discipline.

**Interface pattern** (current `data/missions.ts:5-29` — add the four new optional fields after `timeLimitYears?`):
```typescript
export interface MissionDef {
  id: string;
  name: string;
  description: string;
  /** Target population to achieve. */
  targetPopulation: number;
  ...
  targetFavor?: number;
  targetTreasury?: number;
  targetAnnualExports?: number;
  /** Months the targets must be held consecutively (default 3). */
  sustainChecks?: number;
  /** Starting treasury (denarii). */
  startingDenarii: number;
  /** Time limit in years, if any. */
  timeLimitYears?: number;
  // Phase 17 NEW (all optional; undefined = existing behavior):
  // map?: MissionMapDef;       // layout via SimMap.fromLayout width/height/layout
  // products?: string[];       // goods-chain emphasis (commodity ids)
  // routes?: { cityId: string; quota?: number; order?: TradeOrderMode }[];
  // modifiers?: MissionModifiers;  // startingTreasuryCredit, timeLimitYears override, knobs
}
```

**Entry form to copy** (current `data/missions.ts` entries, e.g. lines 32-35 — keep existing `id` keys, re-theme `name`/`description` to the spec arc; the RESEARCH anti-pattern forbids renaming ids `tutorial`/`small_town`/`thriving_city`/`grand_city` because tests reference them):
```typescript
  tutorial: {
    id: 'tutorial', name: 'Tutorial: The Well', description: 'Provide water, food, and housing to grow your city.',
    targetPopulation: 100, targetCulture: 10, targetProsperity: 10, targetStability: 10, startingDenarii: 500,
  },
```
**Delta:** add the new optional fields to each of the 10 entries per the arc list in CONTEXT (riverside foundations → provincial capital); retheme `name`/`description` only, never `id`. `startingDenarii` is currently unused in the runner (RESEARCH A5) — `map.modifiers.startingTreasury` is how it becomes real via `startMission`.

---

### `data/validate.ts` (validation gate)

**Analog:** `data/validate.ts` missions loop (lines 171-186) — the exact Phase 15 (RATE-02) precedent for validating newly-added optional mission fields. Same `issues.push({ catalog: 'missions', message })` accumulation style as the trade-city loop (120-139) for cross-catalog id checks.

**Loop pattern to extend** (lines 171-186 — add per-entry validation of `map` bounds, `routes` city ids against `TRADE_CITIES`, `products` against `COMMODITIES`, finite `modifiers`):
```typescript
  for (const m of Object.values(MISSIONS)) {
    if (m.targetPopulation <= 0) {
      issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: missing positive population target` });
    }
    // RATE-02 extension: sustainChecks must be a positive integer when present;
    // the new target fields must be finite non-negative numbers.
    if (m.sustainChecks !== undefined && (!Number.isInteger(m.sustainChecks) || m.sustainChecks <= 0)) {
      issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: sustainChecks must be a positive integer` });
    }
    for (const key of ['targetFavor', 'targetTreasury', 'targetAnnualExports'] as const) {
      const v = m[key];
      if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) {
        issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: ${key} must be a finite non-negative number` });
      }
    }
  }
```
**Cross-catalog id-reference validation pattern for `routes`** — copy from the trade loop (lines 126-130):
```typescript
    for (const good of [...city.buys, ...city.sells]) {
      if (!COMMODITIES[good]) {
        issues.push({ catalog: 'trade', message: `${city.id}: good '${good}' missing from COMMODITIES` });
      }
    }
```
**Delta:** add equivalent id checks for mission `routes[].cityId` against `TRADE_CITIES` and `products[]` against `COMMODITIES`; validate `map.width/height` positive ints and `modifiers` finite. IMPORTANT: this loop only iterates `MISSIONS` — mirror it for `EXTRA_MISSIONS` (the other 6 entries) exactly as research requires every mission validated.

---

### `src/sim/types.ts` (model, request-response)

**Analog:** `src/sim/types.ts` SaveCommand union (lines 75-89) — adding two new union members is purely additive; the exhaustive `else` in `applyCommand` turns a forgotten dispatch into a compile error.

**Union pattern** (lines 75-89; append the two new kinds after `respondEvent`):
```typescript
export type SaveCommand =
  | { kind: 'place'; type: BuildingType; x: number; y: number; god?: string }
  ...
  | { kind: 'openTradeRoute'; cityId: string }
  | { kind: 'setTradeOrder'; cityId: string; good: string; mode: import('./trade').TradeOrderMode; reserve?: number; target?: number }
  | { kind: 'respondEvent'; eventId: string; choiceId: string; tick?: number };
  // Phase 17 NEW:
  | { kind: 'startMission'; id: string }
  | { kind: 'dismissTutorialStep'; step: string };
```
**Delta:** two new members, nothing else. Do NOT touch `SaveData` (lines 92-103) — the mission state must round-trip through command replay, not a schema field (RESEARCH anti-pattern). `BuildingState.house` (lines 120-139) already exposes `level`/`desirability`/cooldowns for tutorial predicates and codex housing entries.

---

### `src/sim/campaign.ts` (service, transform + event-driven predicates)

**Analog:** `src/sim/campaign.ts` (self) — `CodexEntry` is the seed for enrichment; `TUTORIAL_TEXT` is the seed for the step catalog.

**CodexEntry extension** (current lines 13-18; the enumerated `kind` union and additive field block to extend):
```typescript
export interface CodexEntry {
  kind: 'building' | 'commodity' | 'service' | 'god';
  id: string;
  name: string;
  blurb: string;
}
```
**Delta:** widen `kind` with `'chain' | 'housing' | 'desirability' | 'trade' | 'finance' | 'ratings' | 'religion' | 'risks' | 'shortcuts'`; add optional `description | howItWorks | inputs? | outputs? | workers? | cost? | hints? | requirements? | relatedLinks?: string[]`.

**Catalog-iteration pattern to extend** (current lines 21-36 — keep the derive-from-catalogs loop, fill per-entry fields from `BuildingDef`/`CommodityDef`/`WalkerDef`/`GODS`):
```typescript
export function buildCodex(): CodexEntry[] {
  const entries: CodexEntry[] = [];
  for (const b of Object.values(BUILDINGS)) {
    entries.push({ kind: 'building', id: b.id, name: b.name, blurb: b.name });
  }
  for (const c of Object.values(COMMODITIES)) {
    entries.push({ kind: 'commodity', id: c.id, name: c.name, blurb: c.name });
  }
  for (const w of Object.values(WALKERS)) {
    entries.push({ kind: 'service', id: w.id, name: w.name, blurb: w.service });
  }
  for (const g of GODS) {
    entries.push({ kind: 'god', id: g, name: g, blurb: `Cult of ${g}` });
  }
  return entries;
}
```
Catalog fields available for enrichment (verified): `BuildingDef` `cost/workers/produces/consumes/footprint/spawns/serviceRadius/storageCapacity/requiredPopulation/requiredRating` (`data/buildings.ts:24-52`); `CommodityDef` `category/storage/durabilityMonths/baseImportPrice/baseExportPrice/houseGood/tradable` (`data/commodities.ts:8-21`); `WalkerDef` `service/spawnedBy` (`data/walkers.ts:5-12`); `HOUSING_LEVELS` per-level `name/capacity/requires/requiresGoods/desirability` (`data/housing.ts:7-24`); `GODS` (`src/sim/services.ts:34`). Keep `derivedSnapshot().codex` count surface in `runner.ts:150` unchanged.

**Tutorial step catalog — current ordered seed** (lines 38-58; the `TutorialStepId` union and `order` array that `nextTutorialPrompt` uses become the base of the predicate version):
```typescript
export type TutorialStepId =
  | 'roads' | 'housing' | 'water' | 'food' | 'labor' | 'trade' | 'rating' | 'dismissed';

const TUTORIAL_TEXT: Record<TutorialStepId, string> = {
  roads: 'Lay roads to connect buildings — walkers deliver services along them.',
  ...
};

export function nextTutorialPrompt(seen: Set<TutorialStepId>): TutorialStepId | null {
  const order: TutorialStepId[] = [
    'roads', 'housing', 'water', 'food', 'labor', 'trade', 'rating',
  ];
  return order.find((s) => !seen.has(s)) ?? null;
}

export function tutorialText(step: TutorialStepId): string {
  return TUTORIAL_TEXT[step];
}
```
**Delta:** replace fixed `order` with a predicate catalog: `{ stepId, eligible(derived, buildings): boolean, shortText, expandedText, codexRef }`. `eligible` must be a **pure/total function** (guard empty arrays — RESEARCH security: predicates must not throw on `houses.length === 0`). The spec immigration scenario maps onto real observables (RESEARCH Pitfall 4): road-blocked = `houses.some(h => !h.laborConnected && h.workersRequired > 0)`; evolution-stuck = `houses.some(h => h.level < expectedLevel)`; low desirability from `h.desirability` vs a threshold constant. No `Math.random()`/`Date.now()`/`new Date()` in this file (enforced by determinism audit tests).

---

### `src/sim/missionMaps.ts` (NEW — utility, construction-time transform)

**Analog:** `tests/helpers.ts` `foodChainMap()`/`productionChainMap()` (lines 26-77) — the only existing reusable `SimMap.fromLayout` layout builders; and `src/sim/map.ts:39-47` `fromLayout` signature.

**Layout-builder pattern** (from `tests/helpers.ts:26-31` — copy / hoist; must be deterministic, no RNG):
```typescript
export function foodChainMap(): Map {
  return SimMap.fromLayout(12, 12, (x, y) => {
    if ((x === 0 || x === 1) && (y === 1 || y === 2)) return 'fertile';
    return 'earth';
  });
}
```
Plus the deposit-stamp variant for extractor missions (`tests/helpers.ts:64-77`):
```typescript
export function productionChainMap(): Map {
  const map = SimMap.fromLayout(20, 20, (x, y) => {
    if (x >= 0 && x <= 2 && y >= 0 && y <= 2) return 'trees';
    return 'earth';
  });
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      map.mutateTileState(8 + dx, 8 + dy, (s) => { s.resourceType = 'clay_deposit'; });
    }
  }
  return map;
}
```
**Map construction contract:** `SimMap.fromLayout(width, height, layout)` (`src/sim/map.ts:39-47`) — `layout` returns `TileType | undefined`; map is `readonly` after construction (`runner.ts:163`), so the mission map is passed to `new SimRunner(seed, map)` and to `SimRunner.fromSaveData(save, map)` on load (contract documented at `runner.ts:2217-2220`).
**Delta:** one exported builder per mission (`missionMap(id) => { map, preplaced: Placement[] }`) — terrain via `fromLayout`, and per-mission starter buildings (road/house/well) as replayable `place` commands applied inside `startMission` (Pattern: pre-place as `this.saveCommands.push({kind:'place', ...})`).

---

### `src/sim/runner.ts` (controller/core — command dispatch, event-driven, derived accessor)

**Analog (A): SaveCommand issuance — `openTradeRoute`** (`runner.ts:939-963`) — the canonical "state-mutating player action is a replayable SaveCommand + commandLog entry" pattern. `startMission` and `dismissTutorialStep` copy this shape exactly.
```typescript
  openTradeRoute(cityId: string): { ok: boolean; cost: number; error?: string } {
    const city = TRADE_CITIES[cityId];
    if (!city) return { ok: false, cost: 0, error: 'unknown city' };
    ...
    this.commandLog.push({ tick: this.tickCount, command: `openTradeRoute ${cityId}`, result: 'ok' });
    // RATE-02: route openings are replayed as SaveCommands so a save/load
    // round-trip reconstructs the exact trade state (and the annualExports
    // window that derives from it).
    this.saveCommands.push({ kind: 'openTradeRoute', cityId });
    return { ok: true, cost };
  }
```

**Analog (B): `startMission` stub + gating site** (`runner.ts:2102-2108`) — the exact code to replace (hardcoded `year: 0` is the time-limit landmine, RESEARCH Pitfall 1):
```typescript
  startMission(id: string): void {
    this.mission = { id, started: true, complete: false, failed: false, year: 0, objective: id };
    this.missionTracker = null;
  }
  getMission(): MissionState | null {
    return this.mission;
  }
```
**Delta:** (1) set `year: Math.floor(this.tickCount / 360)` — matches the failure check `year - this.mission.year > def.timeLimitYears` (`runner.ts:1519-1523`); (2) gate `id` against the previous mission's completion (progression unlock — derive from replayable wins; RESEARCH Open Question 1); (3) push `{kind:'startMission', id}` to `saveCommands` + a `commandLog` line; (4) apply modifiers (treasury credit via the ledger like `requestRoyalSubsidy`, policies, time-limit override); (5) pre-place mission map buildings as `{kind:'place', ...}` SaveCommands; (6) open mission routes via a loop of `openTradeRoute` / `setTradeOrder`.

**Analog (C): win eval + time limit — `tickMissionSystem`** (`runner.ts:1509-1549`) — extend in place, do not duplicate (RESEARCH no-hand-roll):
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
        population: def.targetPopulation, culture: def.targetCulture,
        prosperity: def.targetProsperity, stability: def.targetStability,
        favor: def.targetFavor, treasury: def.targetTreasury,
        annualExports: def.targetAnnualExports, sustainChecks: def.sustainChecks ?? 3,
      });
    }
    if (this.tickCount % 40 === 0) {
      const d = this.derived ?? this.derivedSnapshot();
      const r = this.missionTracker.update({ population: d.population, culture: d.culture,
        prosperity: d.prosperity, stability: d.stability, favor: d.favor,
        treasury: d.treasury, annualExports: d.annualExports });
      if (r.won) this.mission.complete = true;
    }
  }
```

**Analog (D): derived accessor convention — `getCivicStats`/`getGovernance`** — the exact template for `getTutorial()`/`getCodex()` (pure projection, never serialized).
`getCivicStats` (`runner.ts:1354-1373`):
```typescript
  /** Civic wellness (Phase 12): live per-house health/literacy/entertainment
   *  stats plus the aggregate advisor coverage. Pure projection — additive,
   *  never serialized. */
  getCivicStats(): {
    coverage: { health: number; literacy: number; entertainment: number };
    houses: { id: number; health: number; literacy: number; entertainment: number }[];
  } {
    return {
      coverage: {
        health: this.civicCoverage('health'),
        literacy: this.civicCoverage('literacy'),
        entertainment: this.civicCoverage('entertainment'),
      },
      houses: this.buildings
        .filter((b) => b.house)
        .map((b) => ({ id: b.id, health: b.house!.civic?.health ?? 0, ... })),
    };
  }
```
`getGovernance` (`runner.ts:1912-1935`) shows the same "derive from live state, assemble a read-only object" shape. The `getDerived()` accessor (`runner.ts:1334-1336`) shows the cached-read idiom (`return this.derived ?? this.derivedSnapshot()`). The `tickDerivedSystems()` site (`runner.ts:585-603`) is where `tutorialState` is computed alongside the derived snapshot (RESEARCH Pattern 3).
**Delta:** `getTutorial()` = evaluate each step's `eligible(derived, buildings)` predicate → `{ eligible: TutorialStepView[], seen, dismissed }`; `getCodex()` = cached `buildCodex()` + `lookupEntry(id, kind)`. Tutorial predicates read per-house live state via `BuildingState.house` (`runner.ts:2747-2768`: `level`, `desirability`, `foodCooldown`, `waterCooldown`, `laborCooldown`, `services`) and `DerivedSnapshot` (`runner.ts:133-160`: `employment`, `services`, `godWorship`, `water`, `annualExports`).

**Analog (E): exhaustive dispatch — `applyCommand`** (`runner.ts:2814-2847`) — the two new kinds need branches here; the `else` throws on unknown kinds:
```typescript
  } else if (cmd.kind === 'openTradeRoute') {
    runner.openTradeRoute(cmd.cityId);
  } else if (cmd.kind === 'setTradeOrder') {
    runner.setTradeOrder(cmd.cityId, cmd.good, cmd.mode, { reserve: cmd.reserve, target: cmd.target });
  } else if (cmd.kind === 'respondEvent') {
    runner.respondEvent(cmd.eventId, cmd.choiceId, cmd.tick);
  } else {
    const exhaustive: never = cmd;
    throw new Error(`unknown command kind: ${(exhaustive as { kind: string }).kind}`);
  }
```
**Delta:** add `else if (cmd.kind === 'startMission') runner.startMission(cmd.id);` and `else if (cmd.kind === 'dismissTutorialStep') runner.dismissTutorialStep(cmd.step);` before the `else`.

**Analog (F): save/load with mission map — `getSaveData`/`fromSaveData`** (`runner.ts:2194-2237`) — the round-trip contract: saving is just `commands: [...this.saveCommands]` (the new kinds ride along automatically); loading replays them (`for (const c of save.commands) applyCommand(runner, c)`), so mission state is lossless **only if** `startMission` is a SaveCommand. `fromSaveData(save, map?)` (`2217-2237`) already accepts the mission map param — the game/UI caller (Phase 18/19) must pass it.
```typescript
  getSaveData(): SaveData {
    const data: SaveData = {
      version: 1, seed: this.seed, mapSize: this.mapSize,
      commands: [...this.saveCommands],
      tickCount: this.tickCount,
      savedAt: Date.now(),
    };
    ...
  }
  static fromSaveData(save: SaveData, map?: SimMap): SimRunner {
    const runner = new SimRunner(save.seed, map, save.mapSize);
    runner.replaying = true;
    for (const c of save.commands) applyCommand(runner, c);
    runner.replaying = false;
    while (runner.tickCount < save.tickCount) runner.tick();
    ...
  }
```
The only permitted wall-clock in the whole sim is `savedAt: Date.now()` at line 2201 — everything else derives from `tickCount` + state.

**Delta summary for runner.ts:** startMission rewrite (year fix + gating + SaveCommand + map/modifiers/routes), dismissTutorialStep (track dismissed set; must be replayed, so store as part of the command or a derived `Set` reconstructed from replayed commands), getTutorial()/getCodex() accessors, applyCommand branches, `tickMissionSystem` reads `modifiers.timeLimitYears` override, mission state preserved via command replay (SimState/SaveData untouched).

---

### `tests/missions.test.ts` (test — progression, map application, time-limit fix)

**Analog:** `tests/missions.test.ts` (self) — the RATE-02 sustained-tracker test block is exactly how the new progression tests assert; `tests/runner-accessors.test.ts:354-403` shows the month-cadence win assertions. Scenario style: `new SimRunner(seed, map)` + helper city builders from `tests/helpers.ts`.
```typescript
  it('a mission in the runner reports not-complete (never failed) while a target falls short — time-limit is preserved separately', () => {
    const r = new SimRunner(1234, foodChainMap());
    buildFoodCity(r);
    r.setPolicy(0, 0.5);
    r.startMission('tutorial'); // needs culture 10; a bare food city stays at 5
    for (let i = 0; i < 700; i++) r.tick();
    const m = r.getMission();
    expect(m!.started).toBe(true);
    expect(m!.complete).toBe(false);
    expect(m!.failed).toBe(false);
  });
```
**Deltas to add:** (1) **start-year fix**: tick a runner past 3000 ticks, `startMission('thriving_city')` (timeLimitYears 10), assert `!failed` after a month — currently fails (Pitfall 1); (2) **progression gating**: win mission N (or simulate `mission.complete`), assert N+1 becomes allowed and N+2 is still blocked; (3) **map/moderator application**: assert starting treasury credit and opened routes after startMission; (4) **winnability probe**: legal-reference callers of the year math per `runner.ts:1519`. Keep existing assertions that `targetFavor` etc. are undefined unless set (`tests/missions.test.ts:61-69`) — the new optional fields must stay undefined for entries that don't set them.

---

### `tests/unit/campaign.test.ts` (test — codex fields + tutorial predicates)

**Analog:** `tests/unit/campaign.test.ts` (self, 32 lines) — structure: one `describe` per feature, table-driven `some()` assertions over `buildCodex()`. Extend rather than rewrite.
```typescript
describe('codex (task 10.6)', () => {
  it('builds a codex from real building/commodity/service/god data', () => {
    const codex = buildCodex();
    expect(codex.some((e) => e.kind === 'building' && e.id === 'farm')).toBe(true);
    expect(codex.some((e) => e.kind === 'commodity' && e.id === 'wheat')).toBe(true);
    expect(codex.some((e) => e.kind === 'service')).toBe(true);
    expect(codex.some((e) => e.kind === 'god')).toBe(true);
  });
});

describe('contextual tutorial (task 10.6)', () => {
  it('returns unseen steps in order and marks them done when seen', () => {
    let seen = new Set<string>();
    const first = nextTutorialPrompt(seen as Set<never>);
    expect(first).toBe('roads');
    ...
  });
});
```
**Deltas:** (1) codex: assert every `CodexEntry` carries the required fields (description/howItWorks/etc.), per-category entries exist (chains/housing/desirability/trade/finance/ratings/religion/risks/shortcuts), values match catalog fields (a `farm` entry's `cost` equals `BUILDINGS.farm.cost`), and `lookupEntry(id, kind)` resolves; (2) tutorial: drive scenario runners (reuse `buildFoodCity`/`productionChainMap`) to states where each predicate fires (e.g., isolated house → labor-connected false), assert `eligible` returns true and that the same state without the blocker returns false; (3) dismiss: `dismissTutorialStep` + save/load round-trip keeps it dismissed (replayable preference). Predicates must be pure — assert no crash on an empty city.

---

### `tests/runner-accessors.test.ts` (test — getTutorial/getCodex + mission round-trip)

**Analog:** `tests/runner-accessors.test.ts` (self) — accessor tests (`startMission and getMission track an objective`, lines 34-41) and the save/load round-trip block (lines 156-179):
```typescript
  it('reloading a save mid-run reproduces the exact continued state', () => {
    const seed = 777;
    const step = (r: SimRunner, n: number) => { for (let i = 0; i < n; i++) r.tick(); };
    const a = new SimRunner(seed);
    step(a, 200);
    const save = a.getSaveData();
    const c = SimRunner.fromSaveData(save);
    step(c, 100);
    expect(c.getState().tick).toBe(b.getState().tick);
    expect(c.getStateJson()).toBe(b.getStateJson());
  });
```
**Deltas:** (1) `getTutorial()`/`getCodex()` return shaped values after ticking (mirror `getDerived` test at 182-192); (2) mission save/load round-trip: start a mission, tick past a month gate, save, `fromSaveData`, assert `getMission()` and `getObjectiveProgress()` survive (Pitfall 2); with a mission map, use `SimRunner.fromSaveData(save, missionMap)` (map param, `2217-2237`).

---

### `tests/determinism/campaign-determinism.test.ts` (NEW — SaveCommand replay byte-identity)

**Analog A (primary):** `tests/determinism/event-response-determinism.test.ts` — the precedent for testing a **state-mutating SaveCommand** through run → save → load → byte-identical `getStateJson()`, plus the no-`Math.random`/`Date.now`/`new Date` source audit. `startMission`/`dismissTutorialStep` are the same class of command as `respondEvent`.
```typescript
  it('run → respond → save → load yields a byte-identical getStateJson()', () => {
    const { seed, tick, eventId, choiceId } = findRespondableEvent();
    const extra = 120;
    const r = new SimRunner(seed, productionChainMap());
    buildExportCity(r);
    for (let i = 0; i < tick; i++) r.tick();
    expect(r.respondEvent(eventId, choiceId).ok).toBe(true);
    for (let i = 0; i < extra; i++) r.tick();
    // fromSaveData replays the recorded response at tick 0
    const loaded = SimRunner.fromSaveData(r.getSaveData(), productionChainMap());
    for (let i = 0; i < extra; i++) { r.tick(); loaded.tick(); }
    expect(loaded.getStateJson()).toBe(r.getStateJson());
  });

  it('src/sim/... introduce no Math.random()/Date.now()/new Date() invocations', () => {
    const root = join(__dirname, '..', '..', 'src');
    for (const file of ['ratings.ts', 'objectives.ts', 'events.ts', 'trade.ts', 'missions.ts', 'advisors.ts', 'types.ts']) {
      const src = readFileSync(join(root, 'sim', file), 'utf8');
      expect(/Math\.random\s*\(/.test(src), `${file} uses Math.random`).toBe(false);
      expect(/Date\.now\s*\(/.test(src), `${file} uses Date.now`).toBe(false);
      expect(/new\s+Date\s*\(/.test(src), `${file} uses new Date`).toBe(false);
    }
  });
```
**Analog B:** `tests/determinism/finance-determinism.test.ts` (whole file, 70 lines) — the chunked-run identity harness (`chunkedRunJson` over chunk sizes 1/7/50) that RESEARCH explicitly tells the planner to mirror ("mirror finance-determinism.test.ts style"). Reuse the same header docblock + chunked pattern, swapping the setup for `startMission(id)` + `dismissTutorialStep(step)`.
**Deltas:** (1) byte-identity across a `startMission` + save/load with the mission map; (2) `dismissTutorialStep` prefers to survive save/load and not re-eligibilize a dismissed step; (3) run to month gates so the tracker reconstructed identically; (4) add the source-audit block over `src/sim/campaign.ts` (and confirm `runner.ts`'s only `Date.now` remains the `savedAt` line).

---

### `tests/winnability-probe.test.ts` (NEW — scripted per-mission reachability)

**Analog:** `tests/runner-accessors.test.ts:298-352` (scripted event-wiring cities on `productionChainMap()` + `buildProductionCity(r)` + seed/tick scan loop) and `tests/helpers.ts` `buildFoodCity`/`buildProductionCity` (lines 37-111) — the only existing "build a target city, tick to a horizon, assert a ceiling is reachable in time" harness.
```typescript
    const r = new SimRunner(19, productionChainMap());
    buildProductionCity(r);
    for (let i = 0; i < 680; i++) r.tick();
    const during = r.getDerived();
```
**Delta:** per mission (the 10 in `data/missions.ts` × `EXTRA_MISSIONS`), script its target city (reusing/parameterizing the helper builders or the mission's own `map`/pre-placements), `startMission(id)`, tick to `timeLimitYears * 360`, and assert every `targetPopulation/targetCulture/.../targetAnnualExports` reaches its ceiling at least transiently (sustain hold is the real win, so assert the ceiling first — winnability of the *ceiling*, not the 3-month sustain). This de-risks the LOW/MEDIUM winnability cases (#4 culture 80, #10 85/85/85, annualExports ≤ 100). Keep it a `describe` with one `it` per mission so failures name the mission.

---

## Shared Patterns

### SaveCommand replay determinism (player-action surfaces)
**Source:** `src/sim/types.ts:75-89` + `src/sim/runner.ts:939-963` (`openTradeRoute`) + `src/sim/runner.ts:2814-2847` (`applyCommand`)
**Apply to:** `startMission`, `dismissTutorialStep` (new commands) — every new player action is `{ push commandLog }` + `saveCommands.push({kind, ...})` + an exhaustive `applyCommand` branch; the `else { const exhaustive: never = cmd; }` makes a forgotten kind a compile error. Nothing goes into `SaveData` schema (RESEARCH anti-pattern).

### Pure derived accessors (never serialized)
**Source:** `src/sim/runner.ts:1334-1336` (`getDerived` cached-read), `1354-1373` (`getCivicStats`), `1912-1935` (`getGovernance`)
**Apply to:** `getTutorial()`, `getCodex()` — read-only projections over live state + catalogs; no wall-clock; return shaped objects (or `null`/empty) that Phase 18's UI consumes.

### Deterministic-only sim (no random/wall-clock)
**Source:** `tests/determinism/finance-determinism.test.ts:60-70` + `event-response-determinism.test.ts:204-213` (source audit regex)
**Apply to:** all new sim code (`campaign.ts` predicates, `missionMaps.ts` layouts, `runner.ts` startMission/accessors) — only permitted clock is `savedAt: Date.now()` at `runner.ts:2201`. Tutorial eligibility derives from `tickCount` + state only.

### Catalog-driven data + validation (DATA-01 / DATA-02)
**Source:** `data/validate.ts:171-186` (missions loop) + `data/missions.ts` additive optional fields (Phase 15 precedent)
**Apply to:** new `MissionDef` fields (`map/products/routes/modifiers`) — validate in the missions loop (duplicate for `EXTRA_MISSIONS`), cross-check route city ids against `TRADE_CITIES` (`data/trade.ts`) and products against `COMMODITIES` (`data/commodities.ts`); always undefined = no behavior change.

### Codex derivation from catalogs (never hand-copied)
**Source:** `src/sim/campaign.ts:21-36` + catalog fields (`data/buildings.ts:24-52`, `data/commodities.ts:8-21`, `data/walkers.ts:5-12`, `data/housing.ts:7-24`, `src/sim/services.ts:34`)
**Apply to:** `buildCodex()` enrichment + new categories — every entry field maps to an existing catalog field; if a field has no catalog source, leave it out rather than inventing text (RESEARCH no-hand-roll).

### Month-cadence mission evaluation (RATE-02)
**Source:** `src/sim/runner.ts:1509-1549` (`tickMissionSystem`) + `src/sim/objectives.ts:36-73` (`ObjectiveTracker`)
**Apply to:** mission win/fail — extend `tickMissionSystem` in place (never duplicate); `year = Math.floor(tickCount/360)`; time limit compares against the **start** year (fix the `year: 0` landmine in `startMission`).

### Project gate compliance (check-military)
**Source:** `scripts/check-military.mjs` forbidden tokens (`military/army/legion/soldier/fort/barracks/weapon/enemy/invasion/combat/damageFromUnit`)
**Apply to:** all new text in `data/missions.ts` names/descriptions, `campaign.ts` tutorial/codex copy, tests — the spec arc names are clean; do not introduce military tokens.

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `tests/winnability-probe.test.ts` (NEW) | test (probe) | batch/scripted | No existing test asserts *reachability of target ceilings* — closest are the scripted event/objective city tests (`runner-accessors.test.ts:298-352`, `354-403`) and the `buildFoodCity`/`buildProductionCity` helpers; the probe pattern itself is new (RESEARCH recommends it as a de-risk, Wave 0 gap) |
| `src/sim/missionMaps.ts` (NEW) | utility (layout factory) | construction-time transform | No per-mission layout module exists; the pattern (SimMap.fromLayout + deposit stamping) is lifted verbatim from `tests/helpers.ts:26-77` — a structural move, not a new pattern |
| `src/sim/campaign.ts` cause-detection predicates | service | event-driven (state predicates) | No existing state-observed tutorial exists (current tutorial is a fixed ordered sequence, `campaign.ts:53-58`); predicate shape follows RESEARCH Pattern 3 with live-data fields verified in `runner.ts:2747-2768` + `133-160` |

---

## Metadata

**Analog search scope:** `data/`, `src/sim/`, `tests/`, `tests/unit/`, `tests/determinism/` (full relevant set; runner.ts via targeted non-overlapping reads of its 2864 lines)
**Files scanned:** ~30 (12 opened/read directly: missions.ts ×2, types.ts, campaign.ts, objectives.ts, map.ts, validate.ts, config.ts, balance.ts, services.ts, trade.ts, buildings/commodities/walkers/housing catalogs, runner.ts sections, 5 test files, helpers.ts)
**Pattern extraction date:** 2026-08-05
