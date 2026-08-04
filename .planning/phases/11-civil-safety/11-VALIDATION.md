# Phase 11 Validation: Civil Safety

**Phase**: 11-civil-safety | **Requirements**: SAFE-01, SAFE-02, SAFE-03 | **Baseline**: 644 tests / 89 files

## Success Criteria → Must-Haves

| # | Must-have (automated check) | Test | Wave |
|---|------------------------------|------|------|
| SC1 | Buildings catch fire | fire-service.test.ts: high-density + no coverage → phase 'burning' | W1-2 |
| SC1 | Firemen extinguish fires | fire-service.test.ts: fireman within radius extinguishes burning building | W1-2 |
| SC1 | Fire risk rises with density | fire-service.test.ts: higher density → higher fireRisk (computeRisks) | W1-2 |
| SC1 | Fire coverage lowers risk | fire-service.test.ts: fireCoverage lowers fireRisk in runner risk computation | W1-2 |
| SC2 | Aging/event buildings risk collapse | collapse.test.ts: aging → rising collapseRisk; earthquake event boosts it | W2-1 |
| SC2 | Danger states shown | collapse.test.ts: 'collapse-risk'/'damaged' danger state on high-collapse building | W2-1 |
| SC2 | Engineers repair | collapse.test.ts: engineer within radius repairs damaged building | W2-1 |
| SC3 | Prefecture/marshal reduce crime | security.test.ts: crime falls as securityCoverage rises; marshal coverage applied | W2-2 |
| SC3 | Civilization overlay reflects it | civilization-overlay.test.ts: per-tile fire/collapse/crime/danger grids, coverage lowers values | W3-1 |
| — | Determinism | safety-determinism.test.ts: chunks 1/7/50 byte-identical, no-RNG/clock audit | W3-2 |
| — | No military tokens | npm run check:military clean (peaceful guards/marshals) | W2-2/W3-2 |
| — | Goldens stay byte-identical | golden.test.ts + food-slice.test.ts green, no regeneration | all |

## Sign-off Checklist

- [ ] `npm run test` green after each wave (baseline 644 + additions)
- [ ] `npm run typecheck` clean
- [ ] `npm run check:military` clean
- [ ] No golden regeneration (`SimState` unchanged)
- [ ] All existing safety/walker tests green (no behavior regression)
