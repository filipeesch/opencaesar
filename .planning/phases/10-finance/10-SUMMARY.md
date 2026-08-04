# Phase 10 Summary: Finance

## Overview

Wired the existing `Treasury` class into the live runner and completed the
finance model: categorized revenue/expenses, royal subsidy requests, loans with
interest, treasury overflow cap, and the visible bankruptcy consequence (wage
arrears → desirability penalty → housing downgrade). Finance advisor surfaces
every number live-derived from runner state.

### Accomplishments

- **FIN-01 wages/taxes**: `tickEconomy` (taxes + wages, treasury never below 0,
  `wagesUnpaid`) preserved byte-for-byte; the runner now holds a `Treasury`
  instance and every write goes through `addRevenue`/`addExpense` so the
  categorized ledger reflects taxes, wages, and trade revenue.
- **FIN-01 royal subsidy**: `requestRoyalSubsidy()` grants a bounded amount once
  per year (`Treasury.subsidyUsedThisYear` guard + `rollYear` reset at the
  tick-based year boundary); command-enqueued for save/replay parity.
- **FIN-01 loans/interest**: `takeLoan()`/`repayLoan()` wire Treasury loan state;
  interest accrues at the year rollover (tick 360) deterministically; the favor
  penalty is surfaced via `getLoanFavorPenalty()`.
- **FIN-01 treasury overflow**: `tickFinanceCap` drops the balance above
  `CONFIG.treasuryOverflowLimit` and ledgeres it as `overflow` (anti-hoarding).
- **SC2 visible consequence**: sustained unpaid wages deepen the desirability
  penalty (`desirabilityUnpaidWagesPenalty × (1 + arrearsDepth)`), pushing
  desirability below the tier threshold → housing downgrade; recovery clears
  arrears and the house re-evolves. Proven end-to-end by bankruptcy.test.ts.
- **Finance advisor**: pure `financeAdvisorFromState` projection + live
  `getFinanceAdvisor()` — balance, category revenue/expenses, debt, interest,
  subsidyUsedThisYear, arrears, deficit, overflowDroppedThisYear, tax/wage rates.
- **Determinism**: chunked 1/7/50 identity across the year boundary (interest +
  subsidy reset); no-RNG/clock source audit over finance/economy. `SimState`
  frozen — goldens byte-identical, no regeneration.

### Wave Plan

- 10-W1: Wire Treasury into the runner + subsidy/loans/overflow APIs
- 10-W2: Bankruptcy consequence (SC2) + finance advisor surface
- 10-W3: Finance chunked determinism + RNG/clock audit

### Tests

Baseline 622 tests / 86 files → **644 tests / 89 files** (+22 tests / +3 files).
Typecheck clean, lint clean, `npm run check:military` clean. Both golden
fixtures and the food-slice integration test stayed green without regeneration.

## Files Changed

- `src/sim/runner.ts` — Treasury instance, requestRoyalSubsidy/takeLoan/repayLoan,
  tickFinanceRollover/tickFinanceCap, getFinanceAdvisor, arrearsDepth
- `src/sim/finance.ts` — Treasury class (already existed; wired)
- `src/sim/economy.ts` — tickEconomy (already existed; preserved)
- `src/sim/housing.ts` — arrears-depth desirability penalty (additive)
- `src/sim/advisors.ts` — financeAdvisorFromState + FinanceAdvisorView
- `src/sim/types.ts` — additive finance view types
- `data/balance.ts` — royalSubsidyCap, loanInterestRate, loanMaxAmount,
  treasuryOverflowLimit, desirabilityArrearsDepthPeriodTicks
- Tests: `finance-runner` (unit), `finance-advisor` (unit), `bankruptcy`
  (integration), `finance-determinism` (determinism)

## Decisions Log

- Verify-as-built: `Treasury`/`tickEconomy` already implemented the model; the
  work was wiring + gap-fill, not a rebuild.
- `tickEconomyInternal` pins the balance to the pure `tickEconomy` result
  (tax-exclusive arithmetic) to keep goldens byte-identical; the ledger records
  wages paid from the tax-inclusive balance — a documented accounting nuance.
- Interest accrues at the year boundary (tick 360), aligned with the rollYear
  reset — deterministic, no clock/RNG.
- `SimState` shape unchanged; finance runtime state lives on the Treasury
  instance, exposed via additive accessors only.

## Deferred

- Finance management UI → Phase 18.
- Campaign finance scenarios → Phase 17.
- Save/load serialization of finance state → Phase 19 Persistence & Options.
