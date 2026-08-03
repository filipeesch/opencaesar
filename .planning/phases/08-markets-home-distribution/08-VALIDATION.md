---
phase: 8
slug: markets-home-distribution
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` (node env, `tests/**/*.test.ts`) |
| **Quick run command** | `npm run typecheck && npx vitest run <targeted test file>` |
| **Full suite command** | `npm run test` (vitest run — 69 files, 506 tests at baseline) |
| **Estimated runtime** | ~4 seconds (full suite incl. property); <1s (targeted) |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck` + the task's `<automated>` verify command (targeted vitest file and/or the full suite where the task's verify lists it)
- **After every plan wave:** Run `npm run test` + `npm run typecheck` (full suite, golden + determinism + property included)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~4 seconds (full suite); <1s (targeted)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 08-01 | 1 | MARK-02 | T-08-01 / — | per-config matrix (accept/refuse, wine block, radius) | unit + full | `npm run typecheck && npx vitest run tests/unit/market-config.test.ts && npm run test` | ❌ W0 | ⬜ pending |
| 08-01-02 | 08-01 | 1 | MARK-01 | T-08-02 / — | no double-pick (reservation holds during transit) | unit + full | `npm run typecheck && npx vitest run tests/unit/market-reservation.test.ts && npm run test` | ❌ W0 | ⬜ pending |
| 08-01-03 | 08-01 | 1 | MARK-03 | T-08-03 / — | distribution priority matrix (5 policies + load order) | unit + type | `npm run typecheck && npx vitest run tests/unit/market-distribution.test.ts && npx vitest run tests/unit/logistics.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-01 | 08-02 | 2 | MARK-02 | T-08-01 / — | config stored per-market + additive surface (targetStock/preferredSupplier) | unit + full | `npm run typecheck && npx vitest run tests/unit/market-config-surface.test.ts && npm run test` | ❌ W0 | ⬜ pending |
| 08-02-02 | 08-02 | 2 | MARK-02 | T-08-01 / — | config honored at runtime only when set (radius/refuse/target) | unit + type | `npm run typecheck && npx vitest run tests/unit/market-buyer-config.test.ts && npx vitest run tests/unit/market-config-surface.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-03 | 08-02 | 2 | MARK-01 | T-08-02 / — | buyer→market→seller→house chain through runner state | integration + full | `npm run typecheck && npx vitest run tests/integration/market-chain.test.ts && npm run test` | ❌ W0 | ⬜ pending |
| 08-03-01 | 08-03 | 3 | MARK-03 | T-08-03 / — | composed distribution priority (essential→evolution-blocking) via config | integration + type | `npm run typecheck && npx vitest run tests/integration/market-distribution-priority.test.ts && npx vitest run tests/unit/market-distribution.test.ts` | ❌ W0 | ⬜ pending |
| 08-03-02 | 08-03 | 3 | MARK-01/02/03 | T-08-02 / T-08-03 | chunked-tick determinism of the market chain | determinism + full | `npm run typecheck && npx vitest run tests/determinism/market-chain-determinism.test.ts && npm run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. `W0` marks the new fixture/test files (created by the task itself); `mod` marks pre-existing files extended in-place by the task.*

---

## Wave 0 Requirements

- [ ] `tests/unit/market-config.test.ts` — created by plan 08-01 task 1 (per-market config behavior matrix: per-product accept/refuse incl. resident-class interplay, block-wine toggle, radius boundary, priority)
- [ ] `tests/unit/market-reservation.test.ts` — created by plan 08-01 task 2 (no-double-pick: two buyers contending for one load at model + walker level; reservation holds during transit; restore-on-failure)
- [ ] `tests/unit/market-distribution.test.ts` — created by plan 08-01 task 3 (full 5-policy `policyOrder` matrix + `sellerLoadComposition` priority + `nextPickPriority` essential→evolution-blocking)
- [ ] `tests/unit/market-config-surface.test.ts` — created by plan 08-02 task 1 (additive `marketNeedsRestock`/preferred-supplier `findSupplier` + runner per-market registry setMarketConfig/marketConfig storage)
- [ ] `tests/unit/market-buyer-config.test.ts` — created by plan 08-02 task 2 (config honored at runtime via SimInternals.marketConfig: radius narrows supplier search, refused product stops handling, target stock changes restock)
- [ ] `tests/integration/market-chain.test.ts` — created by plan 08-02 task 3 (buyer→market→seller→house chain driven against a runner-built SimInternals + runner state assertions)
- [ ] `tests/integration/market-distribution-priority.test.ts` — created by plan 08-03 task 1 (composed distribution priority: essential food then evolution-blocking good via `marketLoadComposition` + config; policy ordering over a realistic market state)
- [ ] `tests/determinism/market-chain-determinism.test.ts` — created by plan 08-03 task 2 (chunked 1/7/50 same-seed identity for the market chain incl. per-market config)

*Existing files extended in-place (not W0): `src/sim/logistics.ts`, `src/sim/runner.ts`, `src/sim/walkers.ts` (additive only — plan 08-02/08-03 tasks). `tests/unit/logistics.test.ts` is only read for regression (not modified). No framework/fixture/helper install needed — `tests/helpers.ts` `foodChainMap`/`buildFoodCity` and the `food-slice.test.ts` walker-stub pattern (`createWalker`/`updateWalker`) already exist.*

---

## Manual-Only Verifications

All phase behaviors have automated verification: the per-market config behavior
matrix, the two-buyer no-double-pick contention (model + walker), the full
5-policy distribution-priority matrix, the runner per-market config storage and
runtime honoring (only when explicitly set), the buyer→market→seller→house
integration chain against runner state, the composed essential-food-then-
evolution-blocking load ordering, and the chunked-tick determinism of the market
chain are all vitest assertions. The RNG/clock-free audit of the market model is
a source read whose conclusion is enforced by the determinism test; no manual
step.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 4s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
