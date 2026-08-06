---
phase: 11-civil-safety
plan: 11-plan
type: feature (multi-wave: 11-W1..11-W3)
wave: 0
depends_on: [10-W3, 04-W3]
files_modified:
  - src/sim/types.ts
  - src/sim/runner.ts
  - src/sim/walkers.ts
  - src/sim/walkerProfiles.ts
  - src/sim/safety.ts
  - src/sim/advisors.ts
  - data/buildings.ts
  - data/walkers.ts
  - data/balance.ts
  - tests/unit/safety.test.ts
  - tests/unit/fire-service.test.ts
  - tests/unit/collapse.test.ts
  - tests/unit/security.test.ts
  - tests/integration/civilization-overlay.test.ts
  - tests/determinism/safety-determinism.test.ts
autonomous: true
requirements: [SAFE-01, SAFE-02, SAFE-03]
must_haves:
  truths:
    - "SAFE-01 fire service is real: fire_station spawns fireman walkers (via the spawnedBy catalog, not the building-type-as-walker bug), firemen extinguish burning buildings (tickFire brigadeResponse from nearby firemen), fire risk rises with building density (computeRisks density factor), and fire coverage is wired into the runner risk computation (currently hardcoded 0)."
    - "SAFE-02 collapse is real: engineer_post spawns engineer walkers that reduce collapse risk; aging buildings and earthquake events raise collapse risk; danger states (damaged/burning/collapse-risk) are surfaced in the civilization overlay."
    - "SAFE-03 security is real: prefecture + marshal buildings/walkers (peaceful — calm protests, never attack, no military tokens) reduce crime; the civilization overlay reflects fire/collapse/crime coverage per tile."
    - "The civilization overlay is a per-tile grid (overlaysFrom pattern) derived from live sim state — never fabricated; SimState stays frozen so goldens never regenerate."
    - "Determinism & no military: safety chain is tick-based/seeded only (chunked 1/7/50 identity); the no-RNG/clock source audit is green for safety/walkers; check:military stays clean."
  artifacts:
    - path: src/sim/types.ts
      provides: "WalkerType union extended additively with fireman/engineer/prefecture/marshal"
      min_lines: 4
    - path: src/sim/runner.ts
      provides: "spawner maps building type → walker id via spawnedBy; fire/engineer/security coverage wired into computeRisks; civilization overlay accessor"
      min_lines: 40
    - path: src/sim/walkers.ts
      provides: "fireman/engineer/prefecture/marshal coverage + fire-extinguish/repair behavior in SERVICE_BY_WALKER"
      min_lines: 30
    - path: src/sim/safety.ts
      provides: "additive fire-extinguish/repair/crime-coverage helpers (computeRisks/tickFire preserved)"
      min_lines: 20
    - path: src/sim/advisors.ts
      provides: "civilizationOverlayData per-tile grid (fire/collapse/crime) + safety advisor"
      min_lines: 40
    - path: data/buildings.ts
      provides: "prefecture + marshal building defs (peaceful, no military tokens)"
      min_lines: 10
    - path: data/walkers.ts
      provides: "prefecture/marshal walker catalog entries"
      min_lines: 4
    - path: data/balance.ts
      provides: "safety constants (fire extinguish radius, crime coverage gain, etc.)"
      min_lines: 4
    - path: tests/unit/fire-service.test.ts
      provides: "fireman spawn + extinguish + density risk tests"
      min_lines: 40
    - path: tests/unit/collapse.test.ts
      provides: "engineer repair + aging/earthquake collapse + danger state tests"
      min_lines: 40
    - path: tests/unit/security.test.ts
      provides: "prefecture/marshal crime reduction tests"
      min_lines: 40
    - path: tests/integration/civilization-overlay.test.ts
      provides: "end-to-end overlay reflects fire/collapse/crime coverage"
      min_lines: 40
    - path: tests/determinism/safety-determinism.test.ts
      provides: "chunked 1/7/50 identity + no-RNG/clock source audit"
      min_lines: 40
---

# Phase 11 Plan: Civil Safety

**Goal**: Fire, collapse/danger, security/crime, and the civilization overlay.
**Phase**: 11-civil-safety
**Requirements**: SAFE-01, SAFE-02, SAFE-03

## Requirements Mapping

| Requirement | Implementation | Where |
|-------------|---------------|-------|
| SAFE-01 fire risk rises with density | `computeRisks` density factor — EXISTS | `src/sim/safety.ts` |
| SAFE-01 firemen extinguish fires | fireman walkers + tickFire brigadeResponse — gap-fill | `src/sim/walkers.ts`, `src/sim/runner.ts` |
| SAFE-01 fire coverage wired | runner risk computation uses fireCoverage (currently hardcoded 0) — gap-fill | `src/sim/runner.ts` |
| SAFE-02 aging/event collapse | `computeRisks` ageMonths + earthquake events — EXISTS (model), wire events — gap-fill | `src/sim/safety.ts`, `data/events.ts` |
| SAFE-02 danger/repair states | `damaged` flag + engineer repair — gap-fill | `src/sim/safety.ts`, `src/sim/walkers.ts` |
| SAFE-03 prefecture/marshal reduce crime | new buildings/walkers + securityCoverage — gap-fill | `data/buildings.ts`, `data/walkers.ts`, `src/sim/runner.ts` |
| SAFE-03 civilization overlay | per-tile grid (overlaysFrom pattern) — gap-fill | `src/sim/advisors.ts` |

## Audit Result (verify-as-built)

Already works and stays untouched:
- `computeRisks` (fire/collapse/crime from density/age/coverage) — tests/unit/safety.test.ts
- `tickFire` lifecycle (none→burning→evacuating→destroyed)
- `guardPatrol` (peaceful protest calming)
- fire/collapse/earthquake events in data/events.ts
- Overlay infrastructure (overlaysFrom, waterOverlayData, foodOverlayGrids)

Gap-fill (the actual work):
- Spawner: map building type → walker id via `spawnedBy` (fire_station → fireman, engineer_post → engineer) instead of `b.type as WalkerType`
- WalkerType union: add fireman/engineer/prefecture/marshal (additive)
- Fireman walkers extinguish burning buildings; fire coverage wired into runner risk
- Engineer walkers repair/reduce collapse; earthquake events raise collapse risk; danger states surfaced
- Prefecture + marshal buildings/walkers (peaceful); crime reduced by coverage
- Civilization overlay per-tile grid (fire/collapse/crime) + safety advisor

## Verification Approach

- Wave-level: `npm run test` green (baseline 644 + new tests) after each wave
- Full: `npm run typecheck && npm run test && npm run check:military`
- Determinism: chunked 1/7/50 safety determinism test; no Math.random/Date.now
- Goldens: `SimState` shape unchanged (additive accessors only) → golden fixtures green without regeneration

---

# Wave 11-W1 — Fire service (SAFE-01)

<tasks>

<task type="auto">
  <name>11-W1-1: Spawner fix — building type → walker id via spawnedBy catalog (additive)</name>
  <files>src/sim/runner.ts, src/sim/types.ts, src/sim/walkerProfiles.ts, tests/unit/fire-service.test.ts</files>
  <read_first>src/sim/runner.ts (spawner 1240-1263, active gate 1242, adjacentRoadTile, createWalker), src/sim/types.ts (WalkerType 32-40), data/walkers.ts (spawnedBy catalog), src/sim/walkerProfiles.ts (walkerProfile 104-118, CATEGORY_BY_ID 39-77)</read_first>
  <action>Read the spawner and catalog before editing. The spawner currently uses `b.type as WalkerType` — so fire_station spawns a `fire_station` walker (not in SERVICE_BY_WALKER, inert). Fix additively:
  (1) types.ts: extend `WalkerType` union with `'fireman' | 'engineer' | 'prefecture' | 'marshal'` (additive union extension — no exhaustive switches exist; walker code uses SERVICE_BY_WALKER lookups and `w.type === 'well'` checks).
  (2) runner.ts spawner: build a reverse lookup from the walker catalog — `walkerIdForBuilding(b.type)` returns the catalog walker id whose `spawnedBy` includes b.type (fire_station → fireman, engineer_post → engineer, clinic → doctor, school → teacher, library → librarian, temple → priest, theatre → entertainer, forum → official). When a building has a catalog walker, spawn that walker id instead of `b.type as WalkerType`; keep the existing well/market/house/labor behavior unchanged (well/fountain → well, market → market, house → labor). Additive: buildings without a catalog walker keep the current `b.type as WalkerType` fallback.
  (3) walkerProfiles.ts: ensure `walkerProfile('fireman')`/`walkerProfile('engineer')` resolve (CATEGORY_BY_ID already has fireman/engineer; WALKERS catalog has them) — no change needed unless profile lookup fails.
  Create tests/unit/fire-service.test.ts: (1) placing a fire_station with workers assigned spawns a walker of type 'fireman' (not 'fire_station') after spawnCooldown ticks; (2) the fireman walker wanders and applies fire coverage to adjacent houses (SERVICE_BY_WALKER['fireman'] = 'fire'); (3) regression: well/market/house still spawn their existing walker types; (4) all baseline walker tests stay green.</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/fire-service.test.ts tests/unit/walkers.test.ts && npm run test</automated>
  </verify>
  <done>fire-service.test.ts passes: fire_station spawns fireman walkers via the spawnedBy catalog, firemen apply fire coverage, well/market/house spawn behavior unchanged, and the full 644-test suite + goldens stay green.</done>
</task>

<task type="auto">
  <name>11-W1-2: Fireman extinguish burning buildings + fire coverage wired into runner risk (SAFE-01)</name>
  <files>src/sim/walkers.ts, src/sim/safety.ts, src/sim/runner.ts, data/balance.ts, tests/unit/fire-service.test.ts</files>
  <read_first>src/sim/walkers.ts (updateWalker 192-230, applyCoverage 220-230, SERVICE_BY_WALKER 100-108), src/sim/safety.ts (tickFire 51-66, computeRisks 31-47), src/sim/runner.ts (risk computation 672-685, tick order, building fire state), data/balance.ts (safety constants)</read_first>
  <action>Read the fire lifecycle and risk computation before editing. Additive:
  (1) safety.ts: add `fireExtinguish(burning: boolean, firemenNearby: number, radius: number): boolean` — a burning building is extinguished when firemen are within radius (deterministic, no RNG). Keep tickFire/computeRisks signatures unchanged.
  (2) walkers.ts: fireman walkers, when wandering, mark nearby burning buildings as extinguished (via sim internals — check how walkers access buildings; use the sim.buildings registry and a fire state field on BuildingInstance, additive `fire?: { phase: FirePhase; hazard: number }`). SERVICE_BY_WALKER['fireman'] = 'fire' for house coverage.
  (3) runner.ts: (a) buildings can catch fire — in the tick, a building with density above a threshold and fireCoverage below a threshold may enter 'burning' phase (deterministic: seeded RNG or tick-based hazard, no Math.random); (b) wire fire coverage into the risk computation at 672-685: replace hardcoded `fireCoverage: 0` with a live coverage value derived from nearby fire_stations/firemen; (c) burning buildings are extinguished when firemen are nearby (fireExtinguish); (d) add `CONFIG.fireHazardThreshold`, `CONFIG.fireExtinguishRadius` to data/balance.ts.
  Extend tests/unit/fire-service.test.ts: (5) a building with high density and no fire coverage catches fire (phase 'burning'); (6) placing a fire_station + spawning firemen extinguishes the burning building within fireExtinguishRadius; (7) fire risk rises with density (computeRisks density factor — assert higher density → higher fireRisk); (8) fire coverage lowers fireRisk in the runner risk computation.</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/fire-service.test.ts && npm run test</automated>
  </verify>
  <done>fire-service.test.ts passes: buildings catch fire deterministically, firemen extinguish burning buildings within radius, fire risk rises with density and falls with coverage, and the full suite + goldens stay green.</done>
</task>

</tasks>

---

# Wave 11-W2 — Collapse + security (SAFE-02, SAFE-03)

<tasks>

<task type="auto">
  <name>11-W2-1: Engineer repair + aging/earthquake collapse + danger states (SAFE-02)</name>
  <files>src/sim/walkers.ts, src/sim/safety.ts, src/sim/runner.ts, data/balance.ts, tests/unit/collapse.test.ts</files>
  <read_first>src/sim/safety.ts (computeRisks collapseRisk 31-47, damaged flag), src/sim/runner.ts (risk computation 672-685, event system 230-245, earthquake event), data/events.ts (earthquake), src/sim/walkers.ts (SERVICE_BY_WALKER, updateWalker)</read_first>
  <action>Read the collapse model and event system before editing. Additive:
  (1) safety.ts: add `repairCollapse(damaged: boolean, engineersNearby: number, radius: number): boolean` — a damaged/collapse-risk building is repaired when engineers are within radius. Keep computeRisks/tickFire unchanged.
  (2) walkers.ts: engineer walkers, when wandering, repair nearby damaged buildings (via sim internals). SERVICE_BY_WALKER['engineer'] = 'engineer' for house coverage.
  (3) runner.ts: (a) aging buildings accumulate collapse risk (computeRisks ageMonths already uses tickCount/40 — wire the real age); (b) earthquake events (data/events.ts) raise collapse risk for affected buildings (deterministic, seeded); (c) wire engineer coverage into the risk computation (replace hardcoded engineerCoverage: 0); (d) damaged/collapse-risk buildings show danger states (additive `danger?: 'collapse-risk' | 'burning' | 'damaged'` on BuildingInstance, surfaced via getState or advisor); (e) add `CONFIG.collapseRepairRadius`, `CONFIG.earthquakeCollapseBoost` to data/balance.ts.
  Create tests/unit/collapse.test.ts: (1) an aging building (many ticks) has rising collapseRisk; (2) an earthquake event raises collapse risk for affected buildings; (3) placing an engineer_post + spawning engineers repairs a damaged building within collapseRepairRadius; (4) danger state 'collapse-risk' appears on a high-collapse building; (5) engineer coverage lowers collapseRisk in the runner risk computation.</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/collapse.test.ts && npm run test</automated>
  </verify>
  <done>collapse.test.ts passes: aging + earthquake events raise collapse risk, engineers repair damaged buildings, danger states surface, engineer coverage lowers collapseRisk, and the full suite + goldens stay green.</done>
</task>

<task type="auto">
  <name>11-W2-2: Prefecture + marshal buildings/walkers reduce crime (SAFE-03)</name>
  <files>data/buildings.ts, data/walkers.ts, src/sim/types.ts, src/sim/walkers.ts, src/sim/runner.ts, data/balance.ts, tests/unit/security.test.ts</files>
  <read_first>data/buildings.ts (fire_station 177-180 pattern), data/walkers.ts (catalog pattern), src/sim/types.ts (BuildingType 17-30, WalkerType 32-40), src/sim/walkers.ts (SERVICE_BY_WALKER, guardPatrol usage), src/sim/runner.ts (risk computation 672-685, spawner 1240-1263), src/sim/safety.ts (guardPatrol 68-75)</read_first>
  <action>Read the building/walker catalog patterns before editing. Additive, peaceful (no military tokens):
  (1) data/buildings.ts: add `prefecture` (category 'safety', cost ~200, footprint 2x2, workers 6, requiresRoad, spawns ['marshal'], serviceRadius) and `marshal` building if needed (or prefecture spawns marshal walkers directly). Follow the fire_station def pattern.
  (2) data/walkers.ts: add `prefecture`/`marshal` catalog entries (service 'security', spawnedBy ['prefecture']).
  (3) types.ts: add 'prefecture' to BuildingType and 'marshal' to WalkerType (additive).
  (4) walkers.ts: SERVICE_BY_WALKER['marshal'] = 'security'; marshal walkers reduce crime near houses (guardPatrol for protests, plus crime coverage).
  (5) runner.ts: wire security coverage into the risk computation (replace hardcoded securityCoverage: 0 with live coverage from prefecture/marshal); crime reduced by coverage.
  (6) data/balance.ts: `CONFIG.prefectureCost`, `CONFIG.securityCoverageGain` (if needed).
  Create tests/unit/security.test.ts: (1) placing a prefecture spawns marshal walkers; (2) marshal walkers apply security coverage to adjacent houses; (3) crime falls as security coverage rises (computeRisks securityCoverage factor); (4) guardPatrol calms protests peacefully (no attack — check:military clean); (5) security coverage lowers crime in the runner risk computation.</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/unit/security.test.ts && npm run test && npm run check:military</automated>
  </verify>
  <done>security.test.ts passes: prefecture spawns marshal walkers, marshals apply security coverage, crime falls with coverage, guardPatrol is peaceful, check:military stays clean, and the full suite + goldens stay green.</done>
</task>

</tasks>

---

# Wave 11-W3 — Civilization overlay + determinism (SAFE-03)

<tasks>

<task type="auto">
  <name>11-W3-1: Civilization overlay per-tile grid + safety advisor (SAFE-03)</name>
  <files>src/sim/advisors.ts, src/sim/runner.ts, tests/integration/civilization-overlay.test.ts</files>
  <read_first>src/sim/advisors.ts (overlaysFrom 127-145, waterOverlayData 166-172, foodOverlayGrids 502-507), src/sim/runner.ts (getOverlay accessor pattern, risk computation 672-685, derived snapshot)</read_first>
  <action>Read the overlay patterns before writing. Additive:
  (1) src/sim/advisors.ts — add exported pure projection `civilizationOverlayData(state: SimState, risks: Record<number, RiskModel>): Record<string, number[][]>` returning per-tile grids keyed by 'fireRisk' | 'collapseRisk' | 'crime' (and 'danger' for damaged/burning tiles), using overlaysFrom. Every value derived from live sim state — never fabricated.
  (2) src/sim/runner.ts — `getCivilizationOverlay(): Record<string, number[][]>` delegating to civilizationOverlayData with the live per-building RiskModel (from the wired computeRisks). Additive accessor; SimState unchanged.
  (3) Create tests/integration/civilization-overlay.test.ts: (a) a city with a fire_station + engineer_post + prefecture produces overlay grids where fireRisk/collapseRisk/crime are lower near coverage; (b) a burning building shows 'danger' in the overlay; (c) the overlay grids are the right shape (width × height) and values are 0..1; (d) live accessor reconciles against the runner's risk computation.</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/integration/civilization-overlay.test.ts && npm run test</automated>
  </verify>
  <done>civilization-overlay.test.ts passes: the civilization overlay returns per-tile fire/collapse/crime/danger grids derived from live sim state, coverage lowers risk values, and the full suite + goldens stay green.</done>
</task>

<task type="auto">
  <name>11-W3-2: Safety chunked determinism + RNG/clock audit</name>
  <files>tests/determinism/safety-determinism.test.ts</files>
  <read_first>tests/determinism/market-chain-determinism.test.ts (chunked pattern 26-62, source audit 177-187), tests/determinism/finance-determinism.test.ts</read_first>
  <action>Read the determinism test patterns before writing. Create tests/determinism/safety-determinism.test.ts:
  (1) chunked identity — same seed + same commands (place fire_station + engineer_post + prefecture + houses + ticks) produce byte-identical `getStateJson()` for chunk sizes 1/7/50 over a production-style map (buildProductionCity) for seeds {1, 7, 1337}; (2) same-seed run twice → identical JSON; (3) different seeds runnable without crashing; (4) source audit — src/sim/safety.ts, src/sim/walkers.ts and the runner's safety tick contain no Math.random()/Date.now()/new Date() invocations (file-read regex pattern; exclude runner.ts Date.now savedAt with the same scoping note as trade-determinism).</action>
  <verify>
    <automated>npm run typecheck && npx vitest run tests/determinism/safety-determinism.test.ts && npm run test && npm run check:military</automated>
  </verify>
  <done>safety-determinism.test.ts passes: the safety chain reproduces byte-identical getStateJson under chunks 1/7/50 across seeds {1,7,1337}, same-seed identity holds, the no-RNG/clock source audit is green for safety/walkers, and check:military is clean; full suite green.</done>
</task>

</tasks>

---

## Threat Model

| Threat ID | Category | Component | Severity | Disposition | Mitigation |
|-----------|----------|-----------|----------|-------------|------------|
| T-11-01 | Tampering | Fire spawn non-deterministic (Math.random) | high | mitigate | Tick-based hazard + seeded RNG only; chunked determinism test (W3-2) |
| T-11-02 | Tampering | Fireman/engineer coverage double-count | high | mitigate | Single coverage path via SERVICE_BY_WALKER + sim internals; overlay reconciliation tests |
| T-11-03 | Repudiation | Collapse/repair teleport (damaged → repaired without engineer) | high | mitigate | repairCollapse requires engineers within radius; test (W2-1 #3) |
| T-11-04 | Tampering | Military content in safety (guards attack) | high | mitigate | guardPatrol/marshal peaceful only; check:military gate (W2-2 #4) |
| T-11-05 | Tampering | Crime reduction bypass (coverage ignored) | medium | mitigate | securityCoverage wired into computeRisks; test (W2-2 #3/#5) |
| T-11-06 | Privacy | none (pure model) | low | accept | Civilization overlay is a pure projection of runner state |

## Verification

- `npm run test` (full suite, golden + determinism + property included) and `npm run typecheck` after every wave; `npm run check:military` after 11-W2 and 11-W3.
- Per-wave spot-checks:
  - 11-W1: `npx vitest run tests/unit/fire-service.test.ts tests/unit/walkers.test.ts`
  - 11-W2: `tests/unit/collapse.test.ts` + `tests/unit/security.test.ts`
  - 11-W3: `tests/integration/civilization-overlay.test.ts` + `tests/determinism/safety-determinism.test.ts`; confirm `tests/golden/golden.test.ts` and `tests/integration/food-slice.test.ts` green WITHOUT golden regeneration.

## Success Criteria

- Buildings can catch fire and be extinguished by firemen; fire risk rises with density (SAFE-01).
- Aging/event-damaged buildings risk collapse and show danger states (SAFE-02).
- Prefecture/marshal coverage reduces crime; the civilization overlay reflects it (SAFE-03).
- All deterministic; no military tokens; SimState frozen; goldens green without regeneration; 644 baseline + additions green; typecheck clean.

## Output

Create `.planning/phases/11-civil-safety/11-SUMMARY.md` when done.
