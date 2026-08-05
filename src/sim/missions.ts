/**
 * Missions — self-contained campaign objectives.
 *
 * Phase 17 (WR-03): the legacy runner-independent `startMission`/`tickMission`/
 * `missionName` exports were REMOVED — they hardcoded `year: 0` (the exact
 * time-limit landmine the runner's replayable startMission fixes) and only knew
 * MISSIONS (not EXTRA_MISSIONS), so any future caller importing them would
 * silently reintroduce the bug. The canonical start path is the runner's
 * replayable SaveCommand `SimRunner.startMission(id)`; mission display names
 * come from `data/missions.missionName`. Only the pure order helper remains.
 */

import { MISSIONS, EXTRA_MISSIONS } from '../../data/missions';

/** Campaign list: base missions + extras = 10. */
export function campaignMissions(): string[] {
  const base = Object.keys(MISSIONS).filter((k) => k !== 'tutorial');
  return ['tutorial', ...base, ...Object.keys(EXTRA_MISSIONS)];
}
