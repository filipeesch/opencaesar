#!/usr/bin/env node

/**
 * resize-buildings.mjs — Generate multi-resolution sprite sheets from original assets.
 *
 * Key principle: "no final do asset, a primeira linha de pixel do fundo, deveria ter
 * (pelo menos) um pixel sem ser transparente, ali começa o asset, depois o alinhamento
 * seria trivial"
 *
 * Strategy:
 * 1. Find bounding box of non-transparent pixels
 * 2. Find the last row with at least 5 solid pixels
 * 3. Crop to that row (ensuring bottom row is solid)
 * 4. Resize WITHOUT padding (fit: 'fill', no background)
 * 5. Renderer uses origin(0.5, 1.0) for automatic alignment
 *
 * Usage: node scripts/resize-buildings.mjs
 */

import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BUILDING_ASSETS = /** @type {const} */ [
  { original: 'granary.png', type: 'granary' },
  { original: 'wheat_farm.png', type: 'farm' },
];

const WIDTHS = [30, 60, 90, 120, 150];

const outDir = resolve('public/assets/buildings');

/**
 * Crop asset to bounding box of non-transparent pixels, ensuring the last
 * row has at least 5 solid (non-transparent) pixels.
 */
async function cropWithSolidLastRow(buf) {
  const meta = await sharp(buf).metadata();
  const { width, height } = meta;

  const raw = await sharp(buf).raw().toBuffer();
  const stride = width * 4;

  // Find bounding box of non-transparent pixels
  let top = height - 1, bottom = 0;
  let left = width - 1, right = 0;

  for (let y = 0; y < height; y++) {
    let rowHasPixels = false;
    let rowFirstX = -1, rowLastX = -1;

    for (let x = 0; x < width; x++) {
      const alpha = raw[y * stride + x * 4 + 3];
      if (alpha > 0) {
        rowHasPixels = true;
        if (rowFirstX === -1) rowFirstX = x;
        rowLastX = x;
      }
    }

    if (rowHasPixels) {
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      if (rowFirstX < left) left = rowFirstX;
      if (rowLastX > right) right = rowLastX;
    }
  }

  const cropWidth = right - left + 1;

  // Find the last row with at least 5 solid pixels within the bounding box
  let lastSolidRow = bottom;

  for (let y = bottom; y >= top; y--) {
    let rowCount = 0;
    for (let x = left; x <= right; x++) {
      if (raw[y * stride + x * 4 + 3] > 0) {
        rowCount++;
      }
    }
    if (rowCount >= 5) {
      lastSolidRow = y;
      break;
    }
  }

  // Also find the top row with at least 5 solid pixels (avoid transparent artifacts)
  let firstSolidRow = top;
  for (let y = top; y <= bottom; y++) {
    let rowCount = 0;
    for (let x = left; x <= right; x++) {
      if (raw[y * stride + x * 4 + 3] > 0) {
        rowCount++;
      }
    }
    if (rowCount >= 5) {
      firstSolidRow = y;
      break;
    }
  }

  // Count pixels in lastSolidRow
  let lastRowCount = 0;
  for (let x = left; x <= right; x++) {
    if (raw[lastSolidRow * stride + x * 4 + 3] > 0) {
      lastRowCount++;
    }
  }

  // Count pixels in firstSolidRow
  let firstRowCount = 0;
  for (let x = left; x <= right; x++) {
    if (raw[firstSolidRow * stride + x * 4 + 3] > 0) {
      firstRowCount++;
    }
  }

  console.error(`  [Debug] firstSolidRow=${firstSolidRow}, lastSolidRow=${lastSolidRow}`);
  console.error(`  [Debug] lastRowCount=${lastRowCount}, firstRowCount=${firstRowCount}`);

  // Crop from firstSolidRow to lastSolidRow (inclusive)
  const cropHeight = lastSolidRow - firstSolidRow + 1;

  return sharp(buf)
    .extract({
      left,
      top: firstSolidRow,
      width: cropWidth,
      height: cropHeight,
    })
    .toBuffer();
}

async function generate() {
  mkdirSync(outDir, { recursive: true });
  console.log(`Generating multi-resolution sprite sheets...\n`);

  for (const { original, type } of BUILDING_ASSETS) {
    const origPath = join('public/assets/original', original);
    if (!existsSync(origPath)) {
      console.error(`Missing original asset: ${origPath}`);
      continue;
    }

    const origBuf = readFileSync(origPath);
    const origMeta = await sharp(origBuf).metadata();
    console.log(`\nProcessing ${original} → ${type}`);
    console.log(`  Original: ${origMeta.width}×${origMeta.height}px`);

    // Crop to bounding box with solid last row
    const croppedBuf = await cropWithSolidLastRow(origBuf);
    const cropMeta = await sharp(croppedBuf).metadata();
    const aspect = cropMeta.height / cropMeta.width;
    console.log(`  Cropped: ${cropMeta.width}×${cropMeta.height}px (aspect H/W: ${aspect.toFixed(3)})`);

    // Verify bottom row
    const bottomRowBuffer = await sharp(croppedBuf)
      .extract({
        left: 0,
        top: cropMeta.height - 1,
        width: cropMeta.width,
        height: 1,
      })
      .raw()
      .toBuffer();

    let hasBottomPixel = false;
    for (let i = 3; i < bottomRowBuffer.length; i += 4) {
      if (bottomRowBuffer[i] > 0) {
        hasBottomPixel = true;
        break;
      }
    }

    console.log(`  Bottom row solid: ${hasBottomPixel}`);

    // Generate at each resolution - NO PADDING
    for (const targetW of WIDTHS) {
      const targetH = Math.round(targetW * aspect);
      const fileName = `${type}_${targetW}.png`;
      const outPath = join(outDir, fileName);

      await sharp(croppedBuf)
        .resize(targetW, targetH, {
          fit: 'fill',
          kernel: sharp.kernel.lanczos3,
        })
        .png()
        .toFile(outPath);

      console.log(`  ✓ ${fileName} (${targetW}×${targetH}px)`);
    }
  }

  console.log('\nDone!');
}

generate().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
