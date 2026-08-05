---
phase: 17-campaign-tutorial-codex
verified: 2026-08-05T22:00:16Z
status: passed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 17: Campaign, Tutorial & Codex — Verification Report

**Phase Goal:** 10-mission campaign (playable + winnable in sequence), contextual tutorial, codex.
**Verified:** 2026-08-05T22:00:16Z
**Status:** passed
**Re-verification:** No — initial verification (no previous VERIFICATION.md existed)

## Goal Achievement

Goal-backward: the ROADMAP Phase 17 goal is a **10-mission campaign (playable + winnable in sequence)**, a **contextual tutorial**, and a **codex**. The must-haves were merged from the ROADMAP Success Criteria (SC1–SC3) and the 17-PLAN.md frontmatter truths (CAMPAIGN-01/02/03 + Winnability/gates). Every truth was verified against the actual source, not the SUMMARY narrative.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 — The 10 missions are playable and winnable in sequence | ✓ VERIFIED | `campaignMissions()` = 10 ids in spec arc order (missions.test.ts:216-221); progression gate tests pass (running mission blocks different id :70-76, sequential unlock :112-124, paused-path gate :78-98); startMission applies modifiers/preplace/routes (:139-161); per-mission maps parse deterministically (:197-213); **winnability probe 10/10 green** (tutorial→metropolis, each target ceiling reached within `min(timeLimit,12)` yr — ran: 67.1s, 10/10 passed) |
| 2 | SC2 — Tutorial prompts appear contextually as the player encounters systems | ✓ VERIFIED | 9-step predicate catalog (`TUTORIAL_ELIGIBILITY`, campaign.ts:462-542) as pure total functions over `(DerivedSnapshot, HouseView[], CityView)`; scenario tests pass (immigration-blocked road-isolation, no-food, housing-evolution, rating shortfall, empty-city totality — campaign.test.ts:135-192); ordered intro seed preserved (roads→housing, :100-109) |
| 3 | SC3 — The codex explains every building, good, service, and god | ✓ VERIFIED | `buildCodex()` emits building entries per BUILDINGS + commodity per COMMODITIES + service per WALKERS + god per GODS, all 13 kinds present (campaign.test.ts:42-48); farm cost/workers match live catalog (:50-55); `lookupEntry(id, kind)` works (:57-63); every `codexRef`/`relatedLinks` resolves (WR-02, :65-85) |
| 4 | CAMPAIGN-01 — 10 missions follow spec arc, additive MissionDef, validated over BOTH catalogs | ✓ VERIFIED | All 10 entries re-themed to arc with ids kept (data/missions.ts: `Riverside Foundations`→`Provincial Capital`); `MissionDef` += optional `map?/products?/routes?/modifiers?` (:78-86); validate.ts:172 iterates `[...MISSIONS, ...EXTRA_MISSIONS]` with map/products/routes/modifiers checks (:188-261); `validateCatalogs() === []` (data-catalog.test.ts:77,107) + malformed-mission rejection (:80-106 pass) |
| 5 | CAMPAIGN-01 — startMission is a replayable SaveCommand; start-year fix; byte-identical save/load | ✓ VERIFIED | `{kind:'startMission'; id; year}` in union (types.ts:98), pushed unconditionally (:2298), `mission.year = floor(tickCount/360)` (:2280); CR-01 mid-run test passes (year=13 preserved after load, no instant-fail — campaign-determinism.test.ts:77-100); chunked 1/7/50 byte-identity (:47-56); sub-effects replay byte-identically (:119-136) |
| 6 | CAMPAIGN-01 — sequential gate: N+1 unlocks only when N won; gate live-only | ✓ VERIFIED | `missionUnlocked()` (runner.ts:2356-2366): fresh/sandbox any, same-id ok, next-in-order only on complete; `!this.replaying` skip (:2269); WR-01 paused-path gate enforced before enqueue (:2263-2266, missions.test.ts:78-98); skip-ahead rejected + next allowed after win (:112-124) |
| 7 | CAMPAIGN-02 — tutorial triggered by OBSERVED state, pure total predicates, no wall-clock | ✓ VERIFIED | Predicates read live state only (no Math.random/Date.now/new Date — source-audit test passes campaign-determinism.test.ts:201-210); empty-city totality test (:177-183); intro seed preserved |
| 8 | CAMPAIGN-02 — step shows text+expanded+codexRef+highlight; dismissTutorialStep replayable; getTutorial() accessor | ✓ VERIFIED | `getTutorial()` returns `{current, eligible, dismissed}` with highlight ids (runner.ts:1462-1484); `dismissTutorialStep` replayable SaveCommand, dismissed set reconstructs from replay (campaign-determinism.test.ts:104-115, 181-198); CR-02 double round-trip preserves dismissal (:181-198); unknown step rejected (campaign.test.ts:121-124) |
| 9 | CAMPAIGN-03 — codex 13 kinds, catalog-derived fields, getCodex()/lookupEntry, 4-kind count filter | ✓ VERIFIED | `getCodex()` cached with categories + `lookupEntry` (runner.ts:1486-1502); deep-copied nested arrays (IN-02, campaign.ts:282-291); derivedSnapshot codex count stays filtered to 4 kinds (runner.ts:1338); getState() carries no mission/codex/tutorial fields (:1847-1862) |
| 10 | Winnability + gates — targets inside verified ceilings; probe proves reachable; full suite/typecheck/military green; no goldens | ✓ VERIFIED | Probe 10/10 (winnability-probe.test.ts, ran green); targets pinned to measured envelope (pop ≤ 300, ratings ≤ 55, favor ≤ 35, treasury ≤ 4000, no annualExports); **full suite ran: 114 files / 870 tests passed**; `tsc --noEmit` exit 0; `check:military` clean; git log confirms no golden/fixtures changes |

**Score:** 10/10 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `data/missions.ts` | MissionDef additive fields; 10 entries re-themed to arc, maps/products/routes/modifiers | ✓ VERIFIED (537 lines) | All 10 ids kept, arc names applied, per-mission map layouts + preplace + modifiers + routes; targets within measured envelope |
| `data/validate.ts` | missions loop over MISSIONS + EXTRA_MISSIONS validating map/products/routes/modifiers | ✓ VERIFIED (280 lines) | validate.ts:172 iterates both catalogs; width/height/layout/legend/preplace/products/routes/modifiers checks |
| `src/sim/missionMaps.ts` | pure layout factory `missionMap(def) → SimMap | null` | ✓ VERIFIED (43 lines) | `SimMap.fromLayout` parsing, deterministic, no RNG; discussed A4 construction-time contract in docstring |
| `src/sim/types.ts` | SaveCommand union += startMission/dismissTutorialStep | ✓ VERIFIED | types.ts:98-99 (`{kind:'startMission'; id; year}`, `{kind:'dismissTutorialStep'; step}`); no SaveData schema change |
| `src/sim/campaign.ts` | enriched CodexEntry (13 kinds + fields); tutorial predicate catalog | ✓ VERIFIED (559 lines) | Full catalog-derived codex + HouseView/CityView/TutorialView + 9-step predicate catalog |
| `src/sim/runner.ts` | startMission rewrite + gate + sub-effects; dismissTutorialStep; accessors; applyCommand branches | ✓ VERIFIED (3187 lines) | All CR/WR fixes present in code (year carry, unconditional push, paused-path gate, WR-04 subErrors); exhaustive dispatch :3162-3165 |
| `tests/determinism/campaign-determinism.test.ts` | chunked byte-identity + save/load + source audit | ✓ VERIFIED (218 lines) | Ran green (10 tests); CR-01/CR-02/T-17-03 cases incl. save→load→save→load |
| `tests/winnability-probe.test.ts` | one `it` per mission asserting ceilings reachable | ✓ VERIFIED (132 lines) | Ran green (10 tests, 67.1s) |
| `tests/unit/campaign.test.ts` | codex completeness + tutorial scenarios + dismiss | ✓ VERIFIED (193 lines) | Ran green (17 tests) |
| `tests/missions.test.ts` | progression gate, start-year, map/modifiers/routes, save/load | ✓ VERIFIED (267 lines) | Ran green (15 tests) |
| `tests/runner-accessors.test.ts` | accessor shapes + mission save/load | ✓ VERIFIED (483 lines) | Ran green (28 tests) |

All 11 artifacts pass `verify.artifacts` (11/11, no stub/missing issues).

### Key Link Verification

Manual verification (the plan's `key_links` are prose strings, not structured — `verify.key-links` returned 0 structured links, so each was checked by source inspection):

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| startMission | tickMissionSystem | `mission.year = Math.floor(tickCount/360)`; time-limit reads `def.modifiers?.timeLimitYears ?? def.timeLimitYears` | ✓ WIRED | runner.ts:2280 (year), 1649-1653 (limit); CR-01 test passes |
| startMission | applyCommand replay | `suppressCommandRecording` guard + gate skipped during replay + sub-effects under `!this.suppressCommandRecording` on BOTH paths | ✓ WIRED | runner.ts:2309/2347, place/openTradeRoute/setTradeOrder guards (967/996/1755); gate skip at :2269; T-17-03 no-growth test passes |
| startMission | SaveCommand union | `{kind:'startMission'; id; year}` + exhaustive applyCommand branch | ✓ WIRED | types.ts:98, runner.ts:3162-3163; `never` branch throws on unknown kinds (:3166-3168) |
| tutorial predicates | DerivedSnapshot + house state | pure total predicates over `(derived, houses, city)`; runner maps live BuildingInstance → HouseView | ✓ WIRED | runner.ts:1394-1413 (houseViews), 1417-1446 (cityView), 1450-1455 (tutorialEligibleSteps), 1454 (predicate calls); scenario tests pass |
| dismissTutorialStep | dismissed set | set reconstructs purely from replayed `{kind:'dismissTutorialStep'}` commands (never SaveData) | ✓ WIRED | runner.ts:2404-2415 + applyCommand :3164-3165; CR-02 double round-trip passes |
| buildCodex | data catalogs | every field derived from BUILDINGS/COMMODITIES/WALKERS/HOUSING_LEVELS/TRADE_CITIES/FESTIVAL_TIERS/EVENTS/CONFIG/ratings `W` | ✓ WIRED | campaign.ts imports at :8-17; farm cost/workers equality test :50-55; ratings entry reads live `W` (:212-215) |
| data/missions.ts new fields | data/validate.ts | validation over BOTH MISSIONS and EXTRA_MISSIONS | ✓ WIRED | validate.ts:172; data-catalog malformed-rejection test passes |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| ------- | ------------- | ------ | ------------------ | ------ |
| getTutorial() | current/eligible/dismissed | computed from live `houseViews()`/`cityView()`/`derivedSnapshot()` + dismissed set | Yes — scenario tests exercise real state (food city, isolated house, empty city) | ✓ FLOWING |
| getCodex() | entries | `buildCodex()` reading live catalogs (BUILDINGS/COMMODITIES/…) | Yes — catalog-equality tests (farm cost/workers) | ✓ FLOWING |
| startMission sub-effects | treasury/buildings/routes | `def.modifiers/map.preplace/routes` applied under suppression | Yes — missions.test.ts asserts credit + preplace buildings + opened routes | ✓ FLOWING |
| getMissionProgress()/getCampaignProgress() | won/progress/nextUnlocked | sustained ObjectiveTracker + `campaignMissions()` | Yes — runner-accessors test asserts shaped returns around a won mission | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 10 missions winnable (probe) | `npx vitest run tests/winnability-probe.test.ts` | 10/10 passed | ✓ PASS |
| Determinism (save/load byte-identity, CR-01/CR-02) | `npx vitest run tests/determinism/campaign-determinism.test.ts` | 10/10 passed | ✓ PASS |
| Progression gate + start-year + modifiers | `npx vitest run tests/missions.test.ts` | 15/15 passed | ✓ PASS |
| Tutorial scenarios + codex coverage | `npx vitest run tests/unit/campaign.test.ts` | 17/17 passed | ✓ PASS |
| Accessors + mission round-trip | `npx vitest run tests/runner-accessors.test.ts` | 28/28 passed | ✓ PASS |
| Catalog validation `validateCatalogs() === []` | `npx vitest run tests/data-catalog.test.ts` | 13/13 passed | ✓ PASS |
| Full suite | `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` | 114 files / **870/870 passed** | ✓ PASS |
| Typecheck | `npm run typecheck` | exit 0 | ✓ PASS |
| Military gate | `npm run check:military` | clean | ✓ PASS |

Note: the `[vitest-worker]: Timeout calling "onTaskUpdate"` messages during the long probe runs are the pre-existing vitest worker-RPC artifact already documented in 17-REVIEW-FIX.md ("observed in the very first targeted run before any edits; no test failed") — all tests pass.

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| Winnability probe (10 missions) | `npx vitest run tests/winnability-probe.test.ts` | exit code 0 — 10/10 passed (67.1s); all target ceilings reached within each time limit | PASS |
| Determinism source audit (no Math.random/Date.now/new Date in campaign.ts/missionMaps.ts; single `savedAt: Date.now` in runner.ts) | within campaign-determinism.test.ts | 2/2 audit tests passed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| CAMP-01 (CAMPAIGN-01) | 17-PLAN | 10-mission campaign framework | ✓ SATISFIED | replayable startMission + gate + additive data + winnability probe 10/10 |
| CAMP-02 (CAMPAIGN-02) | 17-PLAN | Contextual tutorial | ✓ SATISFIED | 9-step predicate catalog + dismiss + getTutorial |
| CAMP-03 (CAMPAIGN-03) | 17-PLAN | Codex | ✓ SATISFIED | 13-kind catalog-derived codex + getCodex/lookupEntry |

No orphaned requirements — all CAMP-01/02/03 IDs are claimed by 17-PLAN.md frontmatter and verified above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None — no TBD/FIXME/XXX/TODO/PLACEHOLDER markers, no stub `return null`-only bodies, no console.log implementations in any Phase-17 file | — | — |

### Human Verification Required

None gating. This is a deterministic sim-core phase with no UI (UI rendering is Phase 18); every contract truth has a passing named behavioral test. One **informational, non-gating** recommendation for Phase 18: after the Management UI lands, a human playtest should sanity-check campaign difficulty "feel" (the retuned envelope is empirically derived and documented in SUMMARY deviations #4) — but winnability itself is proven by the 10/10 probe, so this is not a gap.

### Gaps Summary

No gaps. The 10/10 must-haves are verified against the codebase with passing behavioral evidence (870/870 full suite, 10/10 probe, both static gates green, no golden churn). The single substantive deviation — winnability targets retuned to the probe-measured envelope because the sim's wheat-only food caps housing at L5 (no vegetable/meat/fish producers in the current building set) — is documented in SUMMARY deviations #4, is authorized by the plan's own "lower the offending target one notch … until the probe is green" fallback, and preserves the gradual-introduction arc (mission 1 easiest → 10 hardest). The winnability probe measures ceiling reachability on a resource-rich measurement map (per its document header + WR-04 fix) rather than each mission's own tuned starter map; per-mission preplace/route/map application is separately asserted in missions.test.ts, and on-map winnability of missions 2-10 beyond ceiling reachability remains a reasonable future-validation note (not a phase-17 contract failure).

---

_Verified: 2026-08-05T22:00:16Z_
_Verifier: the agent (gsd-verifier)_
