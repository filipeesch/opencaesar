---
phase: 4
slug: water-system
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` (node env, `tests/**/*.test.ts`) |
| **Quick run command** | `npm run typecheck && npx vitest run tests/unit/water.test.ts tests/unit/advisors.test.ts` |
| **Full suite command** | `npm run test` (vitest run — 52 files, 316 tests) |
| **Estimated runtime** | ~3 seconds (full suite); <1s (quick set) |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck` + the task's `<automated>` verify command (targeted vitest file and/or the full suite where the task's verify lists it)
- **After every plan wave:** Run `npm run test` + `npm run typecheck` (full suite, golden + determinism + property included)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~3 seconds (full suite); <1s (targeted)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 04-01 | 1 | WATR-02 | T-04-01 / — | N/A | unit + type | `npm run typecheck && npx vitest run tests/unit/reservoir.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 04-01 | 1 | WATR-01 | T-04-02 / — | N/A | unit + type | `npm run typecheck && npx vitest run tests/unit/water.test.ts` | ✅ mod | ⬜ pending |
| 04-02-01 | 04-02 | 2 | WATR-03 | T-04-03 / — | N/A | unit + type | `npm run typecheck && npx vitest run tests/unit/aqueduct-flow.test.ts && npx vitest run tests/unit/water.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-02 | 04-02 | 2 | WATR-04 | T-04-04 / — | N/A | unit + type | `npm run typecheck && npx vitest run tests/unit/fountain.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-01 | 04-03 | 3 | WATR-05 | T-04-05 / — | N/A | unit + type | `npm run typecheck && npx vitest run tests/unit/baths.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-02 | 04-03 | 3 | WATR-06 | T-04-06 / — | N/A | unit + type | `npm run typecheck && npx vitest run tests/unit/advisors.test.ts` | ✅ mod | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. `W0` marks the new fixture/test files (created by the task itself); `mod` marks pre-existing files extended in-place by the task.*

---

## Wave 0 Requirements

- [ ] `tests/unit/reservoir.test.ts` — created by plan 04-01 task 1 (ReservoirState: capacity/level/filled/inletConnected/outletToAqueduct)
- [ ] `tests/unit/aqueduct-flow.test.ts` — created by plan 04-02 task 1 (flow propagation: source→chain→fountain, block, repair, road-arch crossing)
- [ ] `tests/unit/fountain.test.ts` — created by plan 04-02 task 2 (network-supplied && staffed gating, go-dark, clean-water radius, desirability)
- [ ] `tests/unit/baths.test.ts` — created by plan 04-03 task 1 (supplied+staffed gating, wellness/desirability wiring, waterConsumed)

*Existing infrastructure covers the rest: `tests/unit/water.test.ts` is extended in-place by 04-01-02 (well desirability) and `tests/unit/advisors.test.ts` by 04-03-02 (water overlay data). No framework, fixture, or helper install needed — the water model is tested with plain objects exactly as today.*

---

## Manual-Only Verifications

All phase behaviors have automated verification: reservoir state, well desirability
penalty, aqueduct flow propagation (source→chain→fountain, block/repair, road-arch
crossing), fountain supplied-and-staffed gating with go-dark, bath worker/water
gating with wellness/desirability and water cost, and the water overlay advisor grids
are all unit tests. The AqueductSystem determinism audit is a source read (no
`Math.random`/`Date` in water.ts) whose conclusion is enforced by the deterministic
flow-propagation tests; no manual step.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
