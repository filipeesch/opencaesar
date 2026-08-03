---
phase: 06-production-manufacturing
status: all_fixed
findings_in_scope: 6
fixed: 6
skipped: 0
iteration: 1
reviewed: 2026-08-03T18:00:00Z
fixed_at: 2026-08-03T18:40:00Z
info_fixed: 3
info_evaluated: 0
tests_after: 467
goldens_regenerated: false
---

# Phase 6: Code Review Fix Report

**Scope:** warnings (3) + info (3) — all fixed.

## Summary

All **3 warning** findings from `06-REVIEW.md` are fixed, each proven by a new
unit/integration test and committed atomically; all **3 info** items are fixed
(cheap and clearly correct). Every gate passes: `npm run typecheck` (0 errors),
`npm run lint` (0 warnings), `npm run check:military` (clean), and the full test
suite is **467 tests green** (baseline 459 + 8 new).

**Golden snapshots are unchanged — no regeneration was needed.** The WR-02
map-seeding change only alters `SimMap.generate`, but both golden fixtures
(`food-chain-golden.json`, `paused-commands-golden.json`) run on `foodChainMap()`
(a fixed explicit map), so the seed-generated-map change does not affect them and
the full suite passed with no golden failure.

**Commit-hygiene note:** the phase-06 implementation existed in the working tree
as uncommitted changes when fixing began. To make each fix a clean, atomic
commit, the in-scope phase-06 implementation (src/sim + in-scope game/test files)
was first committed as `feat(06)` baseline `c5689f0`; the unrelated visual-asset
work (sharp/package.json, `art.ts` zoom LOD, game scenes, deleted PNGs) was left
untouched.

## Finding → Fix → Verification

| Finding | Status | Fix (commit) | Verification (test) |
|---|---|---|---|
| **WR-01** Deposit gate checks only the anchor tile, not the full footprint | ✅ fixed | `tickProduction` (`src/sim/runner.ts`) now evaluates the deposit over the **whole footprint** — an extraction site extracts only when every footprint tile satisfies its deposit (2×2 clay/iron/timber, 3×3 marble). This is the stricter convention (same as buildings whose `requiredTerrain` must cover every footprint tile) and is documented in code. A partially-on-deposit site is blocked with zero output (`cb0ab32`) | `tests/integration/production-chain.test.ts` — "WR-01: the deposit gate checks the whole footprint, not just the anchor tile": a staffed pit whose anchor is on clay but whose other 3 footprint tiles are bare stays `blocked` with 0 output, while the control fully-on-deposit pit produces; the advisor agrees |
| **WR-02** Deposits never populated by map generation — clay/iron/marble permanently blocked in live play | ✅ fixed | `SimMap.generate` now calls `seedDeposits(...)` (`src/sim/map.ts`): ambient clay/iron/marble clusters carved from the seeded RNG (never `Math.random`) **plus** a deterministic (no-RNG) guaranteed full-footprint block per deposit kind on non-water land, mirroring the fertile-farm guarantee — and a guaranteed 2×2 `trees` patch so the timber yard's full-footprint gate is also buildable. The runner's deposit lookup already reads `TileState.resourceType`, so all 4 extraction kinds can operate in live play (`4b72f7b`) | `tests/unit/map.test.ts` — "WR-02: every generated map carries a full-footprint deposit region of each kind …" (seeds 0–24: clay/iron 2×2 + marble 3×3 on buildable land + trees 2×2); `tests/integration/production-runner.test.ts` — "WR-02: generated maps seed deposits — a clay site on a deposit runs, one on bare land stays blocked" (seed 99): a staffed pit on a searched clay 2×2 is active and extracts (stock > 0) while a pit on a deposit-free area is staffed yet blocked with 0 output |
| **WR-03** `tickWorkshop` subtracts 1 unconditionally, depending on an unguarded whole-input invariant | ✅ fixed | `tickWorkshop` (`src/sim/production.ts`) now clamps the decrement: `s.inputs[i] = Math.max(0, (s.inputs[i] ?? 0) - 1)`, so workshop inputs can never go negative regardless of who wrote them (fractional hydration/feedstock paths included) (`50ae349`) | `tests/unit/workshop-blocked.test.ts` — "WR-03: a fractional/partial input can never drive workshop inputs negative" and "WR-03: partial-input degradation never produces a negative input across ticks" |
| IN-01 Extraction/farm `producedLastTick` overstates production at output-capacity ticks | ✅ fixed | Extraction sites and raw olive/grape farms now record the actually-applied delta (`before`/`after` stock diff) instead of the nominal `outputPerTick`, so a capacity-clamped tick reads `producedLastTick = 0` (`cb0ab32`) | `tests/integration/production-runner.test.ts` — "IN-01: extraction producedLastTick reports the real applied delta, not the nominal rate at capacity": at the 8-unit ceiling a tick reports 0; at 0.3 it reports exactly 0.3 |
| IN-02 `lastDestinationKind` written but never read | ✅ fixed | The field is now surfaced in the production advisor: `ProductionInternalNote`/`ProductionAdvisorRow` gain `destinationKind` and the runner records it in `productionNotes` (`9936082`) | `tests/unit/advisors.test.ts` — "IN-02: advisor rows surface the porter destination kind (workshop/warehouse), not just the id": every row carries legal values, and a proven forced delivery reads `destinationKind: 'warehouse'` + matching id |
| IN-03 Output porters only ever route to warehouses — §16.4 "needy workshop" branch unreachable for finished goods | ✅ fixed | The output-porter step (`src/sim/runner.ts`) now builds workshop candidates via `feedstockWorkshops` (accepts-aware) and lets `porterDestination` apply §16.4 priority (needy workshop > nearest warehouse), keeping the warehouse fallback (`b6eb15a`) | `tests/integration/production-runner.test.ts` — "IN-03: output porters route finished goods to a downstream workshop that requests the product (§16.4 priority)": with a (test-patched) metallurgy workshop requesting pottery, one output-porter load is delivered to the workshop's inputs and the advisor row reads `destinationKind: 'workshop'` |

## Acceptance Criteria

- [x] WARNINGS (3) fixed with tests: full-footprint deposit gate, seeded deposits in map generation, clamped workshop inputs
- [x] INFO (3) fixed where cheap and clearly correct: truthful producedLastTick, surfaced destinationKind, reachable workshop→workshop porters
- [x] Determinism preserved: seeded RNG only (`Math.random` never used); deposit seeding is seeded; identical-seed + same-map tests reproduce identical state
- [x] `npm run typecheck` — pass (0 errors)
- [x] `npm run lint` — pass (0 warnings)
- [x] `npm run check:military` — pass (clean)
- [x] `npm run test` — **467 passed** (baseline 459 + 8 new)
- [x] Golden snapshots **unchanged** (no `GOLDEN_UPDATE=1` run required — goldens use the fixed `foodChainMap`, so the seed-generated-map change does not affect them)
- [x] Each fix committed atomically as `fix(06): …`; `06-REVIEW.md` not committed

## Commit Hashes

- `c5689f0` feat(06): production & manufacturing — extraction, workshops, porter chain (baseline; the implementation was uncommitted before this fix pass)
- `50ae349` fix(06): WR-03 — clamp workshop input consumption so inputs can never go negative
- `4b72f7b` fix(06): WR-02 — seed deposits on generated maps so clay/iron/marble extraction is buildable in live play
- `cb0ab32` fix(06): WR-01 + IN-01 — deposit gate covers the full footprint; producedLastTick reports the applied delta
- `9936082` fix(06): IN-02 — surface the porter destination kind (workshop/warehouse) in production advisor rows
- `b6eb15a` fix(06): IN-03 — output porters consider downstream workshops (§16.4 priority); runner-level tests for WR-02/IN-01/IN-03
