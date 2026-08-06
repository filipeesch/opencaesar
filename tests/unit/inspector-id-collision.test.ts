import { describe, it, expect } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { foodChainMap, buildFoodCity } from '../helpers';

/**
 * CR-01 — walker inspector shadowed by the building id space.
 *
 * Building and walker ids come from two independent counters that BOTH start at
 * 1, so a walker whose numeric id equals a live building id can never be
 * resolved by id alone. The fix: getInspector(id, kind) disambiguates by kind,
 * and the walker-inspector call sites pass 'walker'. These tests prove a
 * colliding walker id opens the walker inspector via the seam the HUD uses.
 */
function liveRunner(): SimRunner {
  const r = new SimRunner(42, foodChainMap());
  buildFoodCity(r);
  for (let i = 0; i < 400; i++) r.tick();
  return r;
}

describe('inspector id collision (CR-01)', () => {
  it('a live walker whose id collides with a live building id exists in the fixture', () => {
    const r = liveRunner();
    const state = r.getState();
    const buildingIds = new Set(state.buildings.map((b) => b.id));
    const colliding = state.walkers.filter((w) => buildingIds.has(w.id));
    // Under the happy-path city the walker id space provably overlaps the
    // building id space (both start at 1) — the bug this regression guards.
    expect(colliding.length).toBeGreaterThan(0);
  });

  it('getInspector(id) without kind returns the BUILDING for a colliding id (documents the collision)', () => {
    const r = liveRunner();
    const state = r.getState();
    const buildingIds = new Set(state.buildings.map((b) => b.id));
    const w = state.walkers.find((x) => buildingIds.has(x.id));
    expect(w).toBeDefined();
    const insp = r.getInspector(w!.id);
    expect(insp).not.toBeNull();
    expect(insp!.kind).toBe('building');
  });

  it('getInspector(id, "walker") opens the WALKER inspector for a colliding id', () => {
    const r = liveRunner();
    const state = r.getState();
    const buildingIds = new Set(state.buildings.map((b) => b.id));
    const w = state.walkers.find((x) => buildingIds.has(x.id));
    expect(w).toBeDefined();
    const insp = r.getInspector(w!.id, 'walker');
    expect(insp).not.toBeNull();
    expect(insp!.kind).toBe('walker');
    expect(insp!.walker).toBeDefined();
    expect(insp!.walker!.id).toBe(w!.id);
    expect(insp!.internals).toBeDefined();
  });

  it('kind resolves to walker even when the id belongs to a live building', () => {
    const r = liveRunner();
    const state = r.getState();
    // Every live building id.
    for (const b of state.buildings) {
      const byKind = r.getInspector(b.id, 'walker');
      // The same numeric id may or may not host a live walker; when it does it
      // must resolve to the walker, hiding the building under the walker kind.
      if (byKind) expect(byKind.kind).toBe('walker');
    }
  });

  it('proves Next/Prev same-kind cycling can resolve a colliding walker (walker kind honored)', () => {
    // Simulate what hud-walker-inspect + navInspector do: pick a colliding
    // walker, build a same-type walker id list, then resolve every id in the
    // list with the walker kind — no wrong-kind (building) popup on cycle.
    const r = liveRunner();
    const state = r.getState();
    const buildingIds = new Set(state.buildings.map((b) => b.id));
    const colliding = state.walkers.find((x) => buildingIds.has(x.id));
    expect(colliding).toBeDefined();
    const list = state.walkers
      .filter((w) => w.type === colliding!.type)
      .map((w) => w.id)
      .sort((a, b) => a - b);
    expect(list.length).toBeGreaterThan(0);
    for (const id of list) {
      const insp = r.getInspector(id, 'walker');
      // Every walker in the same-type list must still open a walker popup.
      expect(insp).not.toBeNull();
      expect(insp!.kind).toBe('walker');
    }
  });
});
