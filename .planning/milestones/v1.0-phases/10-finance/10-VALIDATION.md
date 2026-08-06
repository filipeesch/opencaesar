# Phase 10 Validation: Finance

**Phase**: 10-finance | **Requirements**: FIN-01 | **Baseline**: 622 tests / 86 files

## Success Criteria → Must-Haves

| # | Must-have (automated check) | Test | Wave |
|---|------------------------------|------|------|
| SC1 | Treasury reflects taxes | finance-runner.test.ts: taxes land in 'taxes' revenue | W1-1 |
| SC1 | Treasury reflects wages | finance-runner.test.ts: wages in 'wages' expenses; unpaid wages tracked | W1-1 |
| SC1 | Treasury reflects trade revenue | finance-runner.test.ts: export proceeds in 'trade' revenue | W1-1 |
| SC1 | Treasury reflects subsidy requests | finance-runner.test.ts: requestRoyalSubsidy grants bounded once/year, refuses second | W1-2 |
| SC1 | Treasury reflects loan interest | finance-runner.test.ts: takeLoan → debt + treasury; accrue adds interest deterministically; repayLoan reduces debt | W1-2 |
| SC1 | Treasury overflow capped | finance-runner.test.ts: balance never exceeds CONFIG.treasuryOverflowLimit; excess ledgered | W1-2 |
| SC2 | Running out of money → visible consequence | bankruptcy.test.ts: persistent unpaid wages → arrears flag + housing tier downgrade; recovery clears penalty | W2-1 |
| — | Finance advisor live-derived | finance-advisor.test.ts: pure projection exact + live accessor reconciles real state | W2-2 |
| — | Determinism | finance-determinism.test.ts: chunks 1/7/50 byte-identical, no RNG/clock audit | W3-1 |
| — | No military tokens | npm run check:military clean | W3-1 |
| — | Goldens stay byte-identical | golden.test.ts + food-slice.test.ts green, no regeneration | all |

## Sign-off Checklist

- [ ] `npm run test` green after each wave (baseline 622 + additions)
- [ ] `npm run typecheck` clean
- [ ] `npm run check:military` clean
- [ ] No golden regeneration (`SimState` unchanged)
- [ ] All existing finance/economy/housing tests green (no behavior regression)
