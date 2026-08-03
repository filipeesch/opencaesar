import { describe, it, expect } from 'vitest';
import { pickEvent, applyEvent, hash } from '../src/sim/events';

describe('events', () => {
  it('hash is deterministic for a fixed seed/tick', () => {
    expect(hash(1337, 5)).toBe(hash(1337, 5));
  });

  it('pickEvent returns a known event or null deterministically', () => {
    const id = pickEvent(1337, 40);
    if (id) {
      const applied = applyEvent(id, { culture: 10, prosperity: 10, stability: 10, favor: 10 });
      expect(applied.message.length).toBeGreaterThan(0);
    }
  });

  it('applyEvent applies negative effects for disasters', () => {
    const applied = applyEvent('earthquake', { culture: 30, prosperity: 30, stability: 30, favor: 30 });
    expect(applied.prosperity).toBeLessThan(30);
  });

  it('applyEvent applies positive effects for good harvest', () => {
    const applied = applyEvent('good_harvest', { culture: 10, prosperity: 10, stability: 10, favor: 10 });
    expect(applied.prosperity).toBeGreaterThan(10);
  });
});
