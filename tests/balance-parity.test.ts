import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BALANCE } from '../data/balance';
import { CONFIG } from '../src/sim/config';

const here = fileURLToPath(import.meta.url);
const root = join(here, '..', '..');
const configPath = join(root, 'src', 'sim', 'config.ts');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'test-results') continue;
      out.push(...sourceFiles(full));
    } else if (/\.ts$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Match a genuine single-`=` assignment to `key` while excluding the first `=`
 *  of `==`/`===`/`!==` (negative lookahead after the `=`), so strict-equality
 *  reads and plain references never false-positive the re-declaration guard. */
function redeclarationRe(key: string): RegExp {
  return new RegExp(`\\b${key}\\s*=(?!=)`);
}

describe('balance catalog - behavior parity (DATA-02)', () => {
  const srcFiles = sourceFiles(join(root, 'src'));

  it('CONFIG key set matches the BALANCE catalog', () => {
    expect(Object.keys(CONFIG).sort()).toEqual(Object.keys(BALANCE).sort());
  });

  it('CONFIG values are identical to the BALANCE catalog', () => {
    expect({ ...CONFIG } as Record<string, unknown>).toEqual({ ...BALANCE } as Record<string, unknown>);
  });

  it('every BALANCE key is consumed as CONFIG.<key> outside the re-export', () => {
    for (const key of Object.keys(BALANCE)) {
      const consumed = srcFiles.some(
        (file) => file !== configPath && readFileSync(file, 'utf8').includes(`CONFIG.${key}`),
      );
      expect(consumed, `BALANCE key '${key}' has no CONFIG.${key} consumer in src/`).toBe(true);
    }
  });

  it('no src/ file outside the re-export re-declares or re-assigns a balance key', () => {
    for (const key of Object.keys(BALANCE)) {
      const re = redeclarationRe(key);
      const offenders = srcFiles.filter(
        (file) => file !== configPath && re.test(readFileSync(file, 'utf8')),
      );
      expect(offenders, `BALANCE key '${key}' is re-declared in: ${offenders.join(', ')}`).toEqual([]);
    }
  });

  it('redeclaration regex catches assignments but not ===, !==, or read references', () => {
    for (const key of Object.keys(BALANCE)) {
      const re = redeclarationRe(key);
      expect(re.test(`${key} = 20`), `${key} assignment should be flagged`).toBe(true);
      expect(re.test(`CONFIG.${key} = 20`), `${key} re-assignment should be flagged`).toBe(true);
      expect(re.test(`${key} === 20`), `${key} strict equality should not be flagged`).toBe(false);
      expect(re.test(`${key} !== 20`), `${key} strict inequality should not be flagged`).toBe(false);
      expect(re.test(`${key} == 20`), `${key} loose equality should not be flagged`).toBe(false);
      expect(re.test(`const x = ${key}`), `${key} read reference should not be flagged`).toBe(false);
    }
  });

  it('config.ts re-exports the catalog via the { ...BALANCE } spread', () => {
    const src = readFileSync(configPath, 'utf8');
    expect(src).toMatch(/CONFIG\s*=\s*\{\s*\.\.\.BALANCE\s*\}/);
  });
});
