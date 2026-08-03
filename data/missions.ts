/**
 * Missions — campaign objectives that drive the sandbox game.
 */

export interface MissionDef {
  id: string;
  name: string;
  description: string;
  /** Target population to achieve. */
  targetPopulation: number;
  /** Target culture rating. */
  targetCulture: number;
  /** Target prosperity rating. */
  targetProsperity: number;
  /** Target stability rating. */
  targetStability: number;
  /** Starting treasury (denarii). */
  startingDenarii: number;
  /** Time limit in years, if any. */
  timeLimitYears?: number;
}

export const MISSIONS: Record<string, MissionDef> = {
  tutorial: {
    id: 'tutorial', name: 'Tutorial: The Well', description: 'Provide water, food, and housing to grow your city.',
    targetPopulation: 100, targetCulture: 10, targetProsperity: 10, targetStability: 10, startingDenarii: 500,
  },
  small_town: {
    id: 'small_town', name: 'Small Town', description: 'Grow a small town with markets, workshops, and services.',
    targetPopulation: 500, targetCulture: 30, targetProsperity: 30, targetStability: 30, startingDenarii: 2000,
  },
  thriving_city: {
    id: 'thriving_city', name: 'Thriving City', description: 'Build a thriving city with grand temples and luxury housing.',
    targetPopulation: 2000, targetCulture: 60, targetProsperity: 60, targetStability: 60, startingDenarii: 5000, timeLimitYears: 10,
  },
  grand_city: {
    id: 'grand_city', name: 'Grand City', description: 'Build a grand city with a colosseum and senators.',
    targetPopulation: 5000, targetCulture: 80, targetProsperity: 80, targetStability: 80, startingDenarii: 10000, timeLimitYears: 20,
  },
};

export function missionName(id: string): string {
  return MISSIONS[id]?.name ?? id;
}
