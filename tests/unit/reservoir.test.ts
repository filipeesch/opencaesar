import { describe, it, expect } from 'vitest';
import {
  RESERVOIR_STORAGE_CAPACITY,
  type ReservoirState,
  computeReservoirStates,
  reservoirTouchesMapWater,
} from '../../src/sim/water';
import type { ReservoirDef } from '../../src/sim/water';

describe('reservoir storage state (WATR-02)', () => {
  it('filled 3x3 reservoir touching map water reports capacity level with inlet connected, no outlet', () => {
    const reservoirs: ReservoirDef[] = [{ x: 2, y: 2, size: 3, active: true }];
    const states: ReservoirState[] = computeReservoirStates(
      8, 8, (x, y) => x === 1 && y === 2, reservoirs, new Set<number>(),
    );
    expect(states).toHaveLength(1);
    const s = states[0];
    expect(s.filled).toBe(true);
    expect(s.level).toBe(RESERVOIR_STORAGE_CAPACITY);
    expect(s.inletConnected).toBe(true);
    expect(s.outletToAqueduct).toBe(false);
  });

  it('flowing aqueduct adjacent to the footprint gives the reservoir an outlet to the aqueduct', () => {
    const reservoirs: ReservoirDef[] = [{ x: 2, y: 2, size: 3, active: true }];
    // reservoir footprint spans (2..4, 2..4); tile (5,2) is an orthogonal neighbour
    const flowing = new Set<number>([2 * 100000 + 5]);
    const states: ReservoirState[] = computeReservoirStates(8, 8, () => false, reservoirs, flowing);
    const s = states[0];
    expect(s.outletToAqueduct).toBe(true);
    expect(s.inletConnected).toBe(true);
    expect(s.filled).toBe(true);
  });

  it('isolated active reservoir is not filled', () => {
    const reservoirs: ReservoirDef[] = [{ x: 2, y: 2, size: 3, active: true }];
    const states: ReservoirState[] = computeReservoirStates(8, 8, () => false, reservoirs, new Set<number>());
    const s = states[0];
    expect(s.filled).toBe(false);
    expect(s.level).toBe(0);
    expect(s.inletConnected).toBe(false);
  });

  it('inactive reservoir stays empty even when touching map water', () => {
    const reservoirs: ReservoirDef[] = [{ x: 2, y: 2, size: 3, active: false }];
    const states: ReservoirState[] = computeReservoirStates(
      8, 8, (x, y) => x === 1 && y === 2, reservoirs, new Set<number>(),
    );
    const s = states[0];
    expect(s.filled).toBe(false);
    expect(s.level).toBe(0);
  });

  it('capacity is constant at RESERVOIR_STORAGE_CAPACITY regardless of input', () => {
    const reservoirs: ReservoirDef[] = [
      { x: 2, y: 2, size: 3, active: true },
      { x: 1, y: 1, size: 3, active: false },
      { x: 5, y: 5, size: 3, active: true },
    ];
    const states = computeReservoirStates(8, 8, (x, y) => x === 1 && y === 2, reservoirs, new Set<number>());
    expect(states).toHaveLength(3);
    for (const s of states) expect(s.capacity).toBe(RESERVOIR_STORAGE_CAPACITY);
  });

  it('reservoirTouchesMapWater is false for an out-of-bounds-adjacent-only corner reservoir', () => {
    expect(reservoirTouchesMapWater({ x: 0, y: 0, size: 3, active: true }, 8, 8, () => false)).toBe(false);
  });
});
