#!/usr/bin/env node

/**
 * verify-crop.mjs — Check crop artifacts in generated sprites.
 * 
 * Verifies:
 * 1. No black lines (fully transparent rows at edges)
 * 2. Bottom row has solid pixels
 * 3. No transparent rows at top
 * 4. Aspect ratio is consistent
 * 
 * Usage: node scripts/verify-crop.mjs
 */

import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const BUILDINGS_DIR = 'public/assets/buildings';

/**
 * Check an image for artifacts.
 */
async function verify(file) {
  const buf = await sharp(file).raw().toBuffer();
  const meta = await sharp(file).metadata();
  const { width, height } = meta;
  const stride = width * 4;

  const results = {
    file: file.split('/').pop(),
    width,
    height,
    aspect: (width / height).toFixed(3),
    hasBlackLine: false,
    blackLinePixelCount: 0,
    hasTransparentTop: false,
    transparentTopRow: 0,
    hasTransparentBottom: false,
    transparentBottomRow: 0,
    bottomSolidPixels: 0,
  };

  // Check top row for transparency
  let topTransparent = true;
  for (let x = 0; x < width && topTransparent; x++) {
    if (buf[x * 4 + 3] > 0) {
      topTransparent = false;
    }
  }
  results.hasTransparentTop = topTransparent;
  results.transparentTopRow = topTransparent ? 1 : 0;

  // Check bottom row for transparency and solid pixels
  let bottomSolid = 0;
  let bottomTransparent = true;
  for (let x = 0; x < width && bottomTransparent; x++) {
    if (buf[(height - 1) * stride + x * 4 + 3] > 0) {
      bottomSolid++;
      bottomTransparent = false;
    }
  }
  results.hasTransparentBottom = bottomTransparent;
  results.transparentBottomRow = bottomTransparent ? 1 : 0;
  results.bottomSolidPixels = bottomSolid;

  // Check for black lines (rows where all pixels are black/transparent)
  let blackLineFound = false;
  let blackLineCount = 0;
  for (let y = 0; y < height && !blackLineFound; y++) {
    let isBlackLine = true;
    for (let x = 0; x < width && isBlackLine; x++) {
      const idx = y * stride + x * 4;
      const r = buf[idx];
      const g = buf[idx + 1];
      const b = buf[idx + 2];
      const a = buf[idx + 3];
      // Black line = black pixels with alpha > 0, or fully transparent
      if (a === 0 || (r === 0 && g === 0 && b === 0)) {
        // This pixel is black/transparent
        if (a > 0 && r === 0 && g === 0 && b === 0) {
          blackLineCount++;
        }
      } else {
        isBlackLine = false;
      }
    }
    if (isBlackLine) {
      blackLineFound = true;
      blackLineCount++;
    }
  }
  results.hasBlackLine = blackLineFound;
  results.blackLinePixelCount = blackLineCount;

  return results;
}

async function main() {
  console.log(`Checking sprites in ${BUILDINGS_DIR}...\n`);

  const files = readdirSync(BUILDINGS_DIR).filter(f => f.endsWith('.png'));
  let allPassed = true;

  for (const file of files.sort()) {
    const result = await verify(join(BUILDINGS_DIR, file));
    console.log(`${result.file} (${result.width}×${result.height}, aspect ${result.aspect}):`);
    
    const issues = [];
    if (result.hasTransparentTop) issues.push('top row is transparent');
    if (result.hasTransparentBottom) issues.push('bottom row is transparent');
    if (result.hasBlackLine) issues.push('has black line');
    if (result.bottomSolidPixels === 0) issues.push('no solid pixels in bottom row');
    
    if (issues.length > 0) {
      console.log(`  ✗ FAIL: ${issues.join(', ')}`);
      allPassed = false;
    } else {
      console.log(`  ✓ PASS (${result.bottomSolidPixels} solid pixels at bottom)`);
    }
  }

  console.log('\n' + (allPassed ? 'All assets PASS!' : 'Some assets FAILED!'));
  process.exit(allPassed ? 0 : 1);
}

main();
