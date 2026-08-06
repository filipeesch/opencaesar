import { describe, expect, it } from 'vitest';
import { migrateSave, validateSave, SAVE_VERSION, SaveCodecError } from '../../src/sim/saveCodec';
import { SimRunner } from '../../src/sim/runner';
import type { SaveData } from '../../src/sim/types';

/**
 * Phase 19 (PERS-01): the versioned save codec — additive N→N+1 migration +
 * typed validation that runs BEFORE any replay (fromSaveData). The codec is
 * pure (no Math.random/Date.now), version 1 stays current, and corrupt saves
 * are rejected with a typed reason — never a raw throw.
 */
describe('saveCodec — migration', () => {
  it('passes a current-version save through unchanged', () => {
    const data = new SimRunner(42).getSaveData();
    const migrated = migrateSave(data);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.seed).toBe(42);
    expect(migrated).toEqual(data);
  });

  it('rejects a version below 1 with a typed SaveCodecError', () => {
    for (const bad of [
      { version: 0, seed: 1, mapSize: 40 },
      { version: -1, seed: 1, mapSize: 40 },
    ]) {
      try {
        migrateSave(bad);
        expect.unreachable('expected SaveCodecError');
      } catch (e) {
        expect(e).toBeInstanceOf(SaveCodecError);
        expect((e as SaveCodecError).code).toBe('migrate-invalid-version');
      }
    }
  });

  it('rejects a non-numeric / non-integer version with a typed SaveCodecError', () => {
    for (const bad of [{ version: 'hi' }, { version: 1.5 }, {}]) {
      try {
        migrateSave(bad);
        expect.unreachable('expected SaveCodecError');
      } catch (e) {
        expect(e).toBeInstanceOf(SaveCodecError);
        expect((e as SaveCodecError).code).toBe('migrate-invalid-version');
      }
    }
  });

  it('rejects a save newer than SAVE_VERSION with a typed SaveCodecError', () => {
    try {
      migrateSave({ version: SAVE_VERSION + 1, seed: 1, mapSize: 40 });
      expect.unreachable('expected SaveCodecError');
    } catch (e) {
      expect(e).toBeInstanceOf(SaveCodecError);
      expect((e as SaveCodecError).code).toBe('save-version-too-new');
    }
  });
});

describe('saveCodec — validation', () => {
  const good = (): SaveData => new SimRunner(42).getSaveData();
  /** Corrupt a valid save with the given patch (casts allow hostile shapes). */
  const corrupt = (patch: Record<string, unknown>): unknown => ({ ...good(), ...patch });

  it('accepts a valid save', () => {
    const res = validateSave(good());
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.seed).toBe(42);
  });

  it.each([
    ['NaN seed', { seed: NaN }, 'non-finite-seed'],
    ['string seed', { seed: 'nope' }, 'non-finite-seed'],
    ['NaN tickCount', { tickCount: NaN }, 'non-finite-tick-count'],
    ['NaN mapSize', { mapSize: NaN }, 'non-finite-map-size'],
  ])('rejects %s as %s', (_label, patch, expected) => {
    const res = validateSave(corrupt(patch));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe(expected);
      expect(typeof res.reason).toBe('string');
      expect(res.reason.length).toBeGreaterThan(0);
    }
  });

  it('rejects a version mismatch as invalid-version', () => {
    const res = validateSave(corrupt({ version: 0 }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('invalid-version');
  });

  it.each([
    ['object commands', { commands: {} }],
    ['string commands', { commands: 'x' }],
  ])('rejects %s as commands-not-array', (_label, patch) => {
    const res = validateSave(corrupt(patch));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('commands-not-array');
  });

  it('rejects an unknown command kind', () => {
    const res = validateSave(corrupt({ commands: [{ kind: 'bogus' }] }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('unknown-command-kind');
  });

  it.each([
    ['setPolicy missing fields', { commands: [{ kind: 'setPolicy' }] }],
    ['place missing x/y/type', { commands: [{ kind: 'place' }] }],
    ['takeLoan with non-finite amount', { commands: [{ kind: 'takeLoan', amount: NaN }] }],
  ])('rejects a malformed known command (%s) as malformed-command', (_label, patch) => {
    const res = validateSave(corrupt(patch));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('malformed-command');
  });

  it('never throws — every corrupt case returns a typed { ok:false }', () => {
    const hostile: unknown[] = [
      null,
      'not-an-object',
      { version: 1, seed: NaN, mapSize: 40, commands: [], tickCount: 0 },
      { version: 1, seed: 1, mapSize: NaN, commands: [], tickCount: 0 },
      { version: 1, seed: 1, mapSize: 40, commands: [{ kind: 'place', x: 'a', y: 0, type: 'road' }], tickCount: 0 },
      { version: 1, seed: 1, mapSize: 40, commands: [{ kind: 'setPolicy', taxRate: 0.1 }], tickCount: 0 },
    ];
    for (const h of hostile) {
      const res = validateSave(h);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(typeof res.error).toBe('string');
    }
  });
});

describe('saveCodec — pendingCommands validation (CR-01)', () => {
  const good = (): SaveData => new SimRunner(42).getSaveData();
  /** A valid save with hostile pendingCommands (cast allows hostile shapes). */
  const withPending = (pending: unknown): unknown => ({ ...good(), pendingCommands: pending });

  it('accepts a valid save with a legitimate pendingCommands array', () => {
    const res = validateSave(withPending([{ kind: 'holdFestival', tierId: 't1' }]));
    expect(res.ok).toBe(true);
  });

  it('accepts a valid save whose pendingCommands is empty', () => {
    const res = validateSave(withPending([]));
    expect(res.ok).toBe(true);
  });

  it('rejects a non-array pendingCommands as commands-not-array', () => {
    for (const bad of ['x', {}, 7, null]) {
      const res = validateSave(withPending(bad));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe('commands-not-array');
    }
  });

  it('rejects an unknown-kind pendingCommands as unknown-command-kind', () => {
    const res = validateSave(withPending([{ kind: 'bogus' }]));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('unknown-command-kind');
      expect(res.reason).toContain('bogus');
    }
  });

  it('rejects a NaN pending command member as malformed-command', () => {
    const res = validateSave(withPending([{ kind: 'place', type: 'road', x: NaN, y: 0 }]));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('malformed-command');
  });

  it('never throws on hostile pendingCommands — always a typed { ok:false }', () => {
    const hostilePending: unknown[] = [
      [{ kind: 'bogus' }],
      [{ kind: 'place', type: 'road', x: NaN, y: 0 }],
      [{ kind: 'setPolicy', taxRate: 0.1 }],
      ['not-an-object'],
    ];
    for (const h of hostilePending) {
      const res = validateSave(withPending(h));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(typeof res.error).toBe('string');
    }
  });
});

describe('saveCodec — round-trip WITH the codec in the loop', () => {
  it('migrate + validate + fromSaveData replays byte-identically', () => {
    // Mirror the determinism recipe: build, script, snapshot, then route the
    // save through the codec before replay and assert byte-identical state.
    const runner = new SimRunner(777);
    runner.placeBuilding('road', 3, 3);
    runner.placeBuilding('road', 3, 4);
    runner.placeBuilding('house', 3, 5);
    runner.setPolicy(0.1, 0.2);
    for (let i = 0; i < 500; i++) runner.tick();
    const original = runner.getStateJson();

    const migrated = migrateSave(runner.getSaveData());
    expect(validateSave(migrated).ok).toBe(true);
    const loaded = SimRunner.fromSaveData(migrated as SaveData);
    expect(loaded.getStateJson()).toBe(original);
  });
});
