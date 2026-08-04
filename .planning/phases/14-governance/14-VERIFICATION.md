# Phase 14 Verification — Governance & Requests (GOV-01, GOV-02)

## Success criteria — evidence in the live sim

| # | Criterion | Evidence |
|---|---|---|
| SC1 | Forum/senate/palatine unlock at population thresholds | `placeBuilding` returns `not-unlocked` below 250/500/900 with no expense (unit + catalog threshold test); placing families of houses then reaching ≥900 lets all three place (integration `unlock effects live`, `getGovernance().unlocked` = [forum, senate, palatine]) |
| SC1 | Effect only while the building is placed | `demolish(forum)` flips `effects.requestsEnabled` back to false (integration `without a placed forum`); salary requires senate (`setGovernorSalaryLevel` returns `senate-required` after demolishing the senate) |
| SC1 | Senate pays a monthly salary | Salary level 1 → personal account +100 and `expenses.governor` 100 after one month (integration `senate salary is paid monthly`); level 0 pays nothing (integration `salary level 0`) |
| SC1 | Donations raise favor, 1 denarius = 1 favor, capped | Donating 100 → favor +100 (1:1); donating 500 then 1 → `cap-reached`; favor clamps at 100 (integration donations tests); cap resets on the year rollover (integration) |
| SC1 | Grand send-off only with palatine | Grand send-off request arrives only when the palatine is placed (integration `grand send-off is only available with the palatine placed`); `pickRequest` filters it via `requires: 'palatine'` (unit) |
| SC2 | Requests arrive deterministically | Weighted roll on `hash(seed, tick)` at the month cadence while a forum is placed (unit `pickRequest is deterministic per (seed, tick)`, `returns null most months`); at most 3 active; arrival pinned to fixed ticks in integration (tax_tithe@160) |
| SC2 | Partial fulfillment, full → reward | `payRequest`/`deliverGoods` accumulate `delivered`; full delivery pays `reward` into treasury (integration `paying a denarii request in full`, `partial payments accumulate`); population drive auto-fills when population ≥ 1500 (integration `population requests auto-fill`) |
| SC2 | Deadline reward/penalty | Expired request charges `penalty` 100 as `expenses.other` (integration `ignoring a request past its deadline`) |
| SC2 | Backward compatibility | Government state lives in `getGovernance()`/`getRequests()`, not `SimState`; goldens byte-identical without regeneration; new SaveCommand variants are additive |

## Determinism (must-have)
- Chunked runs 1/7/50 byte-identical for seeds 1/7/1337 over a run including salary level, a donation, and deterministic `payRequest` deliveries — plus a seed-7 run including `deliverGoods` (grain@480) — all byte-identical (determinism suite).
- Different seeds with the same layout diverge (delivery outcome is seed-dependent).
- Save→load replay byte-identical for a seed-generated-map city with salary + donation commands and all three government buildings placed.
- Source audit: no `Math.random()`/`Date.now()`/`new Date()` in `governance.ts`, `governor.ts`, `data/requests.ts`.

## Phase gates
- `npm run typecheck` ✓ · full `npx vitest run` 751 passed / 105 files ✓ · `npm run lint` 0 warnings ✓ · `npm run check:military` clean ✓ · `git diff --stat tests/golden` empty ✓

## Commits
- `0580bc6` feat(14): government buildings unlock at thresholds with salary and donation effects (GOV-01 W1)
- `b957041` feat(14): deterministic administrative requests with delivery, payment, and deadline rewards (GOV-02 W2)

## Notes / out of scope
- Requests arrive deterministically from seed+tick only (no commands on arrival); time-coupled mechanics are proven byte-identical by chunked determinism (Phase 13 precedent). UI for requests arrives in Phase 18.
- Thresholds 250/500/900 were chosen empirically against the seeded house-count city (tier-0 houses give ~5 population each, so palatine's 900 is reachable mid-phase); they are flat DATA-01 keys, not the seed's 1000/2000/5000.
