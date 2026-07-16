#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const source = 'src/assets/source/logo/app-logo-1024.png';
const foregroundOutput = 'assets/adaptive-foreground-v1.png';
const monochromeOutput = 'assets/adaptive-monochrome-v1.png';

async function create(size, output, artworkSize) {
  const artwork = await sharp(source)
    .resize(artworkSize, artworkSize, { fit: 'contain' })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 42, g: 111, b: 151, alpha: 1 },
    },
  })
    .composite([{ input: artwork, gravity: 'center' }])
    .png()
    .toFile(output);
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

async function createMonochrome(size, output, artworkSize) {
  const { data, info } = await sharp(source)
    .resize(artworkSize, artworkSize, { fit: 'contain' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mask = Buffer.alloc(info.width * info.height * 4, 255);

  for (let sourceOffset = 0, maskOffset = 0; sourceOffset < data.length; sourceOffset += 3, maskOffset += 4) {
    const red = data[sourceOffset];
    const green = data[sourceOffset + 1];
    const blue = data[sourceOffset + 2];
    const luminance = (54 * red + 183 * green + 19 * blue) / 256;
    const darkInk = clampByte((190 - luminance) * 4);
    const warmInk = clampByte((red - Math.max(green, blue) - 10) * 5);
    const alpha = Math.max(darkInk, warmInk);

    mask[maskOffset + 3] = alpha < 16 ? 0 : alpha;
  }

  const artwork = await sharp(mask, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .composite([{ input: artwork, gravity: 'center' }])
    .png()
    .toFile(output);
}

async function validateMonochrome() {
  const [foreground, monochrome] = await Promise.all([
    readFile(foregroundOutput),
    readFile(monochromeOutput),
  ]);
  if (foreground.equals(monochrome)) {
    throw new Error('The adaptive monochrome icon must not equal the full-color foreground icon.');
  }

  const { data, info } = await sharp(monochromeOutput)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let transparentPixels = 0;
  let visiblePixels = 0;

  for (let offset = 0; offset < data.length; offset += 4) {
    const alpha = data[offset + 3];
    if (alpha === 0) {
      transparentPixels += 1;
      continue;
    }

    visiblePixels += 1;
    if (data[offset] !== 255 || data[offset + 1] !== 255 || data[offset + 2] !== 255) {
      throw new Error('The adaptive monochrome icon contains full-color pixels.');
    }
  }

  const pixelCount = info.width * info.height;
  if (visiblePixels === 0 || transparentPixels === 0 || visiblePixels / pixelCount > 0.55) {
    throw new Error('The adaptive monochrome icon must be a visible glyph on a transparent background.');
  }
}

if (!process.argv.includes('--check')) {
  await create(1024, 'assets/icon-v1.png', 760);
  await create(1080, foregroundOutput, 780);
  await createMonochrome(1080, monochromeOutput, 780);
}

await validateMonochrome();
console.log(process.argv.includes('--check') ? 'Validated v1 icon assets' : 'Generated and validated padded v1 icon assets');
