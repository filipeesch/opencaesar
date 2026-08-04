# Phase 14 Validation — Governance & Requests (GOV-01, GOV-02)

## Success criteria evidence
- **SC1 Government buildings unlock at population thresholds with effects**:
  - Placement gate: forum/senate/palatine rejected with `not-unlocked` below their population threshold, accepted above (integration test).
  - Effects live: forum placed → requests enabled; senate placed → salary payable monthly (`governor` expense, personal account); palatine placed → grand send-off request eligible. All exposed via `getGovernance()`.
- **SC2 Requests accepted, satisfied (full or partial), rewarded/penalized by deadline**:
  - Partial delivery accumulates (`deliverGoods`/`payRequest`); full → reward income; deadline exceeded → penalty expense; population requests check themselves monthly. Deterministic from seed+tick (no RNG object, no clock).

## Determinism
- Chunked 1/7/50 byte-identical for seeds 1/7/1337 with forum+senate city, salary/donation/delivery commands, 460 ticks.
- Save→load replay byte-identical (all 4 new commands round-trip via `applyCommand`).
- Source audit: no `Math.random()`/`Date.now()`/`new Date()` in `governance.ts`, `governor.ts`, `data/requests.ts`, and the runner's governance paths.

## Gates
- `npm run typecheck` · full `npx vitest run` green · `npm run lint` 0 warnings · `npm run check:military` clean · goldens untouched.

## Notes
- Favor (donations) uses the existing live favor clamp from Phase 13; governor favor rating decomposition lands in Phase 15.
- Requests have no UI window (Phase 18); sim-level APIs + advisor data only.
