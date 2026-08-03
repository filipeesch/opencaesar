/**
 * Events — deterministic (seed + tick) random events.
 */

import { EVENTS } from '../../data/events';

export interface EventResult {
  id: string;
  name: string;
  severity: string;
  message: string;
  culture?: number;
  prosperity?: number;
  stability?: number;
  favor?: number;
}

/** Deterministic hash of (seed, tick). */
export function hash(seed: number, tick: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ (tick + 1), 0x9e3779b1) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/** Pick an event deterministically for the given seed/tick. Returns null if no event fires. */
export function pickEvent(seed: number, tick: number): string | null {
  const total = Object.values(EVENTS).reduce((s, e) => s + e.weight, 0);
  let roll = hash(seed, tick) % total;
  for (const [id, ev] of Object.entries(EVENTS)) {
    roll -= ev.weight;
    if (roll < 0) return id;
  }
  return null;
}

export function applyEvent(id: string, ratings: { culture: number; prosperity: number; stability: number; favor: number }): EventResult {
  const ev = EVENTS[id];
  if (!ev) {
    return { id, name: id, severity: 'mild', message: 'Unknown event' };
  }
  const r = { ...ratings };
  if (ev.effect.culture) r.culture = Math.max(0, r.culture + ev.effect.culture);
  if (ev.effect.prosperity) r.prosperity = Math.max(0, r.prosperity + ev.effect.prosperity);
  if (ev.effect.stability) r.stability = Math.max(0, r.stability + ev.effect.stability);
  if (ev.effect.favor) r.favor = Math.max(0, r.favor + ev.effect.favor);
  return {
    id: ev.id,
    name: ev.name,
    severity: ev.severity,
    message: ev.message,
    culture: r.culture,
    prosperity: r.prosperity,
    stability: r.stability,
    favor: r.favor,
  };
}
