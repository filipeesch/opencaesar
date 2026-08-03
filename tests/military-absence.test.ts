import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Military-absence gate (game.md §1, §51; design D9).
 *
 * Prevents any military content from entering the simulation or data. Only
 * labeled documentation mentions (e.g. a comment containing "--NO-MILITARY--")
 * are tolerated. This test runs in CI and blocks merge on violation.
 */
const FORBIDDEN_TOKENS = [
  'military',
  'army',
  'legion',
  'soldier',
  'fort',
  'barracks',
  'weapon',
  'enemy',
  'invasion',
  'combat',
  'damageFromUnit',
];

const here = fileURLToPath(import.meta.url);
const root = join(here, '..', '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'test-results') continue;
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx|js|cjs|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('military-absence gate (D9)', () => {
  const files = [...sourceFiles(join(root, 'src')), ...sourceFiles(join(root, 'data'))];

  it('scans all src/ and data/ source files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('contains no forbidden military tokens outside labeled docs', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const token of FORBIDDEN_TOKENS) {
        const re = new RegExp(`\\b${token}\\b`, 'i');
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (re.test(lines[i]) && !lines[i].includes('--NO-MILITARY--')) {
            offenders.push(`${file}:${i + 1} (${token})`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
