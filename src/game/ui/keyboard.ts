/**
 * Central key router (Phase 20, UI-RED-07, SPEC §3).
 *
 * Additive keyboard map: A cycles advisors, ←/→ switch panels (drawer tab,
 * else inspector card), Escape closes surfaces by precedence, B toggles the
 * build panel, 1-5 toggle overlays. Existing keys stay wired (back-compat):
 * W/F/R/C/D overlay toggles + X clears.
 *
 * Precedence guard (single router): drawer > inspector > build mode > pause.
 * A key is consumed by the highest open surface; when drawer or inspector is
 * open, ←/→/Escape/A/B/1-5 never leak to build/pause/overlays.
 *
 * handleKey(key, ctx) is PURE: it returns the next state (a shallow copy of
 * ctx with only the affected fields changed). The scenes apply the diff.
 */
import { ADVISOR_TAB_ORDER } from '../advisors';

export const KEY_MAP: Record<string, string> = {
  A: 'cycle-advisor',
  ArrowLeft: 'prev-panel',
  ArrowRight: 'next-panel',
  Escape: 'close-surface',
  B: 'toggle-build-panel',
  '1': 'toggle-overlay-water',
  '2': 'toggle-overlay-food',
  '3': 'toggle-overlay-risks',
  '4': 'toggle-overlay-coverage',
  '5': 'toggle-overlay-desirability',
  // Existing overlay keys stay wired (back-compat): W/F/R/C/D + X.
  W: 'toggle-overlay-water',
  F: 'toggle-overlay-food',
  R: 'toggle-overlay-risks',
  C: 'toggle-overlay-coverage',
  D: 'toggle-overlay-desirability',
  X: 'clear-overlay',
};

export const OVERLAY_ORDER: readonly string[] = ['water', 'food', 'risks', 'coverage', 'desirability'];

export interface RouterCtx {
  drawer: { open: boolean; activeTab: string };
  inspector: { open: boolean; card: string | null };
  buildMode: { active: boolean };
  pause: { paused: boolean };
  overlay?: Record<string, boolean>;
}

export interface RouterResult {
  drawer: { open: boolean; activeTab: string };
  inspector: { open: boolean; card: string | null };
  buildMode: { active: boolean };
  pause: { paused: boolean };
  /** Overlay toggle deltas; a key is only present when this press touched it. */
  overlay: Record<string, boolean>;
}

/** The inspector card cycle list (a building card and a walker card). */
const INSPECTOR_CARDS: readonly string[] = ['building', 'walker'];

export class KeyRouter {
  /** Resolve the next state for a key press against the current ctx. */
  handleKey(key: string, ctx: RouterCtx): RouterResult {
    const r: RouterResult = {
      drawer: { open: ctx.drawer.open, activeTab: ctx.drawer.activeTab },
      inspector: { open: ctx.inspector.open, card: ctx.inspector.card ?? null },
      buildMode: { active: ctx.buildMode.active },
      pause: { paused: ctx.pause.paused },
      overlay: { ...(ctx.overlay ?? {}) },
    };
    const action = KEY_MAP[key];
    if (!action) return r; // unknown keys are ignored (no crash, no leak)

    switch (action) {
      case 'cycle-advisor': {
        if (!r.drawer.open) {
          r.drawer.open = true; // opens the drawer when closed
        } else {
          r.drawer.activeTab = stepTab(r.drawer.activeTab, 1);
        }
        break;
      }
      case 'prev-panel': {
        if (r.drawer.open) r.drawer.activeTab = stepTab(r.drawer.activeTab, -1);
        else if (r.inspector.open) r.inspector.card = stepCard(r.inspector.card, -1);
        break;
      }
      case 'next-panel': {
        if (r.drawer.open) r.drawer.activeTab = stepTab(r.drawer.activeTab, 1);
        else if (r.inspector.open) r.inspector.card = stepCard(r.inspector.card, 1);
        break;
      }
      case 'close-surface': {
        if (r.drawer.open) r.drawer.open = false;
        else if (r.inspector.open) r.inspector.open = false;
        else if (r.buildMode.active) r.buildMode.active = false;
        else r.pause.paused = !r.pause.paused; // existing ESC fall-through
        break;
      }
      case 'toggle-build-panel': {
        // Consumed while drawer/inspector open.
        if (!r.drawer.open && !r.inspector.open) r.buildMode.active = !r.buildMode.active;
        break;
      }
      case 'clear-overlay': {
        if (!r.drawer.open && !r.inspector.open) {
          r.overlay = { water: false, food: false, risks: false, coverage: false, desirability: false };
        }
        break;
      }
      default: {
        // toggle-overlay-* : {water|food|risks|coverage|desirability}
        const m = /^toggle-overlay-(\w+)$/.exec(action);
        if (m && OVERLAY_ORDER.includes(m[1]) && !r.drawer.open && !r.inspector.open) {
          const id = m[1];
          const overlay = r.overlay ?? {};
          overlay[id] = overlay[id] === true ? false : true;
          r.overlay = overlay;
        }
        break;
      }
    }
    return r;
  }
}

/** Next/prev advisor tab in ADVISOR_TAB_ORDER (wraps at both ends). */
function stepTab(current: string, dir: number): string {
  const i = ADVISOR_TAB_ORDER.indexOf(current);
  if (i < 0) return ADVISOR_TAB_ORDER[0] ?? current;
  return ADVISOR_TAB_ORDER[(i + dir + ADVISOR_TAB_ORDER.length) % ADVISOR_TAB_ORDER.length];
}

/** Next/prev inspector card (building ↔ walker, wraps). */
function stepCard(current: string | null, dir: number): string {
  const i = INSPECTOR_CARDS.indexOf(current ?? '');
  if (i < 0) return INSPECTOR_CARDS[0];
  return INSPECTOR_CARDS[(i + dir + INSPECTOR_CARDS.length) % INSPECTOR_CARDS.length];
}
