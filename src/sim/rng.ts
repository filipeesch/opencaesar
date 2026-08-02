/**
 * Deterministic seeded RNG used by the simulation.
 * The sim must NEVER use Math.random — all randomness flows through an
 * instance of this interface injected at construction time.
 */
export interface Rng {
  /** Returns a pseudo-random float in [0, 1). */
  next(): number;
}

/**
 * mulberry32: a tiny, fast, high-quality 32-bit seeded PRNG.
 * Same seed + same call sequence → identical results on every platform.
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next(): number {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Random integer in [min, max] inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng.next() * (max - min + 1));
}

/** Random float in [min, max). */
export function randFloat(rng: Rng, min: number, max: number): number {
  return min + rng.next() * (max - min);
}
