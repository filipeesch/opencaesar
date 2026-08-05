import { describe, it, expect } from 'vitest';
import { campaignMissions } from '../../src/sim/missions';
import { buildCodex, nextTutorialPrompt, tutorialText } from '../../src/sim/campaign';
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
