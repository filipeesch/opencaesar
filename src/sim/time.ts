/**
 * TimeSystem — deterministic fixed-timestep scheduler decoupled from frame rate.
 *
 * The simulation advances in discrete ticks. Callers feed raw real-time deltas
 * (e.g. Phaser's frame `delta` in ms); TimeSystem accumulates them and returns
 * how many sim ticks elapse. Because ticks are produced by integer division of
 * accumulated time, the total tick count for a given amount of simulated time is
 * independent of how that time is sliced into frames — guaranteeing identical
 * state regardless of frame rate.
 */
export class TimeSystem {
  private acc = 0;
  /** Real time between ticks, in milliseconds. */
  readonly stepMs: number;
  /** Speed multiplier applied to real time. */
  speed = 1;
  /** When paused, the sim clock halts and advance() returns 0. */
  paused = false;
  /** Upper bound of catch-up ticks per advance to avoid spiral-of-death after hitches. */
  private readonly maxCatchupSteps: number;

  constructor(stepMs: number, maxCatchupSteps = 5) {
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
    if (steps >= this.maxCatchupSteps) {
      // Drop the backlog so a single long hitch can't cause a huge burst.
      this.acc = 0;
    }
    return steps;
  }

  setSpeed(speed: number): void {
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
