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
 * Exported (Phase 17) so the codex derives its per-rating explains from the
 * LIVE weights — never hand-copied.
 */
export const W = {
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

/**
 * ONE Prosperity computation. `constructionSpend` is deliberately NOT part of
 * the operating-balance factor: one-time build cost lands only in the separate
 * construction bucket (D-02), so expansion is never double-penalized. computeTargets
 * computes the rating with construction neutral (spend 0); decomposeRatings
 * supplies the real constructionSpend so the bucket renders.
 */
function prosperityScore(s: CityStats, constructionSpend: number): { value: number; buckets: ProsperityDecomposition } {
  const housing = f(s.housingLevel, false);
  const patricians = f(s.patricianShare, false);
  const operatingBalance = f(s.operatingBalance, false);
  const unemployment = f(s.unemployment, false);
  const wages = f(s.wagesPaid, false);
  const trade = f(s.tradeActivity, false);
  const stability = f(s.longTermStability, false);
  const debt = f(s.debtBurden, false);
  const construction = Math.min(15, Math.floor(constructionSpend / 100));
  const value = clampRating(
    W.prosperity.base
      + housing * W.prosperity.housing
      + patricians * W.prosperity.patricians
      + operatingBalance * W.prosperity.operatingBalance
      + (1 - unemployment) * W.prosperity.unemployment
      + wages * W.prosperity.wages
      + trade * W.prosperity.trade
      + stability * W.prosperity.stability
      + (1 - debt) * W.prosperity.debt
      + construction,
  );
  return {
    value,
    buckets: {
      base: W.prosperity.base,
      economy: Math.min(20, Math.floor(s.population / 50)),
      construction,
      trade: Math.round(trade * W.prosperity.trade),
      housing: Math.round(housing * W.prosperity.housing),
      patricians: Math.round(patricians * W.prosperity.patricians),
      operatingBalance: Math.round(operatingBalance * W.prosperity.operatingBalance),
      unemployment: Math.round((1 - unemployment) * W.prosperity.unemployment),
      wages: Math.round(wages * W.prosperity.wages),
      stability: Math.round(stability * W.prosperity.stability),
      debt: Math.round((1 - debt) * W.prosperity.debt),
    },
  };
}

/** ONE Stability computation: worse-when-high factors are inverted (1 − factor),
 *  good-when-high factors credited directly; clamped 0..100. */
function stabilityScore(s: CityStats): { value: number; buckets: StabilityDecomposition } {
  const fire = f(s.fireRiskFactor, false);
  const homelessness = f(s.homelessness, false);
  const crime = f(s.crimeFactor, false);
  const protests = f(s.protestFactor, false);
  const health = f(s.healthCoverage, s.hasHealth);
  const supply = f(s.supplyLevel, false);
  const employment = f(s.employmentLevel, false);
  const collapses = f(s.collapseRiskFactor, false);
  const residential = f(s.residentialStability, false);
  const peace = s.hasFood && s.hasWater ? 10 : 0;
  const value = clampRating(
    W.stability.base
      + (1 - fire) * W.stability.fire
      + (1 - homelessness) * W.stability.homelessness
      + (1 - crime) * W.stability.crime
      + (1 - protests) * W.stability.protests
      + health * W.stability.health
      + supply * W.stability.supply
      + employment * W.stability.employment
      + (1 - collapses) * W.stability.collapses
      + residential * W.stability.residentialStability
      + peace,
  );
  return {
    value,
    buckets: {
      base: W.stability.base,
      peace,
      fire: Math.round((1 - fire) * W.stability.fire),
      homelessness: Math.round((1 - homelessness) * W.stability.homelessness),
      crime: Math.round((1 - crime) * W.stability.crime),
      protests: Math.round((1 - protests) * W.stability.protests),
      health: Math.round(health * W.stability.health),
      supply: Math.round(supply * W.stability.supply),
      employment: Math.round(employment * W.stability.employment),
      collapses: Math.round((1 - collapses) * W.stability.collapses),
      residentialStability: Math.round(residential * W.stability.residentialStability),
    },
  };
}

export function computeTargets(s: CityStats): Ratings {
  const culture = cultureScore(s).value;
  const prosperity = prosperityScore(s, 0).value;
  const stability = stabilityScore(s).value;
  // Favor keeps its legacy additive formula (pinned by the religion/governance
  // integration tests); its per-factor breakdown is surfaced via decomposeRatings.
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
 * Culture/Prosperity/Stability buckets are computed in the SAME pass as
 * computeTargets (shared score helpers — one computation, never a second
 * recompute). Favor is broken into its per-spec factors; its rating value is
 * pinned to the legacy formula plus the run-time worship/festival/governor
 * bonuses computed by the runner. Every bucket is clamped 0..100 by
 * construction.
 */
export function decomposeRatings(
  s: CityStats,
  constructionSpend: number,
): RatingDecomposition {
  return {
    culture: cultureScore(s).buckets,
    prosperity: prosperityScore(s, constructionSpend).buckets,
    stability: stabilityScore(s).buckets,
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
