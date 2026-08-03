---
phase: 07-warehouses-logistics
status: all_fixed
findings_in_scope: 4
fixed: 4
skipped: 0
iteration: 1
reviewed: 2026-08-03T18:26:04Z
fixed_at: 2026-08-03T19:40:00Z
info_fixed: 0
info_evaluated: 2
tests_after: 506
goldens_regenerated: false
---

# Phase 7: Code Review Fix Report

**Scope:** warnings (4) — all fixed. Info items evaluated and accepted as-is (documented behavior).

## Summary

All **4 warning** findings from `07-REVIEW.md` are fixed, each proven by new
unit/determinism tests and committed atomically as `fix(07): …`. The 2 info
items are **accepted, not fixed**:

- **IN-01** (`warehousePriority`/`warehouseNeedsStock` exported but unwired) is
  explicitly a Phase-8 runner-wiring item, acknowledged in the 07-01 SUMMARY —
  not a defect, correctly left for Phase 8.
- **IN-02** (`distance: path.length` excludes road endpoints) is identical to the
  established `findReachableGranary` pattern and monotonic for ranking — no
  behavior impact, documented as consistent.

Every gate passes: `npm run typecheck` (0 errors), `npm run lint` (0 warnings),
`npm run check:military` (clean), and the full test suite is **506 tests green**
(baseline 499 + 7 new).

**Golden snapshots are unchanged — no regeneration was needed.** The fixes touch
only pure reservation/fallback logic (`ReservationPool` and
`CommercialCenter.resolveFull`); neither is wired into `getState()`/`getStateJson()`
yet, the golden fixtures pass with no diff, and no `GOLDEN_UPDATE=1` run was
required.

**Commit-hygiene note:** the phase-07 implementation existed in the working tree
as uncommitted changes when fixing began (same situation Phase 6 hit). To make
each fix a clean, atomic commit, the in-scope phase-07 implementation
(`src/sim/{logistics,runner,advisors}.ts`, the five new tests, and the three 07-xx
SUMMARY docs) was first committed as `feat(07)` baseline `9834739`; the unrelated
visual-asset work (game scenes/art, sharp/package.json, deleted PNGs) was left
untouched.

## Finding → Fix → Verification

| Finding | Status | Fix (commit) | Verification (test) |
|---|---|---|---|
| **WR-01** `expireReservations` releases ALL reserved units of a commodity — plain `reserve()` units wrongly released at an expiry deadline | ✅ fixed | `ReservationPool` replaces the single per-commodity expiry tick with a **per-entry expiry ledger** `expiry: Map<commodity, Array<{ amount, expiresAt }>>`. `reserveWithExpiry` records its own entry; `expireReservations` releases only the sum of entries whose `expiresAt <= now` and removes exactly those entries. Plain `reserve()` units never have an entry and are never released (`0653394`) | `tests/unit/warehouse-reservation.test.ts` — "WR-01: a mix of plain reserve + reserveWithExpiry releases only the entries whose deadline passed": 2 plain + 3 (exp 40) + 1 (exp 25); at tick 25 only 1 unit releases, at tick 40 only 3 release, plain 2 units remain exact through a far-future sweep (reserved 2 / available 8) |
| **WR-02** A second `reserveWithExpiry` on one commodity overwrites/extends the first entry's deadline | ✅ fixed | Same per-entry ledger (WR-01 fix): each entry carries its own `expiresAt`, so two staggered `reserveWithExpiry` calls expire independently — the first at its original deadline even after the second call. No single per-commodity tick to overwrite (`0653394`) | `tests/unit/warehouse-reservation.test.ts` — "WR-02: a second reserveWithExpiry does not extend the first entry's deadline": 2 units (exp 40) + 1 unit (exp 45); at tick 40 exactly 2 release (reserved 1), at tick 45 the last unit releases (reserved 0); `tests/determinism/warehouse-logistics-determinism.test.ts` — "per-entry expiry (mixed plain + staggered deadlines) is identical across pools": identical release counts/reserved/available at ticks 20/25/39/40/45 across two pools |
| **WR-03** `reserve` guards `have < 1` but adds `amount` — over-reserves when `amount` exceeds availability | ✅ fixed | `reserve` now guards `if (have < amount) return false;` so a reservation can never exceed available stock; `reserveWithExpiry` inherits through its `reserve` delegation (`6e2b5bc`) | `tests/unit/warehouse-reservation.test.ts` — "WR-03: requesting more than available returns false and never over-reserves" (`reserve('wheat',5)` on 3 available → false, reserved 0/available 3; exact-boundary `reserve(3)` true; `reserve(1)` on the exhausted pool → false) and "reserveWithExpiry inherits the no-over-reserve guard" (failed `reserveWithExpiry(5)` records nothing; `reserveWithExpiry(3)` succeeds and expires normally) |
| **WR-04** `resolveFull` never excludes the designated center, so fallback can "choose" the same full warehouse | ✅ fixed | `CommercialCenter.resolveFull` skips candidates whose `id === this.designation` in the fallback loop, so the search is always over **different** warehouses; when no alternative accepts (including the only-candidate-is-designated case) it reports the hold/not-discarded warning with `id: null` (`85fbf41`) | `tests/unit/commercial-center.test.ts` — "WR-04: excludes the full designated center from the fallback search even when it is first" (designated wh1 accepting + alternative wh2 → picks wh2 with both names in the warning) and "WR-04: when only the full designated center exists, fallback finds none and holds" (`id` null, warning `held`/`nothing discarded`, nothing discarded) |

## Acceptance Criteria

- [x] WARNINGS (4) fixed with tests: per-entry expiry releasing only reached deadlines, staggered independent deadlines, no-over-reserve guard, designated-center exclusion in fallback
- [x] INFO (2) evaluated and accepted: IN-01 is a Phase-8 wiring item; IN-02 matches the established granary-distance pattern (documented, no fix)
- [x] Determinism preserved: tick-injected `now + expiresIn` deadlines only, no `Math.random`/`Date`; cross-pool identity test added for the new per-entry ledger
- [x] `npm run typecheck` — pass (0 errors)
- [x] `npm run lint` — pass (0 warnings)
- [x] `npm run check:military` — pass (clean)
- [x] `npm run test` — **506 passed** (baseline 499 + 7 new)
- [x] Golden snapshots **unchanged** (no `GOLDEN_UPDATE=1` run required — fixes are pure reservation/fallback logic not in the `getStateJson()` path)
- [x] Each fix committed atomically as `fix(07): …`; `07-REVIEW.md` not committed

## Commit Hashes

- `9834739` feat(07): warehouses & logistics — warehouse order matrix, tick-based reservation pool, commercial center fallback, road delivery, live logistics advisor (baseline; the implementation was uncommitted before this fix pass)
- `6e2b5bc` fix(07): WR-03 — reserve/reserveWithExpiry refuse to over-reserve when amount exceeds available stock
- `0653394` fix(07): WR-01 + WR-02 — per-reservation expiry entries; plain reserve never expires, staggered deadlines are independent
- `85fbf41` fix(07): WR-04 — resolveFull excludes the designated (full) center from fallback candidates
