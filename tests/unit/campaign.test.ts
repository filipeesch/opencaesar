import { describe, it, expect } from 'vitest';
import { campaignMissions } from '../../src/sim/missions';
import { buildCodex, nextTutorialPrompt, tutorialText } from '../../src/sim/campaign';

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
