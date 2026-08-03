import { describe, it, expect } from 'vitest';
import { createGovernor, payGovernor, donate, GOVERNOR_SALARY_LEVELS } from '../../src/sim/governor';
import { writeQuickSave, readQuickSave, writeAutosave, listAutosaves } from '../../src/game/save';
import type { StorageLike } from '../../src/game/save';
import type { SaveData } from '../../src/sim/types';

function mem(): StorageLike {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}
const save: SaveData = { version: 1, seed: 1, mapSize: 4, commands: [], tickCount: 5, savedAt: 0 };

describe('governor finances (task 7.4)', () => {
  it('pays salary into a personal account capped by treasury', () => {
    expect(GOVERNOR_SALARY_LEVELS.length).toBeGreaterThan(0);
    const g = createGovernor(2);
    const r = payGovernor(g, 300);
    expect(r.salary).toBe(GOVERNOR_SALARY_LEVELS[2]);
    expect(g.personalAccount).toBe(GOVERNOR_SALARY_LEVELS[2]);
    expect(r.treasury).toBe(300 - GOVERNOR_SALARY_LEVELS[2]);
  });

  it('donations give favor one-for-one and are capped per year (no exploit)', () => {
    const g = createGovernor(0);
    const r1 = donate(g, 300, { treasury: 1000, favor: 0, yearlyCap: 100 });
    expect(r1.favor).toBe(100);
    const r2 = donate(g, 300, { treasury: 1000, favor: 100, yearlyCap: 100 });
    expect(r2.ok).toBe(false); // capped — no free favor farming
  });
});

describe('quicksave/autosave (task 12.2)', () => {
  it('quicksave round-trips', () => {
    const st = mem();
    expect(writeQuickSave(save, st).ok).toBe(true);
    expect(readQuickSave(st)?.data.tickCount).toBe(5);
  });

  it('autosave rotates slots, dropping the oldest', () => {
    const st = mem();
    writeAutosave({ ...save, tickCount: 1 }, 3, st);
    writeAutosave({ ...save, tickCount: 2 }, 3, st);
    writeAutosave({ ...save, tickCount: 3 }, 3, st);
    const list = listAutosaves(3, st);
    expect(list[0]?.data.tickCount).toBe(3);
    expect(list[1]?.data.tickCount).toBe(2);
    expect(list[2]?.data.tickCount).toBe(1);
  });
});
