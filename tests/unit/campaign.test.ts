import { describe, it, expect } from 'vitest';
import { campaignMissions } from '../../src/sim/missions';
import { buildCodex, nextTutorialPrompt, tutorialText, TUTORIAL_ELIGIBILITY } from '../../src/sim/campaign';
import { SimRunner } from '../../src/sim/runner';
import { foodChainMap, buildFoodCity } from '../helpers';

describe('10-mission campaign (task 10.6)', () => {
  it('provides a 10-mission campaign list', () => {
    expect(campaignMissions().length).toBe(10);
    expect(campaignMissions()[0]).toBe('tutorial');
    expect(new Set(campaignMissions()).size).toBe(10); // unique
  });
});

describe('codex (task 10.6)', () => {
  it('builds a codex from real building/commodity/service/god data', () => {
    const codex = buildCodex();
    expect(codex.some((e) => e.kind === 'building' && e.id === 'farm')).toBe(true);
    expect(codex.some((e) => e.kind === 'commodity' && e.id === 'wheat')).toBe(true);
    expect(codex.some((e) => e.kind === 'service')).toBe(true);
    expect(codex.some((e) => e.kind === 'god')).toBe(true);
  });
});

describe('contextual tutorial (task 10.6)', () => {
  it('returns unseen steps in order and marks them done when seen', () => {
    let seen = new Set<string>();
    const first = nextTutorialPrompt(seen as Set<never>);
    expect(first).toBe('roads');
    seen = new Set(['roads', 'housing', 'water']);
    expect(nextTutorialPrompt(seen as Set<never>)).toBe('food');
    expect(tutorialText('trade')).toContain('trade routes');
  });
});

describe('state-observed tutorial (Phase 17, CAMPAIGN-02)', () => {
  it('getTutorial preserves the ordered introduction and honors dismissal (roads → housing)', () => {
    const r = new SimRunner(7, foodChainMap());
    buildFoodCity(r); // houses exist; the well here means 'water' is NOT eligible
    expect(r.getTutorial().current?.step).toBe('roads'); // ordered seed preserved

    expect(r.dismissTutorialStep('roads').ok).toBe(true);
    const t = r.getTutorial();
    expect(t.current?.step).toBe('housing');
    expect(t.dismissed).toContain('roads');
  });

  it('dismissTutorialStep → save → load keeps the step dismissed (replayable preference, no SaveData)', () => {
    const r = new SimRunner(9, foodChainMap());
    buildFoodCity(r);
    r.dismissTutorialStep('roads');
    const loaded = SimRunner.fromSaveData(r.getSaveData(), foodChainMap());
    expect(loaded.getTutorial().dismissed).toContain('roads');
    // The dismissed step does not re-eligibilize — 'housing' is now current.
    expect(loaded.getTutorial().current?.step).toBe('housing');
  });

  it('an unknown tutorial step is rejected', () => {
    const r = new SimRunner(1);
    expect(r.dismissTutorialStep('not_a_step').ok).toBe(false);
  });

  it('an empty city still produces a shaped getTutorial (predicates total on live state)', () => {
    const r = new SimRunner(3);
    const t = r.getTutorial();
    expect(t.current?.step).toBe('roads'); // trivial introduction eligibility
    expect(Array.isArray(t.eligible)).toBe(true);
    expect(Array.isArray(t.dismissed)).toBe(true);
  });
});

describe('tutorial cause-detection predicates (Phase 17, CAMPAIGN-02)', () => {
  const snap = (p: Partial<import('../../src/sim/runner').DerivedSnapshot> = {}) =>
    ({
      population: 100, culture: 20, prosperity: 30, stability: 50, favor: 40,
      annualExports: 0, water: { coveredTiles: 100, totalTiles: 400 },
      ...p,
    }) as unknown as import('../../src/sim/runner').DerivedSnapshot;
  const city = (p: Partial<import('../../src/sim/campaign').CityView> = {}): import('../../src/sim/campaign').CityView => ({
    hasStorageStock: false, annualExports: 0, missionActive: false, hasFoodProducer: false,
    missionTargets: undefined, ...p,
  });
  const hv = (p: Partial<import('../../src/sim/campaign').HouseView>): import('../../src/sim/campaign').HouseView => ({
    id: 1, level: 1, laborConnected: true, workersRequired: 4, desirability: 100,
    foodCooldown: 120, waterCooldown: 120, laborCooldown: 120, ...p,
  });
  const ELIG = TUTORIAL_ELIGIBILITY;

  it('an isolated house fires immigration-blocked; a connected house does not', () => {
    const isolated = hv({ id: 1, laborConnected: false });
    const connected = hv({ id: 2, laborConnected: true });
    expect(ELIG['immigration-blocked'].eligible(snap(), [isolated], city())).toBe(true);
    expect(ELIG['immigration-blocked'].eligible(snap(), [connected], city())).toBe(false);
    // highlight reports the firing house id
    expect(ELIG['immigration-blocked'].highlight!([isolated, connected])).toEqual([1]);
  });

  it('a hungry house with no food producer fires no-food; a fed house does not', () => {
    const hungry = hv({ id: 1, foodCooldown: 0 });
    const fed = hv({ id: 2, foodCooldown: 120 });
    const noFood = city({ hasFoodProducer: false, hasStorageStock: false });
    expect(ELIG['food'].eligible(snap(), [hungry], noFood)).toBe(true);
    expect(ELIG['food'].eligible(snap(), [fed], noFood)).toBe(false);
  });

  it('housing-evolution fires when the next level is satisfied and desirability clears its padded threshold', () => {
    // level 1 → next level 2 (Hut): requires well + wheat, desirability 2 + 5.
    const satisfied = hv({ id: 1, level: 1, satisfied: ['well', 'wheat'], desirability: 100 });
    const stuckOnGoods = hv({ id: 2, level: 1, satisfied: ['well'], desirability: 100 });
    expect(ELIG['housing-evolution'].eligible(snap(), [satisfied], city())).toBe(true);
    expect(ELIG['housing-evolution'].eligible(snap(), [stuckOnGoods], city())).toBe(false);
  });

  it('every predicate is a total function — an empty city never throws and never fires a cause step', () => {
    const d = snap({ water: { coveredTiles: 0, totalTiles: 0 } });
    for (const step of ['water', 'food', 'labor', 'trade', 'rating', 'housing-evolution', 'immigration-blocked'] as const) {
      expect(() => ELIG[step].eligible(d, [], city())).not.toThrow();
      expect(ELIG[step].eligible(d, [], city())).toBe(false);
    }
  });

  it('the rating predicate explains a mission target shortfall', () => {
    const d = snap({ population: 50, culture: 10 });
    const active = city({ missionActive: true, missionTargets: { population: 100, culture: 10 } });
    expect(ELIG['rating'].eligible(d, [], active)).toBe(true); // population short
    const met = city({ missionActive: true, missionTargets: { population: 40 } });
    expect(ELIG['rating'].eligible(d, [], met)).toBe(false);
    expect(ELIG['rating'].eligible(d, [], city())).toBe(false); // no mission → false
  });
});
