import { describe, it, expect } from 'vitest';
// Phase 20 Wave 0 RED scaffold: keyboard router contract (UI-RED-07).
// Imports the target module Wave 3 implements. Fails today: module absent.
import { KEY_MAP, KeyRouter } from '../../src/game/ui/keyboard';

/**
 * Precedence guard locked from SPEC §3:
 *   drawer > inspector > build mode > pause.
 * A key is consumed by the highest open surface; when drawer or inspector is
 * open, ←/→/Escape/A never leak to build/pause.
 */
function ctx(open: { drawer?: boolean; inspector?: boolean; buildMode?: boolean; paused?: boolean } = {}) {
  return {
    drawer: { open: open.drawer ?? false, activeTab: 'ratings' },
    inspector: { open: open.inspector ?? false, card: open.inspector ? 'building' : null },
    buildMode: { active: open.buildMode ?? false },
    pause: { paused: open.paused ?? false },
  };
}

describe('keyboard router (precedence + key map)', () => {
  it('KEY_MAP locks A / ←→ / Escape / B / 1-5 plus back-compat keys', () => {
    expect(KEY_MAP.A).toBe('cycle-advisor');
    expect(KEY_MAP['ArrowLeft']).toBe('prev-panel');
    expect(KEY_MAP['ArrowRight']).toBe('next-panel');
    expect(KEY_MAP.Escape).toBe('close-surface');
    expect(KEY_MAP.B).toBe('toggle-build-panel');
    expect(KEY_MAP['1']).toBe('toggle-overlay-water');
    expect(KEY_MAP['2']).toBe('toggle-overlay-food');
    expect(KEY_MAP['3']).toBe('toggle-overlay-risks');
    expect(KEY_MAP['4']).toBe('toggle-overlay-coverage');
    expect(KEY_MAP['5']).toBe('toggle-overlay-desirability');
    // Existing keys stay wired (back-compat): W/F/R/C/D/X.
    expect(KEY_MAP.W).toBe('toggle-overlay-water');
    expect(KEY_MAP.F).toBe('toggle-overlay-food');
    expect(KEY_MAP.R).toBe('toggle-overlay-risks');
    expect(KEY_MAP.C).toBe('toggle-overlay-coverage');
    expect(KEY_MAP.D).toBe('toggle-overlay-desirability');
    expect(KEY_MAP.X).toBe('clear-overlay');
  });

  it('A cycles advisors — opens drawer when closed, advances tab when open', () => {
    const r = new KeyRouter();
    const closed = ctx();
    expect(r.handleKey('A', closed).drawer.open).toBe(true);
    const opened = ctx({ drawer: true });
    const after = r.handleKey('A', opened);
    expect(after.drawer.open).toBe(true);
    expect(after.drawer.activeTab).not.toBe(opened.drawer.activeTab);
  });

  it('←/→ switch drawer tabs when the drawer is open', () => {
    const r = new KeyRouter();
    const open = ctx({ drawer: true });
    const prev = r.handleKey('ArrowLeft', open);
    expect(prev.drawer.activeTab).not.toBe(open.drawer.activeTab);
    const next = r.handleKey('ArrowRight', open);
    expect(next.drawer.activeTab).not.toBe(open.drawer.activeTab);
  });

  it('←/→ switch inspector cards when only the inspector is open', () => {
    const r = new KeyRouter();
    const open = ctx({ inspector: true });
    const prev = r.handleKey('ArrowLeft', open);
    expect(prev.inspector.card).not.toBe(open.inspector.card);
    const next = r.handleKey('ArrowRight', open);
    expect(next.inspector.card).not.toBe(open.inspector.card);
  });

  it('←/→ never leak to build/pause while drawer or inspector is open (precedence)', () => {
    const r = new KeyRouter();
    const open = ctx({ drawer: true, buildMode: true, paused: true });
    const prev = r.handleKey('ArrowLeft', open);
    expect(prev.buildMode.active).toBe(true); // build unchanged
    expect(prev.pause.paused).toBe(true); // pause unchanged
  });

  it('Escape closes drawer first, then inspector, then build, then pause', () => {
    const r = new KeyRouter();
    // Drawer open: Escape closes drawer, build/pause untouched.
    const drawerOpen = ctx({ drawer: true, buildMode: true });
    const s1 = r.handleKey('Escape', drawerOpen);
    expect(s1.drawer.open).toBe(false);
    expect(s1.buildMode.active).toBe(true);
    // Drawer closed, inspector open: Escape closes inspector.
    const inspOpen = ctx({ inspector: true, buildMode: true });
    const s2 = r.handleKey('Escape', inspOpen);
    expect(s2.inspector.open).toBe(false);
    expect(s2.buildMode.active).toBe(true);
    // Only build mode active: Escape cancels build.
    const buildOnly = ctx({ buildMode: true });
    const s3 = r.handleKey('Escape', buildOnly);
    expect(s3.buildMode.active).toBe(false);
    // Nothing open: Escape falls through to pause toggle (existing ESC behavior).
    const idle = ctx({ paused: false });
    const s4 = r.handleKey('Escape', idle);
    expect(s4.pause.paused).toBe(true);
  });

  it('B toggles build panel — never while drawer/inspector open', () => {
    const r = new KeyRouter();
    const open = ctx({ drawer: true, buildMode: false });
    const s = r.handleKey('B', open);
    expect(s.buildMode.active).toBe(false); // consumed by drawer
    const idle = ctx();
    const t = r.handleKey('B', idle);
    expect(t.buildMode.active).toBe(true);
  });

  it('1-5 toggle overlays — consumed by drawer/inspector when open', () => {
    const r = new KeyRouter();
    const open = ctx({ inspector: true });
    const s = r.handleKey('1', open);
    expect(s.overlay.water).toBeUndefined(); // not toggled while inspector open
    const idle = ctx();
    const t = r.handleKey('1', idle);
    expect(t.overlay.water).toBe(true);
  });

  it('unknown keys are ignored (no crash, no leak)', () => {
    const r = new KeyRouter();
    const s = r.handleKey('Q', ctx());
    expect(s).toBeDefined();
  });
});
