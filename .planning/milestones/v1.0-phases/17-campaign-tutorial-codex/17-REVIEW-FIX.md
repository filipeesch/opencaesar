---
phase: 17-campaign-tutorial-codex
fixed_at: 2026-08-05T22:50:00Z
review_path: .planning/phases/17-campaign-tutorial-codex/17-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 17: Code Review Fix Report — Campaign, Tutorial & Codex

**Fixed at:** 2026-08-05T22:50:00Z
**Source review:** `.planning/phases/17-campaign-tutorial-codex/17-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 6
- Fixed: 6
- Skipped: 0
- Additionally fixed (optional Info, applied — both trivial): IN-01, IN-02

All 8 findings were fixed and committed atomically. Determinism, sequential-gate, codex link integrity, and start-year semantics were all restored/verified.

## Verification

Gates ran in the **isolated worktree** (`/tmp/sv-17-reviewfix-hMIMYo`, branch `gsd-reviewfix/17-69387`, from `main` @ `e0c0de6`), with `node_modules` symlinked from the main checkout for tooling only.

- **Typecheck** `npm run typecheck` (`npx tsc --noEmit`): clean (0 errors) after every commit.
- **Targeted suites** (run per finding):
  - `tests/determinism/campaign-determinism.test.ts` (10) — incl. new CR-01 mid-run start + CR-02 double round-trips
  - `tests/missions.test.ts` (15) — incl. new WR-01 paused-gate + WR-04 preplace-failure tests
  - `tests/unit/campaign.test.ts` (17) — incl. new WR-02 link-integrity test
  - `tests/runner-accessors.test.ts` (28)
  - `tests/winnability-probe.test.ts` (10)
- **Full suite**: `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` → **114 files, 870/870 tests passed**. (Two `[vitest-worker] Timeout calling "onTaskUpdate"` RPC messages appear during the long probe run — a pre-existing vitest worker-RPC artifact observed in the very first targeted run before any edits; no test failed.)
- **check:military** `node scripts/check-military.mjs`: clean — no forbidden military tokens.
- **Catalog validation**: `tests/data-catalog.test.ts` (13) green → `validateCatalogs() === []`.
- **No golden churn**: golden tests pass; missions/tutorial/codex never enter `getState()` (derived snapshot codex count stays filtered to the 4 original kinds).

## Fixed Issues

### CR-01: `mission.year` is lost on save/load — the start-year landmine resurfaces via the replay path

**Files modified:** `src/sim/types.ts`, `src/sim/runner.ts`, `tests/determinism/campaign-determinism.test.ts`
**Commit:** `c5ebbf5`
**Applied fix:** The `SaveCommand` union now carries the start year: `{ kind: 'startMission'; id: string; year: number }`. `startMission(id, startingYear?)` records `year` at authoring time and `applyCommand` restores it on replay (`runner.startMission(cmd.id, cmd.year)`), so a replayed start reconstructs the true start year instead of recomputing `0` (which instantly failed a time-limited mission after load). Added a determinism test: start `thriving_city` on a year-13 runner → save → load → assert year survives, not-failed after the next month gate, and byte-identical continuation.

### CR-02: `save → load → save → load` silently drops the mission (and tutorial dismissals)

**Files modified:** `src/sim/runner.ts`, `tests/determinism/campaign-determinism.test.ts`
**Commit:** `f4b1afe`
**Applied fix:** Removed the `!this.replaying` guards on the `startMission`/`dismissTutorialStep` `saveCommands.push` so they follow the standard push-on-accept pattern (sub-effects remain suppressed by `suppressCommandRecording` on both live and replay). A replayed command now re-embeds its record exactly once, so `save2.commands === save1.commands` and the mission/dismissal survive both loads. Added save→load→save→load round-trip tests for the mission and the dismissal.

### WR-01: Paused-path `startMission` bypasses the sequential unlock gate

**Files modified:** `src/sim/runner.ts`, `tests/missions.test.ts`
**Commit:** `1dfe2d9`
**Applied fix:** When paused, `startMission` now validates `missionUnlocked(id)` and the mission id against `MISSIONS[id] ?? EXTRA_MISSIONS[id]` BEFORE enqueuing (precedent: the Phase-15 `respondEvent` paused-path fix), so a locked/unknown queued start is rejected with no queue entry and the drain (which runs with `replaying=true`) cannot bypass the gate. The enqueued command also carries the start `year` (per CR-01). Added paused-path tests (locked/unknown rejected, allowed sandbox mission drains and starts).

### WR-02: Codex cross-links are dangling — `codexRef`/`relatedLinks` point at non-existent entries

**Files modified:** `src/sim/campaign.ts`, `tests/unit/campaign.test.ts`
**Commit:** `ebe7136`
**Applied fix:** `TUTORIAL_CODEX_REF.rating` → `rats-prosperity`; added a synthetic `labor` codex overview entry so the tutorial `labor` ref resolves; `finance.relatedLinks` → `rats-prosperity`; `festivals.relatedLinks` → `temple`/`grand_temple` (was dangling `temples`). Added a link-integrity test asserting every `TUTORIAL_CODEX_REF` and every `relatedLinks` id resolves via `lookupEntry`, with the previously-dangling ids pinned.

### WR-03: Legacy `src/sim/missions.ts` still ships `year: 0` mission logic + a duplicate `missionName`

**Files modified:** `src/sim/missions.ts`, `tests/missions.test.ts`
**Commit:** `b95309a`
**Applied fix:** Removed the dead legacy `startMission` (hardcoded `year: 0`), `tickMission`, and the duplicate divergent `missionName` (and the now-unused `MissionState`/`MissionCheck` interfaces) from `src/sim/missions.ts`, leaving only the pure `campaignMissions()`. `tests/missions.test.ts` now imports `missionName` from `data/missions` and drops the tests for the removed functions.

### WR-04: `startMission` sub-effect failures are silently swallowed

**Files modified:** `src/sim/runner.ts`, `tests/missions.test.ts`, `tests/winnability-probe.test.ts`
**Commit:** `2774cb7`
**Applied fix:** `startMission` now collects preplace/route/order sub-effect failures and returns `{ ok: false, error: <joined causes> }` instead of a false clean `{ ok: true }`, while still applying (and recording) the start so replay reconstructs the same partial state deterministically. The winnability probe — which measures ceilings on a generic measurement map where per-mission preplace geometry is legitimately out of bounds — now tolerates only `preplace`-class harness mismatches and still throws on any genuine failure; the real-mission-map preplace success remains asserted in `tests/missions.test.ts`. Added a WR-04 test (occupied anchor → `ok:false` with `preplace` cause).

### IN-01 (optional, applied): `grand_city` conflicting time-limit values

**Files modified:** `data/missions.ts`
**Commit:** `a7f8633`
**Applied fix:** Aligned the redundant top-level `grand_city.timeLimitYears: 15` to `20` so it matches the `modifiers.timeLimitYears: 20` override that `tickMissionSystem` (and the probe) actually use — a single authoritative value.

### IN-02 (optional, applied): `buildCodex()` shallow copy shares nested arrays

**Files modified:** `src/sim/campaign.ts`
**Commit:** `acab635`
**Applied fix:** `buildCodex()` now deep-copies the nested arrays (`inputs`/`outputs`/`relatedLinks`/`requirements`/`hints`) so a consumer mutating a `getCodex()` result (e.g. the Phase-18 UI) cannot corrupt the module-level catalog shared by every runner. One-time per runner (cached), so the deep copy is cheap.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-08-05T22:50:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
