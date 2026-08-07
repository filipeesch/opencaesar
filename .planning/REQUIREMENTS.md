# Requirements — Milestone v1.1 (UI Redesign)

## Overview

Redesign the management UI into a Caesar III-style sidebar + advisor panels, applied on top of the existing deterministic sim core (v1.0 shipped). Zero sim-core behavior change; all UI reads live runner getters / DerivedSnapshot; no getState()/SaveData shape change; goldens byte-identical.

## UI Redesign (Category: UI-RED)

- [ ] **UI-RED-01**: Player can see a Caesar III-style right sidebar with the build panel, tools, and speed controls replacing the top HUD
- [ ] **UI-RED-02**: Player can open each of the 13 advisor panels from the sidebar; every panel shows live sim data (never fabricated) via runner getters under the tick-change guard
- [ ] **UI-RED-03**: Player can navigate advisors with keyboard (A/←/→) and the advisor drawer stays in sync with the sim tick
- [ ] **UI-RED-04**: Player can toggle the 5 overlays (fire/danger/collapse/crime/food + water/desirability) from the sidebar; each overlay paints its coverage area with a per-service color hue, shows a legend, and is click-through to the inspector
- [ ] **UI-RED-05**: Player can inspect buildings/walkers from the sidebar; inspectors show real internals via getInspector(kind,id)/getWalkerInternals and cycle with close/Next
- [ ] **UI-RED-06**: Overlay coverage labels render in UPPERCASE (Caesar III style) instead of mixed case
- [ ] **UI-RED-07**: Player can use keyboard shortcut A to cycle advisors, ←/→ to switch panels, and Escape to close — no mouse-only flows
- [ ] **UI-RED-08**: All UI text/labels are composed via textContent/createElement (XSS-safe), no innerHTML

## Deferred Phase-18 UI-Review Fixes (Category: UI-FIX)

- [ ] **UI-FIX-01**: Keyboard bindings applied — A cycles advisors, ←/→ switches panels, Escape closes (was finding #1 in 18-UI-REVIEW.md)
- [ ] **UI-FIX-02**: Per-service coverage hues — each overlay service renders its own color ramp instead of a single shared ramp (was finding #2)
- [ ] **UI-FIX-03**: UPPERCASE labels — overlay/advisor labels use text-transform uppercase (was finding #3)

## Future Requirements (Deferred)

- None for v1.1 (all scope in this milestone)

## Out of Scope

- **Military system** — no combat/units/defenses (see §1 game.md)
- **Pixel-perfect art/music** — placeholder + generated assets only
- **3D or rotation** — no new assets
- **Sim-core mechanics changes** — UI redesign is view-only; any behavior change requires a new requirement and golden regeneration

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| UI-RED-01 | 20 | not started |
| UI-RED-02 | 20 | not started |
| UI-RED-03 | 20 | not started |
| UI-RED-04 | 20 | not started |
| UI-RED-05 | 20 | not started |
| UI-RED-06 | 20 | not started |
| UI-RED-07 | 20 | not started |
| UI-RED-08 | 20 | not started |
| UI-FIX-01 | 20 | not started |
| UI-FIX-02 | 20 | not started |
| UI-FIX-03 | 20 | not started |
