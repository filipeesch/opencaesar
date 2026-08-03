import { describe, it, expect } from 'vitest';
import { MessageLog, createCamera, mergeOptions, serializeOptions, deserializeOptions } from '../../src/sim/ui';

describe('message log anti-spam (task 11.5)', () => {
  it('groups identical messages within the cooldown window', () => {
    let t = 0;
    const log = new MessageLog(30, 50, () => t);
    log.push('fire!', 'warning', 'risks');
    expect(log.count()).toBe(1);
    t = 10;
    log.push('fire!', 'warning', 'risks'); // same text, within cooldown — grouped
    expect(log.count()).toBe(1);
    expect(log.items()[0].count).toBe(2);
    t = 100;
    log.push('fire!', 'warning', 'risks'); // past cooldown — new entry
    expect(log.count()).toBe(2);
  });

  it('respects capacity cap', () => {
    const log = new MessageLog(1, 3, () => 0);
    for (let i = 0; i < 10; i++) log.push(`m${i}`, 'info', 'general');
    expect(log.count()).toBe(3);
  });
});

describe('camera controller (task 11.6)', () => {
  it('pans, zooms with clamps, and returns to center', () => {
    const cam = createCamera(1);
    cam.pan(10, 20);
    expect(cam.x).toBe(10);
    cam.setZoom(8);
    expect(cam.zoom).toBe(4); // clamped
    cam.returnToCenter(100, 200);
    expect(cam.x).toBe(50);
    expect(cam.y).toBe(100);
    expect(cam.zoom).toBe(1);
  });
});

describe('options & accessibility (task 11.8)', () => {
  it('round-trips options with defaults merge', () => {
    const o = mergeOptions({ textSize: 'large', reducedMotion: true });
    const json = serializeOptions(o);
    const back = deserializeOptions(json);
    expect(back.textSize).toBe('large');
    expect(back.reducedMotion).toBe(true);
    expect(back.audioMusic).toBeCloseTo(0.6); // default preserved
    expect(deserializeOptions('not json')).toEqual(mergeOptions({})); // corrupt -> defaults
  });
});
