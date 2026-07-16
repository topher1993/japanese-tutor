import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTRACT_ID = 'koi-sensei-avatar/v1';
const OUTPUT_PATH = fileURLToPath(new URL(
  '../../../../../assets/koi-sensei/koi-sensei-placeholder.glb',
  import.meta.url,
));

const float32 = values => {
  const buffer = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => buffer.writeFloatLE(value, index * 4));
  return buffer;
};

const uint16 = values => {
  const buffer = Buffer.alloc(values.length * 2);
  values.forEach((value, index) => buffer.writeUInt16LE(value, index * 2));
  return buffer;
};

const positions = float32([
  0.90, 0.00, 0.00,
  0.20, 0.45, 0.00,
  -0.45, 0.25, 0.00,
  -0.95, 0.65, 0.00,
  -0.75, 0.00, 0.00,
  -0.95, -0.65, 0.00,
  -0.45, -0.25, 0.00,
  0.20, -0.45, 0.00,
]);
const indices = uint16([
  0, 1, 2,
  0, 2, 6,
  0, 6, 7,
  2, 3, 4,
  2, 4, 6,
  4, 5, 6,
]);
const animationTimes = float32([0, 1]);
const animationTranslations = float32([
  0, 0, 0,
  0, 0.04, 0,
]);

const offsets = {
  positions: 0,
  indices: positions.length,
  animationTimes: positions.length + indices.length,
  animationTranslations: positions.length + indices.length + animationTimes.length,
};
const binary = Buffer.concat([positions, indices, animationTimes, animationTranslations]);

const animationNames = [
  'Idle',
  'Blink',
  'Thinking',
  'Speaking',
  'Celebration',
  'Encouragement',
];

const gltf = {
  asset: {
    version: '2.0',
    generator: 'Koi Sensei deterministic engineering placeholder generator',
    extras: { contractId: CONTRACT_ID, nonProduction: true },
  },
  scene: 0,
  scenes: [{ name: 'KoiScene', nodes: [0] }],
  nodes: [
    { name: 'KoiRoot', children: [1, 2, 3, 4, 5] },
    { name: 'KoiBody', mesh: 0 },
    { name: 'Socket_Crest', translation: [0, 0.48, 0] },
    { name: 'Socket_Face', translation: [0.58, 0.08, 0] },
    { name: 'Socket_Back', translation: [-0.10, 0.35, 0] },
    { name: 'Socket_Hand', translation: [0.35, -0.32, 0] },
  ],
  meshes: [{
    name: 'KoiPlaceholderMesh',
    primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0, mode: 4 }],
  }],
  materials: [{
    name: 'KoiPlaceholderOrange',
    doubleSided: true,
    pbrMetallicRoughness: {
      baseColorFactor: [0.96, 0.42, 0.12, 1],
      metallicFactor: 0,
      roughnessFactor: 0.85,
    },
  }],
  buffers: [{ byteLength: binary.length }],
  bufferViews: [
    { buffer: 0, byteOffset: offsets.positions, byteLength: positions.length, target: 34962 },
    { buffer: 0, byteOffset: offsets.indices, byteLength: indices.length, target: 34963 },
    { buffer: 0, byteOffset: offsets.animationTimes, byteLength: animationTimes.length },
    { buffer: 0, byteOffset: offsets.animationTranslations, byteLength: animationTranslations.length },
  ],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: 8,
      type: 'VEC3',
      min: [-0.95, -0.65, 0],
      max: [0.90, 0.65, 0],
    },
    { bufferView: 1, componentType: 5123, count: 18, type: 'SCALAR' },
    { bufferView: 2, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
    { bufferView: 3, componentType: 5126, count: 2, type: 'VEC3' },
  ],
  animations: animationNames.map(name => ({
    name,
    samplers: [{ input: 2, output: 3, interpolation: 'LINEAR' }],
    channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }],
  })),
};

const jsonSource = JSON.stringify(gltf);
const jsonPadding = (4 - (Buffer.byteLength(jsonSource) % 4)) % 4;
const json = Buffer.from(jsonSource + ' '.repeat(jsonPadding), 'utf8');
const binaryPadding = (4 - (binary.length % 4)) % 4;
const paddedBinary = Buffer.concat([binary, Buffer.alloc(binaryPadding)]);
const totalLength = 12 + 8 + json.length + 8 + paddedBinary.length;
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(totalLength, 8);
const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(json.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);
const binaryHeader = Buffer.alloc(8);
binaryHeader.writeUInt32LE(paddedBinary.length, 0);
binaryHeader.writeUInt32LE(0x004e4942, 4);
const glb = Buffer.concat([header, jsonHeader, json, binaryHeader, paddedBinary]);

if (glb.length !== totalLength) throw new Error('Generated GLB length mismatch.');
await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, glb);
console.log(`Generated ${resolve(OUTPUT_PATH)} (${glb.length} bytes)`);

