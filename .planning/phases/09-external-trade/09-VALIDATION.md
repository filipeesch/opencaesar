---
phase: 9
slug: external-trade
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` (node env, `tests/**/*.test.ts`) |
| **Quick run command** | `npm run typecheck && npx vitest run <targeted test file>` |
| **Full suite command** | `npm run test` (vitest run — 77 files, 564 tests at baseline) |
| **Estimated runtime** | ~4 seconds (full suite incl. property); <1s (targeted) |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck` + the task's `<automated>` verify command (targeted vitest file and/or the full suite where the task's verify lists it)
- **After every plan wave:** Run `npm run test` + `npm run typecheck` (full suite, golden + determinism + property included)
- **After plan 09-W4:** additionally `npm run check:military` (must stay clean)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~4 seconds (full suite); <1s (targeted)

---

## Success Criteria → Must-Have Automated Checks

| # | Success Criterion (ROADMAP) | Must-have automated check (must W0) | Primary files |
|---|------------------------------|--------------------------------------|---------------|
| SC1 | Opening a route and setting per-good orders affects actual goods movement | `openTradeRoute` debits routeOpeningCost and defaults every good to `no_trade`; `setTradeOrder('pottery', export_above_reserve reserve 2)` physically lowers road-connected warehouse pottery to ≤2 (+in-transit) while a `no_trade` good and a `stockpile` good never change stock; treasury tracks export/import proceeds | `tests/integration/trade-runner.test.ts`, `tests/unit/trade-orders.test.ts` |
| SC2 | Caravans/ships transport loads physically with capacity and berth/road rules | Caravan (cap 8) / ship (cap 16) carry loads only on the walker (source falls on collect, dest rises on deposit; never duplicated/teleported, capacity never exceeded, expired/failed trip restores to source); no-road caravan waits `merchantWaitTicks` then leaves without trading (route stays open); second ship queues at a full berth and unloads only when a berth frees; entrepot never buffers past capacity | `tests/integration/trade-transport.test.ts`, `tests/unit/trade-walkers.test.ts` |
| SC3 | Quotas cap and reset annually; import/export prices differ, track history, and gate transactions | Per-good `usedQuota` vs `annualQuotaPerGood` caps only that good (others keep trading); reset on the tick-based year rollover (`Math.floor(tick/360)`); import price > export price asserted as a data invariant for every commodity; price history/trend advance deterministically; §19.9 transaction gates (exists/reserved/threshold/quota/capacity/treasury/target) verified at model + runner level | `tests/unit/trade-quotas.test.ts`, `tests/unit/trade-prices.test.ts`, `tests/integration/trade-runner.test.ts` |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-W1-1 | 09-PLAN | 1 | TRAD-01, DATA-01 | T-09-00 / — | §19.1 catalog fields + load-time validation engaged | unit + full | `npm run typecheck && npx vitest run tests/unit/trade-catalog.test.ts && npm run test` | ❌ W0 | ⬜ pending |
| 09-W1-2 | 09-PLAN | 1 | TRAD-02, TRAD-05 (gating) | T-09-01 / T-09-04 | order-mode matrix (no_trade/export_all/export_above_reserve/import_upto_target/stockpile) + §19.9 gates; legacy surface untouched | unit + type | `npm run typecheck && npx vitest run tests/unit/trade-orders.test.ts && npx vitest run tests/trade.test.ts` | ❌ W0 | ⬜ pending |
| 09-W2-1 | 09-PLAN | 2 | TRAD-04 | T-09-03 / — | per-good cap suspends only the capped good; deterministic year reset | unit + type | `npm run typecheck && npx vitest run tests/unit/trade-quotas.test.ts && npx vitest run tests/trade.test.ts` | ❌ W0 | ⬜ pending |
| 09-W2-2 | 09-PLAN | 2 | TRAD-05 | T-09-04 / — | base/history/trend/modifier price model; import>export invariant; new BALANCE.trade keys consumed | unit + type | `npm run typecheck && npx vitest run tests/unit/trade-prices.test.ts && npx vitest run tests/trade.test.ts` | ❌ W0 | ⬜ pending |
| 09-W3-1 | 09-PLAN | 3 | TRAD-03 | T-09-02 / — | caravan/ship walker carry + capacity + no-loss; legacy buyer/seller byte-identical | unit + type | `npm run typecheck && npx vitest run tests/unit/trade-walkers.test.ts && npx vitest run tests/unit/transport.test.ts` | ❌ W0 | ⬜ pending |
| 09-W3-2 | 09-PLAN | 3 | TRAD-03 (SC2) | T-09-02 / — | physical entry↔warehouse move, no-road wait then leave, berth queue, entrepot cap | integration + full | `npm run typecheck && npx vitest run tests/integration/trade-transport.test.ts && npm run test` | ❌ W0 | ⬜ pending |
| 09-W4-1 | 09-PLAN | 4 | TRAD-02/04/05 (SC1/SC3) | T-09-01 / T-09-03 / T-09-04 | orders drive real stock movement; per-good quota reset at rollover; enableTrade legacy kept | integration + full | `npm run typecheck && npx vitest run tests/integration/trade-runner.test.ts && npm run test` | ❌ W0 | ⬜ pending |
| 09-W4-2 | 09-PLAN | 4 | TRAD-01-05 (SC1-3 adviser + determinism) | T-09-05 / — | live-derived trade advisor; chunked 1/7/50 identity incl. year rollover; no-RNG/clock source audit; check:military clean | unit + determinism + full | `npm run typecheck && npx vitest run tests/unit/trade-advisor.test.ts && npm run test && npm run check:military` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. `W0` marks the new fixture/test files (created by the task itself); `mod` marks pre-existing files extended in-place by the task.*

---

## Wave 0 Requirements

- [ ] `tests/unit/trade-catalog.test.ts` — created by plan 09-W1 task 1 (§19.1 catalog fields per city + validateCatalogs rejection per corrupted field)
- [ ] `tests/unit/trade-orders.test.ts` — created by plan 09-W1 task 2 (full order-mode matrix + §19.9 export/import gating; legacy surface regression)
- [ ] `tests/unit/trade-quotas.test.ts` — created by plan 09-W2 task 1 (per-good cap + per-good-only suspension + deterministic year reset)
- [ ] `tests/unit/trade-prices.test.ts` — created by plan 09-W2 task 2 (TradePriceState base/history/trend/modifier determinism + import>export invariant + BALANCE.trade keys)
- [ ] `tests/unit/trade-walkers.test.ts` — created by plan 09-W3 task 1 (caravan/ship capacity carry + no-loss + legacy buyer/seller regression, micro-sequence stub)
- [ ] `tests/integration/trade-transport.test.ts` — created by plan 09-W3 task 2 (physical entry↔warehouse move, no-road wait, berth queue, entrepot cap)
- [ ] `tests/integration/trade-runner.test.ts` — created by plan 09-W4 task 1 (SC1+SC3 through the runner: route open, order-driven movement, quota suspension/reset, treasury proceeds, enableTrade legacy)
- [ ] `tests/unit/trade-advisor.test.ts` — created by plan 09-W4 task 2 (pure projection exact numbers + live runner accessor reconciliation)
- [ ] `tests/determinism/trade-determinism.test.ts` — created by plan 09-W4 task 2 (chunked 1/7/50 identity incl. year rollover, seeds {1,7,1337} + no-RNG/clock source audit over trade/transport/walkers/runner)

*Existing files extended in-place (not W0): `data/trade.ts`, `data/validate.ts`, `data/balance.ts` (add-only), `src/sim/trade.ts`, `src/sim/types.ts`, `src/sim/walkers.ts`, `src/sim/walkerProfiles.ts`, `src/sim/runner.ts`, `src/sim/advisors.ts` (all additive only — plan tasks 09-W1-1 … 09-W4-2). `tests/trade.test.ts`, `tests/unit/transport.test.ts`, `tests/integration/supply-chains.test.ts`, `tests/integration/food-slice.test.ts`, `tests/golden/golden.test.ts` and `tests/integration/market-chain.test.ts` are read for regression only (not modified). No framework/fixture/helper install needed — `tests/helpers.ts` `productionChainMap`/`buildProductionCity`, the `getWalkerInternals()` runner-integration pattern, and the food-slice/market-chain walker-stub pattern already exist.*

---

## Manual-Only Verifications

All phase behaviors have automated verification: the §19.1 catalog + load-time
validation, the order-mode matrix and §19.9 transaction gates, per-good quota
suspension + year reset, the base/history/trend price model with the
import>export invariant, caravan/ship physical carry with capacity and no-loss,
the no-road wait-then-leave and berth-queue rules, order-driven movement through
the runner, the live-derived trade advisor, the chunked-tick determinism of the
trade chain (incl. the year-rollover reset), and the no-RNG/clock source audit
are all vitest assertions. The `check:military` gate is a scripted npm command
(plus the vitest military-absence gate) — no manual step.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 4s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
