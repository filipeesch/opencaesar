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
