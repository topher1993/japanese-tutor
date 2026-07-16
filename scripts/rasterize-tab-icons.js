// Rasterize tab-icon SVGs with the project's existing Sharp dependency.
const fs = require('node:fs/promises');
const path = require('node:path');
const { rasterizeSvgFile } = require('./lib/rasterize');

const ICON_DIR = path.resolve(__dirname, '..', 'src', 'assets', 'source', 'tab-icons');

async function main() {
  const files = (await fs.readdir(ICON_DIR)).filter(file => file.endsWith('.svg'));
  for (const file of files) {
    const source = path.join(ICON_DIR, file);
    const output = path.join(ICON_DIR, file.replace(/\.svg$/, '.png'));
    await rasterizeSvgFile(source, output, 128);
    console.log(`tab icon: ${file} -> ${path.basename(output)}`);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
