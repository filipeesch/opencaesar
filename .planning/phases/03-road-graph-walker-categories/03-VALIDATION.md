---
phase: 3
slug: road-graph-walker-categories
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` (node env, `tests/**/*.test.ts`) |
| **Quick run command** | `npm run typecheck && npx vitest run tests/unit/<target>.test.ts` |
| **Full suite command** | `npm run test` (vitest run — 46 files, 289 tests) |
| **Estimated runtime** | ~2.6s (full suite); <1s (quick set) |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck` + the task's targeted `<automated>` vitest command
- **After every plan wave:** Run `npm run test` + `npm run typecheck` (full suite, golden + determinism + property invariants)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~3 seconds (the ROAD-02 golden regeneration adds <1s and runs once, inside plan 03-02)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 03-01 | 1 | ROAD-01 | T-03-01 / — | N/A | unit + type | `npm run typecheck && npx vitest run tests/unit/roadnet.test.ts` | ✅ mod | ⬜ pending |
| 03-01-02 | 03-01 | 1 | ROAD-01 | T-03-01 / T-03-02 | N/A | unit + type | `npm run typecheck && npx vitest run tests/unit/roadnet.test.ts && npm run test` | ✅ mod | ⬜ pending |
| 03-02-01 | 03-02 | 2 | ROAD-02 | T-03-03 / — | N/A | unit + type | `npm run typecheck && npx vitest run tests/unit/road-type-wiring.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 03-02 | 2 | ROAD-02 | T-03-04 / — | N/A | unit + golden + type | `npm run typecheck && npx vitest run tests/unit/road-type-effects.test.ts && npx vitest run tests/unit/road-types.test.ts && GOLDEN_UPDATE=1 npm run test:golden:update && npm run test` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03-03 | 3 | ROAD-03 | T-03-05 / — | N/A | unit + type | `npm run typecheck && npx vitest run tests/unit/walker-profile-contract.test.ts && npx vitest run tests/unit/walker-profiles.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03-03 | 3 | ROAD-03 | T-03-06 / — | N/A | unit + type | `npm run typecheck && npx vitest run tests/unit/walker-category-behavior.test.ts && npx vitest run tests/unit/walkers.test.ts && npx vitest run tests/property/invariants.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03-03 | 3 | ROAD-03 | T-03-07 / — | N/A | unit + type | `npm run typecheck && npx vitest run tests/unit/walker-roadblock-permissions.test.ts && npx vitest run tests/unit/walkers.test.ts && npx vitest run tests/property/invariants.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. `W0` marks the new fixture/test files (created by the task itself); `mod` marks pre-existing files modified in-place by the task.*

---

## Wave 0 Requirements

- [ ] `tests/unit/road-type-wiring.test.ts` — created by plan 03-02 task 1 (Map/TileState roadType plumbing + SimRunner.getTileState exposure)
- [ ] `tests/unit/road-type-effects.test.ts` — created by plan 03-02 task 2 (speed multiplier + adjacent-road desirability)
- [ ] `tests/unit/walker-profile-contract.test.ts` — created by plan 03-03 task 1 (9-field schema contract for every catalog walker)
- [ ] `tests/unit/walker-category-behavior.test.ts` — created by plan 03-03 task 2 (movementSpeed, serviceTTL, wandering return-at-maxRoadSteps)
- [ ] `tests/unit/walker-roadblock-permissions.test.ts` — created by plan 03-03 task 3 (per-category roadblock policy + graph-path confirmation)

*Existing infrastructure (vitest, `tests/helpers.ts`, the stub-`SimInternals` pattern in `tests/unit/walkers.test.ts`, roadnet/road-types/walker-profiles suites, golden + property suite) covers the rest. `tests/unit/roadnet.test.ts` is extended in-place by plan 03-01.*
*Note: walker-profile-contract, walker-category-behavior, and walker-roadblock-permissions are three separate files because each is created and verified by its own task (per-task Wave-0 ownership).*

---

## Manual-Only Verifications

All phase behaviors have automated verification: roadNet connectivity/dirty-region correctness is unit-tested; road-type speed/desirability effects are tested through stubbed `SimInternals`; walker category behavior (return-at-max-steps, per-type speed, serviceTTL), the profile contract, per-category roadblock permissions, and the graph-path (no-Euclidean-fallback) property are all unit tests. The single golden regeneration is automated (`GOLDEN_UPDATE=1 npm run test:golden:update`) and deliberate (documented ROAD-02 desirability mechanic change).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
