---
phase: 7
slug: warehouses-logistics
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` (node env, `tests/**/*.test.ts`) |
| **Quick run command** | `npm run typecheck && npx vitest run tests/unit/warehouse-orders.test.ts` |
| **Full suite command** | `npm run test` (vitest run — 63 files, 467 tests at baseline) |
| **Estimated runtime** | ~3.7 seconds (full suite); <1s (quick set) |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck` + the task's `<automated>` verify command (targeted vitest file and/or the full suite where the task's verify lists it)
- **After every plan wave:** Run `npm run test` + `npm run typecheck` (full suite, golden + determinism + property included)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~3.7 seconds (full suite); <1s (targeted)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 07-01 | 1 | WARE-01 | T-07-01 / — | N/A (order matrix) | unit + full | `npm run typecheck && npx vitest run tests/unit/warehouse-orders.test.ts && npm run test` | ❌ W0 | ⬜ pending |
| 07-01-02 | 07-01 | 1 | WARE-01 | T-07-01 / — | N/A (order semantics) | unit + type | `npm run typecheck && npx vitest run tests/unit/warehouse-orders.test.ts && npx vitest run tests/unit/logistics.test.ts` | ✅ mod | ⬜ pending |
| 07-01-03 | 07-01 | 1 | WARE-01 (determinism) | T-07-05 / — | deterministic pool expiry | unit + full | `npm run typecheck && npx vitest run tests/unit/warehouse-reservation.test.ts && npm run test` | ❌ W0 | ⬜ pending |
| 07-02-01 | 07-02 | 2 | WARE-01 | T-07-02 / — | no teleport (road-delivered) | integration + type | `npm run typecheck && npx vitest run tests/integration/warehouse-runner.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-02 | 07-02 | 2 | WARE-02 | T-07-03 / — | fallback-with-warning, no discard | unit + type | `npm run typecheck && npx vitest run tests/unit/commercial-center.test.ts && npx vitest run tests/unit/logistics.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-01 | 07-03 | 3 | WARE-03 | T-07-04 / — | live-derived advisor (never fabricated) | unit + type | `npm run typecheck && npx vitest run tests/unit/logistics-advisor.test.ts && npx vitest run tests/unit/advisors.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-02 | 07-03 | 3 | WARE-01 (determinism) | T-07-05 / — | chunked-tick identity | determinism + full | `npm run typecheck && npx vitest run tests/determinism/warehouse-logistics-determinism.test.ts && npm run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. `W0` marks the new fixture/test files (created by the task itself); `mod` marks pre-existing files extended in-place by the task.*

---

## Wave 0 Requirements

- [ ] `tests/unit/warehouse-orders.test.ts` — created by plan 07-01 task 1 (per-mode order matrix: accept/refuse/request/maintain/empty/reserve + slot gating); extended by task 2 (maintain target / reserve gate / need helpers)
- [ ] `tests/unit/warehouse-reservation.test.ts` — created by plan 07-01 task 3 (ReservationPool tick-based expiry determinism)
- [ ] `tests/integration/warehouse-runner.test.ts` — created by plan 07-02 task 1 (road-reachable transfer: disconnected warehouse receives nothing, connected → stock rises)
- [ ] `tests/unit/commercial-center.test.ts` — created by plan 07-02 task 2 (exclusivity + fallback-on-full with alternative warehouse + warning + no-discard)
- [ ] `tests/unit/logistics-advisor.test.ts` — created by plan 07-03 task 1 (live getLogisticsAdvisor(): stock/production/consumption/in-transit/bottlenecks/stopped derived from a real runner)
- [ ] `tests/determinism/warehouse-logistics-determinism.test.ts` — created by plan 07-03 task 2 (chunked 1/7/50 same-seed identity for the warehouse chain + ReservationPool expiry)

*Existing files extended in-place (not W0): `src/sim/logistics.ts`, `src/sim/runner.ts`, `src/sim/advisors.ts` (each task's source file), and `tests/unit/logistics.test.ts` is only read for regression (not modified). No framework, fixture, or helper install needed — tests/helpers.ts `productionChainMap`/`buildProductionCity` already exist.*

---

## Manual-Only Verifications

All phase behaviors have automated verification: the per-mode order matrix, the
maintain/reserve semantic surface, the road-reachable warehouse transfer
(disconnected warehouse receives nothing), the Commercial Center
fallback-on-full with warning and no-discard, the live-derived logistics advisor
aggregates, and the chunked-tick determinism of the warehouse/logistics chain are
all vitest assertions. The RNG/clock-free audit of `src/sim/logistics.ts` is a
source read whose conclusion is enforced by the determinism test; no manual step.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3.7s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
