# OpenCaesar

## What This Is

OpenCaesar is a browser-based Caesar-style city-builder (TypeScript + Phaser 3.90)
with a framework-free, deterministic simulation core under `src/sim/`. Players lay
roads, houses, farms, water, industry, and civic buildings while managing population,
goods logistics, trade, finance, and city ratings. A full `src/game/` Phaser view
renders the city and a Caesar III-style management UI (right sidebar, advisor drawer,
overlays, inspectors — keyboard-first).

## Core Value

A deterministic, frame-rate-independent city simulation where buildings, goods,
services, and residents interact through physical, road-delivered systems — never
an opaque "teleporting stock" or radious-only model.

## Current State: v1.1 Shipped (2026-08-07)

v1.1 delivered the Caesar III-style management UI: right sidebar (build panel,
tools, speed, overlays), 13-advisor drawer with live sim data, per-service overlay
color ramps with legends and click-through, sidebar inspector cards with same-kind
cycling, keyboard-first navigation (A/←/→/Escape/B/1-5), and UPPERCASE labels —
plus all three deferred Phase-18 UI-review fixes. View-only: `src/sim/` byte-identical,
zero innerHTML, 1028 vitest + 28 e2e tests green. 4 tech-debt items deferred (see
`.planning/v1.1-MILESTONE-AUDIT.md`).

## Next Milestone Goals (v2.0)

- Military system (per game.md §1) once decided — currently enforced absent by CI gate
- Remaining 18-UI-SPEC deferred copy states ("No messages yet", "Nothing highlighted")
- Coverage overlay 3-channel per-service hues (revisit W-2 decision)
- Further game.md vertical slices beyond the v1.x UI milestone

## Requirements

### Validated

- Seeded terrain map with building placement and terrain validation
- Worker-driven building operation and road-connected labor pool
- Service walkers delivering food, water, and labor coverage to houses
- Housing tiers with evolution/de-evolution
- Tax/wage economy and Population + Prosperity ratings
- Save/load (basic) and deterministic golden-file tests
- Data-driven `data/` catalogs for buildings, commodities, housing, trade, events, missions
- Ratings (4-rating), trade, events (lifecycle), and mission win-condition modules
- Non-military random event engine wired into the sim tick (deterministic, lifecycle)
- Mission win-condition checks wired into the sim tick
- Four decomposed 0–100 city ratings with per-factor buckets, construction cost separated from Prosperity operating balance — Phase 15
- Sustained win conditions (month-cadence objective tracker: population/ratings/favor/treasury/annual exports) — Phase 15
- ~31-event catalog with deterministic responses that change outcomes, replayable via SaveCommand — Phase 15
- 21-level housing progression (cumulative requirements, hysteresis devolution, deterministic house merging, level-based economy bridge) — Phase 16
- 10-mission campaign (playable/winnable in sequence), contextual state-observed tutorial, catalog-derived codex — Phase 17
- Management UI: HUD with all controls wired, 13-advisor composer, overlays with heatmaps/legends/click-through, 5 inspectors — Phase 18
- Versioned save/load (migration + validation + deterministic reload) and functional persisted options/accessibility — Phase 19
- Per-residence population (class/age/employment via seeded residents), month-cadence migration (vacancy-bounded, famine refill, homeless), labor sectors with priority 1-5 + reserve-pin/pause/restore-auto SaveCommand, wage/unemployment band reporting — Phase 19.1
- Caesar III-style sidebar (build panel, tools, speed) replacing top HUD; top status bar; every control wired to a real runner seam — Phase 20
- 13-advisor drawer with live sim data under tick-change guard; keyboard-first A/←/→/Escape/B/1-5 with precedence drawer > inspector > settings > overlay-bar > build > pause — Phase 20
- Per-service overlay color ramps (fire/danger/collapse/crime + water/food/coverage/desirability) with legends and click-through to inspector — Phase 20
- Sidebar inspector cards fed by getInspector/getWalkerInternals with close/Next/Prev same-kind cycling — Phase 20
- UPPERCASE labels via case-only CSS utility; zero innerHTML (textContent/createElement everywhere) — Phase 20

### Active

<!-- Current scope. Building toward these. -->
(Defined by the next milestone — run /gsd-new-milestone to define v2.0 requirements.)

### Out of Scope

- **Military system** — any combat, units, defenses, or war content. See §1 of game.md. Enforced by a CI validator (planned).
- **Pixel-perfect art/music** — placeholder + generated assets only.
- **3D or rotation** requiring assets we do not have.

## Context

- Full specification lives in `game.md` (4,308 lines, 56 sections, Portuguese).
- Implementation is tracked in OpenSpec under `openspec/changes/opencaesar-game-systems/` (79 tasks, 12 sections).
- Live simulation: `src/sim/runner.ts` (`SimRunner`), builds from `src/sim/buildings.ts`, types in `src/sim/types.ts`.
- Live ratings/objectives/events: `src/sim/ratings.ts` (weighted decomposition), `src/sim/objectives.ts` (sustained tracker), `src/sim/events.ts` + `data/events.ts` (respondEvent); exposed via `getDerived()`.
- Housing: `data/housing.ts` (`HOUSING_LEVELS` 21-level + footprint ladder), `src/sim/housingLive.ts` (bridge: `HOUSING_LIVE_STATS`, `levelDesirability`, `deriveSatisfied`, `liveStats`), `src/sim/housingMerge.ts` (deterministic merge), `housingEvolution.ts` (`decideEvolution` hysteresis, untouched).
- Campaign: `data/missions.ts` (10 missions + per-mission map/modifiers/routes), `src/sim/missionMaps.ts` (layouts), `src/sim/campaign.ts` (codex + tutorial predicates), runner `startMission` (replayable SaveCommand), `getTutorial()`/`getCodex()` derived accessors.
- Management UI: `src/game/ui/` (dom, topbar, sidebar, advisorDrawer, keyboard, overlays, inspector — node-safe DOM builders), HUDScene/MainScene (sidebar mounting, key router, overlay paint), `src/game/advisors.ts` (13-advisor composer, zero-diff), runner `getWaterOverlay()`/`getInspector(kind,id)`/`getDesirabilityOverlay()`/`getCivilizationOverlay()`.
- Tests: Vitest (`npm run test`), 129 files / 1028 passing including golden determinism + Playwright e2e (28 in-scope specs at repo root `e2e/*.spec.ts`). `tsc --noEmit` must be clean.
- Fragile API contract: expanding certain types previously broke tests; changes need golden-equivalence verification.
- v1.0 shipped 2026-08-06: 20 phases (1-19 + 19.1), 59/59 REQ-IDs wired, 973 tests. Milestone archives in `.planning/milestones/v1.0-*`.
- v1.1 shipped 2026-08-07: Phase 20 (UI Redesign), 11/11 REQ-IDs wired (UI-RED-01..08 + UI-FIX-01..03), 1028 vitest + 28 e2e, sim core byte-identical. Archives in `.planning/milestones/v1.1-*`. 4 tech-debt items recorded in `.planning/v1.1-MILESTONE-AUDIT.md` (empty-state copy, coverage-hue decision, SUMMARY frontmatter, e2e baseline flakes boots/campaign/placement).

## Constraints

- **Architecture**: Framework-free sim core; Phaser is view-only — [preserves determinism; D1]
- **Determinism**: Seeded RNG + fixed timestep; identical seed/map/commands → identical state — [D1, D7]
- **No military**: CI gate rejects forbidden tokens — [§1, §51, D9]
- **Data-driven balance**: no literal balance constants scattered in sim code — [D2]
- **Test hygiene**: all existing tests must stay green; golden tests regenerate only on intentional mechanic change — [§51]

## Key Decisions

- Keep `SimRunner` as the single authority; UI reads snapshots, never duplicates state — [D8]
- Goods exist as physical "loads" moved by carrier walkers; no global teleporting stock — [D6]
- Road network as a graph with localized (dirty-flag) recomputation — [D3]
- Housing follows cumulative-requirement evolution with hysteresis — [D5]
- Every new player-action surface is a replayable `SaveCommand` (union + applyCommand + push-on-accept); `fromSaveData` replay-derives all derived state — Phase 15
- Event/rating effects stay in `DerivedSnapshot` (never `getState()`); treasury mutations only via explicit response choices — preserves golden fixtures — Phase 15
- Housing: `house.level` (0-20) is the live source of truth via `decideEvolution`; `house.tier` is a derived 0-4 bucket (ratings denominator intact); economy reads `HOUSING_LIVE_STATS[level]` only through the clamped `liveStats()` accessor — Phase 16
- Merges re-derive from tick+commands (NO new SaveCommand); merge target block must contain both houses' full footprints; merged population effective via `effectivePopulation` — Phase 16
- Campaign: `startMission`/`dismissTutorialStep` are replayable SaveCommands carrying the true start year (time-limit safe across save/load); progression gating is live-only (`!replaying`) — Phase 17
- Tutorial/codex are derived-only (never in `getState()`): pure predicates over `DerivedSnapshot`; codex built strictly from data catalogs — goldens untouched — Phase 17
- UI is view-only read-only: inspectors read internals via `getInspector(kind,id)` (explicit building/walker disambiguation — CR-01 fix) + `getWalkerInternals` seam, never growing serialized state; new DOM uses `textContent`/`createElement` (XSS-safe) — Phase 18
- Save/options: `saveCodec.ts` (SAVE_VERSION, additive `migrateSave`, full-union `validateSave` incl. `pendingCommands`) before `fromSaveData` (never edited); options in `src/game/options.ts` (`rcb.options`, disjoint from save), sanitized on load, applied at boot — Phase 19
- Population/labor (v1.0 gap closure): per-residence residents live ONLY on `HouseInstance` internals (never serialized; `toBuildingState` must not copy them) + `DerivedSnapshot` report fields; migration is vacancy-bounded (0-delta when city full ⇒ golden-neutral) on the %40 month cadence; labor pinning = runner-level reserve-guard (the pure `allocateWorkers` pinned branch is not relied on); `setLaborSectorState` validated in handler + `validateCommand`; wage bands are pure reporting (no treasury change) — Phase 19.1
- UI DOM built with node-safe `el()/clear()/text()` builders in `src/game/ui/` (StubNode in node-env vitest, real HTMLElement in browser) — zero innerHTML, all sim-derived strings via textContent — Phase 20
- UI is view-only (no sim mutation): single key router in MainScene with precedence drawer > inspector > settings > overlay-bar > build > pause, form-focus guard, tick-change render guard; `SERVICE_HUES` in `ui/overlays.ts` (per-service ramps, risks resolves dominant service per tile); UPPERCASE is a case-only CSS utility (DOM text stays canonical) — Phase 20

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition**:
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone**:
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

_Last updated: 2026-08-07 after v1.1 milestone (shipped)_
