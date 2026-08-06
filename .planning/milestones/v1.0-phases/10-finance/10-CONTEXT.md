# Phase 10: Finance - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning
**Mode:** Auto-generated (smart-discuss, all grey areas pre-accepted by user)

<domain>
## Phase Boundary

Complete treasury model with wages, taxes, trade revenue, subsidy, loans.

Success criteria (from ROADMAP):
1. Treasury reflects wages, taxes, trade, subsidy requests, and loan interest.
2. Running out of money has a visible consequence (e.g., housing downgrade, wage arrears).

Requirements: FIN-01 (full finance: wages, taxes, trade revenue, royal subsidy request, loans/interest, treasury overflow).
</domain>

<decisions>
## Implementation Decisions

### Pre-Accepted Grey Areas (user approved all, do not re-ask)
- **Verify-as-built**: Audit existing finance code against FIN-01; gap-fill, do not rebuild. The repo already has `src/sim/finance.ts` (Treasury class with categorized ledger, subsidy requests, debt+interest, yearlyReset), `src/sim/economy.ts` (tickEconomy: taxes/wages), and runner wiring (`tickEconomyInternal`, `setPolicy`, `getTreasury`, `lastWagesUnpaid`).
- **Gap-fill + add tests**: Missing FIN-01 pieces (royal subsidy request wiring, loans/interest wiring to treasury, treasury overflow cap, visible consequence of bankruptcy) become additive features + tests. All existing tests stay green.
- **Determinism**: Seeded RNG only, never `Math.random`/`Date.now`; no unseeded iteration order; goldens regenerate only on intentional mechanic change via `GOLDEN_UPDATE=1 npm run test:golden:update`.
- **No military content**: Keep `check:military` clean.
- **Live-derived data**: Advisor/UI data surfaces derived from real sim state, never fabricated.
- **Additive API**: Keep existing exported signatures stable; new surfaces additive.

### Agent's Discretion
- Follow Caesar 3 finance model: wage/tax balance (wages below a threshold → emigration/housing downgrade), royal subsidy request (one-time per year, favor cost), loans with interest (repay over time), treasury overflow cap (excess above a limit is lost, discouraging hoarding).
- "Visible consequence of running out of money": implement wage arrears (`wagesUnpaid`) as the primary consequence — unpaid wages cause housing downgrade/desirability loss or emigration; a finance advisor surface reports deficit/arrears live.

</decisions>

<code_context>
## Existing Code Insights

- `src/sim/finance.ts`: `Treasury` class (balance, categorized revenue/expenses, debt, yearlyReset, subsidyUsedThisYear, addRevenue/addExpense), `FinCategory`.
- `src/sim/economy.ts`: `tickEconomy` (taxes/wages, treasury clamp at 0), `workerPool`, `populationOf`.
- `src/sim/runner.ts`: `tickEconomyInternal` collects taxes + pays wages; `setPolicy(taxRate, wageRate)`; `getTreasury()`; `lastWagesUnpaid` tracked; advisor snapshot includes `taxes`, `wages`, `wagesUnpaid`.
- `src/sim/advisors.ts`: finance advisor surface (wagesUnpaid flag).
- Tests: `tests/unit/finance.test.ts` (Treasury class), `tests/unit/economy.test.ts` (taxes/wages), advisor tests.

Codebase context will be deepened during plan-phase research.
</code_context>

<specifics>
## Specific Ideas

- FIN-01 gap-fill candidates (audit first): royal subsidy request API on the runner (once per year, favor cost, capped amount), loan take/repay with per-tick interest, treasury overflow cap (excess above N is lost), bankruptcy consequence (wage arrears → housing downgrade / emigration).
- Finance advisor view: live treasury balance, revenue/expense categories, debt, subsidy status, arrears flag.
</specifics>

<deferred>
## Deferred Ideas

- Full finance management UI screens → Phase 18 Management UI.
- Campaign finance scenarios → Phase 17.
</deferred>
