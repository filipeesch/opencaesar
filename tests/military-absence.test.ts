import { describe, it, expect } from 'vitest';
import { readdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { FORBIDDEN_TOKENS, scanMilitarySources } from '../scripts/check-military.mjs';

/**
 * Military-absence gate (game.md §1, §51; design D9).
 *
 * Prevents any military content from entering the simulation or data. Only
 * labeled documentation mentions (e.g. a comment containing "--NO-MILITARY--")
 * are tolerated. Tokens and the scan logic are imported from
 * scripts/check-military.mjs — the single source of truth shared with the
 * standalone `npm run check:military` CLI gate.
 */

const here = fileURLToPath(import.meta.url);
const root = join(here, '..', '..');

function countSourceFiles(dir: string): number {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'test-results') continue;
      count += countSourceFiles(full);
    } else if (/\.(ts|tsx|js|cjs|mjs)$/.test(entry.name)) {
      count += 1;
    }
  }
  return count;
}

describe('military-absence gate (D9)', () => {
  it('scans a non-empty set of src/ and data/ source files', () => {
    const scanned = countSourceFiles(join(root, 'src')) + countSourceFiles(join(root, 'data'));
    expect(scanned).toBeGreaterThan(0);
  });

  it('contains no forbidden military tokens outside labeled docs', () => {
    expect(scanMilitarySources()).toEqual([]);
  });

  it('allow --NO-MILITARY-- labeled lines and flag unlabeled token lines', () => {
    // Probe lives in an OS temp dir, NOT src/ (WR-03): balance-parity snapshots
    // src/**/*.ts during its describe block, so a transient probe under src/
    // races that enumeration and can be read after deletion (ENOENT flake).
    const probeDir = mkdtempSync(join(tmpdir(), 'military-probe-'));
    const probe = join(probeDir, '__military_probe__.ts');
    try {
      expect(FORBIDDEN_TOKENS).toEqual(expect.arrayContaining(['army', 'enemy']));
      writeFileSync(
        probe,
        'const a = 1; // army (--NO-MILITARY--)\nconst b = 2; // enemy\n',
      );
      const offenders = scanMilitarySources([probeDir]);
      expect(offenders.filter((o) => o.includes('army')).length).toBe(0);
      expect(offenders.some((o) => o.includes('enemy'))).toBe(true);
    } finally {
      rmSync(probeDir, { recursive: true, force: true });
    }
  });

  it('check-military.mjs exports match the declared .d.mts surface', async () => {
    const mod = await import('../scripts/check-military.mjs');
    expect(Object.keys(mod)).toEqual(expect.arrayContaining(['FORBIDDEN_TOKENS', 'scanMilitarySources']));
    expect(mod.FORBIDDEN_TOKENS).toBe(FORBIDDEN_TOKENS);
    expect(mod.scanMilitarySources).toBe(scanMilitarySources);
  });
});
