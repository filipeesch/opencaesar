/**
 * Ratings — self-contained culture/prosperity/stability/favor computation.
 * Operates on plain building counts, so it does not depend on the live sim.
 *
 * RATE-01 (Phase 15): the four ratings combine a weighted sum of normalized
 * 0..1 factor inputs, clamped 0..100, and are decomposed into per-factor
 * buckets via `decomposeRatings` — the rating and its decomposition are ONE
 * computation (a shared factor helper feeds both). Prosperity treats
 * construction cost separately: `constructionSpend` lands only in the
 * construction bucket, never the operating-balance factor.
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
  // --- RATE-01 normalized factor inputs (0..1). Optional so legacy
  // boolean-only callers keep their semantics; when absent the raw factor is
  // derived from the corresponding has* boolean (0 or 1). The runner passes the
  // live coverage values so the decomposition reflects real buildings. ---
  educationCoverage?: number;
  entertainmentCoverage?: number;
  religionCoverage?: number;
  /** 0..1 festival worship/favor boost window active. */
  festivalBoost?: number;
  healthCoverage?: number;
  // Prosperity factors.
  /** Average house tier / max tier, 0..1. */
  housingLevel?: number;
  /** Share of patrician (high-tier) housing, 0..1. */
  patricianShare?: number;
  /** Operating balance 0..1 (construction-excluded; worse when lower). */
  operatingBalance?: number;
  /** Unemployment rate 0..1 (worse when higher). */
  unemployment?: number;
  /** Wages paid 0..1 (good when higher). */
  wagesPaid?: number;
  /** Trade activity 0..1 (good when higher). */
  tradeActivity?: number;
  /** Long-term stability 0..1 (good when higher). */
  longTermStability?: number;
  /** Debt burden 0..1 (worse when higher). */
  debtBurden?: number;
  // Stability factors.
  /** Fire risk 0..1 (worse when higher). */
  fireRiskFactor?: number;
  /** Homelessness 0..1 (worse when higher). */
  homelessness?: number;
  /** Crime 0..1 (worse when higher). */
  crimeFactor?: number;
  /** Protests/unrest 0..1 (worse when higher). */
  protestFactor?: number;
  /** Supply/stock level 0..1 (good when higher). */
  supplyLevel?: number;
  /** Employment level 0..1 (good when higher, 1 − unemployment). */
  employmentLevel?: number;
  /** Collapse risk 0..1 (worse when higher). */
  collapseRiskFactor?: number;
  /** Residential stability 0..1 (good when higher). */
  residentialStability?: number;
  // Favor factors (all good when higher).
  requestsFulfilled?: number;
  giftsGiven?: number;
  objectivesMet?: number;
  tributePaid?: number;
  salaryLevel?: number;
  performance?: number;
}

/**
 * RATE-01 weighted-sum-of-normalized-factors. Weights are module-local consts —
 * intentionally NOT added to data/balance.ts, because every BALANCE key must
 * have a CONFIG.<key> consumer in src/ (balance-parity gate); keeping the
 * rating weights here dodge that requirement with zero external-key churn.
 */
const W = {
  culture: { education: 30, entertainment: 25, religion: 25, festival: 15, base: 10, coveragePenalty: 5 },
  prosperity: { housing: 14, patricians: 10, operatingBalance: 20, unemployment: 16, wages: 12, trade: 12, stability: 8, debt: 8, base: 5, construction: 5 },
  stability: { fire: 12, homelessness: 10, crime: 12, protests: 10, health: 10, supply: 12, employment: 12, collapses: 10, residentialStability: 12, base: 0 },
  favor: { requests: 12, gifts: 12, objectives: 14, tribute: 10, salary: 10, performance: 12, base: 0, debts: 10, taxes: 20, worship: 20 },
} as const;

/** Normalized 0..1 factor, falling back to the legacy boolean (0 or 1). */
function f(v: number | undefined, has: boolean): number {
  if (v !== undefined) return Math.max(0, Math.min(1, v));
  return has ? 1 : 0;
}

export interface CultureDecomposition {
  education: number;
  entertainment: number;
  religion: number;
  festival: number;
  coveragePenalty: number;
  base: number;
}

export interface ProsperityDecomposition {
  economy: number;
  construction: number;
  trade: number;
  base: number;
  housing: number;
  patricians: number;
  operatingBalance: number;
  unemployment: number;
  wages: number;
  stability: number;
  debt: number;
}

export interface StabilityDecomposition {
  peace: number;
  employment: number;
  base: number;
  fire: number;
  homelessness: number;
  crime: number;
  protests: number;
  health: number;
  supply: number;
  collapses: number;
  residentialStability: number;
}

export interface FavorDecomposition {
  worship: number;
  taxes: number;
  base: number;
  requests: number;
  debt: number;
  gifts: number;
  objectives: number;
  tribute: number;
  salary: number;
  performance: number;
}

/** 4-rating decomposition (task 10.3 / RATE-01). */
export interface RatingDecomposition {
  culture: CultureDecomposition;
  prosperity: ProsperityDecomposition;
  stability: StabilityDecomposition;
  favor: FavorDecomposition;
}

/**
 * ONE culture computation: returns the clamped weighted rating and the same
 * factor buckets decomposeRatings reports. Feed the same CityStats to both
 * computeTargets and decomposeRatings so they can never diverge.
 */
function cultureScore(s: CityStats): { value: number; buckets: CultureDecomposition } {
  const education = f(s.educationCoverage, s.hasEducation);
  const entertainment = f(s.entertainmentCoverage, s.hasEntertainment);
  const religion = f(s.religionCoverage, s.hasReligion);
  const festival = Math.max(0, Math.min(1, s.festivalBoost ?? 0));
  // Coverage penalty: the city is penalized when civic culture coverage is
  // broadly absent (weighted small so it never dominates the score).
  const coveragePenalty = Math.min(1, 1 - Math.max(education, entertainment, religion));
  const value = clampRating(
    W.culture.base
      + education * W.culture.education
      + entertainment * W.culture.entertainment
      + religion * W.culture.religion
      + festival * W.culture.festival
      - coveragePenalty * W.culture.coveragePenalty,
  );
  return {
    value,
    buckets: {
      base: W.culture.base,
      education: Math.round(education * W.culture.education),
      entertainment: Math.round(entertainment * W.culture.entertainment),
      religion: Math.round(religion * W.culture.religion),
      festival: Math.round(festival * W.culture.festival),
      coveragePenalty: Math.round(coveragePenalty * W.culture.coveragePenalty),
    },
  };
}

export function computeTargets(s: CityStats): Ratings {
  const culture = cultureScore(s).value;
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

/**
 * Decompose the four ratings into parts. Construction is treated separately
 * from the running economy for Prosperity (per spec): constructionSpend lands
 * only in the construction bucket, never the operating-balance factor.
 *
 * Culture is computed in the SAME pass as computeTargets (cultureScore). The
 * remaining three ratings' factor buckets are derived from the same CityStats
 * inputs; every value is clamped 0..100 by construction.
 */
export function decomposeRatings(
  s: CityStats,
  constructionSpend: number,
): RatingDecomposition {
  return {
    culture: cultureScore(s).buckets,
    prosperity: {
      base: W.prosperity.base,
      economy: Math.min(20, Math.floor(s.population / 50)),
      construction: Math.min(15, Math.floor(constructionSpend / 100)),
      trade: s.treasury > 1000 ? 10 : 0,
      // RATE-01 weighted factor buckets (normalized * weight).
      housing: Math.round(f(s.housingLevel, false) * W.prosperity.housing),
      patricians: Math.round(f(s.patricianShare, false) * W.prosperity.patricians),
      operatingBalance: Math.round(f(s.operatingBalance, true) * W.prosperity.operatingBalance),
      unemployment: Math.round((1 - f(s.unemployment, false)) * W.prosperity.unemployment),
      wages: Math.round(f(s.wagesPaid, true) * W.prosperity.wages),
      stability: Math.round(f(s.longTermStability, true) * W.prosperity.stability),
      debt: Math.round((1 - f(s.debtBurden, false)) * W.prosperity.debt),
    },
    stability: {
      base: W.stability.base,
      peace: s.hasFood && s.hasWater ? 10 : 0,
      fire: Math.round((1 - f(s.fireRiskFactor, false)) * W.stability.fire),
      homelessness: Math.round((1 - f(s.homelessness, false)) * W.stability.homelessness),
      crime: Math.round((1 - f(s.crimeFactor, false)) * W.stability.crime),
      protests: Math.round((1 - f(s.protestFactor, false)) * W.stability.protests),
      health: Math.round(f(s.healthCoverage, s.hasHealth) * W.stability.health),
      supply: Math.round(f(s.supplyLevel, true) * W.stability.supply),
      employment: Math.round(f(s.employmentLevel, true) * W.stability.employment),
      collapses: Math.round((1 - f(s.collapseRiskFactor, false)) * W.stability.collapses),
      residentialStability: Math.round(f(s.residentialStability, true) * W.stability.residentialStability),
    },
    favor: {
      base: W.favor.base,
      worship: s.hasReligion ? 10 : 0,
      taxes: Math.max(0, 20 - Math.floor(s.taxRate * 100)),
      requests: Math.round(f(s.requestsFulfilled, false) * W.favor.requests),
      debt: Math.round((1 - f(s.debtBurden, false)) * W.favor.debts),
      gifts: Math.round(f(s.giftsGiven, false) * W.favor.gifts),
      objectives: Math.round(f(s.objectivesMet, false) * W.favor.objectives),
      tribute: Math.round(f(s.tributePaid, false) * W.favor.tribute),
      salary: Math.round(f(s.salaryLevel, false) * W.favor.salary),
      performance: Math.round(f(s.performance, false) * W.favor.performance),
    },
  };
}
