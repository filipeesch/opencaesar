/**
 * Balance catalog (DATA-02). All tunable simulation balance values live here as
 * external data rather than scattered in simulation code. The sim reads them via
 * the CONFIG re-export in `src/sim/config.ts`. Values must remain behaviorally
 * equivalent to the prior in-code constants (locked by an equivalence test).
 */
export const BALANCE = {
  /** Default map size when none is provided. */
  defaultMapSize: 40,
  /** Starting treasury in denarii. */
  startingTreasury: 1000,
  /** Simulation ticks executed per real second (used by the game shell only). */
  ticksPerSecond: 4,

  // Walker timings -----------------------------------------------------------
  /** Fraction of a tile a walker travels per tick (1 = one tile per tick). */
  walkerSpeedPerTick: 0.5,
  /** Default walker lifetime in ticks before it despawns. */
  walkerLifetimeTicks: 200,
  /** Spawn interval for market walkers. */
  marketSpawnEveryTicks: 40,
  /** Spawn interval for well walkers. */
  wellSpawnEveryTicks: 30,
  /** Spawn interval for labor walkers per house. */
  laborSpawnEveryTicks: 60,
  /** Spawn interval for safety walkers (fireman / engineer / marshal). */
  safetySpawnEveryTicks: 40,
  /** Coverage radius (manhattan tiles) of safety stations (fire/engineer/security). */
  safetyCoverageRadius: 8,
  /** Radius within which a fireman walker counts as brigade response. */
  safetyPatrolRadius: 5,
  /** How much wheat a market walker fetches from a granary per trip. */
  marketFetchAmount: 5,

  // Civic wellness (HEAL-01/EDUC-01/ENTR-01, Phase 12) ------------------------
  /** Health/literacy/entertainment gained per tick while the service access is fresh. */
  civicRisePerTick: 1,
  /** Health/literacy/entertainment lost per tick while the service access is stale. */
  civicDecayPerTick: 0.5,

  // Service coverage ----------------------------------------------------------
  /** Cooldown in ticks before a received service expires. */
  serviceCooldownTicks: 120,

  // Housing -------------------------------------------------------------------
  /** Ticks a house must stay satisfied to evolve one tier. */
  evolveWindowTicks: 60,
  /** Ticks a house must stay unsatisfied (no food/water) to devolve one tier. */
  devolveWindowTicks: 240,
  /** Desirability required to reach the next house tier (tier n needs n * this). */
  desirabilityThresholdPerTier: 25,
  /** Desirability bonus/penalty per policy point (wage - tax). */
  desirabilityPolicyGain: 200,
  /** Desirability added per active service (food, water, labor) at a house. */
  desirabilityServiceBonus: 15,
  /** Desirability penalty applied while wages go unpaid. */
  desirabilityUnpaidWagesPenalty: 100,
  /** Consecutive unpaid-wage ticks per arrears-depth step (the base penalty
   *  applies for the first period; each additional full period adds another
   *  base penalty). */
  desirabilityArrearsDepthPeriodTicks: 1080,

  // Food ----------------------------------------------------------------------
  /** Wheat produced per tick by a staffed farm on fertile land. */
  farmProductionPerTick: 0.5,
  /** Local wheat storage on a farm. */
  farmStorageCapacity: 20,
  /** Wheat storage capacity of a granary. */
  granaryCapacity: 100,
  /** Cart transfer rate from a producer to an adjacent granary. */
  cartTransferPerTick: 2,

  // Economy -------------------------------------------------------------------
  /** Denarii per worker per tick at 100% wage rate. */
  wagePerWorkerPerTick: 2,
  /** Treasury value treated as full prosperity revenue score. */
  prosperityRevenueTarget: 2000,

  // Finance (FIN-01 / Phase 10) -----------------------------------------------
  /** Maximum royal subsidy grant per year (denarii). */
  royalSubsidyCap: 500,
  /** Annual loan interest rate (accrued once per year, tick-based). */
  loanInterestRate: 0.1,
  /** Maximum principal a single loan request may take. */
  loanMaxAmount: 2000,
  /** Treasury above this limit loses the excess (anti-hoarding). */
  treasuryOverflowLimit: 5000,

  // Governance (GOV-01 / Phase 14) --------------------------------------------
  /** Maximum denarii the governor may accept in donations per year. */
  governorDonationCap: 500,
  /** Population threshold unlocking the Forum (administration). */
  govForumThreshold: 250,
  /** Population threshold unlocking the Senate (governor salary). */
  govSenateThreshold: 500,
  /** Population threshold unlocking the Governor Palace (grand send-off). */
  govPalatineThreshold: 900,

  // Happiness -----------------------------------------------------------------
  /** Weight of food coverage toward a house's happiness (out of 100). */
  happinessFoodWeight: 25,
  /** Weight of water coverage toward a house's happiness. */
  happinessWaterWeight: 20,
  /** Weight of labor coverage toward a house's happiness. */
  happinessLaborWeight: 15,
  /** Weight of desirability (normalized 0..1) toward a house's happiness. */
  happinessDesirabilityWeight: 25,
  /** Weight of wages being paid toward a house's happiness. */
  happinessWagesWeight: 15,

  // Messages ------------------------------------------------------------------
  /** Maximum number of messages retained in state. */
  messageLogCapacity: 50,
  /** Re-emit the low-food warning at most this often (in ticks). */
  lowFoodWarnCooldownTicks: 100,

  // Trade (TRAD-05 / Phase 9) -------------------------------------------------
  /** History ring depth for the per-good trade price model (§19.5). */
  tradePriceHistoryWindow: 8,
  /** Denarii within which the trend reads "steady". */
  tradePriceSteadyTolerance: 1,
  /** Floor for an effective trade price (never ≤ 0). */
  tradePriceFloor: 1,
  /** Ticks a merchant without a road/berth waits before leaving without trading (§19.3). */
  merchantWaitTicks: 120,
} as const;
