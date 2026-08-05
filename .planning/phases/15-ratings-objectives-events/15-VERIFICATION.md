---
phase: 15-ratings-objectives-events
verified: 2026-08-05T08:25:06Z
re-verified: 2026-08-05T09:46:00Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0 # WR-02/WR-05 now covered by committed behavioral regression tests (test(15) 06fa6ce)
overrides_applied: 0
human_verification:
  - test: "Run an import-only city (import_upto_target order, e.g. clay into the city stock) for 600 ticks and read getDerived().annualExports"
    expected: "annualExports === 0 — imports never feed the trailing-360 export window (WR-02)"
    status: resolved
    why_human: "Code-present invariant (ring incremented only on export branch) with no committed behavioral regression test; the temporary probe from the review fix was removed before commit"
    resolution: "Committed behavioral test now exercises it — tests/determinism/export-window-determinism.test.ts (annualExports import exclusion, WR-02): an import-only clay city (import_upto_target, importSpend > 0 over 600 ticks) asserts annualExports === 0 while the same seed's export city reports > 0. Commit 06fa6ce."
  - test: "On a seed where the same event id fires twice, respond to the first occurrence with a conclude-capable response, let it conclude, and observe the second occurrence's behavior"
    expected: "Second occurrence runs its full duration and can be responded to independently — stale choice cleared at conclusion (WR-05)"
    status: resolved
    why_human: "Cleanup/state-transition invariant (delete eventResponseByEvent at conclusion) with no committed second-occurrence test; the temporary probe was removed before commit"
    resolution: "Committed behavioral test now exercises it — tests/determinism/event-response-determinism.test.ts (second-occurrence response freshness, WR-05): respond to a conclude-capable first occurrence, drive to a second occurrence of the same event id, assert fresh agency (response accepted, no auto-conclude) and a conclusion exactly eventDuration(ev) ticks after the second firing. Commit 06fa6ce."
---

# Phase 15: Ratings, Objectives & Events — Verification Report

**Phase Goal:** Four ratings, objectives/win conditions, and event responses.
**Verified:** 2026-08-05T08:25:06Z (re-verified 2026-08-05T09:46:00Z — WR-02/WR-05 closed by committed behavioral tests)
**Status:** passed
**Re-verification:** Yes — the two human-verification items (WR-02, WR-05) were resolved with committed behavioral regression tests (commit `06fa6ce`) and the full suite re-run green (108 files / 782 tests).

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | RATE-01: getDerived() exposes `decomposition` with per-rating factor buckets; ratings clamped 0-100; Prosperity operating-balance excludes one-time construction cost (constructionSpend only in separate construction bucket) | ✓ VERIFIED | ratings.ts weighted-score helpers (ONE computation with decomposeRatings); runner.ts derivedSnapshot builds CityStats + decomposition; tests/ratings.test.ts (buckets all four ratings, each clamped 0..100, construction.separate); runner-accessors.test.ts (constructionSpend separation test — build raises constructionSpend by exactly cost, operatingBalance stays treasury-derived) |
| 2   | RATE-01: `constructionSpend` is a lifetime accumulator beside build/route captures and re-derives byte-identically from replaying saveCommands | ✓ VERIFIED | placeBuilding (runner.ts:1472) and openTradeRoute (:839) both push `constructionSpend` and are replayable SaveCommands; tests/determinism/event-response-determinism.test.ts asserts constructionSpend identity after save→load (passes) |
| 3   | RATE-02: ObjectiveTracker accepts population/culture/prosperity/stability/favor/treasury/annualExports (undefined = not required, default sustainChecks 3); sustain counted only on month cadence (tickCount % 40 === 0); getObjectiveProgress pure read (BUG1 fixed) | ✓ VERIFIED | objectives.ts ObjectiveTracker + lastResult(); runner.ts tickDerivedSystems month-gated update + pure getObjectiveProgress; objectives.test.ts (sustain journey 2-pass win + miss reset, thresholds enforced/skipped, default 3, progress clamp); runner-accessors.test.ts (month-cadence BUG1 test: 39 ticks no advance, month gates at 40/80/120, repeated reads never advance) |
| 4   | RATE-02: mission unify on sustained ObjectiveTracker — wins after all targets held for sustain period, shortfalls visible, time-limit preserved; annualExports is a trailing-360-tick window identical across chunked ticks and save/load | ✓ VERIFIED | tickMissionSystem drives missionTracker (ObjectiveTracker built from MissionDef); time-limit failure + WR-06 unknown-id failure preserved; missions.test.ts (sustained win, shortfall visible not failed, new-field backward compat); export-window-determinism.test.ts (chunked 1/7/50 + save/load byte-identity, trailing-360) — all green |
| 5   | RATE-03: event catalog ~31 non-military events (original 8 preserved byte-identical), responses[]; active event effects move live derived ratings and are removed at conclusion — never entered into getState() | ✓ VERIFIED | data/events.ts 8 ORIGINAL (byte-identical verified by diff) + 23 EXPANDED; EventDef.responses; events.test.ts (resolveResponse, unique ids, pinned schedule); runner-accessors.test.ts (active event moves derived prosperity +2, cleared to baseline after conclusion); code inspection of getState() (runner.ts:1589) — no decomposition/constructionSpend/annualExports/eventMod, separate economy computeRatings path; goldens untouched |
| 6   | RATE-03: respondEvent(eventId, choiceId) is a replayable SaveCommand — valid choice mutates outcome (treasury cost via ledger, severity, early conclusion); unknown/inactive event or unknown choice rejected with no state change; run→respond→save→load byte-identical getStateJson() (CR-01 fixed) | ✓ VERIFIED | respondEvent with shared validate() (unknown-choice/no-active-event/not-enough-money), applyRecordedResponse + deferred replay (applyDueEventResponses, line 1107); types.ts union branch + applyCommand dispatch (runner.ts:2722); event-response-determinism.test.ts (byte-identity after respond→save→load with constructionSpend/annualExports identity; invalid responses no-op) — green |
| 7   | Regression: golden fixtures, balance-parity, military-absence gates stay green; getState() keeps separate economy computeRatings; expanded catalog validates (validateCatalogs() === []) | ✓ VERIFIED | Full suite 108 files / 780 tests green; git diff tests/golden empty; balance-parity.test.ts green (weights module-local, no data/balance change); check:military clean; data-catalog.test.ts asserts validateCatalogs() === [] |
| 8   | WR-02 sub-invariant: annualExports counts only EXPORTS (import path excluded from the window) | ✓ VERIFIED | Code: tickExportCounts incremented only on export branch (runner.ts:754-758); import_upto_target branch has no increment. tests/determinism/export-window-determinism.test.ts (annualExports import exclusion): an import-only clay city (import_upto_target, importSpend > 0 over 600 ticks) reports annualExports === 0, contrasted with the same seed's export city reporting > 0. Determinism identity (chunked + save/load) committed-tested and green. |
| 9   | WR-05 sub-invariant: recorded event response cleared at occurrence conclusion; a second occurrence of the same event starts fresh | ✓ VERIFIED | Code: delete eventResponseByEvent[ev.id] at conclusion (runner.ts:314). tests/determinism/event-response-determinism.test.ts (second-occurrence response freshness): respond to a conclude-capable first occurrence, drive to a second occurrence of the same event id, assert restored agency (fresh response accepted, no auto-conclude) and a full natural duration (conclusion exactly eventDuration(ev) ticks after the second firing). |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/sim/ratings.ts` | weighted-sum computeTargets (all four), extended RatingDecomposition, clampRating preserved | ✓ VERIFIED | 346 lines; one-computation score helpers; module-local weights; construction excluded from operating balance |
| `src/sim/objectives.ts` | ObjectiveTarget/MetricSnapshot + favor/treasury/annualExports, ok-chain extended, default sustainChecks 3 | ✓ VERIFIED | 73 lines; sustained only mutable member, lastResult/progress pure |
| `src/sim/events.ts` | pure resolveResponse + preserved hash/pickEvent/applyEvent/eventDuration/eventSustainMsg/eventFinalMsg | ✓ VERIFIED | 85 lines; resolveResponse indexes responses by id |
| `src/sim/runner.ts` | DerivedSnapshot.decomposition + constructionSpend + annualExports; month-cadence objective update; pure getObjectiveProgress; live event effects; respondEvent command; applyCommand branch | ✓ VERIFIED | 2745 lines; all seams wired and behaviorally tested |
| `src/sim/types.ts` | SaveCommand union branch { respondEvent, openTradeRoute, setTradeOrder } (additive) | ✓ VERIFIED | types.ts:76-89 |
| `data/events.ts` | EventDef.responses + ~31 non-military events (original 8 byte-identical) | ✓ VERIFIED | 294 lines; 8 ORIGINAL byte-identical verified by node-side diff |
| `data/missions.ts` | MissionDef targetFavor?/targetTreasury?/targetAnnualExports?/sustainChecks? | ✓ VERIFIED | 80 lines; optional = not required, backward compatible |
| `data/validate.ts` | events responses validation + mission new-field checks | ✓ VERIFIED | 188 lines; unique ids, non-empty labels, finite effects, non-negative treasuryCost, positive-int sustainChecks |
| `tests/objectives.test.ts` | sustain journey, thresholds, default 3 | ✓ VERIFIED | 73 lines; behavioral |
| `tests/determinism/export-window-determinism.test.ts` | annualExports trailing-year identity chunked + save/load; WR-02 import exclusion | ✓ VERIFIED | 111 lines; green |
| `tests/determinism/event-response-determinism.test.ts` | respondEvent + constructionSpend + annualExports replay byte-identity; WR-05 second-occurrence freshness; no-RNG/clock audit | ✓ VERIFIED | 214 lines; green |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| tickDerivedSystems (runner.ts:473) | ObjectiveTracker.update | month gate tickCount % 40 === 0 + pure getObjectiveProgress | ✓ WIRED | month-cadence gating on line 480; BUG1 pure-read enforced — runner-accessors BUG1 test green |
| Event lifecycle block (runner.ts:305-337) | DerivedSnapshot ratings | activeEventDelta applied live in derivedSnapshot, removed at conclusion | ✓ WIRED | eventMod applied at :1190/1204-1207; refreshEventDelta on conclude; never in getState() |
| respondEvent | types.ts SaveCommand union + applyCommand dispatch | union branch + dispatch at :2722 + push-on-accept to saveCommands | ✓ WIRED | CR-01 deferred replay via applyDueEventResponses; byte-identity test green |
| constructionSpend | Treasury.addExpense('other',...) capture sites | placeBuilding (:1472) + openTradeRoute (:839), both replayable commands | ✓ WIRED | replay-derivable; separated into construction bucket only |
| data/balance.ts new keys | CONFIG.<key> consumers | weights kept module-local in ratings.ts | ✓ WIRED | no data/balance change; balance-parity gate green |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| DerivedSnapshot.decomposition | cityStats (educationCoverage, religionCoverage, festivalBoost, housingLevel, unemployment, etc.) | live derivedSnapshot() factor computation from real buildings/walkers/policies | ✓ FLOWING | runner-accessors: culture buckets respond to placed religion/entertainment/education buildings |
| DerivedSnapshot.constructionSpend | constructionSpend | placeBuilding/openTradeRoute cost captures | ✓ FLOWING | runner-accessors: build raises it by exactly BUILDINGS[type].cost |
| DerivedSnapshot.annualExports | tickExportCounts ring (360 slots) | per-tick export-path increment (live route exports) | ✓ FLOWING | export-window determinism: > 0 real exports, identical chunked + save/load |
| Active-event modifier | activeEventDelta | refreshEventDelta from event effect + response severity | ✓ FLOWING | runner-accessors: prosperity +2 during good_harvest, baseline after |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full suite | `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` | 108 files / 782 tests passed | ✓ PASS |
| Typecheck | `npm run typecheck` | clean (tsc --noEmit) | ✓ PASS |
| Military gate | `npm run check:military` | clean — no forbidden tokens | ✓ PASS |
| Goldens | `git diff <phase-start>..HEAD -- tests/golden` | empty | ✓ PASS |
| Balance parity | `npx vitest run tests/balance-parity.test.ts` | 7 tests passed | ✓ PASS |
| Determinism (export window, incl. WR-02 import exclusion) | `npx vitest run tests/determinism/export-window-determinism.test.ts` | 4/4 passed | ✓ PASS |
| Determinism (event response, incl. WR-05 second-occurrence freshness) | `npx vitest run tests/determinism/event-response-determinism.test.ts` | 4/4 passed | ✓ PASS |
| Objectives | `npx vitest run tests/objectives.test.ts tests/missions.test.ts` | 11/11 passed | ✓ PASS |
| Ratings/events/data-catalog | `npx vitest run tests/ratings.test.ts tests/events.test.ts tests/data-catalog.test.ts` | 25/25 passed | ✓ PASS |
| RNG/clock audit | grep Math.random/Date.now/new Date over sim chain files | 0 matches; runner.ts only pre-existing `savedAt: Date.now()` (:2087) | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| (no phase-declared probe scripts) | — | — | SKIPPED — no `scripts/*/tests/probe-*.sh`; REVIEW-FIX.md temporary probes were removed before commit |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| RATE-01 | 15-PLAN | Four ratings with decomposition and separate construction-cost treatment for Prosperity | ✓ SATISFIED | weighted decomposition all four; constructionSpend separated; tests + e2e green |
| RATE-02 | 15-PLAN | Objectives/win conditions (targets sustained for a required period) | ✓ SATISFIED | month-cadence tracker, treasury/favor/exports targets, mission unify, trailing-360 window; tests green |
| RATE-03 | 15-PLAN | Non-military event engine (deterministic schedule, lifecycle, responses) | ✓ SATISFIED | ~31-event catalog, live effects, respondEvent SaveCommand, byte-identity; tests green |

### Human Verification Required

The two behavior-dependent invariants from the review-fix pass (WR-02, WR-05) are now **RESOLVED** — each has a committed behavioral regression test (commit `06fa6ce`, `test(15)`), so the transitions are exercised by the committed suite and no human re-check is needed:

1. **WR-02 — annualExports counts exports only (imports excluded).** ✅ RESOLVED — `tests/determinism/export-window-determinism.test.ts` ("annualExports import exclusion"): an import-only city (`import_upto_target` clay on massilia, `importSpend > 0` over 600 ticks) asserts `getDerived().annualExports === 0` while the same seed's export city reports `> 0`.

2. **WR-05 — stale event response cleared per occurrence.** ✅ RESOLVED — `tests/determinism/event-response-determinism.test.ts` ("second-occurrence response freshness"): respond to the first occurrence with a `conclude`-capable choice, let it conclude, drive to a second occurrence of the same event id, and assert the second occurrence stays active with restored agency (a fresh response is accepted — no stale auto-conclude) and concludes exactly `eventDuration(ev)` ticks after firing.

These two items did not block the phase goal — every plan must-have has a passing behavioral test and all deterministic/regression gates are green. They were flagged because the committed suite did not yet protect the specific transitions; they are now closed by the committed behavioral tests above.

### Gaps Summary

No gaps found. All 9 PLAN must-have truths are VERIFIED with passing behavioral tests; all 11 artifacts exist, are substantive, are wired, and their data flows are traced. The full suite (108 files / 782 tests), typecheck, military gate, balance parity, and golden fixtures are green. The two review-fix refinements (WR-02 exports-only accounting, WR-05 occurrence-freshness) previously flagged as PRESENT_BEHAVIOR_UNVERIFIED are now protected by committed behavioral regression tests (commit `06fa6ce`) and marked resolved.

---

_Verified: 2026-08-05T08:25:06Z_
_Verifier: the agent (gsd-verifier)_
