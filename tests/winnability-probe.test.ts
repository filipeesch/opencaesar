/**
 * Phase 17 winnability probe (CAMPAIGN-01 success criterion 1).
 *
 * Proves every one of the 10 missions' target CEILINGS are reachable — inside
 * each mission's time limit — by scripting a strong self-funding city on a
 * resource-rich probe map, starting the mission FIRST on a fresh runner (the
 * sandbox rule — which grants the mission's treasury credit and opens its
 * routes), then tracking the transient max of every present target. Winnability
 * of the *ceiling* (RESEARCH: assert the ceiling, not the 3-month sustain — the
 * sustain hold is the player's job).
 *
 * The sim is fundamentally LOCAL: observable services, water, and labor need a
 * CONNECTED road network within the wanderers' ~8-tile range, so the probe
 * builds three COMPACT clusters on the exact geometry proven by the mission-win
 * tests (houses on row y=4 with civic/water interleaved below). The probe
 * measures the REAL reachable ceilings — the RESEARCH's L10-20 housing ladder
 * assumed food variety (vegetables/meat/fish) the current sim building set
 * cannot produce, so wheat-only food caps houses at level 5 and the mission
 * targets are pinned below the measured envelope (retuned in 17-03-02).
 */
import { describe, it, expect } from 'vitest';
import { Map as SimMap } from '../src/sim/map';
import { SimRunner } from '../src/sim/runner';
import { campaignMissions } from '../src/sim/missions';
import { MISSIONS, EXTRA_MISSIONS } from '../data/missions';

/** A 44×20 probe map: a fertile band under every cluster (farms) plus a stamped
 *  clay deposit for the pottery chain. */
function probeMap(): SimMap {
  const m = SimMap.fromLayout(44, 20, (x, y) => {
    if (y >= 1 && y <= 2 && x % 14 >= 2 && x % 14 <= 7) return 'fertile';
    return 'earth';
  });
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      m.mutateTileState(40 + dx, 10 + dy, (s) => { s.resourceType = 'clay_deposit'; });
    }
  }
  return m;
}

function placeAny(r: SimRunner, type: Parameters<SimRunner['placeBuilding']>[0], cands: [number, number][], o?: { god?: string }): boolean {
  for (const [x, y] of cands) {
    const res = r.placeBuilding(type, x, y, o);
    if (res.ok) return true;
  }
  return false;
}

/** One proven cluster: roads y=0/3/5, 6 houses on row y=4, food chain at y=1,
 *  school/theatre/temple + wells right below the houses (all within the local
 *  walker range so culture/water/education actually reach the homes). */
function placeCluster(r: SimRunner, ox: number): void {
  for (let x = ox; x <= ox + 12; x++) {
    r.placeBuilding('road', x, 0);
    r.placeBuilding('road', x, 3);
    r.placeBuilding('road', x, 5);
  }
  r.placeBuilding('road', ox + 7, 1);
  r.placeBuilding('road', ox + 7, 2);
  r.placeBuilding('road', ox + 7, 4);
  for (const x of [0, 2, 4, 6, 8, 10]) r.placeBuilding('house', ox + x, 4);
  placeAny(r, 'farm', [[ox + 0, 1], [ox + 4, 1]]);
  placeAny(r, 'granary', [[ox + 8, 1]]);
  placeAny(r, 'market', [[ox + 10, 1]]);
  placeAny(r, 'well', [[ox + 0, 6], [ox + 10, 6]]);
  placeAny(r, 'school', [[ox + 2, 6]]);
  placeAny(r, 'theatre', [[ox + 6, 6]]);
  placeAny(r, 'temple', [[ox + 10, 6]], { god: 'jupiter' });
}

/** Start the mission (fresh runner → sandbox: credit + routes), build three
 *  clusters, and tick up to the horizon tracking the transient target maxes. */
function probeMission(id: string, seed: number, years: number): Record<string, number> {
  const r = new SimRunner(seed, probeMap());
  const start = r.startMission(id);
  if (!start.ok) throw new Error(`startMission(${id}) rejected: ${start.error}`);
  for (const x of [0, 42]) for (let y = 0; y < 20; y++) r.placeBuilding('road', x, y); // network spines
  placeCluster(r, 0);
  placeCluster(r, 14);
  placeCluster(r, 28);
  r.openTradeRoute('massilia');
  r.setTradeOrder('massilia', 'pottery', 'export_above_reserve', { reserve: 2 });
  r.setPolicy(0.08, 0.2);

  const reached: Record<string, number> = { population: 0, culture: 0, prosperity: 0, stability: 0, favor: 0, treasury: 0, annualExports: 0 };
  for (let year = 0; year < years; year++) {
    r.requestRoyalSubsidy();
    for (let i = 0; i < 360; i++) r.tick();
    const d = r.getDerived();
    reached.population = Math.max(reached.population, d.population);
    reached.culture = Math.max(reached.culture, d.culture);
    reached.prosperity = Math.max(reached.prosperity, d.prosperity);
    reached.stability = Math.max(reached.stability, d.stability);
    reached.favor = Math.max(reached.favor, d.favor);
    reached.treasury = Math.max(reached.treasury, d.treasury);
    reached.annualExports = Math.max(reached.annualExports, d.annualExports);
  }
  return reached;
}

describe('winnability probe (Phase 17, CAMPAIGN-01)', () => {
  for (const id of campaignMissions()) {
    it(`mission '${id}' target ceilings are reachable within its time limit`, () => {
      const def = MISSIONS[id] ?? EXTRA_MISSIONS[id];
      const limit = def.modifiers?.timeLimitYears ?? def.timeLimitYears ?? 25;
      const o = probeMission(id, 1, Math.min(limit, 12));
      const entries: [string, number][] = [
        ['population', def.targetPopulation],
        ['culture', def.targetCulture],
        ['prosperity', def.targetProsperity],
        ['stability', def.targetStability],
      ];
      if (def.targetFavor !== undefined) entries.push(['favor', def.targetFavor]);
      if (def.targetTreasury !== undefined) entries.push(['treasury', def.targetTreasury]);
      if (def.targetAnnualExports !== undefined) entries.push(['annualExports', def.targetAnnualExports]);
      for (const [key, target] of entries) {
        expect(o[key], `${id}: ${key} reached ${o[key]} < target ${target}`).toBeGreaterThanOrEqual(target);
      }
    }, 180000);
  }
});
