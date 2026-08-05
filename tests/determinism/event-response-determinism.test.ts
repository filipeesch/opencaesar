/**
 * Wave 0 (Phase 15, RATE-03) scaffold for respondEvent replay determinism.
 *
 * Targets the Phase-15 API from 15-03-02: a replayable `respondEvent(eventId,
 * choiceId)` SaveCommand whose valid choice mutates outcome (treasury cost /
 * severity / early conclusion) and whose run→respond→save→load replay is
 * byte-identical, plus the derived constructionSpend / annualExports surfaces
 * from Waves 1-2. RED until tasks 15-01-02 / 15-02-02 / 15-03-02 land.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { pickEvent, eventDuration } from '../../src/sim/events';
import { EVENTS } from '../../data/events';
import { productionChainMap, buildProductionCity } from '../helpers';

function buildExportCity(r: SimRunner): void {
  buildProductionCity(r);
  r.takeLoan(1500); // fund route opens + any response treasury cost (replayable)
  r.openTradeRoute('massilia');
  r.setTradeOrder('massilia', 'pottery', 'export_above_reserve', { reserve: 2 });
}

/**
 * Replicate the runner's month-cadence event scheduling (tickCount % 40 === 0,
 * skipping while an event is active, duration from eventDuration) to locate a
 * (seed, monthTick) where a response-bearing event activates. Deterministic —
 * pickEvent/eventDuration are pure functions of (seed, tick).
 */
function findRespondableEvent(): { seed: number; tick: number; eventId: string; choiceId: string } {
  for (let seed = 1; seed <= 30; seed++) {
    let activeUntil = 0;
    for (let t = 40; t <= 1200; t += 40) {
      if (t >= activeUntil) {
        const id = pickEvent(seed, t);
        if (id) {
          const responses = EVENTS[id]?.responses;
          if (responses && responses.length > 0) {
            return { seed, tick: t, eventId: id, choiceId: responses[0].id };
          }
          activeUntil = t + eventDuration(id);
        }
      }
    }
  }
  throw new Error('no response-bearing event found for seeds 1..30 within 1200 ticks');
}

describe('respondEvent save/load replay determinism (Phase 15, RATE-03)', () => {
  it('run → respond → save → load yields a byte-identical getStateJson() with identical constructionSpend and annualExports', () => {
    const { seed, tick, eventId, choiceId } = findRespondableEvent();
    const extra = 120;

    const r = new SimRunner(seed, productionChainMap());
    buildExportCity(r);
    for (let i = 0; i < tick; i++) r.tick();
    expect(r.respondEvent(eventId, choiceId).ok).toBe(true);
    for (let i = 0; i < extra; i++) r.tick();

    // Continue BOTH runs from the save point so the same post-save ticks are
    // compared (fromSaveData replays the recorded response at tick 0).
    const loaded = SimRunner.fromSaveData(r.getSaveData(), productionChainMap());
    for (let i = 0; i < extra; i++) { r.tick(); loaded.tick(); }

    expect(loaded.getStateJson()).toBe(r.getStateJson());
    expect(loaded.getDerived().constructionSpend).toBe(r.getDerived().constructionSpend);
    expect(loaded.getDerived().annualExports).toBe(r.getDerived().annualExports);
  });

  it('invalid responses are no-ops and a recorded response replays byte-identically when replayed before the event re-fires', () => {
    const { seed, tick, eventId, choiceId } = findRespondableEvent();
    const r = new SimRunner(seed, productionChainMap());
    buildExportCity(r);
    for (let i = 0; i < tick; i++) r.tick();
    const before = r.getStateJson();
    // Rejected with no state change (unknown event / unknown choice).
    expect(r.respondEvent('unknown_event', 'x').ok).toBe(false);
    expect(r.respondEvent(eventId, 'bogus_choice').ok).toBe(false);
    expect(r.getStateJson()).toBe(before);
    // A valid response is recorded as a SaveCommand.
    expect(r.respondEvent(eventId, choiceId).ok).toBe(true);
    // Save → load replays the response at tick 0 (before the event re-fires)
    // and must reproduce the responded run byte-identically.
    const b = SimRunner.fromSaveData(r.getSaveData(), productionChainMap());
    expect(b.getStateJson()).toBe(r.getStateJson());
    expect(b.getDerived().constructionSpend).toBe(r.getDerived().constructionSpend);
    expect(b.getDerived().annualExports).toBe(r.getDerived().annualExports);
  });
});

/**
 * WR-05 (Phase 15 code-review fix): a recorded event response applies to a
 * single OCCURRENCE only — it is deleted at conclusion so a SECOND occurrence
 * of the same event id starts fresh (full base duration, player agency
 * restored) instead of silently re-applying the stale conclude choice.
 *
 * Locates a (seed, firstTick) where the first-responding event (a catalog
 * entry with both a conclude-capable and a non-conclude response) fires again
 * later in the same sim. The pure schedule is exercised the way the runner
 * drives it (month-cadence pickEvent at tickCount % 40 === 0 when no event is
 * active); the FIRST occurrence is modelled as concluding the next tick
 * (concluded early by the player's conclude response), every other occurrence
 * at its full eventDuration. Deterministic — pickEvent/eventDuration are pure.
 */
function findRepeatedConcludeEvent(): { seed: number; id: string; firstTick: number; concludeChoice: string; nonConcludeChoice: string } {
  for (let seed = 1; seed <= 40; seed++) {
    const fired: { id: string; t: number }[] = [];
    let activeUntil = 0;
    for (let t = 40; t <= 2600; t += 40) {
      if (t >= activeUntil) {
        const id = pickEvent(seed, t);
        if (id) {
          fired.push({ id, t });
          const def = EVENTS[id];
          const concludeCapable = def?.responses?.some((r) => r.effect.conclude) ?? false;
          activeUntil = t + (concludeCapable && fired.length === 1 ? 1 : eventDuration(id));
        }
      }
    }
    const first = fired[0];
    if (!first) continue;
    const def = EVENTS[first.id];
    if (!def?.responses) continue;
    const conclude = def.responses.find((r) => r.effect.conclude);
    const nonConclude = def.responses.find((r) => !r.effect.conclude);
    if (!conclude || !nonConclude) continue;
    if (fired.filter((f) => f.id === first.id).length >= 2) {
      return { seed, id: first.id, firstTick: first.t, concludeChoice: conclude.id, nonConcludeChoice: nonConclude.id };
    }
  }
  throw new Error('no repeated conclude-capable event found for seeds 1..40 within 2600 ticks');
}

/** Tick of the event's conclusion message after `after` (single occurrence per scan). */
function finalMsgTick(r: SimRunner, defId: string, after: number): number | undefined {
  const final = EVENTS[defId].finalMsg;
  let found: number | undefined;
  for (const e of r.getEvents()) {
    if (e.tick > after && e.text === final) found = e.tick;
  }
  return found;
}

/** Tick at which a NEW occurrence of the event fires after `after` (detects the
 *  record whose text begins with `<Name>: ` — the firing message). */
function nextFireTick(r: SimRunner, defId: string, after: number): number | undefined {
  const prefix = `${EVENTS[defId].name}: `;
  let budget = 2600;
  while (budget-- > 0) {
    for (const e of r.getEvents()) {
      if (e.tick > after && e.text.startsWith(prefix)) return e.tick;
    }
    r.tick();
  }
  return undefined;
}

describe('second-occurrence response freshness (Phase 15, WR-05)', () => {
  it('a recorded conclude response is cleared at conclusion, so a second occurrence of the same event runs its full duration with agency restored', () => {
    const { seed, id, firstTick, concludeChoice, nonConcludeChoice } = findRepeatedConcludeEvent();
    const dur = eventDuration(id);

    const r = new SimRunner(seed, productionChainMap());
    buildProductionCity(r);
    r.takeLoan(5000); // fund the first occurrence's conclude-response treasury cost
    for (let i = 0; i < firstTick; i++) r.tick();

    // First occurrence fires at firstTick; answer with a conclude-capable choice.
    const fire1 = r.getEvents().filter((e) => e.text.startsWith(`${EVENTS[id].name}: `)).at(-1);
    expect(fire1?.tick).toBe(firstTick);
    expect(r.respondEvent(id, concludeChoice).ok).toBe(true);
    // The conclude response ends the occurrence the next tick — and the
    // conclusion must clear the recorded response (runner.ts:314).
    r.tick();
    expect(finalMsgTick(r, id, firstTick)).toBe(firstTick + 1);

    // Drive to the SECOND occurrence of the same event id.
    const fire2 = nextFireTick(r, id, firstTick + 1);
    expect(fire2).toBeDefined();
    expect(fire2!).toBeGreaterThan(firstTick + 1);

    // fire2 + 1: the event must still be ACTIVE and accept a fresh player
    // response. If the stale conclude choice had leaked (regression), it would
    // auto-conclude the occurrence the tick it fired and this response would be
    // rejected as 'no-active-event'.
    r.tick();
    expect(r.getEvents().filter((e) => e.text.startsWith(`${EVENTS[id].name}: `)).at(-1)?.tick).toBe(fire2);
    expect(r.respondEvent(id, nonConcludeChoice).ok).toBe(true);

    // The second occurrence then runs its FULL natural duration — it concludes
    // exactly `eventDuration` ticks after it fired, never ~1-2 ticks later.
    let final2: number | undefined;
    let budget = dur + 20;
    while (budget-- > 0) {
      final2 = finalMsgTick(r, id, fire2!);
      if (final2 !== undefined) break;
      r.tick();
    }
    expect(final2).toBe(fire2! + dur);
  });
});

describe('no Math.random / wall-clock in the Phase 15 sim chain (determinism audit)', () => {
  it('ratings/objectives/events/trade/missions/advisors/types introduce no Math.random()/Date.now()/new Date() invocations (runner.ts excluded: its only Date.now is the save-serialization savedAt timestamp)', () => {
    const root = join(__dirname, '..', '..', 'src');
    for (const file of ['ratings.ts', 'objectives.ts', 'events.ts', 'trade.ts', 'missions.ts', 'advisors.ts', 'types.ts']) {
      const src = readFileSync(join(root, 'sim', file), 'utf8');
      expect(/Math\.random\s*\(/.test(src), `${file} uses Math.random`).toBe(false);
      expect(/Date\.now\s*\(/.test(src), `${file} uses Date.now`).toBe(false);
      expect(/new\s+Date\s*\(/.test(src), `${file} uses new Date`).toBe(false);
    }
  });
});
