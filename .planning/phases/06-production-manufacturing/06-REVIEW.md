---
phase: 06-production-manufacturing
reviewed: 2026-08-03T18:00:00Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - src/sim/production.ts
  - src/sim/buildings.ts
  - src/sim/types.ts
  - src/sim/runner.ts
  - src/sim/advisors.ts
  - src/sim/walkers.ts
  - src/game/buildingArt.ts
  - src/game/palette.ts
  - tests/helpers.ts
  - tests/unit/advisors.test.ts
  - tests/unit/extraction.test.ts
  - tests/unit/production-pipeline.test.ts
  - tests/unit/workshop-blocked.test.ts
  - tests/integration/production-chain.test.ts
  - tests/integration/production-runner.test.ts
  - tests/determinism/production-chain-determinism.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-08-03T18:00:00Z
**Depth:** deep
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the Phase 6 production & manufacturing implementation: the pure model
gates in `src/sim/production.ts` (satisfiesDeposit/canExtract, porterDestination,
porterDeliversTo, tickWorkshop, workshopBottleneck), the 12 new runtime building
types in `buildings.ts`/`types.ts`, `SimRunner.tickProduction()` wiring, the
live-state production advisor in `advisors.ts`/`runner.ts`, and the 6 new/1
extended test files.

The core claims hold up under tracing:

- **Determinism:** `tickProduction` iterates buildings in stable placement order,
  uses no `Math.random`/`Date`; the chunked-tick (1/7/50) and save/load round-trip
  tests pass, and `getStateJson` is byte-identical across batching.
- **Deposit gate:** off-deposit sites are genuinely blocked (zero output,
  `blocked` status) and the gate is pure; see WR-01 for a footprint-coverage gap
  and WR-02 for the never-populated deposit surface.
- **Destination policy:** `porterDestination` picks neediest valid workshop then
  nearest valid warehouse then null; conservation is exact (source −1, dest +1).
- **No-loss:** `moveStock`/`porterDeliversTo` are bounded by capacity, never move
  fractional units, and a full/blocked destination keeps the load; no silent
  destruction or negative stock found.
- **Advisor:** every row/summary value is derived from live `BuildingInstance`
  state (`productionNotes`), with a SimState-only 'idle' fallback — nothing
  fabricated.
- **No military tokens** (`npm run check:military` clean).

Tool results: `npm run typecheck` clean, `npm run lint` clean (0 warnings),
`npm run test` 459/459 pass (63 files), `npm run check:military` clean.

Findings are non-blocking: 3 warnings (enforcement/gameplay gaps and an
invariant-dependency in the workshop tick) and 3 info items.

## Warnings

### WR-01: Deposit gate checks only the anchor tile, not the whole footprint

**File:** `src/sim/runner.ts:850-852`
**Issue:** `tickProduction` evaluates `satisfiesDeposit` using only the anchor
tile `(b.x, b.y)`'s terrain/resourceType. Plan 06-01 states a site "whose
footprint actually sits on the required deposit" must be the requirement. A 2x2
clay pit (or 3x3 quarry) whose anchor lands on the deposit but whose remaining
tiles are off-deposit still extracts at full rate. No test covers the
partial-footprint case (tests stamp the deposit to exactly match the footprint).
**Fix:** Check every footprint tile — e.g. require each of the `footprint²`
tiles to satisfy the deposit (loop `dy/dx` over the footprint and AND the per-tile
`satisfiesDeposit` result), or stamp deposits at least as large as the largest
footprint and document anchor-only as the contract.

### WR-02: Deposits are never populated by map generation — clay/iron/marble extraction is permanently blocked in live play

**File:** `src/sim/runner.ts:851`, `src/sim/map.ts:63-112`
**Issue:** `TileState.resourceType` is only ever written by the test-only
`Map.mutateTileState` (tests/helpers.ts). `Map.generate()` never stamps
`clay_deposit`/`iron_deposit`/`marble_deposit`, so on every generated map (i.e.
real gameplay) the clay pit, iron mine, and marble quarry are permanently
blocked by their own gate — only the timber yard can ever produce (trees
terrain). `06-CONTEXT.md` notes the surface is "never populated today", and the
ROADMAP has no later phase that populates deposits, so this is a live gameplay
gap, not just a test artifact.
**Fix:** Populate deposits during `Map.generate` (e.g. carve deposit resourceTypes
co-located with rock/earth clusters sized to the extraction footprints), or at a
minimum schedule it explicitly and record the current limitation as a known
liability in the phase VERIFICATION/SUMMARY.

### WR-03: tickWorkshop consumes a whole input unit unconditionally, depending on an unguarded integer invariant

**File:** `src/sim/production.ts:138`
**Issue:** `tickWorkshop` subtracts exactly 1 from every input once `workshopStatus`
reports 'working', which requires only `input > 0`. The conservation guarantee
("no negative workshop inputs") therefore rests on an external invariant — that
inputs are always whole numbers because the only writer (`moveStock`) moves whole
units. Any future writer that injects a fractional input (save hydration of
production state, a fractional feedstock path, farm→workshop delivery) silently
drives workshop inputs negative with no assertion or clamp. This is exactly the
failure mode Phase 6's no-loss tests guard against.
**Fix:** Clamp the decrement, e.g. `s.inputs[i] = Math.max(0, (s.inputs[i] ?? 0) - 1);`
(consuming `Math.min(1, input)` if fractional consumption is preferred), so the
no-negative-input property holds regardless of who wrote the input.

## Info

### IN-01: Extraction/farm `producedLastTick` overstates output when stock is at capacity

**File:** `src/sim/runner.ts:855,863`
**Issue:** At `EXTRACTION_OUTPUT_CAPACITY` the stock add is clamped to 0 new
units, but `b.lastProduced` still records the full `outputPerTick` (0.3), so the
advisor row reports "produced 0.3" on a tick where nothing was actually added.
Workshops are correct (`tickWorkshop` returns the real produced delta).
**Fix:** Record the actually-applied delta: `const before = stock; b.stock = Math.min(8, before + perTick); b.lastProduced = (b.stock - before);` for both
extraction sites and olive/grape farms.

### IN-02: `lastDestinationKind` is written but never read

**File:** `src/sim/walkers.ts:108`, `src/sim/runner.ts:893,901,915,923,930,936`
**Issue:** `BuildingInstance.lastDestinationKind` is set in six places but no code
reads it; advisors use only `lastDestinationId`. Dead field adds surface without
behavior.
**Fix:** Either surface it in the advisor row (destination kind) or remove it.

### IN-03: Output porters only ever route to warehouses — the §16.4 "needy workshop" branch is never exercised for finished goods

**File:** `src/sim/runner.ts:919`
**Issue:** The output-porter step passes `[]` as the workshop candidate list, so
finished goods (pottery, furniture, wine, oil, tools) can only reach warehouses.
The model's workshop-priority branch (`porterDestination`) is exercised only for
raw feedstock. This is harmless with current data (no workshop consumes another
workshop's output) but means the "needy workshop > warehouse" claim is only
half-realized at the runner level and any future good that is both an output and
an input would be misrouted.
**Fix:** Build workshop candidates for output porters via `feedstockWorkshops`
(or an accepts-aware equivalent) and let `porterDestination` decide, keeping the
warehouse fallback.

---

_Reviewed: 2026-08-03T18:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
