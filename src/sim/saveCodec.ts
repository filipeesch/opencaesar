/**
 * saveCodec — the versioned save boundary of the deterministic sim (PERS-01).
 *
 * Pure, browser-free, node-testable. Sits BETWEEN the storage read and
 * SimRunner.fromSaveData at both the HomeScene click-through and
 * MainScene.create() defense-in-depth: a save is migrated additively to the
 * current SAVE_VERSION, then validated with a typed SaveValidationError —
 * corrupt/unknown-version saves are rejected (never a raw 'unknown command
 * kind' throw from applyCommand, never a silent misload on a NaN seed).
 *
 * Determinism rule: no Math.random()/Date.now()/new Date() anywhere in this
 * module. getSaveData()/fromSaveData() are untouched — this codec runs only
 * BEFORE replay, never inside it.
 */

import { BUILDINGS } from './buildings';
import type { SaveData } from './types';

/** The current serializable save format. Version 1 stays current today. */
export const SAVE_VERSION = 1 as const;

/**
 * Typed codec error, exported so the storage layer (save.ts loadSavedGame)
 * can map it to a typed LoadResult. `code` is a machine-readable discriminator.
 */
export class SaveCodecError extends Error {
  constructor(
    public readonly code: 'migrate-invalid-version' | 'migrate-not-supported' | 'save-version-too-new',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'SaveCodecError';
  }
}

/**
 * Additive N→N+1 migration chain, indexed by the FROM version. TODAY empty —
 * v1 is current, so existing saves stay valid with no schema break. A future
 * v2 schema change adds `MIGRATIONS[1] = (s) => ({ ...s, version: 2 } as
 * SaveDataV2)` and bumps SAVE_VERSION. Each step MUST be additive (spread +
 * new optional fields) — never rename or drop an existing field, or old saves
 * lose data.
 */
const MIGRATIONS: Record<number, (save: unknown) => unknown> = {};

/**
 * Migrate any save forward to SAVE_VERSION. Additive and deterministic.
 * Rejects (typed SaveCodecError, never a throw of another kind):
 * - non-numeric / non-integer / < 1 version  → 'migrate-invalid-version'
 * - a from-version with no migration step    → 'migrate-not-supported'
 * - a save newer than SAVE_VERSION           → 'save-version-too-new'
 */
export function migrateSave(data: unknown): SaveData {
  const v = (data as { version?: unknown } | null)?.version;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    throw new SaveCodecError('migrate-invalid-version', 'save version must be a positive integer');
  }
  let current = data as Record<string, unknown>;
  while ((current.version as number) < SAVE_VERSION) {
    const step = MIGRATIONS[current.version as number];
    if (!step) throw new SaveCodecError('migrate-not-supported', `no migration step from version ${String(current.version)}`);
    current = step(current) as Record<string, unknown>;
  }
  if ((current.version as number) > SAVE_VERSION) {
    throw new SaveCodecError('save-version-too-new', `save version ${String(current.version)} is newer than supported ${SAVE_VERSION}`);
  }
  return current as unknown as SaveData;
}

/** Typed validation failure reasons — the discriminated-error surface of validateSave. */
export type SaveValidationError =
  | 'invalid-version'
  | 'missing-field'
  | 'non-finite-seed'
  | 'non-finite-tick-count'
  | 'non-finite-map-size'
  | 'commands-not-array'
  | 'unknown-command-kind'
  | 'malformed-command';

/** Result of validateSave — one or the other, never a throw. */
export type SaveValidationResult =
  | { ok: true; data: SaveData }
  | { ok: false; error: SaveValidationError; reason: string };

const BUILDING_TYPES = new Set<string>(Object.keys(BUILDINGS) as unknown as string[]);

/** Validate one command against the SaveCommand union shape. Returns null when
 *  the command is well-formed, or the violation reason. */
function validateCommand(cmd: unknown): SaveValidationError | null {
  if (typeof cmd !== 'object' || cmd === null) return 'malformed-command';
  const c = cmd as Record<string, unknown>;
  const kind = c.kind;
  if (typeof kind !== 'string') return 'unknown-command-kind';
  const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const str = (v: unknown): v is string => typeof v === 'string';
  switch (kind) {
    case 'place':
      if (!fin(c.x) || !fin(c.y) || !str(c.type) || !BUILDING_TYPES.has(c.type)) return 'malformed-command';
      break;
    case 'setPolicy':
      if (!fin(c.taxRate) || !fin(c.wageRate)) return 'malformed-command';
      break;
    case 'demolish':
      if (!fin(c.x) || !fin(c.y)) return 'malformed-command';
      break;
    case 'requestRoyalSubsidy':
      break;
    case 'takeLoan':
    case 'repayLoan':
    case 'donateToGovernor':
      if (!fin(c.amount)) return 'malformed-command';
      break;
    case 'holdFestival':
      if (!str(c.tierId)) return 'malformed-command';
      break;
    case 'setGovernorSalaryLevel':
      if (!fin(c.level)) return 'malformed-command';
      break;
    case 'deliverGoods':
      if (!str(c.requestId) || !str(c.good) || !fin(c.qty)) return 'malformed-command';
      break;
    case 'payRequest':
      if (!str(c.requestId) || !fin(c.amount)) return 'malformed-command';
      break;
    case 'openTradeRoute':
      if (!str(c.cityId)) return 'malformed-command';
      break;
    case 'setTradeOrder':
      if (!str(c.cityId) || !str(c.good) || !str(c.mode)) return 'malformed-command';
      if (c.reserve !== undefined && !fin(c.reserve)) return 'malformed-command';
      if (c.target !== undefined && !fin(c.target)) return 'malformed-command';
      break;
    case 'respondEvent':
      if (!str(c.eventId) || !str(c.choiceId)) return 'malformed-command';
      break;
    case 'startMission':
      if (!str(c.id) || !fin(c.year)) return 'malformed-command';
      break;
    case 'dismissTutorialStep':
      if (!str(c.step)) return 'malformed-command';
      break;
    case 'setLaborSectorState':
      if (!str(c.sector)) return 'malformed-command';
      if (c.pinned !== undefined && typeof c.pinned !== 'boolean') return 'malformed-command';
      if (c.paused !== undefined && typeof c.paused !== 'boolean') return 'malformed-command';
      break;
    default:
      return 'unknown-command-kind';
  }
  return null;
}

/**
 * Validate a save BEFORE any replay. Structure + version bounds + every
 * command's kind and union-shaped fields. NEVER throws — always a typed
 * { ok: false, error, reason } with a human-readable reason the Home UI can
 * surface. Bounds are linear in command count with no unbounded recursion
 * (T-19-03).
 */
export function validateSave(data: unknown): SaveValidationResult {
  if (typeof data !== 'object' || data === null) {
    return { ok: false, error: 'missing-field', reason: 'save must be an object' };
  }
  const s = data as Record<string, unknown>;

  const version = s.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version !== SAVE_VERSION) {
    return { ok: false, error: 'invalid-version', reason: `save version must be ${SAVE_VERSION} (got ${String(version)})` };
  }

  const seed = s.seed;
  const mapSize = s.mapSize;
  const tickCount = s.tickCount;
  if (seed === undefined) return { ok: false, error: 'missing-field', reason: 'seed is required' };
  if (mapSize === undefined) return { ok: false, error: 'missing-field', reason: 'mapSize is required' };
  if (tickCount === undefined) return { ok: false, error: 'missing-field', reason: 'tickCount is required' };
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    return { ok: false, error: 'non-finite-seed', reason: 'seed must be a finite number' };
  }
  if (typeof mapSize !== 'number' || !Number.isFinite(mapSize)) {
    return { ok: false, error: 'non-finite-map-size', reason: 'mapSize must be a finite number' };
  }
  if (typeof tickCount !== 'number' || !Number.isFinite(tickCount)) {
    return { ok: false, error: 'non-finite-tick-count', reason: 'tickCount must be a finite number' };
  }

  const commands = s.commands;
  if (!Array.isArray(commands)) {
    return { ok: false, error: 'commands-not-array', reason: 'commands must be an array' };
  }

  for (const cmd of commands) {
    const err = validateCommand(cmd);
    if (err === 'unknown-command-kind') {
      const kind = (cmd as { kind?: unknown } | null)?.kind;
      return { ok: false, error: err, reason: `unknown command kind: ${String(kind)}` };
    }
    if (err) {
      const kind = (cmd as { kind?: unknown } | null)?.kind;
      return { ok: false, error: err, reason: `malformed command: ${kind === undefined ? 'non-object' : String(kind)}` };
    }
  }

  // pendingCommands (types.ts:108) is re-enqueued verbatim by fromSaveData
  // (runner.ts:2673-2675) and drained into applyCommand on the first resume
  // tick after load — it must be validated with the SAME rigor as commands so
  // a corrupt/hostile save can never reach applyCommand's raw 'unknown command
  // kind' throw or propagate NaN into the deterministic core after load
  // (CR-01). The field is optional in valid saves, so undefined is accepted.
  if (s.pendingCommands !== undefined) {
    if (!Array.isArray(s.pendingCommands)) {
      return { ok: false, error: 'commands-not-array', reason: 'pendingCommands must be an array' };
    }
    for (const cmd of s.pendingCommands) {
      const err = validateCommand(cmd);
      if (err === 'unknown-command-kind') {
        const kind = (cmd as { kind?: unknown } | null)?.kind;
        return { ok: false, error: err, reason: `unknown command kind: ${String(kind)}` };
      }
      if (err) {
        const kind = (cmd as { kind?: unknown } | null)?.kind;
        return { ok: false, error: err, reason: `malformed pending command: ${kind === undefined ? 'non-object' : String(kind)}` };
      }
    }
  }

  return { ok: true, data: data as SaveData };
}
