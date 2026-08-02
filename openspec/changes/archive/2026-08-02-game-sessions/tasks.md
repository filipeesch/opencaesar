## 1. Sim: command-log completeness + save data

- [x] 1.1 Add `setPolicy` to the command log in `SimRunner.setPolicy` (log tick + new rates)
- [x] 1.2 Add `getSaveData()` to `SimRunner` returning `{ version, seed, mapSize, commands, tickCount, savedAt }` (add `mapSize` and `seed` as runner fields; policy is captured via the replayed command log)
- [x] 1.3 Add a static/async `SimRunner.fromSaveData(save)` that reconstructs: new runner from seed+size, replays commands (place + setPolicy) in order, then ticks to `tickCount`
- [x] 1.4 Add a unit test: save → load → `getStateJson()` equals a fresh replay's state (byte-identical)

## 2. Storage layer

- [x] 2.1 Create `src/game/save.ts`: `listSaves()`, `saveGame(save)`, `loadGame()`, `deleteSave()` over localStorage with a versioned JSON envelope and save metadata (seed, tick, timestamp)
- [x] 2.2 Handle localStorage failures gracefully (try/catch → error result)
- [x] 2.3 Unit tests for the storage layer (round-trip save/load, missing save, corrupt JSON)

## 3. Home screen

- [x] 3.1 Create `HomeScene`: DOM-backed screen with New Game (seed + size inputs, random-seed default), Load Game (list or disabled/empty state), and a how-to-play note
- [x] 3.2 New Game → construct `SimRunner(seed, size)`, start `MainScene` + `HUD`, clear any existing save-referenced session
- [x] 3.3 Load Game → `SimRunner.fromSaveData`, start `MainScene` at the saved tick
- [x] 3.4 Update `BootScene` to route to `HomeScene` instead of `Main`; add a `?skipHome=1` (or `?test`) direct-to-game route for e2e stability
- [x] 3.5 Add testids (`new-game`, `load-game`, seed/size inputs, how-to-play)

## 4. Pause overlay + ESC precedence + clock pause

- [x] 4.1 Add a DOM pause overlay to `HUDScene` (Resume, Save, Restart) hidden by default, `data-testid="pause-overlay"`
- [x] 4.2 `MainScene` ESC handler: if build mode active → cancel; else toggle pause (emit `game-pause`/`game-resume`)
- [x] 4.3 Pause the sim clock: `MainScene.update` skips the tick accumulator while paused but keeps rendering/interaction
- [x] 4.4 Save from pause → `save.ts` write → success/failure toast
- [x] 4.5 Restart from pause → stop scenes, route to `HomeScene`
- [x] 4.6 Add a pause button to the HUD (secondary way to open the overlay)

## 5. Verification

- [x] 5.1 Add e2e tests: home → new game starts a city; ESC with build mode cancels (no pause); ESC without build mode opens pause; Resume resumes; save → restart → load resumes same city; Restart returns home
- [x] 5.2 Run full gate: `npm run typecheck`, `npm run lint`, `npm test`, `npx playwright test`
