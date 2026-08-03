import { describe, it, expect } from 'vitest';
import { TimeSystem, SPEED_PRESETS } from '../../src/sim/time';

describe('TimeSystem', () => {
  it('produces the same tick count regardless of how time is sliced (frame-rate independence)', () => {
    const stepMs = 250;
    const layouts: number[][] = [
      Array.from({ length: 100 }, () => 100), // 100ms frames
      Array.from({ length: 25 }, () => 400), // 400ms frames
      Array.from({ length: 250 }, () => 40), // 40ms frames (10,000ms total)
      Array.from({ length: 10 }, () => 1000), // 1s frames
    ];
    const counts = layouts.map((deltas) => {
      const t = new TimeSystem(stepMs);
      let steps = 0;
      for (const d of deltas) steps += t.advance(d);
      return steps;
    });
    // floor(10000/250) = 40 ticks regardless of slice size
    expect(new Set(counts)).toEqual(new Set([40]));
  });

  it('paused returns zero and does not accumulate', () => {
    const t = new TimeSystem(250);
    t.setPaused(true);
    expect(t.advance(1000)).toBe(0);
    expect(t.advance(5000)).toBe(0);
    t.setPaused(false);
    expect(t.advance(500)).toBe(2);
  });

  it('speed multiplier scales elapsed ticks', () => {
    const t = new TimeSystem(250);
    t.setSpeed(2);
    expect(t.advance(500)).toBe(4); // 2x speed over 500ms = 1000ms of sim time
  });

  it('supports the documented speed presets', () => {
    expect(SPEED_PRESETS).toEqual([0.5, 1, 2, 4, 8]);
  });

  it('caps catch-up after a hitch', () => {
    const t = new TimeSystem(250, 5);
    expect(t.advance(100_000)).toBeLessThanOrEqual(5);
  });

  it('0.5x speed halves elapsed ticks', () => {
    const t = new TimeSystem(250);
    t.setSpeed(0.5);
    // floor(1000*0.5/250) = 2 ticks
    expect(t.advance(1000)).toBe(2);
  });

  it('4x speed quadruples elapsed ticks', () => {
    const t = new TimeSystem(250);
    t.setSpeed(4);
    // floor(250*4/250) = 4 ticks
    expect(t.advance(250)).toBe(4);
  });

  it('8x speed octuples elapsed ticks', () => {
    // maxCatchupSteps (default 5) caps single-advance bursts, so raise it here
    // to observe the multiplier itself; the cap is covered by the catch-up test.
    const t = new TimeSystem(250, 8);
    t.setSpeed(8);
    // floor(250*8/250) = 8 ticks
    expect(t.advance(250)).toBe(8);
  });

  it('pausing at 8x still returns zero ticks', () => {
    const t = new TimeSystem(250);
    t.setSpeed(8);
    t.setPaused(true);
    expect(t.advance(1000)).toBe(0);
    expect(t.pendingMs()).toBe(0);
  });

  it('an exact stepMs boundary produces exactly one tick', () => {
    const t = new TimeSystem(250);
    expect(t.advance(250)).toBe(1);
    expect(t.pendingMs()).toBe(0);
  });

  it('accumulates carry-over across advance calls until a tick completes', () => {
    const t = new TimeSystem(250);
    expect(t.advance(125)).toBe(0);
    expect(t.pendingMs()).toBe(125); // leftover carried into the next frame
    expect(t.advance(125)).toBe(1); // 125 + 125 = 250 => exactly one full tick
    expect(t.pendingMs()).toBe(0); // leftover fully consumed
  });

  it('accepts every documented speed preset without throwing', () => {
    for (const s of SPEED_PRESETS) {
      const t = new TimeSystem(250);
      expect(() => t.setSpeed(s)).not.toThrow();
    }
  });

  it('rejects non-positive or non-finite speeds (IN-04)', () => {
    const t = new TimeSystem(250);
    for (const bad of [0, -2, NaN, Infinity, -Infinity]) {
      expect(() => t.setSpeed(bad)).toThrow();
    }
    t.setSpeed(4);
    expect(t.speed).toBe(4);
  });
});
