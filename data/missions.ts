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
  /** Optional RATE-02 targets — when present the mission must hold ADVANCED
   *  targets (favor/treasury/annual exports) too, each undefined = not
   *  required. */
  targetFavor?: number;
  targetTreasury?: number;
  targetAnnualExports?: number;
  /** Months the targets must be held consecutively (default 3). */
  sustainChecks?: number;
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

// Extended campaign to reach 10 missions (task 10.6).
export const EXTRA_MISSIONS: Record<string, MissionDef> = {
  fishing_village: {
    id: 'fishing_village', name: 'Fishing Village', description: 'Build a thriving fishing village on the coast.',
    targetPopulation: 300, targetCulture: 20, targetProsperity: 20, targetStability: 20, startingDenarii: 1500,
  },
  market_town: {
    id: 'market_town', name: 'Market Town', description: 'Grow a bustling market town with workshops and warehouses.',
    targetPopulation: 900, targetCulture: 40, targetProsperity: 40, targetStability: 40, startingDenarii: 3000, timeLimitYears: 8,
  },
  port_city: {
    id: 'port_city', name: 'Port City', description: 'Establish a trading port with merchant ships.',
    targetPopulation: 3000, targetCulture: 60, targetProsperity: 60, targetStability: 60, startingDenarii: 6000, timeLimitYears: 12,
  },
  cultural_center: {
    id: 'cultural_center', name: 'Cultural Center', description: 'Foster education and entertainment to become a cultural center.',
    targetPopulation: 4000, targetCulture: 80, targetProsperity: 50, targetStability: 60, startingDenarii: 8000, timeLimitYears: 15,
  },
  religious_hub: {
    id: 'religious_hub', name: 'Religious Hub', description: 'Build grand temples and win the favor of the gods.',
    targetPopulation: 4500, targetCulture: 70, targetProsperity: 60, targetStability: 70, startingDenarii: 9000, timeLimitYears: 18,
  },
  metropolis: {
    id: 'metropolis', name: 'Metropolis', description: 'Create a glorious metropolis to crown the campaign.',
    targetPopulation: 6000, targetCulture: 85, targetProsperity: 85, targetStability: 85, startingDenarii: 12000, timeLimitYears: 25,
  },
};
