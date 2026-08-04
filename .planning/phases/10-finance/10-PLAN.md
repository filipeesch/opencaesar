---
phase: 10-finance
plan: 10-plan
type: feature (multi-wave: 10-W1..10-W3)
wave: 0
depends_on: [09-W4]
files_modified:
  - src/sim/runner.ts
  - src/sim/types.ts
  - src/sim/finance.ts
  - src/sim/config.ts
  - src/sim/housing.ts
  - src/sim/advisors.ts
  - tests/unit/finance-runner.test.ts
  - tests/unit/finance-advisor.test.ts
  - tests/integration/bankruptcy.test.ts
  - tests/determinism/finance-determinism.test.ts
autonomous: true
requirements: [FIN-01]
must_haves:
  truths:
    - "FIN-01 wages/taxes: tickEconomy already collects taxes and pays wages with the treasury never below zero and wagesUnpaid tracked; the swap to the Treasury class preserves this arithmetic byte-for-byte (regression: same values as the bare-number implementation)."
    - "FIN-01 trade revenue: existing runner trade wiring (export proceeds, import spend) is preserved and lands in the 'trade' ledger category through addRevenue/addExpense."
    - "FIN-01 royal subsidy: requestRoyalSubsidy grants a bounded amount once per year (Treasury.subsidyUsedThisYear guard + rollYear reset at the tick-based year); a second request in the same year is refused (T-10-01)."
    - "FIN-01 loans/interest: takeLoan/repayLoan wire Treasury loan state; interest accrues on a tick-based schedule only (no clock/RNG), deterministically (T-10-02); the favor penalty is surfaced via the finance advisor."
    - "Treasury overflow: balance never exceeds CONFIG.treasuryOverflowLimit — excess is dropped and ledgered as 'overflow', discouraging hoarding (T-10-05)."
    - "SC2 visible consequence: persistent unpaid wages produce arrears (finance advisor flag) and a housing tier downgrade via the existing desirabilityUnpaidWagesPenalty; recovery clears the penalty and the house can re-evolve — proven end-to-end by bankruptcy.test.ts."
    - "Finance advisor is a pure live-derived projection of runner/Treasury state (balance, category revenue/expenses, debt, interest, subsidyUsedThisYear, arrears, deficit, overflow) — never fabricated; SimState stays frozen so goldens never regenerate."
    - "Determinism & no military: finance chain is tick-based/seeded only (chunked 1/7/50 identity); the no-RNG/clock source audit is green for finance/economy; check:military stays clean."
  artifacts:
    - path: src/sim/runner.ts
      provides: "Treasury instance replacing the bare treasury number (behavior-preserving), requestRoyalSubsidy/takeLoan/repayLoan APIs with command enqueue, tick-based interest accrual, overflow cap, getFinanceAdvisor accessor"
      min_lines: 30
    - path: src/sim/advisors.ts
      provides: "financeAdvisorFromState pure projection + FinanceAdvisorView type"
      min_lines: 40
    - path: src/sim/config.ts
      provides: "royalSubsidyCap, loanInterestRate, loanMaxAmount, treasuryOverflowLimit constants"
      min_lines: 4
    - path: src/sim/housing.ts
      provides: "additive arrears-depth desirability penalty (existing wagesUnpaid penalty preserved)"
      min_lines: 5
    - path: tests/unit/finance-runner.test.ts
      provides: "runner treasury wiring, subsidy once-per-year, loan interest, overflow cap, save/replay parity"
      min_lines: 100
    - path: tests/unit/finance-advisor.test.ts
      provides: "pure projection + live accessor reconciliation tests"
      min_lines: 40
    - path: tests/integration/bankruptcy.test.ts
      provides: "SC2 end-to-end: arrears flag + housing downgrade + recovery"
      min_lines: 40
    - path: tests/determinism/finance-determinism.test.ts
      provides: "chunked 1/7/50 identity across seeds {1,7,1337} + no-RNG/clock source audit"
      min_lines: 40
---

# Phase 10 Plan: Finance

**Goal**: Complete treasury model with wages, taxes, trade revenue, subsidy, loans.
**Phase**: 10-finance
**Requirements**: FIN-01

## Requirements Mapping

| Requirement | Implementation | Where |
|-------------|---------------|-------|
| FIN-01 wages | `tickEconomy` already collects taxes + pays wages, treasury never below 0, `wagesUnpaid` tracked | `src/sim/economy.ts`, `src/sim/runner.ts` tickEconomyInternal — EXISTING |
| FIN-01 taxes | `taxCollected`/tickEconomy tax income by house tier × taxRate | `src/sim/economy.ts` — EXISTING |
| FIN-01 trade revenue | Runner trade wiring adds export proceeds / subtracts import spend | `src/sim/runner.ts` trade paths — EXISTING |
| FIN-01 royal subsidy request | `Treasury.requestSubsidy` exists but NOT wired to runner | gap-fill: runner API `requestRoyalSubsidy()` |
| FIN-01 loans/interest | `Treasury.takeLoan/accrue/repayLoan` exist but NOT wired to runner | gap-fill: runner APIs `takeLoan(amount)`/`repayLoan(amount)` + per-period interest accrual |
| FIN-01 treasury overflow | C3-style cap: treasury above a limit loses excess (discourage hoarding) | gap-fill: overflow cap in runner finance tick |
| SC2 visible consequence | `wagesUnpaid` → `desirabilityUnpaidWagesPenalty` → housing downgrade — EXISTS via `desirabilityOf` | `src/sim/housing.ts` — EXISTING |

## Audit Result (verify-as-built)

Already works and stays untouched:
- `tickEconomy` (taxes + wages, treasury clamp at 0, wagesUnpaid) — tests/unit/economy.test.ts
- `Treasury` class ledger/subsidy/loans/interest — tests/unit/finance.test.ts
- Trade revenue wiring in runner
- Housing downgrade from unpaid wages (SC2)

Gap-fill (the actual work):
- Wire `Treasury` into the runner (swap bare `treasury: number` for the class, keeping `getTreasury()` behavior identical)
- Runner APIs: `requestRoyalSubsidy()`, `takeLoan()`, `repayLoan()`
- Per-period loan interest accrual wired into the tick (seeded/deterministic, no clock)
- Treasury overflow cap (excess above `CONFIG.treasuryOverflowLimit` lost)
- Finance advisor live surface (balance, revenue/expense categories, debt, subsidy used this year, arrears)

## Verification Approach

- Wave-level: `npm run test` green (baseline 622 + new tests) after each wave
- Full: `npm run typecheck && npm run test && npm run check:military`
- Determinism: chunked 1/7/50 finance determinism test; no Math.random/Date.now
- Goldens: `SimState` shape unchanged (additive accessors only) → golden fixtures green without regeneration

---

# Wave 10-W1 — Wire Treasury into the runner (FIN-01 subsidy/loans/overflow)

<tasks>

<task type="auto">
  <name>10-W1-1: Replace runner bare treasury with the Treasury class (additive, behavior-preserving)</name>
  <files>src/sim/runner.ts, src/sim/types.ts, tests/unit/finance-runner.test.ts</files>
  <read_first>src/sim/runner.ts (treasury field 135, init 182, tickEconomyInternal 1232-1237, getTreasury 996-998, trade treasury writes 285-286/515/541-547/593-598, placeBuilding cost 826-837, getState treasury 797), src/sim/finance.ts (Treasury class full), src/sim/economy.ts (tickEconomy), src/sim/types.ts (SimState treasury field), tests/unit/finance.test.ts</read_first>
  <action>Read the runner treasury usages before editing. The runner uses `private treasury: number` written/read in many places (trade, building costs, tickEconomy, getState). Replace with `private treasuryAccount = new Treasury(CONFIG.startingTreasury)` — additive internal swap:
  (1) Keep `getTreasury()` returning the same number (`this.treasuryAccount.balance`); keep `getState().treasury` identical; keep `setPolicy`/tickEconomy behavior byte-identical for existing tests and goldens. Use `this.treasuryAccount.addRevenue/addExpense` at each existing write site (trade proceeds, import spend, building costs, taxes, wages) — preserving exact arithmetic: treasury never below 0 via addExpense clamp; trade/building cost writes must behave exactly as before (check the current `this.treasury -= cost` sites: placeBuilding already guards affordability; trade spend already guards).
  (2) Additive accessors on the runner: `getTreasuryLedger(): FinanceLedger`, `getDebt(): number`, `getSubsidyUsedThisYear(): number`, `getFinanceAdvisor(): FinanceAdvisorView` (see 10-W3).
  (3) `getState()` shape unchanged; `getStateJson()` unchanged — goldens stay byte-identical. Do NOT add treasury fields to SimState.
  Create tests/unit/finance-runner.test.ts: (1) after building a house + tick, taxes land in the revenue ledger under 'taxes' and wages under 'wages' expenses; (2) a poor city's unpaid wages are tracked via getFinanceAdvisor().arrears / lastWagesUnpaid; (3) getTreasury() returns exactly the balance after a known sequence (place building + tax income) matching the pre-swap arithmetic (regression: same value as the bare-number implementation); (4) trade export proceeds appear under 'trade' revenue after the trade path runs; (5) all baseline finance/economy tests still pass.</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/finance-runner.test.ts tests/unit/finance.test.ts tests/unit/economy.test.ts && npm run test</automated>
  </verify>
  <done>finance-runner.test.ts passes: the runner treasury is now a Treasury instance, getTreasury() returns identical values to before (existing finance/economy tests green), taxes/wages/trade land in categorized ledgers, and the full 622-test suite + goldens stay green with SimState unchanged.</done>
</task>

<task type="auto">
  <name>10-W1-2: Royal subsidy request + loans/interest wired to the tick (FIN-01)</name>
  <files>src/sim/runner.ts, src/sim/config.ts, src/sim/types.ts, tests/unit/finance-runner.test.ts</files>
  <read_first>src/sim/runner.ts (tick order 201-245, tickEconomyInternal 1232, command enqueue pattern setPolicy 930-941, saveCommands 941, getSaveData 1092-1106, applyCommand 1654), src/sim/finance.ts (requestSubsidy/takeLoan/accrue/repayLoan), src/sim/config.ts (add treasury constants)</read_first>
  <action>Read the command pattern (setPolicy) before editing. Additive APIs on the runner, all deterministic (no clock/RNG):
  (1) `requestRoyalSubsidy(): { ok: boolean; grant: number }` — calls `this.treasuryAccount.requestSubsidy(CONFIG.royalSubsidyCap)`; once per year (the Treasury's `subsidyUsedThisYear` guard + reset at year rollover via `rollYear` — wire `rollYear(this.treasuryAccount)` into the year boundary in tickTradeSystem or tick). Command enqueued for save/replay parity like setPolicy.
  (2) `takeLoan(amount): { ok: boolean; received: number; error?: string }` and `repayLoan(amount): { ok: boolean; repaid: number }` — thin wrappers over Treasury.takeLoan/repayLoan with command enqueue.
  (3) Interest accrual: in the tick (per N ticks, e.g. every 120 ticks or at year boundary), call `this.treasuryAccount.accrue(CONFIG.loanInterestRate)` and apply the returned favorPenalty to the favor rating path if one exists (additive: expose `getLoanFavorPenalty()` and feed it into ratings computation only if there is an existing favor seam; otherwise log to the finance advisor as `loanInterestAccrued`). Deterministic tick-based schedule.
  (4) `CONFIG.royalSubsidyCap`, `CONFIG.loanInterestRate`, `CONFIG.loanMaxAmount`, `CONFIG.treasuryOverflowLimit` added to src/sim/config.ts (validate against existing config test conventions).
  (5) Treasury overflow: in the finance tick, if `balance > CONFIG.treasuryOverflowLimit`, the excess is dropped (C3 anti-hoarding) and recorded in the ledger as expense 'other' overflow (or a new `overflow` category if FinCategory can be extended additively — check whether FinCategory is a plain union; extending a union is additive unless there are exhaustive switches, check first).
  Extend tests/unit/finance-runner.test.ts: (6) requestRoyalSubsidy grants a bounded amount when treasury is low, and refuses a second grant in the same year; (7) takeLoan increases treasury + debt; after enough ticks the accrued interest appears in the ledger; repayLoan reduces debt; (8) overflow: with a huge trade income the balance never exceeds CONFIG.treasuryOverflowLimit; (9) save/replay: subsidy/loan commands replay identically from SaveData (same seed → same state).</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/finance-runner.test.ts && npm run test</automated>
  </verify>
  <done>finance-runner.test.ts passes: royal subsidy works once per year, loans accrue interest and are repayable, treasury never exceeds the overflow limit (excess dropped and ledgered), subsidy/loan commands replay identically from SaveData, and the full suite + goldens stay green.</done>
</task>

</tasks>

---

# Wave 10-W2 — Bankruptcy consequence + finance advisor (SC2)

<tasks>

<task type="auto">
  <name>10-W2-1: Visible bankruptcy consequence — wage arrears severity + housing downgrade evidence (SC2)</name>
  <files>src/sim/housing.ts, src/sim/config.ts, tests/unit/housing.test.ts, tests/integration/bankruptcy.test.ts</files>
  <read_first>src/sim/housing.ts (desirabilityOf 18-62, wagesUnpaid penalty 48, tierThreshold 65), src/sim/config.ts (desirabilityUnpaidWagesPenalty, desirabilityThresholdPerTier), tests/unit/housing.test.ts (existing penalty tests), tests/helpers (buildFoodCity/buildProductionCity)</read_first>
  <action>Read housing desirability + config before editing. SC2 evidence — the unpaid-wages penalty exists; make it a *severity* gradient and prove the downgrade end-to-end:
  (1) If not already a gradient: make the unpaid-wages desirability penalty scale with arrears depth (e.g., `desirabilityUnpaidWagesPenalty * (1 + arrearsYears)` or threshold tiers) — additive to CONFIG; keep the existing single-value penalty behavior when arrears are ≤ 1 period so baseline housing tests stay green (check how desirabilityOf receives wagesUnpaid — currently a boolean; if boolean, either keep boolean for compatibility and add a separate `wagesArrears` depth factor additive field in the services/options object, defaulting to existing behavior).
  (2) Create tests/integration/bankruptcy.test.ts: (a) a city with wages that cannot be paid for many ticks has `wagesUnpaid > 0` and the finance advisor reports arrears; (b) houses with persistent unpaid wages downgrade a tier (desirability below the current tier threshold) — assert a house tier drops after sustained arrears, using the real runner tick loop (build a city with a house, zero treasury, jobs without tax income — e.g. place a workshop/warehouse needing workers but with taxRate 0 and wageRate 1); (c) when the treasury recovers and wages are paid, the desirability penalty clears and the house can re-evolve.
  (3) All existing housing tests stay green; `check:military` clean.</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/integration/bankruptcy.test.ts tests/unit/housing.test.ts && npm run test</automated>
  </verify>
  <done>bankruptcy.test.ts passes proving SC2: persistent unpaid wages produce arrears in the finance advisor and a visible housing tier downgrade, and recovery clears the penalty; the full suite + goldens stay green.</done>
</task>

<task type="auto">
  <name>10-W2-2: Finance advisor live surface (FIN-01, decision live-derived)</name>
  <files>src/sim/advisors.ts, src/sim/runner.ts, tests/unit/finance-advisor.test.ts</files>
  <read_first>src/sim/advisors.ts (SimSnapshot 19-37, advisorsFrom 53-69, logisticsAdvisorFromState pattern, tradeAdvisorFromState 726-786), src/sim/runner.ts (getLogisticsAdvisor 358-360, getTradeAdvisor 729-731)</read_first>
  <action>Read the advisor patterns before writing. Additive:
  (1) src/sim/advisors.ts — add exported pure projection `financeAdvisorFromState(account: TreasuryView, arrears: number, policy: Policy): FinanceAdvisorView` where `TreasuryView = { balance: number; revenue: FinanceLedger['revenue']; expenses: FinanceLedger['expenses']; debt: number; outstandingInterest: number; subsidyUsedThisYear: number }` and `FinanceAdvisorView = { balance; revenue; expenses; debt; interest; subsidyUsedThisYear; arrears: boolean; deficit: number (monthlyChange projection); overflowDroppedThisYear: number }` — every number derived from the injected state, never fabricated.
  (2) src/sim/runner.ts — `getFinanceAdvisor(): FinanceAdvisorView` delegating to `financeAdvisorFromState(...)` with a serializable TreasuryView projection of `this.treasuryAccount` + `this.lastWagesUnpaid` + policy. Additive accessor.
  (3) Create tests/unit/finance-advisor.test.ts: (a) pure projection on a hand-built TreasuryView returns exact balance/revenue/expenses/debt/interest/subsidyUsed/arrears/deficit; (b) live accessor on a real runner after taxes+wages+subsidy+loan reconciles balance, category ledgers, debt, subsidyUsedThisYear, arrears flag; (c) deficit matches monthlyChange(); (d) overflow dropped amount is surfaced (0 when under the cap).</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/finance-advisor.test.ts && npm run test</automated>
  </verify>
  <done>finance-advisor.test.ts passes: the finance advisor projection returns exact live-derived values (balance/categories/debt/interest/subsidy/arrears/deficit/overflow), the runner accessor reconciles against real state, and the full suite + goldens stay green.</done>
</task>

</tasks>

---

# Wave 10-W3 — Determinism + full verification (FIN-01/SC1/SC2)

<tasks>

<task type="auto">
  <name>10-W3-1: Finance chunked determinism + RNG/clock audit</name>
  <files>tests/determinism/finance-determinism.test.ts</files>
  <read_first>tests/determinism/market-chain-determinism.test.ts (chunked pattern 26-62, source audit 177-187), tests/determinism/trade-determinism.test.ts</read_first>
  <action>Read the determinism test patterns before writing. Create tests/determinism/finance-determinism.test.ts:
  (1) chunked identity — same seed + same commands (setPolicy + place house + requestRoyalSubsidy + takeLoan + ticks) produce byte-identical `getStateJson()` for chunk sizes 1/7/50 over a production-style map (buildProductionCity) for seeds {1, 7, 1337}; (2) same-seed run twice → identical JSON; (3) different seeds runnable without crashing; (4) source audit — src/sim/finance.ts, src/sim/economy.ts and the runner's finance tick contain no Math.random()/Date.now()/new Date() invocations (file-read regex pattern; exclude runner.ts Date.now savedAt with the same scoping note as trade-determinism).</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/determinism/finance-determinism.test.ts && npm run test && npm run check:military</automated>
  </verify>
  <done>finance-determinism.test.ts passes: the finance chain reproduces byte-identical getStateJson under chunks 1/7/50 across seeds {1,7,1337}, same-seed identity holds, the no-RNG/clock source audit is green for finance/economy, and check:military is clean; full suite green.</done>
</task>

</tasks>

---

## Threat Model

| Threat ID | Category | Component | Severity | Disposition | Mitigation |
|-----------|----------|-----------|----------|-------------|------------|
| T-10-01 | Tampering | Subsidy double-claim in one year | high | mitigate | Treasury.subsidyUsedThisYear guard + once-per-year reset via rollYear; test (W1-2 #6) |
| T-10-02 | Tampering | Loan interest accrual non-deterministic | high | mitigate | Tick-based accrual schedule only (no clock/RNG); chunked determinism test (W3-1) |
| T-10-03 | Repudiation | Treasury double-count (same denarii in two categories) | high | mitigate | Every write goes through a single addRevenue/addExpense path; ledger reconciliation in W1-1 tests |
| T-10-04 | Repudiation | Balance below zero via unchecked spend | high | mitigate | addExpense clamp at 0 (existing) + affordability guards on trade/building spend preserved; regression tests |
| T-10-05 | Tampering | Overflow cap bypass (hoarding beyond limit) | medium | mitigate | Overflow drop in finance tick + ledgered 'overflow' expense; test (W1-2 #8) |
| T-10-06 | Tampering | Save/replay desync of subsidy/loan commands | high | mitigate | Command enqueue for every finance API (setPolicy pattern); replay test (W1-2 #9) |
| T-10-07 | Privacy | none (pure model) | low | accept | Finance advisor is a pure projection of runner state |

## Verification

- `npm run test` (full suite, golden + determinism + property included) and `npm run typecheck` after every wave; `npm run check:military` after 10-W3.
- Per-wave spot-checks:
  - 10-W1: `npx vitest run tests/unit/finance-runner.test.ts tests/unit/finance.test.ts tests/unit/economy.test.ts`
  - 10-W2: `tests/integration/bankruptcy.test.ts` + `tests/unit/housing.test.ts` + `tests/unit/finance-advisor.test.ts`
  - 10-W3: `tests/determinism/finance-determinism.test.ts`; confirm `tests/golden/golden.test.ts` and `tests/integration/food-slice.test.ts` green WITHOUT golden regeneration.

## Success Criteria

- Treasury reflects wages, taxes, trade revenue, subsidy requests, and loan interest through the runner (SC1) — every category visible in the finance advisor.
- Running out of money has a visible consequence: wage arrears → desirability penalty → housing downgrade (SC2), proven by bankruptcy.test.ts.
- Subsidy once per year; loans accrue tick-based interest; treasury overflow capped; all deterministic.
- Finance advisor live-derived; SimState frozen; goldens green without regeneration; no military tokens; 622 baseline + additions green; typecheck clean.

## Output

Create `.planning/phases/10-finance/10-SUMMARY.md` when done.
