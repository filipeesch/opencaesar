## Context

The game has a DOM-backed HUD (`HUDScene`) that reads sim state every tick, and a Phaser `MainScene` that renders the isometric map and already resolves pointer position to a tile (`tileAtPointer`). The sim exposes per-building snapshots via `toBuildingState` (runner.ts) including house tier/cooldowns and building stock/workers, but two things are missing: **desirability is computed inside `tickHousing` and never leaked into `SimState`**, and there is no click-to-inspect UI at all.

## Goals / Non-Goals

**Goals:**
- Click a building → see its live condition in a popup (per-building fields).
- Expose desirability per house in `SimState` so the popup (and later the happiness metric) can read it.
- Keep the popup a pure view — it never mutates sim state.

**Non-Goals:**
- No happiness rendering yet (arrives with `economy-happiness`; popup renders the field when present).
- No popup styling overhaul beyond a functional DOM panel consistent with the existing HUD.
- No hover previews or inspector for multiple buildings at once.

## Decisions

### D1: Popup is DOM (like the HUD), not a Phaser container
The HUD is already DOM-backed and reads state each tick. A DOM popup reuses that pattern: rendered in the `#hud` root, styled by the existing CSS. Phaser containers would fight the isometric camera (zoom/pan scaling) and add no value for text-heavy panels.

### D2: `MainScene` detects clicks, `HUDScene` owns the popup
`MainScene` already computes `tileAtPointer` and has access to the sim's building lookup. On `pointerup` with no build mode active, it resolves the building under the pointer and emits `hud-inspect <buildingId | null>` on `this.game.events`. `HUDScene` listens, looks up the snapshot from state, and renders the popup. This keeps scene responsibilities aligned with the current split (MainScene = input/canvas, HUDScene = DOM).

### D3: Sim exposes desirability per house in `toBuildingState`
Reuse `desirabilityOf` from housing.ts to compute a house's current desirability when building the snapshot. To keep the snapshot cheap and consistent, compute it from the same per-house cooldowns/services already in the snapshot (food/water/labor > 0). This mirrors what `tickHousing` uses, so the displayed value matches evolution logic. Alternative considered: persisting desirability on the instance each tick — rejected, it duplicates state that is cheaply derived and would need invalidation.

### D4: Popup layout per building type
A switch on `b.type` picks the field rows:
- **house**: tier + tierName, population capacity, food/water/labor status (dot + cooldown ticks), desirability (and happiness once present).
- **farm**: wheat stock, workers assigned/required, active.
- **granary**: wheat stock / capacity, workers, active.
- **market / well**: workers, active.
- **road**: no popup.

Building lookup by id: `HUDScene` re-reads `state.buildings.find(b => b.id === id)` each tick so the open popup stays live; it closes if the building disappears (e.g. devolved—not possible today since nothing is removed, but defensive).

### D5: Dismissal paths
- Click another building → popup switches to that building.
- Click empty terrain → close.
- ESC → close (already wired globally in MainScene for build-mode cancel; ensure inspect-closes too).
- A small ✕ button in the popup.

## Risks / Trade-offs

- [Click-vs-drag ambiguity] → reuse the existing drag threshold (movement > 6px = drag, no click) already in MainScene's pointerup handler.
- [Stale popup data between ticks] → HUD already re-renders only on tick change; extend that to refresh the open popup.
- [Desirability drift from tickHousing internals] → both paths read the same cooldowns; a unit test pins the equality.

## Migration Plan

No data migration; state field is additive. Rollback = revert the popup DOM + click wiring; desirability field is inert to the sim.

## Open Questions

- Should the popup pause while build mode is active? (Default: closing it when entering build mode is simplest and avoids overlap.)
