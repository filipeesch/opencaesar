import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { TimeSystem } from '../../src/sim/time';
import { buildFoodCity, foodChainMap } from '../helpers';

function scriptedRun(seed: number, ticks: number): string {
  const runner = new SimRunner(seed, foodChainMap());
  buildFoodCity(runner);
  runner.setPolicy(0, 0.5);
  for (let i = 0; i < ticks; i++) runner.tick();
  return runner.getStateJson();
}

describe('determinism', () => {
  it('same seed and command sequence produce identical snapshots', () => {
    expect(scriptedRun(1234, 1000)).toBe(scriptedRun(1234, 1000));
  });

  it('same seed with different tick counts differs (state advances)', () => {
    expect(scriptedRun(1234, 500)).not.toBe(scriptedRun(1234, 501));
  });

  it('different seeds diverge once randomness is involved', () => {
    const a = JSON.parse(scriptedRun(1, 1000));
    const b = JSON.parse(scriptedRun(2, 1000));
    expect(JSON.stringify(a.walkers)).not.toBe(JSON.stringify(b.walkers));
  });

  it('save/load round-trips a seed-generated map to a byte-identical state', () => {
    // Seed-generated map (no map passed) so map gen and sim share one RNG,
    // exercising the real save/load replay path.
    const runner = new SimRunner(777);
    runner.placeBuilding('road', 3, 3);
    runner.placeBuilding('road', 3, 4);
    runner.placeBuilding('house', 3, 5);
    runner.setPolicy(0.1, 0.2);
    for (let i = 0; i < 500; i++) runner.tick();
    const original = runner.getStateJson();

    const loaded = SimRunner.fromSaveData(runner.getSaveData());
    expect(loaded.getStateJson()).toBe(original);
  });

  it('fromSaveData reproduces state even with policy changes replayed', () => {
    const runner = new SimRunner(888);
    runner.placeBuilding('road', 5, 5);
    runner.setPolicy(0.2, 0.5);
    for (let i = 0; i < 300; i++) runner.tick();
    runner.setPolicy(0.15, 0.35);

    const loaded = SimRunner.fromSaveData(runner.getSaveData());
    expect(loaded.getStateJson()).toBe(runner.getStateJson());
  });

  it('tick batching is order-independent (idempotency)', () => {
    // tick() is an atomic fixed step, so batching identical calls in chunk
    // sizes 1/7/50 cannot change the outcome: same sequence of 600 fixed steps.
    const seed = 1234;
    const runChunked = (chunk: number, total: number): string => {
      const runner = new SimRunner(seed, foodChainMap());
      buildFoodCity(runner);
      runner.setPolicy(0, 0.5);
      let ticked = 0;
      while (ticked < total) {
        const n = Math.min(chunk, total - ticked);
        for (let i = 0; i < n; i++) runner.tick();
        ticked += n;
      }
      return runner.getStateJson();
    };
    const s1 = runChunked(1, 600);
    const s7 = runChunked(7, 600);
    const s50 = runChunked(50, 600);
    expect(s50).toBe(s7);
    expect(s7).toBe(s1);
  });

  it('frame-rate independence: identical tick count and state across slicings at 8x', () => {
    // Real TimeSystem slicing: feed the same total wall time in different frame
    // partitions (a single 5000ms frame, 1000ms frames, 50ms frames, 16ms-ish
    // frames) and run exactly the number of ticks TimeSystem returns per frame.
    // At 8x the 5000ms window is floor(5000*8/250) = 160 sim ticks, and the
    // default (unthrottled) TimeSystem must yield that count for every
    // partition — proving the CORE-01 frame-rate-independence contract and
    // catching any slicing-dependent backlog drop.
    const seed = 9876;
    const stepMs = 250;
    const speed = 8;
    const totalMs = 5000;
    const expectedTicks = Math.floor((totalMs * speed) / stepMs); // 160

    const partition = (frames: number): number[] => {
      const base = Math.floor(totalMs / frames);
      const out = new Array<number>(frames).fill(base);
      out[out.length - 1] += totalMs - base * frames; // put the remainder on the last frame
      return out;
    };
    const partitions: number[][] = [
      [totalMs],
      partition(5),
      partition(50),
      partition(100),
      partition(312), // 16ms-style frames: floor(5000/312)=16, remainder 8
    ];

    const run = (deltas: number[]): { tick: number; json: string } => {
      const runner = new SimRunner(seed, foodChainMap());
      buildFoodCity(runner);
      runner.setPolicy(0, 0.5);
      const time = new TimeSystem(stepMs);
      time.setSpeed(speed);
      for (const d of deltas) {
        const n = time.advance(d);
        for (let i = 0; i < n; i++) runner.tick();
      }
      return { tick: runner.getState().tick, json: runner.getStateJson() };
    };

    const results = partitions.map(run);
    for (const r of results) expect(r.tick).toBe(expectedTicks);
    const baseline = results[0].json;
    for (const r of results.slice(1)) expect(r.json).toBe(baseline);
  });

  it('a paused place/demolish/policy script is deterministic across runs', () => {
    const script = (): string => {
      const runner = new SimRunner(2024, foodChainMap());
      buildFoodCity(runner);
      runner.setPaused(true);
      runner.placeBuilding('road', 9, 9);
      runner.setPolicy(0.25, 0.15);
      runner.demolish(3, 5); // a road placed by buildFoodCity (row y=5)
      runner.setPaused(false);
      for (let i = 0; i < 500; i++) runner.tick();
      return runner.getStateJson();
    };
    expect(script()).toBe(script());
  });

  it('save/load round-trips the paused command pipeline (incl. demolish)', () => {
    // Seed-generated map (no map passed) so map gen and sim share one RNG and
    // fromSaveData replays onto the identical map — same as the existing
    // seed-based round-trip tests. Exercises the new demolish SaveCommand branch.
    const runner = new SimRunner(777);
    runner.placeBuilding('road', 3, 3);
    runner.placeBuilding('road', 3, 4);
    runner.placeBuilding('house', 3, 5);
    runner.setPaused(true);
    runner.placeBuilding('road', 4, 3);
    runner.setPolicy(0.2, 0.15);
    runner.demolish(3, 3);
    runner.setPaused(false);
    for (let i = 0; i < 60; i++) runner.tick();
    const original = runner.getStateJson();
    const loaded = SimRunner.fromSaveData(runner.getSaveData());
    expect(loaded.getStateJson()).toBe(original);
  });
});
