/**
 * Sidebar inspector card (Phase 20 Wave 4, UI-RED-05).
 *
 * Pure builder: HUDScene feeds it the resolved getInspector/getWalkerInternals
 * rows plus the same-kind cycling state, and it returns the card tree with the
 * close × and Next/Prev nav. The card mounts INSIDE the sidebar inspector host
 * (sidebar.inspectorHost) — never as the Phase-18 fixed centered popup.
 *
 * The root keeps the legacy `building-popup` testid (management-ui.spec +
 * inspect.spec drive it) and the Phase-18 `.hud-popup` classes so the existing
 * CSS tokens apply; the `.sidebar-inspector-card` class + host override switch
 * it to static in-flow layout (see index.html).
 *
 * No string interpolation into HTML (UI-RED-08): every label/value crosses
 * via textContent/createElement only.
 */
import { el, type UiNode } from './dom';

/** One label/value row rendered inside the card body. */
export interface InspectorRow {
  label: string;
  value: string;
  /** Optional tone class ('ok' | 'bad') applied to the value. */
  tone?: string;
}

export interface InspectorCardData {
  title: string;
  rows: InspectorRow[];
  /** Nav label '1/2', or '—' when no cycling list applies. */
  position: string;
  canPrev: boolean;
  canNext: boolean;
}

export interface InspectorCardDom {
  root: UiNode; // .hud-popup.sidebar-inspector-card [data-testid="building-popup"]
  title: UiNode; // .hud-popup-title
  close: UiNode; // [data-testid="popup-close"] ×
  body: UiNode; // .hud-popup-body (the row list)
  prev: UiNode; // [data-testid="inspector-prev"] ◀
  next: UiNode; // [data-testid="inspector-next"] ▶
  navLabel: UiNode; // [data-testid="inspector-nav-label"]
}

/**
 * Same-kind cycling state for the card nav (UI-04). Pure — the unit tests
 * lock the boundary rules:
 *  - position is `index+1/length` while a same-kind list is active, '—' when
 *    no list (empty or 'other'-kind building).
 *  - prev is only reachable from the 2nd entry onward (2+ list, index > 0).
 *  - next is only reachable before the last entry (2+ list, index < last).
 *  - a single-entity list (or no list) disables BOTH buttons.
 */
export function navState(
  listLength: number,
  index: number,
): { position: string; canPrev: boolean; canNext: boolean } {
  const position = listLength === 0 || index < 0 ? '—' : `${index + 1}/${listLength}`;
  const canPrev = listLength >= 2 && index > 0;
  const canNext = listLength >= 2 && index >= 0 && index < listLength - 1;
  return { position, canPrev, canNext };
}

/** Build the inspector card tree (header + body rows + close × + Next/Prev). */
export function buildInspectorCard(data: InspectorCardData): InspectorCardDom {
  const title = el('span', { className: 'hud-popup-title', text: data.title });
  const close = el('button', {
    className: 'hud-popup-close', testid: 'popup-close',
    'aria-label': 'Close', text: '×',
  });
  const header = el('div', { className: 'hud-popup-header' }, title, close);

  const body = el('div', { className: 'hud-popup-body' },
    ...data.rows.map((r) =>
      el('div', { className: 'row' },
        el('span', { text: r.label }),
        el('b', { className: r.tone, text: r.value }),
      )),
  );

  const prev = el('button', {
    className: 'inspector-nav-btn', testid: 'inspector-prev',
    'aria-label': 'Previous', text: '◀',
  });
  if (!data.canPrev) prev.setAttribute('disabled', '');
  const navLabel = el('span', {
    className: 'inspector-nav-label', testid: 'inspector-nav-label', text: data.position,
  });
  const next = el('button', {
    className: 'inspector-nav-btn', testid: 'inspector-next',
    'aria-label': 'Next', text: '▶',
  });
  if (!data.canNext) next.setAttribute('disabled', '');
  const nav = el('div', { className: 'inspector-nav' }, prev, navLabel, next);

  const root = el('div', {
    className: 'hud-popup sidebar-inspector-card', testid: 'building-popup',
  }, header, body, nav);

  return { root, title, close, body, prev, next, navLabel };
}
