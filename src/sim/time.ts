/**
 * TimeSystem — deterministic fixed-timestep scheduler decoupled from frame rate.
 *
 * The simulation advances in discrete ticks. Callers feed raw real-time deltas
 * (e.g. Phaser's frame `delta` in ms); TimeSystem accumulates them and returns
 * how many sim ticks elapse. The accumulator adds `realDtMs * speed` each frame
 * and emits one tick per full `stepMs` of simulated time via integer division
 * (the `acc -= stepMs` loop), carrying the sub-step remainder into the next
 * frame. Pausing halts the clock (advance returns 0 and nothing accumulates);
 * an optional `maxCatchupSteps` bounds the catch-up burst after a long hitch.
 *
 * ### Frame-rate independence (integer division)
 *
 * For a wall-clock window of T ms at speed S, the tick count is
 * floor((T*S)/stepMs). Because the accumulator is linear — each frame adds its
 * share and every full `stepMs` of accumulated simulated ms becomes exactly one
 * tick while the fractional remainder carries over — any partition of T into
 * frame deltas {d1..dn} with sum = T produces the same total simulated ms and
 * therefore the identical tick count. The result depends only on T and S, never
 * on how the wall clock is sliced into frames, so identical sim state results at
 * any frame rate.
 *
 * The identity holds exactly by default. A finite `maxCatchupSteps` throttles a
 * single `advance` to that many ticks at most; the overflow is carried forward
 * as backlog instead of being dropped, so simulated time is never lost, a
 * one-off hitch cannot cause a huge burst, and the identity is restored as soon
 * as the backlog has drained. That bounded-per-frame behaviour is the deliberate
 * trade-off for callers who prefer it over strict slicing invariance.
 */
export class TimeSystem {
  private acc = 0;
  /** Real time between ticks, in milliseconds. */
  readonly stepMs: number;
  /** Speed multiplier applied to real time. */
  speed = 1;
  /** When paused, the sim clock halts and advance() returns 0. */
  paused = false;
  /** Upper bound of catch-up ticks per advance (default: unbounded). */
  private readonly maxCatchupSteps: number;

  constructor(stepMs: number, maxCatchupSteps: number = Number.POSITIVE_INFINITY) {
    this.stepMs = stepMs;
    this.maxCatchupSteps = maxCatchupSteps;
  }

  /** Feed `realDtMs` real time; returns the number of sim ticks that elapsed. */
  advance(realDtMs: number): number {
    if (this.paused || realDtMs <= 0) return 0;
    this.acc += realDtMs * this.speed;
    let steps = 0;
    while (this.acc >= this.stepMs && steps < this.maxCatchupSteps) {
      this.acc -= this.stepMs;
      steps++;
    }
    // Any backlog above maxCatchupSteps stays in `acc` for the next advance:
    // time is carried, never dropped, so slicing invariance is preserved once
    // the backlog drains (see contract above).
    return steps;
  }

  setSpeed(speed: number): void {
    if (!Number.isFinite(speed) || speed <= 0) {
      throw new RangeError(`speed must be a positive finite number, got ${speed}`);
    }
    this.speed = speed;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  /** Total simulated milliseconds that have elapsed into a partial tick. */
  pendingMs(): number {
    return this.acc;
  }
}

/** Standard speed presets, expressed as time multipliers. */
export const SPEED_PRESETS = [0.5, 1, 2, 4, 8] as const;
export type SpeedMultiplier = (typeof SPEED_PRESETS)[number];
