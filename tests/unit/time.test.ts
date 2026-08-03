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
});
