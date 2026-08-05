/**
 * Per-mission map factory (Phase 17, CAMPAIGN-01).
 *
 * Parses a mission's deterministic layout string (row-major, '.' = earth) into a
 * `SimMap` via `SimMap.fromLayout` — pure, no RNG, no wall-clock, mirroring the
 * layout builders in tests/helpers.ts. The map is READ-ONLY after construction;
 * the caller passes it to `new SimRunner(seed, missionMap(def))` and to
 * `SimRunner.fromSaveData(save, missionMap(def))` so terrain round-trips through
 * save/load. Starter buildings are replayable `place` commands applied inside
 * startMission — never terrain mutation.
 *
 * Guarantee: the returned SimMap's terrain matches `def.map` exactly (the data
 * is validated at load — see the missions loop in data/validate.ts).
 */
import { Map as SimMap } from './map';
import type { MissionMapDef } from '../../data/missions';
import type { TileType } from './types';

/**
 * Build a SimMap from a mission map definition's layout string. `.` tiles stay
 * earth; every other char resolves through `legend` (validated ⊆ TileType at
 * load). Deterministic — a given def always produces the same map.
 */
export function buildMissionMap(def: MissionMapDef): SimMap {
  const rows = def.layout.split('\n');
  return SimMap.fromLayout(def.width, def.height, (x: number, y: number): TileType | undefined => {
    const row = rows[y];
    if (!row) return undefined;
    const ch = row[x];
    if (ch === undefined || ch === '.') return undefined;
    return def.legend[ch];
  });
}

/**
 * The construction-time mission map for `def`, or null when the mission defines
 * no map (a seed-generated / default map is then used). Pass the result to
 * `new SimRunner(seed, map)` and `SimRunner.fromSaveData(save, map)`.
 */
export function missionMap(def: { map?: MissionMapDef } | undefined): SimMap | null {
  if (!def?.map) return null;
  return buildMissionMap(def.map);
}
