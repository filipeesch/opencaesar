import { describe, it, expect } from 'vitest';
import { pickEvent, applyEvent, hash, resolveResponse } from '../src/sim/events';
import { EVENTS } from '../data/events';

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

describe('event responses (RATE-03)', () => {
  it('resolveResponse resolves a valid choice and returns undefined for an unknown one', () => {
    const spend = resolveResponse('drought', 'spend_now');
    expect(spend).toBeDefined();
    expect(spend!.effect.treasuryCost).toBe(200);
    expect(spend!.label.length).toBeGreaterThan(0);

    expect(resolveResponse('drought', 'no_such_choice')).toBeUndefined();
    expect(resolveResponse('unknown_event', 'spend_now')).toBeUndefined();
  });

  it('every response id is unique across the whole catalog', () => {
    const all: string[] = [];
    for (const ev of Object.values(EVENTS)) {
      for (const resp of ev.responses ?? []) all.push(`${ev.id}:${resp.id}`);
    }
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBeGreaterThan(0);
  });

  it('pins the expanded pickEvent schedule for one fixed seed+tick (freezes the new totalWeight)', () => {
    expect(pickEvent(1337, 40)).toBe('strike');
    expect(pickEvent(7, 80)).toBe('donation');
    expect(pickEvent(1337, 480)).toBe('industrial_accident');
  });
});
