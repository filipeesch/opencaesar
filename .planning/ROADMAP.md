# Roadmap: OpenCaesar

## Overview

Evolve the working Caesar-style MVP into the full OpenCaesar spec (`game.md`, §55
vertical-slice order): a deterministic, data-driven city sim with physical goods
logistics, 21-level housing, road-delivered services, water, industry, trade,
finance, civic systems, ratings, campaign, and management UI — built one playable
slice at a time, keeping golden determinism.

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases: Urgent insertions (marked INSERTED)

## Milestones

- ✅ **v1.0 OpenCaesar** — Phases 1-19 + 19.1 (shipped 2026-08-06) — 20 phases, 34 plans, 101 tasks
- 📋 **v1.1 (Planned)** — Phase 20 UI Redesign onward

## Phases

<details>
<summary>✅ v1.0 OpenCaesar (Phases 1-19.1) — SHIPPED 2026-08-06</summary>

- [x] Phase 1: Time & Deterministic Core (3/3 plans) — completed 2026-08-03
- [x] Phase 2: Data Catalogs & Military-Absence Gate (3/3 plans) — completed 2026-08-03
- [x] Phase 3: Road Graph & Walker Categories (3/3 plans) — completed 2026-08-03
- [x] Phase 4: Water System (3/3 plans) — completed 2026-08-03
- [x] Phase 5: Agriculture & Food (3/3 plans) — completed 2026-08-04
- [x] Phase 6: Production & Manufacturing (3/3 plans) — completed 2026-08-04
- [x] Phase 7: Warehouses & Logistics (3/3 plans) — completed 2026-08-04
- [x] Phase 8: Markets & Home Distribution (3/3 plans) — completed 2026-08-04
- [x] Phase 9: External Trade (3/3 plans) — completed 2026-08-04
- [x] Phase 10: Finance (3/3 plans) — completed 2026-08-04
- [x] Phase 11: Civil Safety (3/3 plans) — completed 2026-08-05
- [x] Phase 12: Health, Education, Entertainment (3/3 plans) — completed 2026-08-05
- [x] Phase 13: Religion (3/3 plans) — completed 2026-08-05
- [x] Phase 14: Governance & Requests (3/3 plans) — completed 2026-08-05
- [x] Phase 15: Ratings, Objectives, Events (3/3 plans) — completed 2026-08-05
- [x] Phase 16: Full Housing Evolution (2/2 plans) — completed 2026-08-05
- [x] Phase 17: Campaign, Tutorial & Codex (2/2 plans) — completed 2026-08-05
- [x] Phase 18: Management UI (2/2 plans) — completed 2026-08-06
- [x] Phase 19: Persistence & Options (2/2 plans) — completed 2026-08-06
- [x] Phase 19.1: Population & Labor (1/1 plan) — completed 2026-08-06 (INSERTED — milestone audit gap closure)

</details>

### 🚧 v1.1 UI Redesign — Caesar III Sidebar & Advisors (In Progress)

**Milestone Goal:** Replace the top HUD with a Caesar III-style right sidebar; deliver advisor panels, overlays, and inspectors as sidebar-driven UI with keyboard-first navigation, UPPERCASE labels, and XSS-safe DOM — view-only, sim core byte-identical.

- [ ] **Phase 20: UI Redesign — Caesar III Sidebar & Advisors** — Replace current HUD with Caesar III-style sidebar, 13 advisor panels with live sim data, overlay system (fire/danger/collapse/crime/food), building inspector, redesigned build panel. (INSERTED — ui-redesign)

### Phase 20: UI Redesign — Caesar III Sidebar & Advisors
**Goal**: Replace the top HUD with a Caesar III-style right sidebar (build panel, tools, speed controls) and rebuild advisors, overlays, and inspectors as sidebar-driven panels with keyboard-first navigation, UPPERCASE labels, and XSS-safe DOM — view-only, sim core byte-identical.
**Depends on**: Phase 19.1 (v1.0 shipped; sim-core getters and goldens stable)
**Requirements**: UI-RED-01, UI-RED-02, UI-RED-03, UI-RED-04, UI-RED-05, UI-RED-06, UI-RED-07, UI-RED-08, UI-FIX-01, UI-FIX-02, UI-FIX-03
**Success Criteria** (what must be TRUE):
  1. Player sees a Caesar III-style right sidebar (build panel, tools, speed controls) replacing the top HUD, and every control still functions (builds place, tools work, speed changes apply).
  2. Player can open each of the 13 advisor panels from the sidebar; every panel shows live sim data that updates with the tick (never fabricated).
  3. Player can operate the UI fully by keyboard: A cycles advisors, ←/→ switches panels, Escape closes — no mouse-only flow remains.
  4. Player can toggle the 5 overlays from the sidebar; each overlay paints its coverage area in its own per-service color ramp, shows a legend, and clicks pass through to the inspector.
  5. Player can inspect buildings/walkers from the sidebar; inspectors show real internals (getInspector/getWalkerInternals) and cycle with close/Next.
  6. Overlay and advisor labels render UPPERCASE (Caesar III style), all DOM labels are composed via textContent/createElement (no innerHTML), and save/load goldens remain byte-identical.
**Plans**: 6 plans
- [ ] 20-01: Sidebar scaffold — replace top HUD with right-sidebar build panel, tools, speed controls; all DOM via textContent/createElement (XSS-safe) [UI-RED-01, UI-RED-08]
- [ ] 20-02: Advisor drawer + keyboard — 13 advisor panels with live runner-getter data under tick-change guard; A/←/→/Escape bindings [UI-RED-02, UI-RED-03, UI-RED-07, UI-FIX-01]
- [ ] 20-03: Overlay hues & legends — 5 overlays (fire/danger/collapse/crime/food + water/desirability), per-service color ramps, legends, click-through [UI-RED-04, UI-FIX-02]
- [ ] 20-04: Inspectors — building/walker inspectors fed by getInspector/getWalkerInternals, close/Next cycling [UI-RED-05]
- [ ] 20-05: UPPERCASE labels — text-transform uppercase on overlay/advisor labels [UI-RED-06, UI-FIX-03]
- [ ] 20-06: Verification — golden byte-identical save/load, tsc --noEmit clean, Playwright e2e for keyboard/sidebar/overlay/inspector flows, no-innerHTML audit [verification]
**UI hint**: yes

## Progress

| Phase             | Milestone | Plans Complete | Status      | Completed  |
| ----------------- | --------- | -------------- | ----------- | ---------- |
| 1. Time & Deterministic Core | v1.0 | 3/3 | Complete | 2026-08-03 |
| 2. Data Catalogs & Military-Absence Gate | v1.0 | 3/3 | Complete | 2026-08-03 |
| 3. Road Graph & Walker Categories | v1.0 | 3/3 | Complete | 2026-08-03 |
| 4. Water System | v1.0 | 3/3 | Complete | 2026-08-03 |
| 5. Agriculture & Food | v1.0 | 3/3 | Complete | 2026-08-04 |
| 6. Production & Manufacturing | v1.0 | 3/3 | Complete | 2026-08-04 |
| 7. Warehouses & Logistics | v1.0 | 3/3 | Complete | 2026-08-04 |
| 8. Markets & Home Distribution | v1.0 | 3/3 | Complete | 2026-08-04 |
| 9. External Trade | v1.0 | 3/3 | Complete | 2026-08-04 |
| 10. Finance | v1.0 | 3/3 | Complete | 2026-08-04 |
| 11. Civil Safety | v1.0 | 3/3 | Complete | 2026-08-05 |
| 12. Health, Education, Entertainment | v1.0 | 3/3 | Complete | 2026-08-05 |
| 13. Religion | v1.0 | 3/3 | Complete | 2026-08-05 |
| 14. Governance & Requests | v1.0 | 3/3 | Complete | 2026-08-05 |
| 15. Ratings, Objectives, Events | v1.0 | 3/3 | Complete | 2026-08-05 |
| 16. Full Housing Evolution | v1.0 | 2/2 | Complete | 2026-08-05 |
| 17. Campaign, Tutorial & Codex | v1.0 | 2/2 | Complete | 2026-08-05 |
| 18. Management UI | v1.0 | 2/2 | Complete | 2026-08-06 |
| 19. Persistence & Options | v1.0 | 2/2 | Complete | 2026-08-06 |
| 19.1. Population & Labor | v1.0 | 1/1 | Complete | 2026-08-06 |
| 20. UI Redesign — Sidebar & Advisors | v1.1 | 0/6 | Not started | - |
