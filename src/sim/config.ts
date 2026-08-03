/**
 * Tunable simulation constants.
 * All timings are expressed in simulation ticks.
 * The renderer runs CONFIG.ticksPerSecond ticks per real second.
 *
 * Balance values are externalized to `data/balance.ts` (the data catalog) and
 * re-exported here as CONFIG so every existing consumer is unchanged while the
 * values themselves live in external data (DATA-02).
 */
import { BALANCE } from '../../data/balance';

export const CONFIG = { ...BALANCE };

/** House tiers: index 0 is the poorest, index 4 the richest. */
export interface HouseTier {
  name: string;
  population: number;
  workers: number;
  taxPerTick: number;
}

export const HOUSE_TIERS: readonly HouseTier[] = [
  { name: 'Shack', population: 5, workers: 1, taxPerTick: 5 },
  { name: 'Hovel', population: 10, workers: 2, taxPerTick: 7 },
  { name: 'Insula', population: 20, workers: 4, taxPerTick: 9 },
  { name: 'Domus', population: 35, workers: 7, taxPerTick: 11 },
  { name: 'Villa', population: 55, workers: 11, taxPerTick: 13 },
];
