/**
 * Node-safe DOM builder shared by the Phase-20 ui modules.
 *
 * In the browser `el()` returns real HTMLElements, so the e2e specs can
 * assert against them. In the node-env vitest unit tests (environment: node)
 * it returns lightweight stub nodes, so the ui modules stay Phaser-free and
 * testable without a DOM shim.
 */

export interface UiNode {
  readonly tag: string;
  className: string;
  dataset: Record<string, string>;
  textContent: string;
  style: Record<string, string>;
  readonly children: UiNode[];
  parent: UiNode | null;
  appendChild(child: UiNode): void;
  append(...children: (UiNode | string)[]): void;
  replaceChildren(...children: (UiNode | string)[]): void;
  querySelector(sel: string): UiNode | null;
  querySelectorAll(sel: string): UiNode[];
  addEventListener(type: string, fn: unknown): void;
  setAttribute(key: string, value: string): void;
}

export type Child = UiNode | string | number | null | undefined;

interface AttrTarget {
  className: string;
  dataset: Record<string, string>;
  style: Record<string, string>;
  textContent: string;
  setAttribute(key: string, value: string): void;
  addEventListener(type: string, fn: unknown): void;
}

function applyAttrs(node: AttrTarget, attrs: Record<string, unknown>): void {
  for (const [key, raw] of Object.entries(attrs)) {
    if (raw == null) continue;
    if (key === 'className') {
      node.className = String(raw);
      continue;
    }
    if (key === 'testid') {
      node.dataset.testid = String(raw);
      continue;
    }
    if (key === 'dataset' && typeof raw === 'object') {
      for (const [dk, dv] of Object.entries(raw as Record<string, unknown>)) {
        node.dataset[dk] = String(dv);
      }
      continue;
    }
    if (key === 'style' && typeof raw === 'object') {
      for (const [sk, sv] of Object.entries(raw as Record<string, unknown>)) {
        node.style[sk] = String(sv);
      }
      continue;
    }
    if (key === 'text') {
      node.textContent = String(raw);
      continue;
    }
    if (key.startsWith('on') && typeof raw === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), raw);
      continue;
    }
    node.setAttribute(key, String(raw));
  }
}

function attachAll(parent: UiNode, children: Child[]): void {
  for (const c of children) {
    if (c == null) continue;
    if (typeof c === 'string' || typeof c === 'number') {
      parent.append(String(c));
    } else {
      parent.appendChild(c);
    }
  }
}

/** Lightweight DOM stub used by the node-env unit tests. */
class StubNode implements UiNode {
  readonly tag: string;
  className = '';
  dataset: Record<string, string> = {};
  textContent = '';
  style: Record<string, string> = {};
  readonly children: UiNode[] = [];
  parent: UiNode | null = null;
  private listeners: Record<string, unknown> = {};

  constructor(tag: string, attrs: Record<string, unknown> = {}, children: Child[] = []) {
    this.tag = tag;
    applyAttrs(this, attrs);
    for (const c of children) {
      if (c == null) continue;
      if (typeof c === 'string' || typeof c === 'number') {
        this.appendChild(textNode(String(c)));
      } else {
        this.appendChild(c);
      }
    }
  }

  setAttribute(key: string, value: string): void {
    this.dataset[key] = value;
  }

  addEventListener(type: string, fn: unknown): void {
    this.listeners[type] = fn;
  }

  appendChild(child: UiNode): void {
    child.parent = this;
    this.children.push(child);
  }

  append(...cs: (UiNode | string)[]): void {
    for (const c of cs) {
      if (c == null) continue;
      if (typeof c === 'string') this.appendChild(textNode(c));
      else this.appendChild(c);
    }
  }

  replaceChildren(...cs: (UiNode | string)[]): void {
    this.children.length = 0;
    for (const c of cs) {
      if (c == null) continue;
      if (typeof c === 'string') this.appendChild(textNode(c));
      else this.appendChild(c);
    }
  }

  querySelector(sel: string): UiNode | null {
    return matchOne(this, sel);
  }

  querySelectorAll(sel: string): UiNode[] {
    const out: UiNode[] = [];
    matchAll(this, sel, out);
    return out;
  }
}

function textNode(value: string): UiNode {
  const n = new StubNode('#text', {});
  n.textContent = value;
  return n;
}

function matchOne(node: UiNode, sel: string): UiNode | null {
  if (node.tag !== '#text' && matches(node, sel)) return node;
  for (const c of node.children) {
    const hit = matchOne(c, sel);
    if (hit) return hit;
  }
  return null;
}

function matchAll(node: UiNode, sel: string, out: UiNode[]): void {
  if (node.tag !== '#text' && matches(node, sel)) out.push(node);
  for (const c of node.children) matchAll(c, sel, out);
}

function matches(node: UiNode, sel: string): boolean {
  const trimmed = sel.trim();
  if (!trimmed) return true;
  const attr = /^\[data-testid="([^"]+)"\]$/.exec(trimmed) ?? /^\[data-testid=([^"]+)\]$/.exec(trimmed);
  if (attr) return node.dataset.testid === attr[1];
  const prefix = /^\[data-testid\^="([^"]+)"\]$/.exec(trimmed);
  if (prefix) return (node.dataset.testid ?? '').startsWith(prefix[1]);
  if (trimmed.startsWith('.')) {
    const cls = trimmed.slice(1);
    return node.className.split(' ').includes(cls);
  }
  return node.tag === trimmed;
}

const hasDoc = typeof document !== 'undefined' && !!document;

/**
 * Create an element (or a node-safe stub) from a tag, attrs, and children.
 *
 * Supported attrs: className, testid (→ data-testid), dataset (object merge),
 * style (object merge), text (→ textContent), on{Event} (listener), and any
 * other key via setAttribute.
 */
export function el(tag: string, attrs: Record<string, unknown> = {}, ...children: Child[]): UiNode {
  if (hasDoc) {
    const node = document.createElement(tag);
    // HTMLElement.dataset (DOMStringMap) is not assignable to
    // Record<string, string> — the builder only ever writes known string
    // values, so the cast is safe.
    applyAttrs(node as unknown as AttrTarget, attrs);
    attachAll(node as unknown as UiNode, children);
    return node as unknown as UiNode;
  }
  return new StubNode(tag, attrs, children);
}

/** Clear all children of a node (works on real and stub nodes). */
export function clear(node: UiNode): void {
  node.replaceChildren();
}

/** Set the text content of a node (works on real and stub nodes). */
export function text(node: UiNode, value: string): void {
  node.textContent = String(value);
}
