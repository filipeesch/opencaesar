---
phase: 10-finance
status: passed
method: automated
completed: "2026-08-04"
---

# Phase 10 Verification Report: Finance

## Success Criteria → Must-Haves

Extracted from `.planning/phases/10-finance/10-VALIDATION.md`:

| # | Must-have | How verified | Result |
|---|-----------|--------------|--------|
| SC1 | Treasury reflects taxes | finance-runner.test.ts: taxes land in 'taxes' revenue | ✅ passed |
| SC1 | Treasury reflects wages | finance-runner.test.ts: wages in 'wages' expenses; unpaid wages tracked | ✅ passed |
| SC1 | Treasury reflects trade revenue | finance-runner.test.ts: export proceeds in 'trade' revenue | ✅ passed |
| SC1 | Treasury reflects subsidy requests | finance-runner.test.ts: requestRoyalSubsidy grants bounded once/year, refuses second | ✅ passed |
| SC1 | Treasury reflects loan interest | finance-runner.test.ts: takeLoan → debt + treasury; accrue adds interest at year rollover; repayLoan reduces debt | ✅ passed |
| SC1 | Treasury overflow capped | finance-runner.test.ts: balance never exceeds CONFIG.treasuryOverflowLimit; excess ledgered as 'overflow' | ✅ passed |
| SC2 | Running out of money → visible consequence | bankruptcy.test.ts: sustained unpaid wages → arrears flag + housing tier downgrade (2→1); recovery clears arrears and re-evolves | ✅ passed |
| — | Finance advisor live-derived | finance-advisor.test.ts: pure projection exact + live accessor reconciles real state | ✅ passed |
| — | Determinism | finance-determinism.test.ts: chunks 1/7/50 byte-identical across year boundary; no-RNG/clock audit | ✅ passed |
| — | No military tokens | npm run check:military clean | ✅ passed |
| — | Goldens stay byte-identical | golden.test.ts + food-slice.test.ts green, no regeneration | ✅ passed |

## Status

**PASSED** — all must-haves verified with automated evidence.

- Tests: 644 passed / 89 files (baseline 622 / 86 → +22 / +3)
- Typecheck: clean; Lint: clean; `check:military`: clean
- Goldens: unchanged, no regeneration required (`SimState` frozen)

## Notes

- The bankruptcy scenario evolves the food city to tier 2 first, then drains the
  treasury (taxRate 0 / wageRate 0.5) so wages are unpaid; arrearsDepth reaches 1
  after `desirabilityArrearsDepthPeriodTicks` (1080), deepening the penalty and
  completing the downgrade within `devolveWindowTicks` (240). Recovery uses a
  balanced policy (0.5/0.5) so taxes exceed wages and desirability recovers.
- `tickEconomyInternal` pins the balance to the pure `tickEconomy` result to keep
  goldens byte-identical; the ledger records wages paid from the tax-inclusive
  balance — documented accounting nuance, deterministic.
- No gaps found. Finance config serialization in save/load deferred to Phase 19.
