# Phase 15: Ratings, Objectives, Events - Pattern Map

**Mapped:** 2026-08-05
**Files analyzed:** 20 (12 source modify + 2 new source-level wiring points covered within runner/types + 6 extend + 2 new test files + 2 new determinism tests)
**Analogs found:** 20 / 20 (every planned change extends an existing seam — no greenfield files)

This is a **wiring phase over existing deterministic primitives**. Every planned file
extends a file that already exists with the role and data flow in question; no external
packages are involved. The closest analog for almost every file is the file itself (its
current placeholder/dead-code state), plus one strong cross-module analog each for the
two genuinely new mechanics: the **weighted-sum decomposition** (RATE-01) borrows the
weighted-sum pattern from `happiness.ts`, and the **annualExports window** (RATE-02)
borrows the year-rollover tally pattern from `trade.ts` `resetAnnualQuotas`.

Global constraint that shapes every excerpt below: **do not touch `getState()` output**
(`runner.ts:1223-1248`). It feeds the economy `computeRatings` path and the golden
fixtures (`tests/golden/golden.test.ts`). All new rating/event state must live under
`DerivedSnapshot`/`getDerived()` and `getEvents()`, and all new costs must flow through
`Treasury.addExpense` as explicit commands.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/sim/ratings.ts` | model/util (pure) | transform | `src/sim/happiness.ts` `houseHappiness` (weighted-sum+clamp); self `computeTargets`/`decomposeRatings` | role-match (weighted-sum) + exact (self seam) |
| `src/sim/objectives.ts` | model (stateful tracker) | stateful update / CRUD-ish | self `ObjectiveTracker` | exact (extend in place) |
| `src/sim/events.ts` | service/util (pure) | request-response (choice→effect) | self `applyEvent`; `data/requests.ts` `entryById` for id lookup | exact |
| `src/sim/trade.ts` | utility (pure) | transform (year window) | self `consumeQuota`/`resetAnnualQuotas`; `applyPriceEvent` | exact |
| `src/sim/runner.ts` | controller/orchestrator | event-driven + request-response | self: `donateToGovernor` (command surface), event block 281-300, `tickDerivedSystems` 428-434, `derivedSnapshot` 836-887, `applyCommand` 2312-2339 | exact |
| `src/sim/types.ts` | config/types | n/a | self `SaveCommand` union 75-86 + `SaveData` 88-100 | exact |
| `src/sim/advisors.ts` | service/view (pure) | transform | self `advisorsFrom` ratings dataset (line 120) | exact |
| `data/events.ts` | config/data | n/a | self `EventDef`/`EVENTS`; `data/requests.ts` `RequestDef` for structured-choice shape | exact |
| `data/missions.ts` | config/data | n/a | self `MissionDef`/`MISSIONS` | exact |
| `data/validate.ts` | config validation | n/a | self events check 125-127 + trade per-good check 91-123 | exact |
| `data/balance.ts` (+ `src/sim/config.ts`) | config/data | n/a | self `BALANCE` + `CONFIG = { ...BALANCE }` | exact |
| `tests/ratings.test.ts` | test | unit | self (update `bare.culture === 10` assertions) | exact |
| `tests/objectives.test.ts` | test (NEW) | unit | `tests/missions.test.ts` (stateful tracker style) + self `objectives.ts` | role-match |
| `tests/events.test.ts` | test | unit/integration | self (catalog-independent `applyEvent` assertions) | exact |
| `tests/missions.test.ts` | test | unit | self | exact |
| `tests/runner-accessors.test.ts` | test | integration | self: save/load 152-175, derived wiring 177-197, event lifecycle 117-125 | exact |
| `tests/data-catalog.test.ts` | test | unit | self: catalog presence 38-41 + `validateCatalogs()` 47-50 + decomposition 75-86 | exact |
| `tests/determinism/export-window-determinism.test.ts` | test (NEW) | determinism | `tests/determinism/trade-determinism.test.ts` (chunked year-rollover) | exact |
| `tests/determinism/event-response-determinism.test.ts` | test (NEW) | determinism | `tests/determinism/finance-determinism.test.ts` + save/load block `tests/determinism/determinism.test.ts:29-42` | exact |

---

## Pattern Assignments

### `src/sim/ratings.ts` (model/util, transform — RATE-01)

**Analog:** `src/sim/happiness.ts:19-30` (weighted sum of normalized factors clamped 0..100) for the *formula shape*; `src/sim/ratings.ts:25-61` and `75-103` for the *seam to replace*.

**Why closest:** `houseHappiness` is the repo's only existing "weighted sum of weighted
factors, normalized, clamped 0..100" computation — exactly the RATE-01 decision that
replaces the additive-caps placeholder. `ratings.ts` already exports
`clampRating`/`RatingDecomposition`/`decomposeRatings(s, constructionSpend)` that the
phase wires in.

**Weighted-sum pattern to copy** (`happiness.ts:19-30`):
```typescript
export function houseHappiness(input: HouseHappinessInput): number {
  const coverage =
    (input.hasFood ? CONFIG.happinessFoodWeight : 0) +
    (input.hasWater ? CONFIG.happinessWaterWeight : 0) +
    (input.hasLabor ? CONFIG.happinessLaborWeight : 0);
  const desirability = (Math.min(200, input.desirability) / 200) * CONFIG.happinessDesirabilityWeight;
  const wage = input.wagesUnpaid ? 0 : CONFIG.happinessWagesWeight;
  const total = coverage + desirability + wage;
  if (total < 0) return 0;
  if (total > 100) return 100;
  return Math.round(total);
}
```

**Existing seam to rewire** (`ratings.ts:59-61` clamp; `75-78` decompose signature that
already takes constructionSpend):
```typescript
export function clampRating(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}
export function decomposeRatings(
  s: CityStats,
  constructionSpend: number,
): RatingDecomposition {
```

**Deltas the new `ratings.ts` must make:**
- Replace `computeTargets` body (`ratings.ts:25-44`, additive caps like `10 + (hasReligion ? 10 : 0)`) with a weighted sum of normalized per-spec factors (education/entertainment/religion/festivals/coverage-penalty for Culture; housing/patricians/operating-balance/unemployment/wages/trade/stability/debt for Prosperity; etc.), each component clamped via `clampRating`'s shape, weights read as `CONFIG.<key>` (see balance section) or module-local consts.
- Keep Prosperity's operating balance excluding one-time construction: `decomposeRatings` already takes `constructionSpend`; fold it only into a `construction` bucket, never into the operating-balance factor (delta from decision; `decomposeRatings` may supersede the placeholder).
- Keep the exported API (`computeTargets`, `tickRatings`, `clampRating`) unchanged — `runner.ts:20`, `advisors.ts:111`, and `tests/ratings.test.ts` import them.

---

### `src/sim/objectives.ts` (model, stateful update — RATE-02)

**Analog:** self (`objectives.ts:8-43`). **Why closest:** this is the designated sustained-period tracker; the phase only extends the metric set and pins cadence.

**Tracker pattern to keep + extend** (`objectives.ts:24-43`):
```typescript
export class ObjectiveTracker {
  private sustained = 0;
  constructor(readonly target: ObjectiveTarget) {}
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
  progress(): number {
    return Math.min(1, this.sustained / this.target.sustainChecks);
  }
}
```

**Deltas:**
- Add `treasury?`, `favor?`, `annualExports?` to `ObjectiveTarget` (`objectives.ts:8-15`) and `treasury`, `favor`, `annualExports` to `MetricSnapshot` (`objectives.ts:17-22`), each `undefined = not required`, appended to the `ok` chain exactly like the existing four (line 35 area).
- `sustainChecks` is expressed in *months* (decision) — the class itself is cadence-agnostic; the month gate lives in `runner.ts` (see runner wiring).
- No new state fields on the class — `sustained` stays the only mutable member so `progress()` remains a pure projection.

---

### `src/sim/events.ts` (service/util, request-response — RATE-03)

**Analog:** self `applyEvent` (`events.ts:38-58`) for effect application shape; `data/requests.ts:85` `entryById` for id-lookup/validation shape.

**Effect-application pattern to copy** (`events.ts:38-58`):
```typescript
export function applyEvent(id: string, ratings: {...}): EventResult {
  const ev = EVENTS[id];
  if (!ev) {
    return { id, name: id, severity: 'mild', message: 'Unknown event' };
  }
  const r = { ...ratings };
  if (ev.effect.culture) r.culture = Math.max(0, r.culture + ev.effect.culture);
  if (ev.effect.prosperity) r.prosperity = Math.max(0, r.prosperity + ev.effect.prosperity);
  if (ev.effect.stability) r.stability = Math.max(0, r.stability + ev.effect.stability);
  if (ev.effect.favor) r.favor = Math.max(0, r.favor + ev.effect.favor);
  return { id: ev.id, name: ev.name, severity: ev.severity, message: ev.message, ... };
}
```

**Id-lookup/validation shape** (`data/requests.ts:85`, verbatim):
```typescript
export function entryById(id: string): RequestDef | undefined {
```
(the exact `EVENTS[eventId]`/`EVENTS[eventId].responses` lookups mirror this one-liner guard.)

**Deltas:**
- Add pure response-resolution helpers (e.g. `exports resolveResponse(eventId, choiceId): EventResponse | undefined`) that index `EVENTS[eventId].responses` by choice id — no mutation, so the runner controls replay.
- Keep `hash`/`pickEvent` untouched (determinism + `events.test.ts` depend on them); catalog expansion changes `totalWeight` (order+sum sensitive) — accepted, but add a pinned schedule test (see pitfalls P4).
- Keep `eventDuration`/`eventSustainMsg`/`eventFinalMsg` signatures (runner event block calls them).

---

### `src/sim/trade.ts` (utility, transform — RATE-02 annualExports window)

**Analog:** self `consumeQuota` (`trade.ts:167-171`) and `resetAnnualQuotas` (`trade.ts:179-189`); `applyPriceEvent` (`trade.ts:259-262`) for price-rise/fall events.

**Year-rollover tally pattern to build the window on** (`trade.ts:179-189`):
```typescript
export function resetAnnualQuotas(routes: Record<string, TradeRouteState>, year: number): number {
  let reset = 0;
  for (const route of Object.values(routes)) {
    if (route.lastYear === year) continue;
    route.usedPerGood = {};
    route.usedQuota = 0;
    route.lastYear = year;
    reset += 1;
  }
  return reset;
}
```

**Per-good load counting** (`trade.ts:167-171`):
```typescript
export function consumeQuota(route: TradeRouteState, good: string, amount: number): void {
  route.usedPerGood = route.usedPerGood ?? {};
  route.usedPerGood[good] = (route.usedPerGood[good] ?? 0) + amount;
  route.usedQuota = (route.usedQuota ?? 0) + amount;
}
```

**Price modifier for event effects** (`trade.ts:259-262`):
```typescript
export function applyPriceEvent(state: TradePriceState, delta: number, at: number): void {
  void at;
  state.modifier = Math.max(0.01, state.modifier + delta);
}
```

**Deltas:**
- Add an optional pure helper (e.g. `sumUsedPerGood(routes, good)` or a ring bucket keyed by `Math.floor(tick/360)`) that both keeps a trailing-360-tick export total across the `resetAnnualQuotas` wipe and never uses wall-clock/time state.
- If price-rise/fall events are added, wire them through `applyPriceEvent` (already unit-tested in `tests/unit/trade-prices.test.ts:76`), not new price math.

---

### `src/sim/types.ts` (config/types — SaveCommand/respondEvent)

**Analog:** self `SaveCommand` union (`types.ts:75-86`) + `SaveData` (`types.ts:88-100`).

**Pattern — new command becomes a union branch** (`types.ts:75-86`, verbatim trailing branch):
```typescript
export type SaveCommand =
  | { kind: 'place'; type: BuildingType; x: number; y: number; god?: string }
  | { kind: 'setPolicy'; taxRate: number; wageRate: number }
  ...
  | { kind: 'deliverGoods'; requestId: string; good: string; qty: number }
  | { kind: 'payRequest'; requestId: string; amount: number };
```

**Deltas:**
- Add `| { kind: 'respondEvent'; eventId: string; choiceId: string }` to the union. Adding this branch forces the exhaustive `applyCommand` dispatch (`runner.ts:2312-2339`) to fail typecheck until a branch is added — that is the intended wiring gate.
- `SaveData` (`types.ts:88-100`) is unchanged: `constructionSpend`/`annualExports`/active-event modifiers are all replay-derivable from `commands` + `tickCount` (Pattern 1), so no schema change.

---

### `src/sim/runner.ts` (controller/orchestrator — event-driven + request-response)

**Analog:** self. Four seams, each with its own copy target.

**DerivedSnapshot decomposition field** — interface `runner.ts:129-148` + computation `runner.ts:836-887`:
```typescript
export interface DerivedSnapshot {
  population: number;
  culture: number;
  prosperity: number;
  stability: number;
  favor: number;
  // ... existing scalar fields ...
}
```
Add `decomposition: RatingDecomposition;` and `constructionSpend: number;` to the interface, then compute them inside `derivedSnapshot()` body — **not** a second recompute (anti-pattern P1). `getDerived()` (`runner.ts:890-892`) already returns `this.derived ?? this.derivedSnapshot()` so the new fields surface automatically.

**Month-cadence objective update** — current every-tick wiring `runner.ts:428-434`:
```typescript
private tickDerivedSystems(): void {
  const snapshot = this.derivedSnapshot();
  this.derived = snapshot;
  if (this.objective) {
    this.objective.update({ population: snapshot.population, culture: snapshot.culture, prosperity: snapshot.prosperity, stability: snapshot.stability });
  }
}
```
Deltas: wrap the `update` in `if (this.tickCount % 40 === 0 && this.objective)` (mirror existing month gates at lines 304/319/325), pass `treasury/favor/annualExports` from the snapshot, and **make `getObjectiveProgress()` (`runner.ts:1043-1048`) a pure read** — it currently calls `this.objective.update(...)` again, which double-counts (pitfalls P2/P3). Store the last monthly `{won, sustained}` instead.

**Event lifecycle block to preserve + extend** — `runner.ts:281-300`:
```typescript
if (this.activeEvent) {
  this.activeEvent.remaining -= 1;
  const ev = this.activeEvent;
  if (ev.remaining <= 0) {
    this.logEvent('event', eventFinalMsg(ev.id), EVENTS[ev.id]?.severity ?? 'mild');
    this.activeEvent = null;
  } else if (ev.remaining === Math.floor(ev.total / 2)) {
    const sustain = eventSustainMsg(ev.id);
    if (sustain) this.logEvent('event', sustain, EVENTS[ev.id]?.severity ?? 'mild');
  }
}
if (!this.activeEvent && this.tickCount % 40 === 0) {
  const ev = pickEvent(this.seed, this.tickCount);
  if (ev) {
    const result = applyEvent(ev, { culture: 10, prosperity: this.getState().ratings.prosperity, stability: 10, favor: 10 });
    this.logEvent('event', `${result.name}: ${result.message}`, result.severity);
    this.activeEvent = { id: ev, remaining: eventDuration(ev), total: eventDuration(ev) };
  }
}
```
Deltas: replace the hardcoded `{ culture: 10, ... }` input with live `DerivedSnapshot` ratings; apply the delta as a live modifier (stored on an active-event state field, removed at conclusion) instead of discarding; record responses.

**New command surface — `respondEvent`** — copy the full `donateToGovernor` lifecycle (`runner.ts:1407-1428`):
```typescript
donateToGovernor(amount: number): { ok: boolean; granted?: number; error?: string } {
  if (this.paused) { this.enqueue({ kind: 'donateToGovernor', amount }); return { ok: true }; }
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'unknown-amount' };
  if (!this.hasPlacedGov('senate')) return { ok: false, error: 'senate-required' };
  if (this.governor.donationsThisYear >= CONFIG.governorDonationCap) return { ok: false, error: 'cap-reached' };
  const result = donate(this.governor, Math.floor(amount), { treasury: this.treasuryAccount.balance, favor: 0, yearlyCap: CONFIG.governorDonationCap });
  if (!result.ok) return { ok: false, error: 'not-enough-money' };
  const granted = this.treasuryAccount.balance - result.treasury;
  this.treasuryAccount.addExpense('governor', granted);
  this.governorFavorBonus = Math.min(100, this.governorFavorBonus + result.favor);
  this.derived = null;
  this.commandLog.push({ tick: this.tickCount, command: `donateToGovernor ${amount}`, result: 'ok' });
  this.saveCommands.push({ kind: 'donateToGovernor', amount });
  return { ok: true, granted };
}
```
Deltas: `respondEvent(eventId, choiceId)` — reject unknown `eventId` (must equal `activeEvent.id`) and unknown `choiceId` (must exist in `EVENTS[eventId].responses`) with a no-op + commandLog entry, before any effect application (input-validation surface, ASVS V5); on accept push `{ kind: 'respondEvent', eventId, choiceId }`.

**SaveCommand replay dispatch** — `applyCommand` (`runner.ts:2312-2339`):
```typescript
} else if (cmd.kind === 'donateToGovernor') {
  runner.donateToGovernor(cmd.amount);
} else if (cmd.kind === 'deliverGoods') {
  runner.deliverGoods(cmd.requestId, cmd.good, cmd.qty);
} ...
} else {
  const exhaustive: never = cmd;
  throw new Error(`unknown command kind: ${(exhaustive as { kind: string }).kind}`);
}
```
Deltas: add `} else if (cmd.kind === 'respondEvent') { runner.respondEvent(cmd.eventId, cmd.choiceId); }`. This is where typecheck forces the branch after the union edit in `types.ts`.

**constructionSpend accumulator** — next to every build cost capture. `placeBuilding` (`runner.ts:1106`) and `openTradeRoute` (`runner.ts:771`):
```typescript
this.treasuryAccount.addExpense('other', def.cost);   // line 1106 (placeBuilding)
this.treasuryAccount.addExpense('other', cost);       // line 771  (openTradeRoute)
```
Add after each: `this.constructionSpend += <cost>;` (lifetime accumulator, replay-derivable from commands — Pattern 1).

**Hardening rules to copy from surrounding code:**
- All treasury writes go through `Treasury.addExpense/addRevenue` (`finance.ts:29-43`) — never raw `balance -=` (don't hand-roll).
- New state fields must not reach `getState()` (goldens); keep them in `derivedSnapshot`/`getDerived`/`getEvents`.
- `getSaveData()` (`runner.ts:1701-1715`) / `fromSaveData` replay (`runner.ts:1724-1740`) need no changes if all new state is replay-derived.
- Event log growth uses `logEvent` (`runner.ts:2242-2247`) — keep existing `getEvents()` surface intact.

---

### `src/sim/advisors.ts` (service/view, transform — surface decomposition)

**Analog:** self `advisorsFrom` ratings dataset (`advisors.ts:110-126`).

**Pattern to extend** (`advisors.ts:116-125`, verbatim):
```typescript
return [
  { name: 'population', data: { population: s.population } },
  ...
  { name: 'ratings', data: { culture: targets.culture, prosperity: targets.prosperity, stability: targets.stability, favor: targets.favor } },
  ...
];
```

**Deltas:** add a `decomposition` dataset (consuming `getDerived().decomposition` — or extend the `ratings` dataset) plus an objective/event status view; keep it a pure transform of the snapshot, never a recompute.

---

### `data/events.ts` (config/data — catalog expansion + responses)

**Analog:** self `EventDef`/`EVENTS` (`data/events.ts:7-76`); choice-list shape borrows `data/requests.ts` `RequestDef` (id/title/type/amount/weight flat-data discipline).

**Catalog entry shape to extend** (`data/events.ts:7-25`, verbatim):
```typescript
export interface EventDef {
  id: string;
  name: string;
  severity: EventSeverity;
  weight: number;
  effect: { culture?: number; prosperity?: number; stability?: number; favor?: number };
  damages?: string[];
  message: string;
  durationTicks?: number;
  sustainMsg?: string;
  finalMsg?: string;
}
```

**Deltas:**
- Add a `responses?: EventResponse[]` field — each `{ id: string; label: string; effect: EventEffect }` (spend-denarii via `treasuryCost`/`effect`, or accept a ratings penalty). Keep the existing 8 events byte-identical (tests depend on their schedule behavior).
- Expand `EVENTS` to the ~25 spec event types. Names must pass `scripts/check-military.mjs` — avoid `FORBIDDEN_TOKENS` (`military, army, legion, soldier, fort, barracks, weapon, enemy, invasion, combat, damageFromUnit`) — DATA-03.
- Default event effects stay ratings/price-modifier (derived-only per Pitfall 8); denarii costs belong on user-chosen `responses` only, so goldens are untouched.

---

### `data/missions.ts` (config/data — new objective fields)

**Analog:** self `MissionDef`/`MISSIONS` (`data/missions.ts:5-40`).

**Definition to extend** (`data/missions.ts:5-21`):
```typescript
export interface MissionDef {
  id: string;
  name: string;
  description: string;
  targetPopulation: number;
  targetCulture: number;
  targetProsperity: number;
  targetStability: number;
  startingDenarii: number;
  timeLimitYears?: number;
}
```

**Deltas:** add `targetFavor?`, `targetTreasury?`, `targetAnnualExports?`, `sustainChecks?` (default 3 months) to `MissionDef`; keep every existing entry's fields valid so `MISSIONS`/`EXTRA_MISSIONS` stay compatible. Wire the runner's `setObjective` (unified on `ObjectiveTracker`) from these fields.

---

### `data/validate.ts` (config validation — responses + new fields)

**Analog:** self events check (`data/validate.ts:125-127`) + trade per-good validation block (`data/validate.ts:91-123`) as the "validate a sub-structure per entry" model.

**Event check to extend** (`data/validate.ts:125-127`, verbatim):
```typescript
for (const ev of Object.values(EVENTS)) {
  if (!ev.message) issues.push({ catalog: 'events', message: `${(ev as { id: string }).id}: missing message` });
}
```

**Mission check to extend** (`data/validate.ts:129-133`, verbatim):
```typescript
for (const m of Object.values(MISSIONS)) {
  if (m.targetPopulation <= 0) {
    issues.push({ catalog: 'missions', message: `${(m as { id: string }).id}: missing positive population target` });
  }
}
```

**Deltas:** under the events loop add: response ids unique per event, non-empty labels, well-typed effects (finite numbers, references resolve); under the missions loop add: `sustainChecks` must be a positive integer when present; `targetAnnualExports` non-negative. `validateCatalogs()` runs once at construction (`runner.ts:208-211`) and `tests/data-catalog.test.ts:47-50` asserts it returns `[]` — new checks must not break a clean catalog.

---

### `data/balance.ts` (+ `src/sim/config.ts`) (config/data — RATE-01 weights)

**Analog:** self. `BALANCE` (`data/balance.ts:7-126`) + `CONFIG = { ...BALANCE }` (`config.ts:12`).

**Constraint that governs this file** (`tests/balance-parity.test.ts:36-51`):
- Every existing key keeps both directions of parity: `CONFIG` key-set == `BALANCE` key-set, and **every BALANCE key must be consumed as `CONFIG.<key>` somewhere in `src/` outside `config.ts`** (line 44-51).
- Alternative for purely-internal tuning: keep as module-local consts in `src/sim/ratings.ts`/`events.ts` and **never** add to `BALANCE` (dodges the parity test but diverges from the DATA-02 convention — RESEARCH A2 flags both are acceptable).

**Deltas:** IF rating weights/prosperity thresholds are externalized, add to `BALANCE` AND read as `CONFIG.<key>` in `src/sim/ratings.ts` (or the single consumer location) so the parity test passes.

---

### Tests

#### `tests/ratings.test.ts` (extend — RATE-01)
**Analog:** self. The `bare.culture === 10` / `bare.prosperity < 20` assertions (`ratings.test.ts:8-9`) encode the additive-caps formula being replaced. Keep or intentionally update them; add coverage for weighted decomposition: `RatingDecomposition` buckets, `clampRating` bounds, `decomposeRatings(s, constructionSpend)` separating construction from the operating-balance factor.

#### `tests/objectives.test.ts` (NEW — RATE-02)
**Analog (role-match):** `tests/missions.test.ts:11-21` (stateful tracker progression):
```typescript
it('tickMission completes when targets are met', () => {
  const m = startMission('tutorial'); // targetPopulation 100
  tickMission(m, { population: 120, culture: 20, prosperity: 20, stability: 20, year: 0 });
  expect(m.complete).toBe(true);
});

it('tickMission fails when time runs out', () => {
  const m = startMission('thriving_city'); // timeLimitYears 10
  tickMission(m, { population: 100, culture: 10, prosperity: 10, stability: 10, year: 11 });
  expect(m.failed).toBe(true);
});
```
Build directly on `ObjectiveTracker` (`objectives.ts`): 2 consecutive `update()` passes with `sustainChecks: 2` → `won`, then a miss resets `sustained` to 0; `treasury`/`favor`/`annualExports` thresholds (undefined = not required); default `sustainChecks: 3`. Import style mirrors other unit tests: `import { describe, it, expect } from 'vitest';` + module imports.

#### `tests/events.test.ts` (extend — RATE-03)
**Analog:** self. The existing `applyEvent` assertions (`events.test.ts:17-25`) are catalog-independent and stay valid (`earthquake` lowers prosperity, `good_harvest` raises it). Add: response resolution (valid/invalid choice id), early conclusion, treasury-cost response. Keep the determinism assertions (`hash`, `pickEvent`) intact — schedule pin for one seed+tick can be added here (Pitfall 4 forward-compat guard).

#### `tests/missions.test.ts` (extend — RATE-02)
**Analog:** self. Add sustain-period and new-field coverage mirroring the existing `startMission`/`tickMission` pattern (`missions.test.ts:5-21`); keep the time-limit/failure semantics.

#### `tests/runner-accessors.test.ts` (extend — integration)
**Analog:** self. Three blocks to mirror:
- Event lifecycle `runner-accessors.test.ts:118-124` (`new SimRunner(12345); tick 200; runner.getEvents()`).
- Save/load round-trip `runner-accessors.test.ts:153-174` (`getSaveData()` → `SimRunner.fromSaveData(save)` → `getStateJson()` equality after continuing).
- Derived wiring `runner-accessors.test.ts:178-197` (`getDerived()` fields + `setObjective({ sustainChecks: 1 })`).
Add: `getDerived().decomposition` and `constructionSpend` surface; `respondEvent` integration (valid response mutates outcome, invalid is a no-op).

#### `tests/data-catalog.test.ts` (extend — catalog integrity)
**Analog:** self (`data-catalog.test.ts:38-41` presence, `47-50` `validateCatalogs() === []`, `75-86` decomposition import that must be kept in sync if `decomposeRatings` signature changes). Add: ~25 event keys, each with valid `responses` (unique ids, non-empty labels), and mission new-field validation.

#### `tests/determinism/export-window-determinism.test.ts` (NEW)
**Analog (exact):** `tests/determinism/trade-determinism.test.ts:19-45` — the `chunkedRunJson(seed, chunk, total)` helper pattern asserting byte-identical `getStateJson()` for chunks 1/7/50 across the tick-360 year boundary (seeds `[1, 7, 1337]`). Copy that file's shape; run a production city with a pottery export order (`buildProductionCity` + `openTradeRoute` + `setTradeOrder('...','pottery','export_above_reserve')`, per `trade-determinism.test.ts:23-25`), cross the year boundary, and if `annualExports` lives in `getDerived()` expose it via a small accessor and assert the window resets/measures identically under chunking and save/load.

#### `tests/determinism/event-response-determinism.test.ts` (NEW)
**Analog (exact):** `tests/determinism/finance-determinism.test.ts:20-58` (command + chunked determinism with source audit at 60-69), merged with the save/load replay block `tests/determinism/determinism.test.ts:29-42`:
```typescript
const original = runner.getStateJson();
const loaded = SimRunner.fromSaveData(runner.getSaveData());
expect(loaded.getStateJson()).toBe(original);
```
Drive an active event to a known state, call `respondEvent`, then run→save→load→compare; also assert `constructionSpend`/`annualExports` replay byte-identical. The file must also carry a `no Math.random / Date.now / new Date` source audit for any new src file paths (mirror lines 60-69).

---

## Shared Patterns

### Command surface (SaveCommand + applyCommand + push-on-accept)
**Source:** `src/sim/types.ts:75-86` (union), `src/sim/runner.ts:2312-2339` (`applyCommand`), `src/sim/runner.ts:1407-1428` (`donateToGovernor` full lifecycle).
**Apply to:** `respondEvent` new command.
The three-touch rule: (1) union branch in `types.ts`, (2) exhaustive branch in `applyCommand` (typecheck fails without it), (3) the public method pushes the same command shape it accepts onto `saveCommands` and logs to `commandLog`. Validation-reject with no state change before any mutation.

### Replay-derivable accumulator
**Source:** `src/sim/runner.ts:1724-1740` (`fromSaveData` rebuilds only from `commands` + ticks).
**Apply to:** `constructionSpend`, `annualExports`, active-event modifiers, response records.
Any field accumulated deterministically from commands + `tickCount` reconstructs exactly — so **no `SaveData` schema change**. New determinism tests assert save→load `getStateJson()` equality.

### Live-effect hygiene (do not touch `getState()`)
**Source:** `src/sim/runner.ts:1223-1248` (`getState` → economy `computeRatings`) + `tests/golden/golden.test.ts:17-37`.
**Apply to:** all RATE-01/03 effects. Ratings/event effects live in `DerivedSnapshot`/`getDerived()`; denarii costs only via explicit response commands via `Treasury.addExpense` (`finance.ts:37-43`, `FinCategory` union at `finance.ts:8`) — never raw `balance -=`.

### Month cadence (`tickCount % 40 === 0`, year = `Math.floor(tickCount / 360)`)
**Source:** `runner.ts:304`, `:319`, `:325` (month gates), `runner.ts:437` (`year`), `runner.ts:439` (`resetAnnualQuotas`).
**Apply to:** objective sustain updates, event picking/responses, annual-exports window reset. This is the deterministic clock; no wall-clock anywhere.

### Catalog validation + balance parity
**Sources:** `data/validate.ts:125-133` (per-entry checks), `tests/data-catalog.test.ts:47-50` (`validateCatalogs() === []`), `tests/balance-parity.test.ts:36-51` (key-set + CONSUMER parity).
**Apply to:** expanded `data/events.ts`, new mission fields, any externalized `data/balance.ts` keys. New `BALANCE` keys MUST have a `CONFIG.<key>` consumer in `src/` or CI fails; module-local consts dodge this but diverge from convention.

### Test style (Vitest)
**Source:** any of `tests/ratings.test.ts`, `tests/events.test.ts`, `tests/determinism/*-determinism.test.ts`.
**Apply to:** all test files. `import { describe, it, expect } from 'vitest';`; scenario setup via `tests/helpers.ts` (`runScenario`, `buildFoodCity`/`buildProductionCity` + `*ChainMap`); determinism suites copy the `chunkedRunJson(seed, chunk, total)` + source-audit pattern. Commands may reference `npm run check:military` and `npm run typecheck` gates.

---

## No Analog Found

All 20 files have an analog; the two NEW files adopt role-match analogs from existing files, and the genuinely new mechanics (weighted-sum formula, year window, response validation) map to the designated in-repo primitives (`happiness.ts`, `trade.ts` consumeQuota/resetAnnualQuotas, `data/requests.ts` entryById). No external-package research patterns are needed.

| File | Role | Data Flow | Reason (why analog is sufficient) |
|------|------|-----------|-----------------------------------|
| (none) | — | — | All planned files extend existing seams; `decomposeRatings`/`ObjectiveTracker`/`applyEvent` scaffolding already exists as dead-or-placement code to rewire in place |

---

## Metadata

**Analog search scope:**
- `src/sim/` — read `ratings.ts`, `objectives.ts`, `events.ts`, `types.ts`, `trade.ts`, `finance.ts`, `happiness.ts`, `missions.ts`, `advisors.ts` (ratings dataset), `config.ts`, plus targeted non-overlapping sections of `runner.ts` (129-148, 207-214, 278-352, 428-444, 630-704, 755-790, 836-895, 1036-1139, 1223-1267, 1405-1434, 1655-1745, 2236-2355).
- `data/` — read `events.ts`, `missions.ts`, `validate.ts`, `balance.ts`, `requests.ts` (entryById).
- `tests/` — read `ratings.test.ts`, `events.test.ts`, `missions.test.ts`, `runner-accessors.test.ts`, `data-catalog.test.ts`, `balance-parity.test.ts`, `helpers.ts`, `determinism/trade-determinism.test.ts`, `determinism/finance-determinism.test.ts`, `determinism/determinism.test.ts`, `golden/golden.test.ts`.

**Files scanned:** 20 target files + 18 support files read/glanced (grep-verified positions in runner.ts before targeted reads; no ranges re-read).

**Pattern extraction date:** 2026-08-05

**Key deltas summarized per cover-request:**
- **Ratings decomposition wiring:** `DerivedSnapshot` (runner.ts:129-148) + `derivedSnapshot()` (836-887) add `decomposition`/`constructionSpend`; `ratings.ts` swaps additive caps for weighted-sum pattern copied from `happiness.ts:19-30`; accumulator next to `addExpense('other', ...)` at runner.ts:1106/771.
- **Objective tracker extension:** `objectives.ts:8-43` adds `treasury/favor/annualExports` predicates; runner gates `update` on `tickCount % 40 === 0` and makes `getObjectiveProgress` a pure read.
- **Event responses/catalog:** `data/events.ts` `EventDef.responses[]` + ~25 events; `events.ts` pure response resolvers; catalog validation in `data/validate.ts`.
- **Runner wiring:** live effects in event block (281-300), `respondEvent` command lifecycle copying `donateToGovernor` (1407-1428).
- **SaveCommand/applyCommand additions:** `types.ts:75-86` union branch + `runner.ts:2312-2339` exhaustive dispatch branch + push-on-accept.
- **data/events catalog expansion:** event/response shape + DATA-03 military-absence gate + balance-parity/validation gates.
- **Tests:** 6 extended (self-analogs), 2 new unit-style (missions.test.ts analog), 2 new determinism (trade/finance-determinism analogs).
