# Phase 14 Plan — Governance & Requests (GOV-01, GOV-02)

## Goal
Forum/senate/palatine unlock at population thresholds and confer live effects; administrative requests arrive deterministically, are satisfied fully or partially, and reward/penalize by deadline.

## Wave 1 — Government buildings with live effects
**Goal**: placement gates + real effects for forum, senate, palatine.

### Tasks
1. `src/sim/types.ts` — `BuildingType += 'senate' | 'palatine'`; `SaveCommand += { kind: 'setGovernorSalaryLevel'; level: number } | { kind: 'donateToGovernor'; amount: number }`; `PlacementError += 'not-unlocked'`; `FinCategory += 'governor'`.
2. `src/sim/buildings.ts` — `senate`: 3×3, cost 1000, workers 12, category government, `requiresRoad: true`; `palatine`: 5×5, cost 3000, workers 40, category government, `requiresRoad: true` (costs/workers from manual-style scale; no spawns).
3. `src/sim/runner.ts`:
   - `placeBuilding(type, x, y)`: before terrain checks — if `type` is a government building and `population < threshold` (from `GOV_BUILDINGS`), return error `not-unlocked` (paused → enqueue still applies).
   - Governor fields: `governor = createGovernor()`; `setGovernorSalaryLevel(level)` (replayable; validates 0..4, senate placed, error `senate-required`; persisted in saveCommands).
   - Month cadence hook (the existing `tickCount % 40 === 0` block): if senate placed && salaryLevel > 0 → `payGovernor(governor, balance)` and `addExpense('governor', salary)`; year rollover resets `governor.donationsThisYear` (alongside subsidy guard).
   - `donateToGovernor(amount)`: senate required (`senate-required`), treasury ≥ amount, yearly cap 500 (CONFIG `governorDonationCap`); capped to remaining yearly room; `donate()`; favor `= min(100, favor + granted)`; expense `governor`; replayable.
   - `getGovernance()` accessor: `{ unlocked: string[], placed: string[], effects: { requestsEnabled, salaryLevel, grandSendOffEnabled }, governor: { salaryLevel, personalAccount, donationsThisYear } }`.
4. `src/sim/events.ts` — export `hash` already public; nothing to change. Request arrival lives in W2.
5. Tests:
   - `tests/unit/governance.test.ts` — extend: threshold gating errors; salary levels validation; salary paid only when senate placed; donate cap/favor math; year rollover reset (extend existing describe blocks).
   - `tests/integration/governance.test.ts` (NEW) — `govCity()` dense housing: forum/senate placement blocked below threshold (`not-unlocked`) and allowed above; senate → salary expensed monthly into personal account; salary 0 → nothing; donate raises favor up to cap, denied at 0 treasury; `getGovernance()` reflects effects.
   - `tests/integration/buildings-catalog.test.ts` — ALL_TYPES += `senate`, `palatine`; SPOTS entries.

## Wave 2 — Administrative requests
**Goal**: deterministic arrival + partial fulfillment + deadline rewards/penalties.

### Tasks
1. `data/requests.ts` (NEW) — catalog `REQUEST_CATALOG`:
   - `grain_delivery` (goods, wheat 150, 12 months, reward 300, penalty 150), `amphora_delivery` (goods, pottery 100, 12, 250/125), `wine_delivery` (goods, wine 100, 12, 250/125), `oil_delivery` (goods, olive_oil 80, 12, 200/100), `tax_tithe` (denarii 200, 6, 150/100), `population_drive` (population 1500, 18, 500/250), `grand_send_off` (send_off 2000, 6, 3000/0, palatine-only). Weights per entry.
   - `pickRequest(seed, tick, population, unlockedIds): string | null` — `hash(seed, tick)` weighted roll among eligible (palatine-gated for send_off; population requests only when target plausible); null most months (total weight ≪ 1000).
   - `entryById(id)`.
2. `src/sim/runner.ts`:
   - `requests: ActiveRequest[]` = `{ id, arrivalTick, delivered }`; instance id `${id}@${arrivalTick}`.
   - Arrival (month cadence): forum placed (effects.requestsEnabled), active count < 3, `pickRequest(seed, tickCount, population, placedGovIds)` non-null → push.
   - `deliverGoods(requestId, good, qty)`: find active goods request; `requestSourceFor(good)` (first storage host with stock, stable iteration — mirrors `exportSourceFor` without the entry vec2); consume stock, `delivered += qty`; replayable. Error `no-stock`/`unknown-request`/`wrong-good`.
   - `payRequest(requestId, amount)`: treasury ≥ amount → deduct, `delivered += amount`, expense `other` (denarii/send_off types only).
   - Month cadence completion check: for each request, `monthsElapsed = (tickCount - arrivalTick)/40`; `delivered >= amount` → `addRevenue('other', reward)` (send_off reward too), remove; `monthsElapsed > deadlineMonths` → `addExpense('other', penalty)`, remove. Population type: `delivered` auto-updated monthly to current population.
   - `getRequests()` accessor: active requests with title/description/amount/delivered/deadline/remaining months; plus recent outcomes ledger via commandLog? (keep: active only + last 5 completed via internal ring).
   - `applyCommand` exhaustive dispatch for the four new commands (typecheck-enforced).
3. `tests/unit/requests.test.ts` (NEW) — pickRequest: deterministic per (seed,tick), palatine gate, population eligibility, weight stats sanity; delivery math: partial accumulate, full → reward; expiry penalty; deadline boundary (month == deadline OK, > deadline penalized).
4. `tests/integration/governance.test.ts` (W1 + W2) — forum city: request arrives within N months; deliverGoods consumes warehouse stock and credits delivered; payRequest draws treasury; full delivery pays reward; ignoring a request past deadline charges penalty; grand send-off only with palatine; population request auto-fulfills when population reaches target.
5. `tests/determinism/governance-determinism.test.ts` (NEW) — `govMap()` dense city reaching ≥ 2000 pop: chunks 1/7/50 byte-identical `getStateJson()` (seeds 1/7/1337) over 460 ticks including salary, donation, delivery commands; same-seed rerun; save→load replay byte-identical (new commands round-trip); no-RNG/clock audit of `governance.ts`, `governor.ts`, `data/requests.ts`.

## Verification loop (after each wave)
- `npm run typecheck && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run --maxWorkers=4` (full suite green)
- `npm run lint` (0 warnings), `npm run check:military`
- Golden fixtures unchanged (`git diff --stat tests/golden` empty)
- Final wave: delete probe files, full suite + commits (`feat(14)`, docs(14)), ROADMAP/STATE update, push.
