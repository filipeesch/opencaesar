import { describe, it, expect } from 'vitest';
// Phase 20 Wave 4: sidebar inspector card contract (UI-RED-05).
// The card is built by the pure builder (ui/inspector.ts) and mounted inside
// the sidebar inspector host by HUDScene — data read-only from
// getInspector/getWalkerInternals, never fabricated.
import { buildInspectorCard, navState } from '../../src/game/ui/inspector';
import type { InspectorRow } from '../../src/game/ui/inspector';

const ROWS: InspectorRow[] = [
  { label: 'Level', value: '4 — Grand Insulae' },
  { label: 'Population', value: '120' },
  { label: 'Water', value: 'Yes' },
];

describe('inspector card builder (UI-RED-05)', () => {
  it('renders the title and every row label/value from the data', () => {
    const card = buildInspectorCard({
      title: 'House', rows: ROWS, position: '1/3', canPrev: false, canNext: true,
    });
    expect(card.title.textContent).toBe('House');
    const rowNodes = card.body.children.filter((c) => c.tag === 'div' && c.className.includes('row'));
    expect(rowNodes.length).toBe(3);
    rowNodes.forEach((row, i) => {
      const spans = row.children.filter((c) => c.tag === 'span');
      const b = row.children.find((c) => c.tag === 'b');
      expect(spans[0].textContent).toBe(ROWS[i].label);
      expect(b?.textContent).toBe(ROWS[i].value);
    });
  });

  it('close × carries the popup-close testid and an aria-label', () => {
    const card = buildInspectorCard({
      title: 'House', rows: ROWS, position: '—', canPrev: false, canNext: false,
    });
    expect(card.close.dataset.testid).toBe('popup-close');
    expect(card.close.dataset['aria-label']).toBe('Close');
    expect(card.close.textContent).toBe('×');
  });

  it('card root carries the legacy building-popup testid + sidebar card class', () => {
    const card = buildInspectorCard({
      title: 'House', rows: ROWS, position: '—', canPrev: false, canNext: false,
    });
    expect(card.root.dataset.testid).toBe('building-popup');
    expect(card.root.className).toContain('hud-popup');
    expect(card.root.className).toContain('sidebar-inspector-card');
  });

  it('nav buttons reflect canPrev/canNext (disabled attribute)', () => {
    const blocked = buildInspectorCard({
      title: 'House', rows: ROWS, position: '—', canPrev: false, canNext: false,
    });
    expect(blocked.prev.dataset.disabled).toBeDefined();
    expect(blocked.next.dataset.disabled).toBeDefined();

    const middle = buildInspectorCard({
      title: 'House', rows: ROWS, position: '2/3', canPrev: true, canNext: true,
    });
    expect(middle.prev.dataset.disabled).toBeUndefined();
    expect(middle.next.dataset.disabled).toBeUndefined();

    const first = buildInspectorCard({
      title: 'House', rows: ROWS, position: '1/2', canPrev: false, canNext: true,
    });
    expect(first.prev.dataset.disabled).toBeDefined();
    expect(first.next.dataset.disabled).toBeUndefined();
  });

  it('nav label text comes from the data position (— when no cycling list)', () => {
    const card = buildInspectorCard({
      title: 'House', rows: ROWS, position: '3/3', canPrev: true, canNext: false,
    });
    expect(card.navLabel.textContent).toBe('3/3');
    const solo = buildInspectorCard({
      title: 'House', rows: ROWS, position: '—', canPrev: false, canNext: false,
    });
    expect(solo.navLabel.textContent).toBe('—');
  });

  it('no innerHTML — every string crosses via textContent (UI-RED-08)', () => {
    // Sim-derived values must never be interpolated into HTML; the builder
    // only ever assigns textContent on created nodes. Verify the built tree
    // holds the raw strings verbatim.
    const hostile = buildInspectorCard({
      title: '<img src=x onerror=alert(1)>', rows: [{ label: 'A', value: '<b>raw</b>' }],
      position: '1/1', canPrev: false, canNext: false,
    });
    expect(cardTitleText(hostile.root)).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('inspector nav state (UI-04 cycling rules)', () => {
  it('position is index+1/length for a same-kind list', () => {
    expect(navState(5, 0).position).toBe('1/5');
    expect(navState(5, 4).position).toBe('5/5');
  });

  it('no list (or unknown index) yields — and no cycling', () => {
    const empty = navState(0, -1);
    expect(empty.position).toBe('—');
    expect(empty.canPrev).toBe(false);
    expect(empty.canNext).toBe(false);
    // 'other'-kind buildings have an empty list with index -1.
    const other = navState(0, -1);
    expect(other).toEqual(empty);
  });

  it('a single-entity list disables BOTH buttons', () => {
    const s = navState(1, 0);
    expect(s.position).toBe('1/1');
    expect(s.canPrev).toBe(false);
    expect(s.canNext).toBe(false);
  });

  it('first entry: prev disabled, next enabled', () => {
    const s = navState(3, 0);
    expect(s.position).toBe('1/3');
    expect(s.canPrev).toBe(false);
    expect(s.canNext).toBe(true);
  });

  it('middle entries: both enabled', () => {
    const s = navState(3, 1);
    expect(s.position).toBe('2/3');
    expect(s.canPrev).toBe(true);
    expect(s.canNext).toBe(true);
  });

  it('last entry: next disabled', () => {
    const s = navState(3, 2);
    expect(s.position).toBe('3/3');
    expect(s.canPrev).toBe(true);
    expect(s.canNext).toBe(false);
  });
});

function cardTitleText(root: unknown): string {
  const node = root as { children: { className: string; children: { className: string; textContent: string }[] }[] };
  const header = node.children.find((c) => c.className === 'hud-popup-header');
  return header?.children.find((c) => c.className === 'hud-popup-title')?.textContent ?? '';
}
