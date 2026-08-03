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
  /** How much wheat a market walker fetches from a granary per trip. */
  marketFetchAmount: 5,

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
} as const;
