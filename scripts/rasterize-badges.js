// Rasterize badge SVGs with the project's existing Sharp dependency.
const fs = require('node:fs/promises');
const path = require('node:path');
const { rasterizeSvgFile } = require('./lib/rasterize');

const BADGE_DIR = path.resolve(__dirname, '..', 'src', 'assets', 'source', 'badges');

async function main() {
  const files = (await fs.readdir(BADGE_DIR)).filter(file => file.endsWith('.svg'));
  for (const file of files) {
    const source = path.join(BADGE_DIR, file);
    const output = path.join(BADGE_DIR, file.replace(/\.svg$/, '.png'));
    await rasterizeSvgFile(source, output, 256);
    console.log(`badge: ${file} -> ${path.basename(output)}`);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
