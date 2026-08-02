## Why

The game currently drops the player straight into a seeded city with no way to start over, pause, or save progress. Every reload is a brand-new random map with no continuity. A home screen, pause menu, and save/load turn the demo into something that feels like a game players can return to.

## What Changes

- **Home screen** (replaces the direct boot-to-game): New Game (with seed + map size), Load Game (from a saved game), and a How-to-play/About blurb. Defaults to a random seed.
- **Pause screen**: pressing **ESC** during gameplay opens an overlay with Resume, Save, and Restart (back to home). The sim tick clock pauses while the overlay is open.
- **Save/load**: saves persist to `localStorage`; a saved game captures the full runnable sim state and is resumable deterministically.
- **Restart**: returns to the home screen; the running game is discarded.
- ESC is reused (currently it only cancels build mode) — precedence rules: if build mode is active, ESC cancels it; otherwise it toggles pause.

## Capabilities

### New Capabilities
- `game-sessions`: home screen, pause overlay, save/load persistence, and session lifecycle (new game, restart).

### Modified Capabilities
- `game-shell`: ESC handling now distinguishes build-mode-cancel from pause; sim pausing behavior.

## Impact

- `src/sim/runner.ts` — expose a deterministic save/restore path (see design; likely serialize seed + command log + tick, then replay on load).
- `src/sim/rng.ts` — RNG state must be resumable from a save (either expose internal state or reconstruct from seed+consumed count).
- `src/game/scenes/BootScene.ts` — route to home screen instead of straight to Main.
- `src/game/scenes/MainScene.ts` — pause clock, ESC precedence, restart hook.
- New scenes: `HomeScene`, `PauseScene` (DOM-backed like HUD) or equivalent in existing scenes.
- `src/game/scenes/HUDScene.ts` — pause button, save status.
- Storage layer: `src/game/save.ts` (localStorage read/write).
- Tests: sim save/restore determinism test; e2e tests for home→new game, pause→save→restart→load, ESC precedence.
