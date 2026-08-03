/**
 * Military-absence gate scanner (game.md §1, §51; design D9).
 *
 * Standalone Node scanner over src/ and data/ only. Exits non-zero when a
 * forbidden military token appears on any line not carrying the --NO-MILITARY--
 * label. Used both as the `npm run check:military` CLI gate in CI and, via its
 * exports, as the single source of truth for the vitest gate
 * (tests/military-absence.test.ts). The token list deliberately lives here so
 * the two gate layers can never diverge.
 *
 * Usage: node scripts/check-military.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Forbidden military tokens (D9). Shared with the vitest gate. */
export const FORBIDDEN_TOKENS = [
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

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function collectSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'test-results') continue;
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx|js|cjs|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Scan src/, data/ (plus any extra roots for the probe test) for forbidden
 * military tokens. Returns an array of offender descriptors
 * `relativepath:lineno (token)` for every line whose case-insensitive
 * word-boundary regex matches a token and which does NOT include the
 * --NO-MILITARY-- labeled-doc allowance.
 *
 * `extraPaths` lets the vitest gate point the scanner at a temporary probe
 * directory OUTSIDE src/ (WR-03), so the negative test never races the
 * balance-parity src file enumeration.
 */
export function scanMilitarySources(extraPaths = []) {
  const rootDirs = [join(root, 'src'), join(root, 'data'), ...extraPaths];
  const sources = rootDirs.flatMap((dir) => collectSourceFiles(dir));
  const offenders = [];
  for (const file of sources) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    for (const token of FORBIDDEN_TOKENS) {
      const re = new RegExp(`\\b${token}\\b`, 'i');
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i]) && !lines[i].includes('--NO-MILITARY--')) {
          offenders.push(`${relative(root, file)}:${i + 1} (${token})`);
        }
      }
    }
  }
  return offenders;
}

function main() {
  const offenders = scanMilitarySources();
  if (offenders.length > 0) {
    console.error(`[check-military] ${offenders.length} forbidden military token(s) in src/ or data/:`);
    for (const offender of offenders) console.error(`  ${offender}`);
    process.exit(1);
  }
  console.log('[check-military] clean: no forbidden military tokens in src/ or data/ (validated catalogs, deterministic sim core).');
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
