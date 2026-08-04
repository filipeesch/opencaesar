# Phase 14 Context — Governance & Requests (GOV-01, GOV-02)

## What exists today
- `src/sim/governance.ts` (63 lines, seed) — `GovBuilding { id, name, threshold, effect }`; `GOV_BUILDINGS = [forum @1000 'unlocks administration', senate @2000 'governor salary', palatine @5000 'grand send-off']`; `unlockedGov(population)`; `AdminRequest { id, title, description, type: 'goods'|'denarii'|'population', amount, deadlineMonths, reward, penalty, delivered }`; `createRequest`, `deliverRequest(req, amount, monthsElapsed)` (partial/deliver/expired). Wired into runner at line 855 only as the advisor `government` list.
- `src/sim/governor.ts` (41 lines, seed) — `GOVERNOR_SALARY_LEVELS = [0,100,150,250,500]`; `createGovernor(salaryLevel)`, `payGovernor(g, treasury)` (salary → personal account), `donate(g, amount, { treasury, favor, yearlyCap })` (1 denarius = 1 favor, capped/year).
- `tests/unit/governance.test.ts` + `tests/unit/governor.test.ts` (4 tests each) — seed-level unit tests only; no runner integration, no effects, no requests in the sim, no determinism coverage.
- `src/sim/buildings.ts` — `forum` catalog entry exists (2×2, 220, 2 workers, government category); no senate/palatine entries.
- Runner machinery to reuse:
  - Deterministic month cadence `tickCount % 40 === 0` (festival hook, line 284) — requests tick here too.
  - `hash(seed, tick)` from `src/sim/events.ts` (used by `pickEvent`) — the project's pattern for seed+time-derived events; request arrival will mirror it (no RNG object, no Date).
  - `totalTradeStock(good)` / `exportSourceFor(good, entry)` (line 541/562) — stock accounting across storage hosts; request delivery reuses host iteration in stable order.
  - `Treasury.addExpense(cat, amount)` / `addRevenue(cat, amount)`; ledger categories: `taxes|wages|trade|subsidy|festival|loan|other|overflow` (Phase 13 added `festival` with goldens untouched → adding `governor` is equally safe).
  - `SaveCommand` + `commandLog` + `applyCommand` replay — user commands only; everything else must be derived deterministically from seed+tick (precedent: `pickEvent`, festival prep).
- Palace exists as `palatine` in the seed; `GOV_BUILDINGS.length === 3` is asserted by an existing test (keep 3).

## Design decisions
1. **Unlock = placement gate + advisory list**: `placeBuilding('forum'|'senate'|'palatine')` requires population ≥ threshold (error `not-unlocked`); `getGovernance().unlocked` lists what population allows. Effect only while the building is actually placed (like every other building) — SC1 "unlock at population thresholds with effects".
2. **Effects**: forum → requests become active (arrival gate); senate → `setGovernorSalaryLevel(level)` allowed, salary paid on the month cadence from treasury (`governor` expense) into the governor's personal account; palatine → grand send-off request type available. Salary level 0 = nothing paid. Salary owed even at 0 treasury → shortfall is just unpaid (mirror `payGovernor` clamp).
3. **Donations**: `donateToGovernor(amount)` replayable command; 1 denarius = 1 favor (clamped 100 via existing favor clamp), yearly cap 500 (config), only when senate placed. Ledger category `governor`.
4. **Requests arrive deterministically**: month cadence, forum placed, at most 3 active; arrival decided by `hash(seed, tick)` gated by a per-request weight + population weighting (like `pickEvent`). No commands on arrival — derived from seed+tick so replays are identical. Request identity = `${id}-${arrivalTick}` so two instances of the same catalog entry coexist.
5. **Request types**:
   - `goods` — deliver N loads of a good (deliverGoods(requestId, good, qty)); partial delivery accumulates; drawn from storage hosts in stable catalog order via a new `requestSourceFor(good)`; stock is consumed, `delivered += qty`.
   - `denarii` — pay N denarii (payRequest(requestId, amount)); partial payments accumulate.
   - `population` — reach N population by the deadline (auto-checked monthly; no command).
   - `send_off` (palatine only) — pay a large sum, reward larger (grand send-off).
6. **Completion/expiry** (checked on the month cadence): `monthsElapsed = (tickCount - arrivalTick)/40`; if `delivered >= amount` → reward income (`other`); else if `monthsElapsed > deadlineMonths` → penalty expense (`other`), request closed. Reward/penalty are constant per catalog entry → deterministic.
7. **Replay**: user commands only: `setGovernorSalaryLevel`, `donateToGovernor`, `deliverGoods`, `payRequest`. Arrivals/expiry/salary are derived → replay-exact.
8. **Backward compatibility**: `getStateJson()` unchanged shape (governance lives in `getGovernance()`/advisor view, not SimState); `DerivedSnapshot` untouched; goldens stay byte-identical without regeneration.
9. **Scope cut**: no UI window (Phase 18), no request persistence to save file beyond commands, no governor sentiment mechanics beyond salary/donations.

## Risks
- Population ≥ 1000/2000/5000 in tests: forum/senate need a few hundred houses; palatine needs a dense city. Mitigation: `govCity()` dense-housing builder (religionMap-style, 24×24+); thresholds asserted in integration; determinism suite uses a city that reaches ≥ 2000 (forum+senate active) and places buildings directly where gating permits.
- Placement gating changes no existing tests (forum isn't in any existing test city) — verify `buildings-catalog` SPOTS still valid (forum already exists there; senate/palatine added).
- `governor` ledger category must not break goldens — Phase 13's `festival` category proves empty categories are safe.
