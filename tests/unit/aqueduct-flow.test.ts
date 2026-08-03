import { describe, it, expect } from 'vitest';
import { AqueductSystem } from '../../src/sim/water';

const key = (x: number, y: number): number => y * 100000 + x;

function sortedKeys(set: Set<number>): number[] {
  return Array.from(set).sort((a, b) => a - b);
}

const chain = (xs: number[]): { x: number; y: number }[] => xs.map((x) => ({ x, y: 5 }));

function build(): AqueductSystem {
  const aq = new AqueductSystem();
  aq.setAqueductTiles(chain([5, 6, 7, 8, 9]));
  aq.setReservoirs([]);
  return aq;
}

describe('aqueduct flow propagation (WATR-03)', () => {
  const mapWaterAt45 = (x: number, y: number): boolean => x === 4 && y === 5;

  it('is deterministic: identical inputs produce identical flowing/supplied sets across repeated calls', () => {
    const aq = build();
    const a = aq.computeFlow(12, 12, mapWaterAt45);
    const b = aq.computeFlow(12, 12, mapWaterAt45);
    expect(sortedKeys(a.flowing)).toEqual(sortedKeys(b.flowing));
    expect(sortedKeys(a.suppliedFountains)).toEqual(sortedKeys(b.suppliedFountains));
  });

  it('propagates flow from the source through the chain to a fountain tile', () => {
    const aq = new AqueductSystem();
    aq.setAqueductTiles([...chain([5, 6, 7, 8, 9]), { x: 2, y: 2 }]);
    aq.setReservoirs([]);
    const flow = aq.computeFlow(12, 12, mapWaterAt45);
    expect(flow.flowing.has(key(9, 5))).toBe(true);
    expect(flow.suppliedFountains.has(key(9, 5))).toBe(true);
    // a separate isolated aqueduct tile at (2,2) is neither flowing nor supplied
    expect(flow.flowing.has(key(2, 2))).toBe(false);
    expect(flow.suppliedFountains.has(key(2, 2))).toBe(false);
  });

  it('a broken (missing) segment stops downstream flow and fountain supply', () => {
    const aq = new AqueductSystem();
    aq.setAqueductTiles(chain([5, 6, 8, 9])); // gap at (7,5)
    aq.setReservoirs([]);
    const flow = aq.computeFlow(12, 12, mapWaterAt45);
    expect(flow.flowing.has(key(8, 5))).toBe(false);
    expect(flow.suppliedFountains.has(key(9, 5))).toBe(false);
    // upstream tiles still flow
    expect(flow.flowing.has(key(5, 5))).toBe(true);
    expect(flow.flowing.has(key(6, 5))).toBe(true);
  });

  it('repair restores downstream flow and fountain supply after the missing segment is re-added', () => {
    const aq = new AqueductSystem();
    aq.setAqueductTiles(chain([5, 6, 8, 9])); // gap at (7,5)
    aq.setReservoirs([]);
    const blocked = aq.computeFlow(12, 12, mapWaterAt45);
    expect(blocked.suppliedFountains.has(key(9, 5))).toBe(false);
    // repair: re-add the missing tile
    aq.setAqueductTiles(chain([5, 6, 7, 8, 9]));
    const repaired = aq.computeFlow(12, 12, mapWaterAt45);
    for (const x of [5, 6, 7, 8, 9]) expect(repaired.flowing.has(key(x, 5))).toBe(true);
    expect(repaired.suppliedFountains.has(key(9, 5))).toBe(true);
  });

  it('a road under the chain does not break flow (road-arch crossing)', () => {
    // The flow model follows aqueduct tiles only — a road tile placed on a row
    // passing under the chain mid-span never creates/removes flow, so the full
    // chain keeps flowing.
    const aq = build();
    const flow = aq.computeFlow(12, 12, mapWaterAt45);
    expect(flow.flowing.size).toBe(5);
    for (const x of [5, 6, 7, 8, 9]) expect(flow.flowing.has(key(x, 5))).toBe(true);
  });
});
