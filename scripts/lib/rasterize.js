const fs = require('node:fs/promises');
const sharp = require('sharp');

async function rasterizeSvgFile(svgPath, pngPath, width, height = width) {
  const svg = await fs.readFile(svgPath);
  await sharp(svg, { density: 300 })
    .resize(width, height, { fit: 'contain' })
    .png()
    .toFile(pngPath);
}

module.exports = { rasterizeSvgFile };
