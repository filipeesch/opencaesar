import { describe, it, expect } from 'vitest';
import { Map as SimMap } from '../../src/sim/map';
import { SimRunner } from '../../src/sim/runner';

/** All-earth map so placement tests are unaffected by generated terrain. */
const emptyMap = (): SimMap => SimMap.fromLayout(12, 12, () => 'earth');

describe('paused command queue (CORE-02)', () => {
  it('defers a place order while paused and applies it on the next tick', () => {
    const r = new SimRunner(11, emptyMap());
    r.setPaused(true);
    expect(r.placeBuilding('road', 2, 2).ok).toBe(true);
    // Deferred, not applied and not persisted while paused.
    expect(r.getState().buildings.some((b) => b.type === 'road' && b.x === 2 && b.y === 2)).toBe(false);
    expect(r.getPendingCommandCount()).toBe(1);

    r.setPaused(false);
    r.tick();
    expect(r.getState().buildings.some((b) => b.type === 'road' && b.x === 2 && b.y === 2)).toBe(true);
    expect(r.getPendingCommandCount()).toBe(0);
  });

  it('defers a demolish order while paused and applies it on the next tick', () => {
    const r = new SimRunner(11, emptyMap());
    r.placeBuilding('road', 2, 2);
    expect(r.getState().buildings.some((b) => b.type === 'road' && b.x === 2 && b.y === 2)).toBe(true);

    r.setPaused(true);
    expect(r.demolish(2, 2)).toBe(true);
    // Still present while paused — order is deferred, not applied.
    expect(r.getState().buildings.some((b) => b.type === 'road' && b.x === 2 && b.y === 2)).toBe(true);
    expect(r.getPendingCommandCount()).toBe(1);

    r.setPaused(false);
    r.tick();
    expect(r.getState().buildings.some((b) => b.type === 'road' && b.x === 2 && b.y === 2)).toBe(false);
    expect(r.getPendingCommandCount()).toBe(0);
  });

  it('drains place/policy/demolish in FIFO order on the first resume tick', () => {
    const r = new SimRunner(5, emptyMap());
    const before = r.getState().tick;
    r.setPaused(true);
    r.placeBuilding('road', 3, 3); // 1st
    r.setPolicy(0.2, 0.1); // 2nd
    r.demolish(3, 3); // 3rd (removes the road placed by the 1st)
    expect(r.getPendingCommandCount()).toBe(3);
    expect(r.getPolicy().taxRate).toBe(0.1); // unchanged while paused

    r.setPaused(false);
    r.tick();
    expect(r.getState().tick).toBe(before + 1); // drain happens within a single tick
    expect(r.getPendingCommandCount()).toBe(0);
    expect(r.getPolicy().taxRate).toBe(0.2); // policy applied on the same tick

    // FIFO order in the command log: place road first, then demolish it.
    const cmds = r.getCommandLog().map((e) => e.command);
    const idxPlace = cmds.indexOf('place road@3,3');
    const idxDemolish = cmds.indexOf('demolish 3,3');
    expect(idxPlace).toBeGreaterThanOrEqual(0);
    expect(idxDemolish).toBeGreaterThan(idxPlace);
    // Road was placed then demolished within the drain — nothing remains.
    expect(r.getState().buildings.some((b) => b.type === 'road' && b.x === 3 && b.y === 3)).toBe(false);
  });

  it('applies un-paused commands immediately with an empty queue', () => {
    const r = new SimRunner(7, emptyMap());
    expect(r.placeBuilding('road', 4, 4).ok).toBe(true);
    expect(r.demolish(4, 4)).toBe(true);
    expect(r.getPendingCommandCount()).toBe(0);
    expect(r.getState().buildings.some((b) => b.type === 'road' && b.x === 4 && b.y === 4)).toBe(false);
  });

  it('returns false when demolishing a tile with no building', () => {
    const r = new SimRunner(7, emptyMap());
    expect(r.demolish(6, 6)).toBe(false);
  });

  it('demolishing a road resets its footprint terrain to earth', () => {
    const r = new SimRunner(7, emptyMap());
    r.placeBuilding('road', 5, 5);
    expect(r.getState().tiles[5][5]).toBe('road');
    expect(r.demolish(5, 5)).toBe(true);
    expect(r.getState().tiles[5][5]).toBe('earth');
  });

  it('saving while paused persists queued commands and re-enqueues them on load (WR-04)', () => {
    // Seed-generated map (no map passed) so fromSaveData reconstructs the same
    // procedural map — as the existing save/load round-trip tests do.
    const r = new SimRunner(777);
    r.placeBuilding('road', 3, 3); // applied prior state
    r.placeBuilding('road', 3, 4); // applied prior state
    r.setPaused(true);
    r.placeBuilding('road', 4, 3); // queued
    r.setPolicy(0.25, 0.15); // queued
    r.demolish(3, 3); // queued
    expect(r.getPendingCommandCount()).toBe(3);

    const loaded = SimRunner.fromSaveData(r.getSaveData());
    // Queue and paused state survive the round-trip; nothing was applied at load.
    expect(loaded.getPendingCommandCount()).toBe(3);
    expect(loaded.isPaused()).toBe(true);
    expect(loaded.getState().tick).toBe(r.getState().tick);
    expect(loaded.getState().buildings.some((b) => b.type === 'road' && b.x === 4 && b.y === 3)).toBe(false);

    // Unpausing and ticking drains the same queue on both, so they stay identical.
    r.setPaused(false);
    r.tick();
    loaded.setPaused(false);
    loaded.tick();
    expect(loaded.getStateJson()).toBe(r.getStateJson());
    expect(loaded.getPendingCommandCount()).toBe(0);
  });
});
