# Phase 5: Agriculture & Food - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning (plan imported)
**Mode:** Smart discuss (autonomous batch acceptance) over imported plan 05-01

<domain>
## Phase Boundary

Deliver the full food supply chain as a vertical slice: production (wheat/vegetables/
orchard/meat/fish farms), physical loads moved by carriers, granary storage with
per-food orders and reservations, market demand/buyers/sellers, house inventory +
daily consumption + food variety evolution, import/export, and the management data
surface (HUD indicator, advisor, overlays, alerts). Requirements: AGRI-01, AGRI-02,
AGRI-03. Source spec: game-specs/fodd-supply-chain.md.
</domain>

<decisions>
## Implementation Decisions

### Scope (plan 05-01)
- Keep the imported plan 05-01 (7 tasks) as the complete Phase 5 vertical slice; no
  duplicate re-planning.
- Execute 05-01 as verify-as-built + gap-fill + test coverage on the existing
  food/logistics/trade code (consistent with Phases 1-4).

### Market/Trade/UI inclusion
- The market, trade, webs UI tasks in plan 05-01 are executed as the Phase-5
  food-chain slice (they are required for the vertical slice); later phases
  (7/8/9/18) verify the same code from their own perspective.

### Execution
- Plan 05-01 was author-approved at import (conflict report 0 blockers; structure
  valid); execute directly, then run post-execution verification.

### Determinism
- All 346 baseline tests stay green; goldens regenerate only on intentional
  mechanic change (documented).

### Claude's Discretion
Task-level implementation left to the executor within the imported plan's actions.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- src/sim/agriculture.ts — data-driven farm types with fertility-based production
  (wheat/vegetables/orchard/animals/olives/vines/fishing) and granary policy.
- src/sim/logistics.ts — warehouse policy, market config, reservations, supplier
  selection, logistics advisor data.
- src/sim/transport.ts, src/sim/walkers.ts — carrier/buyer/seller walkers.
- src/sim/housing.ts / housingEvolution.ts — house food consumption + evolution.
- src/sim/trade.ts — external trade.
- tests: tests/unit/agriculture.test.ts, logistics.test.ts, tests/integration/food-chain.test.ts,
  supply-chains.test.ts.

### Established Patterns
- Deterministic seeded sim core under src/sim/; Phaser view-only.
- Physical loads moved by walkers (no teleporting stock) — project core value.
- Vitest suite; goldens via npm run test:golden:update only on intentional changes.

### Integration Points
- SimRunner.tick() drives producers/logistics; snapshots feed UI.
- Planner plan 05-01 lists exact file targets and add test files.
</code_context>

<specifics>
## Specific Ideas

No additional requirements beyond the imported spec (game-specs/fodd-supply-chain.md)
and the accepted decisions above.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 5 scope.
</deferred>
