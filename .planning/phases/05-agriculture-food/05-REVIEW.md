---
phase: 05-agriculture-food
reviewed: 2026-08-03T15:30:00Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - src/sim/agriculture.ts
  - src/sim/logistics.ts
  - src/sim/transport.ts
  - src/sim/housing.ts
  - src/sim/housingEvolution.ts
  - src/sim/trade.ts
  - src/sim/advisors.ts
  - src/game/scenes/HUDScene.ts
  - tests/integration/food-slice.test.ts
  - tests/unit/agriculture.test.ts
  - tests/unit/logistics.test.ts
  - tests/unit/transport.test.ts
  - tests/unit/housing.test.ts
  - tests/unit/housing-evolution.test.ts
  - tests/unit/advisors.test.ts
  - tests/trade.test.ts
findings:
  critical: 1
  warning: 4
  info: 6
  total: 11
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-08-03T15:30:00Z
**Depth:** deep
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the Phase 5 "Agriculture & Food" verify-as-built + gap-fill modules: the physical-load production model & fishing-boat state machine (`agriculture.ts`), `GranaryModel` food hub + market demand/supplier scoring (`logistics.ts`), the `FoodLoad` lifecycle (`transport.ts`), house food inventory/variety (`housing.ts`, `housingEvolution.ts`), urban-reserve trade (`trade.ts`), and the food HUD/advisor data surface (`advisors.ts`, `HUDScene.ts`), plus the new unit suite and `tests/integration/food-slice.test.ts`.

Overall: the deterministic core is solid — seeded/state-free pure functions, no `Math.random`/`Date`/`performance.now` in the new sim code, reservation accounting correctly prevents double-pick and restores availability on expiry, load transitions are strict with dev errors, save/load round-trips are byte-for-byte deterministic, and the shared-capacity + ping-pong guards are directionally correct. All tool gates pass (see Tool Results).

However I found one **critical** defect (silent product destruction in the fishing-boat unload path — directly contradicting the module's own "never loses product" guarantee and spec §29/§33-22), plus a granary total-capacity overflow that breaks the flagship "shared 3,200-unit capacity" contract, a plan-scope gap (buyer/seller *walkers* were never wired into `walkers.ts`), and the advisor/overlay data surface hardcoding fabricated values (production=0, wheat-only consumption, constant overlay values) — which conflicts with the phase's own "never fabricated, always live-sim-derived" requirement (§33-23).

## Critical Issues

### CR-01: Fishing boat silently destroys its catch at unload — product loss on blocked wharf

**File:** `src/sim/agriculture.ts:246-248`
**Issue:** The `boatStep` `unloading` branch zeroes `boat.catch` unconditionally and does not transfer the catch to any wharf stock:

```ts
case 'unloading':
  if (opts.wharfFree) boat.state = 'idle';
  boat.catch = 0;   // always destroys the catch
  break;
```

`catch` is reset on the *first* unloading step regardless of `opts.wharfFree`. If the wharf is blocked (`wharfFree: false`) the boat correctly stays in `unloading`, but the caught fish (up to 30 units per the 30-day cycle) have already been wiped — exactly the "blocked boat stays put (never loses product)" case the doc comment at line 209-212 promises. There is also no path anywhere in the module that hands `catch` over to a wharf stock: the module's own API destroys the product it claims to deliver. Verified empirically: fishing cycle yields `catch: 30`, and one call to `boatStep(wharfFree:false)` while unloading drops it to `0` while keeping `state:'unloading'`. The only unit tests cover the unblocked happy path and a `state='fishing'`/`remaining=0` loop that never actually grows `catch`, so this is uncovered.

**Fix:**
```ts
case 'unloading':
  if (opts.wharfFree) {
    // hand boat.catch to the wharf stock here (or return it as a result/event
    // so the caller can apply it) BEFORE clearing
    // e.g. wharf.receiveFish(boat.catch);
    boat.catch = 0;
    boat.state = 'idle';
  }
  // else: blocked wharf — keep catch intact, stay unloading
  break;
```
Better: give `boatStep` a wharf-stock target (or return the unloaded amount as a result) and only clear `catch` after the wharf commits it. Add a test asserting a blocked wharf preserves `boat.catch`.

## Warnings

### WR-01: `granaryTransfer` (and `GranaryModel.receive`) can exceed the shared 3,200-unit capacity and `receive` can silently discard units

**File:** `src/sim/logistics.ts:695`, `297-299`, `699-700`
**Issue:** The transfer's capacity guard only checks the destination *per-food* physical against the whole capacity: `if (dest.physical(food) + amount > dest.capacity)`. It never checks total occupancy across foods (`usedCapacity()`), which the `accepts()` method (line 292) correctly does. `granaryTransfer` also bypasses `accepts()` entirely. `receive()` then clamps only per-food physical at `capacity` (`s.physical = Math.min(this.capacity, s.physical + amount)`), so:
1. A multi-food granary can be pushed above 3,200 units — verified: `b` at 1500 wheat + 1500 fruit accepts a 500-wheat transfer (`ok: true`) yielding `usedCapacity() = 3500 > 3200`.
2. `receive()` called without the `accepts()` gate silently drops the overflow instead of failing loudly — a silent-loss vector that contradicts the "no product destroyed" invariant.

**Fix:** In `granaryTransfer`, replace/complement the per-food check with a total check: `if (dest.usedCapacity() + amount > dest.capacity) return { ok:false, reason:'no-capacity' };`. Make `receive()` return the applied amount (or throw/assert) rather than silently capping, and consider counting `incoming` the same way `accepts` does.

### WR-02: Buyer/seller walker integration in `walkers.ts` was planned but never implemented — plan scope gap

**File:** `src/sim/walkers.ts` (no diff this phase)
**Issue:** PLAN task 3 lists `src/sim/walkers.ts` in `<files>` and requires the *buyer destination walker* (reserve → travel → collect → return → deposit, §12.5) and the *seller wandering walker* (multi-food delivery with route limits, §12.9–12.12). The phase only added pure helper functions in `logistics.ts` (`marketAgents`, `nextFoodToFetch`, `sellerLoadComposition`, `policyOrder` — fine as building blocks), but `git diff` shows **zero** changes to `walkers.ts`; there are no `GranaryModel` reservations, buyers, or sellers wired into walker behavior. The SUMMARY's Task-3 coverage entry "market reservation (existing + policyOrder)" overstates this — the §12.5/§12.9 walking behavior does not exist in the walker codebase.

**Fix:** Either implement the buyer/seller walkers (or delegate to `wait` state wiring in `walkers.ts`) within this phase, or explicitly mark this sub-task as deferred with a tracking note, since downstream phases (6–8) will rely on it.

### WR-03: `foodAdvisorFromState` fabricates advisor values — production/imports/exports hardcoded to 0, consumption assigned to wheat only

**File:** `src/sim/advisors.ts:323`, `327-330`, `338`, `342-343`
**Issue:** The per-food advisor table (and derived `productionMonthly: 0`, `balanceMonthly: -consumption`, `bottlenecks`) hardcodes `production = 0`, `imports: 0`, `exports: 0`, and distributes **all** city consumption to `wheat` (`f === 'wheat' ? population * base : 0`) even though houses consume any food (§13.3). The consequence is not just missing data but **false diagnoses**: `foodBottlenecks({ productionMonthlyByFood: {} })` will always emit `wheat: production below consumption` (and, once stock empties, `wheat: no stock while houses consume it`) regardless of real farm output, and every non-wheat food with positive stock shows `months = Infinity`. The phase's own success criterion (§33-23: "every painted value must come from a live sim query, never fabricated") is violated by the advisor's flagship table.

**Fix:** Derive per-food production from live farm/orchard outputs, imports/exports from the trade ledger, and consumption split across all foods actually delivered; when a column genuinely has no data source yet, omit it from the table rather than painting a constant `0` that drives false bottleneck messages.

### WR-04: `foodOverlayGrids` paints hardcoded constants, not root-caused values

**File:** `src/sim/advisors.ts:369`, `376`
**Issue:** The overlay grids are fabricated: `supplyDays = 10 : 0` and `variety = 1 : 0`, both decided only by the `foodCooldown > 0` proxy. The phase *has* real per-house inventory/variety primitives (`houseFoodDays`, `foodVariety`), but the overlay ignores them, so the supply overlay shows a fixed 10 days and the variety overlay a boolean, never the actual stock-derived state (§22, §33-23).

**Fix:** Drive the grids from `HouseFoodInventory`/`houseFoodDays`/`foodVariety` per house; only fall back to the `foodCooldown` proxy when no inventory exists.

## Info

### IN-01: Unreachable `FarmStopReason` vocabulary
**File:** `src/sim/agriculture.ts:107-116`
`farmStopReason` never returns `'no-labor-access'`, `'harvest-ready'`, `'awaiting-carrier'`, `'fire-risk'`, `'collapse-risk'` — dead branches of the advertised §6.7 vocabulary. Either wire them to real conditions or trim the union.

### IN-02: `importDestinationPriority` reports reason `'accepts'` for refuse/empty
**File:** `src/sim/trade.ts:197`
For `mode === 'refuse' | 'empty'` the function returns `{ reason: 'accepts', priority: 99 }` — the priority (worst, 99) is right, but the reason label "accepts" semantically contradicts a refusing granary. Use a `'refuses'`-style reason.

### IN-03: `dangerousExport` lists `sell-anyway` even for safe sales
**File:** `src/sim/trade.ts:180`
When the sale is not dangerous the returned options are `['sell-anyway']`, implying an approval gate exists where none is needed. Returning `[]` (or the natural "sell") would be less misleading.

### IN-04: `nextFoodToFetch` may pick a food to fetch when no demand exists
**File:** `src/sim/logistics.ts:501`
When every food has `current <= 0` and `consumption === 0`, coverage computes `0` for all so a buyer still selects a food to fetch (zero-demand fetch). Deterministic but wasteful; consider skipping foods with zero expected consumption.

### IN-05: Fishing cycle fills only 30/100 boat capacity
**File:** `src/sim/agriculture.ts:230-244`
The 30-day cycle accumulates `catch += 1` per tick, yielding 30 units while capacity is 100. "Accumulates up to capacity" (§10.4) is not reached within one voyage; likely a tuning/design decision but worth confirming, and a test hardening (`catch` growth bounded by both `remaining` and `BOAT_CAPACITY`) would pin intent.

### IN-06: Granary reservation map grows unbounded
**File:** `src/sim/logistics.ts:316-336`
`expireReservations` and `fulfill` mark reservations `expired`/`fulfilled` but never remove them, so the `reservations` Map grows monotonically with activity. Harmless for correctness today; worth pruning once wired into the long-running runner.

---

## Tool Results

- `npm run typecheck` — **pass** (tsc --noEmit, 0 errors)
- `npm run test` — **pass** (57 files, 411 tests passed)
- `npm run lint` — **pass** (eslint src --max-warnings 0, 0 warnings)
- `npm run check:military` — **pass** ("clean: no forbidden military tokens in src/ or data/")

Determinism spot-checks: the new sim modules are pure/seeded-free (grep confirms no `Math.random`/`performance.now`/`Date` in the changed sim files — the only `Date.now` is pre-existing save metadata in `runner.ts:597`); `GranaryModel.serialize/deserialize` round-trips byte-identically (test asserted); identical seed+map+policy reproduces identical HUD food state (test asserted).

---
_Reviewed: 2026-08-03T15:30:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
