/**
 * Missions — self-contained campaign objectives.
 */

import { MISSIONS, EXTRA_MISSIONS } from '../../data/missions';

export interface MissionState {
  id: string;
  started: boolean;
  complete: boolean;
  failed: boolean;
  year: number;
  objective: string;
}

export interface MissionCheck {
  population: number;
  culture: number;
  prosperity: number;
  stability: number;
  year: number;
}

export function startMission(missionId: string): MissionState {
  const mission = MISSIONS[missionId];
  return {
    id: missionId,
    started: true,
    complete: false,
    failed: false,
    year: 0,
    objective: mission?.description ?? missionId,
  };
}

/**
 * Check mission completion/failure against current city metrics.
 * Mutates the mission state in place.
 */
export function tickMission(state: MissionState, check: MissionCheck): void {
  if (!state || !state.started || state.complete || state.failed) return;
  const mission = MISSIONS[state.id];
  if (!mission) {
    state.failed = true;
    return;
  }
  if (mission.timeLimitYears && check.year - state.year > mission.timeLimitYears) {
    state.failed = true;
    return;
  }
  const ok =
    check.population >= mission.targetPopulation &&
    check.culture >= mission.targetCulture &&
    check.prosperity >= mission.targetProsperity &&
    check.stability >= mission.targetStability;
  if (ok) {
    state.complete = true;
  }
}

export function missionName(id: string): string {
  return MISSIONS[id]?.name ?? id;
}

/** Campaign list: base missions + extras = 10. */
export function campaignMissions(): string[] {
  const base = Object.keys(MISSIONS).filter((k) => k !== 'tutorial');
  return ['tutorial', ...base, ...Object.keys(EXTRA_MISSIONS)];
}
