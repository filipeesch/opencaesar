# Phase 14 Summary — Governance & Requests (GOV-01, GOV-02)

## Delivered
- **Government buildings unlock at population thresholds**: `forum` (250), `senate` (500), `palatine` (900) — flat CONFIG keys (`govForumThreshold`/`govSenateThreshold`/`govPalatineThreshold`, DATA-01 compliant). `placeBuilding` on a government building below its threshold returns `not-unlocked` (no expense, logged). `getGovernance()` exposes `unlocked`/`placed`/`effects`.
- **Live effects (only while placed)**: forum → administration enabled (requests arrive); senate → `setGovernorSalaryLevel(0..4)` allowed, monthly salary (`governor` ledger expense) paid into the governor's personal account on the 40-tick month cadence; palatine → grand send-off request type eligible.
- **Governor finances**: `setGovernorSalaryLevel` + `donateToGovernor` are replayable commands. Donation is 1 denarius = 1 favor (clamped 100, added to derived favor), yearly cap 500 (`governorDonationCap`), reset on the year rollover; requires senate (`senate-required`).
- **Administrative requests (GOV-02)**: deterministic arrival on the month cadence while a forum is placed (`hash(seed, tick)` weighted roll among eligible, at most 3 active, instance id `${id}@${arrivalTick}`). Catalog `data/requests.ts` with 7 entries: grain/amphora/wine/oil deliveries (goods), tax tithe (denarii), population drive (population), grand send-off (palatine-gated). `deliverGoods` consumes storage stock; `payRequest` spends treasury; population requests auto-track population; full delivery pays `reward`, expired pays `penalty` — both constant per entry, so outcomes are deterministic. `getRequests()` exposes active + recent history.
- **Replay**: government placements bypass state-dependent gates during replay (a `replaying` flag set around save-load and paused-command drain), so recorded cities round-trip exactly; new commands dispatch through `applyCommand`.

## Fixes found by the new tests
- `fromSaveData` regenerates a natural seeded map, so save/load integration tests must build the city on the seed-generated map (not a custom all-fertile layout) — caught by the replay test.
- Cached `DerivedSnapshot` was stale after a donation (favor unchanged until next tick) — `donateToGovernor` now invalidates the cache.
- Absolute-treasury assertions in salary tests were wrong: treasury fluctuates from taxes/wages; the ledger (`expenses.governor`) is the correct assertion surface. The year rollover resets the ledger, so expiry assertions must sample within one year.

## Test delta
- New: `tests/unit/requests.test.ts` (catalog flatness, pickRequest determinism/gating/weights — 8 tests), `tests/integration/requests.test.ts` (arrival, forum gating, pay/partial/penalty, goods delivery, send-off gating, population auto-fill — 10 tests), `tests/determinism/governance-determinism.test.ts` (chunked 1/7/50 byte-identical over salary/donation/delivery, save/load replay, RNG/clock audit — 5 tests).
- Updated: `tests/unit/governance.test.ts` (thresholds 250/500/900, unlockedGov lists), `tests/integration/buildings-catalog.test.ts` (smoke-skeleton + government threshold gate), `tests/integration/governance.test.ts` (effects, salary, donations, replay — 11 tests).
- Full suite: **751 passed / 105 files** (was 716/101 at the phase start — +35/+4). Typecheck, lint (0 warnings), and `check:military` all green. Golden fixtures untouched.

## Notes
- Requests are time-coupled (arrive via seed+tick), so their byte-identity is proven by chunked determinism — the same contract as Phase 13 festivals; save/load covers the tick-0-valid governor commands plus request-command round-trip.
