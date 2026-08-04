---
phase: 10-finance
plan: 10-w1
wave: 1
subsystem: sim-core
tags: [finance, treasury, ledger, subsidy, loans, overflow, save-replay]
requires:
  - phase: 09-external-trade
    provides: trade revenue/import wiring in the runner, trade-determinism patterns
provides:
  - Treasury instance replacing the bare treasury number in SimRunner (behavior-preserving; getTreasury()/getState().treasury byte-identical)
  - every treasury write routed through categorized addRevenue/addExpense (taxes/wages/trade/other) with the 'overflow' FinCategory
  - runner APIs requestRoyalSubsidy/takeLoan/repayLoan with command enqueue + applyCommand dispatch (save/replay parity)
  - tick-based year rollover (rollYear + subsidy guard reset) and annual loan interest accrual with favor penalty surfaced via getLoanFavorPenalty
  - treasury overflow cap (excess above CONFIG.treasuryOverflowLimit dropped and ledgered as 'overflow')
  - additive accessors getTreasuryLedger/getDebt/getSubsidyUsedThisYear/getFinanceAdvisor and the financeAdvisorFromState pure projection
  - CONFIG.royalSubsidyCap/loanInterestRate/loanMaxAmount/treasuryOverflowLimit added to data/balance.ts
affects: [10-w2, 10-w3]
actuals:
  tokens: 4900
  tasks: 2
  commits: 0
tech-stack:
  added: []
  patterns:
    - "Single write path: every denarius flows through Treasury.addRevenue/addExpense"
    - "Pure projection advisor (financeAdvisorFromState) over injected treasury state"
key-files:
  created:
    - tests/unit/finance-runner.test.ts
  modified:
    - src/sim/runner.ts
    - src/sim/finance.ts
    - src/sim/advisors.ts
    - src/sim/types.ts
    - data/balance.ts
key-decisions:
  - "tickEconomy swap keeps the pre-swap arithmetic: taxes are added to the ledger but wages are paid against the balance BEFORE taxes (paid = wagesDue - wagesUnpaid), then balance is pinned to the tickEconomy result — byte-for-byte parity with the bare-number implementation"
  - "Interest accrues once per year at the tick-based year boundary (tick 360), not per-N-ticks: determinism-friendly and aligned with the rollYear reset"
  - "takeLoan pre-charges amount × rate into outstandingInterest at loan time (existing Treasury semantics); the advisor surfaces the total outstanding interest"
requirements-completed: [FIN-01]
duration: 40min
completed: 2026-08-04
status: complete
---

# Phase 10 Wave 1: Treasury wired into the runner (FIN-01 subsidy/loans/overflow)

**The bare `treasury: number` in SimRunner is now a categorized `Treasury` ledger instance — taxes/wages/trade flow through categorized entries, the royal subsidy and loans are command-replayable runner APIs, interest accrues on the tick-based year boundary, and the treasury is capped at the overflow limit — with `getTreasury()`/goldens byte-identical and 631 tests green.**

## Performance

- **Duration:** 40 min
- **Tasks:** 2 (10-W1-1, 10-W1-2)
- **Files modified:** 5 source/data + 1 test file created

## Accomplishments
- Swapped `private treasury: number` for `private treasuryAccount: Treasury` (src/sim/runner.ts) and rewired every write site: tickEconomyInternal (taxes revenue / wages expense), legacy tickTrade (delta-ledgered under 'trade'), dispatchTradeGood (export proceeds revenue / import spend expense), openTradeRoute and placeBuilding (construction/opening costs under 'other'), canPlace/getState/computeRatings reads. Exact arithmetic preserved: `addExpense` clamps at 0 exactly like the old `treasury -= cost` guarded sites, and tickEconomyInternal pins `balance` to the pure-function result.
- Extended FinCategory with 'overflow'; `subsidyUsedThisYear` made public and `rollYear()` now resets it (once-per-year subsidy, T-10-01).
- New runner APIs with setPolicy-pattern command enqueue + exhaustive `applyCommand` branches (T-10-06): `requestRoyalSubsidy()` (bounded by `royalSubsidyCap` and the 1000-denarii shortfall), `takeLoan(amount)` (validated against `loanMaxAmount`), `repayLoan(amount)`.
- Tick wiring: `tickFinanceRollover()` at tick start (year change → `rollYear` + annual `accrue(CONFIG.loanInterestRate)` with favor penalty stored), `tickFinanceCap()` after trade (excess above `treasuryOverflowLimit` dropped and ledgered as 'overflow', T-10-05).
- Additive accessors: `getTreasuryLedger()`, `getDebt()`, `getSubsidyUsedThisYear()`, `getLoanFavorPenalty()`, `getFinanceAdvisor()` backed by the pure `financeAdvisorFromState(account, arrears, policy)` projection in src/sim/advisors.ts (balance/revenue/expenses/debt/interest/subsidyUsed/arrears/deficit/overflowDroppedThisYear/taxRate/wageRate).
- New balance constants in data/balance.ts (balance-parity test enforced): `royalSubsidyCap: 500`, `loanInterestRate: 0.1`, `loanMaxAmount: 2000`, `treasuryOverflowLimit: 5000`.
- SaveCommand extended with `requestRoyalSubsidy`/`takeLoan`/`repayLoan` kinds; `SimRunner.fromSaveData` replays them (verified byte-identical getStateJson).

## Task Commits
Not committed (per execution instructions — SUMMARY/VERIFICATION files only, no git commit for this run).

## Files Created/Modified
- `src/sim/runner.ts` - Treasury swap, finance tick (rollover + cap), subsidy/loan/repay APIs, accessors, applyCommand branches.
- `src/sim/finance.ts` - 'overflow' category, public subsidyUsedThisYear, rollYear resets the subsidy guard.
- `src/sim/advisors.ts` - TreasuryView/FinanceAdvisorView + financeAdvisorFromState pure projection.
- `src/sim/types.ts` - three new SaveCommand kinds.
- `data/balance.ts` - four finance constants.
- `tests/unit/finance-runner.test.ts` - 9 tests: ledger categories, arrears flag, per-tick ledger invariant, trade revenue, subsidy once/year, loan interest + repay, loan validation, overflow cap, save/replay parity.

## Decisions Made
- tickEconomyInternal adds taxes to the ledger but pays wages against the balance BEFORE taxes, then pins `balance` to the pure `tickEconomy` result — replicating the old `paid = min(wagesDue, treasury)` arithmetic exactly (goldens byte-identical).
- Legacy tickTrade is delta-ledgered (`result.treasury - before` into 'trade') with an explicit balance assignment; imports can never drive the balance negative (already gated by `floor(treasury/price)`), so the ledger stays consistent.
- Interest accrues at the year boundary (tick 360), not on a per-N-tick timer — deterministic and aligned with the rollYear reset.
- `takeLoan` carries the existing Treasury semantics where `amount × rate` is booked into outstandingInterest at loan time; `advisor.interest` reflects the total outstanding.

## Deviations from Plan
- Minor: `financeAdvisorFromState` gained `taxRate`/`wageRate` in the view (policy is injected state — never fabricated) so the `policy` parameter is genuinely consumed rather than unused.
- The plan's W1-1 test item (3) suggested comparing against `tickEconomy` per tick; labor walkers spawn mid-tick (tickSpawns), so a pre-tick snapshot cannot reproduce the runner's pool — replaced with an exact per-tick ledger-invariant assertion (balance equals starting − costs + Σtaxes − Σwages at every tick) plus the byte-identical golden runs.

**Total deviations:** 2 (additive view fields, test-methodology swap).
**Impact on plan:** None — additive surface, all baseline tests green, SimState frozen.

## Issues Encountered
- buildFoodCity's actual construction spend is 420 denarii (runtime BUILDINGS catalog: roads 0, farm 80, market 100, well 40 — differs from data/buildings.ts); test constants were verified empirically via a throwaway probe (removed).
- Lint rejected an unused trailing `policy` param in the plan's projection signature — resolved by deriving the view's taxRate/wageRate from it.

## Next Phase Readiness
Wave 10-W1 complete — 631 tests green (622 baseline + 9 new), typecheck/lint/check:military clean, goldens byte-identical without regeneration, SimState unchanged. Ready for 10-W2 (bankruptcy consequence + finance advisor tests).
