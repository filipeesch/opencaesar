## ADDED Requirements

### Requirement: Headless sim unit tests (Vitest)

The test suite SHALL run sim unit tests in Node with Vitest, with zero browser or Phaser dependencies. Unit tests SHALL cover: placement rules, walker lifecycle, coverage decay, tax calculation, housing tier transitions, and determinism helpers.

#### Scenario: Unit tests run headless

- **WHEN** `vitest run` executes in CI or locally
- **THEN** sim unit tests pass without a browser

### Requirement: Integration scenario tests

The test suite SHALL provide a `runScenario(seed, map, setup, ticks)` helper that constructs a sim, applies a setup function of placement/policy commands, and steps ticks. Integration tests SHALL validate full pipeline behavior, e.g. farm → granary → market → houses feeding population growth.

#### Scenario: Food pipeline scenario passes

- **WHEN** a scenario places a staffed farm, granary, market, and houses and runs enough ticks
- **THEN** the test asserts houses have food coverage and population increased

#### Scenario: Negative scenario asserts failure mode

- **WHEN** a scenario has no granary but expects food delivery
- **THEN** the test asserts houses never gain food coverage

### Requirement: Determinism and golden-file tests

The test suite SHALL assert determinism: two sims with the same seed and command sequence produce identical state snapshots. The suite SHALL include golden-file tests that record a scenario's final state and assert exact equality on re-run.

#### Scenario: Determinism assertion passes

- **WHEN** two sims run the same seed + commands for N ticks
- **THEN** their serialized states are byte-identical

#### Scenario: Golden file mismatch fails

- **WHEN** a scenario's recorded golden file differs from the current run
- **THEN** the test fails, signaling an unintended mechanic change

### Requirement: Property-based invariant tests (fast-check)

The suite SHALL use fast-check to generate random seeds, maps, and command sequences and assert invariants: no negative resource counts, walkers never leave road tiles, storage never exceeds capacity, no NaN/undefined values in state, and building counts never negative.

#### Scenario: Invariants hold across random inputs

- **WHEN** fast-check generates 100 random scenarios
- **THEN** all invariants hold for every generated scenario

### Requirement: Playwright E2E smoke tests

The suite SHALL include Playwright E2E tests running the real game in headless Chromium: boot the page, place a road and buildings via UI, and assert the HUD population value increases. E2E SHALL be skippable locally and run in CI on demand.

#### Scenario: Boot and build happy path

- **WHEN** Playwright loads the game, selects road, clicks tiles, places farm/granary/market/houses, and waits
- **THEN** the HUD population increases and no console errors are logged

### Requirement: CI pipeline

The repository SHALL include a GitHub Actions workflow that runs Vitest (unit, integration, determinism, property) on every push and Playwright E2E on demand or nightly. CI SHALL fail on test failure.

#### Scenario: Push triggers sim tests

- **WHEN** a commit is pushed
- **THEN** the workflow runs vitest and fails the build on any failing test
