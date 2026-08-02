/**
 * Bake the procedural placeholder art into public/assets/*.png.
 *
 * Starts the Vite dev server, opens the game with `?artexport` (which makes
 * BootScene generate every manifest sheet and expose it as PNG data URLs on
 * window.__artExport), then writes each sheet to public/assets/<key>.png.
 *
 * After running this, BootScene's manifest loader finds the real files and the
 * game renders from them; delete a file to fall back to the procedural
 * placeholder for that sheet.
 *
 * Usage: node scripts/export-art.mjs
 */

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = 5177;
const assetsDir = join(root, 'public', 'assets');

const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
});
vite.stdout.on('data', (d) => process.stdout.write(`[vite] ${d}`));

try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite did not start in time')), 15000);
    vite.stdout.on('data', (d) => {
      if (String(d).includes('ready in')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://localhost:${port}/?artexport=1`, { waitUntil: 'load' });
  const exported = await page.waitForFunction(() => window.__artExport).then((h) => h.jsonValue());

  await mkdir(assetsDir, { recursive: true });
  const written = [];
  for (const [key, dataUrl] of Object.entries(exported)) {
    const m = /^data:image\/png;base64,(.*)$/.exec(dataUrl);
    if (!m) {
      console.warn(`[artexport] skipping ${key}: unexpected data URL`);
      continue;
    }
    const file = join(assetsDir, `${key}.png`);
    await writeFile(file, Buffer.from(m[1], 'base64'));
    written.push(file);
  }

  await browser.close();
  console.log(`[artexport] wrote ${written.length} sheet(s):`);
  for (const f of written) console.log(`  ${f}`);
  if (written.length === 0) process.exit(1);
} finally {
  vite.kill();
}
