---
phase: 17-campaign-tutorial-codex
reviewed: 2026-08-05T22:15:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/sim/runner.ts
  - src/sim/campaign.ts
  - src/sim/missionMaps.ts
  - src/sim/types.ts
  - src/sim/missions.ts
  - src/sim/ratings.ts
  - data/missions.ts
  - data/validate.ts
  - tests/determinism/campaign-determinism.test.ts
  - tests/winnability-probe.test.ts
  - tests/missions.test.ts
  - tests/runner-accessors.test.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: fixed
fixes:
  cr: [CR-01, CR-02]
  warning: [WR-01, WR-02, WR-03, WR-04]
  info: [IN-01, IN-02]
fixed_at: 2026-08-05T22:50:00Z
---

# Phase 17: Code Review Report — Campaign, Tutorial & Codex

**Reviewed:** 2026-08-05T22:15:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** all_fixed

## Summary

The phase delivers a replayable `startMission` SaveCommand (start-year fix, sequential gate, per-mission sub-effects under `suppressCommandRecording`), a 10-mission campaign, a state-observed 9-step tutorial, and a catalog-derived 13-kind codex. The nominal tests (89 passed across the six Phase-17 suites) are green, and the source-audit confirms no `Math.random`/`Date.now`/`new Date` were introduced in the new sim paths (the single `savedAt` `Date.now` is the documented exception).

However, adversarial probing exposes a **data-loss bug in the replay path (CR-01/CR-02)** that the green determinism tests do not catch because they only start missions at tick 0 on fresh runners. Concretely: (a) a time-limited mission started mid-run **fails instantly after `save → load`** because `mission.year` is recomputed as `0` during replay instead of preserved; (b) a mission is **silently dropped entirely after `save → load → save → load`** because the `startMission` record is not re-embedded during replay. Both directly violate the dispatch focus on "no mission state lost" byte-identity. Fixes are small and localized.

Codex `codexRef`/`relatedLinks` contain dangling references, a legacy `year: 0`-hardcoded fallback still ships in `src/sim/missions.ts`, paused-path gate bypass, and a couple of minor data/robustness smells. No golden churn and no wall-clock/RNG issues were found.

## Critical Issues

### CR-01: `mission.year` is lost on save/load — the start-year landmine resurfaces via the replay path

**File:** `src/sim/runner.ts:2271` (startMission), `:2506-2513` (fromSaveData), `:1649-1654` (tickMissionSystem)

**Issue:** `startMission` records `year: Math.floor(this.tickCount / 360)` at *live* start time, but the `{kind:'startMission', id}` SaveCommand does not carry that year. `fromSaveData` replays all commands **at tick 0** and only then ticks up to `save.tickCount`. So on replay, `startMission` recomputes `mission.year = Math.floor(0 / 360) = 0` regardless of the true start year. For a 10-year mission started on a year-13 runner, the loaded runner's `tickMissionSystem` evaluates `year − mission.year > timeLimitYears` → `13 − 0 > 10` → **`failed = true` at the next month gate**, i.e. the exact "time-limit landmine" this phase set out to fix, reintroduced through save/load. It also breaks `getMission()` byte-identity (year diverges after every round trip).

Probe (verified with the actual sim): live runner `startMission('thriving_city')` after 4800 ticks → `mission.year = 13`, `failed = false` at the next gate; after `fromSaveData` + 40 ticks → `mission.year = 0`, `failed = true`. The existing determinism test (campaign-determinism:58-75) only starts missions on fresh runners at tick 0, so `year == 0` on both sides and the divergence is masked.

**Fix:** Persist the start year in the command and restore it on replay, e.g. widen the command to `{ kind: 'startMission'; id: string; year: number }`, record `year: Math.floor(this.tickCount/360)` at push time, and in `startMission` accept/apply the recorded `year` (or have `applyCommand` pass it):

```ts
// types.ts
| { kind: 'startMission'; id: string; year: number }

// runner.ts startMission(id, startingYear?):
const year = startingYear ?? Math.floor(this.tickCount / 360);
this.mission = { id, started: true, complete: false, failed: false, year, objective: id };
...
this.saveCommands.push({ kind: 'startMission', id, year });

// applyCommand:
} else if (cmd.kind === 'startMission') {
  runner.startMission(cmd.id, cmd.year);
}
```

**Status:** ✅ fixed — `startMission` now records `year` on the `{kind:'startMission', id, year}` SaveCommand and restore it on replay (`startMission(id, startingYear?)`); a mid-run determinism test asserting year/not-failed/byte-identity across save→load was added. Commit `c5ebbf5`.

### CR-02: `save → load → save → load` silently drops the mission (and tutorial dismissals)

**File:** `src/sim/runner.ts:2278` (`if (!this.replaying) this.saveCommands.push({kind:'startMission'})`), `:2379` (same guard for `dismissTutorialStep`)

**Issue:** The `startMission`/`dismissTutorialStep` `saveCommands.push` is guarded by `!this.replaying`, while every other SaveCommand (place/openTradeRoute/setTradeOrder) pushes unconditionally (guarded only by `suppressCommandRecording`). During `fromSaveData`, `replaying = true`, so the replayed `startMission` command **does not re-embed itself** in the loaded runner's `saveCommands`. When that loaded runner is then saved (`getSaveData`) and the new save is loaded again, there is **no mission at all** (`getMission() === null`) — campaign progress is silently lost through a completely ordinary flow (load, continue, save).

Probe (verified): a `sim` that starts `small_town`, ticks, saves → `save1.commands` contains `startMission`; load → `save2.commands` has **no** `startMission` (only the 35 `place` records); loading `save2` → `getMission() === null`. The campaign-determinism test at :113-132 asserts `save2.commands.length <= save1.commands.length` and absence of sub-effect records — but that asserts **shrink is fine**, masking the dropped mission record; it never re-loads `save2` and checks the mission. Same bug affects `dismissTutorialStep` (dismissal lost on the second round trip).

**Fix:** Mirror `placeBuilding`/`openTradeRoute`: push the record unconditionally (the sub-effects are already suppressed by `suppressCommandRecording`, which is set on both live and replay paths), so a replay re-embeds the command exactly once and `save2` reproduces `save1`:

```ts
// remove the `!this.replaying` guards at :2278 and :2379:
this.saveCommands.push({ kind: 'startMission', id, year });          // year per CR-01
this.saveCommands.push({ kind: 'dismissTutorialStep', step });
```

Then extend `campaign-determinism.test.ts` with a **double round trip**: `start → tick → save → load → tick → save → load` and assert `getMission()`/`getTutorial().dismissed` survive, and `save2.commands` still contains the `startMission` record.

**Status:** ✅ fixed — the `!this.replaying` guards were removed so `startMission`/`dismissTutorialStep` follow the standard push-on-accept pattern (sub-effects stay suppressed on both paths); save→load→save→load round-trip tests (mission + dismissal) were added. Commit `f4b1afe`.

## Warnings

### WR-01: Paused-path `startMission` bypasses the sequential unlock gate

**File:** `src/sim/runner.ts:2256-2262` (paused enqueue before gate), `:277-283` (`drainPendingCommands` sets `replaying = true`)

**Issue:** When paused, `startMission` enqueues `{kind:'startMission', id}` and returns `{ok:true}` **before** the `missionUnlocked` check. When the queue is drained, `drainPendingCommands` sets `this.replaying = true`, so the open gate (`if (!this.replaying)`) is skipped entirely. Result: a player can pause the sim and start a locked mission (`thriving_city` while `tutorial` is in-progress), and it starts on the next drain — the sequential-progression invariant ("mission N+1 unlocks only when N is won") is bypassable. Verified by probe: paused `startMission('thriving_city')` with an in-progress `tutorial` → after unpause + tick, `getMission().id === 'thriving_city'`.

Also, the paused path never validates the id against the mission catalogs (unknown ids enqueue and return `{ok:true}`, then silently no-op at drain).

**Fix:** Validate against `missionUnlocked(id)` and `MISSIONS[id] ?? EXTRA_MISSIONS[id]` *before* enqueueing (precedent: the Phase-15 `respondEvent` paused-path fix), and only enqueue when both pass:

```ts
startMission(id: string) {
  if (this.paused) {
    const unlock = this.missionUnlocked(id);
    if (!unlock.ok) return unlock;
    if (!(MISSIONS[id] ?? EXTRA_MISSIONS[id])) return { ok: false, error: 'unknown-mission' };
    this.enqueue({ kind: 'startMission', id });
    return { ok: true };
  }
  ...
}
```

**Status:** ✅ fixed — the paused path now validates `missionUnlocked(id)` and the mission id against `MISSIONS[id] ?? EXTRA_MISSIONS[id]` before enqueuing (precedent: the Phase-15 `respondEvent` pause fix); locked/unknown starts are rejected with no queue entry and no gate bypass; paused-path tests added. Commit `1dfe2d9` (also carries the CR-01 `year` on the enqueued command).

### WR-02: Codex cross-links are dangling — `codexRef`/`relatedLinks` point at non-existent entries

**File:** `src/sim/campaign.ts:404-415` (`TUTORIAL_CODEX_REF`), `:202` (`ratings-prosperity`), `:222` (`temples`)

**Issue:** Tutorial `codexRef`s reference codex ids that do not exist: `labor: 'labor'` and `rating: 'ratings'` (ratings entries are `rats-*`; there is no `labor` or `ratings` entry). The codex `relatedLinks` also reference missing ids: `finance → 'ratings-prosperity'` (actual id is `rats-prosperity`) and `festivals → 'temples'` (no `temples` entry; entries are `temple`/`grand_temple`). Verified by probe over `buildCodex()`: `labor → labor MISSING`, `rating → ratings MISSING`, `finance → ratings-prosperity MISSING`, `festivals → temples MISSING`. Phase-18 UI `lookupEntry()` calls for these will return `undefined`, silently breaking the promised cross-reference surface.

**Fix:** Point refs at real entries, e.g. `rating: 'rats-prosperity'` (or add a synthetic `ratings`/`labor` overview entry), and correct `relatedLinks` to `rats-prosperity` and `temple`/`grand_temple`. Add a load/link-integrity assertion in `campaign.test.ts` that every `TUTORIAL_CODEX_REF` and `relatedLinks` id resolves via `lookupEntry`.

**Status:** ✅ fixed — `rating` → `rats-prosperity`; a synthetic `labor` overview entry was added so the tutorial `labor` ref resolves; `finance.relatedLinks` → `rats-prosperity`; `festivals.relatedLinks` → `temple`/`grand_temple`; a link-integrity test in `campaign.test.ts` asserts every `codexRef` and `relatedLinks` resolves. Commit `ebe7136`.

### WR-03: Legacy `src/sim/missions.ts` still ships `year: 0` mission logic + a duplicate `missionName`

**File:** `src/sim/missions.ts:24-34` (`startMission`), `:40-59` (`tickMission`), `:61-63` (`missionName`)

**Issue:** The runner's new `startMission`/`tickMissionSystem` supersede `src/sim/missions.ts`, whose exported `startMission` still hardcodes `year: 0` (the exact landmine this phase removed) and indexes only `MISSIONS` (not `EXTRA_MISSIONS`). These production exports are now only exercised by tests but remain public API: any future caller importing `startMission` from `./missions` silently reintroduces the landmine. Additionally, `missionName` is exported from both `src/sim/missions.ts` and `data/missions.ts`, and the sim copy returns `id` for re-themed extras (dead/divergent duplicate).

**Fix:** Delete the obsolete `startMission`/`tickMission`/`missionName` from `src/sim/missions.ts` (re-export from `data/missions` if callers need names), leaving only `campaignMissions()`. Update `tests/missions.test.ts` imports accordingly.

**Status:** ✅ fixed — `src/sim/missions.ts` now exports only `campaignMissions()` (the dead `year:0` `startMission`/`tickMission`/duplicate `missionName` and their interfaces were removed); `tests/missions.test.ts` imports `missionName` from `data/missions` and drops the legacy-function tests. Commit `b95309a`.

### WR-04: `startMission` sub-effect failures are silently swallowed

**File:** `src/sim/runner.ts:2280-2310` (sub-effect block)

**Issue:** The per-mission sub-effects loop calls `this.placeBuilding(...)`, `openTradeRoute`, `setTradeOrder` and ignores every return value. If a preplaced starter can't be placed (e.g. terrain conflict, occupied tile), a route fails to open, or an order fails, the mission still returns `{ok:true}` and the player/UI sees a successful start while the starter city is partial. This is the preplace path's only correctness signal and it is dropped.

**Fix:** Collect failures and surface them on the return value (or at minimum on `commandLog`/a warnings list); e.g. aggregate `const errors: string[]` and return `{ok: errors.length === 0, error: errors.join('; ') ?? undefined}` while still applying the recordable start. Keep the push behavior per CR-02.

**Status:** ✅ fixed — `startMission` now collects preplace/route/order sub-effect failures and returns `{ok: false, error: <causes>}` instead of a false clean `ok:true` (the recordable start still applies for determinism); the winnability probe tolerates its intentional measurement-map preplace mismatch while still throwing on genuine failures; a WR-04 test was added. Commit `2774cb7`.

## Info

### IN-01: `grand_city` has conflicting time-limit values

**File:** `data/missions.ts:201` (`timeLimitYears: 15`), `:247` (`modifiers.timeLimitYears: 20`)

**Issue:** `grand_city` declares `timeLimitYears: 15` at the top level and `modifiers.timeLimitYears: 20`. `tickMissionSystem` (and the probe) prefer the modifier (20), so the top-level 15 is dead/conflicting data that will mislead future tuning. Every other mission keeps the two in sync.

**Fix:** Drop the redundant top-level `timeLimitYears: 15` on `grand_city` (or align it to 20) so a single value is authoritative.

**Status:** ✅ fixed — `grand_city.timeLimitYears` aligned to `20` (matching the `modifiers.timeLimitYears` override the sim reads). Commit `a7f8633`.

### IN-02: `getCodex()` returns module-level static entries plus a *shallow* copy

**File:** `src/sim/campaign.ts:53-249` (`ENTRIES`), `:264-266` (`buildCodex`)

**Issue:** `buildCodex()` returns `ENTRIES.map((e) => ({...e}))` — a shallow copy per runner cached in `codexCache`. Nested arrays (`inputs`/`outputs`/`relatedLinks`/`requirements`/`hints`) are shared by reference with the module-level `ENTRIES`, so a consumer mutating an array (e.g. Phase-18 UI) would corrupt the shared catalog for every subsequent runner. Low risk today (catalogs are read-only), but worth documenting or deep-cloning.

**Fix:** Either document that `getCodex()` results are read-only, or deep-copy the arrays in `buildCodex()` (cheap: one-time per runner, cached).

**Status:** ✅ fixed — `buildCodex()` now deep-copies the nested arrays (`inputs`/`outputs`/`relatedLinks`/`requirements`/`hints`) so a consumer mutating a `getCodex()` result cannot corrupt the shared catalog. Commit `acab635`.

---

_Reviewed: 2026-08-05T22:15:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_

## Findings Summary

| ID | Severity | File:line | Summary |
|----|----------|-----------|---------|
| CR-01 | Critical | runner.ts:2271/2506 | `mission.year` recomputed as 0 on replay → time-limited missions instantly fail after save/load (start-year landmine resurfaces) |
| CR-02 | Critical | runner.ts:2278/2379 | `startMission`/`dismissTutorialStep` records dropped on replay → mission lost across save→load→save→load |
| WR-01 | Warning | runner.ts:2256-2262 | Paused-path `startMission` bypasses the sequential gate (enqueue + drain treats as replay) |
| WR-02 | Warning | campaign.ts:404-415 | Dangling `codexRef`/`relatedLinks` ('labor', 'ratings', 'ratings-prosperity', 'temples') |
| WR-03 | Warning | sim/missions.ts:24-63 | Legacy `year:0` mission logic + duplicate divergent `missionName` still exported |
| WR-04 | Warning | runner.ts:2280-2310 | Preplace/route/order sub-effect failures silently swallowed in `startMission` |
| IN-01 | Info | data/missions.ts:201/247 | `grand_city` conflicting time-limit (15 vs 20) |
| IN-02 | Info | campaign.ts:264-266 | `buildCodex()` shallow copy shares nested arrays with module-level catalog |
