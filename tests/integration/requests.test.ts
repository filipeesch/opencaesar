import { describe, expect, it } from 'vitest';
import { SimRunner } from '../../src/sim/runner';
import { Map as SimMap } from '../../src/sim/map';

describe('administrative requests (GOV-02)', () => {
  // All-fertile 34×34 city parameterized by seed. Houses are seeded at tick 0
  // so population is already ≥900 (palatine eligible); gov buildings are
  // placed at tick 0. Request arrival is deterministic: seed 42 gives
  // tax_tithe@160/280/400 + wine_delivery; seed 7 gives grain_delivery@480 and
  // grand_send_off once the palatine is placed.
  function reqCity(seed: number, gov: Array<'forum' | 'senate' | 'palatine'> = ['forum', 'senate', 'palatine']): SimRunner {
    const W = 34;
    const m = SimMap.fromLayout(W, W, () => 'fertile');
    const r = new SimRunner(seed, m);
    for (const y of [0, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29]) {
      const maxX = y === 3 || y === 5 ? 17 : W;
      for (let x = 0; x < maxX; x++) r.placeBuilding('road', x, y);
    }
    for (const y of [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28]) r.placeBuilding('road', 7, y);
    r.requestRoyalSubsidy();
    for (let i = 0; i < 9; i++) r.takeLoan(2000);
    for (const [type, x, y] of [['farm', 0, 1], ['granary', 2, 1], ['market', 4, 1]] as const) {
      const res = r.placeBuilding(type, x, y);
      if (!res.ok) throw new Error(`place ${type}: ${JSON.stringify(res)}`);
    }
    for (const y of [4, 8, 12, 16, 20, 24, 28]) {
      for (let x = 0; x < (y === 4 ? 17 : 34); x++) r.placeBuilding('house', x, y);
    }
    const spots: Record<string, [number, number]> = { forum: [18, 1], senate: [22, 1], palatine: [26, 1] };
    for (const g of gov) {
      const [x, y] = spots[g];
      const res = r.placeBuilding(g, x, y);
      if (!res.ok) throw new Error(`place ${g}@(${x},${y}): ${JSON.stringify(res)} pop=${r.getPopulation()}`);
    }
    r.setPolicy(0.10, 0.135);
    return r;
  }

  it('requests arrive on the month cadence once a forum is placed', () => {
    const r = reqCity(42);
    for (let i = 0; i < 160; i++) r.tick();
    const act = r.getRequests().active;
    expect(act.length).toBeGreaterThan(0);
    const tithe = act.find((a) => a.requestId === 'tax_tithe');
    expect(tithe).toBeDefined();
    expect(tithe!.arrivalTick).toBe(160);
    expect(tithe!.amount).toBe(200);
  });

  it('no requests arrive without a placed forum', () => {
    const r = reqCity(42, ['senate', 'palatine']);
    for (let i = 0; i < 800; i++) r.tick();
    expect(r.getRequests().active.length).toBe(0);
    expect(r.getRequests().history.length).toBe(0);
  });

  it('paying a denarii request in full pays the reward', () => {
    const r = reqCity(42);
    for (let i = 0; i < 160; i++) r.tick();
    const tithe = r.getRequests().active.find((a) => a.requestId === 'tax_tithe')!;
    const before = r.getTreasury();
    const p = r.payRequest(tithe.id, 200);
    expect(p.ok).toBe(true);
    expect(p.delivered).toBe(200);
    expect(r.getTreasury()).toBe(before - 200);
    for (let i = 0; i < 40; i++) r.tick();
    const done = r.getRequests().history.find((h) => h.requestId === 'tax_tithe');
    expect(done?.outcome).toBe('reward');
  });

  it('partial payments accumulate toward the request', () => {
    const r = reqCity(42);
    for (let i = 0; i < 160; i++) r.tick();
    const tithe = r.getRequests().active.find((a) => a.requestId === 'tax_tithe')!;
    r.payRequest(tithe.id, 80);
    const mid = r.getRequests().active.find((a) => a.id === tithe.id)!;
    expect(mid.delivered).toBe(80);
    r.payRequest(tithe.id, 120);
    for (let i = 0; i < 40; i++) r.tick();
    expect(r.getRequests().history.some((h) => h.requestId === 'tax_tithe' && h.outcome === 'reward')).toBe(true);
  });

  it('ignoring a request past its deadline charges the penalty', () => {
    const r = reqCity(42);
    for (let i = 0; i < 160; i++) r.tick();
    // tax_tithe deadline is 6 months. monthsElapsed = (tick-160)/40; penalty
    // fires when monthsElapsed > 6, i.e. at tick 440 (280 ticks past arrival).
    // Sample the 'other' ledger within year 1 (360→720) so the year-rollover
    // ledger reset at tick 360 does not skew the delta; only the first tithe
    // expires in the 400→440 window (the 280/400 tithes expire later).
    for (let i = 0; i < 240; i++) r.tick(); // now at tick 400, year 1
    const ledBefore = r.getTreasuryLedger().expenses.other ?? 0;
    for (let i = 0; i < 40; i++) r.tick(); // 400 → 440
    const done = r.getRequests().history.find((h) => h.requestId === 'tax_tithe');
    expect(done?.outcome).toBe('penalty');
    const penaltyLed = (r.getTreasuryLedger().expenses.other ?? 0) - ledBefore;
    expect(penaltyLed).toBe(100);
  });

  it('later requests arrive while a forum is placed (multiple active requests)', () => {
    const r = reqCity(42);
    for (let i = 0; i < 900; i++) r.tick();
    const seen = new Set([
      ...r.getRequests().history.map((h) => h.requestId),
      ...r.getRequests().active.map((a) => a.requestId),
    ]);
    // seed 42 yields at least tax_tithe and wine_delivery over time.
    expect(seen.has('tax_tithe')).toBe(true);
    expect(seen.has('wine_delivery')).toBe(true);
  });

  it('delivering a goods request consumes storage stock toward the request', () => {
    const r = reqCity(7);
    for (let i = 0; i < 480; i++) r.tick();
    const grain = r.getRequests().active.find((a) => a.requestId === 'grain_delivery');
    expect(grain).toBeDefined();
    const wheatBefore = (r as unknown as { totalTradeStock: (g: string) => number }).totalTradeStock('wheat');
    const d = r.deliverGoods(grain!.id, 'wheat', 40);
    expect(d.ok).toBe(true);
    const wheatAfter = (r as unknown as { totalTradeStock: (g: string) => number }).totalTradeStock('wheat');
    expect(wheatBefore - wheatAfter).toBeGreaterThan(0);
    expect(r.getRequests().active.find((a) => a.id === grain!.id)!.delivered).toBeGreaterThan(0);
  });

  it('delivering a wrong good or an unknown request errors', () => {
    const r = reqCity(42);
    for (let i = 0; i < 160; i++) r.tick();
    expect(r.deliverGoods('no_such_request@0', 'wheat', 10).ok).toBe(false);
    const tithe = r.getRequests().active.find((a) => a.requestId === 'tax_tithe');
    if (tithe) {
      expect(r.deliverGoods(tithe.id, 'wheat', 10).ok).toBe(false); // denarii request: wrong-good
    }
  });

  it('grand send-off is only available with the palatine placed', () => {
    // Seed 7: grain @480; grand_send_off arrives on a later month once the
    // palatine is placed (settles expired, penalty 0, around tick 840).
    const r = reqCity(7, ['forum', 'senate', 'palatine']);
    for (let i = 0; i < 900; i++) r.tick();
    expect(r.getRequests().history.some((h) => h.requestId === 'grand_send_off')).toBe(true);
    // The same city without the palatine never yields a send-off request.
    const noPal = reqCity(7, ['forum', 'senate']);
    for (let i = 0; i < 900; i++) noPal.tick();
    const all = [
      ...noPal.getRequests().active.map((a) => a.requestId),
      ...noPal.getRequests().history.map((h) => h.requestId),
    ];
    expect(all).not.toContain('grand_send_off');
  });

  it('population requests auto-fill when the city reaches the target', () => {
    // Seed 1337 on the generated map: roads + a reduced house set (pop ~920,
    // below the 1500 target so the request stays eligible; ≥900 so all three
    // government buildings place). population_drive arrives at tick 320.
    // Adding the remaining houses pushes population past 1500; the next month
    // check settles it with a reward (delivered auto-tracks population).
    const r = new SimRunner(1337);
    const m = r['map'] as unknown as { get(x: number, y: number): string; width: number; height: number };
    r.requestRoyalSubsidy();
    for (let i = 0; i < 10; i++) r.takeLoan(2000);
    for (const y of [2, 8, 14, 20, 26, 32]) {
      for (let x = 0; x < m.width; x++) if (m.get(x, y) !== 'water') r.placeBuilding('road', x, y);
    }
    const coords: Array<[number, number]> = [];
    for (const y of [2, 8, 14, 20, 26, 32]) {
      for (const hy of [y - 1, y + 1]) {
        if (hy < 0 || hy >= m.height) continue;
        for (let x = 0; x < 34; x++) if (m.get(x, hy) !== 'water') coords.push([x, hy]);
      }
    }
    for (let i = 0; i < 185; i++) r.placeBuilding('house', coords[i][0], coords[i][1]);
    for (const t of ['forum', 'senate', 'palatine'] as const) {
      let done = false;
      for (let y = 0; y < m.height && !done; y++) {
        for (let x = 0; x < m.width && !done; x++) {
          if (m.get(x, y) === 'water') continue;
          if (r.placeBuilding(t, x, y).ok) done = true;
        }
      }
      if (!done) throw new Error(`place ${t}: pop=${r.getPopulation()}`);
    }
    r.setPolicy(0.10, 0.135);
    for (let i = 0; i < 320; i++) r.tick();
    const popReq = r.getRequests().active.find((a) => a.requestId === 'population_drive');
    expect(popReq).toBeDefined();
    expect(popReq!.arrivalTick).toBe(320);
    expect(popReq!.delivered).toBe(r.getPopulation());
    expect(r.getPopulation()).toBeLessThan(1500);
    for (let i = 185; i < coords.length; i++) r.placeBuilding('house', coords[i][0], coords[i][1]);
    expect(r.getPopulation()).toBeGreaterThanOrEqual(1500);
    for (let i = 0; i < 80; i++) r.tick();
    const done = r.getRequests().history.find((h) => h.requestId === 'population_drive');
    expect(done?.outcome).toBe('reward');
  });
});
