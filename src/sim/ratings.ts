/**
 * Ratings — self-contained culture/prosperity/stability/favor computation.
 * Operates on plain building counts, so it does not depend on the live sim.
 */

export interface Ratings {
  culture: number;
  prosperity: number;
  stability: number;
  favor: number;
}

export interface CityStats {
  population: number;
  treasury: number;
  taxRate: number;
  hasReligion: boolean;
  hasEntertainment: boolean;
  hasEducation: boolean;
  hasHealth: boolean;
  hasWater: boolean;
  hasFood: boolean;
}

export function computeTargets(s: CityStats): Ratings {
  const culture =
    10 +
    (s.hasReligion ? 10 : 0) +
    (s.hasEntertainment ? 10 : 0) +
    (s.hasEducation ? 5 : 0);
  const prosperity =
    10 +
    (s.hasFood ? 5 : 0) +
    (s.hasWater ? 5 : 0) +
    Math.min(20, Math.floor(s.population / 50)) +
    (s.treasury > 1000 ? 10 : 0);
  const stability =
    10 +
    (s.hasFood && s.hasWater ? 10 : 0) +
    (s.hasHealth ? 5 : 0);
  const favor =
    10 + Math.max(0, 20 - Math.floor(s.taxRate * 100));
  return { culture, prosperity, stability, favor };
}

export function tickRatings(current: Ratings, target: Ratings): Ratings {
  return {
    culture: move(current.culture, target.culture),
    prosperity: move(current.prosperity, target.prosperity),
    stability: move(current.stability, target.stability),
    favor: move(current.favor, target.favor),
  };
}

function move(from: number, to: number): number {
  return Math.max(0, Math.min(100, Math.round(from + (to - from) * 0.1)));
}

export function clampRating(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** 4-rating decomposition (task 10.3). */
export interface RatingDecomposition {
  culture: { religion: number; entertainment: number; education: number; base: number };
  prosperity: { economy: number; construction: number; trade: number; base: number };
  stability: { peace: number; employment: number; base: number };
  favor: { worship: number; taxes: number; base: number };
}

/**
 * Decompose the four ratings into parts. Construction is treated separately
 * from the running economy for Prosperity (per spec).
 */
export function decomposeRatings(
  s: CityStats,
  constructionSpend: number,
): RatingDecomposition {
  return {
    culture: {
      base: 10,
      religion: s.hasReligion ? 10 : 0,
      entertainment: s.hasEntertainment ? 10 : 0,
      education: s.hasEducation ? 5 : 0,
    },
    prosperity: {
      base: 10,
      economy: Math.min(20, Math.floor(s.population / 50)),
      construction: Math.min(15, Math.floor(constructionSpend / 100)),
      trade: s.treasury > 1000 ? 10 : 0,
    },
    stability: {
      base: 10,
      peace: s.hasFood && s.hasWater ? 10 : 0,
      employment: s.hasHealth ? 5 : 0,
    },
    favor: {
      base: 10,
      worship: s.hasReligion ? 10 : 0,
      taxes: Math.max(0, 20 - Math.floor(s.taxRate * 100)),
    },
  };
}
