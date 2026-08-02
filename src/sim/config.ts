/**
 * Tunable simulation constants.
 * All timings are expressed in simulation ticks.
 * The renderer runs CONFIG.ticksPerSecond ticks per real second.
 */
export const CONFIG = {
  /** Default map size when none is provided. */
  defaultMapSize: 40,
  /** Starting treasury in denarii. */
  startingTreasury: 1000,
  /** Simulation ticks executed per real second (used by the game shell only). */
  ticksPerSecond: 10,

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

  // Messages ------------------------------------------------------------------
  /** Maximum number of messages retained in state. */
  messageLogCapacity: 50,
  /** Re-emit the low-food warning at most this often (in ticks). */
  lowFoodWarnCooldownTicks: 100,
} as const;

/** House tiers: index 0 is the poorest, index 4 the richest. */
export interface HouseTier {
  name: string;
  population: number;
  workers: number;
  taxPerTick: number;
}

export const HOUSE_TIERS: readonly HouseTier[] = [
  { name: 'Shack', population: 5, workers: 1, taxPerTick: 1 },
  { name: 'Hovel', population: 10, workers: 2, taxPerTick: 2 },
  { name: 'Insula', population: 20, workers: 4, taxPerTick: 4 },
  { name: 'Domus', population: 35, workers: 7, taxPerTick: 7 },
  { name: 'Villa', population: 55, workers: 11, taxPerTick: 11 },
];
