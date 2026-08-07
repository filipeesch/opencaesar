/**
 * Advisor drawer (Phase 20, UI-RED-02/06).
 *
 * Pure builder: takes the 13 AdvisorPanels produced by the runner-backed
 * `advisorPanels(source)` composer (src/game/advisors.ts — the single data
 * seam) and returns the drawer tree plus the keyboard contract surface:
 * `open()/close()/isOpen()`, `selectAdvisor(id)/activeTab()`, and the tab
 * metadata `tabs()`. Tab labels render UPPERCASE via the `.uppercase` CSS
 * utility (UI-RED-06) — the single place the case transform lives: the DOM
 * text stays the canonical 18-UI-SPEC title (accessibility + golden cases
 * see as-authored wording, T-20-06); the `tabs()` meta label keeps the
 * UPPERCASE form for the unit contract. Panel bodies are live-rendered by
 * HUDScene under the tick-change guard; this module owns the frame.
 */
import { el, type UiNode } from './dom';
import type { AdvisorPanel } from '../advisors';

export interface AdvisorTabMeta {
  id: string;
  label: string; // UPPERCASE 18-UI-SPEC title (meta contract)
  feed: string; // runner feed the panel consumes
  panel: UiNode; // panel host element
}

export interface AdvisorDrawerDom {
  root: UiNode; // [data-testid="advisor-drawer"]
  tabHost: UiNode; // [data-testid="advisor-tabs"]
  panelHost: UiNode & { visiblePanel(): string }; // [data-testid="advisor-panels"]
  activeTabEl: UiNode; // [data-testid="advisor-active-tab"]
  tabs(): AdvisorTabMeta[];
  selectAdvisor(id: string): void;
  activeTab(): string;
  isOpen(): boolean;
  open(): void;
  close(): void;
}

export function buildAdvisorDrawer(panels: AdvisorPanel[]): AdvisorDrawerDom {
  let open = false;
  let activeId = panels[0]?.id ?? 'ratings';

  const tabHost = el('div', { className: 'advisor-tabs', testid: 'advisor-tabs' });
  const panelHost = el('div', { className: 'advisor-panels', testid: 'advisor-panels' });

  const tabs: AdvisorTabMeta[] = panels.map((panel) => {
    const label = panel.title.toUpperCase();
    // DOM text stays the canonical 18-UI-SPEC title; the .uppercase CSS
    // utility is the single place the case transform lives (UI-RED-06).
    const tab = el('button', {
      className: 'advisor-tab uppercase',
      testid: `advisor-tab-${panel.id}`,
      dataset: { advisor: panel.id },
      text: panel.title,
    });
    tab.addEventListener('click', () => selectAdvisor(panel.id));
    tabHost.appendChild(tab);

    const host = el('div', {
      className: 'advisor-panel',
      testid: `advisor-panel-${panel.id}`,
      dataset: { advisorPanel: panel.id },
    });
    host.style.display = 'none';
    panelHost.appendChild(host);

    return { id: panel.id, label, feed: 'advisorPanels', panel: host };
  });

  const activeTabEl = el('span', { className: 'advisor-active-tab uppercase', testid: 'advisor-active-tab' });
  const root = el('div', { className: 'advisor-drawer sidebar-drawer', testid: 'advisor-drawer' },
    el('div', { className: 'hud-subtitle', text: 'ADVISORS' }, activeTabEl),
    tabHost,
    panelHost,
  );
  root.style.display = 'none';

  const byId = new Map(panels.map((p) => [p.id, p]));

  /** Toggle the 'active' class without relying on classList (stub-safe). */
  function setActiveClass(node: UiNode, on: boolean): void {
    const classes = node.className.split(' ').filter(Boolean);
    const i = classes.indexOf('active');
    if (on && i < 0) classes.push('active');
    if (!on && i >= 0) classes.splice(i, 1);
    node.className = classes.join(' ');
  }

  function selectAdvisor(id: string): void {
    if (!byId.has(id)) return;
    activeId = id;
    for (const tab of tabs) {
      // Array.from keeps this working in both environments: the browser's
      // children is an HTMLCollection (no .find), the stub's is a UiNode[].
      const tabEl = Array.from(tabHost.children).find(
        (c) => (c as unknown as { dataset: Record<string, string> }).dataset.advisor === tab.id,
      );
      if (tabEl) setActiveClass(tabEl, tab.id === id);
      tab.panel.style.display = tab.id === id ? 'block' : 'none';
    }
    activeTabEl.textContent = byId.get(id)?.title ?? id;
  }

  function openDrawer(): void {
    open = true;
    root.style.display = 'block';
    if (!activeId && tabs[0]) selectAdvisor(tabs[0].id);
  }

  function closeDrawer(): void {
    open = false;
    root.style.display = 'none';
  }

  // Default active tab is the first in catalog order (ratings).
  if (tabs.length > 0) selectAdvisor(tabs[0].id);

  const panelHostWith = panelHost as unknown as UiNode & { visiblePanel: () => string };
  panelHostWith.visiblePanel = () => activeId;

  return {
    root,
    tabHost,
    panelHost: panelHostWith,
    activeTabEl,
    tabs: () => tabs,
    selectAdvisor,
    activeTab: () => activeId,
    isOpen: () => open,
    open: openDrawer,
    close: closeDrawer,
  };
}
