// Rasterize mascot SVGs and add Japanese labels to onboarding artwork.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const { rasterizeSvgFile } = require('./lib/rasterize');

const SOURCE = path.resolve(__dirname, '..', 'src', 'assets', 'source');
const MASCOT_DIR = path.join(SOURCE, 'mascot');
const ONBOARDING_DIR = path.join(SOURCE, 'illustrations', 'onboarding');
const ONBOARDING_TEXT = {
  'onboarding-01-welcome.png': [
    { text: '日本語', x: 512, y: 200, size: 110, weight: 900 },
    { text: 'あ', x: 350, y: 1300, size: 90, weight: 900 },
    { text: 'い', x: 512, y: 1300, size: 90, weight: 900 },
    { text: 'う', x: 674, y: 1300, size: 90, weight: 900 },
  ],
  'onboarding-03-workplace.png': [{ text: 'しごと', x: 512, y: 200, size: 110, weight: 900 }],
  'onboarding-04-habit.png': [{ text: '7時', x: 512, y: 200, size: 130, weight: 900 }],
};

function escapeXml(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]);
}

function labelOverlay(labels) {
  const text = labels.map(label => (
    `<text x="${label.x}" y="${label.y}" font-size="${label.size}" font-weight="${label.weight}" `
    + `text-anchor="middle" dominant-baseline="middle">${escapeXml(label.text)}</text>`
  )).join('');
  return Buffer.from(`<svg width="1024" height="1536" xmlns="http://www.w3.org/2000/svg">
    <style>text { fill: #0F172A; stroke: rgba(255,255,255,0.85); stroke-width: 3px; paint-order: stroke; font-family: "Noto Sans JP", sans-serif; }</style>
    ${text}
  </svg>`);
}

async function main() {
  const mascots = ['mascot-base.svg', 'mascot-happy.svg', 'mascot-thinking.svg', 'mascot-encourage.svg', 'mascot-celebrate.svg'];
  for (const file of mascots) {
    const output = path.join(MASCOT_DIR, file.replace(/\.svg$/, '.png'));
    await rasterizeSvgFile(path.join(MASCOT_DIR, file), output, 512);
    console.log(`mascot: ${file} -> ${path.basename(output)}`);
  }

  for (const [file, labels] of Object.entries(ONBOARDING_TEXT)) {
    const source = path.join(ONBOARDING_DIR, file);
    await fs.access(source);
    const output = path.join(ONBOARDING_DIR, file.replace(/\.png$/, '-final.png'));
    await sharp(source)
      .resize(1024, 1536, { fit: 'cover' })
      .composite([{ input: labelOverlay(labels), blend: 'over' }])
      .png()
      .toFile(output);
    console.log(`onboarding: ${file} -> ${path.basename(output)}`);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
