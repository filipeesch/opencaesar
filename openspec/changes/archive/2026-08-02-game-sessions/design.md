## Context

Today the game boots `BootScene` → `MainScene` directly, seeded only by a `?seed=` URL param, with no pause, no home screen, and no persistence. The sim is fully deterministic: `SimRunner(seed, map?)` + a replayable command log + tick count fully determines state (proven by the determinism tests). `setPolicy` is currently NOT in the command log, and the RNG is a closure with hidden internal state.

## Goals / Non-Goals

**Goals:**
- Home screen (New Game / Load Game / how-to-play) instead of direct boot-to-game.
- Pause overlay on ESC (Resume / Save / Restart), with a pausable sim clock.
- Save/load to localStorage that deterministically reproduces a session.
- ESC precedence: build-mode-cancel first, pause otherwise.

**Non-Goals:**
- Multiple save slots / named saves with timestamps UI (single-slot + list of saves is enough).
- Cloud or file-based saves (localStorage only).
- Save during mid-tick edge cases (save only from the pause overlay).
- Auto-save.

## Decisions

### D1: Save = seed + command log + tick count, restored by replay (command-log replay)
The determinism contract already gives us "same seed + same command sequence → identical state after N ticks". A save is therefore `{ version, seed, mapSize, commands, tickCount, savedAt }`; loading runs `new SimRunner(seed, mapOfSize)` then replays the command log (including `setPolicy`) and ticks to the saved count. Policy is captured by replaying the recorded `setPolicy` command, not as a separate field. This reuses the existing determinism guarantee instead of serializing internal mutable state. Alternatives rejected: (a) full internal snapshot (RNG `a`, cooldowns, counters) — invasive, fragile, and the RNG state isn't even exposed today; (b) JSON of `getState()` — not enough to resume (walkers, cooldowns, and the RNG stream position are not fully in the snapshot).

**Consequence:** `setPolicy` must be added to the command log (it currently isn't — `runner.ts:157`), so policy changes replay correctly. This is a small, additive change and makes the log a complete command history.

### D2: Replay is exact (not just "approximately equal")
Loading replays the full command stream in order, then steps exactly `tickCount` ticks. Because the sim is deterministic, the loaded `getStateJson()` is byte-identical to the original run at save time. A determinism test pins this: save → load → assert `getStateJson()` equals a fresh replay.

### D3: RNG stays opaque; replay never touches it directly
The RNG's internal state is reconstructed implicitly by re-running map generation + command replay from the same seed. No RNG API changes needed.

### D4: Scene flow
```
BootScene ──► HomeScene ──► MainScene (+HUD)
                 ▲  ▲  │
                 │  │  │ (Restart / Load)
                 └──┴──┘
ESC in MainScene: if buildMode → cancel; else toggle PauseOverlay.
```
- `HomeScene`: DOM-backed like HUD (seed input, size select, New Game, Load list, how-to-play).
- Pause overlay: a DOM element owned by `HUDScene` (simplest — no new scene), driven by `game.events` (`game-pause` / `game-resume`).
- `MainScene` owns the pause flag: `update()` skips the tick accumulator while paused but keeps rendering.
- `BootScene` checks `?test` and, for e2e, a `?skipHome=1` or direct route to keep existing e2e tests stable — decided during implementation to avoid rewriting the whole e2e suite.

### D5: Storage layer in `src/game/save.ts`
Small module: `listSaves()`, `saveGame(save)`, `loadGame(id)`, `deleteSave(id)` over localStorage with a versioned JSON envelope. Single save slot (key `rcb.save`) plus save metadata. Simpler than multiple slots; the spec's Load Game lists whatever exists in the slot(s).

### D6: Restart discards and returns home
Restart simply stops the current scene and transitions to `HomeScene` (the runner instance is dropped). No confirmation dialog needed for MVP.

## Risks / Trade-offs

- [Replay diverges if sim determinism breaks] → the determinism suite already guards this; a save/load round-trip test adds a second guard.
- [ESC behavior change could break e2e] → existing e2e tests that press ESC to cancel build mode are preserved (precedence unchanged for build mode); new tests cover pause.
- [Home screen breaks direct-boot e2e] → keep a `?skipHome`/direct-route escape hatch for tests, decided during implementation.
- [localStorage unavailable (private mode)] → save surfaces a failure toast; game still playable.
- [Replay cost on load for large tick counts] → 40×40 ticks are microseconds; a 100k-tick save replays in well under a second.

## Migration Plan

Additive scenes + storage; no data migration. Rollback = stop routing to HomeScene; pause/save features become inert.

## Open Questions

- Single save slot vs a few named slots (default: single slot + metadata).
- Should Load Game also be reachable from the pause overlay (switch cities)? Default: no, only from home.
