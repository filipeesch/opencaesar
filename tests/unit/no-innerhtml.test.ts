import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
// Phase 20 Wave 0 RED scaffold: UI-RED-08 audit.
// FAILS TODAY: src/game/** still has innerHTML sites (5 in HUDScene.ts,
// 3 in HomeScene.ts). Wave 1+ replaces them with createElement/textContent
// builders; this test is the enforcement gate.

const FORBIDDEN = ['innerHTML', 'outerHTML', 'insertAdjacentHTML'];
const SRC = join(process.cwd(), 'src/game');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      out.push(...walk(p));
    } else if (/\.(ts|tsx|js|html)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

function audit(): { file: string; line: number; text: string }[] {
  const hits: { file: string; line: number; text: string }[] = [];
  for (const file of [...walk(SRC), join(process.cwd(), 'index.html')]) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, i) => {
      for (const needle of FORBIDDEN) {
        if (text.includes(needle)) {
          hits.push({ file: relative(process.cwd(), file), line: i + 1, text: text.trim() });
        }
      }
    });
  }
  return hits;
}

describe('UI-RED-08: no innerHTML/outerHTML/insertAdjacentHTML in src/game/** + index.html', () => {
  it('all DOM must be composed via createElement + textContent builders', () => {
    const hits = audit();
    // RED today: HUDScene.ts (5 sites) + HomeScene.ts (3 sites) must be refactored.
    expect(hits, `innerHTML sites found:\n${hits.map((h) => `  ${h.file}:${h.line} ${h.text}`).join('\n')}`).toEqual([]);
  });
});
