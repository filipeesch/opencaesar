# Phase 11: Civil Safety - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning
**Mode:** Auto-generated (smart-discuss, all grey areas pre-accepted by user)

<domain>
## Phase Boundary

Fire, collapse/danger, security/crime, and the civilization overlay.

Success criteria (from ROADMAP):
1. Buildings can catch fire and be extinguished by firemen; fire risk rises with density.
2. Aging/event-damaged buildings risk collapse and show danger states.
3. Prefecture/marshal coverage reduces crime; the civilization overlay reflects it.

Requirements: SAFE-01 (fire service + building fires), SAFE-02 (collapse risk + danger/repair states), SAFE-03 (security + civilization overlay).
</domain>

<decisions>
## Implementation Decisions

### Pre-Accepted Grey Areas (user approved all, do not re-ask)
- **Verify-as-built**: Audit existing safety code against SAFE-01/02/03; gap-fill, do not rebuild. The repo already has `src/sim/safety.ts` (computeRisks fire/collapse/crime, tickFire lifecycle, guardPatrol), `data/events.ts` (fire/collapse/earthquake events), `data/walkers.ts` catalog (fireman spawnedBy fire_station, engineer spawnedBy engineer_post), `src/sim/walkerProfiles.ts` (fireman/engineer categories), and advisor overlay infrastructure (overlaysFrom, waterOverlayData, foodOverlayGrids).
- **Gap-fill + add tests**: Missing SAFE pieces (fireman walkers that extinguish, engineer walkers that repair, prefecture/marshal buildings + walkers, civilization overlay, wiring coverage into runner risk computation) become additive features + tests. All existing tests stay green.
- **Determinism**: Seeded RNG only, never `Math.random`/`Date.now`; no unseeded iteration order; goldens regenerate only on intentional mechanic change via `GOLDEN_UPDATE=1 npm run test:golden:update`.
- **No military content**: Keep `check:military` clean. Guards/marshals are peaceful (calm protests, never attack) — no military tokens.
- **Live-derived data**: Advisor/overlay data derived from real sim state, never fabricated.
- **Additive API**: Keep existing exported signatures stable; new surfaces additive.

### Agent's Discretion
- Follow Caesar 3 safety model: fire stations spawn firemen who extinguish burning buildings; engineer posts spawn engineers who repair/clear collapse; prefecture + marshal walkers reduce crime; fire risk rises with building density; aging buildings + earthquake events raise collapse risk; danger states (damaged/burning/collapse-risk) visible in the civilization overlay.
- The civilization overlay is a per-tile grid (like water/food overlays) reflecting fire risk, collapse risk, and crime/security coverage.

</decisions>

<code_context>
## Existing Code Insights

- `src/sim/safety.ts`: `computeRisks` (fire/collapse/crime from density/age/coverage), `tickFire` lifecycle (none→burning→evacuating→destroyed), `guardPatrol`. Model exists, NOT wired to runner coverage.
- `src/sim/runner.ts`: risk computation at 672-685 uses `computeRisks` with hardcoded coverage 0; spawner at 1244-1263 uses `b.type as WalkerType` (creates `fire_station`/`engineer_post` walkers, not `fireman`/`engineer`); `SERVICE_BY_WALKER` in walkers.ts maps clinic/school/library/temple/theatre but no fireman/engineer/prefecture/marshal.
- `data/walkers.ts`: catalog has `fireman` spawnedBy `fire_station`, `engineer` spawnedBy `engineer_post` — the spawner ignores `spawnedBy`.
- `data/buildings.ts`: `fire_station` (safety, cost 150, spawns fireman), `engineer_post` (engineering, cost 60, spawns engineer). NO prefecture/marshal buildings.
- `data/events.ts`: fire/collapse/earthquake events exist.
- `src/sim/advisors.ts`: `overlaysFrom` + water/food overlay grids; civilization overlay would follow the same pattern.
- `src/sim/walkerProfiles.ts`: CATEGORY_BY_ID has fireman/engineer/doctor/etc.; walkerProfile(id) uses WALKERS[id] catalog.

Codebase context will be deepened during plan-phase research.
</code_context>

<specifics>
## Specific Ideas

- SAFE-01: Fix the spawner to map building type → walker id via `spawnedBy` (fire_station → fireman); fireman walkers extinguish burning buildings (tickFire with brigadeResponse from nearby firemen); fire risk rises with density (computeRisks already); wire fire coverage into runner risk computation.
- SAFE-02: engineer walkers reduce collapse risk; aging + earthquake events raise collapse risk; danger states (damaged/burning/collapse-risk) surfaced.
- SAFE-03: add prefecture + marshal buildings/walkers (peaceful); crime reduced by coverage; civilization overlay grid reflecting fire/collapse/crime.
</specifics>

<deferred>
## Deferred Ideas

- Full safety management UI screens → Phase 18 Management UI.
- Campaign safety scenarios → Phase 17.
</deferred>
