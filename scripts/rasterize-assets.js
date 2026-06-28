// scripts/rasterize-assets.js
// Rasterize mascot SVGs and composite kanji overlay on onboarding PNGs.
// Output: src/assets/source/mascot/*.png (5 expressions) and
//         src/assets/source/illustrations/onboarding/onboarding-XX-final.png (3 with kanji)

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PROJECT = path.resolve(__dirname, '..');
const SOURCE = path.join(PROJECT, 'src', 'assets', 'source');

// --- Output paths
const OUT_MASCOTS = path.join(SOURCE, 'mascot');
const OUT_ONBOARDING = path.join(SOURCE, 'illustrations', 'onboarding');

// --- Kanji overlay config (Sensei's whitelist only)
const ONBOARDING_TEXT = {
  'onboarding-01-welcome.png': [
    { text: '日本語', x: 512, y: 200, size: 110, weight: '900' },
    { text: 'あ', x: 350, y: 1300, size: 90, weight: '900' },
    { text: 'い', x: 512, y: 1300, size: 90, weight: '900' },
    { text: 'う', x: 674, y: 1300, size: 90, weight: '900' },
  ],
  'onboarding-03-workplace.png': [
    { text: 'しごと', x: 512, y: 200, size: 110, weight: '900' },
  ],
  'onboarding-04-habit.png': [
    { text: '7時', x: 512, y: 200, size: 130, weight: '900' },
  ],
};

async function rasterizeSvg(page, svgPath, pngPath, size = 512) {
  const svg = fs.readFileSync(svgPath, 'utf8');
  const html = `<!doctype html><html><head><style>
    html, body { margin:0; padding:0; background: transparent; }
    svg { width: ${size}px; height: ${size}px; display: block; }
  </style></head><body>${svg}</body></html>`;
  await page.setContent(html);
  await page.setViewportSize({ width: size, height: size });
  const el = await page.locator('svg').first();
  await el.screenshot({ path: pngPath, omitBackground: true });
}

async function compositeKanji(page, basePng, outPng, overlays) {
  const abs = path.resolve(basePng);
  // Build a temp HTML file next to the PNG so relative paths resolve
  const tmpHtml = path.join(path.dirname(outPng), '_tmp_' + Date.now() + '.html');
  const baseFile = path.basename(basePng);
  const html = `<!doctype html><html><head><style>
    html, body { margin:0; padding:0; }
    #wrap { position: relative; width: 1024px; height: 1536px; }
    #bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .label { position: absolute; transform: translate(-50%, -50%); color: #0F172A; font-family: 'Noto Sans JP', system-ui, sans-serif; text-align: center; line-height: 1; text-shadow: 0 4px 12px rgba(255,255,255,0.85), 0 1px 0 #FFFFFF; }
  </style></head><body>
    <div id="wrap">
      <img id="bg" src="${baseFile}" />
      ${overlays.map(o => `<div class="label" style="left:${o.x}px;top:${o.y}px;font-size:${o.size}px;font-weight:${o.weight};">${o.text}</div>`).join('\n')}
    </div>
  </body></html>`;
  fs.writeFileSync(tmpHtml, html);
  try {
    await page.goto('file:///' + tmpHtml.replace(/\\/g, '/'));
    await page.setViewportSize({ width: 1024, height: 1536 });
    // Wait for the image to actually load
    await page.waitForFunction(() => {
      const img = document.getElementById('bg');
      return img && img.complete && img.naturalWidth > 0;
    }, { timeout: 5000 });
    await page.locator('#wrap').screenshot({ path: outPng });
  } finally {
    fs.unlinkSync(tmpHtml);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/tophe/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  const context = await browser.newContext({ viewport: { width: 1024, height: 1536 } });
  const page = await context.newPage();

  // 1. Mascot SVGs → PNGs
  const mascotFiles = ['mascot-base.svg', 'mascot-happy.svg', 'mascot-thinking.svg', 'mascot-encourage.svg', 'mascot-celebrate.svg'];
  for (const f of mascotFiles) {
    const svgPath = path.join(OUT_MASCOTS, f);
    const pngPath = path.join(OUT_MASCOTS, f.replace('.svg', '.png'));
    await rasterizeSvg(page, svgPath, pngPath, 512);
    console.log(`mascot: ${f} -> ${path.basename(pngPath)}`);
  }

  // 2. Onboarding PNGs with kanji overlay
  for (const [baseName, overlays] of Object.entries(ONBOARDING_TEXT)) {
    const basePath = path.join(OUT_ONBOARDING, baseName);
    const outPath = path.join(OUT_ONBOARDING, baseName.replace('.png', '-final.png'));
    await compositeKanji(page, basePath, outPath, overlays);
    console.log(`onboarding: ${baseName} -> ${path.basename(outPath)}`);
  }

  await browser.close();
  console.log('done');
}

main().catch(e => { console.error(e); process.exit(1); });
