// scripts/export-tier2-assets.js
// Rasterize Phase 45 Tier-2 illustration SVGs to PNGs at locked aspect ratios.
// Uses sharp (already a devDep). Output: PNGs in same dir as the SVG, name-matched.
//
// Locked sizes (per JT-TIER2-VISUAL-SPEC-v1.md):
//   - Onboarding illustrations: 320x480 (matches existing 1024/1536 = 0.667 aspect)
//   - Empty-state illustrations: 240x240
//   - Badges: 96x96 (SVGs authored at 64x64 viewBox, sharp resamples up to 96x96)
//
// Continuity lock: the 6 onboarding SVGs all inline an identical <symbol id="desk-silhouette">
// block. Sharp's libvips renderer inlines <use href> references before rasterizing,
// so the desk silhouette is rendered self-contained in each PNG.
//
// Run: node scripts/export-tier2-assets.js
//
// Idempotent — re-running overwrites the existing PNGs in-place.

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const PROJECT = path.resolve(__dirname, '..');
const SOURCE = path.join(PROJECT, 'src', 'assets', 'source');

// SVG -> PNG name pairs (source-name -> output-name) per spec.
// 6 onboarding illustrations: source name (welcome.svg) -> existing PNG name
// (onboarding-01-welcome.png). The bundler resolves only the PNG, so the output
// PNG names must match the literal require() strings in assetRequireMap.ts.
const ONBOARDING = [
  { svg: 'welcome.svg',           png: 'onboarding-01-welcome.png',          w: 320, h: 480 },
  { svg: 'welcome-final.svg',     png: 'onboarding-01-welcome-final.png',    w: 320, h: 480 },
  { svg: 'workplace.svg',         png: 'onboarding-03-workplace.png',        w: 320, h: 480 },
  { svg: 'workplace-final.svg',   png: 'onboarding-03-workplace-final.png',  w: 320, h: 480 },
  { svg: 'habit.svg',             png: 'onboarding-04-habit.png',            w: 320, h: 480 },
  { svg: 'habit-final.svg',       png: 'onboarding-04-habit-final.png',      w: 320, h: 480 },
];

const EMPTY_STATE = [
  { svg: 'empty-no-home.svg',         png: 'empty-no-home.png',         w: 240, h: 240 },
  { svg: 'empty-no-lessons.svg',      png: 'empty-no-lessons.png',      w: 240, h: 240 },
  { svg: 'empty-no-progress.svg',     png: 'empty-no-progress.png',     w: 240, h: 240 },
  { svg: 'empty-no-flashcards.svg',   png: 'empty-no-flashcards.png',   w: 240, h: 240 },
  { svg: 'empty-no-quiz.svg',         png: 'empty-no-quiz.png',         w: 240, h: 240 },
  { svg: 'empty-no-survival.svg',     png: 'empty-no-survival.png',     w: 240, h: 240 },
];

const BADGES = [
  { svg: 'badge-streak-7.svg', png: 'badge-streak-7.png', w: 96, h: 96 },
  { svg: 'badge-jlpt-n5.svg',  png: 'badge-jlpt-n5.png',  w: 96, h: 96 },
  { svg: 'badge-jlpt-n4.svg',  png: 'badge-jlpt-n4.png',  w: 96, h: 96 },
  { svg: 'badge-jlpt-n3.svg',  png: 'badge-jlpt-n3.png',  w: 96, h: 96 },
];

async function rasterize(srcDir, file) {
  const svgPath = path.join(srcDir, file.svg);
  const pngPath = path.join(srcDir, file.png);
  if (!fs.existsSync(svgPath)) {
    throw new Error(`missing SVG source: ${svgPath}`);
  }
  // Read SVG as a Buffer — some libvips versions on Windows choke on the
  // file-path form when the SVG header contains non-ASCII commentary. The
  // buffer form bypasses that path.
  const svgBuffer = fs.readFileSync(svgPath);
  await sharp(svgBuffer, { density: 384 })
    .resize(file.w, file.h, {
      fit: 'contain',
      background: { r: 244, g: 247, b: 250, alpha: 0 }, // ds.colors.background, transparent for overlays
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(pngPath);
  const size = fs.statSync(pngPath).size;
  console.log(`  ${file.svg}  ->  ${file.png}  (${file.w}x${file.h}, ${(size / 1024).toFixed(1)} KB)`);
  return { ...file, bytes: size };
}

async function main() {
  const results = [];

  console.log('Onboarding illustrations:');
  for (const f of ONBOARDING) {
    results.push(await rasterize(path.join(SOURCE, 'illustrations', 'onboarding'), f));
  }

  console.log('\nEmpty-state illustrations:');
  for (const f of EMPTY_STATE) {
    results.push(await rasterize(path.join(SOURCE, 'illustrations', 'empty-state'), f));
  }

  console.log('\nBadges:');
  for (const f of BADGES) {
    results.push(await rasterize(path.join(SOURCE, 'badges'), f));
  }

  console.log(`\ndone — ${results.length} PNGs produced.`);
}

main().catch(e => { console.error(e); process.exit(1); });
