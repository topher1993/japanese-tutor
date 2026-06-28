// scripts/rasterize-tab-icons.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DIR = path.resolve(__dirname, '..', 'src', 'assets', 'source', 'tab-icons');

async function rasterizeSvg(page, svgPath, pngPath, size = 128) {
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

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/tophe/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe',
  });
  const page = await browser.newPage();
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.svg'));
  for (const f of files) {
    const svgPath = path.join(DIR, f);
    const pngPath = path.join(DIR, f.replace('.svg', '.png'));
    await rasterizeSvg(page, svgPath, pngPath, 128);
    console.log(`tab-icon: ${f} -> ${path.basename(pngPath)}`);
  }
  await browser.close();
  console.log('done');
}

main().catch(e => { console.error(e); process.exit(1); });