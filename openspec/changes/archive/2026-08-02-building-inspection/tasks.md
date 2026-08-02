## 1. Sim: expose desirability

- [x] 1.1 Add `desirability: number` to the house snapshot type in `src/sim/types.ts` (`BuildingState.house`)
- [x] 1.2 Compute desirability in `toBuildingState` (runner.ts) using `desirabilityOf` with the house's current cooldowns as service flags
- [x] 1.3 Add a unit test asserting the exposed desirability equals `desirabilityOf` for a known house and changes with services/policy

## 2. Renderer: click-to-inspect wiring

- [x] 2.1 In `MainScene` pointerup: when no build mode is active and the drag threshold wasn't exceeded, resolve the building under the pointer via the sim internals and emit `hud-inspect <buildingId | null>`
- [x] 2.2 Ensure ESC in `MainScene` also emits `hud-inspect null` (close any open popup)

## 3. HUD: popup panel

- [x] 3.1 Add a popup DOM element to the HUD (hidden by default) with a dismiss ✕ button and a `data-testid="building-popup"`
- [x] 3.2 Render per-building fields by type (house: tier/name, pop capacity, food/water/labor status, desirability; farm/granary: stock, workers, active; market/well: workers, active)
- [x] 3.3 Listen for `hud-inspect`; open/switch/close the popup, and close it on empty-terrain click or ESC
- [x] 3.4 Refresh the open popup each tick from live state; close if the building no longer exists
- [x] 3.5 Close the popup when build mode is entered

## 4. Verification

- [x] 4.1 Add an e2e test: click a house → popup shows tier + desirability; click farm → popup shows stock; click empty terrain → popup closes; ESC → popup closes
- [x] 4.2 Run full gate: `npm run typecheck`, `npm run lint`, `npm test`, `npx playwright test`
